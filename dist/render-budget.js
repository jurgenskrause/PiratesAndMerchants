// Hysteresis keeps transient loading spikes from changing visual quality.
export class RenderBudget {
 constructor(){this.resolution=1;this.slow=0;this.fast=0;this.average=1000/60;}
 update(dt){
  if(dt<=0||dt>.25){this.slow=this.fast=0;return null;}
  this.average+=(dt*1000-this.average)*(1-Math.exp(-dt*2));
  this.slow=this.average>21?this.slow+dt:0;this.fast=this.average<17.7?this.fast+dt:0;
  let next=this.resolution;
  if(this.slow>2)next=Math.max(.65,Math.round((next-.1)*100)/100);
  else if(this.fast>8)next=Math.min(1,Math.round((next+.05)*100)/100);
  if(next===this.resolution)return null;this.resolution=next;this.slow=this.fast=0;return next;
 }
}
