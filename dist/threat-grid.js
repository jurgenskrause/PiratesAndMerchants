import {DEFAULT_SUBSYSTEM_SETTINGS} from './compiled-configuration.js?v=babbc3d3950e';
import {hexRoute} from './hex-route.js?v=babbc3d3950e';
import {safePose} from './navigation-safety.js?v=babbc3d3950e';
import {navigationSegment} from './navigation-geometry.js?v=babbc3d3950e';
import {FACTIONS} from './economy.js?v=babbc3d3950e';
import {worldToAxial,axialToWorld} from './world.js?v=babbc3d3950e';
import {Navigator,distance,headingTo} from './navigation.js?v=babbc3d3950e';
import {VESSEL_ROLES} from './bridge-rules.js?v=babbc3d3950e';
export const hexDistance=(a,b)=>Math.max(Math.abs(a.q-b.q),Math.abs(a.r-b.r),Math.abs(a.q+a.r-b.q-b.r));
const rings=[];for(let q=-3;q<=3;q++)for(let r=-3;r<=3;r++){const d=hexDistance({q,r},{q:0,r:0});if(d<=3)rings.push({q,r,weight:1-d*.25});}
export class ThreatGrid {
 constructor({revision=DEFAULT_SUBSYSTEM_SETTINGS.revision,maxThreat=DEFAULT_SUBSYSTEM_SETTINGS.threat.maxThreat,decayRate=DEFAULT_SUBSYSTEM_SETTINGS.threat.decayRate,frequencyHalfLife=DEFAULT_SUBSYSTEM_SETTINGS.threat.frequencyHalfLife,recencyWindow=DEFAULT_SUBSYSTEM_SETTINGS.threat.recencyWindow,maxPatrolAge=DEFAULT_SUBSYSTEM_SETTINGS.threat.maxPatrolAge,frequencyRetention,frequencyScale=3,patrolImpulse=1}={}){if(![maxThreat,frequencyHalfLife,recencyWindow,maxPatrolAge,frequencyScale,patrolImpulse].every(v=>Number.isFinite(v)&&v>0)||!Number.isFinite(decayRate)||decayRate<0)throw RangeError('Threat settings');this.configurationRevision=revision;this.frequencyRetention=frequencyRetention??Math.exp(-Math.LN2/frequencyHalfLife);if(!Number.isFinite(this.frequencyRetention)||this.frequencyRetention<=0||this.frequencyRetention>1)throw RangeError("Threat retention");Object.assign(this,{maxThreat,decayRate,frequencyHalfLife,recencyWindow,maxPatrolAge,frequencyScale,patrolImpulse});this.cells=new Map();this.lastPositions=new Map();this.version=0;this.currentTick=0;this.metricCache=new Map();}
 tick(emitters=[]){this.currentTick++;const retention=this.frequencyRetention;
  for(const [id,c] of this.cells){for(const f of FACTIONS){c.threat[f]=Math.max(0,(c.threat[f]??0)-this.decayRate);const p=c.patrol[f];if(p){p.frequencyScore*=retention;if(this.currentTick-p.lastPatrolTick>=this.maxPatrolAge&&p.frequencyScore<.01)delete c.patrol[f];}}if(!FACTIONS.some(f=>c.threat[f]>0||c.patrol[f]))this.cells.delete(id);}
  const deposits=new Map(),activeIds=new Set();for(const [index,e] of emitters.entries()){if(!e.active||!FACTIONS.includes(e.faction)||!(VESSEL_ROLES[e.vesselClass]?.militaryOnly||e.faction==='PIRATES'))continue;const p=worldToAxial(e.x,e.y),identity=e.id??`${e.faction}:${e.vesselClass}:${index}`,position=`${p.q},${p.r}`,entered=this.lastPositions.get(identity)!==position;activeIds.add(identity);this.lastPositions.set(identity,position);const strength=Math.min(this.maxThreat,Math.max(0,e.strength??this.maxThreat));
   for(const o of rings){const q=p.q+o.q,r=p.r+o.r,id=`${q},${r}`,c=deposits.get(id)??{q,r,threat:{},impulses:{}};c.threat[e.faction]=Math.min(this.maxThreat,(c.threat[e.faction]??0)+strength*o.weight);if(entered)c.impulses[e.faction]=(c.impulses[e.faction]??0)+this.patrolImpulse*o.weight*strength/this.maxThreat;deposits.set(id,c);}}
  for(const id of this.lastPositions.keys())if(!activeIds.has(id))this.lastPositions.delete(id);
  for(const [id,c] of deposits){const old=this.cells.get(id)??{q:c.q,r:c.r,threat:{},patrol:{}};for(const [f,value] of Object.entries(c.threat)){old.threat[f]=Math.max(old.threat[f]??0,value);const p=old.patrol[f]??{frequencyScore:0};p.frequencyScore=Math.min(100,p.frequencyScore+(c.impulses[f]??0));p.lastPatrolTick=this.currentTick;p.coverage=value/this.maxThreat;old.patrol[f]=p;}this.cells.set(id,old);}this.version++;
 }
 metrics(point,faction,diplomacy){const p=worldToAxial(point.x,point.y);return this.cellMetrics(`${p.q},${p.r}`,faction,diplomacy);}
 cellMetrics(id,faction,diplomacy){if(this.metricVersion!==this.version||this.metricDiplomacy!==diplomacy||this.metricDiplomacyVersion!==diplomacy.version){this.metricCache.clear();this.metricVersion=this.version;this.metricDiplomacy=diplomacy;this.metricDiplomacyVersion=diplomacy.version;}const key=faction+':'+id,cached=this.metricCache.get(key);if(cached)return cached;const c=this.cells.get(id);if(!c)return{baseThreat:0,recencyFactor:0,frequencyFactor:0,security:0,value:0};let baseThreat=0,recencyFactor=0,frequency=0;
  for(const f of FACTIONS){if(diplomacy.isHostile(faction,f))baseThreat+=c.threat[f]??0;if(diplomacy.isFriendly(faction,f)&&c.patrol[f]){const patrol=c.patrol[f],age=this.currentTick-patrol.lastPatrolTick;if(age>=this.maxPatrolAge)continue;const window=Math.min(this.maxPatrolAge,this.recencyWindow*(1+patrol.frequencyScore*2));recencyFactor=Math.max(recencyFactor,patrol.coverage*Math.max(0,1-age/window)**2);frequency+=patrol.frequencyScore;}}
  baseThreat=Math.min(this.maxThreat,baseThreat);const frequencyFactor=Math.min(.85,1-Math.exp(-frequency/this.frequencyScale)),security=1-(1-recencyFactor)*(1-frequencyFactor);const result={baseThreat,recencyFactor,frequencyFactor,security,value:baseThreat*(1-recencyFactor)*(1-frequencyFactor)};this.metricCache.set(key,result);return result;
 }
 score(point,faction,diplomacy){const p=worldToAxial(point.x,point.y),id=`${p.q},${p.r}`;return this.cells.has(id)?this.cellMetrics(id,faction,diplomacy).value:0;}
 riskBounds(faction,diplomacy){if(this.boundsVersion!==this.version||this.boundsDiplomacy!==diplomacy||this.boundsDiplomacyVersion!==diplomacy.version){this.boundsCache=new Map();this.boundsVersion=this.version;this.boundsDiplomacy=diplomacy;this.boundsDiplomacyVersion=diplomacy.version;}if(this.boundsCache.has(faction))return this.boundsCache.get(faction);const hostile=FACTIONS.filter(f=>diplomacy.isHostile(faction,f));let bounds=null;for(const [id,c] of this.cells){if(!hostile.some(f=>c.threat[f]>0)||this.cellMetrics(id,faction,diplomacy).value<=0)continue;const p=axialToWorld(c.q,c.r);if(!bounds)bounds={minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity};bounds.minX=Math.min(bounds.minX,p.x-Math.sqrt(3)/2);bounds.maxX=Math.max(bounds.maxX,p.x+Math.sqrt(3)/2);bounds.minY=Math.min(bounds.minY,p.y-1);bounds.maxY=Math.max(bounds.maxY,p.y+1);}this.boundsCache.set(faction,bounds);return bounds;}
 pathRisk(start,path,faction,diplomacy){if(!this.cells.size)return 0;const bounds=this.riskBounds(faction,diplomacy);if(!bounds)return 0;let cost=0,a=start;for(const b of path){if(Math.max(a.x,b.x)<bounds.minX||Math.min(a.x,b.x)>bounds.maxX||Math.max(a.y,b.y)<bounds.minY||Math.min(a.y,b.y)>bounds.maxY){a=b;continue;}const d=distance(a,b),steps=Math.max(1,Math.ceil(d));for(let i=1;i<=steps;i++)cost+=d/steps*this.score({x:a.x+(b.x-a.x)*i/steps,y:a.y+(b.y-a.y)*i/steps},faction,diplomacy)/this.maxThreat;a=b;}return cost;}
 corridorHotspots(start,path,faction,diplomacy,threshold=50){const hits=new Set(),bounds=this.riskBounds(faction,diplomacy);if(!bounds)return hits;let a=start;for(const b of path){if(Math.max(a.x,b.x)>=bounds.minX&&Math.min(a.x,b.x)<=bounds.maxX&&Math.max(a.y,b.y)>=bounds.minY&&Math.min(a.y,b.y)<=bounds.maxY){const steps=Math.max(1,Math.ceil(distance(a,b)));for(let i=0;i<=steps;i++){const point={x:a.x+(b.x-a.x)*i/steps,y:a.y+(b.y-a.y)*i/steps},p=worldToAxial(point.x,point.y),id=`${p.q},${p.r}`;if(this.cells.has(id)&&this.cellMetrics(id,faction,diplomacy).value>threshold)hits.add(id);}}a=b;}return hits;}
 snapshot(faction,diplomacy){return [...this.cells.values()].map(c=>({...c,...this.metrics(axialToWorld(c.q,c.r),faction,diplomacy)})).filter(c=>c.value>.01||c.security>.01);}
}
// Static terrain checks are shared by all faction navigators on this world.
const terrainByWorld=new WeakMap();
function boundedSet(map,key,value){if(map.size>=32768){let n=0;for(const k of map.keys()){map.delete(k);if(++n===4096)break;}}map.set(key,value);return value;}
export class TacticalNavigator extends Navigator {
 constructor(world,grid,diplomacy,faction,options={}){super(world,options);Object.assign(this,{grid,diplomacy,faction});let shared=terrainByWorld.get(world);if(!shared){shared={clear:new Map(),cost:new Map()};terrainByWorld.set(world,shared);}this.terrain=shared;this.configurationRevision=grid.configurationRevision;}
 clearSegment(a,b,spec){
  // Moving hull/probe coordinates never repeat. Keep them out of the shared
  // A* cache so continuous steering cannot evict reusable static hex edges.
  const cacheable=Number.isInteger(a.q)&&Number.isInteger(a.r)&&Number.isInteger(b.q)&&Number.isInteger(b.r),key=cacheable?`${spec.length}|${spec.beam}|${spec.draft}|${a.x}|${a.y}|${b.x}|${b.y}`:null;
  if(cacheable&&this.terrain.clear.has(key))return this.terrain.clear.get(key);
  const heading=headingTo(a,b),value=safePose(this.world,{...a,heading},spec)&&safePose(this.world,{...b,heading},spec)&&navigationSegment(this.world,a,b,spec);
  return cacheable?boundedSet(this.terrain.clear,key,value):value;
 }
 terrainSegmentCost(a,b,spec){const key=`${a.x}|${a.y}|${b.x}|${b.y}`;let cost=this.terrain.cost.get(key);if(cost===undefined)cost=boundedSet(this.terrain.cost,key,super.segmentCost(a,b,spec));return cost;}
 segmentCost(a,b,spec){return this.terrainSegmentCost(a,b,spec)+this.grid.pathRisk(a,[b],this.faction,this.diplomacy)*12;}
 roomySegment(a,b,spec,margin){return this.grid.pathRisk(a,[b],this.faction,this.diplomacy)===0&&super.roomySegment(a,b,spec,margin);}
 *routeTask(start,goal,spec,wind,field=null,options={}){return yield* hexRoute(this,start,goal,spec,wind,options);}
}
