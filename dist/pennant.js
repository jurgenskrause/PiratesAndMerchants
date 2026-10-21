// Apparent wind uses the same velocity conversion as automatic sail trim.
export function apparentWind(ship,wind){return{x:wind.x-ship.vx/4,y:wind.y-ship.vy/4};}
export function pennantShape(ship,flow,phase){
 const c=Math.cos(ship.heading),s=Math.sin(ship.heading),speed=Math.hypot(flow.x,flow.y);
 const strength=Math.min(1,speed),dx=speed>.001?(flow.x*c+flow.y*s)/speed:0,dy=speed>.001?(-flow.x*s+flow.y*c)/speed:1;
 const length=ship.spec.length*(.08+.24*Math.min(1,speed*2)),width=ship.spec.length*.055;
 const points=[],edge=[];
 for(let i=0;i<=8;i++){
  const t=i/8,flutter=Math.sin(t*9-phase)*t*ship.spec.length*.018*strength;
  const x=dx*length*t-dy*flutter,y=dy*length*t+dx*flutter,w=width*(1-t)*.5;
  points.push(x-dy*w,y+dx*w);edge.unshift(x+dy*w,y-dx*w);
 }
 return points.concat(edge);
}
export class PennantRenderer{
 constructor(parent){this.layer=new PIXI.Container({isRenderGroup:true});this.graphics=new PIXI.Graphics();this.layer.addChild(this.graphics);parent.addChild(this.layer);this.reset();}
 reset(){this.flow={x:0,y:0};this.phase=0;this.clock=0;this.nextDraw=0;this.graphics.clear();}
 update(dt,ship,wind){const target=apparentWind(ship,wind),t=1-Math.exp(-dt*9);this.flow.x+=(target.x-this.flow.x)*t;this.flow.y+=(target.y-this.flow.y)*t;this.phase=(this.phase+dt*(3+18*Math.min(1,Math.hypot(this.flow.x,this.flow.y))))%(Math.PI*2);this.clock+=dt;}
 render(ship,scale){
  const mast=ship.spec.mainMast;this.layer.position.set(mast.x*ship.spec.length*scale,mast.y*ship.spec.length*scale);this.layer.scale.set(scale*3);
  if(this.clock<this.nextDraw)return;this.nextDraw=this.clock+1/30;
  this.graphics.clear().poly(pennantShape(ship,this.flow,this.phase)).fill(ship.pennantColor);
 }
}
