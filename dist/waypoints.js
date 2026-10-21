import {worldToAxial} from './world.js?v=babbc3d3950e';
function cellDistance(a,b){const p=worldToAxial(a.x,a.y),q=worldToAxial(b.x,b.y);return Math.max(Math.abs(p.x-q.x),Math.abs(p.y-q.y),Math.abs(p.z-q.z));}
export function waypointReached(previous,current,point,origin,radius=2*Math.sqrt(3),hexTolerance=true){
 const dx=current.x-previous.x,dy=current.y-previous.y,length=dx*dx+dy*dy,t=length?Math.max(0,Math.min(1,((point.x-previous.x)*dx+(point.y-previous.y)*dy)/length)):0;
 const closest={x:previous.x+dx*t,y:previous.y+dy*t};
 if(Math.hypot(closest.x-point.x,closest.y-point.y)<=radius||(hexTolerance&&cellDistance(closest,point)<=2))return true;
 if(!origin)return false;
 const lx=point.x-origin.x,ly=point.y-origin.y,leg=Math.hypot(lx,ly);if(leg<1e-8)return false;
 const beyond=((current.x-point.x)*lx+(current.y-point.y)*ly)/leg,cross=Math.abs((current.x-point.x)*ly-(current.y-point.y)*lx)/leg;
 return beyond>=0&&beyond<=radius&&cross<=radius;
}
export class WaypointArrival {
 constructor(start){this.reset(start);}
 reset(start){this.previous={x:start.x,y:start.y};this.origin={...this.previous};this.reached=new WeakSet();this.detourAttempts=new WeakSet();this.blocked=false;}
 // A route can become stale after a ship has moved, a docking approach has
 // changed, or a direct leg was supplied by an older planner.  Do not leave
 // the helmsman pointing at land: use the authoritative navigator to insert
 // a clear local corridor into the live route.  The target remains in the
 // route, so accepted destination and docking semantics are unchanged.
 insertDetour(ship,points,index,navigator,spec,wind){
  const target=points[index];
  if(!target||this.detourAttempts.has(target)||typeof navigator?.route!=='function')return false;
  this.detourAttempts.add(target);
  let route=[];
  try {
   route=navigator.route({x:ship.x,y:ship.y},target,spec,wind??{x:0,y:-1},null,{allowShallows:true,includeTacks:false,maxNodes:Math.min(navigator.maxNodes??4096,4096)});
  } catch { return false; }
  if(!Array.isArray(route)||route.length<2)return false;
  const last=route.at(-1);
  if(Math.hypot(last.x-target.x,last.y-target.y)>1e-6||!route.slice(0,-1).some(p=>Math.hypot(p.x-ship.x,p.y-ship.y)>1e-6))return false;
  points.splice(index,1,...route.map(p=>({...p})));
  return true;
 }
 advance(ship,points,navigator,spec,committed=false,wind=null){
  const radius=Math.max(2*Math.sqrt(3),ship.speed/ship.spec.turnRate+ship.spec.length*.5);
  for(let i=0;i<points.length-1;i++)if(!this.reached.has(points[i])&&waypointReached(this.previous,ship,points[i],i?points[i-1]:this.origin,radius))this.reached.add(points[i]);
  this.previous={x:ship.x,y:ship.y};this.blocked=false;if(committed)return 0;
  // The first waypoint is normally the next sailing target.  Check it before
  // steering so an island directly ahead produces an explicit intermediary
  // waypoint rather than an indefinitely stalled vessel.
  if(points.length&&!this.reached.has(points[0])&&!navigator.clearSegment(ship,points[0],spec)){
   if(!this.insertDetour(ship,points,0,navigator,spec,wind))this.blocked=true;
  }
  let count=0;while(points.length>1&&this.reached.has(points[0])){
   if(!navigator.clearSegment(ship,points[1],spec)){
    if(this.insertDetour(ship,points,1,navigator,spec,wind))continue;
    this.blocked=true;break;
   }
   this.origin=points.shift();count++;
  }return count;
 }
}
