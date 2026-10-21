import {dockRegistry,settlementRegistry} from './simulation-registry.js?v=babbc3d3950e';
import {tileCategory,tileIndex,tileCoordinates,hexNeighbors,hexDistance,waterDepthAt} from './hex-topology.js?v=babbc3d3950e';
import {DIRECTIONS,axialToWorld,worldToAxial} from './world.js?v=babbc3d3950e';
export const BERTH_SIZES=Object.freeze(['Small','Medium','Large','ExtraLarge']);
export function compatibleDock(dock,spec){const capacity=BERTH_SIZES.indexOf(dockRegistry.get(dock.dockTypeId).required_min_berth_size),required=BERTH_SIZES.indexOf(spec.required_berth_size??'Small');return required>=0&&capacity>=required;}
export const largeVessel=spec=>BERTH_SIZES.indexOf(spec.required_berth_size??'Small')>=2||spec.berthsRequired===2;
// Three seaward directions form a two-ring, 120-degree approach fan.
export function dockApproachFan(tip,direction,radius=2){
 const directions=[(direction+5)%6,direction,(direction+1)%6],cells=new Map();let frontier=[tip];
 for(let ring=0;ring<radius;ring++){const next=[];for(const c of frontier)for(const d of directions){const [dq,dr]=DIRECTIONS[d],p={q:c.q+dq,r:c.r+dr},key=p.q+','+p.r;if(!cells.has(key)){cells.set(key,p);next.push(p);}}frontier=next;}
 return [...cells.values()];
}
export function dockableCells(world,tip,tiles=[]){
 const blocked=new Set(tiles.map(t=>tileIndex(world,t)));
 return hexNeighbors(tip).filter(c=>tileCategory(world,c)==='WATER'&&!blocked.has(tileIndex(world,c))&&hexNeighbors(c).every(n=>tileCategory(world,n)==='WATER')).map(c=>({...c,tileIndex:tileIndex(world,c)}));
}
export function dockFootprint(world,land,water,type){
 const direction=DIRECTIONS.findIndex(([q,r])=>land.q+q===water.q&&land.r+r===water.r);if(direction<0)return [];
 const [dq,dr]=DIRECTIONS[direction],definition=dockRegistry.get(type),tiles=[];
 for(let i=0;i<definition.layout.length_tiles;i++){const c={q:water.q+dq*i,r:water.r+dr*i};if(tileCategory(world,c)!=='WATER'||waterDepthAt(world,c)<definition.min_water_depth)return [];tiles.push({...c,tileIndex:tileIndex(world,c)});}
 const tip=tiles.at(-1);if(!dockApproachFan(tip,direction).every(c=>tileCategory(world,c)==='WATER')||!dockableCells(world,tip,tiles).length)return [];
 return tiles;
}
export function dockRecord(world,port,land,water,type,id){
 const direction=DIRECTIONS.findIndex(([q,r])=>land.q+q===water.q&&land.r+r===water.r);if(direction<0)throw TypeError('Dock must face adjacent water');
 const tiles=dockFootprint(world,land,water,type);if(!tiles.length)throw TypeError('Dock footprint must be clear water');
 const tip=tiles.at(-1),dockingCells=dockableCells(world,tip,tiles);
 return {id,portId:port.id,dockTypeId:type,land:{...land},water:{...water},landIndex:tileIndex(world,land),waterIndex:tileIndex(world,water),tiles,tip:{q:tip.q,r:tip.r},dockingCells,dockPosition:axialToWorld(tip.q,tip.r),harborPosition:axialToWorld(land.q,land.r),attachmentEdge:(direction+3)%6,rotation:direction*60};
}
export function initializePortInfrastructure(world,port){
 const raw=port.source??port;raw.id??=port.id;raw.name??=port.name;if(raw.docks?.length)return raw;const profile=settlementRegistry.get(raw.settlementType??'port');raw.townTiles??=Number.isInteger(raw.landIndex)?[raw.landIndex]:[];
 const position=raw.dockPosition??port.position,water=raw.water??worldToAxial(position.x,position.y),land=raw.land??(raw.harborPosition?worldToAxial(raw.harborPosition.x,raw.harborPosition.y):null),rotation=raw.harborPosition?((Math.round(Math.atan2(raw.harborPosition.y-position.y,position.x-raw.harborPosition.x)*180/Math.PI/60)*60)%360+360)%360:0;
 // Old headless callers have arbitrary world-space docks. Keep their established geometry;
 // only generated/new coastal construction uses the strict adjacent-hex record constructor.
 let type=raw.initialDockType??profile.initial_dock_type;if(raw.land&&raw.water){const available=dockRegistry.values().filter(d=>dockFootprint(world,land,water,d.id).length);type=available.find(d=>d.id===type)?.id??available.at(-1)?.id;if(!type)throw TypeError('No safe initial dock footprint');}
 raw.docks=[raw.land&&raw.water?dockRecord(world,raw,land,water,type,raw.id+':dock:0'):{...raw,id:raw.id+':dock:0',portId:raw.id,dockTypeId:profile.initial_dock_type,dockPosition:position,water,land,attachmentEdge:raw.attachmentEdge??(rotation/60+3)%6,rotation}];raw.infrastructureRevision??=0;return raw;
}
export function validateDockSite(world,port,land,water,type,{ports=world.ports??[],industries=world.industries??[]}={}){
 const raw=initializePortInfrastructure(world,port),definition=dockRegistry.get(type),index=tileIndex(world,land);
 if(tileCategory(world,land)!=='COASTAL')return {ok:false,reason:'NOT_COASTAL'};
 if(!hexNeighbors(land).some(n=>(raw.townTiles??[]).includes(tileIndex(world,n))))return {ok:false,reason:'NOT_SETTLEMENT_ADJACENT'};
 if(hexDistance(land,water)!==1||tileCategory(world,water)!=='WATER'||waterDepthAt(world,water)<definition.min_water_depth)return {ok:false,reason:'INVALID_WATER_DEPTH'};
 const footprint=dockFootprint(world,land,water,type);if(!footprint.length)return {ok:false,reason:'BLOCKED_DOCK_FOOTPRINT'};
 const footprintIds=new Set(footprint.map(t=>t.tileIndex));
 const others=ports.length?ports:[raw];for(const other of others){const source=initializePortInfrastructure(world,other);if(other.id!==raw.id&&(source.townTiles??[]).includes(index))return {ok:false,reason:'FOREIGN_SETTLEMENT'};for(const dock of source.docks??[]){if((dock.tiles??[]).some(t=>footprintIds.has(t.tileIndex)))return {ok:false,reason:'OCCUPIED_DOCK_FOOTPRINT'};if(dock.landIndex===index)return {ok:false,reason:'OCCUPIED_COAST'};if((dock.tiles??[dock.water]).filter(Boolean).some(c=>footprint.some(n=>hexDistance(n,c)<2)))return {ok:false,reason:'CHANNEL_SPACING'};}}
 if((raw.townTiles??[]).includes(index)||industries.some(i=>i.tileIndex===index))return {ok:false,reason:'OCCUPIED_LAND'};
 return {ok:true};
}
export function dockCandidates(world,port,type,options){const raw=initializePortInfrastructure(world,port),indices=new Set(),candidates=[];for(const i of raw.townTiles??[])for(const land of hexNeighbors(tileCoordinates(world,i))){const j=tileIndex(world,land);if(j>=0)indices.add(j);}for(const i of [...indices].sort((a,b)=>a-b)){const land=tileCoordinates(world,i);for(const water of hexNeighbors(land))if(validateDockSite(world,raw,land,water,type,options).ok)candidates.push(dockRecord(world,raw,land,water,type,raw.id+':dock:'+land.q+','+land.r+'>'+water.q+','+water.r));}return candidates;}
export class BerthManager{
 constructor(world,port){this.world=world;this.port=initializePortInfrastructure(world,port);}
 get docks(){return this.port.docks;}
 compatible(spec){return this.docks.filter(d=>compatibleDock(d,spec));}
 add(dock){if(dock.portId!==this.port.id||!validateDockSite(this.world,this.port,dock.land,dock.water,dock.dockTypeId,{ports:[this.port,...(this.world.ports??[]).filter(p=>p.id!==this.port.id)]}).ok)throw TypeError('Invalid dock site');if(this.docks.some(d=>d.id===dock.id))throw TypeError('Duplicate dock');this.docks.push(dock);this.port.infrastructureRevision=(this.port.infrastructureRevision??0)+1;return dock;}
}
