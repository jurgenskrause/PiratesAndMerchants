import {worldToAxial} from './world.js?v=babbc3d3950e';
function hash(x,y){let n=Math.imul(x,374761393)^Math.imul(y,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;}
function noise(x,y){const ix=Math.floor(x),iy=Math.floor(y);let a=x-ix,b=y-iy;a=a*a*(3-2*a);b=b*b*(3-2*b);return (hash(ix,iy)*(1-a)+hash(ix+1,iy)*a)*(1-b)+(hash(ix,iy+1)*(1-a)+hash(ix+1,iy+1)*a)*b;}
export function gustAt(x,y,time,flowX=0,flowY=0){
 const a=noise((x-flowX)/22+time*.012,(y-flowY)/22),b=noise((x-flowX)/11+37,(y-flowY)/11-time*.017);
 return {strength:.68+.64*(a*.7+b*.3),turn:(a-b)*.18};
}
// A bounded approximation of terrain shelter, not a fluid solver. Heights and
// rocky terrain extend the wake. Three upwind rays soften the island silhouette.
export function exposureAt(world,x,y,dx,dy){
 let shelter=0;
 for(let ray=-1;ray<=1;ray++){
  let shadow=0;
  for(let step=1;step<=24;step++){
   const distance=step*1.7,spread=ray*(.65+distance*.07);
   const c=worldToAxial(x-dx*distance-dy*spread,y-dy*distance+dx*spread);
   const col=c.q+Math.floor(c.r/2);
   if(col<0||col>=world.n||c.r<0||c.r>=world.n)continue;
   const i=(c.r*world.n+col)*4,h=world.data[i];
   if(h<.35)continue;
   const relief=Math.min(1,Math.max(0,(h-.35)*3+world.data[i+2]*.4));
   const reach=10+relief*32;
   shadow=Math.max(shadow,(.65+relief*.3)*Math.max(0,1-distance/reach));
  }
  shelter+=shadow*(ray===0?.5:.25);
 }
 return Math.max(.12,1-shelter);
}
export class WindField{
 constructor(world,vector){
  this.world=world;this.time=0;this.flowX=0;this.flowY=0;this.spacing=Math.max(5,world.bounds.width/126,world.bounds.height/126);
  this.width=Math.ceil(world.bounds.width/this.spacing)+2;this.height=Math.ceil(world.bounds.height/this.spacing)+2;
  this.data=new Float32Array(this.width*this.height*4);this.exposure=new Float32Array(this.width*this.height);this.exposure.fill(1);this.row=0;this.age=0;
  this.refresh(vector,this.height);this.shadowAngle=Math.atan2(vector.y,vector.x);this.pendingRows=0;
  for(let i=0;i<this.exposure.length;i++){this.data[i*4]=vector.x*this.exposure[i];this.data[i*4+1]=vector.y*this.exposure[i];this.data[i*4+2]=1;this.data[i*4+3]=this.exposure[i];}
 }
 refresh(vector,rows){
  const strength=Math.hypot(vector.x,vector.y);if(strength<1e-6)return;
  const dx=vector.x/strength,dy=vector.y/strength;
  for(let j=0;j<rows;j++){
   const row=this.row;this.row=(this.row+1)%this.height;
   for(let col=0;col<this.width;col++)this.exposure[row*this.width+col]=exposureAt(this.world,col*this.spacing,row*this.spacing,dx,dy);
  }
 }
 update(dt,vector){
  this.time+=dt;this.flowX+=vector.x*dt*.7;this.flowY+=vector.y*dt*.7;
  // Cache directional exposure; rebuild only after a meaningful wind turn.
  const angle=Math.atan2(vector.y,vector.x);
  if(!this.pendingRows&&Math.hypot(vector.x,vector.y)>1e-6&&Math.abs(Math.atan2(Math.sin(angle-this.shadowAngle),Math.cos(angle-this.shadowAngle)))>.035){this.shadowAngle=angle;this.pendingRows=this.height;}
  if(this.pendingRows){this.refresh({x:Math.cos(this.shadowAngle),y:Math.sin(this.shadowAngle)},1);this.pendingRows--;}

  this.age+=dt;if(this.age<.1)return false;
  const elapsed=this.age;this.age=0;
  // Only the small phase/vector texture updates at 10 Hz.
  const blend=1-Math.exp(-elapsed/1.2);
  for(let i=0;i<this.exposure.length;i++){
   const k=i*4,g=gustAt((i%this.width)*this.spacing,Math.floor(i/this.width)*this.spacing,this.time,this.flowX,this.flowY),c=Math.cos(g.turn),s=Math.sin(g.turn),gain=g.strength*this.exposure[i];
   this.data[k]+=((vector.x*c-vector.y*s)*gain-this.data[k])*blend;
   this.data[k+1]+=((vector.x*s+vector.y*c)*gain-this.data[k+1])*blend;
   this.data[k+3]+=(this.exposure[i]-this.data[k+3])*blend;
   this.data[k+2]+=(g.strength-this.data[k+2])*blend;
  }
  return true;
 }
}
