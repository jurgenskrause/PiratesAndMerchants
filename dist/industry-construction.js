import {industryMarker} from './industry-markers.js?v=babbc3d3950e';
import {industryRegistry} from './simulation-registry.js?v=babbc3d3950e';
import {settingsForWorld} from './compiled-configuration.js?v=babbc3d3950e';
import {describeIndustryInstance} from './industry-contract.js?v=babbc3d3950e';
import {findFeederRoad,connectFeederIndustry} from './feeder-roads.js?v=babbc3d3950e';
import {tileIndex,tileCoordinates,hexDistance} from './hex-topology.js?v=babbc3d3950e';
import {ROAD_DIRECTIONS} from './road-network.js?v=babbc3d3950e';
import {axialToWorld} from './world.js?v=babbc3d3950e';

// Material/capital commitments are authoritative in the economy. This adapter
// owns placement and elapsed time; no investment decisions or manufacturing.
export class IndustryConstructionEngine {
 constructor({world,economy,traffic=null,registry=industryRegistry,afterPlacement=()=>{}}){Object.assign(this,{world,economy,traffic,registry,afterPlacement});this.active=new Map();this.serial=0;world.industryConstructionSites??=[];}
 port(id){const port=this.world.ports.find(p=>p.id===id);if(!port)throw Error('Unknown parent port');return port;}
 occupied(){return new Set([...(this.world.industries??[]).map(i=>i.tileIndex??tileIndex(this.world,i)),...this.world.industryConstructionSites.flatMap(s=>[s.tileIndex,...s.path.map(c=>tileIndex(this.world,c))]),...this.world.ports.flatMap(p=>[p.landIndex,...(p.townTiles??[]),...(p.docks??[]).map(d=>d.landIndex),...(p.buildings??[]).map(b=>tileIndex(this.world,b)),...(p.roadTiles??[]).map(r=>tileIndex(this.world,r))])]);}
 roadWorld(){return {...this.world,ports:this.world.ports.map(p=>({...p,roadTiles:[...(p.roadTiles??[]),...this.world.industryConstructionSites.filter(s=>s.portId===p.id).flatMap(s=>s.path.slice(1).map(c=>({...c,mask:0})))]})),industries:[...(this.world.industries??[]),...this.world.industryConstructionSites]};}
 plan(port,typeId,site=null){
  const d=this.registry.get(typeId);describeIndustryInstance(d,{instanceId:'validation',portId:port.id},this.economy.commodityRegistry.ids());
  const w=this.world,occupied=this.occupied(),config=settingsForWorld(w).roads,core=tileCoordinates(w,port.landIndex),staged=this.roadWorld();
  if(site&&(!Number.isInteger(site.q)||!Number.isInteger(site.r)))throw Error('Invalid industry site');
  const candidates=site?[site]:Array.from({length:w.n*w.n},(_,id)=>tileCoordinates(w,id)).filter(c=>hexDistance(c,core)<=config.radius).sort((a,b)=>hexDistance(a,core)-hexDistance(b,core)||tileIndex(w,a)-tileIndex(w,b));
  for(const c of candidates){const id=tileIndex(w,c),biome=(w.terrainBiomes??w.biomes)?.[id];if(id<0||occupied.has(id)||w.h[id]<d.placement.min_height||w.h[id]>=config.mountainHeight||!d.placement.biomes.includes(biome))continue;
   const route=findFeederRoad(staged,staged.ports.find(p=>p.id===port.id),c);if(route.path.length)return {...c,tileIndex:id,path:route.path};
  }
  throw Error('No safe industry site and isolated road connection');
 }
 start({portId,typeId,site=null,id=null},effects={}){
  if(id===null){const projects=this.economy.getIndustryProjects();do{id='factory-build-'+(++this.serial);}while(projects.some(p=>p.id===id));}const prior=this.economy.getIndustryProjects().find(p=>p.id===id);
  if(prior){if(prior.portId!==portId||prior.typeId!==typeId||site&&(prior.site.q!==site.q||prior.site.r!==site.r))throw Error('Conflicting construction identity');return prior;}
  const port=this.port(portId),planned=this.plan(port,typeId,site),instanceId='factory:'+id,before=structuredClone(this.world.industryConstructionSites);
  const result=this.economy.beginIndustryConstruction({id,instanceId,portId,typeId,site:planned},{apply:()=>{this.world.industryConstructionSites.push({...planned,id,portId});effects.apply?.();},rollback:()=>{this.world.industryConstructionSites=before;effects.rollback?.();}});
  this.serial++;this.active.set(id,{error:null,retrySeconds:0});return result;
 }
 snapshot(){return this.economy.getIndustryProjects().map(p=>({...p,error:this.active.get(p.id)?.error??null}));}
 checkpoint(port){const w=this.world;return {worldKeys:new Set(Object.keys(w)),portKeys:new Set(Object.keys(port)),industries:[...(w.industries??[])],sites:structuredClone(w.industryConstructionSites),roads:structuredClone(port.roadTiles??[]),revision:port.infrastructureRevision,biomes:w.biomes?.slice(),data:w.data?.slice(),terrain:w.terrainBiomes?.slice(),roadIds:[...(w.roadTileIndices??[])],counts:w.counts?.slice()};}
 restore(port,b){const w=this.world;w.industries=b.industries;w.industryConstructionSites=b.sites;port.roadTiles=b.roads;port.infrastructureRevision=b.revision;if(b.biomes)w.biomes.set(b.biomes);if(b.data)w.data.set(b.data);w.terrainBiomes=b.terrain;w.roadTileIndices=b.roadIds;w.counts=b.counts;for(const key of ['terrainBiomes','roadTileIndices','counts','industries'])if(!b.worldKeys.has(key))delete w[key];for(const key of ['roadTiles','infrastructureRevision'])if(!b.portKeys.has(key))delete port[key];}
 publish(port){this.traffic?.infrastructureChanges.set(port.id,{...this.traffic.infrastructureChanges.get(port.id),id:port.id,roadTiles:structuredClone(port.roadTiles),infrastructureRevision:port.infrastructureRevision,industries:structuredClone(this.world.industries.filter(i=>i.portId===port.id))});}
 complete(id){
  const p=this.economy.getIndustryProjects().find(p=>p.id===id);if(!p)throw Error('Unknown construction');if(p.state!=='BUILDING')return p;
  const port=this.port(p.portId),d=this.registry.get(p.typeId),before=this.checkpoint(port);
  const factory={id:p.instanceId,instanceId:p.instanceId,type:p.typeId,portId:p.portId,portName:port.name,name:d.display_name,code:d.graphics.atlas_frame+1,commodity:this.economy.commodityRegistry.get(d.outputs[0].commodity_id).name,q:p.site.q,r:p.site.r,tileIndex:p.site.tileIndex,position:axialToWorld(p.site.q,p.site.r),constructionProjectId:id,productionMode:d.manufacturing.runtime_enabled?'ELAPSED_SIMULATION_TIME':'NOT_ACTIVATED'};
  const result=this.economy.completeIndustryConstruction(id,{apply:()=>{
   // Revalidate against current foreign roads and all other reserved sites.
   const occupied=new Set([...(this.world.industries??[]).map(i=>i.tileIndex),...this.world.ports.flatMap(p=>[p.landIndex,...(p.townTiles??[]),...(p.buildings??[]).map(b=>tileIndex(this.world,b)),...(p.roadTiles??[]).map(r=>tileIndex(this.world,r))])]);if(occupied.has(factory.tileIndex)||!d.placement.biomes.includes((this.world.terrainBiomes??this.world.biomes)?.[factory.tileIndex])||this.world.h[factory.tileIndex]<d.placement.min_height)throw Error('Industry site is no longer available');
   const staged=this.roadWorld();staged.industries=staged.industries.filter(i=>i.id!==id);
   if(!findFeederRoad(staged,staged.ports.find(x=>x.id===port.id),factory).path.length)throw Error('Industry road placement is no longer available');
   this.world.industries??=[];this.world.industries.push(factory);
   const route=connectFeederIndustry(this.world,port,factory);if(!route.path.length)throw Error('Industry road placement failed');
   this.world.industryConstructionSites=this.world.industryConstructionSites.filter(s=>s.id!==id);
   if(this.world.data)this.world.data[factory.tileIndex*4+3]=industryMarker(factory.code);
   this.afterPlacement(factory);
  },rollback:()=>this.restore(port,before)});
  this.active.delete(id);this.publish(port);return result;
 }
 tick(dt){if(!Number.isFinite(dt)||dt<=0)throw RangeError('Construction step');for(const [id,status] of this.active){const p=this.economy.advanceIndustryConstruction(id,dt);status.retrySeconds-=dt;if(p.elapsedSeconds+1e-8>=p.durationSeconds&&status.retrySeconds<=0){try{this.complete(id);}catch(error){status.error=error.message;status.retrySeconds=1;}}}}
 remove(instanceId){const p=this.economy.getIndustryProjects().find(p=>p.instanceId===instanceId);if(!p)throw Error('Unknown constructed factory');if(p.state==='REMOVED')return p;const port=this.port(p.portId),before=this.checkpoint(port),factory=this.world.industries.find(i=>i.id===instanceId);
  const result=this.economy.removeConstructedIndustry(instanceId,{apply:()=>{this.world.industries=this.world.industries.filter(i=>i.id!==instanceId);if(factory){for(const r of port.roadTiles??[]){for(const d of ROAD_DIRECTIONS)if(r.q+d.q===factory.q&&r.r+d.r===factory.r)r.mask&=~d.bit;}if(this.world.data)this.world.data[factory.tileIndex*4+3]=1;}port.infrastructureRevision=(port.infrastructureRevision??0)+1;},rollback:()=>this.restore(port,before)});
  this.publish(port);return result;
 }
}
