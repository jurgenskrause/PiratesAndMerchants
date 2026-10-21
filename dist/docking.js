import {largeVessel} from './port-infrastructure.js?v=babbc3d3950e';
import {safePose,safeSweep} from './navigation-safety.js?v=babbc3d3950e';
import {hullDepth,waterDepth} from './ships.js?v=babbc3d3950e';
import {worldToAxial} from './world.js?v=babbc3d3950e';
import {Navigator,distance,headingTo,angleDifference} from './navigation.js?v=babbc3d3950e';
export function cellDistance(a,b){const p=worldToAxial(a.x,a.y),q=worldToAxial(b.x,b.y);return Math.max(Math.abs(p.x-q.x),Math.abs(p.y-q.y),Math.abs(p.z-q.z));}
export function dockBerth(world,port,spec){
 const dock=port.dockPosition??port.position,land=port.harborPosition;
 if(!land)return {...dock,heading:port.heading??0};
 const len=distance(dock,land)||1,n={x:(dock.x-land.x)/len,y:(dock.y-land.y)/len},heading=Math.atan2(n.y,n.x);
 for(let offset=.6;offset<=8;offset+=.4){const p={x:dock.x+n.x*offset,y:dock.y+n.y*offset,heading};let clear=true;
  for(let i=0;i<8;i++)if(hullDepth(world,p.x,p.y,i*Math.PI/4,spec)<=0){clear=false;break;}
  if(clear)return p;
 }return null;
}
export function guidedPath(world,ship,target,{speed=1.2,allowExtraction=false,turnDuringTravel=false,turnClearance=largeVessel(ship.spec)}={}){
 const nav=new Navigator(world,{spacing:2,maxNodes:16000}),diameter=Math.hypot(ship.spec.length,ship.spec.beam)+.6,spec={...ship.spec,draft:.001,...(turnClearance?{length:diameter,beam:diameter}:{})};
 const routeFrom=start=>nav.clearSegment(start,target,spec)?[{x:target.x,y:target.y}]:nav.route(start,target,spec,{x:0,y:0},null,{centerChannels:false});
 const canTurn=p=>nav.clearSegment(p,p,spec);
 let path=(!turnClearance||canTurn(ship))?routeFrom(ship):[];
 // A hull can fit close to shore without having room to rotate. Slide clear at
 // its existing heading before entering the corridor with full turning clearance.
 if(!path.length&&turnClearance&&safePose(world,ship,ship.spec)&&!canTurn(ship)){
  const toward=headingTo(ship,target);let escape=null;
  for(let radius=.5;radius<=Math.max(4,diameter*3)&&!escape;radius+=.5){
   const candidates=Array.from({length:16},(_,i)=>{const h=toward+i*Math.PI/8;return {x:ship.x+Math.sin(h)*radius,y:ship.y-Math.cos(h)*radius,heading:ship.heading};}).filter(p=>canTurn(p)&&safeSweep(world,ship,p,ship.spec)).sort((a,b)=>distance(a,target)-distance(b,target));
   for(const p of candidates){const tail=routeFrom(p);if(tail.length){escape=[{...p,holdHeading:ship.heading},...tail];break;}}
  }
  path=escape??[];
 }
 if(!path.length&&allowExtraction){
  const d=distance(ship,target),steps=Math.ceil(d/.25),h=headingTo(ship,target);let clear=true;
  for(let i=0;i<=steps;i++){const t=i/Math.max(1,steps),x=ship.x+(target.x-ship.x)*t,y=ship.y+(target.y-ship.y)*t;
   if(waterDepth(world,x,y)<=0||(d*t>ship.spec.length&&hullDepth(world,x,y,h,ship.spec)<=0)){clear=false;break;}}
  if(clear)path=[{x:target.x,y:target.y}];
 }
 let length=0,previous=ship;for(const p of path){length+=distance(previous,p);previous=p;}
 if(turnDuringTravel&&length>0)speed=Math.min(speed,length/(Math.abs(angleDifference(target.heading,ship.heading))/1.5+.1));
 return path.length?{path,index:0,target,speed,startHeading:ship.heading,length,traveled:0,turnDuringTravel}:null;
}
// Emergency dock handling is deliberately a short animated correction, not normal sailing.
export function dockEndSlide(ship,target){return {emergencySlide:true,start:{x:ship.x,y:ship.y,heading:ship.heading},target:{...target},elapsed:0,duration:Math.max(.25,Math.min(1,distance(ship,target)/8))};}
export function stepGuided(ship,motion,dt){
 if(motion.emergencySlide){
  const old={x:ship.x,y:ship.y};motion.elapsed=Math.min(motion.duration,motion.elapsed+dt);const t=motion.elapsed/motion.duration,ease=t*t*(3-2*t),start=motion.start;
  ship.x=start.x+(motion.target.x-start.x)*ease;ship.y=start.y+(motion.target.y-start.y)*ease;ship.heading=start.heading+angleDifference(motion.target.heading??start.heading,start.heading)*ease;
  ship.canvas=0;ship.yaw=0;ship.tacking=ship.luffing=ship.blocked=false;ship.vx=(ship.x-old.x)/dt;ship.vy=(ship.y-old.y)/dt;ship.speed=Math.hypot(ship.vx,ship.vy);
  if(t<1)return false;ship.vx=ship.vy=ship.speed=0;return true;
 }

 let remaining=motion.speed*dt;const old={x:ship.x,y:ship.y};
 while(remaining>0&&motion.index<motion.path.length){const p=motion.path[motion.index],d=distance(ship,p);
  if(d<1e-9){motion.index++;continue;}const move=Math.min(remaining,d),h=headingTo(ship,p);
  const desired=p.holdHeading??(motion.turnDuringTravel?motion.startHeading+angleDifference(motion.target.heading,motion.startHeading)*Math.min(1,(motion.traveled+move)/Math.max(1e-9,motion.length)):h);
  ship.heading+=Math.max(-dt*1.5,Math.min(dt*1.5,angleDifference(desired,ship.heading)));motion.traveled+=move;
  ship.x+=(p.x-ship.x)*move/d;ship.y+=(p.y-ship.y)*move/d;remaining-=move;if(move===d)motion.index++;
 }
 ship.canvas=0;ship.yaw=0;ship.tacking=ship.luffing=false;ship.vx=(ship.x-old.x)/dt;ship.vy=(ship.y-old.y)/dt;ship.speed=Math.hypot(ship.vx,ship.vy);
 if(motion.index<motion.path.length)return false;
 const angle=angleDifference(motion.target.heading??ship.heading,ship.heading);ship.heading+=Math.max(-dt*1.5,Math.min(dt*1.5,angle));
 if(Math.abs(angle)>.025)return false;
 ship.heading=motion.target.heading??ship.heading;ship.vx=ship.vy=ship.speed=0;ship.blocked=false;return true;
}
export function recoveryMotion(world,ship){
 for(let radius=4;radius<=24;radius+=2)for(let i=0;i<32;i++){
  const h=i*Math.PI/16,p={x:ship.x+Math.sin(h)*radius,y:ship.y-Math.cos(h)*radius,heading:h};
  if(hullDepth(world,p.x,p.y,h,ship.spec)<Math.max(8,ship.spec.draft))continue;
  const motion=guidedPath(world,ship,p,{speed:1.5,allowExtraction:true});if(motion)return motion;
 }return null;
}
