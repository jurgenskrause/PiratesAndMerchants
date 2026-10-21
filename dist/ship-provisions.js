import {polarRouteEfficiency} from './hex-route.js?v=babbc3d3950e';
import {distance,windEye,headingTo,angleDifference} from './navigation.js?v=babbc3d3950e';
// Units are crew-seconds of drinking water. Class endurance scales with the
// generated world's reference voyage duration, independent of cargo capacity.
export function initializeProvisions(e,a,definition,options={}){
 a.waterCapacity=Math.max(1,definition.defaultCrew*e.scaling.expectedTransitTicks*definition.water_endurance_voyages);
 a.water=options.water_fraction===undefined?a.waterCapacity:a.waterCapacity*options.water_fraction;
 a.morale=options.morale_percent??100;
 if(!Number.isFinite(a.water)||a.water<0||a.water>a.waterCapacity||!Number.isFinite(a.morale)||a.morale<0||a.morale>100)throw RangeError('Ship provisions');
 a.waterReviewAt=0;a.waterRetryAt=0;a.waterStop=null;a.lastWaterPort=a.registration;a.lastWaterTarget=null;a.lastWaterVoyage=null;
}
export function advanceProvisions(e,a,dt){
 const port=e.ports.get(a.dockPort??a.origin),contact=a.docked||a.state==='AT_ANCHOR'&&e.dockTraffic.reservations.get(a.id)?.portId===port?.id;
 if(contact&&port&&e.time>=(a.anchorKnowledgeAt??0)){e.sync(a,port);a.anchorKnowledgeAt=e.time+1;}
 if(contact&&port&&e.diplomacy.isFriendly(a.faction,port.owner_faction)){
  a.water=Math.min(a.waterCapacity,a.water+a.waterCapacity/e.compiledSettings.provisions.refillSeconds*dt);
 }else a.water=Math.max(0,a.water-a.currentCrewCount*dt);
 // Morale is deliberately just stored data. No efficiency or movement effect.
}
// A long voyage is one whose remaining wind-adjusted route cannot be finished
// with a 25% reserve. This naturally accounts for wind, class and actual crew.
export function waterTravelSeconds(e,a,path,start=a.ship){
 const eye=windEye(e.wind),strength=Math.hypot(e.wind.x,e.wind.y);let seconds=0,previous=start;
 for(const point of path){const efficiency=polarRouteEfficiency(a.ship.spec,Math.abs(angleDifference(headingTo(previous,point),eye))),speed=Math.max(.1,a.ship.spec.maxSpeed*strength*efficiency*.85);seconds+=distance(previous,point)/speed;previous=point;}
 return seconds;
}
function routeProjection(start,points,point){
 let previous=start,total=0,best=null;
 for(const next of points??[]){
  if(!next||!Number.isFinite(next.x)||!Number.isFinite(next.y))continue;
  const dx=next.x-previous.x,dy=next.y-previous.y,length=Math.hypot(dx,dy);
  if(length<1e-8){previous=next;continue;}
  const t=Math.max(0,Math.min(1,((point.x-previous.x)*dx+(point.y-previous.y)*dy)/(length*length)));
  const closest={x:previous.x+dx*t,y:previous.y+dy*t},lateral=distance(point,closest),along=total+length*t;
  if(!best||lateral<best.lateral)best={lateral,along,total:total+length};
  total+=length;previous=next;
 }
 return best??{lateral:Infinity,along:0,total:0};
}
function remainingRoute(e,a,target){
 const route=(a.path??[]).filter(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y));
 if(route.length)return route;
 const goal=e.ports.get(target)?.position;return goal?[goal]:[];
}
function forwardStop(e,a,p,target){
 const goal=e.ports.get(target)?.position;if(!goal||p.id===target)return false;
 if(p.id===a.origin||p.id===a.lastWaterPort&&a.lastWaterTarget===target&&a.lastWaterVoyage===a.journal.current)return false;
 const projection=routeProjection(a.ship,remainingRoute(e,a,target),p.position);
 // A port must be meaningfully ahead on the remaining route and close enough
 // to its corridor to be a genuine en-route water stop.  This uses the live
 // waypoint polyline, so island detours and tacks are reflected in the test.
 const minimumAdvance=Math.max(6,Math.sqrt(3)*2,a.ship.spec.length*2),corridor=Math.max(12,Math.min(40,projection.total*.35));
 return projection.along>minimumAdvance&&projection.lateral<=corridor;
}
export function waterReviewDue(e,a){
 if(a.state!=='IN_TRANSIT'||e.time<a.waterReviewAt||e.time<a.waterRetryAt||a.waterStop||a.waterPlanning&&a.planning)return false;
 a.waterReviewAt=e.time+1;
 const fraction=a.water/a.waterCapacity;if(fraction<.25)return true;
 const remaining=waterTravelSeconds(e,a,a.path)*a.currentCrewCount,needsStop=remaining>a.water-a.waterCapacity*.25;
 if(!needsStop||fraction>=.9)return false;
 if(fraction<.5)return true;
 // Take a convenient forward port before passing it, even above half full.
 return [...e.ports.values()].some(p=>e.diplomacy.isFriendly(a.faction,p.owner_faction)&&forwardStop(e,a,p,a.target)&&distance(a.ship,p.position)<Math.sqrt(3)*6);
}
export function* planWaterStop(e,a){
 const stop=a.waterStop??{order:a.order,target:a.target,origin:a.origin,anchored:false};
 // Search actual routes to safe anchorages, not straight-line nearest ports.
 let best=null;const wind={...e.wind},emergency=a.water/a.waterCapacity<.25;
 const candidates=[...e.ports.values()].filter(p=>e.diplomacy.isFriendly(a.faction,p.owner_faction)&&e.diplomacy.canEnter(a.faction,p.owner_faction));
 const forwardCandidates=candidates.filter(p=>forwardStop(e,a,p,stop.target));
 // Even in an emergency, prefer a reachable port ahead of the vessel when
 // one exists.  Backward fallback is only for the case where no en-route
 // replenishment point can be reached at all.
 const requireForward=forwardCandidates.length>0;
 const passes=emergency?(requireForward?[true,false]:[false]):[true];
 for(const forwardOnly of passes){if(!forwardOnly&&best)break;for(const p of candidates){
  const forward=forwardStop(e,a,p,stop.target);
  if(forwardOnly&&!forward||!forwardOnly&&!emergency)continue;
  if(p.id===a.lastWaterPort&&a.lastWaterTarget===stop.target&&a.lastWaterVoyage===a.journal.current)continue;
  const anchor=e.dockTraffic.previewAnchor(p.id,a.ship.spec);if(!anchor)continue;
  const path=yield* e.navigators.get(a.faction).routeTask(a.ship,anchor,a.sailingSpec,wind,null,{allowShallows:true,includeTacks:false,maxNodes:4096});
  if(!path.length)continue;const seconds=waterTravelSeconds(e,a,path);
  // A proactive stop must advance the voyage. Emergency searches retain the
  // nearest reachable forward-port rule, but cannot repeat the same completed
  // stop on this leg.
  if(forwardOnly&&!forward||!forwardOnly&&!emergency)continue;
  if(p.id===a.lastWaterPort&&a.lastWaterTarget===stop.target&&a.lastWaterVoyage===a.journal.current)continue;
  if(!best||seconds<best.seconds-1e-8||Math.abs(seconds-best.seconds)<=1e-8&&p.id<best.p.id)best={p,anchor,path,seconds};
 }}
 if(a.docked||a.state!=='IN_TRANSIT')return;
 if(!best){a.waterRetryAt=e.time+10;return;}
 if(!e.diplomacy.isFriendly(a.faction,best.p.owner_faction)||!e.diplomacy.canEnter(a.faction,best.p.owner_faction)){a.waterRetryAt=e.time+10;return;}
 a.waterStop={...stop,portId:best.p.id,anchored:false};a.target=best.p.id;a.path=best.path;a.destinationApproach=best.anchor;a.jobPurpose='Water stop';a.waitingOrders=false;a.motion=null;e.dockTraffic.release(a.id);a.helmsman.reset();a.arrival.reset(a.ship);e.recordRoute(a,windEye(wind));
 if(a.journal.current){a.journal.current.waterStops??=[];const stops=a.journal.current.waterStops;stops.push({portId:best.p.id,arrivalTick:null});if(stops.length>100)stops.shift();}
}
function proceeds(e,a,p,stats){
 const entry=a.PriceLedger.entries.get(p.id);if(!entry)return -Infinity;
 const confidence=Math.max(0,1-(e.currentTick-entry.tick)/a.PriceLedger.maxAge);let sales=0,exposure=0;
 for(const item of a.manifest.values()){
  const price=entry.prices[item.commodity_id]?.price;if(price===undefined)return -Infinity;
  const value=item.quantity*price*confidence;sales+=value;exposure+=value;
 }
 return sales-stats.baseCost-stats.risk*(2+exposure*.001);
}
export function* resumeAfterWater(e,a){
 const stop=a.waterStop;if(!stop||e.time<a.waterRetryAt)return;const wind={...e.wind};let baseline=null,best=null;
 // Accepted delivery commitments are never rewritten by market speculation.
 const locked=!!(stop.order?.contract||stop.order?.deliveryCommitment||stop.order?.lockedDelivery);
 const candidates=[...e.ports.values()].filter(p=>e.canVisit({...a,origin:stop.origin},p)&&(!a.role.canTrade||e.diplomacy.canTrade(a.faction,p.owner_faction))&&(!locked&&a.role.canTrade&&a.manifest.size||p.id===stop.target));
 for(const p of candidates){const approach=e.visitApproach(a,p);if(!approach)continue;
  const path=yield* e.navigators.get(a.faction).routeTask(a.ship,approach,a.sailingSpec,wind,null,{allowShallows:true,includeTacks:false,maxNodes:4096});if(!path.length)continue;path.push({...e.dockTraffic.destination(p.id,a.ship.spec)});
  const stats=e.routeStatistics(a,path),value=proceeds(e,a,p,stats),option={p,path,approach,value};if(p.id===stop.target)baseline=option;if(!best||value>best.value)best=option;
 }
 let chosen=baseline;const margin=e.compiledSettings.provisions.diversionImprovement;
 if(!locked&&a.role.canTrade&&a.manifest.size&&best&&Number.isFinite(best.value)&&(!baseline||!Number.isFinite(baseline.value)||best.value>baseline.value+Math.max(e.minProfit,Math.abs(baseline.value)*margin)))chosen=best;
 if(!chosen){a.waterRetryAt=e.time+10;return;}
 const p=e.ports.get(stop.portId);e.dockTraffic.release(a.id);a.waterStop=null;a.lastWaterPort=stop.portId;a.lastWaterTarget=chosen.p.id;a.lastWaterVoyage=a.journal.current;a.order=stop.order;a.origin=stop.origin;a.target=chosen.p.id;a.path=chosen.path;a.destinationApproach=chosen.approach;a.state='IN_TRANSIT';a.waitingOrders=false;a.docked=false;a.motion=null;a.jobPurpose=a.role.canTrade?'Trade cargo':'Military patrol';a.helmsman.reset();a.arrival.reset(a.ship);e.recordRoute(a,windEye(wind));
 if(a.order){a.order.destination=a.target;a.order.path=a.path;}if(a.journal.current){a.journal.current.destination=a.target;const last=a.journal.current.waterStops?.at(-1);if(last){last.departureTick=e.currentTick;last.nextDestination=a.target;}}
 if(p&&a.target===p.id)e.requestDock(a,p,'UNLOAD');
}
