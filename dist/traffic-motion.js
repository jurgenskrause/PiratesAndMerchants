const turn=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
// Presentation only: delayed interpolation, with bounded prediction for late packets.
export function trafficPose(samples,time){
 let a=samples[0],b=a;
 for(const sample of samples){if(sample.time<=time)a=sample;else{b=sample;break;}b=sample;}
 if(b.time>a.time){const t=Math.max(0,Math.min(1,(time-a.time)/(b.time-a.time)));return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,heading:a.heading+turn(a.heading,b.heading)*t};}
 const dt=Math.max(0,Math.min(.2,time-a.time)),moving=!a.docked&&a.state!=='AT_ANCHOR';
 return{x:a.x+(moving?a.vx:0)*dt,y:a.y+(moving?a.vy:0)*dt,heading:a.heading};
}
