import {angleDifference,direction,distance,headingTo,windEye,optimalTackAngle} from './navigation.js?v=babbc3d3950e';
import {sailingDrive} from './sailing-angles.js?v=babbc3d3950e';
import {waypointReached} from './waypoints.js?v=babbc3d3950e';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function forwardSpeed(ship){return ship.vx*Math.sin(ship.heading)-ship.vy*Math.cos(ship.heading);}
// Leave the native recovery margin before another tack can arm.
export const sailingTackAngle=spec=>Math.max(optimalTackAngle(spec),spec.noGo+.16);
function turnRate(ship){return ship.spec.turnRate*(.35+.65*clamp(Math.abs(forwardSpeed(ship))/.8,0,1))/1.12;}
export function turnRadius(ship){return Math.max(ship.spec.length,Math.max(ship.minimumBaseSpeed,ship.speed)/turnRate(ship));}
// Conservative analytical turn envelope, including the native hull's yaw response lag.
export function tackRoom(ship,targetHeading,navigator,spec=ship.spec){
 const angle=angleDifference(targetHeading,ship.heading),radius=turnRadius(ship),v=direction(ship.heading),lag=Math.max(ship.minimumBaseSpeed,ship.speed)*(.65+ship.spec.mass/2000);
 let previous={x:ship.x,y:ship.y};const start={x:ship.x+v.x*lag,y:ship.y+v.y*lag};
 if(!navigator.clearSegment(previous,start,spec))return false;previous=start;
 const sign=Math.sign(angle)||1;
 for(let i=1;i<=12;i++){const h=ship.heading+angle*i/12,p={x:start.x+radius*sign*(Math.cos(ship.heading)-Math.cos(h)),y:start.y+radius*sign*(Math.sin(ship.heading)-Math.sin(h))};
  if(!navigator.clearSegment(previous,p,spec))return false;previous=p;
 }return true;
}
// Two upcoming legs only. Candidate count is fixed; no physics rollout runs in live play.
export function planTackLegs(ship,goal,wind,navigator,spec=ship.spec){
 const eye=windEye(wind),preferred=Math.sign(angleDifference(ship.heading,eye))||1,optimal=sailingTackAngle(ship.spec),strength=Math.hypot(wind.x,wind.y);
 const predicted=Math.max(ship.minimumBaseSpeed,ship.speed,ship.spec.maxSpeed*strength*sailingDrive(optimal,ship.spec.noGo,ship.spec.bestAngle)),virtual={...ship,minimumBaseSpeed:ship.minimumBaseSpeed,speed:predicted,vx:Math.sin(ship.heading)*predicted,vy:-Math.cos(ship.heading)*predicted};
 const radius=turnRadius(virtual),horizon=Math.max(10,predicted*25+radius*2),dx=goal.x-ship.x,dy=goal.y-ship.y;
 let best=null;
 for(const roomy of [true,false]){
  for(const side of [preferred,-preferred])for(const extra of [0,.1,.2]){
   const angle=Math.min(Math.PI/2-.08,optimal+extra),first=direction(eye+side*angle),second=direction(eye-side*angle),det=first.x*second.y-first.y*second.x;
   const one=(dx*second.y-dy*second.x)/det,two=(first.x*dy-first.y*dx)/det;if(one<=0||two<=0)continue;
   const length=Math.min(horizon,one),middle={x:ship.x+first.x*length,y:ship.y+first.y*length};
   const projection=(goal.x-middle.x)*second.x+(goal.y-middle.y)*second.y,secondLength=Math.min(horizon,Math.max(2,projection));
   const end=one<=horizon&&two<=horizon?{...goal}:{x:middle.x+second.x*secondLength,y:middle.y+second.y*secondLength};
   if(!navigator.clearSegment(ship,middle,spec)||!navigator.clearSegment(middle,end,spec))continue;
   if(roomy&&(!navigator.roomySegment(ship,middle,spec)||!navigator.roomySegment(middle,end,spec)))continue;
   const atTurn={...virtual,...middle,heading:eye+side*angle,vx:first.x*predicted,vy:first.y*predicted};if(!tackRoom(atTurn,eye-side*angle,navigator,spec))continue;
   const speed=Math.max(.05,ship.spec.maxSpeed*strength*sailingDrive(angle,ship.spec.noGo,ship.spec.bestAngle)),travel=(distance(ship,middle)+distance(middle,end)+distance(end,goal))/speed;
   const turnCost=2*angle/turnRate(atTurn),score=travel+turnCost+(side!==preferred?turnCost:0)+(navigator.segmentCost(ship,middle,spec)+navigator.segmentCost(middle,end,spec))*.15;
   if(!best||score<best.score)best={points:[middle,end],headings:[eye+side*angle,eye-side*angle],score,eye,index:0,start:{x:ship.x,y:ship.y},reached:new Set()};
  }if(best)break;
 }return best;
}
export class TackHelmsman {
 constructor({planLegs=planTackLegs}={}){this.planLegs=planLegs;this.completedTacks=0;this.failedTacks=0;this.reset();}
 reset(){this.phase='SAILING';this.plan=null;this.target=null;this.pending=null;this.entered=false;this.started=0;this.planAt=0;this.invalidated=false;this.previous=null;}
 get committed(){return this.phase==='TACKING';}
 invalidate(){if(this.committed)this.invalidated=true;else{this.plan=null;this.target=null;this.planAt=0;}}
 interrupt(time=0){this.phase='SAILING';this.plan=null;this.pending=null;this.entered=false;this.invalidated=false;this.planAt=Math.max(this.planAt,time+1.5);}
 waypoints(){return this.plan?this.plan.points.slice(this.plan.index):[];}
 #output(heading,sail=1){return {heading,sail,committed:this.committed,phase:this.phase};}
 #recover(ship,wind){this.phase='RECOVERING';this.plan=null;const angle=angleDifference(ship.heading,windEye(wind));this.recoverySide=Math.sign(angle)||this.entrySide||1;}
 update(ship,goal,wind,navigator,time,spec=ship.spec){
  const eye=windEye(wind),strength=Math.hypot(wind.x,wind.y),signed=angleDifference(ship.heading,eye),side=Math.sign(signed)||1;
  if(this.plan)for(let i=this.plan.index;i<this.plan.points.length;i++)if(waypointReached(this.previous??ship,ship,this.plan.points[i],i?this.plan.points[i-1]:this.plan.start,Math.max(2,turnRadius(ship)*1.1),false))this.plan.reached.add(i);
  this.previous={x:ship.x,y:ship.y};
  if(this.committed){
   if(ship.inNoGo)this.entered=true;
   if(ship.blocked||Math.abs(angleDifference(eye,this.entryEye))>Math.PI*.2){this.#recover(ship,wind);}
   else if(this.entered&&ship.luffing){this.failedTacks++;this.#recover(ship,wind);}
   else if(Math.sign(signed)===this.exitSide&&Math.abs(signed)>ship.spec.noGo+.12&&Math.abs(angleDifference(this.commitHeading,ship.heading))<.12){
    this.completedTacks++;this.phase='SAILING';if(this.invalidated){this.plan=null;this.target=null;this.invalidated=false;}
   }else if(time-this.started>this.timeout){this.failedTacks++;this.#recover(ship,wind);}
   else return this.#output(this.commitHeading);
  }
  if(this.phase==='RECOVERING'){
   const heading=eye+this.recoverySide*Math.min(Math.PI/2,sailingTackAngle(ship.spec)+.25);
   if(!ship.inNoGo&&ship.tackArmed&&ship.tackReady){this.phase='SAILING';this.plan=null;this.target=null;}else return this.#output(heading);
  }
  if(!this.target||distance(this.target,goal)>.01){this.plan=null;this.target={...goal};this.planAt=0;this.phase='SAILING';}
  if(this.plan&&Math.abs(angleDifference(eye,this.plan.eye))>.1)this.plan=null;
  if(this.plan){
   while(this.plan.reached.has(this.plan.index)){this.plan.index++;if(this.plan.index>=this.plan.points.length){this.plan=null;this.planAt=0;break;}}
  }
  let desired=headingTo(ship,goal);
  if(!this.plan&&strength>=.025&&Math.abs(angleDifference(desired,eye))<=ship.spec.noGo+.04&&time>=this.planAt){this.plan=this.planLegs(ship,goal,wind,navigator,spec);this.planAt=time+1.5;}
  if(this.plan){const point=this.plan.points[this.plan.index];desired=headingTo(ship,point);}
  else if(strength>=.025&&Math.abs(angleDifference(desired,eye))<=ship.spec.noGo+.04)desired=eye+side*sailingTackAngle(ship.spec);
  const desiredAngle=angleDifference(desired,eye),crossing=strength>=.025&&signed*desiredAngle<0&&Math.abs(signed)+Math.abs(desiredAngle)<Math.PI;
  if(crossing){
   this.pending=desired;
   if(!ship.tackReady||!tackRoom(ship,desired,navigator,spec)){
    this.phase='PREPARING';const build=eye+side*Math.min(Math.PI/2,sailingTackAngle(ship.spec)+.2);return this.#output(build);
   }
   this.phase='TACKING';this.entrySide=side;this.exitSide=Math.sign(desiredAngle);this.entryEye=eye;this.commitHeading=eye+this.exitSide*Math.max(Math.abs(desiredAngle),sailingTackAngle(ship.spec));this.started=time;this.entered=ship.inNoGo;this.timeout=Math.abs(angleDifference(this.commitHeading,ship.heading))/turnRate(ship)*2+4;
   return this.#output(this.commitHeading);
  }
  this.phase='SAILING';return this.#output(desired);
 }
}
export function helmRudder(ship,heading){return clamp(angleDifference(heading,ship.heading)*2.5-ship.yaw*1.3,-1,1);}
