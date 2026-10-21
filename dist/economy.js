import {costUnits,costFields,allocateOutputCosts,manufacturedPrice,workerIncome,quantityPayment} from './production-costing.js?v=babbc3d3950e';
import {planProductionBatch,productionTolerance} from './industrial-production.js?v=babbc3d3950e';
import {FundedMarket,marketCommitment} from './funded-market.js?v=babbc3d3950e';
import {fundedInputQuantity,inputCoverage,procurementState} from './industrial-procurement.js?v=babbc3d3950e';
import {compileManufacturingDefinition,describeIndustryInstance} from './industry-contract.js?v=babbc3d3950e';
import {toMicrogold,fromMicrogold,addMicrogold} from './money.js?v=babbc3d3950e';
import {GoodsInventory,goodsLocation} from './goods-inventory.js?v=babbc3d3950e';
import {EconomicAccounts,accountId} from './economic-accounts.js?v=babbc3d3950e';
import {DEFAULT_SUBSYSTEM_SETTINGS} from './compiled-configuration.js?v=babbc3d3950e';
// Headless Layer 1. Goods use float64; money uses safe integer microgold.
import {commodityRegistry as defaultCommodityRegistry,factionRegistry,industryRegistry as defaultIndustryRegistry} from './simulation-registry.js?v=babbc3d3950e';
// Compatibility export; active engines enumerate their registry at use time.
export const COMMODITIES = Object.freeze(defaultCommodityRegistry.values().filter(c=>c.market_enabled!==false).map(c=>c.id));
export const FACTIONS = Object.freeze(factionRegistry.values().sort((a,b)=>a.runtime_order-b.runtime_order).map(f=>f.runtime_id));
export const EventType = Object.freeze(Object.fromEntries(['ON_CRITICAL_SCARCITY','ON_MARKET_SURPLUS','ON_RESERVATION_STALLED','ON_TREASURY_DEPLETED'].map(v=>[v,v])));
const copy = value => structuredClone(value);
const ok = value => ({ok:true,value});
const fail = code => ({ok:false,error:{code}});
const number = (v, name, positive=false) => {
  if (!Number.isFinite(v) || (positive ? v<=0 : v<0)) throw new RangeError(name);
  return v;
};
const sum = (a,b) => { const v=a+b; if(!Number.isFinite(v)) throw new RangeError('Numeric overflow'); return v; };

export function availableStock(stock) { return Math.max(0,stock.current_stock-stock.reserved_stock); }
function rawPrice(stock) {
  const available=availableStock(stock);
  if(available===0) return stock.base_price*10;
  if(available>=stock.target_capacity*10) return stock.base_price*.1;
  // Evaluate in log space to keep extreme but finite inputs bounded.
  const exponent=stock.elasticity_gamma*(Math.log(stock.target_capacity)-Math.log(Math.max(available,.001)));
  return Math.max(stock.base_price*.1,Math.min(stock.base_price*10,stock.base_price*Math.exp(Math.max(Math.log(.1),Math.min(Math.log(10),exponent)))));
}
export function calculatePrice(stock){return fromMicrogold(Math.max(1,toMicrogold(rawPrice(stock))));}



function createStockpile(registry,id,raw,settings){
        if(!registry.has(id)||(raw.commodity_id!==undefined&&raw.commodity_id!==id)) throw new TypeError('Invalid commodity');
        if((raw.reserved_stock??0)!==0) throw new TypeError('Create reservations through the API');
        const production_pool=raw.production_pool??'TRADE';if(!['TRADE','CONSUMPTION'].includes(production_pool))throw new TypeError('Invalid production pool');
        const s={commodity_id:id,current_stock:number(raw.trade_stock??raw.current_stock??0,'trade_stock'),consumption_stock:number(raw.consumption_stock??0,'consumption_stock'),consumption_target:number(raw.consumption_target??raw.target_capacity,'consumption_target'),production_pool,reserved_stock:0,
          target_capacity:number(raw.target_capacity,'target_capacity',true),base_production_rate:number(raw.base_production_rate??0,'production'),base_consumption_rate:number(raw.base_consumption_rate??0,'consumption'),
          base_price:number(raw.base_price,'base_price',true),elasticity_gamma:number(raw.elasticity_gamma??settings.defaultElasticity,'elasticity_gamma',true),prod_modifier:number(raw.prod_modifier??1,'prod_modifier'),cons_modifier:number(raw.cons_modifier??1,'cons_modifier'),current_price:0};
        number(s.base_price*10,'price ceiling',true); number(s.base_price*.1,'price floor',true);
        s.current_price=calculatePrice(s); return s;
}
export class EconomicEngine {
  #productionClockManaged=false; #productionStates=new Map(); #productionHistory=[];
  #procurementTime=0; #procurementClockManaged=false; #industryReviews=new Map();
  #industryInvestments=new Map(); #industryProjects=new Map(); #factoryRemoving=null;
  #goods=new GoodsInventory();#procurementBuyers=new Map();#market;#marketExecuting=false;#deferredMarketEvents=null;#marketInternal=false; #workerShare; #tradeHistory=[]; #allocationSerial=0;
  #industryRegistry; #ports=new Map(); #treasuries=new Map(); #reservations=new Map(); #serial=0;
  #marketListeners=new Set(); #marketRevision=0; #goodsLosses=[]; #lossSerial=0; #publishing=false;
  marketListenerErrors=[];
  accounts=new EconomicAccounts(); #accountSettings; #industryAccounts=[];
  #tick=0; #running=false; #bus; #options;
  constructor({industryRegistry=defaultIndustryRegistry,industries=[],ports=[],treasuries=[],eventBus=null,settings=DEFAULT_SUBSYSTEM_SETTINGS.economy,economicTickSeconds=settings.secondsPerDay/settings.ticksPerDay||DEFAULT_SUBSYSTEM_SETTINGS.clock.economicTickSeconds,ticksPerDay=1,scarcityRatio=settings.scarcityRatio,surplusRatio=settings.surplusRatio,commodityRegistry=defaultCommodityRegistry}={}) {
    if(!Number.isSafeInteger(ticksPerDay)||ticksPerDay<1) throw new RangeError('ticksPerDay');
    number(economicTickSeconds,'Economic interval',true);number(scarcityRatio,'scarcityRatio'); number(surplusRatio,'surplusRatio',true);
    if(scarcityRatio>=1||surplusRatio<=1) throw new RangeError('Signal thresholds');
    if(eventBus && typeof eventBus.emit!=='function') throw new TypeError('eventBus.emit required');
    if(typeof commodityRegistry?.get!=='function'||typeof commodityRegistry?.ids!=='function'||typeof commodityRegistry?.has!=='function')throw TypeError('Commodity registry required');this.commodityRegistry=commodityRegistry;
    this.#workerShare=number(settings.manufacturingWorkerShare??DEFAULT_SUBSYSTEM_SETTINGS.economy.manufacturingWorkerShare,'Manufacturing worker share');if(this.#workerShare>=1)throw RangeError('Manufacturing share must retain industry revenue');
    this.#bus=eventBus; this.#options={ticksPerDay,economicTickSeconds,scarcityRatio,surplusRatio,defaultElasticity:settings.defaultElasticity};this.configurationRevision=settings.revision;this.#accountSettings=settings;
    for(const faction of FACTIONS) this.#treasuries.set(faction,{faction_id:faction,balance_gold:0,last_income_gross:0,last_expense_gross:0});
    const seen=new Set();
    for(const input of treasuries) {
      if(!FACTIONS.includes(input.faction_id)||seen.has(input.faction_id)) throw new TypeError('Invalid or duplicate treasury');
      seen.add(input.faction_id);
      this.#treasuries.set(input.faction_id,{faction_id:input.faction_id,balance_gold:number(input.balance_gold??0,'balance_gold'),last_income_gross:0,last_expense_gross:0});
    }
    for(const treasury of this.#treasuries.values()){const id=accountId('FACTION',treasury.faction_id);this.accounts.create(id,'FACTION',treasury.faction_id,{balance:treasury.balance_gold,reason:'Retained faction initial treasury'});this.accounts.bind(treasury,'balance_gold',id,'legacy faction balance mutation');}
    for(const input of ports)this.registerPort(input);
    this.#industryRegistry=industryRegistry;this.configureIndustries(industries);
    this.#market=new FundedMarket({validDestination:(owner,port,location)=>this.#investmentDestination(owner,port,location),receivingReservation:(location)=>[...this.#industryInvestments.values()].find(p=>p.location===location)?.reservationId??null,pricing:(rows,c)=>this.#manufacturingQuote(rows,c),pricingTime:()=>this.#procurementTime,ownerPort:owner=>{const a=this.accounts.inspect(owner);return a.ownerType==='PORT'?a.ownerId:this.#industryAccounts.find(i=>i.id===owner)?.portId??this.#procurementBuyers.get(owner)?.portId;},accounts:this.accounts,goods:this.#goods,stock:(p,c)=>this.#stock(p,c),store:owner=>this.#store(owner),revenue:(rows,buyer,c,price,total,priceUnits)=>this.#revenue(rows,buyer,c,price,true,total,priceUnits),record:(v,ctx)=>this.#recordMarketTrade(v,ctx),synchronize:(p,c)=>this.#sync(p,c),changed:(p,c,{refreshSupply=true}={})=>{this.#sync(p,c);if(refreshSupply)this.#market.refreshSupply(p,c);if(!this.#running)this.#publishMarket(p,[c],{},refreshSupply);},writable:()=>{if(this.#publishing||this.#running&&!this.#marketInternal)throw Error('Economy is executing');}});
    for(const p of this.#ports.values())for(const c of p.stockpiles.keys())this.#market.refreshSupply(p.id,c);
  }
  configureIndustries(instances){
    this.#assertWritable();if([...this.#productionStates.values()].some(p=>p.batch))throw Error('Finish production before industry reconfiguration');if([...this.#industryProjects.values()].some(p=>p.state!=='REMOVED'))throw Error('Constructed industries require the construction lifecycle');const next=[];
    for(const instance of instances){const recipe=this.#industryRegistry.get(instance.industry_id),count=instance.count??1;if(!this.#ports.has(instance.port_id)||!Number.isSafeInteger(count)||count<1||recipe.inputs.length===0)throw TypeError('Invalid manufacturing instance');for(const item of [...recipe.inputs,...recipe.outputs])this.#stock(instance.port_id,item.commodity_id);next.push({port_id:instance.port_id,recipe,count});}
    const identities=[],seen=new Set(),ordinal=new Map();
    for(const instance of instances){const key=instance.port_id+'|'+instance.industry_id,n=ordinal.get(key)??0;ordinal.set(key,n+(instance.count??1));for(let j=0;j<(instance.count??1);j++){const owner=instance.instance_id?(instance.count??1)>1?instance.instance_id+':'+j:instance.instance_id:key+'|'+(n+j),id=accountId('INDUSTRY',owner);if(seen.has(id))throw TypeError('Duplicate industry instance');seen.add(id);identities.push({id,owner,portId:instance.port_id,industryId:instance.industry_id,balance:instance.initial_gold??this.#accountSettings.industryStartingGold??0});}}

    const existing=new Map(this.accounts.snapshot().accounts.map(a=>[a.id,a]));
    for(const i of identities){number(i.balance,'Industry capital');const account=existing.get(i.id);if(account&&!account.active)throw Error('Retired industry identity');if(!account&&!this.accounts.initializing&&i.balance)throw Error('Initialization is closed');}
    for(const old of this.#industryAccounts)if(!seen.has(old.id)&&this.accounts.inspect(old.id).committed)throw Error('Committed industry cannot retire');
    for(const i of identities)if(!existing.has(i.id))this.accounts.create(i.id,'INDUSTRY',i.owner,{balance:i.balance,reason:'Initial industry working capital'});
    for(const old of this.#industryAccounts)if(!seen.has(old.id))this.retireActorAccount(old.id,old.portId);
    this.#industryAccounts=identities.map(i=>({...i,definition:compileManufacturingDefinition(this.#industryRegistry.get(i.industryId),this.commodityRegistry.ids()),instance:describeIndustryInstance(this.#industryRegistry.get(i.industryId),{instanceId:i.owner,portId:i.portId},this.commodityRegistry.ids())}));this.#industryReviews=new Map([...this.#industryReviews].filter(([id])=>seen.has(id)));
    this.#productionStates=new Map([...this.#productionStates].filter(([id])=>seen.has(id)));
  }
  getFinancialSnapshot(){return this.accounts.snapshot();}
  getPortTreasury(id){return this.accounts.inspect(accountId('PORT',id));}
  getIndustryDefinitions(){return copy(this.#industryRegistry.values());}
  getIndustryAccounts(){return Object.freeze(this.#industryAccounts.map(i=>{const production=this.getIndustryProduction(i.id)[0];return Object.freeze({...copy(i),instance:{...copy(i.instance),production},productionMode:i.definition.runtimeEnabled?'ELAPSED_SIMULATION_TIME':'NOT_ACTIVATED',production,account:this.accounts.inspect(i.id)});}));}
  getIndustryProjects(portId=null){return copy([...this.#industryProjects.values()].filter(p=>!portId||p.portId===portId));}
  #investmentDestination(owner,port,location){return [...this.#industryInvestments.values()].some(p=>p.ownerAccountId===owner&&p.portId===port&&p.location===location&&p.state==='ACQUIRING'&&!this.#industryProjects.has(p.id));}
  getIndustryInvestments(portId=null){return copy([...this.#industryInvestments.values()].filter(p=>!portId||p.portId===portId).map(p=>({...p,state:this.#industryProjects.get(p.id)?.state??p.state,capitalCommittedUnits:this.accounts.inspectReservation('CAPITAL:'+p.id)?.amountUnits??0,materialsStatus:Object.entries(p.materials).map(([commodityId,quantity])=>({commodityId,quantity,held:this.#goods.amount({ownerAccountId:p.ownerAccountId,location:p.location,reservationId:this.#industryProjects.get(p.id)?.reservationId??p.reservationId,commodityId}),inbound:this.#market.incomingAt(p.ownerAccountId,commodityId,p.location),ordered:[...this.#market.orders.values()].filter(o=>o.buyerAccountId===p.ownerAccountId&&o.destination===p.location&&o.commodityId===commodityId).reduce((n,o)=>n+o.remainingQuantity,0)}))})));}
  beginIndustryInvestment({id,portId,typeId,reserveUnits,minimumSurplusUnits=0,materialPrices,evidence,estimate}){return this.#marketAction(()=>{
    if(this.accounts.initializing)throw Error('Seal initialization before investment');const prior=this.#industryInvestments.get(id);if(prior){if(prior.portId!==portId||prior.typeId!==typeId)throw Error('Conflicting investment');return this.getIndustryInvestments(portId).find(p=>p.id===id);}
    if(typeof id!=='string'||!id||this.#industryProjects.has(id)||!this.#ports.has(portId))throw Error('Invalid investment identity');if(!evidence||evidence.source!=='LOCAL_MARKET'||typeof evidence.originPortId!=='string'||typeof evidence.viaShipId!=='string'||!Number.isSafeInteger(evidence.observationTick)||evidence.observationTick<0)throw Error('Investment requires an identifiable visiting observation');const definition=compileManufacturingDefinition(this.#industryRegistry.get(typeId),this.commodityRegistry.ids());if(!definition.runtimeEnabled)throw Error('Inactive industry');
    const ownerAccountId=accountId('PORT',portId),materials=definition.construction.materials,capitalUnits=definition.construction.workingCapitalUnits,needs=[];let budget=capitalUnits;
    for(const [c,q] of Object.entries(materials)){const priceUnits=materialPrices[c];fromMicrogold(priceUnits);if(!priceUnits)throw Error('Invalid material bid');const owned=Math.min(q,this.#saleRows({ownerAccountId,location:goodsLocation('MARKET',portId),commodityId:c,reservationId:null}).reduce((n,r)=>n+r.quantity,0)),missing=q-owned,hold=missing>1e-9?marketCommitment(missing,priceUnits):0;fromMicrogold(hold);budget=addMicrogold(budget,hold);needs.push({c,q,owned,missing,priceUnits});}
    if(this.accounts.inspect(ownerAccountId).spendableUnits<addMicrogold(addMicrogold(reserveUnits,minimumSurplusUnits),budget))throw Error('Protected reserve or obligations would be spent');
    const before=this.#market.checkpoint(),history=[...this.#tradeHistory],serial=this.#allocationSerial,revision=this.#marketRevision;this.#deferredMarketEvents=[];let events;
    try{this.accounts.settlementBatch(()=>{
      const p={id,portId,typeId,ownerAccountId,location:goodsLocation('CONSTRUCTION',id),reservationId:'INVEST:'+id,state:'ACQUIRING',materials:copy(materials),capitalUnits,reserveAtDecisionUnits:reserveUnits,estimatedCommitmentUnits:budget,evidence:copy(evidence),estimate:copy(estimate)};this.#industryInvestments.set(id,p);if(capitalUnits)this.accounts.reserve('CAPITAL:'+id,ownerAccountId,capitalUnits);
      for(const n of needs){if(n.owned){this.#market.withdrawAutomatic(portId,ownerAccountId,n.c);this.#goods.move({ownerAccountId,location:goodsLocation('MARKET',portId),commodityId:n.c,reservationId:null},n.owned,{location:p.location,reservationId:p.reservationId});this.#sync(portId,n.c);}if(n.missing>1e-9)this.#market.createOrder({id:'investment:'+id+':'+n.c,portId,buyerAccountId:ownerAccountId,commodityId:n.c,quantity:n.missing,priceUnits:n.priceUnits,destination:p.location});}
      for(const n of needs){const order=this.#market.orders.get('investment:'+id+':'+n.c);if(order)for(const offer of this.#market.bestOffers(portId,n.c)){if(!this.#market.orders.has(order.id)||offer.priceUnits>order.priceUnits)break;this.#market.fill(order.id,{offerId:offer.id,quantity:order.remainingQuantity});}}
    },{allowReservations:true});events=this.#deferredMarketEvents;}
    catch(error){this.#market.restore(before);this.#industryInvestments.delete(id);this.#tradeHistory=history;this.#allocationSerial=serial;this.#marketRevision=revision;this.#syncAll();throw error;}finally{this.#deferredMarketEvents=null;}for(const event of events)this.#emitMarket(event);
    this.#publishMarket(portId,Object.keys(materials));const complete=[...this.#industryInvestments.values()].filter(p=>this.#industryProjects.get(p.id)?.state==='COMPLETE');for(const p of complete.slice(0,-128))this.#industryInvestments.delete(p.id);return this.getIndustryInvestments(portId).find(p=>p.id===id);
  });}
  beginIndustryConstruction({id,instanceId,portId,typeId,site},effects={}){
    this.#assertWritable();if(this.accounts.initializing)throw Error('Seal initialization before construction');
    const prior=this.#industryProjects.get(id);if(prior){if(prior.instanceId!==instanceId||prior.portId!==portId||prior.typeId!==typeId||JSON.stringify(prior.site)!==JSON.stringify(site))throw Error('Conflicting construction identity');return copy(prior);}
    if(typeof id!=='string'||!id||typeof instanceId!=='string'||!instanceId||!this.#ports.has(portId))throw Error('Invalid construction identity');
    const investment=this.#industryInvestments.get(id),sourceLocation=investment?.location??goodsLocation('MARKET',portId),sourceReservationId=investment?.reservationId??null;
    if(investment&&(investment.portId!==portId||investment.typeId!==typeId))throw Error('Construction must preserve accepted investment identity');
    if(investment&&([...this.#market.orders.values()].some(o=>o.destination===sourceLocation)||[...this.#market.transfers.values()].some(t=>t.destination===sourceLocation)))throw Error('Finish investment procurement before construction');
    const descriptor=describeIndustryInstance(this.#industryRegistry.get(typeId),{instanceId,portId},this.commodityRegistry.ids()),owner=accountId('PORT',portId),location=goodsLocation('CONSTRUCTION',id),reservationId='BUILD:'+id,commitmentId='CAPITAL:'+id,materials=descriptor.definition.construction.materials,capitalUnits=descriptor.definition.construction.workingCapitalUnits;
    if(this.accounts.snapshot().accounts.some(a=>a.id===descriptor.accountId))throw Error('Industry identity already exists');
    for(const [c,q] of Object.entries(materials)){this.#stock(portId,c);if(this.#saleRows({ownerAccountId:owner,location:sourceLocation,commodityId:c,reservationId:sourceReservationId}).reduce((n,r)=>n+r.quantity,0)<q)throw Error('Insufficient owned construction materials: '+c);}
    if(this.accounts.inspect(owner).spendableUnits+(investment?this.accounts.inspectReservation(commitmentId)?.amountUnits??0:0)<capitalUnits)throw Error('Insufficient available working capital');
    const project={id,instanceId,portId,typeId,site:copy(site),state:'BUILDING',elapsedSeconds:0,durationSeconds:descriptor.definition.construction.durationSeconds,materials:copy(materials),capitalUnits,commitmentId,reservationId,location,accountId:descriptor.accountId,descriptor};
    const goods=this.#goods.checkpoint(),offers=new Map(this.#market.offers);this.#publishing=true;
    try{this.accounts.settlementBatch(()=>{
      this.accounts.create(descriptor.accountId,'INDUSTRY',instanceId,{reason:'Unfunded construction account'});
      if(capitalUnits)this.accounts.reserve(commitmentId,owner,capitalUnits);
      for(const [c,q] of Object.entries(materials)){if(!investment)this.#market.withdrawAutomatic(portId,owner,c);this.#goods.move({ownerAccountId:owner,location:sourceLocation,commodityId:c,reservationId:sourceReservationId},q,{location,reservationId});this.#sync(portId,c);}
      if(investment)for(const c of Object.keys(materials)){const filter={ownerAccountId:owner,location:sourceLocation,commodityId:c,reservationId:sourceReservationId},extra=this.#goods.amount(filter);if(extra)this.#goods.move(filter,extra,{location:goodsLocation('MARKET',portId),reservationId:null});}this.#industryProjects.set(id,project);effects.apply?.();
    },{allowReservations:true,allowAccountCreation:true});}
    catch(error){this.#goods.restore(goods);this.#market.offers=offers;this.#industryProjects.delete(id);this.#syncAll();effects.rollback?.();throw error;}
    finally{this.#publishing=false;}
    this.#publishMarket(portId,Object.keys(materials));return copy(project);
  }
  advanceIndustryConstruction(id,dt){this.#assertWritable();number(dt,'Construction elapsed time');const p=this.#industryProjects.get(id);if(!p)throw Error('Unknown construction');if(p.state==='BUILDING')p.elapsedSeconds=Math.min(p.durationSeconds,sum(p.elapsedSeconds,dt));return copy(p);}
  completeIndustryConstruction(id,effects={}){
    this.#assertWritable();const p=this.#industryProjects.get(id);if(!p)throw Error('Unknown construction');if(p.state==='COMPLETE'||p.state==='REMOVED')return copy(p);if(p.elapsedSeconds+1e-8<p.durationSeconds)throw Error('Construction is not ready');
    const owner=accountId('PORT',p.portId),goods=this.#goods.checkpoint(),before=copy(p),identities=[...this.#industryAccounts];
    for(const [c,q] of Object.entries(p.materials))this.#goods.select({ownerAccountId:owner,location:p.location,commodityId:c,reservationId:p.reservationId},q);
    this.#publishing=true;const apply=()=>{
      for(const [c,q] of Object.entries(p.materials))this.#goods.remove({ownerAccountId:owner,location:p.location,commodityId:c,reservationId:p.reservationId},q,'industry construction');
      const instance={...copy(p.descriptor),construction:{state:'COMPLETE',elapsedSeconds:p.durationSeconds},connection:{portId:p.portId,state:'CONNECTED'}};
      this.#industryAccounts.push({id:p.accountId,owner:p.instanceId,portId:p.portId,industryId:p.typeId,balance:0,definition:instance.definition,productionMode:instance.definition.runtimeEnabled?'ELAPSED_SIMULATION_TIME':'NOT_ACTIVATED',instance});
      p.state='COMPLETE';effects.apply?.(instance);
    },rollback=()=>{this.#goods.restore(goods);this.#industryAccounts=identities;Object.assign(p,before);effects.rollback?.();};
    try{if(p.capitalUnits)this.accounts.settleReservation(p.commitmentId,[{accountId:p.accountId,amountUnits:p.capitalUnits}],{id:'factory-capital:'+id,reason:'Port investment in industry working capital'}, {apply,rollback});
      else this.accounts.payMany([{accountId:owner,amountUnits:0}],[{accountId:p.accountId,amountUnits:0}],{id:'factory-capital:'+id,reason:'Zero-capital industry completion'},{apply,rollback});}
    finally{this.#publishing=false;}
    this.#publishMarket(p.portId,Object.keys(p.materials));return copy(p);
  }
  removeConstructedIndustry(instanceId,effects={}){
    this.#assertWritable();const p=[...this.#industryProjects.values()].find(p=>p.instanceId===instanceId);if(!p||p.state==='BUILDING')throw Error('Completed factory required');if(p.state==='REMOVED')return copy(p);
    // Do not abandon accepted deliveries or cancel contracts as a side effect of removal.
    if(this.#market.snapshot().offers.some(o=>o.sellerAccountId===p.accountId)||this.#market.snapshot().orders.some(o=>o.buyerAccountId===p.accountId))throw Error('Cancel industry offers and orders before removal');
    const identities=[...this.#industryAccounts];this.#factoryRemoving=p.accountId;try{this.retireActorAccount(p.accountId,p.portId,accountId('PORT',p.portId),{apply:()=>{this.#industryAccounts=this.#industryAccounts.filter(i=>i.id!==p.accountId);p.state='REMOVED';effects.apply?.();},rollback:()=>{this.#industryAccounts=identities;p.state='COMPLETE';effects.rollback?.();}});}finally{this.#factoryRemoving=null;}const removed=[...this.#industryProjects.values()].filter(p=>p.state==='REMOVED');for(const old of removed.slice(0,-128))this.#industryProjects.delete(old.id);return copy(p);
  }
  get commodityIds(){return this.commodityRegistry.ids().filter(id=>this.commodityRegistry.get(id).market_enabled!==false);}
  registerPort(input){
    this.#assertWritable();
      if(typeof input.id!=='string'||!input.id||this.#ports.has(input.id)||!FACTIONS.includes(input.owner_faction)) throw new TypeError('Invalid or duplicate port');
      const capital=number(input.initial_gold??this.#accountSettings.portStartingGold??0,'Port capital'),taxCapital=number(input.accumulated_tax_gold??0,'tax pool');if(!this.accounts.initializing&&(capital||taxCapital))throw Error('Initialization is closed');
      const tax=number(input.tax_rate??0,'tax_rate'); if(tax>.35) throw new RangeError('tax_rate');
      if((input.active_reservations?.length??0)!==0) throw new TypeError('Create reservations through the API');
      const stockpiles=new Map();
      const entries=input.stockpiles instanceof Map ? input.stockpiles : Object.entries(input.stockpiles??{});
      for(const [id,raw] of entries)stockpiles.set(id,createStockpile(this.commodityRegistry,id,raw,this.#options));
      if(!this.accounts.initializing&&[...stockpiles.values()].some(s=>s.current_stock||s.consumption_stock))throw Error('Initial inventory is closed');
      this.#ports.set(input.id,{id:input.id,name:input.name??input.id,owner_faction:input.owner_faction,tax_rate:0,accumulated_tax_gold:number(input.accumulated_tax_gold??0,'tax pool'),stockpiles,active_reservations:[]});

    this.accounts.create(accountId('PORT',input.id),'PORT',input.id,{balance:capital,reason:'Initial port population funds'});
    const taxId=accountId('PORT_TAX',input.id);this.accounts.create(taxId,'PORT_TAX',input.id,{balance:taxCapital,reason:'Opening pending tax receipts'});this.accounts.bind(this.#ports.get(input.id),'accumulated_tax_gold',taxId,'legacy pending tax mutation');
    for(const [id,stock] of stockpiles)this.#initializeGoods(input.id,id,stock);
    this.#publishMarket(input.id);
  }

  get timestamp_tick() { return this.#tick; }
  #assertWritable() { if(this.#running||this.#publishing||this.#marketExecuting) throw new Error('Economic tick is executing'); }
  #stock(port,id) { const s=this.#ports.get(port)?.stockpiles.get(id); if(!s) throw new RangeError('Unknown port or commodity'); return s; }
  getPortStockpile(port,id) { const s=this.#stock(port,id);return Object.freeze({...copy(s),trade_stock:s.current_stock,offers:Object.freeze(this.#market?this.#market.bestOffers(port,id).map(o=>this.#market.inspectOffer(o.id)):[]),purchase_orders:Object.freeze(this.#market?this.#market.bestOrders(port,id).map(o=>this.#market.inspectOrder(o.id)):[]),ownership:Object.freeze([...this.#goods.inspect({location:goodsLocation('MARKET',port),commodityId:id}),...this.#goods.inspect({location:goodsLocation('TOWN',port),commodityId:id})])}); }
  getPortSupplies(port) { const p=this.#ports.get(port);if(!p)throw new RangeError('Unknown port');return Object.freeze([...p.stockpiles.keys()].map(id=>this.getPortStockpile(port,id))); }
  getPortIds(){return [...this.#ports.keys()];}
  getMarketSnapshot(port){const p=this.#ports.get(port);if(!p)throw RangeError('Unknown port');return Object.freeze({portId:p.id,name:p.name,faction:p.owner_faction,tax:p.tax_rate,revision:this.#marketRevision,tick:this.#tick,stocks:this.getPortSupplies(port)});}
  subscribeMarkets(listener){if(typeof listener!=='function')throw TypeError('Market listener');this.#marketListeners.add(listener);return ()=>this.#marketListeners.delete(listener);}
  #publishMarket(port,ids=null,details={},refreshSupply=true){const p=this.#ports.get(port);if(this.#market&&refreshSupply)for(const c of ids??[...p.stockpiles.keys()])this.#market.refreshSupply(port,c);const event=Object.freeze({...details,type:'MARKET_CHANGED',portId:port,name:p.name,faction:p.owner_faction,tax:p.tax_rate,revision:++this.#marketRevision,tick:this.#tick,stocks:Object.freeze((ids??[...p.stockpiles.keys()]).map(id=>this.getPortStockpile(port,id)))});if(this.#deferredMarketEvents){this.#deferredMarketEvents.push(event);return;}this.#emitMarket(event);}
  #emitMarket(event){this.#publishing=true;try{for(const listener of this.#marketListeners)try{listener(event);}catch(error){this.marketListenerErrors.push(error);if(this.marketListenerErrors.length>32)this.marketListenerErrors.shift();}}finally{this.#publishing=false;}}
  addStockpile(port,id,input){this.#assertWritable();const p=this.#ports.get(port);if(!p||p.stockpiles.has(id))throw TypeError('Invalid or duplicate stockpile');
   const stock=createStockpile(this.commodityRegistry,id,input,this.#options);if(!this.accounts.initializing&&(stock.current_stock||stock.consumption_stock))throw Error('Initial inventory is closed');p.stockpiles.set(id,stock);this.#initializeGoods(port,id,stock);this.#publishMarket(port,[id]);return this.getPortStockpile(port,id);
  }
  #initializeGoods(port,id,stock){
    if(!this.accounts.initializing&&(stock.current_stock||stock.consumption_stock))throw Error('Initial inventory is closed');
    for(const [type,q] of [['MARKET',stock.current_stock],['TOWN',stock.consumption_stock]])this.#goods.create({ownerAccountId:accountId('PORT',port),location:goodsLocation(type,port),commodityId:id,quantity:q,originPortId:port,reservationId:null,acquisitionCost:0},'initial inventory');
    this.#sync(port,id);
  }
  #sync(port,id){const s=this.#stock(port,id),rows=this.#goods.inspect({location:goodsLocation('MARKET',port),commodityId:id});s.current_stock=rows.reduce((n,r)=>n+r.quantity,0);s.reserved_stock=rows.filter(r=>r.reservationId!==null&&!r.reservationId.startsWith('OFFER:')).reduce((n,r)=>n+r.quantity,0);s.consumption_stock=this.#goods.amount({location:goodsLocation('TOWN',port),commodityId:id});s.current_price=calculatePrice(s);}
  #syncAll(){for(const p of this.#ports.values())for(const id of p.stockpiles.keys())this.#sync(p.id,id);}
  initializeInventory(record){this.#assertWritable();if(!this.accounts.initializing)throw Error('Initial inventory is closed');this.#checkIndustryOutputAllocation(record.ownerAccountId,record.commodityId,record.location,record.quantity);const owner=this.accounts.inspect(record.ownerAccountId),[type,encoded]=record.location?.split(':')??[],id=encoded?decodeURIComponent(encoded):null;if(!owner.active||!id||record.location!==goodsLocation(type,id)||record.reservationId||!this.commodityRegistry.has(record.commodityId)||!['MARKET','TOWN','INDUSTRY','INDUSTRY_OUTPUT','SHIP','ACCOUNT'].includes(type))throw TypeError('Invalid initial goods location or commodity');if(type==='TOWN'&&record.ownerAccountId!==accountId('PORT',id))throw TypeError('Wrong town owner');if(['INDUSTRY','INDUSTRY_OUTPUT','SHIP','ACCOUNT'].includes(type)&&(owner.ownerId!==id||(['INDUSTRY','INDUSTRY_OUTPUT'].includes(type)&&owner.ownerType!=='INDUSTRY')||(type==='SHIP'&&owner.ownerType!=='MERCHANT')))throw TypeError('Wrong storage owner');const port=record.location.startsWith('MARKET:')||record.location.startsWith('TOWN:')?decodeURIComponent(record.location.split(':')[1]):null;if(port)this.#stock(port,record.commodityId);const producer=this.#industryAccounts.find(i=>i.id===record.ownerAccountId&&this.#industryRegistry.get(i.industryId).outputs.some(o=>o.commodity_id===record.commodityId)),eligible=Object.hasOwn(record,'manufacturingIndustryAccountId')?record.manufacturingIndustryAccountId:producer?.id??null;if(eligible!==null&&eligible!==producer?.id)throw TypeError('Invalid initial manufacturing attribution');this.#goods.create({...record,manufacturingIndustryAccountId:eligible,originPortId:record.originPortId??port,reservationId:record.reservationId??null,acquisitionCost:record.acquisitionCost??0},'initial inventory');if(port){this.#sync(port,record.commodityId);this.#publishMarket(port,[record.commodityId]);}}
  #availableRows(filter){return this.#goods.inspect(filter);}
  #saleRows(filter,price=null){if(filter.reservationId!==null)return this.#goods.inspect(filter);const {reservationId,...rest}=filter;return this.#goods.inspect(rest).filter(r=>{if(r.reservationId===null)return true;const o=this.#market?.offers.get(r.reservationId?.slice(6));return o?.automatic;});}
  #availableAmount(filter){return this.#availableRows(filter).reduce((n,r)=>n+r.quantity,0);}
  #availableSelection(filter,q){const out=[];let left=q;for(const row of this.#availableRows(filter)){const quantity=Math.min(left,row.quantity);if(quantity>0)out.push({...row,quantity});left-=quantity;if(left<=0)break;}if(left>1e-8)throw Error('Insufficient owned goods');return out;}
  #moveAvailable(filter,q,changes){return this.#goods.transaction(()=>{for(const row of this.#availableSelection(filter,q))this.#goods.move({id:row.id},row.quantity,{...(row.reservationId?.startsWith('OFFER:')?{reservationId:null}:{}),...changes});});}
  #removeAvailable(filter,q,reason){return this.#goods.remove(filter,q,reason);}
  #marketAction(fn){this.#assertWritable();this.#marketExecuting=true;try{return fn();}finally{this.#marketExecuting=false;}}
  getFundedMarket(port=null){return this.#market.snapshot(port);}
  registerMarketBuyer({accountId:owner,portId,kind='SHIPYARD'}){this.#assertWritable();if(kind!=='SHIPYARD'||!this.#ports.has(portId))throw Error('Invalid procurement buyer');const a=this.accounts.inspect(owner);if(!a.active||a.ownerType!=='INDUSTRY'||this.#industryAccounts.some(i=>i.id===owner))throw Error('Buyer requires its own operating account');const old=this.#procurementBuyers.get(owner);if(old&&old.portId!==portId)throw Error('Buyer catchment cannot change');this.#procurementBuyers.set(owner,Object.freeze({accountId:owner,portId,kind,location:this.#store(owner)}));return this.#procurementBuyers.get(owner);}
  getMarketBuyers(){return Object.freeze([...this.#procurementBuyers.values()]);}
  createPurchaseOrder(input){return this.#marketAction(()=>{if(this.accounts.inspect(input.buyerAccountId).ownerType==='MERCHANT')throw Error('Merchant purchases require capacity-checked pickup acceptance');return this.#market.createOrder(input);});}
  amendPurchaseOrder(id,changes){return this.#marketAction(()=>this.#market.amendOrder(id,changes));}
  cancelPurchaseOrder(id){return this.#marketAction(()=>this.#market.cancelOrder(id));}
  amendSellingOffer(id,changes){return this.#marketAction(()=>this.#market.amendOffer(id,changes));}
  createSellingOffer(input){return this.#marketAction(()=>this.#market.createOffer(input));}
  cancelSellingOffer(id){return this.#marketAction(()=>this.#market.cancelOffer(id));}
  fillMarketOrder(id,input){if(input.transferKind==='PICKUP')throw Error('Use acceptCargoPickup for capacity-checked pickup');if(!input.offerId&&input.transferKind!=='DELIVERY')throw Error('Ship cargo requires dockside delivery acceptance');return input.transferKind==='DELIVERY'?this.#deliveryAction(()=>this.#market.fill(id,input),input.context??{}):this.#marketAction(()=>this.#market.fill(id,input));}
  setShipDocked(shipId,portId){return this.#marketAction(()=>{if(!this.accounts.inspect(accountId('MERCHANT',shipId)).active)throw Error('Inactive ship');if(portId&&!this.#ports.has(portId))throw Error('Unknown dock');return this.#market.setDocked(shipId,portId);});}
  getPendingTransfers(shipId,kind=null){return Object.freeze(this.#market.pending(shipId,kind));}
  getShipDockVisit(shipId){return this.#market.dockVisits.get(shipId)??0;}
  acceptCargoDelivery(shipId,portId,c,q,context={}){return this.#deliveryAction(()=>this.#market.acceptDelivery(shipId,portId,c,q,context),context);}
  #deliveryAction(commit,context,allowReservations=false){return this.#marketAction(()=>{
    const before=this.#market.checkpoint(),history=[...this.#tradeHistory],serial=this.#allocationSerial,revision=this.#marketRevision;this.#deferredMarketEvents=[];let value,events;
    try{value=this.accounts.settlementBatch(commit,{allowReservations});events=this.#deferredMarketEvents;}
    catch(error){this.#market.restore(before);this.#tradeHistory=history;this.#allocationSerial=serial;this.#marketRevision=revision;this.#syncAll();context.effects?.rollback?.();throw error;}
    finally{this.#deferredMarketEvents=null;}for(const event of events)this.#emitMarket(Object.freeze({...event,stocks:Object.freeze(event.stocks.map(stock=>this.getPortStockpile(event.portId,stock.commodity_id)))}));return value;
  });}
  acceptCargoPickup(shipId,portId,c,q,capacity,context={}){return this.#deliveryAction(()=>this.#market.acceptPickup(shipId,portId,c,q,capacity,context),context,true);}
  handleCargoTransfers(shipId,kind,budget,context={}){return this.#marketAction(()=>this.#market.handle(shipId,kind,budget,context));}
  #recordMarketTrade(v,context){const trade=Object.freeze({acceptanceId:v.acceptanceId,id:v.transferId??`fill-${++this.#allocationSerial}`,paymentId:v.paymentId,tick:this.#tick,buyerAccountId:context.buyerAccountId,commodityId:context.commodityId,quantity:v.units_transacted,sellerAccountId:v.sellerAccountId,sourceLocation:v.sourceLocation,sourceReservationId:v.sourceReservationId,goods:v.goods,unitPrice:v.unit_price,unitPriceUnits:v.unit_price_units??toMicrogold(v.unit_price),totalPayment:v.total_gold_cost,totalPaymentUnits:v.total_microgold,recipients:v.recipients,sales:v.sales,action:v.total_microgold===0&&v.sales.every(s=>s.allocation)?'allocation':context.action,orderId:v.orderId,offerId:v.offerId,transferId:v.transferId});this.#tradeHistory.push(trade);if(this.#tradeHistory.length>256)this.#tradeHistory.shift();this.#publishMarket(context.portId,[context.commodityId],{transaction:Object.freeze({...context,...trade,shipId:context.shipId??null,gold:v.total_gold_cost,goldUnits:v.total_microgold,priceBefore:v.priceBefore,priceAfter:this.#stock(context.portId,context.commodityId).current_price,provenance:v.provenance})});}
  getGoodsSnapshot(){return this.#goods.snapshot();}
  getGoods(filter={}){return this.#goods.inspect(filter);}
  #store(owner,shipId=null){const a=this.accounts.inspect(owner);if(shipId&&a.ownerType==='MERCHANT'&&a.ownerId!==shipId)throw Error('Wrong ship owner');return a.ownerType==='MERCHANT'?goodsLocation('SHIP',a.ownerId):goodsLocation(a.ownerType==='INDUSTRY'?'INDUSTRY':a.ownerType==='PORT'?'TOWN':'ACCOUNT',a.ownerId);}
  getShipCargo(shipId){const owner=accountId('MERCHANT',shipId),rows=this.#goods.inspect({ownerAccountId:owner,location:goodsLocation('SHIP',shipId),reservationId:null}),items=new Map();for(const row of rows){const old=items.get(row.commodityId)??{commodity_id:row.commodityId,quantity:0,acquisition_cost:0,origin_port_id:row.originPortId,owner_account_id:owner,location:row.location,provenance:[]};old.is_contraband ||= !!row.contraband;old.quantity+=row.quantity;old.acquisition_cost+=row.acquisitionCost;old.provenance.push(Object.freeze({origin_port_id:row.originPortId,quantity:row.quantity,acquisition_cost:row.acquisitionCost}));if(old.origin_port_id!==row.originPortId)old.origin_port_id=null;items.set(row.commodityId,old);}for(const item of items.values()){item.purchase_price_per_unit=item.acquisition_cost/item.quantity;Object.freeze(item.provenance);Object.freeze(item);}return items;}
  getPhysicalShipCargo(shipId){return this.#goods.inspect({location:goodsLocation('SHIP',shipId)});}
  getShipInventory(shipId){const owner=accountId('MERCHANT',shipId),physical=this.getPhysicalShipCargo(shipId),pending=this.getPendingTransfers(shipId),pickups=pending.filter(t=>t.kind==='PICKUP'),deliveries=pending.filter(t=>t.kind==='DELIVERY');return Object.freeze({
    unsold:Object.freeze(physical.filter(r=>r.ownerAccountId===owner&&r.reservationId===null)),
    deliveries:Object.freeze(deliveries.map(t=>Object.freeze({...t,goods:this.#goods.inspect({reservationId:t.reservationId})}))),
    pickups:Object.freeze(pickups.map(t=>Object.freeze({...t,goods:this.#goods.inspect({reservationId:t.reservationId})}))),
    completed:Object.freeze(this.#market.closed.filter(t=>t.shipId===shipId)),physical,
    physicalQuantity:physical.reduce((n,r)=>n+r.quantity,0),committedPickupQuantity:pickups.reduce((n,t)=>n+t.remainingQuantity,0),occupiedQuantity:this.getShipOccupiedQuantity(shipId)
  });}
  getGoodsLossHistory(shipId=null){return Object.freeze(this.#goodsLosses.filter(r=>!shipId||r.shipId===shipId));}
  dumpShipCargo(shipId,commodityId,q,context={}){this.#assertWritable();number(q,'Dump quantity',true);const owner=accountId('MERCHANT',shipId),filter={ownerAccountId:owner,location:goodsLocation('SHIP',shipId),commodityId,reservationId:null};if(q>this.#goods.amount(filter))throw Error('Insufficient unsold merchant-owned cargo');const before=this.#goods.checkpoint(),serial=this.#lossSerial,history=[...this.#goodsLosses];
    try{const rows=this.#goods.remove(filter,q,'dumping'),value=Object.freeze({id:`loss-${++this.#lossSerial}`,shipId,ownerAccountId:owner,commodityId,location:filter.location,quantity:rows.reduce((n,r)=>n+r.quantity,0),acquisitionCost:rows.reduce((n,r)=>n+r.acquisitionCost,0),tick:this.#tick,reason:'dumping',goods:rows});this.#goodsLosses.push(value);if(this.#goodsLosses.length>256)this.#goodsLosses.shift();context.effects?.apply?.(value);return value;}
    catch(error){this.#goods.restore(before);this.#lossSerial=serial;this.#goodsLosses=history;context.effects?.rollback?.();throw error;}
  }
  getShipOccupiedQuantity(shipId){return this.#goods.amount({location:goodsLocation('SHIP',shipId)})+this.#market.pending(shipId,'PICKUP').reduce((n,t)=>n+t.remainingQuantity,0);}
  refreshFundedDemand(){return this.#marketAction(()=>this.#refreshDemand());}
  #industrialCoverage(i){
    return i.definition.procurement.input_priority.map(c=>{
      const id=`buffer:${i.id}:${c}`,order=this.#market.orders.get(id);
      if(order&&(order.buyerAccountId!==i.id||order.portId!==i.portId||order.commodityId!==c))throw Error('Conflicting industrial order identity');
      const filter={ownerAccountId:i.id,location:this.#store(i.id),commodityId:c},otherOrders=[...this.#market.orders.local(i.portId,c)].filter(o=>o.buyerAccountId===i.id&&o.id!==id).reduce((n,o)=>n+o.remainingQuantity,0);
      return {commodityId:c,orderId:id,...inputCoverage({target:i.definition.storage.inputBuffers[c],capacity:i.definition.storage.inputCapacities[c],usable:this.#goods.amount({...filter,reservationId:null}),physical:this.#goods.amount(filter),inbound:this.#market.incoming(i.id,c),otherOrders,managedOrders:order?.remainingQuantity??0}),priceUnits:order?.priceUnits??null,committedUnits:order?this.accounts.inspectReservation(order.commitmentId)?.amountUnits??0:0};
    });
  }
  getIndustryProcurement(owner=null){
    const factories=owner?this.#industryAccounts.filter(i=>i.id===owner):this.#industryAccounts;
    if(owner&&!factories.length)throw Error('Unknown manufacturing industry');
    return copy(factories.map(i=>{const inputs=this.#industrialCoverage(i),review=this.#industryReviews.get(i.id);return {accountId:i.id,instanceId:i.owner,portId:i.portId,typeId:i.industryId,state:procurementState(inputs),lastReviewTime:review?.lastReviewTime??null,nextReviewTime:review?.nextReviewTime??0,reviewIntervalSeconds:i.definition.procurement.review_interval_seconds,inputs};}));
  }
  #productionIndustry(owner){const i=this.#industryAccounts.find(i=>i.id===owner);if(!i)throw Error('Unknown manufacturing industry');return i;}
  #outputUsage(i,c){return this.#goods.inspect({ownerAccountId:i.id,commodityId:c}).filter(r=>[goodsLocation('INDUSTRY_OUTPUT',i.owner),goodsLocation('MARKET',i.portId)].includes(r.location)).reduce((n,r)=>n+r.quantity,0);}
  #checkIndustryOutputAllocation(owner,c,destination,q,source=null){const i=this.#industryAccounts.find(i=>i.id===owner);if(!i||!i.definition.recipe.outputs.some(r=>r.commodityId===c))return;const stores=[goodsLocation('INDUSTRY_OUTPUT',i.owner),goodsLocation('MARKET',i.portId)];if(!stores.includes(destination)||stores.includes(source))return;const reserved=this.#productionStates.get(owner)?.batch?.outputs.find(r=>r.commodityId===c)?.quantity??0;if(this.#outputUsage(i,c)+q+reserved>i.definition.storage.outputCapacities[c]+productionTolerance(i.definition.storage.outputCapacities[c]))throw Error('Production output capacity is reserved');}
  #productionPlan(i){return planProductionBatch(i.definition,Object.fromEntries(i.definition.recipe.inputs.map(r=>[r.commodityId,this.#goods.amount({ownerAccountId:i.id,location:this.#store(i.id),commodityId:r.commodityId,reservationId:null})])),Object.fromEntries(i.definition.recipe.outputs.map(r=>[r.commodityId,this.#outputUsage(i,r.commodityId)])));}
  getIndustryProduction(owner=null){
    const factories=owner?[this.#productionIndustry(owner)]:this.#industryAccounts;
    return copy(factories.map(i=>{const current=this.#productionStates.get(i.id),batch=current?.batch,state=batch?'PRODUCING':this.#productionPlan(i).state;return {accountId:i.id,instanceId:i.owner,portId:i.portId,typeId:i.industryId,state,elapsedSeconds:batch?.elapsedSeconds??0,durationSeconds:batch?.durationSeconds??i.definition.recipe.durationSeconds,batch:batch??null,completedBatches:current?.completedSerial??0,outputs:i.definition.recipe.outputs.map(r=>({commodityId:r.commodityId,capacity:i.definition.storage.outputCapacities[r.commodityId],stored:this.#outputUsage(i,r.commodityId),reserved:batch?.outputs.find(o=>o.commodityId===r.commodityId)?.quantity??0})),configurationPolicy:'Definitions change on simulation restart; accepted batch terms and input costs remain fixed'};}));
  }
  // Supplier coverage is factual inspection, never a grant, reservation or live remote ledger.
  getIndustrySupplyDiagnostics(owner=null){
    const factories=owner?[this.#productionIndustry(owner)]:this.#industryAccounts;
    return copy(factories.map(i=>({accountId:i.id,instanceId:i.owner,portId:i.portId,typeId:i.industryId,inputs:i.definition.recipe.inputs.map(input=>{
      const definitions=this.#industryRegistry.values().filter(d=>d.outputs.some(o=>o.commodity_id===input.commodityId));
      const primaryTypes=definitions.filter(d=>!d.inputs.length).map(d=>d.id),producerPorts=[];
      for(const p of this.#ports.values()){const s=p.stockpiles.get(input.commodityId);if(s&&s.base_production_rate*s.prod_modifier>0)producerPorts.push(p.id);}
      const manufacturers=this.#industryAccounts.filter(f=>f.definition.runtimeEnabled&&f.definition.recipe.outputs.some(o=>o.commodityId===input.commodityId));
      for(const f of manufacturers)if(!producerPorts.includes(f.portId))producerPorts.push(f.portId);producerPorts.sort();
      const status=!definitions.length?'NO_SUPPLIER_DEFINITION':!producerPorts.length?'NO_ACTIVE_PRODUCTION':producerPorts.includes(i.portId)?'LOCAL_PRODUCTION':'IMPORT_REQUIRED';
      return {commodityId:input.commodityId,primaryTypes,supplierTypes:definitions.map(d=>d.id),producerPorts,producerAccounts:manufacturers.map(f=>f.id).sort(),status};
    })})));
  }
  getIndustryProductionHistory(owner=null){return copy(this.#productionHistory.filter(r=>!owner||r.accountId===owner));}
  #productionTransaction(commit,context={}){
    const before=this.#market.checkpoint(),states=copy([...this.#productionStates]),history=[...this.#productionHistory],revision=this.#marketRevision;this.#deferredMarketEvents=[];let events,value;
    try{value=this.accounts.settlementBatch(commit);events=this.#deferredMarketEvents;}
    catch(error){this.#market.restore(before);this.#productionStates=new Map(states);this.#productionHistory=history;this.#marketRevision=revision;this.#syncAll();context.effects?.rollback?.();throw error;}
    finally{this.#deferredMarketEvents=null;}
    for(const event of events)this.#emitMarket(Object.freeze({...event,stocks:Object.freeze(event.stocks.map(s=>this.getPortStockpile(event.portId,s.commodity_id)))}));return value;
  }
  #startProduction(i,context={}){
    const current=this.#productionStates.get(i.id)??{serial:0,completedSerial:0,batch:null};if(current.batch)return copy(current.batch);
    const plan=this.#productionPlan(i);if(plan.state!=='PRODUCING')return null;
    if(!Number.isSafeInteger(current.serial+1))throw Error('Production identity overflow');
    const id=`production:${encodeURIComponent(i.id)}:${current.serial+1}`,reservationId='PRODUCTION:'+id,inputs=[];
    for(const input of plan.inputs){const filter={ownerAccountId:i.id,location:this.#store(i.id),commodityId:input.commodityId,reservationId:null},rows=this.#goods.select(filter,input.quantity);inputs.push(...rows);this.#goods.move(filter,input.quantity,{reservationId});}
    const acquisitionCostUnits=inputs.reduce((n,r)=>addMicrogold(n,costUnits(r)),0),acquisitionCost=fromMicrogold(acquisitionCostUnits),batch={id,reservationId,serial:current.serial+1,accountId:i.id,instanceId:i.owner,portId:i.portId,typeId:i.industryId,fraction:plan.fraction,durationSeconds:plan.durationSeconds,elapsedSeconds:0,inputs:copy(inputs),inputRequirements:plan.inputs,outputs:plan.outputs,outputCapacities:copy(i.definition.storage.outputCapacities),outputCostWeights:copy(i.definition.outputCostWeights),acquisitionCostUnits,acquisitionCost,definition:copy(i.definition)};
    this.#productionStates.set(i.id,{...current,serial:batch.serial,batch});context.effects?.apply?.({stage:'start',batch:copy(batch)});return copy(batch);
  }
  startIndustryBatch(owner,context={}){return this.#marketAction(()=>this.#productionTransaction(()=>this.#startProduction(this.#productionIndustry(owner),context),context));}
  #finishProduction(i,id,context={}){
    const current=this.#productionStates.get(i.id),prefix=`production:${encodeURIComponent(i.id)}:`,suffix=id?.startsWith(prefix)?id.slice(prefix.length):'',serial=/^[1-9]\d*$/.test(suffix)?Number(suffix):NaN;
    if(!Number.isSafeInteger(serial))throw Error('Invalid production batch identity');
    if(serial<=(current?.completedSerial??0))return {id,accountId:i.id,completed:true,duplicate:true};
    const batch=current?.batch;if(!batch||batch.id!==id)throw Error('Unknown active production batch');if(batch.elapsedSeconds+1e-9<batch.durationSeconds)throw Error('Production batch is not ready');
    for(const output of batch.outputs)if(this.#outputUsage(i,output.commodityId)+output.quantity>batch.outputCapacities[output.commodityId]+productionTolerance(batch.outputCapacities[output.commodityId]))throw Error('Reserved production output space is unavailable');
    for(const input of batch.inputRequirements)this.#goods.remove({ownerAccountId:i.id,location:this.#store(i.id),commodityId:input.commodityId,reservationId:batch.reservationId},input.quantity,'manufacturing input');
    const outputs=[];
    for(const output of allocateOutputCosts(batch.inputs,batch.outputs,batch.outputCostWeights)){
      const {productionInputs,...result}=output;
      this.#goods.create({ownerAccountId:i.id,manufacturingIndustryAccountId:i.id,location:goodsLocation('INDUSTRY_OUTPUT',i.owner),commodityId:output.commodityId,quantity:output.quantity,originPortId:i.portId,reservationId:null,...costFields(output.acquisitionCostUnits),productionInputs},'manufacturing output');
      // Output storage uses the local market's physical warehouse. Listing keeps
      // the industry owner and counts against its output capacity until sold.
      this.#goods.move({ownerAccountId:i.id,location:goodsLocation('INDUSTRY_OUTPUT',i.owner),commodityId:output.commodityId,reservationId:null},output.quantity,{location:goodsLocation('MARKET',i.portId)});this.#sync(i.portId,output.commodityId);outputs.push(result);
    }
    current.completedSerial=batch.serial;current.batch=null;
    const receipt={id:batch.id,accountId:i.id,instanceId:i.owner,portId:i.portId,typeId:i.industryId,completed:true,fraction:batch.fraction,durationSeconds:batch.durationSeconds,inputs:batch.inputs,outputs,acquisitionCostUnits:batch.acquisitionCostUnits,acquisitionCost:batch.acquisitionCost};this.#productionHistory.push(receipt);if(this.#productionHistory.length>256)this.#productionHistory.shift();
    context.effects?.apply?.({stage:'complete',batch:copy(batch),receipt:copy(receipt)});this.#publishMarket(i.portId,batch.outputs.map(o=>o.commodityId),{reason:'manufacturing_complete',batchId:id});return copy(receipt);
  }
  completeIndustryBatch(owner,id,context={}){return this.#marketAction(()=>this.#productionTransaction(()=>this.#finishProduction(this.#productionIndustry(owner),id,context),context));}
  #advanceIndustrialProduction(dt,context={}){
    const active=this.#industryAccounts.filter(i=>(i.definition.runtimeEnabled||this.#productionStates.get(i.id)?.batch)&&(this.#productionStates.get(i.id)?.batch||this.#productionPlan(i).state==='PRODUCING')).sort((a,b)=>a.id.localeCompare(b.id));if(!active.length)return;
    if(active.every(i=>{const b=this.#productionStates.get(i.id)?.batch;return b&&b.elapsedSeconds+dt+1e-9<b.durationSeconds;})){for(const i of active){const b=this.#productionStates.get(i.id).batch;b.elapsedSeconds+=dt;}return;}
    this.#productionTransaction(()=>{
      for(const i of active){let left=dt;while(left>1e-10){let batch=this.#productionStates.get(i.id)?.batch;if(!batch){if(!this.#startProduction(i,context))break;batch=this.#productionStates.get(i.id).batch;}
        const elapsed=Math.min(left,Math.max(0,batch.durationSeconds-batch.elapsedSeconds));batch.elapsedSeconds=Math.min(batch.durationSeconds,sum(batch.elapsedSeconds,elapsed));left=Math.max(0,left-elapsed);
        if(batch.elapsedSeconds+1e-9>=batch.durationSeconds)this.#finishProduction(i,batch.id,context);else break;
      }}
    },context);
  }
  advanceIndustryProduction(dt,context={}){return this.#marketAction(()=>{number(dt,'Production elapsed time',true);this.#productionClockManaged=true;return this.#advanceIndustrialProduction(dt,context);});}
  advanceIndustryProcurement(dt){return this.#marketAction(()=>{number(dt,'Procurement elapsed time',true);this.#procurementClockManaged=true;this.#procurementTime=sum(this.#procurementTime,dt);this.#reviewIndustrialProcurement();this.#market.reviewManufacturedPrices();});}
  reviewIndustryProcurement(owner=null,context={}){return this.#marketAction(()=>{if(owner&&!this.#industryAccounts.some(i=>i.id===owner))throw Error('Unknown manufacturing industry');this.#reviewIndustrialProcurement(owner,true,context);return this.getIndustryProcurement(owner);});}
  #reviewIndustrialProcurement(owner=null,force=false,context={}){
    const due=this.#industryAccounts.filter(i=>(!owner||i.id===owner)&&this.accounts.inspect(i.id).active&&(force||this.#procurementTime+1e-8>=(this.#industryReviews.get(i.id)?.nextReviewTime??0))).sort((a,b)=>a.id.localeCompare(b.id));
    if(!due.length)return;
    const before=this.#market.checkpoint(),history=[...this.#tradeHistory],serial=this.#allocationSerial,revision=this.#marketRevision,reviews=new Map(this.#industryReviews);this.#deferredMarketEvents=[];let events;
    try{this.accounts.settlementBatch(()=>{
      for(const i of due){
        // Allocate only this owner's available local goods. Explicit offers and
        // accepted transfers remain protected; automatic self-listings retract.
        for(const row of this.#industrialCoverage(i)){
          const filter={ownerAccountId:i.id,location:goodsLocation('MARKET',i.portId),commodityId:row.commodityId,reservationId:null},available=this.#saleRows(filter).reduce((n,r)=>n+r.quantity,0),q=Math.min(row.desiredOrderQuantity,available);
          if(q>1e-9){this.#market.withdrawAutomatic(i.portId,i.id,row.commodityId);this.#allocateOwnedSupplies(i.id,i.portId,row.commodityId,q);this.#market.refreshSupply(i.portId,row.commodityId);}
        }
        // Release this manager's old backing first, so a lower-priority input
        // cannot retain capital needed by a higher-priority shortage.
        for(const row of this.#industrialCoverage(i)){const old=this.#market.orders.get(row.orderId);if(old)this.accounts.releaseReservation(old.commitmentId);}
        for(const row of this.#industrialCoverage(i)){
          const c=row.commodityId,old=this.#market.orders.get(row.orderId),stock=this.#stock(i.portId,c),p=i.definition.procurement,priceUnits=Math.max(1,toMicrogold(Math.min(stock.current_price*p.bid_multiplier,stock.base_price*p.maximum_bid_multiplier))),carry=(old?.invoiceNumerator??0n)%1000000000n?1:0;
          const funded=fundedInputQuantity(row.desiredOrderQuantity,priceUnits,this.accounts.inspect(i.id).spendableUnits,carry),q=funded.quantity;
          if(q<=1e-9){if(old)this.#market.cancelOrder(old.id);continue;}
          if(old){if(old.remainingQuantity!==q||old.priceUnits!==priceUnits)this.#market.amendOrder(old.id,{quantity:q,priceUnits});else this.accounts.reserve(old.commitmentId,i.id,funded.committedUnits);}
          else this.#market.createOrder({id:row.orderId,portId:i.portId,buyerAccountId:i.id,commodityId:c,quantity:q,priceUnits});
        }
        const interval=i.definition.procurement.review_interval_seconds,previous=this.#industryReviews.get(i.id)?.nextReviewTime??0,nextReviewTime=force?this.#procurementTime+interval:previous+(Math.floor(Math.max(0,this.#procurementTime-previous)/interval)+1)*interval;
        number(nextReviewTime,'Procurement schedule overflow');this.#industryReviews.set(i.id,{lastReviewTime:this.#procurementTime,nextReviewTime});
      }
      // The standing market's bid/ask and creation-order priority, including
      // other local buyers, determines winners. No scalar unlimited buyer.
      const pairs=new Map();for(const i of due)for(const c of i.definition.procurement.input_priority)pairs.set(JSON.stringify([i.portId,c]),[i.portId,c]);
      for(const [p,c] of pairs.values())for(const order of this.#market.bestOrders(p,c)){
        if(this.accounts.inspect(order.buyerAccountId).ownerType==='MERCHANT')continue;
        for(const offer of this.#market.bestOffers(p,c)){if(!this.#market.orders.has(order.id)||offer.priceUnits>order.priceUnits)break;this.#market.fill(order.id,{offerId:offer.id,quantity:order.remainingQuantity});}
      }
      context.effects?.apply?.();
    },{allowReservations:true});events=this.#deferredMarketEvents;}
    catch(error){this.#market.restore(before);this.#tradeHistory=history;this.#allocationSerial=serial;this.#marketRevision=revision;this.#industryReviews=reviews;this.#syncAll();context.effects?.rollback?.();throw error;}
    finally{this.#deferredMarketEvents=null;}
    for(const event of events)this.#emitMarket(Object.freeze({...event,stocks:Object.freeze(event.stocks.map(s=>this.getPortStockpile(event.portId,s.commodity_id)))}));
  }
  #refreshDemand(){
    const demands=[];
    for(const p of this.#ports.values())for(const stock of p.stockpiles.values()){
      if(stock.base_consumption_rate*stock.cons_modifier<=0)continue;
      const owner=accountId('PORT',p.id),c=stock.commodity_id;if(stock.consumption_target>stock.consumption_stock+this.#market.incoming(owner,c))this.#market.withdrawAutomatic(p.id,owner,c);const filter={ownerAccountId:owner,location:goodsLocation('MARKET',p.id),commodityId:c,reservationId:null},need=Math.max(0,stock.consumption_target-stock.consumption_stock-this.#market.incoming(owner,c)),allocated=Math.min(need,this.#availableAmount(filter));
      if(allocated>1e-9){this.#moveAvailable(filter,allocated,{location:goodsLocation('TOWN',p.id)});this.#sync(p.id,c);}this.#market.refreshSupply(p.id,c);
      demands.push({portId:p.id,buyerAccountId:owner,commodityId:c,target:stock.consumption_target});
    }
    if(!this.#procurementClockManaged)this.#reviewIndustrialProcurement();
    for(const d of demands){const {portId:p,buyerAccountId:owner,commodityId:c}=d,id=`buffer:${owner}:${c}`,old=this.#market.orders.get(id),others=[...this.#market.orders.values()].filter(o=>o.id!==id&&o.buyerAccountId===owner&&o.commodityId===c&&o.destination===this.#store(owner)).reduce((n,o)=>n+o.remainingQuantity,0),needed=Math.max(0,d.target-this.#goods.amount({ownerAccountId:owner,location:this.#store(owner),commodityId:c})-this.#market.incoming(owner,c)-others),priceUnits=toMicrogold(this.#stock(p,c).current_price),funds=this.accounts.inspect(owner).spendableUnits+(old?this.accounts.inspectReservation(old.commitmentId)?.amountUnits??0:0),q=Math.floor(Math.min(needed,Math.max(0,funds-1)/priceUnits)*1e9)/1e9;
      if(q<1e-9){if(old)this.#market.cancelOrder(id);continue;}
      if(old){if(Math.abs(old.remainingQuantity-q)>1e-9||old.priceUnits!==priceUnits)this.#market.amendOrder(id,{quantity:q,priceUnits});}
      else this.#market.createOrder({id,portId:p,buyerAccountId:owner,commodityId:c,quantity:q,priceUnits});
    }
    for(const p of this.#ports.values())for(const c of p.stockpiles.keys()){
      for(const o of this.#market.bestOrders(p.id,c)){if(!this.#market.orders.has(o.id)||this.accounts.inspect(o.buyerAccountId).ownerType==='MERCHANT')continue;
        for(const offer of this.#market.bestOffers(p.id,c)){if(!this.#market.orders.has(o.id)||offer.priceUnits>o.priceUnits)break;this.#market.fill(o.id,{offerId:offer.id,quantity:o.remainingQuantity});}
      }
    }
  }
  receiveExternalCargo(shipId,item){this.#assertWritable();const owner=accountId('MERCHANT',shipId);if(!this.accounts.inspect(owner).active)throw Error('Inactive cargo owner');if(!this.commodityRegistry.has(item.commodity_id))throw Error('Unknown commodity');number(item.quantity,'Cargo quantity',true);number(item.purchase_price_per_unit??0,'Cargo cost');this.#goods.create({ownerAccountId:owner,location:goodsLocation('SHIP',shipId),commodityId:item.commodity_id,quantity:item.quantity,originPortId:item.origin_port_id??null,reservationId:null,contraband:!!item.is_contraband,acquisitionCost:item.quantity*(item.purchase_price_per_unit??0)},'external capture');}
  removeShipCargo(shipId,commodityId,q,reason){this.#assertWritable();if(reason==='spoilage')throw Error('Spoilage is not simulated');if(!['dumping','sinking','confiscation'].includes(reason))throw Error('Unknown cargo loss mechanic');if(reason==='dumping')return this.dumpShipCargo(shipId,commodityId,q);const filter={ownerAccountId:accountId('MERCHANT',shipId),location:goodsLocation('SHIP',shipId),commodityId,reservationId:null};if(q>this.#goods.amount(filter))throw Error('Insufficient unsold merchant-owned cargo');return this.#goods.remove(filter,q,reason);}
  retireGoodsOwner(owner,port){this.#assertWritable();this.#assertGoodsRetirement(owner);this.#disposeOwnerGoods(owner,port);if(port)this.#publishMarket(port);}
  retireActorAccount(owner,port,recipient=accountId('PORT',port),effects={}){this.#assertWritable();if([...this.#industryProjects.values()].some(p=>p.accountId===owner&&p.state!=='REMOVED')&&this.#factoryRemoving!==owner)throw Error('Use constructed industry removal');const actor=this.accounts.inspect(owner);if([...this.#industryInvestments.values()].some(p=>p.ownerAccountId===owner&&!['COMPLETE','REMOVED'].includes(this.#industryProjects.get(p.id)?.state)))throw Error('Investment obligations must finish before port removal');if(actor.ownerType==='MERCHANT'&&this.#market.pending(actor.ownerId).length)throw Error('Accepted handling must finish before removal');if([...this.#market.transfers.values()].some(t=>t.buyerAccountId===owner))throw Error('Accepted handling must finish before buyer removal');if([...this.#market.orders.values()].some(o=>o.buyerAccountId===owner))throw Error('Cancel open orders before buyer removal');const affected=new Set(this.#goods.inspect({ownerAccountId:owner}).filter(r=>r.location.startsWith('MARKET:')).map(r=>decodeURIComponent(r.location.slice(7))));if(port)affected.add(port);const before=this.#goods.checkpoint();this.#publishing=true;try{this.accounts.retire(owner,recipient,{apply:()=>{this.#disposeOwnerGoods(owner,port);effects.apply?.();},rollback:()=>{this.#goods.restore(before);this.#syncAll();effects.rollback?.();}});}finally{this.#publishing=false;}this.#productionStates.delete(owner);this.#industryReviews.delete(owner);this.#procurementBuyers.delete(owner);if(actor.ownerType==='MERCHANT')this.#market.retireShip(actor.ownerId);for(const id of affected)this.#publishMarket(id);}
  #assertGoodsRetirement(owner){const actor=this.accounts.inspect(owner);if(actor.ownerType==='MERCHANT'&&this.#market.pending(actor.ownerId).length||[...this.#market.transfers.values()].some(t=>t.buyerAccountId===owner))throw Error('Accepted handling must finish before goods retirement');if(this.#goods.inspect({ownerAccountId:owner}).some(r=>r.reservationId))throw Error('Release goods reservations before retirement');}
  #disposeOwnerGoods(owner,port){this.#assertGoodsRetirement(owner);const records=this.#goods.inspect({ownerAccountId:owner});if(!records.length)return;this.accounts.inspect(owner);if(!port){for(const row of records)this.#goods.remove({id:row.id},row.quantity,'actor removal');return;}for(const row of records)this.#stock(port,row.commodityId);for(const row of records)this.#goods.move({id:row.id},row.quantity,{ownerAccountId:accountId('PORT',port),manufacturingIndustryAccountId:null,location:goodsLocation('MARKET',port),reservationId:null});this.#syncAll();}
  allocateSupplies(port,id,quantity,from_pool) {
    this.#assertWritable();
    if(!Number.isFinite(quantity)||quantity<=0||!['TRADE','CONSUMPTION'].includes(from_pool))return fail('INVALID_ALLOCATION');
    if(!this.#ports.get(port)?.stockpiles.has(id))return fail('UNKNOWN_STOCKPILE');
    const owner=accountId('PORT',port),from=goodsLocation(from_pool==='TRADE'?'MARKET':'TOWN',port),to=goodsLocation(from_pool==='TRADE'?'TOWN':'MARKET',port),filter={ownerAccountId:owner,location:from,commodityId:id,reservationId:null};
    if(quantity>this.#availableAmount(filter))return fail('INSUFFICIENT_SUPPLIES');try{this.#moveAvailable(filter,quantity,{location:to});}catch{return fail('NUMERIC_OVERFLOW');}this.#sync(port,id);this.#publishMarket(port,[id]);return ok(quantity);
  }
  allocateOwnedSupplies(owner,port,c,q){return this.#marketAction(()=>this.#allocateOwnedSupplies(owner,port,c,q));}
  #allocateOwnedSupplies(owner,port,c,q){number(q,'Allocation quantity',true);const a=this.accounts.inspect(owner),parent=a.ownerType==='PORT'?a.ownerId:this.#industryAccounts.find(i=>i.id===owner)?.portId??this.#procurementBuyers.get(owner)?.portId;if(parent!==port)throw Error('Invalid allocation catchment');const rows=this.#goods.select({ownerAccountId:owner,location:goodsLocation('MARKET',port),commodityId:c,reservationId:null},q),before=this.#goods.checkpoint();try{this.#goods.move({ownerAccountId:owner,location:goodsLocation('MARKET',port),commodityId:c,reservationId:null},q,{location:this.#store(owner)});this.#sync(port,c);}catch(error){this.#goods.restore(before);this.#sync(port,c);throw error;}const value=Object.freeze({buyerAccountId:owner,sellerAccountId:owner,commodityId:c,sourceLocation:goodsLocation('MARKET',port),sourceReservationId:null,goods:rows,units_transacted:q,total_microgold:0,total_gold_cost:0,unit_price:0,priceBefore:this.#stock(port,c).current_price,paymentId:null,transferId:null,orderId:null,offerId:null,recipients:Object.freeze([]),sales:Object.freeze(rows.map(r=>Object.freeze({sellerAccountId:owner,quantity:r.quantity,paymentUnits:0,payment:0,allocation:true,recipients:Object.freeze([])}))),provenance:rows});this.#recordMarketTrade(value,{buyerAccountId:owner,portId:port,commodityId:c,action:'allocation'});return ok(value);}
  getPortTaxRate(port_id) { const p=this.#ports.get(port_id);if(!p)throw new RangeError('Unknown port');return 0; }
  getFactionTreasury(faction) { const t=this.#treasuries.get(faction); if(!t) throw new RangeError('Unknown faction'); return Object.freeze(copy(t)); }
  depositCargo(port_id,commodity_id,quantity,context={}) {
    this.#assertWritable();if(!Number.isFinite(quantity)||quantity<=0)return fail('INVALID_TRANSACTION');if(!this.#ports.get(port_id)?.stockpiles.has(commodity_id))return fail('UNKNOWN_STOCKPILE');
    if(!context.ownerAccountId||!context.sourceLocation)return fail('OWNERSHIP_REQUIRED');
    if(context.recipientAccountId&&context.recipientAccountId!==context.ownerAccountId)return fail('FUNDED_SETTLEMENT_REQUIRED');
    const owner=context.ownerAccountId,allowed=[goodsLocation('MARKET',port_id),goodsLocation('TOWN',port_id)];
    try{const a=this.accounts.inspect(owner);if(a.ownerType==='INDUSTRY'&&(this.#industryAccounts.find(i=>i.id===owner)?.portId??this.#procurementBuyers.get(owner)?.portId)===port_id)allowed.push(this.#store(owner));else if(a.ownerType!=='PORT'||a.ownerId!==port_id)return fail('LOCAL_ALLOCATION_REQUIRED');
      if(!allowed.includes(context.sourceLocation))return fail('MARITIME_TRANSPORT_REQUIRED');this.#checkIndustryOutputAllocation(owner,commodity_id,goodsLocation('MARKET',port_id),quantity,context.sourceLocation);this.#goods.move({ownerAccountId:owner,location:context.sourceLocation,commodityId:commodity_id,reservationId:null},quantity,{location:goodsLocation('MARKET',port_id)});
    }catch{return fail('INSUFFICIENT_OWNED_GOODS');}
    this.#sync(port_id,commodity_id);this.#publishMarket(port_id,[commodity_id]);return ok(quantity);
  }
  purchaseInfrastructure(portId,cost,{commit=()=>{},rollback=()=>{},afterDeduction=()=>{},withdrawAutomaticOffers=false}={}){
    this.#assertWritable();const port=this.#ports.get(portId);if(!port||!cost||typeof cost!=='object'||Array.isArray(cost))return fail('INVALID_CONSTRUCTION');
    // Legacy gold fields are ignored; construction consumes owned materials only.
    const materials=Object.entries(cost).filter(([id])=>id!=='gold');if(materials.some(([id,q])=>!this.commodityRegistry.has(id)||!Number.isFinite(q)||q<0))return fail('INVALID_CONSTRUCTION');
    if(materials.some(([id,q])=>!port.stockpiles.has(id)||(withdrawAutomaticOffers?this.#saleRows({ownerAccountId:accountId('PORT',portId),location:goodsLocation('MARKET',portId),commodityId:id,reservationId:null}).reduce((n,r)=>n+r.quantity,0):this.#availableAmount({ownerAccountId:accountId('PORT',portId),location:goodsLocation('MARKET',portId),commodityId:id,reservationId:null}))<q))return fail('INSUFFICIENT_MATERIALS');
    const goodsBefore=this.#goods.checkpoint(),offersBefore=new Map(this.#market.offers),before=materials.map(([id])=>[id,{...port.stockpiles.get(id)}]);this.#publishing=true;
    try{for(const [id,q] of materials){if(withdrawAutomaticOffers)this.#market.withdrawAutomatic(portId,accountId('PORT',portId),id);this.#removeAvailable({ownerAccountId:accountId('PORT',portId),location:goodsLocation('MARKET',portId),commodityId:id,reservationId:null},q,'construction');this.#sync(portId,id);afterDeduction(id);}commit();}
    catch(error){try{this.#goods.restore(goodsBefore);this.#market.offers=offersBefore;for(const [id,stock] of before)Object.assign(port.stockpiles.get(id),stock);rollback();}catch{}return fail('CONSTRUCTION_FAILED');}
    finally{this.#publishing=false;}
    if(materials.length)this.#publishMarket(portId,materials.map(([id])=>id));return ok(true);
  }
  transferStock(origin_id,destination_id,commodity_id,quantity) {
    this.#assertWritable();if(origin_id!==destination_id)return fail('MARITIME_TRANSPORT_REQUIRED');
    if(!Number.isFinite(quantity)||quantity<=0||origin_id===destination_id)return fail('INVALID_TRANSACTION');
    const a=this.#ports.get(origin_id)?.stockpiles.get(commodity_id),b=this.#ports.get(destination_id)?.stockpiles.get(commodity_id);
    if(!a||!b)return fail('UNKNOWN_STOCKPILE');const filter={ownerAccountId:accountId('PORT',origin_id),location:goodsLocation('MARKET',origin_id),commodityId:commodity_id,reservationId:null},units=Math.min(quantity,this.#availableAmount(filter));
    if(!units)return fail('OUT_OF_STOCK');if(!Number.isFinite(b.current_stock+units))return fail('NUMERIC_OVERFLOW');
    try{this.#moveAvailable(filter,units,{location:goodsLocation('MARKET',destination_id)});}catch{return fail('NUMERIC_OVERFLOW');}this.#sync(origin_id,commodity_id);this.#sync(destination_id,commodity_id);this.#publishMarket(origin_id,[commodity_id]);this.#publishMarket(destination_id,[commodity_id]);return ok(units);
  }
  // Flat/scalar trades cannot identify executable offers or funded demand.
  // Kept as explicit migration errors; all settlement uses the funded market.
  executeTransaction(){return fail('USE_FUNDED_MARKET');}
  quotePurchase(){return fail('USE_MARKET_OFFERS');}
  executePurchaseQuote(){return fail('USE_FUNDED_MARKET');}
  #manufacturingQuote(rows,commodity){
    const eligible=rows.filter(r=>r.manufacturingIndustryAccountId===r.ownerAccountId),industry=this.#industryAccounts.find(i=>eligible.some(r=>r.ownerAccountId===i.id)&&i.definition.recipe.outputs.some(o=>o.commodityId===commodity));
    if(!industry)return null;
    return {...manufacturedPrice(eligible.filter(r=>r.ownerAccountId===industry.id),this.#workerShare,industry.definition.selling,toMicrogold(this.commodityRegistry.get(commodity).basePrice)),reviewIntervalSeconds:industry.definition.selling.review_interval_seconds};
  }
  getRevenueRules(){return Object.freeze({manufacturingWorkerShare:this.#workerShare,tradeTaxRate:0,precision:'Integer microgold: 1 gold = 1000000 units; industry retains split rounding remainder',defaultIsProvisional:true});}
  getTradeHistory(){return Object.freeze([...this.#tradeHistory]);}
  #revenue(rows,buyer,commodity,price,allocateOwn,exactUnits=null,priceUnits=toMicrogold(price)){
    const sales=[],credits=new Map(),paidRows=rows.filter(r=>!allocateOwn||r.ownerAccountId!==buyer),paidUnits=paidRows.reduce((n,r)=>n+r.quantity,0);let remaining=exactUnits??toMicrogold(paidUnits*price),paidIndex=0;
    for(const row of rows){const allocation=allocateOwn&&row.ownerAccountId===buyer,amountUnits=allocation?0:++paidIndex===paidRows.length?remaining:Math.min(remaining,quantityPayment(priceUnits,row.quantity));if(!allocation){remaining-=amountUnits;if(!amountUnits&&exactUnits===null)throw RangeError('Trade is below one microgold');}
      const industry=this.#industryAccounts.find(i=>i.id===row.ownerAccountId&&row.manufacturingIndustryAccountId===i.id&&this.#industryRegistry.get(i.industryId).outputs.some(o=>o.commodity_id===commodity)),shares=[],share=(id,units,role)=>Object.freeze({accountId:id,amountUnits:units,amount:fromMicrogold(units),role});
      if(!allocation&&industry){const worker=workerIncome(amountUnits,this.#workerShare),retained=amountUnits-worker;if(industry.definition.selling.enforce_cost_floor&&retained<costUnits(row))throw Error('Manufacturing sale does not cover attributed input cost');shares.push(share(row.ownerAccountId,retained,'industry_retained'));if(worker)shares.push(share(accountId('PORT',industry.portId),worker,'manufacturing_worker_income'));}else if(!allocation)shares.push(share(row.ownerAccountId,amountUnits,'owner_revenue'));
      for(const sh of shares)credits.set(sh.accountId,addMicrogold(credits.get(sh.accountId)??0,sh.amountUnits));sales.push(Object.freeze({sellerAccountId:row.ownerAccountId,quantity:row.quantity,paymentUnits:amountUnits,payment:fromMicrogold(amountUnits),acquisitionCostUnits:costUnits(row),acquisitionCost:fromMicrogold(costUnits(row)),allocation,recipients:Object.freeze(shares)}));
    }
    const recipients=Object.freeze([...credits].sort(([a],[b])=>a.localeCompare(b)).map(([accountId,amountUnits])=>Object.freeze({accountId,amountUnits,amount:fromMicrogold(amountUnits)}))),totalUnits=recipients.reduce((n,c)=>addMicrogold(n,c.amountUnits),0);return {sales:Object.freeze(sales),recipients,totalUnits,total:fromMicrogold(totalUnits)};
  }
  requestMaterialReservation(port_id,requester_id,commodity_id,quantity) {
    this.#assertWritable();
    if(!Number.isFinite(quantity)||quantity<=0||typeof requester_id!=='string'||!requester_id) return fail('INVALID_RESERVATION');
    const p=this.#ports.get(port_id),s=p?.stockpiles.get(commodity_id); if(!s) return fail('UNKNOWN_STOCKPILE');
    const reservation={reservation_id:`reservation-${++this.#serial}`,requester_id,port_id,commodity_id,units_requested:quantity,units_fulfilled:0,is_complete:false};
    // Private held units protect available stock until Phase 2 consumes them.
    reservation.owner_account_id=accountId('PORT',port_id);reservation.location=goodsLocation('CONSTRUCTION',reservation.reservation_id);
    const filter={ownerAccountId:reservation.owner_account_id,location:goodsLocation('MARKET',port_id),commodityId:commodity_id,reservationId:null},entry={reservation,held:Math.min(quantity,this.#availableAmount(filter))};
    this.#moveAvailable(filter,entry.held,{reservationId:reservation.reservation_id});this.#sync(port_id,commodity_id); p.active_reservations.push(entry); this.#reservations.set(reservation.reservation_id,entry);
    s.current_price=calculatePrice(s);this.#publishMarket(port_id,[commodity_id]); return ok(Object.freeze(copy(reservation)));
  }
  getMaterialReservation(id) { const e=this.#reservations.get(id); if(!e) throw new RangeError('Unknown reservation'); return Object.freeze(copy(e.reservation)); }
  cancelMaterialReservation(id) {
    this.#assertWritable(); const e=this.#reservations.get(id); if(!e) return fail('UNKNOWN_RESERVATION');
    if(e.reservation.is_complete) return fail('RESERVATION_COMPLETE');
    const r=e.reservation,p=this.#ports.get(r.port_id),s=p.stockpiles.get(r.commodity_id);
    for(const row of this.#goods.inspect({reservationId:id,location:goodsLocation('MARKET',r.port_id)}))this.#goods.move({id:row.id},row.quantity,{reservationId:null});this.#sync(r.port_id,r.commodity_id); p.active_reservations=p.active_reservations.filter(v=>v!==e);
    this.#reservations.delete(id); s.current_price=calculatePrice(s);this.#publishMarket(r.port_id,[r.commodity_id]); return ok(true);
  }
  consumeConstructionMaterials(id,quantity){this.#assertWritable();const e=this.#reservations.get(id);if(!e)return fail('UNKNOWN_RESERVATION');const r=e.reservation;try{number(quantity,'Construction quantity',true);this.#goods.remove({ownerAccountId:r.owner_account_id,location:r.location,commodityId:r.commodity_id,reservationId:id},quantity,'construction');return ok(quantity);}catch{return fail('INSUFFICIENT_MATERIALS');}}
  applyStockpileModifier(port,id,prod_multiplier,cons_multiplier) {
    this.#assertWritable(); number(prod_multiplier,'prod_multiplier'); number(cons_multiplier,'cons_multiplier');
    const s=this.#stock(port,id);
    if(!Number.isFinite(s.base_production_rate*prod_multiplier)||!Number.isFinite(s.base_consumption_rate*cons_multiplier)) throw new RangeError('Modifier overflow');
    s.prod_modifier=prod_multiplier; s.cons_modifier=cons_multiplier;this.#publishMarket(port,[id]);
  }
  modifyTreasuryBalance(faction_id,amount_gold) {if(!this.#treasuries.has(faction_id))return fail('UNKNOWN_FACTION');if(!Number.isFinite(amount_gold))return fail('INVALID_AMOUNT');return amount_gold===0?ok(this.#treasuries.get(faction_id).balance_gold):fail('DIRECT_BALANCE_MUTATION_DISABLED');}
  tick() {
    this.#assertWritable(); if(this.#tick===Number.MAX_SAFE_INTEGER) throw new RangeError('Tick overflow');
    // Preflight arithmetic before committing any phase.
    const stocks=new Map(),taxes=new Map();
    for(const p of this.#ports.values()) {
      taxes.set(p.owner_faction,sum(taxes.get(p.owner_faction)??0,p.accumulated_tax_gold));
      for(const s of p.stockpiles.values()) {
        const production=number(s.base_production_rate*s.prod_modifier,'Production overflow'),consumption=number(s.base_consumption_rate*s.cons_modifier,'Consumption overflow');
        stocks.set(s,{trade:sum(s.current_stock,s.production_pool==='TRADE'?production:0),consumption:Math.max(0,sum(s.consumption_stock,s.production_pool==='CONSUMPTION'?production:0)-consumption)});
      }
    }
    for(const t of this.#treasuries.values()) { sum(t.balance_gold,taxes.get(t.faction_id)??0);  }
    if(!this.#procurementClockManaged)this.#procurementTime+=this.#options.economicTickSeconds;
    this.#running=true; const events=[]; this.#tick++;
    const emit=(event_type,p,commodity_id,metadata_value)=>events.push(Object.freeze({event_type,port_id:p?.id??'',faction_id:p?.owner_faction??commodity_id,commodity_id:p?commodity_id:null,metadata_value,timestamp_tick:this.#tick}));
    try {
      // Explicit physical sources and sinks. Only town-owned internal stores are consumed.
      for(const p of this.#ports.values())for(const s of p.stockpiles.values()){
        const q=s.base_production_rate*s.prod_modifier;this.#goods.create({ownerAccountId:accountId('PORT',p.id),location:goodsLocation(s.production_pool==='TRADE'?'MARKET':'TOWN',p.id),commodityId:s.commodity_id,quantity:q,originPortId:p.id,reservationId:null,acquisitionCost:0},'primary production');
        const filter={ownerAccountId:accountId('PORT',p.id),location:goodsLocation('TOWN',p.id),commodityId:s.commodity_id,reservationId:null};this.#removeAvailable(filter,Math.min(this.#availableAmount(filter),s.base_consumption_rate*s.cons_modifier),'town consumption');
      }
      for(const p of this.#ports.values())for(const e of p.active_reservations){const r=e.reservation,filter={ownerAccountId:r.owner_account_id,location:goodsLocation('MARKET',p.id),commodityId:r.commodity_id,reservationId:null},already=this.#goods.amount({...filter,reservationId:r.reservation_id}),q=Math.min(r.units_requested-r.units_fulfilled-already,this.#availableAmount(filter));if(q>0)this.#moveAvailable(filter,q,{reservationId:r.reservation_id});}
      this.#syncAll();this.#marketInternal=true;for(const p of this.#ports.values())for(const c of p.stockpiles.keys())this.#market.refreshSupply(p.id,c);this.#refreshDemand();
      if(!this.#productionClockManaged)this.#advanceIndustrialProduction(this.#options.economicTickSeconds);
      // FIFO construction holds transfer to a reserved physical buffer, without duplication.
      for(const p of this.#ports.values()){
        for(const e of p.active_reservations){const r=e.reservation,filter={ownerAccountId:r.owner_account_id,location:goodsLocation('MARKET',p.id),commodityId:r.commodity_id,reservationId:null},heldFilter={...filter,reservationId:r.reservation_id},already=this.#goods.amount(heldFilter),add=Math.min(r.units_requested-r.units_fulfilled-already,this.#availableAmount(filter));if(add>0)this.#moveAvailable(filter,add,{reservationId:r.reservation_id});const units=this.#goods.amount(heldFilter);this.#goods.move(heldFilter,units,{location:r.location});r.units_fulfilled=Math.min(r.units_requested,r.units_fulfilled+units);e.held=0;r.is_complete=r.units_fulfilled===r.units_requested;if(!r.is_complete)emit(EventType.ON_RESERVATION_STALLED,p,r.commodity_id,r.units_requested-r.units_fulfilled);}
        p.active_reservations=p.active_reservations.filter(e=>!e.reservation.is_complete);
      }
      this.#syncAll();
      this.#refreshDemand();
      // Prices use stocks after material deductions.
      for(const p of this.#ports.values()) for(const s of p.stockpiles.values()) s.current_price=calculatePrice(s);
      // Preserve opening legacy tax funds with a one-time sweep; no new trade tax or treasury upkeep accrues.
      for(const t of this.#treasuries.values()) { t.last_income_gross=taxes.get(t.faction_id)??0; t.last_expense_gross=0; for(const p of this.#ports.values())if(p.owner_faction===t.faction_id&&p.accumulated_tax_gold>0)this.accounts.transfer(accountId('PORT_TAX',p.id),accountId('FACTION',t.faction_id),p.accumulated_tax_gold,{reason:'opening legacy tax funds sweep'}); }

      // Phase 5: emit after all state is final. Scarcity/surplus are level signals.
      for(const p of this.#ports.values()) for(const s of p.stockpiles.values()) {
        const ratio=availableStock(s)/s.target_capacity;
        if(ratio<=this.#options.scarcityRatio) emit(EventType.ON_CRITICAL_SCARCITY,p,s.commodity_id,availableStock(s));
        else if(ratio>=this.#options.surplusRatio) emit(EventType.ON_MARKET_SURPLUS,p,s.commodity_id,availableStock(s));
      }
      for(const t of this.#treasuries.values()) if(t.balance_gold===0) emit(EventType.ON_TREASURY_DEPLETED,null,t.faction_id,0);
      // Queue reservation signals above, but publish all signals only in Phase 5.
      for(const p of this.#ports.values())this.#publishMarket(p.id,null,{reason:'economic_tick'});
      const listener_errors=[];
      for(const event of events) { try { this.#bus?.emit(event.event_type,event); } catch(error) { listener_errors.push(error); } }
      return {timestamp_tick:this.#tick,events:Object.freeze(events),listener_errors};
    } finally { this.#running=false;this.#marketInternal=false; }
  }
}
