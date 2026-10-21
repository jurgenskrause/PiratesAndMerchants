import {waterDepth} from './ships.js?v=babbc3d3950e';
// A small bounded trail, independent of sprite batches and the physical wake.
export class TackSpeedParticles{
 constructor(app){this.layer=new PIXI.Container({isRenderGroup:true});this.graphics=new PIXI.Graphics();this.layer.addChild(this.graphics);app.stage.addChild(this.layer);this.reset();}
 reset(){this.points=[];this.time=0;this.emission=0;this.serial=0;this.opacity=0;this.nextDraw=0;this.layer.visible=false;this.graphics.clear();}
 update(dt,ship){
  dt=Math.max(0,Math.min(.1,dt));this.time+=dt;
  this.opacity+=((ship.tackReady?1:0)-this.opacity)*(1-Math.exp(-dt/ .28));
  this.points=this.points.filter(p=>this.time-p.born<p.life);
  for(const p of this.points){p.x+=p.vx*dt;p.y+=p.vy*dt;}
  if(!ship.tackReady){this.emission=0;return;}
  this.emission+=dt;
  while(this.emission>=.055){this.emission-=.055;if(this.points.length>=24)continue;
   const id=this.serial++,jitter=((id*37)%101)/101,speed=Math.hypot(ship.vx,ship.vy);
   const dx=speed>.001?ship.vx/speed:Math.sin(ship.heading),dy=speed>.001?ship.vy/speed:-Math.cos(ship.heading),rx=-dy,ry=dx;
   // Ground-fixed air streaks slide aft relative to the ship at exactly its speed.
   // Distribute across the hull footprint instead of a stern exhaust nozzle.
   const offset=ship.spec.beam*(jitter-.5),along=-ship.spec.length*(.25+((id*61)%97)/97*.25);
   this.points.push({x:ship.x+rx*offset+dx*along,y:ship.y+ry*offset+dy*along,vx:0,vy:0,dx,dy,born:this.time,life:.65+jitter*.3,length:ship.spec.length*(.13+jitter*.09)});
  }
 }
 render(camera,scale,width,height,world){
  this.layer.visible=this.points.length>0&&this.opacity>.002;if(!this.layer.visible)return;
  this.layer.position.set(width/2-camera.x*scale,height/2-camera.y*scale);this.layer.scale.set(scale);
  this.layer.alpha=this.opacity*Math.min(1,Math.max(0,(scale-4)/12));
  if(this.time<this.nextDraw)return;this.nextDraw=this.time+1/30;const g=this.graphics;g.clear();
  for(const p of this.points){const age=(this.time-p.born)/p.life,fade=Math.sin(Math.PI*age)**2,x=p.x-p.dx*p.length,y=p.y-p.dy*p.length;
   if(fade<.002||waterDepth(world,p.x,p.y)<=0||waterDepth(world,x,y)<=0)continue;
   g.moveTo(p.x,p.y).lineTo(x,y).stroke({color:0xc8f5ff,width:Math.max(.018,1/scale),alpha:fade*.5,cap:'round'});
  }
 }
}
