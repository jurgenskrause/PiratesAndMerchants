import { createNoise2D } from './vendor/simplex-noise.js?v=babbc3d3950e';
export const DIRECTIONS = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
export const SEA_LEVEL = .35;
export const OCEAN_DEPTHS=[8,16,28,44];
export const BUILDING_SCALE = 32; // At 100%, a hex is 55 px across: one structure footprint.
export function hashSeed(value){let h=2166136261;for(const ch of value)h=Math.imul(h^ch.charCodeAt(0),16777619);return h>>>0;}
export function random(seed){return()=>{let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
export function axialToWorld(q,r){return{x:Math.sqrt(3)*(q+r/2),y:1.5*r};}
export function worldToAxial(x,y){const q=x/Math.sqrt(3)-y/3,r=2*y/3;let rx=Math.round(q),rz=Math.round(r),ry=Math.round(-q-r);const dx=Math.abs(rx-q),dz=Math.abs(rz-r),dy=Math.abs(ry+q+r);if(dx>dy&&dx>dz)rx=-ry-rz;else if(dz>dy)rz=-rx-ry;return{q:rx,r:rz,x:rx,y:-rx-rz,z:rz};}
export function offsetToAxial(col,row){return{q:col-Math.floor(row/2),r:row};}
export function axialToOffset(q,r){return{col:q+Math.floor(r/2),row:r};}
export function worldBounds(n){return{width:Math.sqrt(3)*(n-.5),height:1.5*(n-1)};}
const clamp=v=>Math.max(0,Math.min(1,v));
export function generateWorld(config){
 const start=performance.now(),n=config.size;if(![32,64,128,256,512].includes(n))throw Error('Unsupported map size');
 const rand=random(hashSeed(config.seed)),noise=createNoise2D(rand),wetNoise=createNoise2D(rand),rockNoise=createNoise2D(rand);
 const rough=config.roughness/100,large=config.scale/100;
 // Island radii and spacing are world distances, independent of the map dimensions.
 // Each spatial cell has its own seed, so enlarging a map reveals additional terrain.
 const boundsForCenters=worldBounds(n),spacing=16+large*16+112*Math.max(0,large-.5)**2;
 const centerCols=Math.ceil(boundsForCenters.width/spacing),centerRows=Math.ceil(boundsForCenters.height/spacing);
 const centers=new Array(centerCols*centerRows);
 // Low settings are genuinely sparse; the midpoint retains familiar coverage.
 const islandProbability=config.density<=50?.01+.72*Math.pow(clamp((config.density-10)/40),2.5):.73+.26*clamp((config.density-50)/40);
 for(let cy=0;cy<centerRows;cy++)for(let cx=0;cx<centerCols;cx++){
  const islandRandom=random(hashSeed(config.seed+'|island|'+cx+'|'+cy));
  const active=islandRandom()<islandProbability;
  const x=(cx+.5+(islandRandom()-.5)*.55)*spacing,y=(cy+.5+(islandRandom()-.5)*.55)*spacing;
  const radius=(4+large*7+48*Math.max(0,large-.5)**2)*(.65+islandRandom()*.6),angle=islandRandom()*Math.PI*2;
  if(active)centers[cy*centerCols+cx]={x,y,radius,cos:Math.cos(angle),sin:Math.sin(angle),aspect:.65+islandRandom()*.55,phase:islandRandom()*Math.PI*2,bayAngle:islandRandom()*Math.PI*2,bayDepth:.08+islandRandom()*.08};
 }
 const terrainN=n,bounds=worldBounds(n);
 const h=new Float32Array(n*n),moisture=new Float32Array(n*n),rock=new Float32Array(n*n),biomes=new Uint8Array(n*n),data=new Float32Array(terrainN*terrainN*4);
 const culledSources=new Uint8Array(centers.length);
 function field(x,y,markSources=false,excludeCulled=false){
  const u=x/54.5596,v=y/46.5;
  const wx=x+noise(u*3+13,v*3)*1.04,wy=y+noise(u*3,v*3+37)*.884;
  const binX=Math.floor(wx/spacing),binY=Math.floor(wy/spacing);
  let height=.055;
  for(let by=Math.max(0,binY-1);by<=Math.min(centerRows-1,binY+1);by++)for(let bx=Math.max(0,binX-1);bx<=Math.min(centerCols-1,binX+1);bx++){
   const sourceId=by*centerCols+bx,c=centers[sourceId];if(!c||(excludeCulled&&culledSources[sourceId]))continue;
   const dx=wx-c.x,dy=wy-c.y;if(Math.abs(dx)>c.radius*2||Math.abs(dy)>c.radius*2)continue;
   const lx=(dx*c.cos+dy*c.sin)/c.radius,ly=(-dx*c.sin+dy*c.cos)/(c.radius*c.aspect),angle=Math.atan2(ly,lx);
   const shape=1+(.13+rough*.08)*Math.sin(angle*2+c.phase)+(.10+rough*.07)*Math.sin(angle*3-c.phase)+rough*.07*Math.sin(angle*5+c.phase);
   const distance=Math.hypot(lx,ly)/shape;
   const bayX=Math.cos(c.bayAngle)*.78,bayY=Math.sin(c.bayAngle)*.78;
   const bay=c.bayDepth*Math.exp(-((lx-bayX)**2+(ly-bayY)**2)/.13);
   const elevation=.35+(1-distance)*.28-bay;
   if(markSources&&elevation>=.30)culledSources[sourceId]=1;
   height=Math.max(height,elevation);
  }
  // Detail follows coherent island bodies; it cannot seed random land across the ocean.
  const detail=(noise(u*24,v*24)*.023+noise(u*53+60,v*53)*.009)*rough;
  height+=detail*clamp((height-.20)/.13);
  height=clamp(height);
  const wet=clamp(.5+wetNoise(u*6+40,v*6)*.38+(config.moisture-50)*.01);
  const stone=clamp(rockNoise(u*9-20,v*9)*.45+(height-.4)*1.9+config.mountains*.011-.2);
  return[height,wet,stone];
 }

 for(let row=0;row<n;row++)for(let col=0;col<n;col++){
  const i=row*n+col,c=offsetToAxial(col,row),p=axialToWorld(c.q,c.r);
  let[height,wet,stone]=field(p.x,p.y);
  h[i]=height;moisture[i]=wet;rock[i]=stone;
 }
 const {islands,removedIslands,removedTiles}=removeEdgeIslands(h,n);
 if(removedTiles.length){
  // Remove the source of the shelf, not an arbitrary number of water rings.
  for(const i of removedTiles){const c=offsetToAxial(i%n,Math.floor(i/n)),p=axialToWorld(c.q,c.r);field(p.x,p.y,true);}
  for(let row=0;row<n;row++)for(let col=0;col<n;col++){
   const i=row*n+col;if(h[i]>=SEA_LEVEL)continue;
   const c=offsetToAxial(col,row),p=axialToWorld(c.q,c.r);
   // Re-evaluate overlapping shelves from surviving island sources only.
   h[i]=Math.min(SEA_LEVEL-.001,field(p.x,p.y,false,true)[0]);
  }
  clearOrphanShelves(h,n);
 }
 const depth=new Float32Array(n*n),oceanLevels=new Uint8Array(n*n);
 const oceanNoise=createNoise2D(random(hashSeed(config.seed+'|bathymetry')));
 let land=0;const counts=[0,0,0,0,0,0];
 for(let row=0;row<n;row++)for(let col=0;col<n;col++){
  const i=row*n+col;
  if(col===0||row===0||col===n-1||row===n-1)h[i]=0;
  const height=h[i],wet=moisture[i],stone=rock[i];
  let type=0;if(height>=.35){land++;type=height<.4?1:stone>.52?5:wet<.34?4:wet>.62?3:2;}else if(height>.26)type=1;
  if(height<SEA_LEVEL){
   if(height>.26)depth[i]=(SEA_LEVEL-height)*50;
   else{const p=axialToWorld(col-Math.floor(row/2),row),v=oceanNoise(p.x/18,p.y/18)*.75+oceanNoise(p.x/7+31,p.y/7-19)*.25;
    const level=v<-.30?1:v<0?2:v<.30?3:4;oceanLevels[i]=level;depth[i]=OCEAN_DEPTHS[level-1];}
  }
  biomes[i]=type;counts[type]++;data[i*4]=height;data[i*4+1]=wet;data[i*4+2]=stone;data[i*4+3]=1;
 }
 return{config,n,terrainN,bounds,depth,oceanLevels,h,moisture,rock,biomes,data,islands,removedIslands,land,counts,generationMs:performance.now()-start};
}
// Inspect unmasked geography first: deleting only the rim would leave chopped islands.
export function removeEdgeIslands(h,n){
 const visited=new Uint8Array(n*n),queue=new Int32Array(n*n),islands=[],removed=[];let removedIslands=0;
 for(let i=0;i<n*n;i++){
  if(h[i]<.35||visited[i])continue;let head=0,tail=1,cq=0,cr=0,touchesEdge=false;queue[0]=i;visited[i]=1;
  while(head<tail){const j=queue[head++],col=j%n,row=(j/n)|0,{q,r}=offsetToAxial(col,row);cq+=q;cr+=r;if(col===0||row===0||col===n-1||row===n-1)touchesEdge=true;
   for(const[dq,dr]of DIRECTIONS){const next=axialToOffset(q+dq,r+dr);if(next.col<0||next.row<0||next.col>=n||next.row>=n)continue;const k=next.row*n+next.col;if(!visited[k]&&h[k]>=.35){visited[k]=1;queue[tail++]=k;}}
  }
  if(touchesEdge){removedIslands++;for(let j=0;j<tail;j++){h[queue[j]]=0;removed.push(queue[j]);}}else islands.push({originIndex:i,tiles:tail,q:cq/tail,r:cr/tail});
 }
 islands.sort((a,b)=>b.tiles-a.tiles);
 return{islands,removedIslands,removedTiles:removed};
}
// Eliminate isolated shelf remnants; connected shelves around retained land remain intact.
export function clearOrphanShelves(h,n){
 const reached=new Uint8Array(n*n),queue=new Int32Array(n*n);let head=0,tail=0;
 for(let i=0;i<h.length;i++)if(h[i]>=SEA_LEVEL){reached[i]=1;queue[tail++]=i;}
 while(head<tail){const i=queue[head++],{q,r}=offsetToAxial(i%n,Math.floor(i/n));
  for(const[dq,dr]of DIRECTIONS){const c=axialToOffset(q+dq,r+dr);if(c.col<0||c.row<0||c.col>=n||c.row>=n)continue;const j=c.row*n+c.col;
   if(!reached[j]&&h[j]>.055001){reached[j]=1;queue[tail++]=j;}
  }
 }
 for(let i=0;i<h.length;i++)if(!reached[i]&&h[i]>.055001)h[i]=.055;
}
export function sampleWorld(world,x,y){const c=worldToAxial(x,y),offset=axialToOffset(c.q,c.r);if(offset.col<0||offset.row<0||offset.col>=world.n||offset.row>=world.n)return null;const i=offset.row*world.n+offset.col;return{...c,...offset,height:world.h[i],depth:world.depth?.[i]??Math.max(0,(SEA_LEVEL-world.h[i])*50),oceanLevel:world.oceanLevels?.[i]??0,moisture:world.moisture[i],rock:world.rock[i],biome:world.biomes[i]};}
