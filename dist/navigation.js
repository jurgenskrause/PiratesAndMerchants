import {hullDepth,localWindAt,waterDepth} from './ships.js?v=babbc3d3950e';
import {sailingDrive} from './sailing-angles.js?v=babbc3d3950e';
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export const headingTo=(a,b)=>Math.atan2(b.x-a.x,a.y-b.y);
export const angleDifference=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
export const direction=h=>({x:Math.sin(h),y:-Math.cos(h)});
export const windEye=w=>Math.atan2(-w.x,w.y);
const tackAngles=new WeakMap();
const clearanceMaps=new WeakMap();
function clearanceMap(world){
 if(clearanceMaps.has(world))return clearanceMaps.get(world);
 const spacing=2,b=world.bounds??{width:Math.sqrt(3)*(world.n+.5),height:world.n*1.5},cols=Math.ceil(b.width/spacing)+1,rows=Math.ceil(b.height/spacing)+1;
 const shore=new Float32Array(cols*rows),shelf=new Float32Array(cols*rows);
 for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const depth=waterDepth(world,x*spacing,y*spacing),i=y*cols+x;shore[i]=depth>0?1000:0;shelf[i]=depth>=8?1000:0;}
 for(const data of [shore,shelf])for(const reverse of [false,true]){
  for(let j=0;j<data.length;j++){const i=reverse?data.length-1-j:j,x=i%cols,y=Math.floor(i/cols);
   for(const [dx,dy] of reverse?[[1,0],[0,1],[1,1],[-1,1]]:[[-1,0],[0,-1],[-1,-1],[1,-1]]){const nx=x+dx,ny=y+dy;if(nx>=0&&nx<cols&&ny>=0&&ny<rows)data[i]=Math.min(data[i],data[ny*cols+nx]+spacing*Math.hypot(dx,dy));}
  }
 }
 const map={spacing,cols,rows,shore,shelf};clearanceMaps.set(world,map);return map;
}
export function optimalTackAngle(spec) {
 if(Object.isFrozen(spec)&&tackAngles.has(spec))return tackAngles.get(spec);
 let best=spec.noGo+.08,score=-Infinity;
 for(let a=spec.noGo+.08;a<Math.PI/2;a+=Math.PI/180){const v=sailingDrive(a,spec.noGo,spec.bestAngle)*Math.cos(a);if(v>score){score=v;best=a;}}
 if(Object.isFrozen(spec))tackAngles.set(spec,best);
 return best;
}
// Binary heap: bounded A* exploration without sorting all open nodes each step.
class Heap {
 data=[];
 push(v){let i=this.data.length;this.data.push(v);while(i){const p=(i-1)>>1;if(this.data[p].f<=v.f)break;this.data[i]=this.data[p];i=p;}this.data[i]=v;}
 pop(){const root=this.data[0],v=this.data.pop();if(this.data.length){let i=0;while(i*2+1<this.data.length){let c=i*2+1;if(c+1<this.data.length&&this.data[c+1].f<this.data[c].f)c++;if(this.data[c].f>=v.f)break;this.data[i]=this.data[c];i=c;}this.data[i]=v;}return root;}
}
export class Navigator {
 constructor(world,{spacing=3,maxNodes=12000}={}){if(!Number.isFinite(spacing)||spacing<=0||!Number.isSafeInteger(maxNodes)||maxNodes<1)throw new RangeError('Invalid navigation budget');this.world=world;this.spacing=spacing;this.maxNodes=maxNodes;this.cache=new Map();this.costCache=new Map();}
 clearance(p,kind='shore'){
  const m=clearanceMap(this.world),x=Math.max(0,Math.min(m.cols-1,Math.round(p.x/m.spacing))),y=Math.max(0,Math.min(m.rows-1,Math.round(p.y/m.spacing)));return m[kind][y*m.cols+x];
 }
 segmentCost(a,b,spec){
  const d=distance(a,b),steps=Math.max(1,Math.ceil(d/2));let sum=0;
  for(let i=0;i<steps;i++){const t=(i+.5)/steps,p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},depth=waterDepth(this.world,p.x,p.y);
   sum+=1+12/(1+this.clearance(p))+4/(1+this.clearance(p,'shelf'))+Math.max(0,8-depth)*.8;
  }return d*sum/steps;
 }
 roomySegment(a,b,spec,margin=Math.max(3,spec.length*1.5)){
  if(!this.clearSegment(a,b,spec))return false;
  const steps=Math.max(1,Math.ceil(distance(a,b)/2));for(let i=1;i<=steps;i++){const t=i/steps,p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};if(this.clearance(p)<margin||waterDepth(this.world,p.x,p.y)<Math.max(8,spec.draft))return false;}return true;
 }
 clearSegment(a,b,spec) {
  const d=distance(a,b),h=headingTo(a,b),steps=Math.max(1,Math.ceil(d/.5));
  for(let i=0;i<=steps;i++){const t=i/steps;if(hullDepth(this.world,a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,h,spec)<spec.draft)return false;}
  return true;
 }
 route(...args){const task=this.routeTask(...args);let step;do{step=task.next();}while(!step.done);return step.value;}
 *routeTask(start,goal,spec,wind,field=null,{allowShallows=false,centerChannels=true,includeTacks=true}={}) {
  const path=yield* this.#route(start,goal,spec,wind,field,centerChannels,includeTacks);
  if(path.length||!allowShallows||spec.draft<=.001)return path;
  const fallback=yield* this.#route(start,goal,{...spec,draft:.001},wind,field,centerChannels,includeTacks);fallback.shallowPassage=true;return fallback;
 }
 *#route(start,goal,spec,wind,field,centerChannels,includeTacks) {
  yield;
  if(!this.clearSegment(start,start,spec)||!this.clearSegment(goal,goal,spec))return [];
  let path;
  if(this.clearSegment(start,goal,spec)&&(!centerChannels||this.roomySegment(start,goal,spec,10)))path=[{...goal}];
  else {
   const bounds=this.world.bounds??{width:Math.sqrt(3)*(this.world.n+.5),height:(this.world.n-1)*1.5};
   const cell=this.spacing,cols=Math.ceil(bounds.width/cell),rows=Math.ceil(bounds.height/cell);
   const point=id=>({x:(id%cols)*cell,y:Math.floor(id/cols)*cell});
   const node=p=>Math.round(p.y/cell)*cols+Math.round(p.x/cell);
   const first=node(start),last=node(goal),open=new Heap(),cost=new Map([[first,0]]),parent=new Map();
   open.push({id:first,f:distance(start,goal),g:0});let found=false,visited=0;
   while(open.data.length&&visited++<this.maxNodes){
    if(visited%16===0)yield;
    const current=open.pop();if(current.g!==cost.get(current.id))continue;if(current.id===last){found=true;break;}
    const a=current.id===first?start:point(current.id),x=current.id%cols,y=Math.floor(current.id/cols);
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
     const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=cols||ny>=rows)continue;const id=ny*cols+nx,b=id===last?goal:point(id);
     const key=`${spec.name}|${spec.draft}|${Math.min(current.id,id)}|${Math.max(current.id,id)}`;
     let clear=this.cache.get(key);if(clear===undefined||current.id===first||id===last){clear=this.clearSegment(a,b,spec);if(current.id!==first&&id!==last)this.cache.set(key,clear);}
     if(!clear)continue;
     const w=localWindAt(field,a.x,a.y,wind),angle=Math.abs(angleDifference(headingTo(a,b),windEye(w)));
     const drive=angle<=spec.noGo?sailingDrive(optimalTackAngle(spec),spec.noGo,spec.bestAngle)*Math.cos(optimalTackAngle(spec)):sailingDrive(angle,spec.noGo,spec.bestAngle);
     let edge=distance(a,b);if(centerChannels){edge=this.costCache.get(key);if(edge===undefined||current.id===first||id===last){edge=this.segmentCost(a,b,spec);if(current.id!==first&&id!==last)this.costCache.set(key,edge);}}
     const g=current.g+edge/Math.max(.1,drive);
     if(g<(cost.get(id)??Infinity)){cost.set(id,g);parent.set(id,current.id);open.push({id,g,f:g+distance(b,goal)});}
    }
   }
   if(!found)return [];path=[];let id=last;
   while(id!==first){path.push(id===last?{...goal}:point(id));id=parent.get(id);}path.reverse();
   // Visibility compression preserves clearance, reducing per-agent waypoint work.
   const simple=[];let a=start;
   for(let i=0;i<path.length;){let j=i,along=0,prev=a;
    for(let k=i;k<path.length;k++){if(k%4===0)yield;along+=centerChannels?this.segmentCost(prev,path[k],spec):distance(prev,path[k]);prev=path[k];if(this.clearSegment(a,path[k],spec)&&(!centerChannels||this.segmentCost(a,path[k],spec)<=along*1.02))j=k;}
    simple.push(path[j]);a=path[j];i=j+1;
   }path=simple;
  }
  if(!includeTacks)return path;
  const result=[];let a=start;
  for(const b of path){const w=localWindAt(field,a.x,a.y,wind);result.push(...this.tacks(a,b,spec,w));a=b;}
  return result;
 }
 tacks(a,b,spec,wind) {
  if(Math.hypot(wind.x,wind.y)<.025||Math.abs(angleDifference(headingTo(a,b),windEye(wind)))>spec.noGo+.03)return [{...b}];
  const eye=windEye(wind),angle=optimalTackAngle(spec),u=direction(eye-angle),v=direction(eye+angle),dx=b.x-a.x,dy=b.y-a.y;
  const det=u.x*v.y-u.y*v.x,one=(dx*v.y-dy*v.x)/det,two=(u.x*dy-u.y*dx)/det;
  if(one<=0||two<=0)return [{...b}];
  for(const roomy of [true,false])for(const [first,length] of [[u,one],[v,two]]){
   const middle={x:a.x+first.x*length,y:a.y+first.y*length};
   if(this.clearSegment(a,middle,spec)&&this.clearSegment(middle,b,spec)&&(!roomy||(this.roomySegment(a,middle,spec)&&this.roomySegment(middle,b,spec))))return [middle,{...b}];
  }
  // Tight channels need short local tacks, generated by the live helmsman.
  return [{...b}];
 }
}
