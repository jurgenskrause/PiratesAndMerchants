import {worldToAxial} from './world.js?v=babbc3d3950e';
// Static chamfer distance/gradient mask; generated once in the terrain worker.
export function buildShore(world){
 const spacing=Math.max(1,world.bounds.width/254,world.bounds.height/254),width=Math.ceil(world.bounds.width/spacing)+2,height=Math.ceil(world.bounds.height/spacing)+2;
 const distance=new Float32Array(width*height);distance.fill(64);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const c=worldToAxial(x*spacing,y*spacing),col=c.q+Math.floor(c.r/2);
  if(col>=0&&col<world.n&&c.r>=0&&c.r<world.n&&world.data[(c.r*world.n+col)*4]>=.35)distance[y*width+x]=0;
 }
 for(const sign of [1,-1])for(let y=sign===1?0:height-1;y>=0&&y<height;y+=sign)for(let x=sign===1?0:width-1;x>=0&&x<width;x+=sign){
  const i=y*width+x;
  for(const [ox,oy] of [[-sign,0],[0,-sign],[-sign,-sign],[sign,-sign]]){const xx=x+ox,yy=y+oy;if(xx>=0&&xx<width&&yy>=0&&yy<height)distance[i]=Math.min(distance[i],distance[yy*width+xx]+spacing*(ox&&oy?Math.SQRT2:1));}
 }
 const data=new Float32Array(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=y*width+x,dx=distance[y*width+Math.min(width-1,x+1)]-distance[y*width+Math.max(0,x-1)],dy=distance[Math.min(height-1,y+1)*width+x]-distance[Math.max(0,y-1)*width+x],len=Math.hypot(dx,dy);
  data[i*4]=distance[i];data[i*4+1]=len>1e-5?dx/len:0;data[i*4+2]=len>1e-5?dy/len:0;data[i*4+3]=1;
 }
 return{data,width,height,spacing};
}
