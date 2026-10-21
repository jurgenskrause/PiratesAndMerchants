import {DIRECTIONS,worldToAxial,axialToWorld} from './world.js?v=babbc3d3950e';
import {navigationDepth} from './navigation-geometry.js?v=babbc3d3950e';
import {distance,headingTo,angleDifference,windEye,optimalTackAngle} from './navigation.js?v=babbc3d3950e';
import {sailingDrive} from './sailing-angles.js?v=babbc3d3950e';
const margins=new WeakMap();
export function coastPenalty(world,p){let cache=margins.get(world);if(!cache){cache=new Map();margins.set(world,cache);}const h=worldToAxial(p.x,p.y),id=`${h.q},${h.r}`;if(cache.has(id))return cache.get(id);let count=0;for(const [dq,dr] of DIRECTIONS){const v=axialToWorld(h.q+dq,h.r+dr);if(navigationDepth(world,v.x,v.y)<=0)count++;}const cost=count?8+count*2:0;cache.set(id,cost);return cost;}
function marginCost(world,a,b){const d=distance(a,b),steps=Math.max(1,Math.ceil(d));let cost=0;for(let i=1;i<=steps;i++)cost+=coastPenalty(world,{x:a.x+(b.x-a.x)*i/steps,y:a.y+(b.y-a.y)*i/steps})*d/steps;return cost;}
class Heap {
 constructor(){this.data=[];}
 push(v){let i=this.data.length;this.data.push(v);while(i){const p=(i-1)>>1;if(this.data[p].f<=v.f)break;this.data[i]=this.data[p];i=p;}this.data[i]=v;}
 pop(){const root=this.data[0],v=this.data.pop();if(this.data.length){let i=0;while(i*2+1<this.data.length){let c=i*2+1;if(c+1<this.data.length&&this.data[c+1].f<this.data[c].f)c++;if(this.data[c].f>=v.f)break;this.data[i]=this.data[c];i=c;}this.data[i]=v;}return root;}
}
export function polarRouteEfficiency(spec,angle,upwind=null){if(angle<=spec.noGo){if(upwind!==null)return upwind;const tack=optimalTackAngle(spec);return Math.max(.1,sailingDrive(tack,spec.noGo,spec.bestAngle)*Math.cos(tack));}return Math.max(.1,sailingDrive(angle,spec.noGo,spec.bestAngle));}
// Cooperative hex A*. Threat is additive; wind cost estimates sailing time/VMG.
export function* hexRoute(navigator,start,goal,spec,wind,{allowShallows=false,maxNodes=navigator.maxNodes}={}){
 const frozen={x:wind.x,y:wind.y};let path=yield* search(navigator,{x:start.x,y:start.y},{x:goal.x,y:goal.y},spec,frozen,maxNodes);
 if(!path.length&&allowShallows&&spec.draft>.001){path=yield* search(navigator,{x:start.x,y:start.y},{x:goal.x,y:goal.y},{...spec,draft:.001},frozen,maxNodes);if(path.length)path.shallowPassage=true;}return path;
}
function* search(nav,start,goal,spec,wind,maxNodes){
 yield;const world=nav.world,n=world.n,first=worldToAxial(start.x,start.y),last=worldToAxial(goal.x,goal.y),index=p=>{const col=p.q+Math.floor(p.r/2);return col<0||p.r<0||col>=n||p.r>=n?-1:p.r*n+col;},firstId=index(first),lastId=index(last);
 if(firstId<0||lastId<0||!nav.clearSegment(start,start,spec)||!nav.clearSegment(goal,goal,spec))return [];
 if(firstId===lastId)return nav.clearSegment(start,goal,spec)?[goal]:[];
 // Open-water visibility is an exact corridor shortcut: retain A* for coast,
 // obstacles and hostile zones. Harbor endpoints may sit inside the shore margin.
 if(nav.clearSegment(start,goal,spec)&&nav.grid.pathRisk(start,[goal],nav.faction,nav.diplomacy)===0){
  const length=distance(start,goal),steps=Math.max(1,Math.ceil(length/2));let open=true;
  for(let i=1;i<steps;i++){const t=i/steps,p={x:start.x+(goal.x-start.x)*t,y:start.y+(goal.y-start.y)*t};if(Math.min(t,1-t)*length>8&&nav.clearance(p)<Math.max(3,spec.length*1.5)){open=false;break;}}
  if(open)return [goal];
 }
 const eye=windEye(wind),upwind=polarRouteEfficiency(spec,0),point=id=>{const r=Math.floor(id/n),q=id%n-Math.floor(r/2);return {...axialToWorld(q,r),q,r};},edgeCost=(a,b)=>nav.terrainSegmentCost(a,b,spec)/polarRouteEfficiency(spec,Math.abs(angleDifference(headingTo(a,b),eye)),upwind)+nav.grid.pathRisk(a,[b],nav.faction,nav.diplomacy)*12+marginCost(world,a,b);
 // Weighted A* bounds search work; every candidate still passes full hull clearance.
 const estimate=p=>distance(p,goal)*2.5/polarRouteEfficiency(spec,Math.abs(angleDifference(headingTo(p,goal),eye)),upwind);
 const cost=new Map([[firstId,0]]),parent=new Map(),closed=new Set(),open=new Heap();open.push({id:firstId,g:0,f:estimate(start)});let visited=0,popped=0,found=false;
 while(open.data.length&&visited<maxNodes){if(++popped%16===0)yield;const current=open.pop();if(current.g!==cost.get(current.id)||closed.has(current.id))continue;closed.add(current.id);visited++;if(current.id===lastId){found=true;break;}const a=current.id===firstId?{...start,q:first.q,r:first.r}:point(current.id);
  for(const [dq,dr] of DIRECTIONS){const id=index({q:a.q+dq,r:a.r+dr});if(id<0||closed.has(id))continue;const b=id===lastId?goal:point(id);if(navigationDepth(world,b.x,b.y)<spec.draft||!nav.clearSegment(a,b,spec))continue;const g=current.g+edgeCost(a,b);if(g<(cost.get(id)??Infinity)){cost.set(id,g);parent.set(id,current.id);open.push({id,g,f:g+estimate(b)});}}
 }
 if(!found)return [];const path=[];for(let id=lastId;id!==firstId;id=parent.get(id))path.push(id===lastId?{...goal,q:last.q,r:last.r}:point(id));path.reverse();
 // Bounded string pulling retains wind/threat/clearance costs and hex endpoints.
 const result=[];let a=start;for(let i=0;i<path.length;){let best=i,along=0,previous=a;for(let j=i;j<Math.min(path.length,i+32);j++){if((j-i)%4===0)yield;along+=edgeCost(previous,path[j]);previous=path[j];if(nav.clearSegment(a,path[j],spec)&&edgeCost(a,path[j])<=along*1.02)best=j;}result.push(path[best]);a=path[best];i=best+1;}return result;
}
