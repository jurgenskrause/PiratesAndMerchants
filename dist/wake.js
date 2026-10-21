import {waterDepth} from './ships.js?v=babbc3d3950e';
// Bounded world-space wake history. Old waves expand locally, never follow the hull.
export class WakeTrail{
 constructor({maxPoints=96,maxLife=Infinity}={}){this.maxPoints=maxPoints;this.maxLife=maxLife;this.reset();}
 reset(){this.points=[];this.time=0;this.lastEmission=-1;this.lastPosition=null;this.revision=0;}
 update(dt,ship){
  this.time+=Math.max(0,Math.min(dt,.1));
  while(this.points.length&&this.time-this.points[0].born>this.points[0].life)this.points.shift();
  const speed=ship.speed;
  if(speed<.06){this.lastPosition=null;return;}
  if(this.time-this.lastEmission<.08)return;
  const x=ship.x-Math.sin(ship.heading)*ship.spec.length*.43,y=ship.y+Math.cos(ship.heading)*ship.spec.length*.43;
  if(this.lastPosition&&Math.hypot(x-this.lastPosition.x,y-this.lastPosition.y)<.045)return;
  const strength=Math.sqrt(Math.min(1,speed/ship.spec.maxSpeed)),heading=Math.atan2(ship.vx,-ship.vy);
  this.points.push({x,y,heading,born:this.time,life:Math.min(this.maxLife,3.5+strength*3.5),strength,beam:ship.spec.beam,speed,breakBefore:!this.lastPosition});
  if(this.points.length>this.maxPoints)this.points.shift();this.lastPosition={x,y};this.lastEmission=this.time;this.revision++;
 }
 crossSection(p){const age=this.time-p.born,fade=Math.max(0,1-age/p.life),width=p.beam*.38+age*(.065+p.speed*.13);
  return{x:p.x-Math.sin(p.heading)*age*.025,y:p.y+Math.cos(p.heading)*age*.025,rx:Math.cos(p.heading),ry:Math.sin(p.heading),width,alpha:p.strength*fade*fade,age};}
}
export class WakeRenderer{
 constructor(app,{maxPoints=96,maxLife=Infinity,redrawInterval=.05,detail='full'}={}){this.trail=new WakeTrail({maxPoints,maxLife});this.redrawInterval=redrawInterval;this.detail=detail;this.graphics=new PIXI.Graphics();
  // Changing stroke topology must not share vertex/index batches with sprites.
  this.layer=new PIXI.Container({isRenderGroup:true});this.layer.addChild(this.graphics);app.stage.addChild(this.layer);this.redrawAt=0;}
 reset(){this.trail.reset();this.graphics.clear();this.redrawAt=0;}
 update(dt,ship){this.trail.update(dt,ship);}
 render(camera,scale,width,height,world){
  const g=this.graphics;g.position.set(width/2-camera.x*scale,height/2-camera.y*scale);g.scale.set(scale);
  g.alpha=Math.max(0,Math.min(1,(scale-3)/15));
  if(g.alpha===0){if(g.context.instructions.length)g.clear();return;}
  if(this.trail.time<this.redrawAt)return;this.redrawAt=this.trail.time+this.redrawInterval;g.clear();
  const points=this.trail.points;
  const sea=(x,y)=>waterDepth(world,x,y)>0;
  const stride=this.detail==='merchant'?2:1;
  for(let i=stride;i<points.length;i+=stride){
   const p=points[i-stride],q=points[i];if(q.breakBefore||(stride===2&&points[i-1].breakBefore)||q.born-p.born>.5)continue;
   const a=this.trail.crossSection(p),b=this.trail.crossSection(q),alpha=Math.min(a.alpha,b.alpha);if(alpha<.004)continue;
   if(Math.hypot(a.x-b.x,a.y-b.y)>1)continue;
   // Two divergent wave arms with a soft outer wash and a fine foam core.
   for(const side of [-1,1]){
    const ax=a.x+a.rx*a.width*side,ay=a.y+a.ry*a.width*side,bx=b.x+b.rx*b.width*side,by=b.y+b.ry*b.width*side;
    if(!sea(ax,ay)||!sea(bx,by)||!sea((ax+bx)/2,(ay+by)/2))continue;
    if(this.detail==='full')g.moveTo(ax,ay).lineTo(bx,by).stroke({width:.11+a.age*.008,color:0xcee7d7,alpha:alpha*.09});
    g.moveTo(ax,ay).lineTo(bx,by).stroke({width:.025+a.age*.003,color:0xe8f1db,alpha:alpha*.28});
   }
   if(sea(a.x,a.y)&&sea(b.x,b.y)&&sea((a.x+b.x)/2,(a.y+b.y)/2)){
    g.moveTo(a.x,a.y).lineTo(b.x,b.y).stroke({width:p.beam*(.55+a.age*.08),color:0xc9dfcc,alpha:alpha*.12});
   }
  }
 }
}
