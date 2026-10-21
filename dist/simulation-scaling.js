import {DIRECTIONS,SEA_LEVEL,worldToAxial,offsetToAxial,axialToOffset} from './world.js?v=babbc3d3950e';
import {DEFAULT_SUBSYSTEM_SETTINGS} from './compiled-configuration.js?v=babbc3d3950e';
export const portPoint=p=>p.source?.dockPosition??p.dockPosition??p.position;
export const hexStepDistance=(a,b)=>{const p=worldToAxial(a.x,a.y),q=worldToAxial(b.x,b.y);return Math.max(Math.abs(p.q-q.q),Math.abs(p.r-q.r),Math.abs(p.q+p.r-q.q-q.r));};
export function measurePortDistances(world,ports=world.ports??[]){
 const n=world.n,labels=new Int32Array(n*n).fill(-1),queue=new Int32Array(n*n);let component=0;
 for(let start=0;start<labels.length;start++){if(labels[start]>=0||world.h[start]>=SEA_LEVEL)continue;let head=0,tail=1;queue[0]=start;labels[start]=component;
  while(head<tail){const i=queue[head++],c=offsetToAxial(i%n,Math.floor(i/n));for(const [dq,dr] of DIRECTIONS){const a=axialToOffset(c.q+dq,c.r+dr);if(a.col<0||a.row<0||a.col>=n||a.row>=n)continue;const j=a.row*n+a.col;if(labels[j]<0&&world.h[j]<SEA_LEVEL){labels[j]=component;queue[tail++]=j;}}}component++;
 }
 const locations=ports.map(p=>{const point=portPoint(p),c=worldToAxial(point.x,point.y),a=axialToOffset(c.q,c.r);return {id:p.id,point,component:a.col<0||a.row<0||a.col>=n||a.row>=n?-1:labels[a.row*n+a.col]};});
 let total=0,connectedPairs=0;for(let i=0;i<locations.length;i++)for(let j=i+1;j<locations.length;j++){const a=locations[i],b=locations[j];if(a.component<0||a.component!==b.component)continue;total+=2*hexStepDistance(a.point,b.point);connectedPairs+=2;}
 return Object.freeze({averageTransitDistance:connectedPairs?total/connectedPairs:0,connectedPairs,portCount:ports.length,components:locations.map(({id,component})=>({id,component}))});
}
export function createSimulationScaling(metrics,overrides={},baseSettings=DEFAULT_SUBSYSTEM_SETTINGS.scaling){
 const settings={...baseSettings,...overrides};for(const key of ['referenceDistance','mapScaleFactor','standardShipSpeed','safetyMarginFactor','baseUrgencyTicks','baseLedgerAgeTicks','baseQueueReviewTicks','baseJobReviewTicks'])if(!Number.isFinite(settings[key])||settings[key]<=0)throw RangeError('Invalid scaling '+key);
 const distance=metrics.averageTransitDistance||settings.referenceDistance,ratio=distance/settings.referenceDistance*settings.mapScaleFactor;
 const ticks=n=>Math.max(1,Math.ceil(n*ratio));
 return Object.freeze({configurationRevision:settings.revision,metrics,settings:Object.freeze(settings),urgencyTicks:ticks(settings.baseUrgencyTicks),ledgerMaxAge:ticks(settings.baseLedgerAgeTicks*settings.referenceShipSpeed/settings.standardShipSpeed),queueReviewTicks:ticks(settings.baseQueueReviewTicks),jobReviewTicks:ticks(settings.baseJobReviewTicks),expectedTransitTicks:Math.ceil(distance/settings.standardShipSpeed),contractDeadline:(currentTick,a,b)=>currentTick+Math.ceil(hexStepDistance(portPoint(a),portPoint(b))/settings.standardShipSpeed*settings.safetyMarginFactor)});
}
// Stock rates are per economic tick; shortage horizons use the universal second clock.
export function procurementCoverage(stock,scaling){const consumption=stock.base_consumption_rate*stock.cons_modifier,production=stock.production_pool==='CONSUMPTION'?stock.base_production_rate*stock.prod_modifier:0,netRate=(consumption-production)/scaling.settings.economicTickSeconds,coverageTicks=netRate>0?stock.consumption_stock/netRate:Infinity;return Object.freeze({commodityId:stock.commodity_id,coverageTicks,urgencyTicks:scaling.urgencyTicks,urgent:coverageTicks<scaling.urgencyTicks});}
