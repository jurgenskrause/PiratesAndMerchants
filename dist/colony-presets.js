import {settingsForWorld} from './compiled-configuration.js?v=babbc3d3950e';
import {colonyPresetRegistry,townBuildingRegistry,settlementRegistry} from './simulation-registry.js?v=babbc3d3950e';
import {dockRecord,dockFootprint,dockCandidates} from './port-infrastructure.js?v=babbc3d3950e';
import {hexNeighbors,hexDistance,tileIndex,tileCoordinates} from './hex-topology.js?v=babbc3d3950e';
import {hashSeed,random,SEA_LEVEL} from './world.js?v=babbc3d3950e';
import {roadMasks} from './road-network.js?v=babbc3d3950e';
import {replaceRoadTerrain} from './feeder-roads.js?v=babbc3d3950e';

const rotate=(c,steps)=>{let {q,r}=c;for(let i=0;i<steps;i++)[q,r]=[-r,q+r];return {q,r};};
function proposal(world,port,preset,ports,occupied){
 const settings=settingsForWorld(world),core=port.land,owned=new Set([port.landIndex]),cells=[core],types=preset.tile_layout.town_tiles,desired=types.length;
 const valid=c=>{const i=tileIndex(world,c);return i>=0&&!occupied.has(i)&&!owned.has(i)&&world.h[i]>=SEA_LEVEL&&world.h[i]<settings.roads.mountainHeight&&(world.terrainBiomes??world.biomes)[i]!==5;};
 const rotation=(port.attachmentEdge+3)%6;
 for(const tile of types){const d=rotate(tile,rotation),c={q:core.q+d.q,r:core.r+d.r};if(valid(c)&&hexNeighbors(c).some(n=>owned.has(tileIndex(world,n)))){cells.push(c);owned.add(tileIndex(world,c));}}
 // A bounded frontier adapts an authored layout to the actual connected coastline.
 for(let head=0;head<cells.length&&cells.length<=desired;head++)for(const c of hexNeighbors(cells[head]).sort((a,b)=>tileIndex(world,a)-tileIndex(world,b))){if(cells.length>desired)break;if(valid(c)&&hexDistance(core,c)<=5){cells.push(c);owned.add(tileIndex(world,c));}}
 if(cells.length!==desired+1)return null;
 // Small population presets must not downgrade infrastructure assigned for fleet access.
 const firstType=preset.tier==='small'?(port.docks[0]?.dockTypeId??preset.tile_layout.docks[0].type):preset.tile_layout.docks[0].type;if(!dockFootprint(world,core,port.water,firstType).length)return null;
 const raw={...port,townTiles:[...owned],docks:[dockRecord(world,port,core,port.water,firstType,port.id+':dock:0')]};
 const local={...world,ports:[raw,...ports.filter(p=>p.id!==port.id)],industries:[]};
 for(const d of preset.tile_layout.docks.slice(1)){
  const offset=rotate(d,rotation),preferred={q:core.q+offset.q,r:core.r+offset.r};
  const candidates=dockCandidates(local,raw,d.type,{ports:local.ports,industries:[]}).filter(d=>!occupied.has(d.landIndex)).sort((a,b)=>hexDistance(a.land,preferred)-hexDistance(b.land,preferred)||a.landIndex-b.landIndex||a.waterIndex-b.waterIndex);
  const dock=candidates[0];if(!dock)return null;raw.docks.push(dock);owned.add(dock.landIndex);raw.townTiles=[...owned];
 }
 const rng=random(hashSeed(world.config.seed+'|colony-buildings|'+port.id));
 raw.buildings=cells.slice(1).map((c,i)=>({q:c.q,r:c.r,buildingTypeId:types[i].building,variant:Math.floor(rng()*townBuildingRegistry.get(types[i].building).variants.length),builtTick:0,faction:port.faction}));
 raw.capacity=settlementRegistry.get('port').urban_growth.initial_capacity+raw.buildings.reduce((n,b)=>n+townBuildingRegistry.get(b.buildingTypeId).housing_capacity,0);
 if(raw.capacity<preset.initial_population)return null;
 raw.population=preset.initial_population;raw.prosperity=preset.initial_prosperity;raw.colonyPresetId=preset.id;raw.colonyTier=preset.tier;raw.colonyName=preset.settlement_type;raw.initialStockMultipliers={trade:preset.trade_stock_multiplier,consumption:preset.consumption_stock_multiplier};
 raw.roadTiles=preset.tile_layout.feeder_roads?roadMasks(raw.townTiles.map(i=>tileCoordinates(world,i))):[];raw.initialRoadTiles=structuredClone(raw.roadTiles);raw.infrastructureRevision=0;
 return raw;
}
export function initializeColonyPresets(world,ports){
 const occupied=new Set(ports.flatMap(p=>[p.landIndex,...p.docks.map(d=>d.landIndex)])),seed=world.config.seed,ordered=[...ports].sort((a,b)=>b.islandTiles-a.islandTiles||hashSeed(seed+'|tier|'+a.id)-hashSeed(seed+'|tier|'+b.id)||a.id.localeCompare(b.id));
 const target={large:ports.length>=10?2:1,medium:Math.min(5,Math.max(3,Math.floor(ports.length/6)))},counts={large:0,medium:0,small:0},assigned=new Set(),telemetry={requested:target,counts,terrainLimited:0};
 for(const tier of ['large','medium']){
  const preset=colonyPresetRegistry.values().find(p=>p.tier===tier);
  // Medium settlements favour factions without a hub, retaining deep-water access.
  const candidates=[...ordered].sort((a,b)=>tier==='medium'?Number(ports.some(p=>assigned.has(p.id)&&p.faction===a.faction))-Number(ports.some(p=>assigned.has(p.id)&&p.faction===b.faction))||b.islandTiles-a.islandTiles:0);
  for(const port of candidates){if(counts[tier]>=target[tier])break;if(assigned.has(port.id)||port.islandTiles<preset.min_island_tiles)continue;const reserved=new Set(occupied);reserved.delete(port.landIndex);const raw=proposal(world,port,preset,ports,reserved);if(!raw){telemetry.terrainLimited++;continue;}Object.assign(port,raw);assigned.add(port.id);counts[tier]++;for(const i of port.townTiles)occupied.add(i);}
 }
 const small=colonyPresetRegistry.values().find(p=>p.tier==='small');
 for(const port of ports){if(assigned.has(port.id))continue;const reserved=new Set(occupied);reserved.delete(port.landIndex);let raw=proposal(world,port,small,ports,reserved);if(!raw){raw={colonyPresetId:small.id,colonyTier:'small',colonyName:small.settlement_type,population:50,capacity:50,prosperity:1,townTiles:[port.landIndex],buildings:[],roadTiles:[],initialRoadTiles:[],initialStockMultipliers:{trade:1,consumption:1}};telemetry.terrainLimited++;}Object.assign(port,raw);counts.small++;}
 for(const port of ports)replaceRoadTerrain(world,port.roadTiles);world.colonyTelemetry=telemetry;return ports;
}
