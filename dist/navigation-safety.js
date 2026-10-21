import {sailingTackAngle} from './tack-helmsman.js?v=babbc3d3950e';
import {navigationDepth} from './navigation-geometry.js?v=babbc3d3950e';
import {angleDifference,headingTo,windEye} from './navigation.js?v=babbc3d3950e';
const footprint=[[0,0],[.48,0],[-.48,0],[.25,.48],[.25,-.48],[-.25,.48],[-.25,-.48]];
export function safePose(world,p,spec){const fx=Math.sin(p.heading),fy=-Math.cos(p.heading),rx=Math.cos(p.heading),ry=Math.sin(p.heading);return footprint.every(([a,b])=>{const x=p.x+fx*a*spec.length+rx*b*spec.beam,y=p.y+fy*a*spec.length+ry*b*spec.beam;return x>=0&&y>=0&&(!world.bounds||x<=world.bounds.width&&y<=world.bounds.height)&&navigationDepth(world,x,y)>0;});}
export function safeSweep(world,a,b,spec){const angle=angleDifference(b.heading,a.heading),steps=Math.max(1,Math.ceil((Math.hypot(b.x-a.x,b.y-a.y)+Math.abs(angle)*spec.length)/.15));for(let i=1;i<=steps;i++){const t=i/steps;if(!safePose(world,{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,heading:a.heading+angle*t},spec))return false;}return true;}
export function clearSafetyRay(ship,target,nav,spec){if(nav.world){const heading=headingTo(ship,target);if(!safePose(nav.world,{...target,heading},spec))return false;}return nav.clearSegment(ship,target,spec);}
export const PROBE_OFFSETS=[0,-20,20,-45,45].map(d=>d*Math.PI/180);
export function safetyProbes(ship,nav,spec=ship.spec,seconds=4,maxLength=Infinity){const speed=Math.max(ship.speed,Math.hypot(ship.vx,ship.vy)),length=Math.min(maxLength,Math.max(ship.spec.length*2,speed*seconds+speed*(.25+ship.spec.mass/2000)));return PROBE_OFFSETS.map(offset=>{const heading=ship.heading+offset,target={x:ship.x+Math.sin(heading)*length,y:ship.y-Math.cos(heading)*length};return{heading,target,blocked:!clearSafetyRay(ship,target,nav,spec)};});}
export class NavigationSafety {
 constructor(){this.active=false;this.heading=null;this.chooseAt=0;this.replan=false;this.telemetry={probeTicks:0,evasions:0,reversePivots:0,guidedInterventions:0,guardInterventions:0,unsafePoses:0,nativeRejections:0,routeReplans:0};}
 command(ship,goal,nav,time,spec,probes,wind=null){this.telemetry.probeTicks++;const hit=probes.some(p=>p.blocked);if(!hit&&!this.active)return null;
  if(!hit){this.active=false;this.replan=false;return null;}
  const short=Math.max(ship.spec.length*1.25,ship.speed*1.5),front={x:ship.x+Math.sin(ship.heading)*short,y:ship.y-Math.cos(ship.heading)*short};this.brake=!clearSafetyRay(ship,front,nav,spec);
  if(!this.active){this.active=true;this.telemetry.evasions++;this.chooseAt=0;}
  const forward=this.heading===null?null:{x:ship.x+Math.sin(this.heading)*Math.max(ship.spec.length*2,ship.speed*6),y:ship.y-Math.cos(this.heading)*Math.max(ship.spec.length*2,ship.speed*6)};if(time>=this.chooseAt||this.heading===null||!clearSafetyRay(ship,forward,nav,spec)){this.chooseAt=time+.5;let best=null;const normal=probes.filter(p=>p.blocked).reduce((v,p)=>({x:v.x-Math.sin(p.heading),y:v.y+Math.cos(p.heading)}),{x:0,y:0}),away=Math.atan2(normal.x,-normal.y),desired=headingTo(ship,goal),range=Math.hypot(probes[0].target.x-ship.x,probes[0].target.y-ship.y);const eye=wind?windEye(wind):null,windy=wind&&Math.hypot(wind.x,wind.y)>=.025;for(let i=-3;i<24;i++){const heading=i===-3&&windy?eye+sailingTackAngle(ship.spec):i===-2&&windy?eye-sailingTackAngle(ship.spec):i<0?desired:ship.heading+i*Math.PI/12,target={x:ship.x+Math.sin(heading)*range,y:ship.y-Math.cos(heading)*range};if(!clearSafetyRay(ship,target,nav,spec))continue;const score=(windy&&Math.abs(angleDifference(heading,eye))<ship.spec.noGo+.12?100:0)+Math.abs(angleDifference(heading,away))*.15+Math.abs(angleDifference(heading,desired))*2+Math.abs(angleDifference(heading,ship.heading))*.3;if(!best||score<best.score)best={heading,score};}if(best&&Math.abs(angleDifference(best.heading,ship.heading))<.05){const side=Math.sin(angleDifference(away,ship.heading));if(Math.abs(side)>.1){const heading=best.heading+Math.sign(side)*Math.PI/18,target={x:ship.x+Math.sin(heading)*range,y:ship.y-Math.cos(heading)*range};if((!windy||Math.abs(angleDifference(heading,eye))>=ship.spec.noGo+.12)&&clearSafetyRay(ship,target,nav,spec))best.heading=heading;}}
  this.heading=best?.heading??ship.heading+Math.PI;this.reverse=probes.every(p=>p.blocked);if(this.reverse&&!this.wasReverse){this.telemetry.reversePivots++;this.replan=true;}this.wasReverse=this.reverse;}
  return {heading:this.heading,sail:this.reverse?0:this.brake?.5:1,safety:true,brake:this.brake,reverse:this.reverse,replan:this.replan,committed:true};
 }
 step(ship,dt,steer,wind,world,command){const before={...ship};ship.step(dt,{steer},wind,world);const rejected=ship.blocked;if(rejected)this.telemetry.nativeRejections++;
  if(command?.safety&&(command.reverse||command.brake)){ // Reduce headway while the rudder pivots; reverse is a bounded continuous maneuver.
   const speed=command.reverse?-.18:Math.abs(angleDifference(command.heading,ship.heading))<.5?.6:.18,heading=ship.heading;ship.vx=Math.sin(heading)*speed;ship.vy=-Math.cos(heading)*speed;ship.x=before.x+ship.vx*dt;ship.y=before.y+ship.vy*dt;ship.speed=Math.abs(speed);ship.blocked=false;ship.status=command.reverse?'Safety: reverse and pivot':'Safety: coastal evasion';
  }
  if(rejected||!safeSweep(world,before,ship,ship.spec)){this.telemetry.guardInterventions++;const yaw=ship.yaw;Object.assign(ship,before);ship.vx=ship.vy=ship.speed=0;ship.yaw=yaw;this.active=true;this.chooseAt=0;this.replan=true; // Back away along the last safe hull axis without teleporting.
   for(const sign of [-1,1]){const p={x:before.x+Math.sin(before.heading)*.18*dt*sign,y:before.y-Math.cos(before.heading)*.18*dt*sign,heading:before.heading};if(safeSweep(world,before,p,ship.spec)){Object.assign(ship,p);break;}}
  }
  if(!safePose(world,ship,ship.spec))this.telemetry.unsafePoses++;
 }
}
