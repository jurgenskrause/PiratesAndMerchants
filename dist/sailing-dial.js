import {sailingAngleZone,sailingGreenRange} from './sailing-angles.js?v=babbc3d3950e';
export const SAILING_COLORS={luffing:0xff595e,close:0xffc857,good:0x60e59a,sailable:0x74b9d6};
export class SailingDial{
 constructor(app){this.layer=new PIXI.Container({isRenderGroup:true});this.disc=new PIXI.Graphics();this.marker=new PIXI.Graphics();this.layer.addChild(this.disc,this.marker);app.stage.addChild(this.layer);
  this.marker.poly([0,-1.08,-.055,-.94,.055,-.94]).fill({color:0xffffff,alpha:.95});this.reset();
 }
 reset(){this.layer.visible=false;this.lastCone=null;}
 build(noGo,bestAngle=Math.PI/2){
  const g=this.disc;g.clear();const green=sailingGreenRange(noGo,bestAngle);
  const boundaries=[0,noGo,Math.min(green.start,noGo+.18),green.start,green.end,Math.PI].sort((a,b)=>a-b);
  for(const sign of [-1,1])for(let i=1;i<boundaries.length;i++){
   const a=boundaries[i-1],b=boundaries[i];if(b-a<.0001)continue;
   const color=SAILING_COLORS[sailingAngleZone((a+b)/2,noGo,bestAngle)],points=[0,0],steps=Math.ceil((b-a)/.07);
   for(let j=0;j<=steps;j++){const t=sign*(a+(b-a)*j/steps);points.push(Math.sin(t),-Math.cos(t));}
   g.poly(points).fill({color,alpha:.19});
   for(let j=0;j<=steps;j++){const t=sign*(a+(b-a)*j/steps);if(j===0)g.moveTo(Math.sin(t),-Math.cos(t));else g.lineTo(Math.sin(t),-Math.cos(t));}g.stroke({color,width:.018,alpha:.65});
  }
  // Precise no-go boundaries and an upwind notch distinguish the two tacks.
  for(const sign of [-1,1])g.moveTo(0,0).lineTo(Math.sin(sign*noGo),-Math.cos(noGo)).stroke({color:SAILING_COLORS.luffing,width:.012,alpha:.55});
  g.moveTo(0,-.8).lineTo(0,-1.04).stroke({color:0xffe4ac,width:.025,alpha:.9});
 }
 render(ship,wind,camera,scale,width,height){
  this.layer.visible=Math.hypot(wind.x,wind.y)>=.025;if(!this.layer.visible)return;
  if(this.lastCone!==ship.type){this.build(ship.spec.noGo,ship.spec.bestAngle);this.lastCone=ship.type;}
  this.layer.position.set((ship.x-camera.x)*scale+width/2,(ship.y-camera.y)*scale+height/2);
  const radius=Math.max(30,ship.spec.length*scale*.95+5);this.disc.scale.set(radius);this.marker.scale.set(radius);
  this.disc.rotation=Math.atan2(-wind.x,wind.y);this.marker.rotation=ship.heading;
 }
}
