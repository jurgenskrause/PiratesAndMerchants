import {roadRegistry} from './simulation-registry.js?v=babbc3d3950e';
// Logical labels from the specification. Pointy-top geometry is rotated 30 degrees
// from a north-edge diagram; these vectors follow the existing world coordinates.
export const ROAD_DIRECTIONS=Object.freeze([
 {name:'N',bit:1,q:0,r:-1}, {name:'NE',bit:2,q:1,r:-1},
 {name:'SE',bit:4,q:1,r:0}, {name:'S',bit:8,q:0,r:1},
 {name:'SW',bit:16,q:-1,r:1}, {name:'NW',bit:32,q:-1,r:0}
].map(Object.freeze));
const check=mask=>{if(!Number.isInteger(mask)||mask<0||mask>63)throw RangeError('Road mask must be 0..63');};
export function rotateRoadMask(mask,steps){check(mask);if(!Number.isInteger(steps))throw TypeError('Integer rotation required');steps=((steps%6)+6)%6;return ((mask<<steps)|(mask>>(6-steps)))&63;}
const count=mask=>{let n=0;for(;mask;mask&=mask-1)n++;return n;};
// Resolve artwork only. Never replace the logical connectivity with a fallback mask.
export function resolveRoadTile(mask){
 check(mask);let best=null;
 for(const definition of roadRegistry.values())for(let rotation=0;rotation<6;rotation++){
  if((mask===0)!==(definition.kind==='urban_infill'))continue;
  const renderedMask=rotateRoadMask(definition.mask,rotation),missing=count(mask&~renderedMask),extra=count(renderedMask&~mask),score=missing*3+extra*5;
  if(!best||score<best.score)best={definition,rotation:rotation*60,logicalMask:mask,renderedMask,exact:renderedMask===mask,score};
 }
 return best;
}
const key=c=>`${c.q},${c.r}`;
export function roadMasks(cells){const indices=new Map();for(const c of cells){if(!Number.isInteger(c.q)||!Number.isInteger(c.r))throw TypeError('Integer axial coordinates required');indices.set(key(c),c);}return [...indices.values()].map(c=>({...c,mask:ROAD_DIRECTIONS.reduce((mask,d)=>mask|(indices.has(key({q:c.q+d.q,r:c.r+d.r}))?d.bit:0),0)}));}
