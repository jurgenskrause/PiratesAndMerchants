import {settingsForWorld} from './compiled-configuration.js?v=babbc3d3950e';
import {SEA_LEVEL} from './world.js?v=babbc3d3950e';
import {tileIndex,tileCoordinates,hexDistance} from './hex-topology.js?v=babbc3d3950e';
import {ROAD_DIRECTIONS} from './road-network.js?v=babbc3d3950e';

class Heap{
 constructor(){this.items=[];}
 less(a,b){return a.f<b.f||(a.f===b.f&&(a.g<b.g||(a.g===b.g&&a.id<b.id)));}
 push(value){let i=this.items.length;this.items.push(value);while(i){const p=(i-1)>>1;if(!this.less(value,this.items[p]))break;this.items[i]=this.items[p];i=p;}this.items[i]=value;}
 pop(){const first=this.items[0],last=this.items.pop();if(this.items.length){let i=0;while(i*2+1<this.items.length){let c=i*2+1;if(c+1<this.items.length&&this.less(this.items[c+1],this.items[c]))c++;if(!this.less(this.items[c],last))break;this.items[i]=this.items[c];i=c;}this.items[i]=last;}return first;}
}
export const ROAD_BIOME=6,ROAD_MARKER=5;
const originalBiome=(world,id)=>(world.terrainBiomes??world.biomes)?.[id];
const settings=(world,options)=>({...settingsForWorld(world).roads,...options});
const land=(world,id)=>id>=0&&Number.isFinite(world.h[id])&&world.h[id]>=SEA_LEVEL;
const passable=(world,id,config)=>land(world,id)&&originalBiome(world,id)!==5&&world.h[id]<config.mountainHeight;
export function resetRoadTerrain(world){
 if(world.terrainBiomes&&world.biomes)world.biomes.set(world.terrainBiomes);
 if(world.data)for(const id of world.roadTileIndices??[])if(world.data[id*4+3]===ROAD_MARKER)world.data[id*4+3]=1;
 world.roadTileIndices=[];
 if(world.counts&&world.biomes){world.counts=new Array(7).fill(0);for(const biome of world.biomes)world.counts[biome]++;}
 for(const port of world.ports??[]){port.roadTiles=structuredClone(port.initialRoadTiles??[]);replaceRoadTerrain(world,port.roadTiles);}
}
export function replaceRoadTerrain(world,roads){
 if(!world.biomes)return;
 world.terrainBiomes??=world.biomes.slice();world.roadTileIndices??=[];
 for(const road of roads){const id=tileIndex(world,road);if(world.biomes[id]===ROAD_BIOME)continue;
  if(world.counts){world.counts[world.biomes[id]]--;world.counts[ROAD_BIOME]=(world.counts[ROAD_BIOME]??0)+1;}
  world.biomes[id]=ROAD_BIOME;if(world.data)world.data[id*4+3]=ROAD_MARKER;world.roadTileIndices.push(id);
 }
}
// Eligibility flood is shared by all candidates for a port, rather than running
// A* for every unsuitable plantation tile. Rocky mine endpoints may abut it.
export function feederReachability(world,port,options={}){
 const config=settings(world,options),reachable=new Set(),core=tileCoordinates(world,port.landIndex),queue=[];
 if(!passable(world,port.landIndex,config))return reachable;reachable.add(port.landIndex);queue.push(port.landIndex);
 for(let head=0;head<queue.length;head++){const c=tileCoordinates(world,queue[head]);for(const d of ROAD_DIRECTIONS){const next={q:c.q+d.q,r:c.r+d.r},id=tileIndex(world,next);if(!reachable.has(id)&&passable(world,id,config)&&hexDistance(core,next)<=config.radius*2){reachable.add(id);queue.push(id);}}}
 return reachable;
}
function network(world,port,config){
 const roads=new Map((port.roadTiles??[]).filter(r=>land(world,tileIndex(world,r))).map(r=>[tileIndex(world,r),{...r}]));
 const roots=new Set([port.landIndex,...(port.townTiles??[])].filter(id=>Number.isInteger(id)&&passable(world,id,config)));
 for(const id of roots)if(!roads.has(id))roads.set(id,{...tileCoordinates(world,id),mask:0});
 // Follow actual reciprocal connections, never isolated decorative road tiles.
 const connected=new Set(roots),queue=[...roots];for(let head=0;head<queue.length;head++){
  const id=queue[head],a=roads.get(id);if(!a)continue;
  ROAD_DIRECTIONS.forEach((d,k)=>{const next=tileIndex(world,{q:a.q+d.q,r:a.r+d.r}),b=roads.get(next);if(b&&!connected.has(next)&&(a.mask&d.bit)&&(b.mask&ROAD_DIRECTIONS[(k+3)%6].bit)){connected.add(next);queue.push(next);}});
 }
 return {roads,roots,connected};
}

// Integer tenths keep deterministic comparisons while preserving costs 1.0 / 0.1.
export function findFeederRoad(world,port,industry,options={}){
 const config=settings(world,options),start=tileIndex(world,industry);
 if(!Number.isInteger(port.landIndex)||!passable(world,port.landIndex,config))return {path:[],cost:0,visited:0,reason:'NO_CORE'};
 const core=tileCoordinates(world,port.landIndex);
 if(!land(world,start))return {path:[],cost:0,visited:0,reason:'INVALID_INDUSTRY'};
 if(hexDistance(industry,core)>config.radius)return {path:[],cost:0,visited:0,reason:'OUT_OF_RANGE'};
 const industries=new Set((options.industries??world.industries??[]).map(i=>tileIndex(world,i)));
 const {roads,roots,connected}=network(world,port,config),goals=new Set([...connected].filter(id=>(id===start||!industries.has(id))&&hexDistance(industry,tileCoordinates(world,id))<=config.radius));
 if(!roots.size||!goals.size)return {path:[],cost:0,visited:0,reason:'NO_CORE'};
 const goalCoordinates=[...goals].map(id=>tileCoordinates(world,id));
 const blocked=new Set((world.ports??[]).filter(p=>p.id!==port.id).flatMap(p=>[p.landIndex,...(p.townTiles??[]),...(p.docks??[]).map(d=>d.landIndex)]));
 // Keep a full hex of visual separation from every foreign catchment network.
 for(const foreign of (world.ports??[]).filter(p=>p.id!==port.id))for(const c of [...(foreign.roadTiles??[]),...([foreign.landIndex,...(foreign.townTiles??[]),...(foreign.docks??[]).map(d=>d.landIndex),...(foreign.buildings??[]).map(b=>tileIndex(world,b))].filter(Number.isInteger).map(id=>tileCoordinates(world,id)))]){
  blocked.add(tileIndex(world,c));for(const d of ROAD_DIRECTIONS)blocked.add(tileIndex(world,{q:c.q+d.q,r:c.r+d.r}));
 }
 if(blocked.has(start))return {path:[],cost:0,visited:0,reason:'FOREIGN_CATCHMENT'};
 for(const id of [...goals])if(blocked.has(id))goals.delete(id);
 if(!goals.size)return {path:[],cost:0,visited:0,reason:'FOREIGN_CATCHMENT'};
 const heuristic=c=>Math.min(...goalCoordinates.map(goal=>hexDistance(c,goal)));
 const open=new Heap(),cost=new Map([[start,0]]),parents=new Map(),closed=new Set();open.push({id:start,g:0,f:heuristic(industry)});let visited=0;
 while(open.items.length&&visited<config.maxNodes){
  const current=open.pop();if(closed.has(current.id)||cost.get(current.id)!==current.g)continue;visited++;closed.add(current.id);
  if(goals.has(current.id)){const path=[];for(let id=current.id;id!==undefined;id=parents.get(id))path.push(tileCoordinates(world,id));return {path:path.reverse(),cost:current.g/10,visited,reason:'CONNECTED'};}
  const a=tileCoordinates(world,current.id);
  for(const d of ROAD_DIRECTIONS){const b={q:a.q+d.q,r:a.r+d.r},id=tileIndex(world,b);
   if(closed.has(id)||!passable(world,id,config)||blocked.has(id)||(industries.has(id)&&id!==start&&!goals.has(id))||hexDistance(core,b)>config.radius*2)continue;
   const g=current.g+(connected.has(id)&&roads.has(id)?1:10);if(g>=(cost.get(id)??Infinity))continue;
   cost.set(id,g);parents.set(id,current.id);open.push({id,g,f:g+heuristic(b)});
  }
 }
 return {path:[],cost:0,visited,reason:open.items.length?'SEARCH_LIMIT':'UNREACHABLE'};
}

export function connectFeederIndustry(world,port,industry,options={}){
 const result=findFeederRoad(world,port,industry,options);if(!result.path.length)return result;
 const roads=new Map((port.roadTiles??[]).map(r=>[tileIndex(world,r),{...r}]));
 // The industry remains an industry tile; roads stop at its edge, including mines.
 for(const c of result.path.slice(1)){const id=tileIndex(world,c);if(!roads.has(id))roads.set(id,{...c,mask:0});}
 // Upgrade both sides of each edge. Adjacent parallel roads do not invent junctions.
 for(let i=1;i<result.path.length;i++){
  const a=result.path[i-1],b=result.path[i],k=ROAD_DIRECTIONS.findIndex(d=>a.q+d.q===b.q&&a.r+d.r===b.r);
  const from=roads.get(tileIndex(world,a)),to=roads.get(tileIndex(world,b));if(from)from.mask|=ROAD_DIRECTIONS[k].bit;if(to)to.mask|=ROAD_DIRECTIONS[(k+3)%6].bit;
 }
 port.roadTiles=[...roads.values()].sort((a,b)=>tileIndex(world,a)-tileIndex(world,b));
 replaceRoadTerrain(world,port.roadTiles);
 port.infrastructureRevision=(port.infrastructureRevision??0)+1;
 industry.roadConnection={portId:port.id,status:'CONNECTED',path:result.path,cost:result.cost};return result;
}

export function generateFeederRoads(world,industries=world.industries??[],options={}){
 const config=settings(world,options),telemetry={connected:0,outOfRange:0,unreachable:0,searchLimited:0,visited:0,tiles:0};
 // Rebuild deterministically when generation is repeated; live additions use connectFeederIndustry.
 resetRoadTerrain(world);
 const ordered=[...industries].sort((a,b)=>tileIndex(world,a)-tileIndex(world,b));
 for(const industry of ordered){delete industry.roadConnection;
  const ports=(world.ports??[]).filter(p=>!industry.portId||p.id===industry.portId).filter(p=>Number.isInteger(p.landIndex)).sort((a,b)=>hexDistance(industry,tileCoordinates(world,a.landIndex))-hexDistance(industry,tileCoordinates(world,b.landIndex))||String(a.id).localeCompare(String(b.id)));
  let result=null;for(const port of ports){if(hexDistance(industry,tileCoordinates(world,port.landIndex))>config.radius)continue;result=connectFeederIndustry(world,port,industry,{...config,industries});telemetry.visited+=result.visited;if(result.path.length)break;}
  if(!result){telemetry.outOfRange++;industry.roadConnection={status:'OUT_OF_RANGE'};}
  else if(result.path.length)telemetry.connected++;
  else{telemetry.unreachable++;if(result.reason==='SEARCH_LIMIT')telemetry.searchLimited++;industry.roadConnection={status:result.reason};}
 }
 telemetry.tiles=(world.ports??[]).reduce((n,p)=>n+(p.roadTiles?.length??0),0);world.roadTelemetry=telemetry;return telemetry;
}
