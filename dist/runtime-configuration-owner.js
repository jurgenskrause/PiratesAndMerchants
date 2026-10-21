import {PlanningQueue} from './planning-queue.js?v=babbc3d3950e';
import {RouteReplanMonitor} from './route-sailing.js?v=babbc3d3950e';
const write=(target,key,value)=>({target,key,value});
export const LIVE_WORLD_SETTING_IDS=Object.freeze(['logistics.cargo_handling_rate','merchant.minimum_profit','merchant.distance_cost','navigation.wind_persistence','navigation.threat_threshold','navigation.wind_shift_degrees']);
// Pure preparation. Existing ships, manifests, quotes, orders and ledger entries
// remain the same objects. No task generator is resumed during preparation.
export function prepareWorldActivation(runtime,prepared){
 const {snapshot,compiled:s}=prepared,session=runtime.session,e=session.logistics;
 if(prepared.changed.some(id=>!LIVE_WORLD_SETTING_IDS.includes(id)))throw TypeError('No live owner transition for requested setting');
 if(!e?.agents||!e.navigators)throw TypeError('Live settings require the bridge simulation');
 const jobs=new PlanningQueue(),roles=Object.freeze(Object.fromEntries(Object.entries(e.roles).map(([id,r])=>[id,Object.freeze({...r,configurationRevision:s.revision})]))),scaling=Object.freeze({...e.scaling,configurationRevision:s.revision,settings:s.scaling});
 const writes=[write(runtime,'_configuration',Object.freeze({...runtime.configuration,world:snapshot})),write(runtime,'settings',s),write(session,'settings',s),write(session,'configurationRevision',s.revision),write(session.world,'configuration',snapshot),write(e,'compiledSettings',s),write(e,'configurationRevision',s.revision),write(e,'minProfit',s.merchant.minimumProfit),write(e,'cargoHandlingRate',s.merchant.cargoHandlingRate),write(e,'windPersistence',s.navigation.windPersistence),write(e,'threatThreshold',s.navigation.threatThreshold),write(e,'defaults',{...e.defaults,voyage_cost_per_unit:s.merchant.distanceCost}),write(e,'jobs',jobs)];
 // Unchanged owners are retagged; their balances, clocks and policy state are retained.
 for(const owner of [session.economy,e.threatGrid,e.infrastructureGovernor,e.urbanExpansion.grid,...e.navigators.values()])writes.push(write(owner,'configurationRevision',s.revision));
 writes.push(write(e,'roles',roles),write(e,'scaling',scaling),write(e.infrastructureGovernor,'scaling',scaling),write(e.infrastructureGovernor,'reviews',new Map([...e.infrastructureGovernor.reviews].map(([id,r])=>[id,{...r,configurationRevision:s.revision}]))));
 writes.push(write(e.urbanExpansion.grid,'settings',s.roads));
 for(const a of e.agents.values()){
  const monitor=new RouteReplanMonitor(s.navigation);monitor.reset(a.plannedWind,a.hotspots);monitor.windSince=a.replanMonitor.windSince;monitor.threatPending=a.replanMonitor.threatPending;
  const old=e.jobs.find(j=>j.a===a&&j.nonce===a.planNonce);let task;
  if(old){const i=old.intent;if(!i)throw TypeError('Planning job has no restart intent');const port=i.portId?e.ports.get(i.portId):null;if(i.kind==='water')task=e.waterRoute(a);else if(i.kind==='water-resume')task=e.waterResume(a);else if(i.kind==='trade')task=e.plan(a,i.options);else if(i.kind==='turnaround'&&port)task=e.planTurnaround(a,port);else if(i.kind==='patrol')task=e.patrolVisit(a);else if(i.kind==='visit'&&port)task=e.visit(a,port);else if(i.kind==='replan'&&port)task=e.replan(a,port);else throw TypeError('Invalid planning restart intent');jobs.push({a,nonce:a.planNonce+1,configurationRevision:s.revision,task,intent:i});}
  writes.push(write(a,'role',roles[a.vesselClass]));if(a.turnaround)writes.push(write(a,'turnaround',{...a.turnaround,ready:false,selection:null}));
  writes.push(write(a,'replanMonitor',monitor),write(a,'planning',!!task),write(a,'planNonce',a.planNonce+1),write(a,'matrix',[]),write(a,'planningDestination',null),write(a,'threatCheckVersion',-1),write(a,'scanAt',Math.min(a.scanAt,e.time)));
 }
 return writes;
}
export function prepareRenderingActivation({holder,industry,town},prepared){
 const s=prepared.compiled,r=s.rendering,writes=[write(holder,'settings',s),write(holder,'snapshot',prepared.snapshot)];
 for(const renderer of [industry,town].filter(Boolean))writes.push(write(renderer,'settings',r),write(renderer,'configurationRevision',r.revision),write(renderer,'lastView',null));
 if(industry)writes.push(write(industry,'iconPixels',r.industryIconPixels));return writes;
}
