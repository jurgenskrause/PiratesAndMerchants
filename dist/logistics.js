import {PriceLedger} from './bridge-rules.js?v=babbc3d3950e';
import {marketDepth} from './market-depth.js?v=babbc3d3950e';
import {fromMicrogold,addMicrogold,wholeUnitsAffordable} from './money.js?v=babbc3d3950e';
import {ShipRunningCosts,isSeaTime} from './ship-running-costs.js?v=babbc3d3950e';
import {accountId} from './economic-accounts.js?v=babbc3d3950e';
import {settingsForWorld} from './compiled-configuration.js?v=babbc3d3950e';
import {MarketModel} from './market-model.js?v=babbc3d3950e';
import {vesselRegistry} from './simulation-registry.js?v=babbc3d3950e';
import {FACTIONS,availableStock} from './economy.js?v=babbc3d3950e';
import {Ship,SHIP_TYPES,hullDepth,localWindAt} from './ships.js?v=babbc3d3950e';
import {sailingDrive} from './sailing-angles.js?v=babbc3d3950e';
import {worldToAxial} from './world.js?v=babbc3d3950e';
import {cellDistance,guidedPath,stepGuided,recoveryMotion} from './docking.js?v=babbc3d3950e';
import {Navigator,distance,headingTo,angleDifference,direction,windEye,optimalTackAngle} from './navigation.js?v=babbc3d3950e';
import {DockTraffic} from './dock-traffic.js?v=babbc3d3950e';
import {avoidTraffic} from './sailing-traffic.js?v=babbc3d3950e';
import {TackHelmsman,helmRudder} from './tack-helmsman.js?v=babbc3d3950e';
import {WaypointArrival} from './waypoints.js?v=babbc3d3950e';
import {contextualName} from './contextual-names.js?v=babbc3d3950e';
export const VesselClass=Object.freeze(Object.fromEntries(vesselRegistry.ids().map(v=>[v,v])));
export const AgentState=Object.freeze(Object.fromEntries(['IDLE_AT_PORT','LOADING_CARGO','IN_TRANSIT','FLEEING_THREAT','UNLOADING_CARGO','DOCKING','UNDOCKING','RECOVERING','ANCHORING','AT_ANCHOR'].map(v=>[v,v])));
const TYPES=Object.fromEntries(vesselRegistry.values().map(v=>[v.id,v.type]));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const positive=(v,name,zero=false)=>{if(!Number.isFinite(v)||(zero?v<0:v<=0))throw new RangeError(name);return v;};
const point=p=>{if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))throw new TypeError('Invalid position');return {x:p.x,y:p.y};};
const ok=value=>({ok:true,value}),fail=code=>({ok:false,error:{code}});
export function scoreRoute({buyPrice,sellPrice,volume,distance:dist,voyageCost,zoneThreat,threatTolerance,cargoValue,baseVesselValue}) {
 const risk=1+(zoneThreat/threatTolerance)*(cargoValue/baseVesselValue);
 return ((sellPrice-buyPrice)*volume-voyageCost)/(Math.max(.001,dist)*risk);
}
export class LogisticsEngine {
 #agents=new Map();#sequence=0;#incidentSequence=0;#tick=0;#time=0;#queue=[];#heat=new Map();#running=false;
 constructor({economy,world,settings=settingsForWorld(world),ports,policy,wind={x:0,y:-1},windField=null,eventBus=null,
  defaults={},scanInterval=5,detectionRadius=20,dockRadius=2*Math.sqrt(3),zoneSize=32,trickleRadius=12,trickleRate=.05,cargoTransferRate=settings.merchant.cargoHandlingRate,stuckSeconds=20,
  threatProvider=null,hazardProvider=null,coverProvider=null,territoryAt=null,knotsPerSpeedUnit=8,worldUnitsPerMile=1,navigation={},planningBudgetMs=0}) {
  for(const fn of ['getPortStockpile','getFundedMarket','acceptCargoPickup','acceptCargoDelivery','handleCargoTransfers','getShipInventory','dumpShipCargo'])if(typeof economy?.[fn]!=='function')throw new TypeError(`Layer 1 ${fn} required`);
  for(const fn of ['canTrade','canEnter','isHostile','isFriendly'])if(typeof policy?.[fn]!=='function')throw new TypeError(`Diplomatic policy ${fn} required`);
  if(!world?.n)throw new TypeError('Native world required');
  this.compiledSettings=settings;this.configurationRevision=settings.revision;this.economy=economy;this.market=new MarketModel(economy);this.world=world;this.policy=policy;this.wind=point(wind);this.windField=windField;
  this.eventBus=eventBus;if(eventBus&&typeof eventBus.emit!=='function')throw new TypeError('eventBus.emit required');
  this.settings={scanInterval:positive(scanInterval,'scanInterval'),detectionRadius:positive(detectionRadius,'detectionRadius'),dockRadius:positive(dockRadius,'dockRadius'),zoneSize:positive(zoneSize,'zoneSize'),trickleRadius:positive(trickleRadius,'trickleRadius',true),trickleRate:positive(trickleRate,'trickleRate',true),knotsPerSpeedUnit:positive(knotsPerSpeedUnit,'knotsPerSpeedUnit'),worldUnitsPerMile:positive(worldUnitsPerMile,'worldUnitsPerMile')};
  this.defaults={wallet_gold:10000,base_vessel_value:1000,operational_range:300,voyage_cost_per_unit:.1,threat_tolerance:1,...defaults};
  this.settings.cargoTransferRate=positive(cargoTransferRate,'cargoTransferRate');this.settings.stuckSeconds=positive(stuckSeconds,'stuckSeconds');
  this.threatProvider=threatProvider;this.hazardProvider=hazardProvider;this.coverProvider=coverProvider;this.territoryAt=territoryAt;
  this.ports=new Map();for(const p of ports){if(!p.id||this.ports.has(p.id)||!FACTIONS.includes(p.owner_faction))throw new TypeError('Invalid port');economy.getPortTaxRate(p.id);this.ports.set(p.id,{...p,position:point(p.position)});}
  this.navigator=new Navigator(world,navigation);
  this.openingLedger=null;this.portLedgers=new Map();this.ledgerMaxAge=Math.max(1,Math.round(settings.scaling.baseLedgerAgeTicks));this.planningBudgetMs=positive(planningBudgetMs,'planningBudgetMs',true);this.planningJobs=[];this.voyagePaths=new Map();
  this.dockTraffic=new DockTraffic(world,[...(world.ports??[]),...this.ports.values()]);this.externalVessels=[];this.traffic=[];
  this.tricklePairs=[];const list=[...this.ports.values()];
  for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++)if(list[i].island_id&&list[j].island_id&&list[i].island_id!==list[j].island_id&&distance(list[i].position,list[j].position)<=trickleRadius)this.tricklePairs.push([list[i],list[j]]);
 }
 #writable(){if(this.#running)throw new Error('Logistics tick is executing');}
 #agent(id){const a=this.#agents.get(id);if(!a)throw new RangeError('Unknown vessel');return a;}
 #port(id){const p=this.ports.get(id);if(!p)throw new RangeError('Unknown port');return p;}
 #nearestPort(pos,faction,friendly=false){let best=null,d=Infinity;for(const p of this.ports.values()){if(friendly&&!this.policy.isFriendly(faction,p.owner_faction))continue;const n=distance(pos,p.position);if(n<d){best=p;d=n;}}return best;}
 spawnVessel(faction_id,vessel_class,spawn_position,options={}) {
  this.#writable();if(!FACTIONS.includes(faction_id)||!TYPES[vessel_class])throw new TypeError('Invalid faction or vessel class');
  const settings={...this.defaults,...options},s=new Ship(TYPES[vessel_class],{...point(spawn_position),heading:options.heading??0});
  if(!Number.isFinite(s.heading)||hullDepth(this.world,s.x,s.y,s.heading,s.spec)<s.spec.draft)throw new RangeError('Unsafe vessel spawn');
  for(const key of ['wallet_gold','base_vessel_value','operational_range','voyage_cost_per_unit','threat_tolerance'])positive(settings[key],key,key==='wallet_gold'||key==='voyage_cost_per_unit');
  positive(settings.preferred_voyage_distance??0,'preferred voyage distance',true);
  const capacity=positive(settings.max_cargo_capacity??s.spec.cargoCapacity,'cargo capacity');s.canvas=0;
  const polar=[];for(let angle=0;angle<=180;angle+=5)polar.push({wind_angle_degrees:angle,speed_multiplier:sailingDrive(angle*Math.PI/180,s.spec.noGo,s.spec.bestAngle)});
  const port=options.home_port_id?this.#port(options.home_port_id):this.#nearestPort(s,faction_id),atPort=port&&(!!options.home_port_id||distance(s,port.approach_position??port.position)<=this.settings.dockRadius);
  if(!this.openingLedger){this.openingLedger=new PriceLedger({maxAge:this.ledgerMaxAge});for(const p of this.ports.values())this.openingLedger.observe(p,this.market,Math.floor(this.#time));}
  const id=`vessel-${++this.#sequence}`,vesselDefinition=vesselRegistry.get(vessel_class),a={PriceLedger:new PriceLedger({maxAge:this.ledgerMaxAge}),canTrade:vesselDefinition.canTrade,vessel_id:id,ship_name:contextualName(faction_id,'ships',(this.world.config?.seed??'world')+'|'+id,{military:vesselDefinition.militaryOnly}),captain_name:contextualName(faction_id,'captains',(this.world.config?.seed??'world')+'|'+id),owner_faction:faction_id,vessel_class,ship:s,
   physics_profile:{vessel_class,max_speed_knots:s.spec.maxSpeed*this.settings.knotsPerSpeedUnit,no_go_zone_angle:s.spec.noGo*180/Math.PI,optimal_tack_angle:optimalTackAngle(s.spec)*180/Math.PI,draft_depth:s.spec.draft,turn_rate_degrees_per_sec:s.spec.turnRate*180/Math.PI,polar_performance:polar},
   manifest:{items:new Map(),total_volume:0,total_purchase_value:0},target_port_id:null,planned_waypoints:[],state:AgentState.IDLE_AT_PORT,detected_threats:new Map(),threat_tolerance:settings.threat_tolerance,
   currentCrewCount:options.current_crew_count??vesselRegistry.get(vessel_class).defaultCrew,maintenancePaid:0,settings,capacity,wallet:settings.wallet_gold,origin:atPort?port.id:null,registrationPort:atPort?port.id:null,voyageOrigin:atPort?port.id:null,route:null,scanAt:0,helmsman:new TackHelmsman(),fleeHeading:null,territory:null,active:true};
  if(!Number.isSafeInteger(a.currentCrewCount)||a.currentCrewCount<0||a.currentCrewCount>vesselRegistry.get(vessel_class).crewCapacity)throw RangeError('Crew count');
  const accounts=this.economy.accounts,walletId=accountId('MERCHANT',id),seed=a.wallet;accounts.create(walletId,'MERCHANT',id,{balance:accounts.initializing?seed:0,reason:'Initial compatibility vessel capital'});if(!accounts.initializing&&seed>0)accounts.transfer(accountId('PORT',port.id),walletId,seed);accounts.bind(a,'wallet',walletId,'legacy compatibility wallet mutation');a.walletAccountId=walletId;a.financialAccountIds=Object.freeze({wallet:walletId,sailors:accountId('SAILORS_PURSE',id),maintenance:accountId('MAINTENANCE_PURSE',id)});accounts.create(a.financialAccountIds.sailors,'SAILORS_PURSE',id);accounts.create(a.financialAccountIds.maintenance,'MAINTENANCE_PURSE',id);a.runningCosts=new ShipRunningCosts(accounts,a.financialAccountIds);
  a.docked=!!atPort;a.dockedPort=atPort?port.id:null;a.stalled=0;a.lastCell=worldToAxial(s.x,s.y);a.motion=null;
  a.plannedWind=null;a.replanAt=0;a.replans=0;a.navigationSpec=s.spec;a.avoidanceAt=0;a.shoreAt=0;a.shoreHeading=null;a.shoreBlocked=false;a.waypointArrival=new WaypointArrival(s);
  a.PriceLedger.merge(this.openingLedger,Math.floor(this.#time));this.#agents.set(id,a);if(atPort)this.#syncLedger(a,port);if(atPort){if(port.berth||port.source){a.docked=false;a.dockedPort=null;this.#beginAnchor(a,port);}else{const r=this.dockTraffic.request(id,port.id,s.spec);if(r.slot===null){a.docked=false;a.dockedPort=null;this.#beginDock(a,port);}else{this.dockTraffic.mark(id,'MOORED');this.economy.setShipDocked(id,port.id);}}}return this.getAgentState(id);
 }
 setCrewCount(id,count){const a=this.#agent(id);if(!Number.isSafeInteger(count)||count<0||count>vesselRegistry.get(a.vessel_class).crewCapacity)throw RangeError('Crew count');a.currentCrewCount=count;}
 dispose(){this.market.dispose();}
 getAgentState(id) {
  const a=this.#agent(id),s=a.ship;
  return structuredClone({vessel_id:id,ship_name:a.ship_name,captain_name:a.captain_name,owner_faction:a.owner_faction,vessel_class:a.vessel_class,physics_profile:a.physics_profile,current_crew_count:a.currentCrewCount,maintenance_paid:a.maintenancePaid,manifest:{...a.manifest,total_volume:this.economy.getPhysicalShipCargo(id).reduce((n,r)=>n+r.quantity,0),physical:this.economy.getPhysicalShipCargo(id),pending_transfers:this.economy.getPendingTransfers(id),inventory:this.economy.getShipInventory(id)},
   current_position:{x:s.x,y:s.y},current_heading:s.heading,current_speed:s.speed,velocity:{x:s.vx,y:s.vy},canvas_stage:s.canvasStage,
   target_port_id:a.target_port_id,planned_waypoints:[...a.helmsman.waypoints(),...a.planned_waypoints].filter((p,i,list)=>!i||distance(p,list[i-1])>.01),navigation_waypoints:a.planned_waypoints,tack_phase:a.helmsman.phase,completed_tacks:a.helmsman.completedTacks,failed_tacks:a.helmsman.failedTacks,state:a.state,detected_threats:[...a.detected_threats.values()].map(v=>v.threat),threat_tolerance:a.threat_tolerance,
   PriceLedger:a.PriceLedger.knowledge(Math.floor(this.#time)),wallet_gold:a.wallet,running_costs:a.runningCosts.snapshot(),financial_accounts:Object.fromEntries(Object.entries(a.financialAccountIds).map(([key,id])=>[key,this.economy.accounts.inspect(id)])),max_cargo_capacity:a.capacity,registration_port_id:a.registrationPort,origin_port_id:a.voyageOrigin,docked:a.docked,docked_port_id:a.dockedPort,stalled_seconds:a.stalled,active:a.active,tacking:s.tacking,luffing:s.luffing,planned_wind_angle:a.plannedWind,route_replans:a.replans,berth_slot:this.dockTraffic.get(id)?.slot??null,queue_position:this.dockTraffic.get(id)?.queuePosition??0,giving_way:a.avoidance?.giveWay??false});
 }
 receiveMarketReports(id,ledger){this.#writable();if(!(ledger?.entries instanceof Map)||!Number.isFinite(ledger.maxAge)||ledger.maxAge<=0)throw TypeError('Detached PriceLedger required');this.#agent(id).PriceLedger.merge(ledger,Math.floor(this.#time));}
 #syncLedger(a,p){let ledger=this.portLedgers.get(p.id);if(!ledger){ledger=new PriceLedger({maxAge:this.ledgerMaxAge});this.portLedgers.set(p.id,ledger);}a.PriceLedger.sync(ledger,p,this.market,Math.floor(this.#time));}
 #manifest(a){a.manifest.total_volume=0;a.manifest.total_purchase_value=0;for(const [c,item] of a.manifest.items){if(item.quantity<=0){a.manifest.items.delete(c);continue;}a.manifest.total_volume+=item.quantity;a.manifest.total_purchase_value+=item.quantity*item.purchase_price_per_unit;}}
 #syncCargo(a){a.manifest.items=this.economy.getShipCargo(a.vessel_id);this.#manifest(a);}

 // Layer 4 can transfer captured cargo here; this never mints port stock or gold.
 receiveCargo(id,item){this.#writable();const a=this.#agent(id);if(!a.active||!this.economy.commodityRegistry.has(item.commodity_id))throw new TypeError('Invalid cargo');positive(item.quantity,'quantity');positive(item.purchase_price_per_unit,'purchase price',true);if(item.quantity>a.capacity-this.economy.getShipOccupiedQuantity(id))throw new RangeError('Cargo capacity exceeded');this.economy.receiveExternalCargo(id,item);this.#syncCargo(a);}
 loadCargo(id,port_id,c,quantity) {
  this.#writable();return this.#load(this.#agent(id),port_id,c,quantity);
 }
 #load(a,port_id,c,quantity) {
  if(!Number.isFinite(quantity)||Math.floor(quantity)<1)return fail('INVALID_QUANTITY');const p=this.ports.get(port_id);if(!a.canTrade)return fail('MILITARY_ONLY');if(!a.active||!p||!a.docked||a.dockedPort!==p.id)return fail('NOT_DOCKED');if(!this.policy.canTrade(a.owner_faction,p.owner_faction,c))return fail('TRADE_DENIED');this.economy.setShipDocked(a.vessel_id,p.id);
  const fills=this.economy.acceptCargoPickup(a.vessel_id,p.id,c,Math.floor(quantity),a.capacity,{shipId:a.vessel_id,shipName:a.ship_name,originPortId:p.id,destinationPortId:a.target_port_id});if(!fills.length)return fail('NO_CAPACITY_OR_FUNDS');this.economy.handleCargoTransfers(a.vessel_id,'PICKUP',Math.floor(quantity));this.#syncCargo(a);return ok({units_transacted:fills.reduce((n,v)=>n+v.units_transacted,0),total_gold_cost:fills.reduce((n,v)=>n+v.total_gold_cost,0)});
 }
 #acceptDelivery(a,p){if(!a.docked||a.motion||a.dockedPort!==p.id||![AgentState.UNLOADING_CARGO,AgentState.IDLE_AT_PORT].includes(a.state))return false;this.economy.setShipDocked(a.vessel_id,p.id);for(const item of [...a.manifest.items.values()])if(this.policy.canTrade(a.owner_faction,p.owner_faction,item.commodity_id))this.economy.acceptCargoDelivery(a.vessel_id,p.id,item.commodity_id,item.quantity,{acceptanceId:`dock:${a.vessel_id}:${this.economy.getShipDockVisit(a.vessel_id)}:${item.commodity_id}`,shipId:a.vessel_id,shipName:a.ship_name,originPortId:item.origin_port_id,destinationPortId:p.id});a.deliveryAccepted=true;this.#syncCargo(a);}
 #zone(p){return `${Math.floor(p.x/this.settings.zoneSize)},${Math.floor(p.y/this.settings.zoneSize)}`;}
 #routeThreat(path,start){let total=0,a=start;for(const b of path){const steps=Math.max(1,Math.ceil(distance(a,b)/this.settings.zoneSize));for(let i=0;i<=steps;i++)total+=this.#heat.get(this.#zone({x:a.x+(b.x-a.x)*i/steps,y:a.y+(b.y-a.y)*i/steps}))??0;a=b;}return total;}
 setZoneThreat(position,rating){this.#writable();this.#heat.set(this.#zone(point(position)),positive(rating,'zone threat',true));}
 #schedule(a,kind,task){
  if(a[kind])return false;
  if(!this.planningBudgetMs){let step;do{step=task.next();}while(!step.done);return step.value;}
  a[kind]=true;this.planningJobs.push({a,kind,configurationRevision:this.configurationRevision,task});return false;
 }
 #workPlans(){
  const deadline=performance.now()+this.planningBudgetMs;
  while(this.planningJobs.length&&performance.now()<deadline){const job=this.planningJobs.shift();
   if(!this.#agents.has(job.a.vessel_id)||!job.a.active||job.configurationRevision!==this.configurationRevision){job.a[job.kind]=false;continue;}
   const step=job.task.next();if(step.done)job.a[job.kind]=false;else this.planningJobs.push(job);
  }
 }
 #scan(a){return this.#schedule(a,'scanning',this.#scanTask(a));}
 *#scanTask(a) {
  if(!a.origin||!a.canTrade||this.economy.getPendingTransfers(a.vessel_id).length)return;const origin=this.#port(a.origin),opportunities=[],paths=new Map();let best=null;
  for(const p of this.ports.values()){
   if(p.id===origin.id||distance(origin.position,p.position)>a.settings.operational_range||!this.policy.canEnter(a.owner_faction,p.owner_faction))continue;
   for(const c of this.economy.commodityIds){
    if(!this.policy.canTrade(a.owner_faction,origin.owner_faction,c)||!this.policy.canTrade(a.owner_faction,p.owner_faction,c))continue;
    const buy=a.PriceLedger.entries.get(origin.id)?.prices[c],sell=a.PriceLedger.entries.get(p.id)?.prices[c];if(!buy||!sell)continue;
    const carried=a.manifest.items.get(c);if(a.manifest.items.size&&!carried)continue;const supply=marketDepth(buy.offers,[]),buyers=marketDepth([],sell.orders),buyPrice=carried?.purchase_price_per_unit??supply.ask??Infinity,sellPrice=buyers.bid??0,demand=buyers.bidQuantity;if(!Number.isFinite(buyPrice)||!demand)continue;
    const volume=carried?Math.min(carried.quantity,demand):Math.floor(Math.min(a.capacity-this.economy.getShipOccupiedQuantity(a.vessel_id),demand,supply.askQuantity,wholeUnitsAffordable(a.wallet,buyPrice)));if(volume<=0||sellPrice<=buyPrice)continue;
    const straight=Math.max(.001,distance(a.ship,p.position)),upper=(sellPrice-buyPrice)*volume/straight-a.settings.voyage_cost_per_unit;
    const preferred=distance(origin.position,p.position)>=(a.settings.preferred_voyage_distance??0);
    if(upper>0)opportunities.push({p,c,buyPrice,sellPrice,volume,upper,preferred,retained:!!carried});
   }
  }
  opportunities.sort((a,b)=>Number(b.preferred)-Number(a.preferred)||b.upper-a.upper);
  for(const {p,c,buyPrice,sellPrice,volume,upper,preferred,retained} of opportunities){
    if(best?.preferred&&!preferred)continue;
    if(best&&upper<=best.score)continue;
    let path=paths.get(p.id)??null;
    if(path===null){
     const key=`${this.configurationRevision}|${origin.id}|${p.id}|${a.vessel_class}|${Math.round(windEye(this.wind)/.15)}`,cached=this.voyagePaths.get(key);
     if(cached&&this.#time-cached.time<30){path=cached.path.map(q=>({...q}));path.shallowPassage=cached.path.shallowPassage;}
     else{path=yield* this.navigator.routeTask(origin.approach_position??origin.position,p.approach_position??p.position,a.ship.spec,{...this.wind},this.windField,{allowShallows:true,includeTacks:false});if(path.length&&p.approach_position)path.push({...p.position});const stored=path.map(q=>({...q}));stored.shallowPassage=path.shallowPassage;this.voyagePaths.set(key,{configurationRevision:this.configurationRevision,time:this.#time,path:stored});}
     paths.set(p.id,path);
    }if(!path.length)continue;
    let dist=0,prev=a.ship;for(const w of path){dist+=distance(prev,w);prev=w;}
    const score=scoreRoute({buyPrice,sellPrice,volume,distance:dist,voyageCost:dist*a.settings.voyage_cost_per_unit,zoneThreat:this.#routeThreat(path,a.ship),threatTolerance:a.threat_tolerance,cargoValue:volume*buyPrice,baseVesselValue:a.settings.base_vessel_value});
    if(score>0&&(!best||score>best.score))best={origin:origin.id,destination:p.id,commodity:c,quantity:volume,path,score,preferred,retained};
  }
  if(best&&!this.economy.getPendingTransfers(a.vessel_id).length&&a.origin===origin.id&&(a.state===AgentState.IDLE_AT_PORT||(a.state===AgentState.AT_ANCHOR&&a.anchorOrders))){a.route={...best,loaded:0,accepted:best.retained};a.target_port_id=best.destination;a.planned_waypoints=best.path;a.waypointArrival.reset(a.ship);a.plannedWind=windEye(localWindAt(this.windField,a.ship.x,a.ship.y,this.wind));a.navigationSpec=best.path.shallowPassage?{...a.ship.spec,draft:.001}:a.ship.spec;if(a.docked)a.state=AgentState.LOADING_CARGO;else this.#beginDock(a,origin);}
 }
 #replan(a){
  if(!a.target_port_id||a.replanning||this.#time<a.replanAt)return false;a.replanAt=this.#time+3;
  return this.#schedule(a,'replanning',this.#replanTask(a));
 }
 *#replanTask(a){
  const p=this.#port(a.target_port_id),start={x:a.ship.x,y:a.ship.y},wind={...this.wind},eye=windEye(localWindAt(this.windField,start.x,start.y,wind));
  const path=yield* this.navigator.routeTask(start,p.approach_position??p.position,a.ship.spec,wind,this.windField,{allowShallows:true,includeTacks:false});
  if(a.target_port_id!==p.id||a.docked||a.motion)return false;
  if(!path.length)return false;if(p.approach_position)path.push({...p.position});
  const spec=path.shallowPassage?{...a.ship.spec,draft:.001}:a.ship.spec;if(!this.navigator.clearSegment(a.ship,path[0],spec))return false;
  a.planned_waypoints=path;a.waypointArrival.reset(a.ship);a.navigationSpec=spec;a.plannedWind=eye;a.replans++;a.avoidanceAt=a.shoreAt=0;a.helmsman.invalidate();return true;
 }
 setExternalVessels(vessels){this.#writable();this.externalVessels=vessels;}
 #controls(a,wind,dt) {
  if(!a.active||![AgentState.IN_TRANSIT,AgentState.FLEEING_THREAT].includes(a.state))return {rudder_input:0,sail_trim_input:0};
  const s=a.ship,checkShore=this.#time>=a.shoreAt; a.waypointArrival.advance(s,a.planned_waypoints,this.navigator,a.navigationSpec,a.helmsman.committed||!checkShore);
  if(a.waypointArrival.blocked)this.#replan(a);const spec=a.navigationSpec;
  const target=a.planned_waypoints[0];if(!target)return {rudder_input:0,sail_trim_input:0};
  const fleeing=a.state===AgentState.FLEEING_THREAT&&a.fleeHeading!==null&&a.escapeUntil>this.#time;
  if(fleeing)a.helmsman.interrupt(this.#time);
  const helm=fleeing?{heading:a.fleeHeading,sail:1,committed:false}:a.helmsman.update(s,target,wind,this.navigator,this.#time,spec);
  let desired=helm.heading;
  // Look ahead through a full turn distance. Never move the entity directly.
  if(checkShore){
   a.shoreAt=this.#time+.2;a.shoreHeading=null;a.shoreBlocked=false;
   const look=Math.max(4,s.speed/s.spec.turnRate*2+s.spec.length*2),v=direction(desired),probe={x:s.x+v.x*look,y:s.y+v.y*look};
   if(helm.committed?!this.navigator.clearSegment(s,probe,spec):!this.navigator.roomySegment(s,probe,spec)){
   let best=null;for(const roomy of [true,false]){for(let offset=-Math.PI;offset<=Math.PI;offset+=Math.PI/12){const h=desired+offset,d=direction(h),p={x:s.x+d.x*look,y:s.y+d.y*look};if(roomy?this.navigator.roomySegment(s,p,spec):this.navigator.clearSegment(s,p,spec)){const score=Math.abs(offset);if(!best||score<best.score)best={h,score};}}if(best)break;}
    if(best)a.shoreHeading=best.h;else a.shoreBlocked=true;
   }
  }
  if(a.shoreHeading!==null){desired=a.shoreHeading;a.helmsman.interrupt(this.#time);}
  if(a.shoreBlocked){a.helmsman.interrupt(this.#time);return {rudder_input:s.blocked?1:clamp(angleDifference(desired,s.heading)*2-s.yaw,-1,1),sail_trim_input:0};}
  if(this.#time>=a.avoidanceAt){a.avoidance=avoidTraffic({...s,id:a.vessel_id},desired,wind,this.traffic,this.navigator);a.avoidanceAt=this.#time+.2;}
  if(a.avoidance?.giveWay){desired=a.avoidance.heading;a.helmsman.interrupt(this.#time);}
  const rudder=helmRudder(s,desired),sail=Math.min(helm.sail,a.avoidance?.sail??1);return {rudder_input:rudder,sail_trim_input:sail};
 }
 updateAgentPhysicsControls(id,wind_vector,delta_time){this.#writable();positive(delta_time,'delta_time',true);return this.#controls(this.#agent(id),point(wind_vector),delta_time);}
 #beginAnchor(a,p){
  if(this.economy.getPendingTransfers(a.vessel_id).length)return false;
  if(a.docked&&!this.dockTraffic.available(a.vessel_id))return false;
  const reservation=this.dockTraffic.standby(a.vessel_id,p.id,a.ship.spec),motion=reservation?.anchor?guidedPath(this.world,a.ship,reservation.anchor):null;if(!motion){if(a.docked)this.dockTraffic.mark(a.vessel_id,'MOORED');return false;}
  this.economy.setShipDocked(a.vessel_id,null);a.helmsman.reset();a.anchorOrders=true;a.origin=p.id;a.target_port_id=null;a.service=null;a.motion=motion;a.state=AgentState.ANCHORING;a.docked=false;a.dockedPort=null;a.ship.canvas=0;a.stalled=0;return true;
 }
 #beginDock(a,p){
  if(this.economy.getPendingTransfers(a.vessel_id).length)return false;
  const service=a.route?.origin===p.id?'LOAD':a.manifest.total_volume?'UNLOAD':null;
  if(!service&&(p.source||p.berth))return this.#beginAnchor(a,p);
  const reservation=this.dockTraffic.request(a.vessel_id,p.id,a.ship.spec);if(!reservation)return false;
  const target=reservation.berth??reservation.anchor,motion=target?guidedPath(this.world,a.ship,target):null;
  if(!motion){if(reservation.slot!==null)this.dockTraffic.release(a.vessel_id);return false;}
  a.helmsman.reset();a.anchorOrders=false;a.service=service;a.dockTarget=p.id;a.motion=motion;a.state=reservation.berth?AgentState.DOCKING:AgentState.ANCHORING;a.target_port_id=service==='LOAD'?a.route.destination:p.id;a.ship.canvas=0;a.stalled=0;return true;
 }
 #depart(a){
  if(this.economy.getPendingTransfers(a.vessel_id).length)return;
  if(!this.dockTraffic.available(a.vessel_id))return;
  const p=this.#port(a.route.origin),physical=!!(p.berth||p.source),approach=physical?this.dockTraffic.exit(a.vessel_id,a.ship)??p.approach_position??p.position:p.approach_position??p.position,heading=physical&&a.route.path[0]?headingTo(approach,a.route.path[0]):a.ship.heading;
  const motion=guidedPath(this.world,a.ship,{...approach,heading},{turnDuringTravel:physical});if(physical&&!motion)return;
  this.economy.setShipDocked(a.vessel_id,null);a.deliveryAccepted=false;a.helmsman.reset();a.voyageOrigin=p.id;a.docked=false;a.dockedPort=null;a.target_port_id=a.route.destination;a.planned_waypoints=a.route.path;a.motion=motion;
  a.state=a.motion&&distance(a.ship,approach)>.01?AgentState.UNDOCKING:AgentState.IN_TRANSIT;if(a.state===AgentState.IN_TRANSIT)a.motion=null;a.origin=null;a.stalled=0;
  if(a.state===AgentState.IN_TRANSIT)this.dockTraffic.release(a.vessel_id);else this.dockTraffic.mark(a.vessel_id,'DEPARTING');
 }
 #recover(a){
  const wind=localWindAt(this.windField,a.ship.x,a.ship.y,this.wind);
  if(a.docked||a.motion||![AgentState.IN_TRANSIT,AgentState.FLEEING_THREAT].includes(a.state)||Math.hypot(wind.x,wind.y)<.025)return false;
  const motion=recoveryMotion(this.world,a.ship);if(!motion)return false;
  a.helmsman.reset();a.resumeState=a.state;a.motion=motion;a.state=AgentState.RECOVERING;a.stalled=0;return true;
 }
 requestRecovery(id){this.#writable();return this.#recover(this.#agent(id));}
 removeVessel(id){this.#writable();const a=this.#agent(id);if(this.economy.getPendingTransfers(id).length){a.retireRequested=true;return false;}const before=structuredClone(a.manifest);for(const account of Object.values(a.financialAccountIds))this.economy.retireActorAccount(account,a.registrationPort??a.origin,a.registrationPort?accountId('PORT',a.registrationPort):accountId('FACTION',a.owner_faction),{apply:()=>this.#syncCargo(a),rollback:()=>a.manifest=before});this.dockTraffic.release(id);this.#agents.delete(id);if(a.retireRequested)this.onDeferredRetirement?.(id);return true;}
 reportThreatInProximity(id,threat){this.#writable();this.#report(this.#agent(id),threat);}
 #report(a,threat){if(!threat.entity_id||!FACTIONS.includes(threat.faction_id))throw new TypeError('Invalid threat');positive(threat.estimated_threat_level,'threat level',true);a.detected_threats.set(threat.entity_id,{threat:{...threat,position:point(threat.position),velocity:point(threat.velocity)},seen:this.#time});}
 #flee(a,threat){
  this.dockTraffic.release(a.vessel_id);a.docked=false;a.dockedPort=null;a.motion=null;
  const s=a.ship,wind=localWindAt(this.windField,s.x,s.y,this.wind),away=headingTo(threat.position,s);let best=away,score=-Infinity;
  for(let h=0;h<Math.PI*2;h+=Math.PI/90){const angle=Math.abs(angleDifference(h,windEye(wind))),speed=s.spec.maxSpeed*Math.hypot(wind.x,wind.y)*sailingDrive(angle,s.spec.noGo,s.spec.bestAngle),d=direction(h),p={x:s.x+d.x*5,y:s.y+d.y*5};if(!this.navigator.clearSegment(s,p,s.spec))continue;const value=speed*Math.cos(angleDifference(h,away));if(value>score){score=value;best=h;}}
  a.fleeHeading=best;a.escapeUntil=this.#time+5;a.state=AgentState.FLEEING_THREAT;
  const d=direction(best),escape={x:s.x+d.x*5,y:s.y+d.y*5};
  const covers=[...[...this.ports.values()].map(p=>({position:p.approach_position??p.position,faction_id:p.owner_faction,port_id:p.id})),...(this.coverProvider?.(this.getAgentState(a.vessel_id))??[])].filter(p=>this.policy.isFriendly(a.owner_faction,p.faction_id)).sort((a,b)=>distance(s,a.position)-distance(s,b.position));
  let cover=null,path=[];for(const candidate of covers){const route=this.navigator.route(escape,candidate.position,s.spec,this.wind,this.windField,{allowShallows:true,includeTacks:false});if(route.length){cover=candidate;path=route;break;}}
  if(cover?.port_id&&this.#port(cover.port_id).approach_position)path.push({...this.#port(cover.port_id).position});
  a.target_port_id=cover?.port_id??null;a.coverPosition=cover?.position??escape;a.planned_waypoints=[escape,...path];a.waypointArrival.reset(s);a.route=null;a.plannedWind=windEye(wind);a.navigationSpec=path.shallowPassage?{...s.spec,draft:.001}:s.spec;a.shoreAt=a.avoidanceAt=0;
 }
 #incident(a,attacker,commodity,value,fatal,kind){const r={incident_id:`incident-${++this.#incidentSequence}`,attacker_faction:attacker,victim_faction:a.owner_faction,victim_vessel_class:a.vessel_class,location:{x:a.ship.x,y:a.ship.y},commodity_affected:commodity,cargo_value_lost:value,is_fatal_sinking:fatal,timestamp_tick:this.#tick,kind,victim_vessel_id:a.vessel_id};this.#queue.push(r);if(value>0||kind==='INTERDICTION')this.#heat.set(this.#zone(r.location),(this.#heat.get(this.#zone(r.location))??0)+Math.max(1,value));return structuredClone(r);}
 executeCargoDump(id,target_port_id,dump_ratio){
  this.#writable();const a=this.#agents.get(id),p=this.ports.get(target_port_id);
  if(!a?.active||!p)return fail('UNKNOWN_ENTITY');if(!Number.isFinite(dump_ratio)||dump_ratio<=0||dump_ratio>1)return fail('INVALID_RATIO');
  if(!a.docked||a.dockedPort!==p.id)return fail('NOT_DOCKED');
  if(!a.canTrade)return fail('TRADE_DENIED');
  if(!a.manifest.total_volume)return fail('EMPTY_CARGO');
  let lost=0,commodity=null;for(const item of a.manifest.items.values()){
   const units=item.quantity*dump_ratio;this.economy.removeShipCargo(id,item.commodity_id,units,'dumping');
   lost+=units*item.purchase_price_per_unit;commodity=commodity===null?item.commodity_id:'MULTIPLE';
  }
  this.#syncCargo(a);return ok(this.#incident(a,a.owner_faction,commodity==='MULTIPLE'?null:commodity,lost,false,'CARGO_DUMP'));
 }
 processVesselInterdiction(attacker_faction,id,is_fatal){
  this.#writable();if(!FACTIONS.includes(attacker_faction)||typeof is_fatal!=='boolean')throw new TypeError('Invalid interdiction');const a=this.#agent(id);if(this.economy.getPendingTransfers(id).length)throw Error('Accepted dockside handling is protected from interdiction');if(!a.active)throw new RangeError('Vessel already sunk');
  // Nonfatal interception confiscates cargo; damage/weapon rules belong to Layer 4.
  const value=a.manifest.total_purchase_value,commodity=a.manifest.items.size===1?[...a.manifest.items.keys()][0]:null;
  for(const item of a.manifest.items.values())this.economy.removeShipCargo(id,item.commodity_id,item.quantity,is_fatal?'sinking':'confiscation');this.#syncCargo(a);if(is_fatal){this.dockTraffic.release(id);a.active=false;a.planned_waypoints=[];a.ship.canvas=0;a.ship.vx=a.ship.vy=a.ship.speed=0;}else this.#flee(a,{position:{x:a.ship.x-Math.sin(a.ship.heading),y:a.ship.y+Math.cos(a.ship.heading)}});
  return this.#incident(a,attacker_faction,commodity,value,is_fatal,'INTERDICTION');
 }
 getZoneThreatHeatmap(bounds){const {x,y,width,height}=bounds;point(bounds);positive(width,'width');positive(height,'height');const out=new Map(),size=this.settings.zoneSize,area=(size/this.settings.worldUnitsPerMile)**2;for(const [id,value] of this.#heat){const [cx,cy]=id.split(',').map(Number);if(cx*size<x+width&&(cx+1)*size>x&&cy*size<y+height&&(cy+1)*size>y)out.set(id,value/area);}return out;}
 tick(delta_time=1/30){
  this.#writable();positive(delta_time,'delta_time');if(delta_time>1)throw new RangeError('Tick must be <= 1 second');this.#running=true;this.#tick++;this.#time+=delta_time;
  try{
   const agents=[...this.#agents.values()].filter(a=>a.active);
   this.traffic=[...agents.map(a=>({...a.ship,id:a.vessel_id,stationary:a.docked||a.state===AgentState.AT_ANCHOR,assisted:!!a.motion})),...this.externalVessels];
   for(const a of agents){
    a.PriceLedger.prune(Math.floor(this.#time));if(a.docked&&a.dockedPort)this.#syncLedger(a,this.#port(a.dockedPort));
    if([AgentState.IN_TRANSIT,AgentState.FLEEING_THREAT].includes(a.state)&&a.plannedWind!==null){const w=localWindAt(this.windField,a.ship.x,a.ship.y,this.wind);if(Math.hypot(w.x,w.y)>=.025&&Math.abs(angleDifference(windEye(w),a.plannedWind))>Math.PI*.2)this.#replan(a);}
    if(a.state===AgentState.AT_ANCHOR&&!a.anchorOrders){const r=this.dockTraffic.get(a.vessel_id);if(r?.berth)this.#beginDock(a,this.#port(r.portId));}
    if(a.state===AgentState.IDLE_AT_PORT&&a.origin){const p=this.#port(a.origin);if(p.source||p.berth)this.#beginAnchor(a,p);}
   }
   // 1: opportunity scan and route planning, throttled independently of physics.
   for(const a of agents)if(!a.retireRequested&&(a.state===AgentState.IDLE_AT_PORT||(a.state===AgentState.AT_ANCHOR&&a.anchorOrders))&&this.#time>=a.scanAt){this.#scan(a);a.scanAt=this.#time+this.settings.scanInterval;}
   if(this.planningBudgetMs)this.#workPlans();
   // Accept purchases once; funded cargo remains reserved ashore until timed whole-unit loading.
   for(const a of agents)if(a.state===AgentState.LOADING_CARGO){
    if(!a.route.accepted){this.economy.setShipDocked(a.vessel_id,a.route.origin);const fills=this.economy.acceptCargoPickup(a.vessel_id,a.route.origin,a.route.commodity,Math.floor(a.route.quantity),a.capacity,{shipId:a.vessel_id,shipName:a.ship_name,originPortId:a.route.origin,destinationPortId:a.route.destination});a.route.quantity=fills.reduce((n,v)=>n+v.units_transacted,0);a.route.accepted=true;a.route.loadingProgress=0;}
    a.route.loadingProgress+=this.settings.cargoTransferRate*delta_time;const moved=this.economy.handleCargoTransfers(a.vessel_id,'PICKUP',Math.floor(a.route.loadingProgress+1e-9),{updateSequence:Math.round(this.#time*1e6)}).reduce((n,r)=>n+r.quantity,0);a.route.loaded+=moved;a.route.loadingProgress=Math.max(0,a.route.loadingProgress-moved);this.#syncCargo(a);
    if(!this.economy.getPendingTransfers(a.vessel_id,'PICKUP').length){if(a.manifest.total_volume>0)this.#depart(a);else{a.state=AgentState.IDLE_AT_PORT;a.route=null;a.target_port_id=null;a.planned_waypoints=[];}}
   }
   // 3: native integration; substeps avoid Ship.step's time clamp dropping time.
   const count=Math.ceil(delta_time*60),dt=delta_time/count;
   for(let i=0;i<count;i++)for(const a of agents){if(isSeaTime(a)){a.runningCosts.accrue(dt,a.currentCrewCount,vesselRegistry.get(a.vessel_class).baseHullMaintenance,this.compiledSettings.economy.dailyWagePerCrew,this.compiledSettings.clock.secondsPerDay);a.maintenancePaid=fromMicrogold(addMicrogold(a.runningCosts.fundedSailorsUnits,a.runningCosts.fundedMaintenanceUnits));}
    if(a.motion&&[AgentState.DOCKING,AgentState.UNDOCKING,AgentState.RECOVERING,AgentState.ANCHORING].includes(a.state)){
     const state=a.state;if(stepGuided(a.ship,a.motion,dt)){if(state===AgentState.DOCKING)a.runningCosts.dock(a.dockTarget);a.motion=null;
      if(state===AgentState.ANCHORING){a.state=AgentState.AT_ANCHOR;a.planned_waypoints=[];a.ship.vx=a.ship.vy=a.ship.speed=0;if(a.anchorOrders)this.dockTraffic.mark(a.vessel_id,'ANCHORED');}
      else if(state===AgentState.DOCKING){this.dockTraffic.mark(a.vessel_id,'MOORED');a.docked=true;this.economy.setShipDocked(a.vessel_id,a.dockTarget);a.deliveryAccepted=false;a.dockedPort=a.dockTarget;a.origin=a.dockTarget;a.planned_waypoints=a.service==='LOAD'?a.route.path:[];a.state=a.service==='LOAD'?AgentState.LOADING_CARGO:a.manifest.total_volume>0?AgentState.UNLOADING_CARGO:AgentState.IDLE_AT_PORT;if(a.state===AgentState.UNLOADING_CARGO)this.#acceptDelivery(a,this.#port(a.dockTarget));if(a.state===AgentState.IDLE_AT_PORT)a.target_port_id=null;}
      else{if(state===AgentState.UNDOCKING)this.dockTraffic.release(a.vessel_id);a.state=state===AgentState.RECOVERING?a.resumeState:AgentState.IN_TRANSIT;a.lastCell=worldToAxial(a.ship.x,a.ship.y);a.stalled=0;a.replanAt=a.shoreAt=0;a.waypointArrival.reset(a.ship);if(state===AgentState.RECOVERING)this.#replan(a);}
     }continue;
    }
    if(![AgentState.IN_TRANSIT,AgentState.FLEEING_THREAT].includes(a.state))continue;
    const wind=localWindAt(this.windField,a.ship.x,a.ship.y,this.wind),control=this.#controls(a,wind,dt);
    a.ship.canvas=control.sail_trim_input;a.ship.step(dt,{steer:control.rudder_input},wind,this.world);
   }
   // 4: threats, weather/reef avoidance, and access telemetry.
   for(const a of agents){
    if(a.docked||a.motion||a.state===AgentState.AT_ANCHOR)continue;
    for(const threat of this.threatProvider?.(this.getAgentState(a.vessel_id))??[])this.#report(a,threat);
    let strongest=null;for(const [id,entry] of a.detected_threats){const age=this.#time-entry.seen;if(age>10){a.detected_threats.delete(id);continue;}const t={...entry.threat,position:{x:entry.threat.position.x+entry.threat.velocity.x*age,y:entry.threat.position.y+entry.threat.velocity.y*age}};if(distance(a.ship,t.position)<this.settings.detectionRadius&&this.policy.isHostile(a.owner_faction,t.faction_id)&&t.estimated_threat_level>a.threat_tolerance&&(!strongest||t.estimated_threat_level>strongest.estimated_threat_level))strongest=t;}
    if(strongest){if(a.state!==AgentState.FLEEING_THREAT||this.#time>=a.escapeUntil)this.#flee(a,strongest);}
    for(const hazard of this.hazardProvider?.(this.getAgentState(a.vessel_id))??[]){if(distance(a.ship,hazard.position)<hazard.radius){this.#flee(a,{position:hazard.position});break;}}
    if(a.ship.blocked&&a.target_port_id)this.#replan(a);
    const territory=this.territoryAt?.({x:a.ship.x,y:a.ship.y});if(territory&&territory!==a.territory&&!this.policy.canEnter(a.owner_faction,territory))this.#incident(a,territory,null,0,false,'BORDER_INCURSION');a.territory=territory??null;
    const cell=worldToAxial(a.ship.x,a.ship.y),wind=localWindAt(this.windField,a.ship.x,a.ship.y,this.wind);
    if(Math.hypot(wind.x,wind.y)<.025||cell.q!==a.lastCell.q||cell.r!==a.lastCell.r){a.stalled=0;a.lastCell=cell;}else if([AgentState.IN_TRANSIT,AgentState.FLEEING_THREAT].includes(a.state))a.stalled+=delta_time;
    if(a.stalled>=this.settings.stuckSeconds)this.#recover(a);
   }
   // 5: unload through Layer 1, then conservative local transfers.
   for(const a of agents){
    if(a.state===AgentState.FLEEING_THREAT&&!a.target_port_id&&a.coverPosition&&this.#time>=a.escapeUntil&&distance(a.ship,a.coverPosition)<=this.settings.dockRadius){a.state=AgentState.IDLE_AT_PORT;a.ship.canvas=0;a.planned_waypoints=[];}
    const p=this.ports.get(a.docked?a.dockedPort:a.target_port_id);if(!p)continue;
    const accepted=this.economy.getPendingTransfers(a.vessel_id,'DELIVERY').length>0;
    if(!accepted&&!this.policy.canEnter(a.owner_faction,p.owner_faction))continue;
    if([AgentState.IN_TRANSIT,AgentState.FLEEING_THREAT].includes(a.state)&&(distance(a.ship,p.position)<=this.settings.dockRadius+a.ship.spec.length||(p.approach_position&&cellDistance(a.ship,p.approach_position)<=2))&&(a.state!==AgentState.FLEEING_THREAT||this.#time>=a.escapeUntil)){this.#beginDock(a,p);continue;}
    if(a.state!==AgentState.UNLOADING_CARGO||!a.docked)continue;
    if(!a.deliveryAccepted)this.#acceptDelivery(a,p);
    this.economy.handleCargoTransfers(a.vessel_id,'DELIVERY',this.settings.cargoTransferRate*delta_time,{updateSequence:Math.round(this.#time*1e6)});this.#syncCargo(a);if(this.economy.getPendingTransfers(a.vessel_id,'DELIVERY').length)continue;
    a.ship.canvas=0;a.ship.vx=a.ship.vy=a.ship.speed=0;a.planned_waypoints=[];a.origin=p.id;a.target_port_id=null;a.route=null;a.fleeHeading=null;a.state=AgentState.IDLE_AT_PORT;a.scanAt=this.#time+1;if(p.source||p.berth)this.#beginAnchor(a,p);
   }
   // No inter-port trickle: maritime cargo is the only inter-port transport.
   // 6: external reports join this ordered dispatch, never mutate listener state.
   const incidents=this.#queue.splice(0),listener_errors=[];for(const incident of incidents){incident.timestamp_tick=this.#tick;try{this.eventBus?.emit('ON_LOGISTICS_INCIDENT',structuredClone(incident));}catch(error){listener_errors.push(error);}}
   if(this.navigator.cache.size>64000)this.navigator.cache.clear();
   if(this.navigator.costCache.size>64000)this.navigator.costCache.clear();if(this.voyagePaths.size>512)this.voyagePaths.clear();
   return {timestamp_tick:this.#tick,incidents,listener_errors};
  }finally{this.#running=false;for(const a of [...this.#agents.values()])if(a.retireRequested&&!this.economy.getPendingTransfers(a.vessel_id).length)this.removeVessel(a.vessel_id);}
 }
}
