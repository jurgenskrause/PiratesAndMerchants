import {DEFAULT_SUBSYSTEM_SETTINGS} from './compiled-configuration.js?v=babbc3d3950e';
import {NavigationSafety,safetyProbes,clearSafetyRay} from './navigation-safety.js?v=babbc3d3950e';
import {TackHelmsman,planTackLegs,tackRoom,turnRadius} from './tack-helmsman.js?v=babbc3d3950e';
import {angleDifference,distance,headingTo,windEye} from './navigation.js?v=babbc3d3950e';
export const ROUTE_WIND_THRESHOLD=DEFAULT_SUBSYSTEM_SETTINGS.navigation.windShiftRadians;
export const windPlanChanged=(wind,plannedEye,threshold=ROUTE_WIND_THRESHOLD)=>Math.abs(angleDifference(windEye(wind),plannedEye))>threshold+1e-10;
export const needsTacking=(ship,goal,wind)=>Math.hypot(wind.x,wind.y)>=.025&&Math.abs(angleDifference(headingTo(ship,goal),windEye(wind)))<=ship.spec.noGo+.04;
// Keep major route waypoints separate from these short, land-checked sailing legs.
export function coastalTackLegs(ship,goal,wind,navigator,spec=ship.spec){
 const d=distance(ship,goal);if(d<1e-8)return null;const halfWidth=Math.max(8,turnRadius(ship)*2.5,ship.spec.length*3),dx=goal.x-ship.x,dy=goal.y-ship.y;
 const accept=plan=>{if(!plan)return null;const point=plan.points[0],cross=Math.abs(dx*(point.y-ship.y)-dy*(point.x-ship.x))/d;if(!tackRoom(ship,headingTo(ship,point),navigator,spec))return null;plan.corridor={origin:{x:ship.x,y:ship.y},destination:{...goal},halfWidth:Math.max(halfWidth,cross)};return plan;};
 const full=accept(planTackLegs(ship,goal,wind,navigator,spec));if(full)return full;
 const localRange=Math.max(16,halfWidth*2);for(const fraction of [.65,.4,.25]){const scale=Math.min(d,localRange)*fraction/d;if(d*scale<4)continue;const nearby={x:ship.x+dx*scale,y:ship.y+dy*scale},plan=accept(planTackLegs(ship,nearby,wind,navigator,spec));if(plan){plan.coastal=true;return plan;}}
 return null;
}
export class RouteHelmsman extends TackHelmsman {
 constructor(){super({planLegs:coastalTackLegs});this.mode='DIRECT';this.safety=new NavigationSafety();this.probeNeedsRoute=false;}
 reset(){super.reset();this.probes=null;this.probePose=null;this.probeAt=0;this.safetyInterrupted=false;if(this.safety){this.safety.active=false;this.safety.heading=null;this.safety.replan=false;this.safety.wasReverse=false;}}
 update(ship,goal,wind,navigator,time,spec=ship.spec){// Reuse open-water probes briefly; turning, substantial movement and coastal
  // evasion invalidate them. Full hull collision guards still run every physics step.
  const pose=this.probePose;if(!this.probes||time>=(this.probeAt??0)||this.safety.active||!pose||distance(ship,pose)>.3||Math.abs(angleDifference(ship.heading,pose.heading))>.04){this.probes=landProbes(ship,navigator,spec,4,Math.max(ship.spec.length*2,distance(ship,goal)));this.probePose={x:ship.x,y:ship.y,heading:ship.heading};this.probeAt=time+.1;}const emergency=this.safety.command(ship,goal,navigator,time,spec,this.probes,wind);this.needsRoute=this.safety.replan;
  if(emergency&&this.committed&&!emergency.brake&&!emergency.reverse){const range=Math.hypot(this.probes[0].target.x-ship.x,this.probes[0].target.y-ship.y),exit={x:ship.x+Math.sin(this.commitHeading)*range,y:ship.y-Math.cos(this.commitHeading)*range};if(clearSafetyRay(ship,exit,navigator,spec)&&tackRoom(ship,this.commitHeading,navigator,spec)){this.safetyInterrupted=false;this.mode='TACKING';return super.update(ship,goal,wind,navigator,time,spec);}}
  if(emergency){if(!this.safetyInterrupted){this.interrupt(time);this.safetyInterrupted=true;}this.mode=emergency.reverse?'REVERSE_PIVOT':'COASTAL_EVASION';return emergency;}
  this.safetyInterrupted=false;this.mode=needsTacking(ship,goal,wind)?'TACKING':'DIRECT';if(this.mode==='DIRECT'&&!this.committed)this.plan=null;const command=super.update(ship,goal,wind,navigator,time,spec);return {...command,replan:this.needsRoute};}
}
export class RouteReplanMonitor {
 constructor({revision=DEFAULT_SUBSYSTEM_SETTINGS.revision,windPersistence=DEFAULT_SUBSYSTEM_SETTINGS.navigation.windPersistence,windShiftRadians=ROUTE_WIND_THRESHOLD}={}){this.configurationRevision=revision;this.windShiftRadians=windShiftRadians;this.windPersistence=windPersistence;this.reset(0);}
 reset(eye,hotspots=new Set()){this.eye=eye;this.windSince=null;this.hotspots=new Set(hotspots);this.observedHotspots=hotspots;this.threatPending=false;}
 update(wind,time,hotspots=this.hotspots){if(windPlanChanged(wind,this.eye,this.windShiftRadians)){this.windSince??=time;}else this.windSince=null;if(hotspots!==this.observedHotspots){for(const id of hotspots)if(!this.hotspots.has(id)){this.threatPending=true;break;}this.hotspots=new Set(hotspots);this.observedHotspots=hotspots;}if(this.threatPending)return 'THREAT_HOTSPOT';if(this.windSince!==null&&time-this.windSince>this.windPersistence+1e-10)return 'WIND_SHIFT';return null;}
}
export const landProbes=safetyProbes;
