import {settingsForWorld,DEFAULT_SUBSYSTEM_SETTINGS} from './compiled-configuration.js?v=babbc3d3950e';
import {replaceRoadTerrain} from './feeder-roads.js?v=babbc3d3950e';
import {townBuildingRegistry,settlementRegistry} from './simulation-registry.js?v=babbc3d3950e';
import {hashSeed,random,SEA_LEVEL} from './world.js?v=babbc3d3950e';
import {tileIndex,tileCoordinates,hexNeighbors} from './hex-topology.js?v=babbc3d3950e';
import {ROAD_DIRECTIONS} from './road-network.js?v=babbc3d3950e';
import {availableStock} from './economy.js?v=babbc3d3950e';
const raw=p=>p.source??p;
export class GridManager{
 constructor(world){this.world=world;this.settings=settingsForWorld(world).roads;this.configurationRevision=this.settings.revision;this.refresh();}
 refresh(){const world=this.world;this.owners=new Map();this.reserved=new Set([...(world.industries??[]).map(i=>i.tileIndex??tileIndex(world,i)),...(world.industryConstructionSites??[]).flatMap(s=>[s.tileIndex,...s.path.map(c=>tileIndex(world,c))])]);for(const p of world.ports??[]){const s=raw(p);for(const id of this.owned(s))this.owners.set(id,s.id);for(const r of s.roadTiles??[])if(!this.owners.has(tileIndex(world,r)))this.owners.set(tileIndex(world,r),'road:'+s.id);}}
 owned(s){return [...new Set([s.landIndex,...(s.townTiles??[]),...(s.docks??[]).map(d=>d.landIndex),...(s.buildings??[]).map(b=>tileIndex(this.world,b))].filter(Number.isInteger))];}
 valid(id){const w=this.world;return id>=0&&Number.isFinite(w.h[id])&&w.h[id]>=SEA_LEVEL&&w.h[id]<this.settings.mountainHeight&&(w.terrainBiomes??w.biomes)?.[id]!==5&&!this.reserved.has(id);}
}
export class SettlementManager{
 constructor(world){this.world=world;this.settlements=new Map((world.ports??[]).filter(p=>Number.isInteger(raw(p).landIndex)).map(p=>{const s=raw(p),profile=settlementRegistry.get(s.settlementType??'port');s.population??=profile.urban_growth.initial_population;s.capacity??=profile.urban_growth.initial_capacity+(s.buildings??[]).reduce((n,b)=>n+(b.derelict?0:townBuildingRegistry.get(b.buildingTypeId).housing_capacity),0);return [s.id,s];}));}
}
export class CandidateHexEvaluator{
 constructor(grid,options={}){this.grid=grid;this.options={base_weight:1,coastal_bonus:1.5,road_weight:1,selection:'weighted',...options};for(const key of ['base_weight','coastal_bonus','road_weight'])if(!Number.isFinite(this.options[key])||this.options[key]<0)throw RangeError('Expansion weights');if(this.options.base_weight===0||!['weighted','maximum'].includes(this.options.selection))throw RangeError('Expansion selection');}
 candidates(s){const w=this.grid.world,roads=new Map((s.roadTiles??[]).map(r=>[tileIndex(w,r),r])),ids=new Set(),connected=new Set(this.grid.owned(s)),queue=[...connected];
  for(let head=0;head<queue.length;head++){const c=tileCoordinates(w,queue[head]),a=roads.get(queue[head]);if(!a)continue;for(const [k,d] of ROAD_DIRECTIONS.entries()){const id=tileIndex(w,{q:c.q+d.q,r:c.r+d.r}),b=roads.get(id);if(b&&!connected.has(id)&&(a.mask&d.bit)&&(b.mask&ROAD_DIRECTIONS[(k+3)%6].bit)){connected.add(id);queue.push(id);}}}
for(const id of this.grid.owned(s))for(const c of hexNeighbors(tileCoordinates(w,id))){const next=tileIndex(w,c),owner=this.grid.owners.get(next);if(this.grid.valid(next)&&(!owner||owner==='road:'+s.id))ids.add(next);}
  return [...ids].sort((a,b)=>a-b).map(id=>{const c=tileCoordinates(w,id),neighbors=hexNeighbors(c),coastal=neighbors.some(n=>{const i=tileIndex(w,n);return i>=0&&w.h[i]<SEA_LEVEL;}),sprawl=neighbors.reduce((n,c)=>{const r=roads.get(tileIndex(w,c));return n+(r?.mask&&connected.has(tileIndex(w,c))?(r.weight??this.options.road_weight):0);},0);return {...c,tileIndex:id,score:this.options.base_weight+(coastal?this.options.coastal_bonus:0)+sprawl,coastal,sprawl};});
 }
 select(candidates,rng){if(!candidates.length)return null;if(this.options.selection==='maximum')return candidates.reduce((a,b)=>b.score>a.score?b:a);let draw=rng()*candidates.reduce((n,c)=>n+c.score,0);for(const c of candidates){draw-=c.score;if(draw<0)return c;}return candidates.at(-1);}
}
export class CostInspector{
 constructor(economy){this.economy=economy;}
 inspect(id,cost){try{for(const [c,q] of Object.entries(cost)){if(c==='gold')continue;const offers=this.economy.getFundedMarket(id).offers,automatic=new Set(offers.filter(o=>o.automatic&&o.sellerAccountId===`PORT:${encodeURIComponent(id)}`).map(o=>o.reservationId)),available=this.economy.getGoods({ownerAccountId:`PORT:${encodeURIComponent(id)}`,location:`MARKET:${encodeURIComponent(id)}`,commodityId:c}).filter(r=>r.reservationId===null||automatic.has(r.reservationId)).reduce((n,r)=>n+r.quantity,0);if(available<q)return false;}return true;}catch{return false;}}
}
export class ConstructionGate{
 constructor(economy,inspector=new CostInspector(economy)){this.economy=economy;this.inspector=inspector;}
 execute(s,cost,effects,options={}){if(!this.inspector.inspect(s.id,cost))return {ok:false,reason:'RESOURCE_DEFICIT'};const result=this.economy.purchaseInfrastructure(s.id,cost,{...options,...effects,withdrawAutomaticOffers:true});return result.ok?{ok:true}:{ok:false,reason:result.error.code==='CONSTRUCTION_FAILED'?'CONSTRUCTION_FAILED':'RESOURCE_DEFICIT'};}
}
export class UrbanExpansionEngine{
 constructor({world,economy,traffic,scaling,options={},onEvent=()=>{}}){Object.assign(this,{world,economy,traffic,onEvent});this.grid=new GridManager(world);this.manager=new SettlementManager(world);this.gate=new ConstructionGate(economy);this.options=options;this.cycles=new Map();this.next=new Map();this.events=[];let i=0;const ratio=Math.max(.1,(scaling?.metrics.averageTransitDistance??DEFAULT_SUBSYSTEM_SETTINGS.scaling.referenceDistance)/(scaling?.settings.referenceDistance??DEFAULT_SUBSYSTEM_SETTINGS.scaling.referenceDistance)*(scaling?.settings.mapScaleFactor??DEFAULT_SUBSYSTEM_SETTINGS.scaling.mapScaleFactor));this.scale=ratio;for(const s of this.manager.settlements.values()){this.cycles.set(s.id,0);this.next.set(s.id,i++%Math.max(1,Math.ceil(this.settings(s).review_interval_ticks*ratio)));}}
 settings(s){return {...settlementRegistry.get(s.settlementType??'port').urban_growth,...this.options};}
 emit(event){this.events.push(event);if(this.events.length>64)this.events.shift();try{this.onEvent(event);}catch{}return event;}
 cycle(id,tick=0,transactionOptions={}){
  const s=this.manager.settlements.get(id);if(!s||s.population<s.capacity)return {status:'IDLE'};this.grid.refresh();const config=this.settings(s),evaluator=new CandidateHexEvaluator(this.grid,config),candidates=evaluator.candidates(s);if(!candidates.length)return {status:'NO_CANDIDATE'};
  const cycle=this.cycles.get(id)??0;this.cycles.set(id,cycle+1);const rng=random(hashSeed((this.world.config?.seed??'world')+'|urban|'+id+'|'+cycle)),target=evaluator.select(candidates,rng),definition=townBuildingRegistry.get(config.housing_type);
  const before={townTiles:s.townTiles,buildings:s.buildings,roadTiles:s.roadTiles,capacity:s.capacity,infrastructureRevision:s.infrastructureRevision},present=new Set(Object.keys(s)),worldPresent=new Set(Object.keys(this.world)),owner=this.grid.owners.get(target.tileIndex),roads=new Map((s.roadTiles??[]).map(r=>[tileIndex(this.world,r),{...r}]));
  for(const index of [...this.grid.owned(s),target.tileIndex])if(this.grid.valid(index)&&!roads.has(index))roads.set(index,{...tileCoordinates(this.world,index),mask:0});
  const road=roads.get(target.tileIndex);for(const [k,d] of ROAD_DIRECTIONS.entries()){const neighbor=roads.get(tileIndex(this.world,{q:target.q+d.q,r:target.r+d.r}));if(neighbor){road.mask|=d.bit;neighbor.mask|=ROAD_DIRECTIONS[(k+3)%6].bit;}}
  const nextRoads=[...roads.values()].sort((a,b)=>tileIndex(this.world,a)-tileIndex(this.world,b)),building={q:target.q,r:target.r,buildingTypeId:definition.id,variant:Math.floor(rng()*definition.variants.length),builtTick:tick};
  const terrainBefore={terrainBiomes:this.world.terrainBiomes,roadTileIndices:[...(this.world.roadTileIndices??[])],counts:this.world.counts?.slice(),tiles:nextRoads.map(r=>{const i=tileIndex(this.world,r);return [i,this.world.biomes?.[i],this.world.data?.[i*4+3]];})};
  const result=this.gate.execute(s,definition.build_cost,{commit:()=>{s.townTiles=[...new Set([...(s.townTiles??[]),target.tileIndex])];s.buildings=[...(s.buildings??[]),building];s.roadTiles=nextRoads;s.capacity+=definition.housing_capacity;s.infrastructureRevision=(s.infrastructureRevision??0)+1;this.grid.owners.set(target.tileIndex,id);replaceRoadTerrain(this.world,nextRoads);transactionOptions.afterPlacement?.();},rollback:()=>{Object.assign(s,before);for(const key of Object.keys(before))if(!present.has(key))delete s[key];this.world.terrainBiomes=terrainBefore.terrainBiomes;this.world.roadTileIndices=terrainBefore.roadTileIndices;if(terrainBefore.counts)this.world.counts=terrainBefore.counts;for(const [i,b,m] of terrainBefore.tiles){if(this.world.biomes)this.world.biomes[i]=b;if(this.world.data)this.world.data[i*4+3]=m;}for(const key of ['terrainBiomes','roadTileIndices','counts'])if(!worldPresent.has(key))delete this.world[key];if(owner===undefined)this.grid.owners.delete(target.tileIndex);else this.grid.owners.set(target.tileIndex,owner);}},{afterDeduction:transactionOptions.afterDeduction});
  if(!result.ok){this.emit({type:'ExpansionHaltedEvent',reason:result.reason,settlement_id:id,tick});return {status:'HALTED',reason:result.reason};}
  this.traffic?.infrastructureChanges.set(id,{id,docks:structuredClone(s.docks??[]),townTiles:[...s.townTiles],buildings:structuredClone(s.buildings),roadTiles:structuredClone(s.roadTiles),population:s.population,capacity:s.capacity,infrastructureRevision:s.infrastructureRevision});this.emit({type:'SettlementExpandedEvent',settlement_id:id,tick,tileIndex:target.tileIndex});return {status:'BUILT',target,building};
 }
 tick(tick){for(const s of this.manager.settlements.values()){if(tick<(this.next.get(s.id)??0))continue;this.next.set(s.id,tick+Math.max(1,Math.ceil(this.settings(s).review_interval_ticks*this.scale)));this.cycle(s.id,tick);}}
}
