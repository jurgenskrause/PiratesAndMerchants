export function tackIndicatorState(ship,time){
 if(ship.luffing)return{remaining:1,color:0xff5555,alpha:.5+.35*(.5+.5*Math.sin(time*Math.PI*3)),pulse:1+.035*Math.sin(time*Math.PI*3)};
 if(!ship.tacking)return null;
 const remaining=Math.max(0,Math.min(1,1-ship.tackTime/ship.tackDuration));
 return{remaining,color:remaining>.5?0x8df0bd:remaining>.2?0xffce62:0xff6666,alpha:.9,pulse:1};
}
export class TackIndicator{
 constructor(app){this.layer=new PIXI.Container({isRenderGroup:true});this.graphics=new PIXI.Graphics();this.layer.addChild(this.graphics);app.stage.addChild(this.layer);this.reset();}
 reset(){this.time=0;this.nextDraw=0;this.lastMode='';this.layer.visible=false;this.graphics.clear();}
 update(dt){this.time+=dt;}
 render(ship,camera,scale,width,height){
  const state=tackIndicatorState(ship,this.time);this.layer.visible=!!state;if(!state){this.lastMode='';return;}
  this.layer.position.set((ship.x-camera.x)*scale+width/2,(ship.y-camera.y)*scale+height/2);
  const radius=Math.max(18,ship.spec.length*scale*.76+5);this.graphics.scale.set(radius*state.pulse);this.graphics.alpha=state.alpha;
  const mode=ship.luffing?'luffing':'tacking';if(this.time<this.nextDraw&&mode===this.lastMode)return;this.nextDraw=this.time+1/30;this.lastMode=mode;
  const g=this.graphics;g.clear();
  const arc=(fraction,color,lineWidth,alpha)=>{const segments=Math.max(1,Math.ceil(64*fraction));for(let i=0;i<=segments;i++){const angle=-Math.PI/2+Math.PI*2*fraction*i/segments,x=Math.cos(angle),y=Math.sin(angle);if(i===0)g.moveTo(x,y);else g.lineTo(x,y);}g.stroke({color,width:lineWidth/radius,alpha});};
  arc(1,0x0c2530,6,.7);arc(1,0xdce7dc,2,.18);if(state.remaining>0)arc(state.remaining,state.color,3,1);
 }
}

