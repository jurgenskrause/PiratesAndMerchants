// Run: node --expose-gc scripts/economic-improvement-baseline.mjs > docs/economic-improvement/baseline-node.json
import {DIRECTIONS, SEA_LEVEL, axialToOffset, offsetToAxial} from '../dist/world.js';
import {getHeapStatistics} from 'node:v8';
import {cpus, totalmem} from 'node:os';
import {dockFootprint} from '../dist/port-infrastructure.js';
import {configurationRegistry} from '../dist/configuration-registry.js';

const settings={seed:'BENCHMARK-COAST-01',density:48,scale:50,roughness:55,moisture:60,mountains:35,industryDensity:50};
const snapshot=configurationRegistry.resolve({}, {scope:'world',revision:0});
const pending=new Map();
globalThis.self={postMessage:message=>{
 const callback=pending.get(message.id);if(!callback)throw Error('Unexpected worker response');
 pending.delete(message.id);if(message.error)callback.reject(Error(message.error));else callback.resolve(message.world);
}};
await import('../dist/generator.worker.js');

function harborSites(world){
 const {n,h}=world,visited=new Uint8Array(n*n),queue=new Int32Array(n*n),sites={small_pier:0,deep_water_quay:0},islands={small_pier:0,deep_water_quay:0};
 for(let start=0;start<h.length;start++){
  if(h[start]<SEA_LEVEL||visited[start])continue;
  let head=0,tail=1;queue[0]=start;visited[start]=1;const found={small_pier:0,deep_water_quay:0};
  while(head<tail){const index=queue[head++],land=offsetToAxial(index%n,Math.floor(index/n));
   for(const [dq,dr] of DIRECTIONS){const water={q:land.q+dq,r:land.r+dr},offset=axialToOffset(water.q,water.r);
    if(offset.col<0||offset.row<0||offset.col>=n||offset.row>=n)continue;
    const next=offset.row*n+offset.col;
    if(h[next]>=SEA_LEVEL){if(!visited[next]){visited[next]=1;queue[tail++]=next;}continue;}
    if(world.biomes[index]===5)continue;
    for(const type of Object.keys(sites))if(dockFootprint(world,land,water,type).length){sites[type]++;found[type]++;}
   }
  }
  for(const type of Object.keys(islands))if(found[type])islands[type]++;
 }
 return {eligibleHarborEdges:sites,islandsWithEligibleEdges:islands};
}

const scenes=[];
for(const size of [32,128,512]){
 globalThis.gc?.();
 const config={...settings,size},started=performance.now(),id=size;
 const result=new Promise((resolve,reject)=>pending.set(id,{resolve,reject}));
 await self.onmessage({data:{id,config,configuration:snapshot}});
 const world=await result,setupMs=performance.now()-started;
 let memory=null;try{memory=process.memoryUsage();}catch{/* Restricted /proc can make RSS unavailable. */}
 const eligible=harborSites(world);
 scenes.push({size,islands:world.islands.length,removedEdgeIslands:world.removedIslands,
  ...eligible,ports:world.ports.length,industries:world.industries.length,
  industryTypes:Object.fromEntries([...new Set(world.industries.map(i=>i.type))].sort().map(type=>[type,world.industries.filter(i=>i.type===type).length])),
  terrainGenerationMs:Number(world.generationMs.toFixed(2)),workerGenerationMs:Number(world.workerGenerationMs.toFixed(2)),workerMessageSetupMs:Number(setupMs.toFixed(2)),
  processMemoryMiB:memory?Object.fromEntries(['rss','heapUsed','external','arrayBuffers'].map(key=>[key,Number((memory[key]/1048576).toFixed(2))])):null,
  v8UsedHeapMiB:Number((getHeapStatistics().used_heap_size/1048576).toFixed(2))});
}
console.log(JSON.stringify({schema:'economic-improvement-phase0-node-baseline-v1',capturedAt:new Date().toISOString(),
 baseCommit:'e53cba80f14f43a93c29d89d4b589f9bc3786960',configurationRevision:0,seed:settings.seed,settings,
 runtime:{node:process.version,platform:process.platform,architecture:process.arch,cpuModel:cpus()[0]?.model??null,logicalCpus:cpus().length,systemMemoryGiB:Number((totalmem()/1073741824).toFixed(2)),gcEnabled:typeof globalThis.gc==='function'},
 notes:['Invokes the actual module worker handler in Node on one process, not a browser Worker; workerMessageSetupMs includes handler execution but excludes cross-thread cloning and transfer.','Eligible harbor edges count adjacent land/water edges where the existing dockFootprint accepts the dock type; this is a geometric upper bound, not a validated founding/draft capacity.','Memory is process-wide after each size, includes previously generated scenes; no GPU timing or browser heap is measured.','One cold sequence of each map size. Timing is descriptive, not a stable performance comparison.'],scenes},null,2));
