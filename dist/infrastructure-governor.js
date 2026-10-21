import {settingsForWorld} from './compiled-configuration.js?v=babbc3d3950e';
import {dockExit} from './dock-traffic.js?v=babbc3d3950e';
import {dockRegistry,settlementRegistry} from './simulation-registry.js?v=babbc3d3950e';
import {dockCandidates,validateDockSite,compatibleDock} from './port-infrastructure.js?v=babbc3d3950e';
import {hexDistance} from './hex-topology.js?v=babbc3d3950e';
import {worldToAxial} from './world.js?v=babbc3d3950e';
import {hullDepth,SHIP_TYPES} from './ships.js?v=babbc3d3950e';
// Reviews are staggered and infrequent; no site scans occur during rendering or steering.
export class InfrastructureGovernor{
 constructor({world,economy,traffic,scaling,governors,secondsPerDay=settingsForWorld(world).clock.secondsPerDay}){Object.assign(this,{world,economy,traffic,scaling,governors,secondsPerDay});this.configurationRevision=settingsForWorld(world).revision;this.reviews=new Map();let index=0;const scale=scaling.metrics.averageTransitDistance?scaling.metrics.averageTransitDistance/scaling.settings.referenceDistance*scaling.settings.mapScaleFactor:1;this.scale=scale;
  for(const [portId,manager] of traffic.managers){const rules=settlementRegistry.get(manager.port.settlementType??'port').dock_growth;this.reviews.set(portId,{next:index++%Math.max(1,Math.ceil(rules.review_interval_ticks*scale)),paidAt:0,builtAt:-Infinity,configurationRevision:this.configurationRevision,timing:Object.freeze({review:Math.max(1,Math.ceil(rules.review_interval_ticks*scale)),sample:Math.ceil(rules.wait_sample_window_ticks*scale),wait:Math.ceil(rules.max_queue_wait_ticks*scale),cooldown:Math.ceil(rules.build_cooldown_ticks*scale)})});}
 }
 build(portId,type,{spec=null}={}){
  const manager=this.traffic.manager(portId);if(!manager)return {ok:false,reason:'UNKNOWN_PORT'};const port=manager.port,rules=settlementRegistry.get(port.settlementType??'port').dock_growth;
  if(manager.docks.length>=rules.max_docks)return {ok:false,reason:'DOCK_LIMIT'};
  for(const dock of dockCandidates(this.world,port,type,{ports:[...this.traffic.managers.values()].map(m=>m.port)})){
   // Growth must preserve every active departure/anchor passage, not just tile spacing.
   const newBerth=this.traffic.offer(portId,dock,spec??SHIP_TYPES.sloop);if(!newBerth)continue;
   if([...this.traffic.reservations.values()].some(r=>r.anchor&&['ANCHORED','QUEUED','RESERVED'].includes(r.status)&&hexDistance(dock.water,r.anchorCell??this.trafficCell(r.anchor))<2))continue;
   if(spec){const target=newBerth.endMooring?.berth??newBerth.slots[0],probe={...(newBerth.endMooring?.exit??dockExit(dock)),heading:target.heading,spec};if(hullDepth(this.world,target.x,target.y,target.heading,spec)<spec.draft||!this.traffic.navigator.clearSegment(probe,target,{...spec,draft:.001}))continue;}
   const validation=validateDockSite(this.world,port,dock.land,dock.water,type,{ports:[...this.traffic.managers.values()].map(m=>m.port)});if(!validation.ok)continue;
   const result=this.economy.purchaseInfrastructure(portId,dockRegistry.get(type).build_cost,{withdrawAutomaticOffers:true});if(!result.ok)return {ok:false,reason:result.error.code};
   this.traffic.addDock(portId,dock);this.reviews.get(portId).builtAt=this.traffic.tickNumber;return {ok:true,dock};
  }return {ok:false,reason:'NO_SAFE_CONNECTED_SITE'};
 }
 trafficCell(p){return worldToAxial(p.x,p.y);}
 tick(tick){
  for(const [portId,review] of this.reviews){if(tick<review.next)continue;const manager=this.traffic.manager(portId),port=manager.port,rules=settlementRegistry.get(port.settlementType??'port').dock_growth,interval=review.timing.review;review.next=tick+interval;
   const stats=this.traffic.queueStats(portId,review.timing.sample),governor=this.governors.get(portId);if(governor)governor.harbor={...stats,maxQueueWaitTicks:review.timing.wait};
   if(stats.averageWaitTicks<=review.timing.wait||tick-review.builtAt<review.timing.cooldown||manager.docks.length>=rules.max_docks)continue;
   const waiting=[...this.traffic.reservations.values()].filter(r=>r.portId===portId&&r.slot===null&&r.waiting).sort((a,b)=>a.sequence-b.sequence);if(!waiting.length)continue;
   const oldest=waiting[0],type=dockRegistry.values().find(d=>compatibleDock({dockTypeId:d.id},oldest.spec)&&d.max_simultaneous_ships>=(oldest.spec.berthsRequired??1));if(!type)continue;
   const result=this.build(portId,type.id,{spec:oldest.spec});if(governor)governor.lastDockExpansion={tick,ok:result.ok,reason:result.reason??'BUILT',dockId:result.dock?.id??null};
  }
 }
}
