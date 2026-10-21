import {Registry} from './simulation-registry.js?v=babbc3d3950e';
import {IndustryInvestmentGovernor} from './industry-investment.js?v=babbc3d3950e';
import {IndustryConstructionEngine} from './industry-construction.js?v=babbc3d3950e';
import {fromMicrogold,addMicrogold,wholeUnitsAffordable} from './money.js?v=babbc3d3950e';
import {ShipRunningCosts,isSeaTime} from './ship-running-costs.js?v=babbc3d3950e';
import {accountId} from './economic-accounts.js?v=babbc3d3950e';
import {settingsForWorld} from './compiled-configuration.js?v=babbc3d3950e';
import {seedPortLedgers} from './market-bootstrap.js?v=babbc3d3950e';
import {largeVessel} from './port-infrastructure.js?v=babbc3d3950e';
import {UrbanExpansionEngine} from './expansion-engine.js?v=babbc3d3950e';
import {InfrastructureGovernor} from './infrastructure-governor.js?v=babbc3d3950e';
import {contextualName} from './contextual-names.js?v=babbc3d3950e';
import {vesselRegistry,runtimeFaction} from './simulation-registry.js?v=babbc3d3950e';
import {MarketModel} from './market-model.js?v=babbc3d3950e';
import {measurePortDistances,createSimulationScaling,procurementCoverage} from './simulation-scaling.js?v=babbc3d3950e';
import {dailyShipOverhead} from './simulation-settings.js?v=babbc3d3950e';
import {safePose} from './navigation-safety.js?v=babbc3d3950e';
import {safeGuidedStep} from './guided-safety.js?v=babbc3d3950e';
import {VoyageJournal} from './voyage-journal.js?v=babbc3d3950e';
import {Ship,SHIP_TYPES,hullDepth,localWindAt} from './ships.js?v=babbc3d3950e';
import {FACTIONS,availableStock} from './economy.js?v=babbc3d3950e';
import {VESSEL_ROLES,PriceLedger,Diplomacy} from './bridge-rules.js?v=babbc3d3950e';
import {ThreatGrid,TacticalNavigator,hexDistance} from './threat-grid.js?v=babbc3d3950e';
import {DockTraffic} from './dock-traffic.js?v=babbc3d3950e';
import {guidedPath,recoveryMotion,cellDistance,dockEndSlide} from './docking.js?v=babbc3d3950e';
import {RouteHelmsman,RouteReplanMonitor} from './route-sailing.js?v=babbc3d3950e';
import {helmRudder} from './tack-helmsman.js?v=babbc3d3950e';
import {WaypointArrival} from './waypoints.js?v=babbc3d3950e';
import {distance,headingTo,windEye,angleDifference} from './navigation.js?v=babbc3d3950e';
import {TrafficIndex,avoidTraffic} from './sailing-traffic.js?v=babbc3d3950e';
import {worldToAxial} from './world.js?v=babbc3d3950e';
import {PlanningQueue} from './planning-queue.js?v=babbc3d3950e';
import {initializeProvisions,advanceProvisions,waterReviewDue,planWaterStop,resumeAfterWater} from './ship-provisions.js?v=babbc3d3950e';
const types=Object.fromEntries(Object.values(VESSEL_ROLES).map(v=>[v.id,v.type]));
const aCrew=id=>VESSEL_ROLES[id].defaultCrew;
const fail=code=>({ok:false,error:{code}});
// Layer 2.5 owns orchestration; imported Layer 1/2 modules remain unchanged.
export class BridgeLogistics {
 constructor({economy,world,settings=settingsForWorld(world),ports,wind={x:0,y:-1},windField=null,defaults={},planningBudgetMs=4,ledgerMaxAge=null,secondsPerDay=settings.clock.secondsPerDay,queueReviewSeconds=null,scaling=null,minProfit=settings.merchant.minimumProfit,cargoHandlingRate=settings.merchant.cargoHandlingRate,diplomacy=new Diplomacy(),threatGrid=new ThreatGrid(settings.threat),windPersistence=settings.navigation.windPersistence,threatThreshold=settings.navigation.threatThreshold}={}){
  this.compiledSettings=settings;this.configurationRevision=settings.revision;this.roles=Object.freeze(Object.fromEntries(Object.entries(VESSEL_ROLES).map(([id,role])=>[id,Object.freeze({...role,dailyMaintenance:dailyShipOverhead(role.baseHullMaintenance,role.defaultCrew,settings.economy.dailyWagePerCrew),configurationRevision:settings.revision})])));this.scaling=scaling??createSimulationScaling(world.economyMetrics??measurePortDistances(world,world.ports??ports),{},settings.scaling);ledgerMaxAge??=this.scaling.ledgerMaxAge;queueReviewSeconds??=this.scaling.queueReviewTicks;this.market=new MarketModel(economy);
  if(!Number.isFinite(windPersistence)||windPersistence<0||!Number.isFinite(threatThreshold)||threatThreshold<0||threatThreshold>threatGrid.maxThreat)throw RangeError('Route monitor settings');if(!Number.isFinite(cargoHandlingRate)||cargoHandlingRate<=0||secondsPerDay<=0||queueReviewSeconds<=0||minProfit<0||!Number.isSafeInteger(settings.merchant.explorationIntervalVoyages)||settings.merchant.explorationIntervalVoyages<1)throw RangeError('Bridge settings');Object.assign(this,{economy,world,wind,windField,planningBudgetMs,secondsPerDay,queueReviewSeconds,minProfit,cargoHandlingRate,diplomacy,threatGrid,windPersistence,threatThreshold,explorationIntervalVoyages:settings.merchant.explorationIntervalVoyages});
  this.defaults={wallet_gold:settings.merchant.startingWallet,voyage_cost_per_unit:settings.merchant.distanceCost,...defaults};this.agents=new Map();this.ports=new Map(ports.map(p=>[p.id,{...p,PriceLedger:new PriceLedger({maxAge:ledgerMaxAge})}]));this.portLedgers=new Map(economy.getPortIds().map(id=>[id,new PriceLedger({maxAge:ledgerMaxAge})]));
  this.governors=new Map((world.ports??ports).map(p=>[p.id,{portId:p.id,name:p.governor?.name??contextualName(p.owner_faction??runtimeFaction(p.faction)??this.ports.get(p.id)?.owner_faction,'governors',(world.config?.seed??'world')+'|'+p.id),prosperity:1,urgencyTicks:this.scaling.urgencyTicks}]));
  for(const p of this.ports.values())p.PriceLedger=this.portLedgers.get(p.id);
  this.dockTraffic=new DockTraffic(world,[...(world.ports??[]),...ports]);this.urbanExpansion=new UrbanExpansionEngine({world,economy,traffic:this.dockTraffic,scaling:this.scaling});this.industryConstruction=new IndustryConstructionEngine({world,economy,traffic:this.dockTraffic,registry:new Registry(economy.getIndustryDefinitions())});this.industryInvestment=new IndustryInvestmentGovernor({world,economy,construction:this.industryConstruction,settings,canTrade:(p,q)=>this.diplomacy.canTrade(this.ports.get(p)?.owner_faction,this.ports.get(q)?.owner_faction)});this.infrastructureGovernor=new InfrastructureGovernor({world,economy,traffic:this.dockTraffic,scaling:this.scaling,governors:this.governors,secondsPerDay});this.navigators=new Map(FACTIONS.map(f=>[f,new TacticalNavigator(world,threatGrid,diplomacy,f,{spacing:4,maxNodes:16000})]));this.navigator=this.navigators.get('ENGLAND');this.externalVessels=[];this.jobs=new PlanningQueue();this.serial=0;this.time=0;this.currentTick=0;this.bridgeTime=0;this.ledgerMaxAge=ledgerMaxAge;this.playerLedger=new PriceLedger({maxAge:ledgerMaxAge});
  this.market.subscribe(event=>{this.portLedgers.get(event.portId)?.recordMarketEvent(event,this.currentTick);this.refreshProcurement(event.portId);});
  seedPortLedgers({economy,market:this.market,ports:[...(world.ports??[]),...ports],ledgers:this.portLedgers});for(const id of this.governors.keys())this.refreshProcurement(id);
 }
 spawnVessel(faction,vesselClass,position,options={}){
  if(!FACTIONS.includes(faction)||!types[vesselClass])throw TypeError('Vessel classification');const ship=new Ship(types[vesselClass],{...position,heading:options.heading??0});if(hullDepth(this.world,ship.x,ship.y,ship.heading,ship.spec)<ship.spec.draft)throw RangeError('Unsafe spawn');
  const currentCrewCount=options.current_crew_count??aCrew(vesselClass);if(!Number.isSafeInteger(currentCrewCount)||currentCrewCount<0||currentCrewCount>VESSEL_ROLES[vesselClass].crewCapacity)throw RangeError('Crew count');
  const id=`vessel-${++this.serial}`,home=this.ports.get(options.home_port_id)??[...this.ports.values()].sort((a,b)=>distance(a.position,ship)-distance(b.position,ship))[0],a={id,name:contextualName(faction,'ships',(this.world.config?.seed??'world')+'|'+id,{military:VESSEL_ROLES[vesselClass].militaryOnly}),captainName:contextualName(faction,'captains',(this.world.config?.seed??'world')+'|'+id),faction,vesselClass,role:this.roles[vesselClass],ship,PriceLedger:new PriceLedger({maxAge:this.ledgerMaxAge}),manifest:new Map(),wallet:options.wallet_gold??this.defaults.wallet_gold,capacity:options.max_cargo_capacity??ship.spec.cargoCapacity,currentCrewCount,registration:home?.id,origin:home?.id,target:null,state:'AT_ANCHOR',docked:false,path:[],helmsman:new RouteHelmsman(),arrival:new WaypointArrival(ship),motion:null,scanAt:0,waitingOrders:true,reviewAt:0,queueSince:null,maintenancePaid:0,stalled:0,lastCell:worldToAxial(ship.x,ship.y),planning:false,planNonce:0,active:true,matrix:[],plannedWind:windEye(this.wind),replanAt:0,explorationPending:false};
  initializeProvisions(this,a,vesselRegistry.get(vesselClass),options);
  const financial=this.economy.accounts,ids={wallet:accountId('MERCHANT',id),sailors:accountId('SAILORS_PURSE',id),maintenance:accountId('MAINTENANCE_PURSE',id)},seed=a.wallet;
  if(!financial.initializing&&seed>0){if(!home||this.economy.getPortTreasury(home.id).spendable<seed){this.serial--;throw Error('Insufficient port funds for vessel capital');}}
  financial.create(ids.wallet,'MERCHANT',id,{balance:financial.initializing?seed:0,reason:'Initial vessel seed capital'});financial.create(ids.sailors,'SAILORS_PURSE',id);financial.create(ids.maintenance,'MAINTENANCE_PURSE',id);if(!financial.initializing&&seed>0)financial.transfer(accountId('PORT',home.id),ids.wallet,seed);
  a.financialAccountIds=Object.freeze(ids);a.runningCosts=new ShipRunningCosts(financial,ids);financial.bind(a,'wallet',ids.wallet,'legacy merchant wallet mutation');
  a.replanMonitor=new RouteReplanMonitor({...this.compiledSettings.navigation,windPersistence:this.windPersistence});a.replanMonitor.reset(a.plannedWind);a.hotspots=new Set();a.sailingSpec={...ship.spec,draft:.001};a.journal=new VoyageJournal();a.spawnTick=this.currentTick;a.homePort=home?.id;a.autoTrade=options.auto_trade!==false&&a.role.canTrade;a.autoPatrol=!!options.auto_patrol&&a.role.militaryOnly;a.patrolIndex=0;this.agents.set(id,a);if(home){a.PriceLedger.observe(home,this.market,this.currentTick);a.PriceLedger.merge(home.PriceLedger,this.currentTick);this.anchor(a,home);}return this.getAgentState(id);
 }
 refreshProcurement(portId){const governor=this.governors.get(portId);if(governor)governor.procurement=this.market.getPortSupplies(portId).map(stock=>procurementCoverage(stock,this.scaling));}
 accrueRunningCosts(a,seconds){if(isSeaTime(a)){a.runningCosts.accrue(seconds,a.currentCrewCount,a.role.baseHullMaintenance,this.compiledSettings.economy.dailyWagePerCrew,this.secondsPerDay);a.maintenancePaid=fromMicrogold(addMicrogold(a.runningCosts.fundedSailorsUnits,a.runningCosts.fundedMaintenanceUnits));}}
 overhead(a){return dailyShipOverhead(a.role.baseHullMaintenance,a.currentCrewCount,this.compiledSettings.economy.dailyWagePerCrew);}
 setCrewCount(id,count){const a=this.state(id);if(!Number.isSafeInteger(count)||count<0||count>a.role.crewCapacity)throw RangeError('Crew count');a.currentCrewCount=count;return this.overhead(a);}
 dispose(){this.market.dispose();}
 setExternalVessels(vessels){this.externalVessels=vessels;}
 removeVessel(id){const a=this.agents.get(id);if(a&&this.economy.getPendingTransfers(id).length){a.retireRequested=true;a.autoTrade=a.autoPatrol=false;this.cancelPlanning(a);a.turnaround=null;return false;}if(a){this.cancelPlanning(a);const recipient=a.registration?accountId('PORT',a.registration):accountId('FACTION',a.faction);for(const account of Object.values(a.financialAccountIds)){const before=a.manifest;this.economy.retireActorAccount(account,a.registration,recipient,{apply:()=>a.manifest=this.economy.getShipCargo(a.id),rollback:()=>a.manifest=before});}}this.dockTraffic.release(id);this.agents.delete(id);if(a?.retireRequested)this.onDeferredRetirement?.(id);return true;}
 state(id){const a=this.agents.get(id);if(!a)throw RangeError('Unknown vessel');return a;}
 getAgentState(id,{includeKnowledge=true}={}){const a=this.state(id),s=a.ship,items=new Map(a.manifest),r=this.dockTraffic.get(id);return structuredClone({vessel_id:id,ship_name:a.name,captain_name:a.captainName,owner_faction:a.faction,vessel_class:a.vesselClass,current_position:{x:s.x,y:s.y},current_heading:s.heading,current_speed:s.speed,velocity:{x:s.vx,y:s.vy},canvas_stage:s.canvasStage,manifest:{items,total_volume:this.economy.getPhysicalShipCargo(id).reduce((n,r)=>n+r.quantity,0),physical:this.economy.getPhysicalShipCargo(id),pending_transfers:this.economy.getPendingTransfers(id),inventory:this.economy.getShipInventory(id)},wallet_gold:a.wallet,running_costs:a.runningCosts.snapshot(),financial_accounts:Object.fromEntries(Object.entries(a.financialAccountIds).map(([key,id])=>[key,this.economy.accounts.inspect(id)])),max_cargo_capacity:a.capacity,target_port_id:a.target,registration_port_id:a.registration,origin_port_id:a.origin,planned_waypoints:[...a.helmsman.waypoints(),...a.path],route_wind_angle:a.plannedWind,sailing_mode:a.helmsman.mode,navigation_telemetry:{...a.helmsman.safety.telemetry},job_purpose:a.jobPurpose??(a.role.canTrade?'Seeking work':'Military patrol'),state:a.state,docked:a.docked,active:a.active,stalled_seconds:a.stalled,dock_id:r?.dockId??null,dock_type_id:r?.dockTypeId??null,berth_slot:r?.slot??null,berth_slots:r?.slots??[],berth_mode:r?.berthMode??null,queue_position:r?.queuePosition??0,giving_way:a.givingWay??false,exploration_pending:a.explorationPending,exploration_interval_voyages:this.explorationIntervalVoyages,PriceLedger:includeKnowledge?a.PriceLedger.knowledge(this.currentTick):undefined,expected_profit_matrix:includeKnowledge?structuredClone(a.matrix):undefined,military_only:a.role.militaryOnly,realised_profit:a.journal.realisedProfit,completed_voyages:a.journal.completed,profit_per_hour:a.journal.realisedProfit*3600/Math.max(1,this.currentTick-a.spawnTick),water_status:{current:a.water,capacity:a.waterCapacity,fraction:a.water/a.waterCapacity,stopping:!!a.waterStop},morale_percent:a.morale,current_crew_count:a.currentCrewCount,daily_ship_overhead:this.overhead(a),contract_deadline_tick:a.order?.deadlineTick??null,voyages:includeKnowledge?a.journal.snapshot():undefined,maintenance_paid:a.maintenancePaid});}
 sync(a,p){if(a.docked)this.industryInvestment.observeVisit(p.id,a.id,a.PriceLedger,this.currentTick,this.economy.getShipDockVisit(a.id));a.PriceLedger.sync(p.PriceLedger,p,this.market,this.currentTick);}
 dockPlayer(portId){const raw=this.world.ports?.find(p=>p.id===portId),p=this.ports.get(portId)??(raw?{id:raw.id,name:raw.name,owner_faction:runtimeFaction(raw.faction),PriceLedger:this.portLedgers.get(raw.id)}:null);if(p)this.playerLedger.sync(p.PriceLedger,p,this.market,this.currentTick);return this.playerLedger.knowledge(this.currentTick);}
 anchor(a,p){if(this.economy.getPendingTransfers(a.id).length)return false;if(a.docked&&!this.dockTraffic.available(a.id))return false;const r=this.dockTraffic.standby(a.id,p.id,a.ship.spec),motion=r?.anchor?guidedPath(this.world,a.ship,r.anchor,{turnClearance:largeVessel(a.ship.spec)||r?.berthMode==='PIER_END'}):null;if(!motion){if(a.docked)this.dockTraffic.mark(a.id,'MOORED');return false;}this.economy.setShipDocked(a.id,null);a.docked=false;a.motion=motion;a.state='ANCHORING';a.waitingOrders=true;a.jobPurpose=a.role.canTrade?'Seeking work':'Military patrol';a.origin=p.id;a.target=null;a.ship.canvas=0;return true;}
 redirectDock(a){const r=this.dockTraffic.redirectToEnd(a.id),target=r?.berth??r?.anchor;if(!target)return false;a.motion=dockEndSlide(a.ship,target);a.state=r.berth?'DOCKING':'ANCHORING';a.waitingOrders=false;a.docked=false;a.ship.docked=false;return true;}
 requestDock(a,p,service){if(this.economy.getPendingTransfers(a.id).length)return false;const r=this.dockTraffic.request(a.id,p.id,a.ship.spec);if(!r)return false;const target=r.berth??r.anchor,motion=target?guidedPath(this.world,a.ship,target,{turnClearance:largeVessel(a.ship.spec)||r.berthMode==='PIER_END'}):null;if(!motion){if(!safePose(this.world,a.ship,a.ship.spec)){a.service=service;a.dockPort=p.id;a.queueSince??=this.time;a.reviewAt=this.time+this.queueReviewSeconds;if(this.redirectDock(a))return true;}this.dockTraffic.release(a.id);return false;}a.motion=motion;a.state=r.berth?'APPROACHING':'ANCHORING';a.waitingOrders=false;a.service=service;a.dockPort=p.id;a.queueSince??=this.time;a.reviewAt=this.time+this.queueReviewSeconds;return true;}
 depart(a,p){if(this.economy.getPendingTransfers(a.id).length)return false;if(!this.dockTraffic.available(a.id))return false;const exit=this.dockTraffic.exit(a.id);if(!exit)return false;const motion=guidedPath(this.world,a.ship,{...exit,heading:a.path[0]?headingTo(exit,a.path[0]):a.ship.heading},{turnDuringTravel:true,turnClearance:this.dockTraffic.get(a.id)?.berthMode==='PIER_END'});if(!motion)return false;this.economy.setShipDocked(a.id,null);a.purchaseQuote=null;a.purchaseOrder=null;a.pickupAccepted=false;a.deliveryAccepted=false;a.motion=motion;a.state='UNDOCKING';a.docked=false;this.dockTraffic.mark(a.id,'DEPARTING');a.helmsman.reset();return true;}
 routeStatistics(a,path){let length=0,prev=a.ship;for(const q of path){length+=distance(prev,q);prev=q;}const speed=Math.max(.1,a.ship.spec.maxSpeed*Math.hypot(this.wind.x,this.wind.y)*.5),risk=this.threatGrid.pathRisk(a.ship,path,a.faction,this.diplomacy);return {length,risk,seconds:length/speed,baseCost:length*this.defaults.voyage_cost_per_unit+length/speed*this.overhead(a)/this.secondsPerDay};}
 journey(a,p,path,volume=0,price=0,stats=this.routeStatistics(a,path)){return {length:stats.length,cost:stats.baseCost+stats.risk*(2+volume*price*.001),risk:stats.risk};}
 evaluate(a,origin,destination,commodity,path,volume=null,stats=null){
  if(!a.manifest.size&&!this.tradeAllowed(a,origin.id,destination.id,commodity))return null;const buy=a.PriceLedger.entries.get(origin.id),sell=a.PriceLedger.entries.get(destination.id);if(!buy||!sell||!this.diplomacy.canTrade(a.faction,origin.owner_faction)||this.diplomacy.isHostile(a.faction,destination.owner_faction)||!this.diplomacy.canTrade(a.faction,destination.owner_faction))return null;
  const b=buy.prices[commodity],s=sell.prices[commodity];if(!b||!s||!(s.bid>0)||!(s.demand>0)||(!a.manifest.size&&!(b.ask>0)))return null;const confidence=Math.max(0,1-(this.currentTick-sell.tick)/a.PriceLedger.maxAge),buyPrice=b.ask??0,quotedSell=s.bid??0,marginBase=a.manifest.get(commodity)?.purchase_price_per_unit??buyPrice,sellPrice=quotedSell-Math.max(0,quotedSell-marginBase)*(1-confidence);
  volume??=Math.floor(Math.min(Math.max(0,a.capacity-(a.forecastOccupiedQuantity??this.economy.getShipOccupiedQuantity(a.id))),Math.max(0,b.askQuantity??b.available),s.bidQuantity??s.demand,wholeUnitsAffordable(a.wallet,Math.max(.001,buyPrice))));volume=Math.min(volume,s.bidQuantity??s.demand);if(volume<=0)return null;const journey=this.journey(a,destination,path,volume,buyPrice,stats??this.routeStatistics(a,path)),waitCost=(this.time-(a.queueSince??this.time))*this.overhead(a)/this.secondsPerDay;
  return {origin:origin.id,destination:destination.id,commodity,quantity:volume,buyPrice,sellPrice,confidence,age:this.currentTick-sell.tick,journeyCost:journey.cost,waitCost,profit:(sellPrice-buyPrice)*volume-journey.cost-waitCost,path,risk:journey.risk};
 }
 get jobs(){return this._jobs;}
 set jobs(value){this._jobs=value instanceof PlanningQueue?value:new PlanningQueue(value);}
 *waterRoute(a){yield* planWaterStop(this,a);}
 *waterResume(a){yield* resumeAfterWater(this,a);}
 cancelPlanning(a){for(const j of this.jobs.cancelActor(a.id)){try{j.task.return?.();}catch(error){a.planningError=String(error.message??error);}}a.planNonce++;a.planning=false;a.waterPlanning=false;}
 tradeAllowed(a,origin,destination,commodity){const last=a.lastDelivery;return !(last?.portId===origin&&last.returnOrigins[commodity]?.includes(destination));}
 schedule(a,task,intent){if(a.planning)return;a.waterPlanning=intent?.kind==='water';a.planning=true;this.jobs.push({a,nonce:a.planNonce,configurationRevision:this.configurationRevision,task,intent});}
 *selectTrade(a,{exclude=null,reroute=false}={}){
  const origin=this.ports.get(a.origin);if(!origin||!a.role.canTrade)return;a.PriceLedger.prune(this.currentTick);const routeWind={...this.wind},routeEye=windEye(routeWind);let best=null,explore=null;a.matrix=[];const nav=this.navigators.get(a.faction),cargo=[...a.manifest.values()],commodities=cargo.length?cargo.map(r=>r.commodity_id):this.economy.commodityIds;
  const destinations=[...this.ports.values()].filter(p=>(reroute||p.id!==origin.id)&&p.id!==exclude&&this.dockTraffic.canDock(p.id,a.ship.spec)&&this.diplomacy.canTrade(a.faction,p.owner_faction)&&this.diplomacy.canEnter(a.faction,p.owner_faction)).sort((x,y)=>distance(a.ship,x.position)-distance(a.ship,y.position)||x.id.localeCompare(y.id));
  // A turnaround planner runs before the prior order is cleared. Treat that
  // state as the next departure for cadence purposes, while using its
  // forecast occupancy so accepted deliveries are not mistaken for cargo the
  // merchant still owns.
  const cadence=this.explorationIntervalVoyages,
        departurePlanning=Boolean(!a.order||a.turnaround?.portId===origin.id),
        nextVoyageNumber=a.journal.completed+(a.turnaround?.portId===origin.id?2:1),
        explorationDue=departurePlanning&&cadence>0&&(a.explorationPending||nextVoyageNumber%cadence===0);
  if(explorationDue){
   a.explorationPending=true;
   for(const p of destinations.filter(candidate=>!a.PriceLedger.entries.has(candidate.id))){
    a.planningDestination=p.id;const approach=this.visitApproach(a,p);if(!approach){a.planningDestination=null;continue;}const path=yield* this.voyageRoute(a,p,approach,routeWind);a.planningDestination=null;if(!path.length)continue;path.push({...this.dockTraffic.destination(p.id,a.ship.spec)});if(this.journey(a,p,path).cost>a.wallet)continue;a.explorationPending=false;return {order:{origin:origin.id,destination:p.id,path,exploration:true,purpose:'Explore unknown port',quantity:0},routeEye};
   }
  }
  // Rank ledger margins before expensive route searches. No remote live-market reads.
  const emptyStats=this.routeStatistics(a,[]),candidates=destinations.map(p=>{let upper=0;for(const c of commodities){const r=this.evaluate(a,origin,p,c,[],a.manifest.get(c)?.quantity,emptyStats);if(r&&r.quantity>0)upper=Math.max(upper,cargo.length?(r.sellPrice-a.manifest.get(c).purchase_price_per_unit)*r.quantity:r.profit);}return {p,upper,rate:upper/Math.max(1,distance(a.ship,p.position))};}).filter(c=>c.upper>=this.minProfit).sort((x,y)=>distance(a.ship,x.p.position)-distance(a.ship,y.p.position)||y.rate-x.rate);
  for(const candidate of candidates){const p=candidate.p;if(best&&candidate.rate<=best.profit/Math.max(1,best.routeLength))break;
   const approach=this.visitApproach(a,p);if(!approach)continue;const path=yield* this.voyageRoute(a,p,approach,routeWind);if(!path.length)continue;path.push({...this.dockTraffic.destination(p.id,a.ship.spec)});
   const stats=this.routeStatistics(a,path);for(const c of commodities){const r=this.evaluate(a,origin,p,c,path,a.manifest.get(c)?.quantity,stats);if(!r)continue;if(cargo.length)r.profit=(r.sellPrice-a.manifest.get(c).purchase_price_per_unit)*r.quantity-this.journey(a,p,path,r.quantity,a.manifest.get(c).purchase_price_per_unit,stats).cost-(this.time-(a.queueSince??this.time))*this.overhead(a)/this.secondsPerDay;r.routeLength=stats.length;a.matrix.push({...r,path:undefined});if(r.quantity>0&&r.profit>=this.minProfit&&(!best||r.profit/Math.max(1,stats.length)>best.profit/Math.max(1,best.routeLength)))best=r;}
   // Dispatch the first viable voyage from ranked quotes instead of searching every market.
   if(best)break;
  }
  if(!best){
   const sellCeilings={};for(const p of [origin,...destinations]){const entry=a.PriceLedger.entries.get(p.id);if(entry)for(const [c,v] of Object.entries(entry.prices))sellCeilings[c]=Math.max(sellCeilings[c]??0,v.bid??0);}
   const scouts=destinations.map(p=>{const entry=a.PriceLedger.entries.get(p.id),age=entry?this.currentTick-entry.tick:Infinity;let potential=0;if(entry)for(const [c,v] of Object.entries(entry.prices)){const buy=v.ask??Infinity,q=Math.min(Math.max(0,a.capacity-(a.forecastOccupiedQuantity??this.economy.getShipOccupiedQuantity(a.id))),v.askQuantity??v.available,a.wallet/Math.max(.001,buy)),confidence=Math.max(0,1-age/a.PriceLedger.maxAge);potential=Math.max(potential,((sellCeilings[c]??0)-buy)*q*confidence);}
    const score=(!entry?100:potential>=this.minProfit?50+Math.min(50,potential):age>=this.scaling.jobReviewTicks?10+age/a.PriceLedger.maxAge*20:this.time-(a.workIdleSince??this.time)>=this.scaling.jobReviewTicks?1:0)/Math.max(1,distance(a.ship,p.position));
    return {p,score,purpose:!entry?'Discover market':potential>=this.minProfit?'Seek cargo':'Refresh market report'};
   }).filter(c=>c.score>0||reroute).sort((a,b)=>b.score-a.score);
   for(const candidate of scouts){const p=candidate.p;a.planningDestination=p.id;const approach=this.visitApproach(a,p);if(!approach){a.planningDestination=null;continue;}const path=yield* this.voyageRoute(a,p,approach,routeWind);a.planningDestination=null;if(!path.length)continue;path.push({...this.dockTraffic.destination(p.id,a.ship.spec)});if(this.journey(a,p,path).cost>a.wallet)continue;explore={origin:origin.id,destination:p.id,path,exploration:true,purpose:candidate.purpose};break;}
  }
  return {order:best??explore,routeEye};
 }
 *plan(a,options={}){const selection=yield* this.selectTrade(a,options);if(selection)this.activateTrade(a,selection.order,selection.routeEye,options);}
 activateTrade(a,order,routeEye,{reroute=false,decisionLedger=a.PriceLedger}={}){
  if(this.economy.getPendingTransfers(a.id).length)return false;
  const origin=this.ports.get(a.origin);if(!origin)return;a.turnaround=null;
  if(!order){a.workIdleSince??=this.time;if(reroute){const shelter=this.ports.get(a.dockPort)??origin;if(!this.anchor(a,shelter)){a.state=a.docked?'IDLE_AT_PORT':'AT_ANCHOR';a.waitingOrders=true;}}return;}a.workIdleSince=null;a.jobPurpose=order.purpose??'Trade cargo';a.journal.begin(a.origin,order.destination,this.currentTick,a.maintenancePaid);a.journal.plan({tick:this.currentTick,origin:order.origin,destination:order.destination,commodity:order.commodity??null,quantity:order.quantity??0,buyPrice:order.buyPrice??null,sellPrice:order.sellPrice??null,expectedProfit:order.profit??null,journeyCost:order.journeyCost??null,waitCost:order.waitCost??null,selectionRule:order.exploration?'Configured exploration cadence: nearest port outside vessel knowledge':'First viable nearby ledger trade, positive expected profit',confidence:order.confidence??null,sellReportAge:order.age??null,risk:order.risk??null,purpose:a.jobPurpose,buyReport:decisionLedger.entries.get(order.origin),sellReport:decisionLedger.entries.get(order.destination)});order.configurationRevision=this.configurationRevision;order.createdTick=this.currentTick;order.deadlineTick=this.scaling.contractDeadline(this.currentTick,origin,this.ports.get(order.destination));a.order=order;a.path=order.path;a.target=order.destination;a.destinationApproach=this.visitApproach(a,this.ports.get(order.destination));this.recordRoute(a,routeEye);a.arrival.reset(a.ship);a.helmsman.reset();a.waitingOrders=false;
  if(reroute){a.queueSince=null;if(a.docked){a.state='REROUTING';this.depart(a,origin);}else{this.dockTraffic.release(a.id);a.state='IN_TRANSIT';a.motion=null;}return;}
  if(order.exploration||a.manifest.size){if(a.docked){a.state='REROUTING';this.depart(a,origin);}else{this.dockTraffic.release(a.id);a.state='IN_TRANSIT';}}
  else if(a.docked&&a.dockPort===origin.id){a.service='LOAD';a.state='LOADING_CARGO';a.motion=null;}
  else if(!this.requestDock(a,origin,'LOAD')){a.order=null;a.target=null;a.waitingOrders=true;a.state='AT_ANCHOR';a.jobPurpose='Waiting for dock access';}
 }
 // Capture market knowledge at contact, before this vessel's first sale.
 beginTurnaround(a,p){
  if(a.turnaround?.portId===p.id)return;
  const ledger=new PriceLedger({maxAge:a.PriceLedger.maxAge});ledger.entries=structuredClone(a.PriceLedger.entries);
  const returnOrigins={};for(const item of a.manifest.values()){const origins=item.provenance?.map(row=>row.origin_port_id)??[item.origin_port_id??a.order?.origin??a.journal.current?.origin];for(const origin of new Set(origins))if(origin&&origin!==p.id)(returnOrigins[item.commodity_id]??=[]).push(origin);}if(Object.keys(returnOrigins).length)a.lastDelivery={portId:p.id,returnOrigins};
  a.turnaround={portId:p.id,emptySince:null,tick:this.currentTick,ledger,wallet:a.wallet,ready:false,selection:null};
 }
 *planTurnaround(a,p){
  const pending=a.turnaround;if(!pending||pending.portId!==p.id)return;
  // Forecast the empty hold and sale proceeds without touching the incoming voyage.
  const ledger=new PriceLedger({maxAge:pending.ledger.maxAge});ledger.entries=structuredClone(pending.ledger.entries);
  const forecastOccupiedQuantity=this.economy.getShipOccupiedQuantity(a.id)-this.economy.getPendingTransfers(a.id,'DELIVERY').reduce((n,t)=>n+t.remainingQuantity,0);
  if(this.explorationIntervalVoyages>0&&(a.journal.completed+2)%this.explorationIntervalVoyages===0)a.explorationPending=true;
  const decision={...a,PriceLedger:ledger,manifest:new Map(a.manifest),forecastOccupiedQuantity,wallet:pending.wallet,matrix:[],queueSince:null};
  const selection=yield* this.selectTrade(decision);
  if(a.turnaround!==pending||!a.docked||a.dockPort!==p.id)return;
  if(selection?.order?.exploration)a.explorationPending=false;
  pending.selection=selection;pending.matrix=decision.matrix;pending.ready=true;
 }
 finishTurnaround(a,p){
  if(this.economy.getPendingTransfers(a.id).length)return;
  const pending=a.turnaround;a.turnaround=null;
  a.journal.complete(p.id,this.currentTick,a.maintenancePaid);a.order=null;a.loaded=0;a.queueSince=null;a.purchaseQuote=null;a.purchaseOrder=null;
  const selection=pending?.selection,order=selection?.order,destination=order&&this.ports.get(order.destination);
  if(order&&this.canVisit(a,destination)&&this.diplomacy.canTrade(a.faction,p.owner_faction)&&this.diplomacy.canTrade(a.faction,destination.owner_faction)&&(order.exploration||order.profit>=this.minProfit)){
   a.matrix=pending.matrix;this.activateTrade(a,order,selection.routeEye,{reroute:a.manifest.size>0,decisionLedger:pending.ledger});return;
  }
  if(!this.anchor(a,p)){a.state='IDLE_AT_PORT';a.waitingOrders=true;}
 }
 acceptPickup(a,p,c,q){
  if(!a.role.canTrade||!a.docked||a.dockPort!==p.id||!this.diplomacy.canTrade(a.faction,p.owner_faction)||Math.floor(q)<1)return [];
  this.economy.setShipDocked(a.id,p.id);
  const journalBefore=a.journal.snapshot();if(a.order&&a.pickupIntentOrder!==a.order){a.pickupIntentOrder=a.order;a.pickupIntentId=`pickup:${a.id}:${this.economy.getShipDockVisit(a.id)}:${a.pickupIntentSerial=(a.pickupIntentSerial??0)+1}`;}return this.economy.acceptCargoPickup(a.id,p.id,c,Math.floor(q),a.capacity,{acceptanceId:a.order?`${a.pickupIntentId}:${c}`:undefined,shipId:a.id,shipName:a.name,originPortId:p.id,destinationPortId:a.order?.destination??a.target,effects:{apply:value=>{a.journal.purchaseAccepted(c,value.units_transacted,value.total_gold_cost,this.currentTick,p.id);a.manifest=this.economy.getShipCargo(a.id);},rollback:()=>{a.manifest=this.economy.getShipCargo(a.id);Object.assign(a.journal,journalBefore);}}});
 }
 acceptDelivery(a,p,c,q,acceptanceId=null){
  if(!a.docked||a.motion||!['IDLE_AT_PORT','LOADING_CARGO','UNLOADING_CARGO'].includes(a.state)||a.dockPort!==p.id||!this.diplomacy.canTrade(a.faction,p.owner_faction))return [];
  this.economy.setShipDocked(a.id,p.id);const journalBefore=a.journal.snapshot();
  const fills=this.economy.acceptCargoDelivery(a.id,p.id,c,q,{acceptanceId:acceptanceId??`dock:${a.id}:${this.economy.getShipDockVisit(a.id)}:${c}`,shipId:a.id,shipName:a.name,originPortId:a.manifest.get(c)?.origin_port_id??a.origin,destinationPortId:p.id,effects:{apply:value=>{a.journal.saleAccepted(c,value.units_transacted,value.total_gold_cost,this.currentTick,p.id,value.goods.reduce((n,r)=>n+r.acquisitionCost,0));a.manifest=this.economy.getShipCargo(a.id);},rollback:()=>{a.manifest=this.economy.getShipCargo(a.id);Object.assign(a.journal,journalBefore);}}});
  if(fills.length){const origins=a.lastDelivery?.portId===p.id?structuredClone(a.lastDelivery.returnOrigins):{};for(const v of fills)for(const row of v.provenance)if(row.originPortId&&row.originPortId!==p.id){const list=origins[c]??=[];if(!list.includes(row.originPortId))list.push(row.originPortId);}a.lastDelivery={portId:p.id,returnOrigins:origins};}return fills;
 }
 handle(a,kind,budget,context={}){const rows=this.economy.handleCargoTransfers(a.id,kind,budget,context);for(const row of rows)a.journal.handled(kind,row.commodityId,row.quantity);a.manifest=this.economy.getShipCargo(a.id);return rows.reduce((n,r)=>n+r.quantity,0);}
 loadCargo(id,portId,commodity,quantity){
  if(!Number.isFinite(quantity)||Math.floor(quantity)<1)return fail('INVALID_QUANTITY');const a=this.state(id),p=this.ports.get(portId);if(!a.role.canTrade)return fail('MILITARY_ONLY');if(!a.docked||a.dockPort!==portId)return fail('NOT_DOCKED');if(!p)return fail('UNKNOWN_PORT');
  let fills=[];const pending=this.economy.getPendingTransfers(id,'PICKUP');if(!pending.length){if(a.order&&a.purchaseOrder===a.order&&a.pickupAccepted&&a.purchaseQuote?.commodity_id===commodity)return fail('ORDER_COMPLETE');a.settlementJournal=a.journal.snapshot();try{fills=this.acceptPickup(a,p,commodity,a.order?.commodity===commodity?a.order.quantity:quantity);}catch{return fail('SETTLEMENT_FAILED');}if(!fills.length)return fail('NO_CAPACITY_OR_FUNDS');this.lockPickup(a,p,commodity,fills);}
  const moved=this.handle(a,'PICKUP',Math.floor(quantity));return {ok:true,value:{units_transacted:moved,accepted_units:fills.reduce((n,v)=>n+v.units_transacted,0),total_gold_cost:fills.reduce((n,v)=>n+v.total_gold_cost,0)}};
 }
 lockPickup(a,p,c,fills){const quantity=fills.reduce((n,v)=>n+v.units_transacted,0),gold=fills.reduce((n,v)=>n+v.total_gold_cost,0);a.pickupAccepted=true;a.purchaseOrder=a.order;a.purchaseQuote=Object.freeze({port_id:p.id,commodity_id:c,quantity,unit_price:quantity?gold/quantity:0,market_price:quantity?gold/quantity:0,tax_rate:0,transfer_ids:Object.freeze(fills.map(v=>v.transferId))});a.journal.lock({...a.purchaseQuote,tick:this.currentTick,plannedBuyPrice:a.order?.buyPrice??null,plannedProfit:a.order?.profit??null});}
 receiveCargo(id,item){const a=this.state(id);if(item.quantity>a.capacity-this.economy.getShipOccupiedQuantity(id))throw RangeError('Cargo capacity exceeded');this.economy.receiveExternalCargo(id,item);a.manifest=this.economy.getShipCargo(id);}
 dumpCargo(id,commodity,quantity){const a=this.state(id),before=a.journal.snapshot();const loss=this.economy.dumpShipCargo(id,commodity,quantity,{effects:{apply:v=>a.journal.loss(commodity,v.quantity,v.acquisitionCost,this.currentTick),rollback:()=>Object.assign(a.journal,before)}});a.manifest=this.economy.getShipCargo(id);return loss;}
 sellCargo(a,p,c,q){let fills;try{fills=this.acceptDelivery(a,p,c,q,`manual:${a.id}:${a.manualSaleSerial=(a.manualSaleSerial??0)+1}`);}catch{return fail('SETTLEMENT_FAILED');}if(!fills.length)return fail('NO_FUNDED_DEMAND');this.handle(a,'DELIVERY',q);return {ok:true,value:{units_transacted:fills.reduce((n,v)=>n+v.units_transacted,0),total_gold_cost:fills.reduce((n,v)=>n+v.total_gold_cost,0)}};}

 canVisit(a,p){return !!p&&this.dockTraffic.canDock(p.id,a.ship.spec)&&this.diplomacy.canEnter(a.faction,p.owner_faction)&&(!a.role.militaryOnly||p.id===a.homePort||a.origin===a.homePort&&this.diplomacy.isFriendly(a.faction,p.owner_faction));}
 orderVisit(id,portId){const a=this.state(id),p=this.ports.get(portId);if(this.economy.getPendingTransfers(a.id).length||!this.canVisit(a,p)||a.planning)return false;this.schedule(a,this.visit(a,p),{kind:'visit',portId:p.id});return true;}
 patrol(a){if(a.planning)return;this.schedule(a,this.patrolVisit(a),{kind:'patrol'});}
 *patrolVisit(a){
  const home=this.ports.get(a.homePort);if(!home)return;
  const allies=a.origin!==a.homePort?[home]:[...this.ports.values()].filter(p=>p.id!==a.homePort&&this.canVisit(a,p)).sort((x,y)=>distance(home.position,x.position)-distance(home.position,y.position));
  // Try other allied ports when a destination cannot be reached by this hull.
  for(let i=0;i<allies.length;i++){const p=allies[(a.patrolIndex+i)%allies.length];if(yield* this.visit(a,p)){if(a.origin===a.homePort)a.patrolIndex=(a.patrolIndex+i+1)%allies.length;return;}}
 }
 visitApproach(a,p){
  const dockApproach=this.dockTraffic.approach(p.id,a.ship.spec);if(!dockApproach)return null;
  if(this.dockTraffic.plannedDock(p.id,a.ship.spec)?.endMooring)return dockApproach;
  const base=dockApproach;if(!a.role.militaryOnly)return base;
  a.patrolApproaches??=new Map();if(a.patrolApproaches.has(p.id))return a.patrolApproaches.get(p.id);
  // Merchant-sized harbor approaches can be too tight for a warship to turn.
  let approach=null;for(let radius=0;radius<=12&&!approach;radius++)for(let i=0;i<(radius?24:1);i++){
   const angle=i*Math.PI/12,point={x:base.x+Math.cos(angle)*radius,y:base.y+Math.sin(angle)*radius};
   if(Array.from({length:8},(_,h)=>safePose(this.world,{...point,heading:h*Math.PI/4},a.ship.spec)).every(Boolean)){approach=point;break;}
  }if(approach)a.patrolApproaches.set(p.id,approach);return approach;
 }
 *voyageRoute(a,p,approach,routeWind){
  this.voyageRoutes??=new Map();const nav=this.navigators.get(a.faction),key=`${a.faction}:${a.vesselClass}:${a.origin}:${p.id}`,eye=windEye(routeWind);let entry=this.voyageRoutes.get(key);
  if(entry&&!entry.pending&&(entry.threatVersion!==this.threatGrid.version||entry.diplomacyVersion!==this.diplomacy.version)){const hotspots=this.threatGrid.corridorHotspots(a.ship,entry.path,a.faction,this.diplomacy,this.threatThreshold);if([...hotspots].some(id=>!entry.hotspots.has(id)))entry=null;else{entry.threatVersion=this.threatGrid.version;entry.diplomacyVersion=this.diplomacy.version;}if(!entry)this.voyageRoutes.delete(key);}
  if(entry&&(Math.abs(angleDifference(entry.eye,eye))>Math.PI/18||this.time-entry.at>this.scaling.expectedTransitTicks||entry.pending&&(!this.agents.has(entry.owner)||this.agents.get(entry.owner).planNonce!==entry.ownerNonce))){this.voyageRoutes.delete(key);entry=null;}
  if(!entry){
   // Bound route storage without discarding searches that another ship awaits.
   if(this.voyageRoutes.size>=512)for(const [id,cached] of this.voyageRoutes){if(!cached.pending)this.voyageRoutes.delete(id);if(this.voyageRoutes.size<512)break;}
   entry={eye,at:this.time,owner:a.id,ownerNonce:a.planNonce,pending:true,path:[],hotspots:new Set(),threatVersion:this.threatGrid.version,diplomacyVersion:this.diplomacy.version};this.voyageRoutes.set(key,entry);
   let completed=false;try{entry.path=yield* nav.routeTask({x:a.ship.x,y:a.ship.y},approach,a.sailingSpec,routeWind,null,{allowShallows:true,includeTacks:false,maxNodes:a.role.militaryOnly?Math.max(nav.maxNodes,this.world.n*this.world.n):4096});completed=true;}finally{entry.pending=false;entry.cancelled=!completed;if(!completed&&this.voyageRoutes.get(key)===entry)this.voyageRoutes.delete(key);entry.hotspots=this.threatGrid.corridorHotspots(a.ship,entry.path,a.faction,this.diplomacy,this.threatThreshold);}
  }else while(entry.pending){const owner=this.agents.get(entry.owner);if(!owner||owner.planNonce!==entry.ownerNonce){if(this.voyageRoutes.get(key)===entry)this.voyageRoutes.delete(key);if(this.agents.get(a.id)?.planNonce!==a.planNonce)return [];return yield* this.voyageRoute(a,p,approach,routeWind);}yield;}
  if(entry.cancelled){if(this.agents.get(a.id)?.planNonce!==a.planNonce)return [];return yield* this.voyageRoute(a,p,approach,routeWind);}
  if(!entry.path.length)return [];
  // Each vessel joins the shared corridor from its own position with a clear hull sweep.
  const first=entry.path.findIndex(q=>nav.clearSegment(a.ship,q,a.sailingSpec));
  if(first>=0)return entry.path.slice(first).map(q=>({...q}));
  const join=yield* nav.routeTask({x:a.ship.x,y:a.ship.y},entry.path[0],a.sailingSpec,routeWind,null,{allowShallows:true,includeTacks:false});
  return join.length?[...join,...entry.path.slice(1).map(q=>({...q}))]:[];
 }
 *visit(a,p){if(this.economy.getPendingTransfers(a.id).length||!this.canVisit(a,p))return false;const approach=this.visitApproach(a,p);if(!approach)return false;const routeWind={...this.wind},routeEye=windEye(routeWind);
  // Water is traversable at every depth. Keep full hull dimensions for land clearance.
  const path=yield* this.voyageRoute(a,p,approach,routeWind);if(!path.length||this.economy.getPendingTransfers(a.id).length||!this.canVisit(a,p))return false;a.turnaround=null;path.push({...this.dockTraffic.destination(p.id,a.ship.spec)});a.journal.begin(a.origin,p.id,this.currentTick,a.maintenancePaid);a.target=p.id;a.path=path;a.destinationApproach=approach;this.recordRoute(a,routeEye);a.order={destination:p.id,path,exploration:true,createdTick:this.currentTick,deadlineTick:this.scaling.contractDeadline(this.currentTick,this.ports.get(a.origin)??{position:a.ship},p)};a.waitingOrders=false;
  if(a.docked)this.depart(a,this.ports.get(a.origin));else{this.dockTraffic.release(a.id);a.motion=null;a.state='IN_TRANSIT';a.helmsman.reset();a.arrival.reset(a.ship);}return true;
 }
 queueReview(a){if(a.role.militaryOnly||a.waitingOrders||a.state!=='AT_ANCHOR'||!a.order||a.planning||this.time<a.reviewAt)return;a.reviewAt=this.time+this.queueReviewSeconds;const p=this.ports.get(a.dockPort),origin=this.ports.get(a.order.origin??a.origin);if(!p||!origin)return;const r=a.order.exploration?null:this.evaluate(a,origin,this.ports.get(a.order.destination),a.order.commodity,a.order.path,[...a.manifest.values()][0]?.quantity??a.order.quantity);if(!r||r.profit<this.minProfit){a.abortReason='Ledger profit below threshold';this.dockTraffic.release(a.id);a.state='REROUTING';this.schedule(a,this.plan(a,{exclude:a.dockPort,reroute:true}),{kind:'trade',options:{exclude:a.dockPort,reroute:true}});}}
 requestRecovery(id){const a=this.state(id);if(a.docked||a.state==='AT_ANCHOR'||a.motion||Math.hypot(this.wind.x,this.wind.y)<.025)return false;const motion=recoveryMotion(this.world,a.ship);if(!motion)return false;a.resume=a.state;a.motion=motion;a.state='RECOVERING';a.stalled=0;return true;}
 bridgeTick(){this.currentTick++;this.dockTraffic.advanceTick(this.currentTick);this.industryInvestment.tick(this.currentTick);this.infrastructureGovernor.tick(this.currentTick);this.urbanExpansion.tick(this.currentTick);const emitters=[...this.agents.values()].map(a=>({id:a.id,x:a.ship.x,y:a.ship.y,faction:a.faction,vesselClass:a.vesselClass,active:a.active}));for(const p of this.externalVessels)emitters.push({id:p.id??'player',x:p.x,y:p.y,faction:p.faction??'ENGLAND',vesselClass:Object.keys(types).find(k=>types[k]===p.type),active:true});this.threatGrid.tick(emitters);
  for(const ledger of this.portLedgers.values())ledger.prune(this.currentTick);this.playerLedger.prune(this.currentTick);
  for(const a of this.agents.values()){a.PriceLedger.prune(this.currentTick);a.manifest=this.economy.getShipCargo(a.id);this.queueReview(a);}
 }
 tick(dt=this.compiledSettings.clock.physicsTickSeconds){if(!Number.isFinite(dt)||dt<=0||dt>1)throw RangeError('Bridge dt');this.time+=dt;this.economy.advanceIndustryProduction(dt);this.industryConstruction.tick(dt);this.economy.advanceIndustryProcurement(dt);this.bridgeTime+=dt;while(this.bridgeTime>=1-1e-9){this.bridgeTime=Math.max(0,this.bridgeTime-1);this.bridgeTick();}this.dockTraffic.update();const deadline=performance.now()+this.planningBudgetMs;
  while(this.jobs.length&&performance.now()<deadline){this.militaryPlanTurn=!this.militaryPlanTurn;const j=this.jobs.take(this.militaryPlanTurn);j.running=true;if(!this.agents.has(j.a.id)||j.nonce!==j.a.planNonce||j.configurationRevision!==this.configurationRevision){if(j.nonce===j.a.planNonce)j.a.planning=false;try{j.task.return?.();}catch{}continue;}try{const r=j.task.next();if(r.done)j.a.planning=false;else this.jobs.push(j);}catch(error){j.a.planning=false;j.a.planningError=String(error.message??error);j.a.abortReason='Planning failed: '+j.a.planningError;if(j.intent?.kind==='turnaround'&&j.a.turnaround){j.a.turnaround.ready=true;j.a.turnaround.selection=null;}}}
  const traffic=new TrafficIndex([...this.agents.values()].map(a=>({x:a.ship.x,y:a.ship.y,vx:a.ship.vx,vy:a.ship.vy,speed:a.ship.speed,heading:a.ship.heading,spec:a.ship.spec,id:a.id,stationary:a.docked||a.state==='AT_ANCHOR',assisted:!!a.motion})).concat(this.externalVessels));
  for(const a of this.agents.values()){
   const s=a.ship,p=this.ports.get(a.dockPort);if(a.docked&&p)this.sync(a,p);advanceProvisions(this,a,dt);if(a.waterStop&&!this.diplomacy.isFriendly(a.faction,this.ports.get(a.waterStop.portId)?.owner_faction)){const saved=a.waterStop;a.waterStop=null;a.order=saved.order;a.target=saved.target;a.origin=saved.origin;a.path=saved.order?.path??a.path;a.state='IN_TRANSIT';a.motion=null;this.dockTraffic.release(a.id);this.cancelPlanning(a);this.schedule(a,this.waterRoute(a),{kind:'water'});}if(waterReviewDue(this,a)&&!a.waterStop){this.cancelPlanning(a);a.waterPlanning=true;this.schedule(a,this.waterRoute(a),{kind:'water'});}if(a.waterStop&&a.state==='AT_ANCHOR'){this.accrueRunningCosts(a,dt);if(a.water>=a.waterCapacity-1e-8&&!a.planning&&this.time>=a.waterRetryAt)this.schedule(a,this.waterResume(a),{kind:'water-resume'});continue;}
   if(a.role.militaryOnly&&a.target&&a.target!==a.homePort&&!this.diplomacy.isFriendly(a.faction,this.ports.get(a.target)?.owner_faction)&&!a.planning)this.orderVisit(a.id,a.homePort);
   if(a.state==='REROUTING'&&a.docked&&a.path.length&&p)this.depart(a,p);
   if(a.state==='IDLE_AT_PORT'&&p)this.anchor(a,p);
   if(a.autoPatrol&&a.state==='AT_ANCHOR'&&a.waitingOrders&&!a.planning&&this.time>=a.scanAt){this.patrol(a);a.scanAt=this.time+this.scaling.jobReviewTicks*2;}
   if(a.autoTrade&&a.state==='AT_ANCHOR'&&a.waitingOrders&&this.time>=a.scanAt&&!a.planning){this.schedule(a,this.plan(a),{kind:'trade'});a.scanAt=this.time+this.scaling.jobReviewTicks+(Number(a.id.split('-').at(-1))%7)*.2;}
   if(a.state==='AT_ANCHOR'&&!a.waitingOrders){const r=this.dockTraffic.get(a.id);if(r?.berth&&p)this.requestDock(a,p,a.service);}
   if(a.state==='LOADING_CARGO'&&a.order&&p){
    if(a.purchaseOrder!==a.order){a.pickupAccepted=false;a.loadingProgress=0;a.loaded=0;}a.loadingProgress??=0;a.loaded??=0;
    if(!a.pickupAccepted){a.settlementJournal=a.journal.snapshot();const fills=this.acceptPickup(a,p,a.order.commodity,a.order.quantity);this.lockPickup(a,p,a.order.commodity,fills);a.order.quantity=fills.reduce((n,v)=>n+v.units_transacted,0);a.loadingProgress=0;a.loaded=0;}
    a.loadingProgress+=this.cargoHandlingRate*dt;const moved=this.handle(a,'PICKUP',Math.floor(a.loadingProgress+1e-9),{updateSequence:Math.round(this.time*1e6)});a.loaded+=moved;a.loadingProgress=Math.max(0,a.loadingProgress-moved);
    if(!this.economy.getPendingTransfers(a.id,'PICKUP').length){if(a.manifest.size)this.depart(a,p);else{a.order=null;a.waitingOrders=true;if(!this.anchor(a,p))a.state='IDLE_AT_PORT';}}
   }
   if(a.state==='UNLOADING_CARGO'&&p){
    if(!a.deliveryAccepted){for(const [c,item] of [...a.manifest])this.acceptDelivery(a,p,c,item.quantity);a.deliveryAccepted=true;}
    if(a.autoTrade){this.beginTurnaround(a,p);if(!a.turnaround.ready&&!a.planning)this.schedule(a,this.planTurnaround(a,p),{kind:'turnaround',portId:p.id});}
    this.handle(a,'DELIVERY',this.cargoHandlingRate*dt,{updateSequence:Math.round(this.time*1e6)});
    if(!this.economy.getPendingTransfers(a.id,'DELIVERY').length){const pending=a.turnaround;if(pending&&!pending.ready){pending.emptySince??=this.time;if(this.time-pending.emptySince>=this.compiledSettings.merchant.turnaroundWaitSeconds){this.cancelPlanning(a);pending.ready=true;pending.selection=null;a.abortReason='Turnaround planning timed out after unloading';}}if(!pending||pending.ready)this.finishTurnaround(a,p);}
   }
   if(a.retireRequested&&!this.economy.getPendingTransfers(a.id).length){this.removeVessel(a.id);continue;}
   const count=Math.ceil(dt*60);for(let i=0;i<count;i++){const step=dt/count;this.accrueRunningCosts(a,step);
    if(a.motion){if(a.state==='APPROACHING'&&distance(s,a.motion.target)<Math.max(2,s.spec.length))a.state='DOCKING';if(safeGuidedStep(s,a.motion,step,this.world,a.helmsman.safety,a.state,()=>this.redirectDock(a))){const old=a.state;if(old==='DOCKING'||old==='APPROACHING')a.runningCosts.dock(a.dockPort);a.motion=null;if(old==='ANCHORING'){a.state='AT_ANCHOR';if(a.waitingOrders)this.dockTraffic.mark(a.id,'ANCHORED');if(a.waterStop){const stops=a.journal.current?.waterStops;if(stops?.length)stops.at(-1).arrivalTick=this.currentTick;}}else if(old==='DOCKING'||old==='APPROACHING'){a.docked=true;this.economy.setShipDocked(a.id,a.dockPort);a.pickupAccepted=false;a.deliveryAccepted=false;a.origin=a.dockPort;a.queueSince=null;this.dockTraffic.mark(a.id,'MOORED');this.sync(a,p);a.state=a.service==='LOAD'?'LOADING_CARGO':a.manifest.size||a.autoTrade?'UNLOADING_CARGO':'IDLE_AT_PORT';if(a.state==='UNLOADING_CARGO'){for(const [c,item] of [...a.manifest])this.acceptDelivery(a,p,c,item.quantity);a.deliveryAccepted=true;if(a.autoTrade)this.beginTurnaround(a,p);}if(a.state==='IDLE_AT_PORT'){a.journal.complete(p.id,this.currentTick,a.maintenancePaid);this.anchor(a,p);}}else{this.dockTraffic.release(a.id);a.state=old==='RECOVERING'?a.resume:'IN_TRANSIT';if(a.state==='IN_TRANSIT')s.canvas=1;a.arrival.reset(s);if(old==='RECOVERING'&&this.ports.has(a.target))this.schedule(a,this.replan(a,this.ports.get(a.target)),{kind:'replan',portId:a.target});}}continue;}
    if(a.state!=='IN_TRANSIT'||!a.path.length)continue;const nav=this.navigators.get(a.faction),spec=a.sailingSpec,wind=localWindAt(this.windField,s.x,s.y,this.wind);a.arrival.advance(s,a.path,nav,spec,a.helmsman.committed,wind);const goal=a.path[0],leg=a.helmsman.plan?.points[a.helmsman.plan.index],reference=a.helmsman.committed?a.helmsman.commitHeading:headingTo(s,leg??goal);
    if(this.time>=(a.safetyAt??0)){a.safetyAt=this.time+.2;a.avoidance=avoidTraffic({x:s.x,y:s.y,vx:s.vx,vy:s.vy,speed:s.speed,heading:s.heading,spec:s.spec,id:a.id},reference,wind,traffic,nav);}
    const giveWay=!!a.avoidance?.giveWay&&!a.helmsman.committed,range=Math.max(8,s.speed*10),steeringGoal=giveWay?{x:s.x+Math.sin(a.avoidance.heading)*range,y:s.y-Math.cos(a.avoidance.heading)*range}:goal,helm=a.helmsman.update(s,steeringGoal,wind,nav,this.time,spec),preserveCanvas=a.helmsman.committed||helm.phase==='PREPARING'||helm.phase==='RECOVERING';a.givingWay=giveWay&&!helm.safety;s.canvas=helm.safety||preserveCanvas?helm.sail:Math.min(helm.sail,giveWay?a.avoidance.sail:1);a.helmsman.safety.step(s,step,helm.safety?Math.sign(angleDifference(helm.heading,s.heading)):helmRudder(s,helm.heading),wind,this.world,helm);
   }
   if(a.state==='IN_TRANSIT'){const target=this.ports.get(a.target);if(target&&a.role.canTrade&&!this.diplomacy.canTrade(a.faction,target.owner_faction)){a.state='REROUTING';this.schedule(a,this.plan(a,{exclude:target.id,reroute:true}),{kind:'trade',options:{exclude:target.id,reroute:true}});continue;}if(target&&a.waterStop&&!a.waterStop.anchored&&cellDistance(s,a.destinationApproach)<=2){const r=this.dockTraffic.standby(a.id,target.id,s.spec),motion=r?.anchor?guidedPath(this.world,s,r.anchor,{turnClearance:largeVessel(s.spec)}):null;if(motion){a.waterStop.anchored=true;a.dockPort=target.id;a.motion=motion;a.state='ANCHORING';a.waitingOrders=true;a.ship.canvas=0;}continue;}if(target&&!a.waterStop&&(cellDistance(s,a.destinationApproach??target.approach_position??target.position)<=2||distance(s,target.position)<4)){this.requestDock(a,target,'UNLOAD');continue;}const cell=worldToAxial(s.x,s.y);if(hexDistance(cell,a.lastCell)>0){a.stalled=0;a.lastCell=cell;}else if(Math.hypot(this.wind.x,this.wind.y)>=.025)a.stalled+=dt;if(a.stalled>this.scaling.expectedTransitTicks*.2)this.requestRecovery(a.id);
    if(target){if(a.threatCheckVersion!==this.threatGrid.version||a.threatCheckDiplomacy!==this.diplomacy.version){a.hotspots=this.threatGrid.corridorHotspots(s,a.path,a.faction,this.diplomacy,this.threatThreshold);a.threatCheckVersion=this.threatGrid.version;a.threatCheckDiplomacy=this.diplomacy.version;}const environmentReason=a.replanMonitor.update(this.wind,this.time,a.hotspots),reason=a.helmsman.needsRoute?'LAND_BLOCKED':environmentReason;if(reason&&!a.planning&&this.time>=(a.routeRetryAt??0)){a.replanReason=reason;a.helmsman.safety.telemetry.routeReplans++;this.schedule(a,this.replan(a,target),{kind:'replan',portId:target.id});}}
   }
  }
 }
 recordRoute(a,eye){a.helmsman.safety.replan=false;a.routeConfigurationRevision=this.configurationRevision;a.plannedWind=eye;a.hotspots=this.threatGrid.corridorHotspots(a.ship,a.path,a.faction,this.diplomacy,this.threatThreshold);a.replanMonitor.reset(eye,a.hotspots);a.threatCheckVersion=this.threatGrid.version;a.threatCheckDiplomacy=this.diplomacy.version;}
 *replan(a,p){const routeWind={...this.wind},routeEye=windEye(routeWind),nav=this.navigators.get(a.faction),start={x:a.ship.x,y:a.ship.y};const path=yield* nav.routeTask(start,a.destinationApproach??p.approach_position??p.position,a.role.militaryOnly?a.sailingSpec:a.ship.spec,routeWind,null,{allowShallows:true,includeTacks:false});if(path.length&&a.target===p.id&&a.state==='IN_TRANSIT'&&nav.clearSegment(a.ship,path[0],a.sailingSpec)){if(!a.waterStop)path.push({...this.dockTraffic.destination(p.id,a.ship.spec)});a.path=path;if(a.order&&!a.waterStop)a.order.path=path;a.arrival.reset(a.ship);this.recordRoute(a,routeEye);a.routeRetryAt=0;a.helmsman.invalidate();}else a.routeRetryAt=this.time+1;}
}
