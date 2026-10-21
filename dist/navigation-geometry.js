import {worldToAxial,SEA_LEVEL} from './world.js?v=babbc3d3950e';
import {distance,headingTo} from './navigation.js?v=babbc3d3950e';
// Same hex rounding, seven hull probes and half-unit spacing as Navigator.
// Only depth is needed here; avoid constructing full terrain/UI samples.
export function navigationDepth(world,x,y){const p=worldToAxial(x,y),col=p.q+Math.floor(p.r/2);if(col<0||p.r<0||col>=world.n||p.r>=world.n)return 0;const i=p.r*world.n+col,h=world.h[i];return h>=SEA_LEVEL?0:world.depth?.[i]??Math.max(0,(SEA_LEVEL-h)*50);}
const probes=[[0,0],[.48,0],[-.48,0],[.25,.48],[.25,-.48],[-.25,.48],[-.25,-.48]];
export function navigationSegment(world,a,b,spec){const h=headingTo(a,b),fx=Math.sin(h),fy=-Math.cos(h),rx=Math.cos(h),ry=Math.sin(h),steps=Math.max(1,Math.ceil(distance(a,b)/.5));for(let i=0;i<=steps;i++){const t=i/steps,x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;for(const [along,side] of probes)if(navigationDepth(world,x+fx*along*spec.length+rx*side*spec.beam,y+fy*along*spec.length+ry*side*spec.beam)<spec.draft)return false;}return true;}
