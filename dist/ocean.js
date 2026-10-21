// Shared world-unit parameters for shader rendering and CPU ship sampling.
export const WAVES=[{length:8,amplitude:1,turn:.0},{length:4.5,amplitude:.2,turn:.08},{length:1.5,amplitude:.025,turn:-.18}];
const TAU=Math.PI*2;
export class Ocean{
 constructor(angle=0){this.heading=angle;this.previous=angle;this.blend=1;this.phases=new Float32Array(3);this.speed=0;this.cycle=0;}
 update(dt,wind){
  dt=Math.min(.1,Math.max(0,dt));this.speed+=(wind.strength-this.speed)*(1-Math.exp(-dt/1.5));
  if(this.blend>=1&&Math.abs(Math.atan2(Math.sin(wind.angle-this.heading),Math.cos(wind.angle-this.heading)))>.10){this.previous=this.heading;this.heading=wind.angle;this.blend=0;}
  this.blend=Math.min(1,this.blend+dt/4);
  WAVES.forEach((w,i)=>{const phase=this.phases[i]+dt*Math.sqrt(2.4*TAU/w.length)*this.speed;if(i===0)this.cycle+=Math.floor(phase/TAU);this.phases[i]=phase%TAU;});
 }
 sample(x,y,{distance=64,nx=0,ny=0,exposure=1}={}){
  const one=heading=>{let height=0,dx=0,dy=0;
   WAVES.forEach((w,i)=>{const a=heading+w.turn,vx=Math.sin(a),vy=-Math.cos(a),k=TAU/w.length;
    const shore=Math.max(0,1-Math.max(0,distance)/6),bend=-.7*k*shore*shore*(vx*nx+vy*ny);
    const raw=(vx*x+vy*y)*k+bend-this.phases[i]+i*2.1,phase=raw-.25*Math.cos(raw);
    const amp=w.amplitude*exposure; height+=amp*Math.sin(phase);dx+=vx*amp*.25*Math.cos(phase);dy+=vy*amp*.25*Math.cos(phase);
   });return{height,dx,dy};};
  const a=one(this.previous),b=one(this.heading),t=this.blend*this.blend*(3-2*this.blend);
  return{height:(a.height+(b.height-a.height)*t)*this.speed,dx:(a.dx+(b.dx-a.dx)*t)*this.speed,dy:(a.dy+(b.dy-a.dy)*t)*this.speed};
 }
}
export const oceanGLSL=`
// x: wind-aligned filtered slope; z: total height; w: primary swell crest.
vec4 swell(vec2 p, float heading, vec3 phaseClock, vec3 shore){
 vec4 sum=vec4(0.);
 ${WAVES.map((w,i)=>`{
 vec2 dir=vec2(sin(heading+${w.turn.toFixed(3)}),-cos(heading+${w.turn.toFixed(3)}));
 float k=${(TAU/w.length).toFixed(9)};
 float nearShore=max(0.,1.-max(0.,shore.x)/6.);
 float bend=-.7*k*nearShore*nearShore*dot(dir,shore.yz);
 float raw=dot(dir,p)*k+bend-phaseClock[${i}]+${(i*2.1).toFixed(2)};
 float phase=raw-.25*cos(raw);
 sum.xy+=dir*${(w.amplitude*[1,.65,.15][i]).toFixed(5)}*k*cos(phase)*(1.+.25*sin(raw));
 sum.z+=${w.amplitude.toFixed(3)}*sin(phase);
 ${i===0?'sum.w=sin(phase);':''}
 }`).join('\n')}
 // Project before crossfading headings so compass direction cannot amplify chop.
 sum.xy=vec2(dot(sum.xy,vec2(sin(heading),-cos(heading))),0.);
 return sum;
}`;
