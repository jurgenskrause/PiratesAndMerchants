import {DIRECTIONS,SEA_LEVEL,axialToOffset,offsetToAxial} from './world.js?v=babbc3d3950e';
export const hexDistance=(a,b)=>(Math.abs(a.q-b.q)+Math.abs(a.r-b.r)+Math.abs(a.q+a.r-b.q-b.r))/2;
export const hexNeighbors=c=>DIRECTIONS.map(([q,r])=>({q:c.q+q,r:c.r+r}));
export function tileIndex(world,c){const o=axialToOffset(c.q,c.r);return o.col<0||o.row<0||o.col>=world.n||o.row>=world.n?-1:o.row*world.n+o.col;}
export const tileCoordinates=(world,index)=>offsetToAxial(index%world.n,Math.floor(index/world.n));
export function waterDepthAt(world,c){const i=tileIndex(world,c);return i<0||world.h[i]>=SEA_LEVEL?0:world.depth?.[i]??(SEA_LEVEL-world.h[i])*50;}
export function tileCategory(world,c){const i=tileIndex(world,c);if(i<0)return 'OUTSIDE';if(world.h[i]<SEA_LEVEL)return 'WATER';return hexNeighbors(c).some(n=>waterDepthAt(world,n)>0)?'COASTAL':'INLAND';}
const shoreCache=new WeakMap();
// Terrain is immutable during this phase. Multi-source BFS is paid once per world.
export function coastDistances(world){if(shoreCache.has(world))return shoreCache.get(world);const values=new Int32Array(world.n*world.n).fill(-1),queue=new Int32Array(values.length);let head=0,tail=0;for(let i=0;i<values.length;i++)if(world.h[i]>=SEA_LEVEL){values[i]=0;queue[tail++]=i;}while(head<tail){const i=queue[head++];for(const n of hexNeighbors(tileCoordinates(world,i))){const j=tileIndex(world,n);if(j>=0&&values[j]===-1){values[j]=values[i]+1;queue[tail++]=j;}}}shoreCache.set(world,values);return values;}
