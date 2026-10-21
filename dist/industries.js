import {industryMarker} from './industry-markers.js?v=babbc3d3950e';
import {settingsForWorld} from './compiled-configuration.js?v=babbc3d3950e';
import {connectFeederIndustry,feederReachability,resetRoadTerrain} from './feeder-roads.js?v=babbc3d3950e';
import {hexDistance,tileIndex,tileCoordinates} from './hex-topology.js?v=babbc3d3950e';
import{DIRECTIONS,SEA_LEVEL,hashSeed,random,axialToOffset,offsetToAxial,axialToWorld}from'./world.js?v=babbc3d3950e';
import {industryRegistry,commodityRegistry} from './simulation-registry.js?v=babbc3d3950e';
export const INDUSTRY_TYPES=industryRegistry.values().filter(d=>d.placement.enabled).map(d=>({id:d.id,code:d.graphics.atlas_frame+1,name:d.display_name,commodity:commodityRegistry.get(d.outputs[0].commodity_id).name,placement:d.placement}));
export const SECONDARY_INDUSTRY_TYPES=industryRegistry.values().filter(d=>d.manufacturing?.runtime_enabled).map(d=>({id:d.id,code:d.graphics.atlas_frame+1,name:d.display_name,commodity:commodityRegistry.get(d.outputs[0].commodity_id).name,placement:d.placement}));
// Starting allowance: one primary plus one secondary per port. Distinct factory
// coverage scales with map size, independently of the parent's primary chain.
function generateSecondaryIndustries(world,industries,occupied,counts,telemetry,target,settings){
 const ports=[...(world.ports??[])].sort((a,b)=>hashSeed(world.config.seed+'|factory-port|'+a.id)-hashSeed(world.config.seed+'|factory-port|'+b.id)||a.id.localeCompare(b.id)),claimed=new Set();
 const types=[...SECONDARY_INDUSTRY_TYPES].sort((a,b)=>hashSeed(world.config.seed+'|factory-type|'+a.id)-hashSeed(world.config.seed+'|factory-type|'+b.id)||a.id.localeCompare(b.id));
 let placed=0;const unavailable=[];
 for(const type of types){if(placed>=target)break;let found=false;
  for(const port of ports){if(claimed.has(port.id))continue;const core=tileCoordinates(world,port.landIndex),pool=[],radius=Math.ceil(settings.roads.radius);
   for(let q=-radius;q<=radius;q++)for(let r=-radius;r<=radius;r++){const c={q:core.q+q,r:core.r+r},i=tileIndex(world,c);if(i<0||occupied.has(i)||hexDistance(core,c)>settings.roads.radius||world.h[i]<type.placement.min_height||world.h[i]>=settings.roads.mountainHeight||!type.placement.biomes.includes((world.terrainBiomes??world.biomes)[i])||industries.some(s=>hexDistance(s,c)<2))continue;pool.push({...c,i});}
   pool.sort((a,b)=>hexDistance(core,a)-hexDistance(core,b)||a.i-b.i);
   for(const c of pool){const industry={id:'industry-'+c.q+','+c.r,instanceId:'industry-'+c.q+','+c.r,type:type.id,code:type.code,name:type.name,commodity:type.commodity,tileIndex:c.i,q:c.q,r:c.r,position:axialToWorld(c.q,c.r),startingSecondary:true};const route=connectFeederIndustry(world,port,industry,{industries:[...industries,industry]});telemetry.visited+=route.visited;if(!route.path.length){telemetry.rejectedCandidates++;continue;}
    industry.portId=port.id;industry.portName=port.name;industries.push(industry);counts[type.id]++;claimed.add(port.id);occupied.add(c.i);for(const road of port.roadTiles??[])occupied.add(tileIndex(world,road));world.data[c.i*4+3]=industryMarker(type.code);placed++;found=true;break;
   }if(found)break;
  }if(!found)unavailable.push(type.id);
 }
 return {requested:target,placed,unmet:Math.max(0,target-placed),unavailableTypes:unavailable,reason:placed<target?'Insufficient suitable port sites with isolated roads':null};
}
export function generateIndustries(world){
 const settings=settingsForWorld(world);resetRoadTerrain(world);
 const{n,h,biomes,config}=world,density=(config.industryDensity??50)/50,industries=[];
 for(let i=0;i<n*n;i++)world.data[i*4+3]=1;for(const port of world.ports??[])for(const road of port.initialRoadTiles??[]){const id=tileIndex(world,road);world.data[id*4+3]=5;}
 const target=density===0?0:Math.min(SECONDARY_INDUSTRY_TYPES.length,settings.industryGeneration.secondaryTargets[n]??1);let secondary={requested:target,placed:0,unmet:target,unavailableTypes:[],reason:density===0?'Industry generation disabled':null};
 const counts=Object.fromEntries([...INDUSTRY_TYPES,...SECONDARY_INDUSTRY_TYPES].map(t=>[t.id,0]));const coverage=()=>{world.industryGeneration={maximumStartingIndustriesPerPort:2,maximumStartingPrimaryIndustriesPerPort:1,maximumStartingSecondaryIndustriesPerPort:1,density,counts:{...counts},missingTypes:INDUSTRY_TYPES.filter(t=>!counts[t.id]).map(t=>t.id),missingSecondaryTypes:SECONDARY_INDUSTRY_TYPES.filter(t=>!counts[t.id]).map(t=>t.id),secondary,unservedPorts:(world.ports??[]).filter(p=>!industries.some(i=>i.portId===p.id)).map(p=>p.id),policy:'One starting primary and one secondary per port; seeded distinct factory coverage scales with map size. Strict terrain and isolated roads. Later construction is separate.'};};
 const telemetry={connected:0,outOfRange:0,unreachable:0,searchLimited:0,visited:0,tiles:0,rejectedCandidates:0};world.roadTelemetry=telemetry;
 if(density===0){coverage();return industries;}
 const occupied=new Set((world.ports??[]).flatMap(p=>[p.landIndex,p.waterIndex,...(p.townTiles??[]),...(p.docks??[]).map(d=>d.landIndex),...(p.buildings??[]).map(b=>tileIndex(world,b)),...(p.roadTiles??[]).map(r=>tileIndex(world,r))]));
 // The primary starting allowance is per port, separate from secondary coverage.
 const claimedPorts=new Set();
 const portsByLand=new Map((world.ports??[]).map(p=>[p.landIndex,p]));
 const reachable=new Map((world.ports??[]).map(p=>[p.id,feederReachability(world,p)]));
 const eligible=(c,ports)=>ports.filter(p=>hexDistance(c,tileCoordinates(world,p.landIndex))<=settings.roads.radius&&(reachable.get(p.id).has(c.i)||DIRECTIONS.some(([q,r])=>reachable.get(p.id).has(tileIndex(world,{q:c.q+q,r:c.r+r}))))).sort((a,b)=>hexDistance(c,tileCoordinates(world,a.landIndex))-hexDistance(c,tileCoordinates(world,b.landIndex))||a.id.localeCompare(b.id));
 const visited=new Uint8Array(n*n),queue=new Int32Array(n*n);
 for(let start=0;start<n*n;start++){
  if(visited[start]||h[start]<SEA_LEVEL)continue;let head=0,tail=1;const ports=[];queue[0]=start;visited[start]=1;
  while(head<tail){const i=queue[head++],c=offsetToAxial(i%n,Math.floor(i/n));if(portsByLand.has(i))ports.push(portsByLand.get(i));
   for(const[dq,dr]of DIRECTIONS){const a=axialToOffset(c.q+dq,c.r+dr);if(a.col<0||a.row<0||a.col>=n||a.row>=n)continue;const j=a.row*n+a.col;if(!visited[j]&&h[j]>=SEA_LEVEL){visited[j]=1;queue[tail++]=j;}}
  }
  if(!ports.length)continue;
  const origin=offsetToAxial(start%n,Math.floor(start/n)),seed=hashSeed(config.seed+'|industry|'+origin.q+','+origin.r),rng=random(seed);
  const budget=Math.min(ports.length,Math.floor(tail/6),Math.max(1,Math.round((tail<25?1:3+Math.floor(Math.max(0,tail-100)/80))*density)));
  const candidates=INDUSTRY_TYPES.map(type=>{
   const pool=[];for(let k=0;k<tail;k++){const i=queue[k];if(occupied.has(i)||h[i]<type.placement.min_height||!type.placement.biomes.includes(biomes[i]))continue;
    const c={i,...offsetToAxial(i%n,Math.floor(i/n))},eligiblePorts=eligible(c,ports);if(!eligiblePorts.length)continue;
    const wet=world.moisture[i],suitability=type.placement.suitability==='rock'?world.rock[i]:type.placement.suitability==='moisture'?wet:1-Math.abs(wet-.52);
    pool.push({...c,ports:eligiblePorts,score:suitability+random(hashSeed(seed+'|'+type.id+'|'+c.q+','+c.r))()*.65});
   }
   return pool.sort((a,b)=>b.score-a.score||a.i-b.i);
  });
  const selected=[],attempted=new Set(),rotation=Math.floor(rng()*INDUSTRY_TYPES.length);
  while(selected.length<budget){let placed=false;
   const priority=INDUSTRY_TYPES.map((type,t)=>({t,score:counts[type.id]/(type.placement.regional_balance_weight??1),tie:(t-rotation+INDUSTRY_TYPES.length)%INDUSTRY_TYPES.length})).sort((a,b)=>a.score-b.score||a.tie-b.tie);
   for(const {t} of priority){if(selected.length>=budget)break;
    const type=INDUSTRY_TYPES[t],pool=candidates[t];
    for(const c of pool){if(!c.ports.some(p=>!claimedPorts.has(p.id))||attempted.has(c.i)||occupied.has(c.i)||selected.some(p=>hexDistance(p,c)<2))continue;attempted.add(c.i);
     const industry={id:'industry-'+c.q+','+c.r,type:type.id,code:type.code,name:type.name,commodity:type.commodity,tileIndex:c.i,q:c.q,r:c.r,position:axialToWorld(c.q,c.r),islandTiles:tail};let connected=false;
     for(const port of c.ports){if(claimedPorts.has(port.id))continue;const result=connectFeederIndustry(world,port,industry,{industries:[...industries,industry]});telemetry.visited+=result.visited;if(!result.path.length)continue;
      industry.portId=port.id;industry.portName=port.name;claimedPorts.add(port.id);connected=true;break;
     }
     if(!connected){telemetry.rejectedCandidates++;continue;}
     industries.push(industry);counts[type.id]++;selected.push(c);occupied.add(c.i);for(const port of ports)for(const road of port.roadTiles??[])occupied.add(tileIndex(world,road));world.data[c.i*4+3]=industryMarker(type.code);placed=true;break;
    }
   }
   if(!placed)break;
  }
 }
 secondary=generateSecondaryIndustries(world,industries,occupied,counts,telemetry,target,settings);
 telemetry.connected=industries.length;telemetry.tiles=(world.ports??[]).reduce((n,p)=>n+(p.roadTiles?.length??0),0);coverage();return industries;
}
