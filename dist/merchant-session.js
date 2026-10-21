import {settingsForWorld,DEFAULT_SUBSYSTEM_SETTINGS} from './compiled-configuration.js?v=babbc3d3950e';
import {ThreatGrid} from './threat-grid.js?v=babbc3d3950e';
import {factionRegistry} from './simulation-registry.js?v=babbc3d3950e';
import {vesselRegistry} from './simulation-registry.js?v=babbc3d3950e';
import {safePose} from './navigation-safety.js?v=babbc3d3950e';
import {LogisticsEngine,VesselClass} from './logistics.js?v=babbc3d3950e';
import {findShipSpawn,hullDepth,SHIP_TYPES} from './ships.js?v=babbc3d3950e';
import {dockBerth} from './docking.js?v=babbc3d3950e';
import {dockExit,hexDockingSlots} from './dock-traffic.js?v=babbc3d3950e';
import {createPortEconomy} from './port-supplies.js?v=babbc3d3950e';
import {BridgeLogistics} from './bridge-logistics.js?v=babbc3d3950e';
const factions=Object.fromEntries(factionRegistry.values().map(f=>[f.id,f.runtime_id]));
const classes=[VesselClass.SLOOP,VesselClass.SCHOONER,VesselClass.BRIGANTINE,VesselClass.FLUYT];
const types=['sloop','schooner','brigantine','fluyt'];
const allTypes=Object.fromEntries(vesselRegistry.values().map(v=>[v.id,v.type]));
// Spawn-only allocation: fill underused faction ports, then maximize geographic spread.
function distributedPorts(ports,ships,balanceFactions=false){
 const byId=new Map(ports.map(p=>[p.id,p])),portCounts=new Map(),factionCounts=new Map(),anchors=[];
 for(const ship of ships){const home=byId.get(ship.registrationPortId);if(!home)continue;portCounts.set(home.id,(portCounts.get(home.id)??0)+1);factionCounts.set(home.owner_faction,(factionCounts.get(home.owner_faction)??0)+1);anchors.push(home.position);}
 const separation=p=>anchors.length?Math.min(...anchors.map(a=>Math.hypot(a.x-p.position.x,a.y-p.position.y))):0;
 return [...ports].sort((a,b)=>(balanceFactions?(factionCounts.get(a.owner_faction)??0)-(factionCounts.get(b.owner_faction)??0):0)||(portCounts.get(a.id)??0)-(portCounts.get(b.id)??0)||separation(b)-separation(a));
}
export const MAX_TEST_MERCHANTS=DEFAULT_SUBSYSTEM_SETTINGS.fleet.maxMerchants;
export const PATROL_QUOTAS=DEFAULT_SUBSYSTEM_SETTINGS.fleet.patrolQuotas;
export function spawnMilitaryPatrols(session){
 if(!session.logistics?.diplomacy)return 0;session.militaryIds??=[];const e=session.logistics;
 for(const faction of Object.values(factions)){
  const nearestAlly=home=>Math.min(...session.ports.filter(p=>p.id!==home.id&&e.diplomacy.isFriendly(faction,p.owner_faction)).map(p=>Math.hypot(p.position.x-home.position.x,p.position.y-home.position.y)));
  const edgeMargin=p=>Math.min(p.position.x,p.position.y,session.world.bounds.width-p.position.x,session.world.bounds.height-p.position.y);
  const homes=session.ports.filter(p=>p.owner_faction===faction).sort((a,b)=>nearestAlly(a)-nearestAlly(b)||edgeMargin(b)-edgeMargin(a));
  const merchants=session.ids.filter(id=>e.state(id).faction===faction).length;
  for(const {vesselClass:cls,per} of (session.settings??settingsForWorld(session.world)).fleet.patrolQuotas){
   const wanted=session.ids.length&&homes.length?Math.max(cls==='FRIGATE'?1:0,Math.floor(merchants/per)):0;
   const current=session.militaryIds.filter(id=>{const a=e.state(id);return a.faction===faction&&a.vesselClass===cls;});
   while(current.length>wanted){const id=current.pop();e.removeVessel(id);session.militaryIds.splice(session.militaryIds.indexOf(id),1);}
   while(current.length<wanted){let launched=false;const snapshots=merchantSnapshots(session),distributed=distributedPorts(homes,snapshots.filter(s=>s.military)),occupied=[...snapshots,...e.externalVessels];
    for(const home of distributed){const type=allTypes[cls],heading=Math.atan2(e.wind.x,-e.wind.y)+Math.PI/2,spec=SHIP_TYPES[type];if(e.dockTraffic&&!e.dockTraffic.canDock(home.id,spec))continue;let spawn=null;
     for(let radius=0;radius<=36&&!spawn;radius++)for(let j=0;j<24;j++){const angle=j*Math.PI/12,p={x:home.approach_position.x+Math.cos(angle)*radius,y:home.approach_position.y+Math.sin(angle)*radius};if(hullDepth(session.world,p.x,p.y,heading,spec)>=spec.draft&&Array.from({length:8},(_,h)=>safePose(session.world,{...p,heading:h*Math.PI/4},spec)).every(Boolean)&&!occupied.some(a=>Math.hypot(a.x-p.x,a.y-p.y)<4)){spawn=p;break;}}
     if(!spawn)continue;if(!session.economy.accounts.initializing&&session.economy.getPortTreasury(home.id).spendable<e.defaults.wallet_gold)continue;const a=e.spawnVessel(faction,cls,spawn,{heading,home_port_id:home.id,auto_patrol:true});session.militaryIds.push(a.vessel_id);current.push(a.vessel_id);launched=true;break;
    }if(!launched)break;
   }
  }
 }return session.militaryIds.length;
}
export function setMerchantDensity(session,count){
 if(!Number.isInteger(count)||count<0||count>(session.settings??settingsForWorld(session.world)).fleet.maxMerchants)throw new RangeError('Traffic density exceeds the configured merchant limit');
 if(!session.logistics)return 0;
 for(const id of [...session.ids].reverse()){if(session.ids.length<=count)break;if(session.logistics.removeVessel(id)!==false)session.ids.splice(session.ids.indexOf(id),1);}
 const eligible=session.ports.filter(a=>session.ports.some(b=>b.id!==a.id&&TEST_TRADE_POLICY.canTrade(a.owner_faction,b.owner_faction))),heading=Math.atan2(session.logistics.wind.x,-session.logistics.wind.y)+Math.PI/2;
 if(!eligible.length){spawnMilitaryPatrols(session);return session.ids.length;}
 let attempts=0;
 while(session.ids.length<count&&attempts++<count*3){
  const i=session.spawnIndex++,type=types[i%types.length],spec=SHIP_TYPES[type],snapshots=merchantSnapshots(session),existing=[...snapshots,...session.logistics.externalVessels],candidates=distributedPorts(eligible,snapshots.filter(s=>!s.military),true);let spawn=null,p=null;
  for(const candidate of candidates){if(!session.economy.accounts.initializing&&session.economy.getPortTreasury(candidate.id).spendable<session.logistics.defaults.wallet_gold)continue;if(session.logistics.dockTraffic&&!session.logistics.dockTraffic.canDock(candidate.id,spec))continue;p=candidate;
   for(let radius=0;radius<=24&&!spawn;radius++)for(let j=0;j<(radius?24:1);j++){
    const angle=-Math.PI/2+j*Math.PI/12,point={x:p.approach_position.x+Math.sin(angle)*radius,y:p.approach_position.y-Math.cos(angle)*radius};
    if(hullDepth(session.world,point.x,point.y,heading,spec)<spec.draft||!safePose(session.world,{...point,heading},spec)||existing.some(a=>Math.hypot(a.x-point.x,a.y-point.y)<(a.id==='player'?Math.max(2,(spec.length+a.spec.length)*.7):4)))continue;spawn=point;break;
   }
   if(spawn)break;
  }
  if(!spawn)continue;if(!session.economy.accounts.initializing&&session.economy.getPortTreasury(p.id).spendable<session.logistics.defaults.wallet_gold)continue;const a=session.logistics.spawnVessel(p.owner_faction,classes[i%classes.length],spawn,{heading,home_port_id:p.id,preferred_voyage_distance:i%3===2?Math.hypot(session.world.bounds.width,session.world.bounds.height)*.25:0});session.ids.push(a.vessel_id);
 }
 session.note=session.ids.length>count?'Fleet reduction is waiting for paid cargo handling to finish.':session.ids.length<count?'Only '+session.ids.length+' ships could find safe launch water and funded capital.':session.ids.length?'':'Merchant traffic paused at zero density.';spawnMilitaryPatrols(session);return session.ids.length;
}
// Explicit workshop rules, not a replacement for the future faction engine.
export const TEST_TRADE_POLICY=Object.freeze({
 canTrade:(a,b)=>a===b||(a!=='PIRATES'&&b!=='PIRATES'),
 canEnter:(a,b)=>a===b||(a!=='PIRATES'&&b!=='PIRATES'),
 isHostile:(a,b)=>a!==b&&(a==='PIRATES'||b==='PIRATES'),
 isFriendly:(a,b)=>a===b
});
export function createMerchantSession(world,wind,field,basePortId,{settings=settingsForWorld(world),bridge=false,maxShips=6,maxPorts=bridge?world.ports.length:24,planningBudgetMs=4,player=null}={}){
 const base=world.ports.find(p=>p.id===basePortId)??world.ports[0];
 if(!base)return {economy:null,logistics:null,ids:[],ports:[],world,note:'Merchant traffic needs at least two trading ports.'};
 const heading=Math.atan2(wind.x,-wind.y)+Math.PI/2;
 // Farthest-first selection covers the whole archipelago, including the base.
 const remaining=[...world.ports],ports=[],deepCounts=new Map(),capitalPorts=new Set(bridge?world.ports.filter(p=>p.docks?.some(d=>d.dockTypeId==='deep_water_quay'&&hexDockingSlots(world,d,SHIP_TYPES.man_of_war).some(slot=>slot.safe))).map(p=>p.id):[]);
 while(remaining.length&&ports.length<maxPorts){
  const anchors=ports.length?ports.map(p=>p.position):[base.dockPosition];
  remaining.sort((a,b)=>{const needed=p=>capitalPorts.has(p.id)&&(deepCounts.get(p.faction)??0)<2;if(needed(a)!==needed(b))return Number(needed(b))-Number(needed(a));const separation=p=>Math.min(...anchors.map(q=>Math.hypot(p.dockPosition.x-q.x,p.dockPosition.y-q.y)));return ports.length?separation(b)-separation(a):separation(a)-separation(b);});
  const port=remaining.shift();
  const faction=factions[port.faction];if(!faction)continue;
  const berth=findShipSpawn(world,port.dockPosition,heading,'fluyt');
  if(!berth||hullDepth(world,berth.x,berth.y,heading,SHIP_TYPES.fluyt)<SHIP_TYPES.fluyt.draft)continue;
  const alongside=dockBerth(world,port,SHIP_TYPES.fluyt);if(!alongside)continue;
  // A coastal dock may face outside the map. Do not assign ships to a trapped home.
  const exit=dockExit({...port,position:port.dockPosition,berth:alongside});
  if(!exit||!Array.from({length:8},(_,i)=>safePose(world,{...exit,heading:i*Math.PI/4},SHIP_TYPES.fluyt)).every(Boolean))continue;
  if(capitalPorts.has(port.id))deepCounts.set(port.faction,(deepCounts.get(port.faction)??0)+1);
  ports.push({id:port.id,name:port.name,position:{...port.dockPosition},approach_position:{x:berth.x,y:berth.y},berth:alongside,owner_faction:faction,island_id:port.id,black_market:faction==='PIRATES',source:port});
  if(ports.length>=maxPorts)break;
 }
 const economy=createPortEconomy(world);
 const Engine=bridge?BridgeLogistics:LogisticsEngine,logistics=new Engine({economy,world,ports,policy:TEST_TRADE_POLICY,wind,windField:field,
  settings,minProfit:settings.merchant.minimumProfit,cargoHandlingRate:settings.merchant.cargoHandlingRate,cargoTransferRate:settings.merchant.cargoHandlingRate,windPersistence:settings.navigation.windPersistence,threatThreshold:settings.navigation.threatThreshold,threatGrid:new ThreatGrid(settings.threat),
  defaults:{wallet_gold:settings.merchant.startingWallet,operational_range:Math.hypot(world.bounds.width,world.bounds.height),voyage_cost_per_unit:settings.merchant.distanceCost},scanInterval:15,navigation:{spacing:4,maxNodes:16000},planningBudgetMs});
 // Prepare the shared clearance field before the first moving snapshot.
 logistics.navigator.clearance(base.dockPosition);
 if(player&&SHIP_TYPES[player.type])logistics.setExternalVessels([{...player,id:'player',spec:SHIP_TYPES[player.type]}]);
 const eligible=ports.filter(a=>ports.some(b=>b.id!==a.id&&TEST_TRADE_POLICY.canTrade(a.owner_faction,b.owner_faction)));
 const session={settings,configurationRevision:settings.revision,economy,logistics,ids:[],militaryIds:[],ports,world,spawnIndex:0,note:eligible.length?'':'Merchant traffic needs two accessible ports that can trade.'};
 logistics.onDeferredRetirement=id=>{for(const list of [session.ids,session.militaryIds]){const index=list.indexOf(id);if(index>=0)list.splice(index,1);}};
 if(eligible.length)setMerchantDensity(session,Math.min(maxShips,settings.fleet.maxMerchants));economy.accounts.sealInitialization();economy.refreshFundedDemand();return session;
}
export function merchantSnapshots(session){
 if(!session.logistics)return [];
 return [...session.ids,...(session.militaryIds??[])].map(id=>{
  const a=session.logistics.getAgentState(id,{includeKnowledge:false}),type=allTypes[a.vessel_class],p=session.ports.find(p=>p.owner_faction===a.owner_faction);
  return {id,shipName:a.ship_name,captainName:a.captain_name,type,x:a.current_position.x,y:a.current_position.y,heading:a.current_heading,vx:a.velocity.x,vy:a.velocity.y,speed:a.current_speed,canvasStage:a.canvas_stage,dockId:a.dock_id,dockTypeId:a.dock_type_id,state:a.state,jobPurpose:a.job_purpose,
   waterStatus:a.water_status,morale:a.morale_percent,profit:a.realised_profit??0,profitPerHour:a.profit_per_hour??0,completedVoyages:a.completed_voyages??0,explorationPending:!!a.exploration_pending,explorationIntervalVoyages:a.exploration_interval_voyages,maxSpeed:SHIP_TYPES[type].maxSpeed,cargoCapacity:a.max_cargo_capacity,wallet:a.wallet_gold,military:!!a.military_only,faction:p?.source.faction,pennantColor:p?.source.pennantColor??'#d8e9dd',cargo:a.manifest.total_volume,unsoldCargo:a.manifest.inventory.unsold.reduce((n,r)=>n+r.quantity,0),paidDeliveryCargo:a.manifest.inventory.deliveries.reduce((n,t)=>n+t.remainingQuantity,0),paidPickupCargo:a.manifest.inventory.committedPickupQuantity,occupiedCargo:a.manifest.inventory.occupiedQuantity,cargoItems:[...a.manifest.items.values()],registrationPortId:a.registration_port_id,registrationPortName:session.ports.find(p=>p.id===a.registration_port_id)?.name??null,originPortId:a.origin_port_id,originPortName:session.ports.find(p=>p.id===a.origin_port_id)?.name??null,waypoints:a.planned_waypoints,target:a.target_port_id,targetName:session.ports.find(p=>p.id===a.target_port_id)?.name??null,docked:a.docked,stalledSeconds:a.stalled_seconds,berthSlot:a.berth_slot,queuePosition:a.queue_position,givingWay:a.giving_way,active:a.active};
 });
}
