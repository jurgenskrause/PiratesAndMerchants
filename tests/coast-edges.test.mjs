import assert from 'node:assert/strict';
import test from 'node:test';
import {generateWorld,DIRECTIONS,SEA_LEVEL} from '../dist/world.js';

const settings={seed:'BENCHMARK-COAST-01',density:48,scale:50,roughness:55,moisture:60,mountains:35,industryDensity:50};
const normals=[[1,0],[.5,-.8660254],[-.5,-.8660254],[-1,0],[-.5,.8660254],[.5,.8660254]];

for(const size of [32,128,512])test(`${size}² coast mask matches original neighbor sampling`,()=>{
 const world=generateWorld({...settings,size}),{h,coastEdges,n}=world;
 assert.equal(coastEdges.byteLength,n*n);
 for(let row=0;row<n;row++)for(let col=0;col<n;col++){
  const index=row*n+col,height=h[index],q=col-Math.floor(row/2);
  let mask=0;
  for(let bit=0;bit<6;bit++){
   const[dq,dr]=DIRECTIONS[bit],r=row+dr,c=q+dq+Math.floor(r/2);
   const neighborLand=r>=0&&r<n&&c>=0&&c<n&&h[r*n+c]>=SEA_LEVEL;
   if(neighborLand!==(height>=SEA_LEVEL))mask|=1<<bit;
  }
  if(height>=SEA_LEVEL&&height<.4){
   assert.equal(coastEdges[index],mask,`beach tile ${index}`);
   for(const [dx,dy] of [[0,0],[.86,0],[.43,-.74],[-.43,-.74],[-.86,0],[-.43,.74],[.43,.74]]){
    const distance=bits=>Math.min(2,...normals.map(([x,y],bit)=>bits&(1<<bit)?Math.max(0,.8660254-dx*x-dy*y):2));
    assert.equal(distance(coastEdges[index]),distance(mask),`edge distance ${index}`);
   }
  }else assert.equal(coastEdges[index],0,`unused tile ${index}`);
 }
 const before=coastEdges.slice();world.data[0*4+3]=5;world.data[1*4+3]=6;
 assert.deepEqual(coastEdges,before,'road and industry marker changes leave coast mask valid');
});
