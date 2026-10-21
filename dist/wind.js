const TAU=Math.PI*2;
export class Wind {
 constructor(random=Math.random){this.random=random;this.phase=0;this.offset={x:0,y:0};this.randomize();}
 randomize(){this.set(this.random()*360,.2+this.random()*.65);}
 set(degrees,strength){this.angle=((degrees%360)+360)%360*Math.PI/180;this.strength=Math.max(0,Math.min(1,strength));this.targetAngle=this.angle;this.targetStrength=this.strength;this.remaining=35+this.random()*25;}
 get vector(){return {x:Math.sin(this.angle)*this.strength,y:-Math.cos(this.angle)*this.strength};}
 update(dt,drift=true){
  dt=Math.max(0,Math.min(dt,.1));
  if(drift){
   this.remaining-=dt;
   if(this.remaining<=0){this.targetAngle=this.angle+(this.random()-.5)*Math.PI*.65;this.targetStrength=Math.max(.05,Math.min(1,this.strength+(this.random()-.5)*.6));this.remaining=35+this.random()*25;}
   const blend=1-Math.exp(-dt/18),turn=Math.atan2(Math.sin(this.targetAngle-this.angle),Math.cos(this.targetAngle-this.angle));
   this.angle=(this.angle+turn*blend+TAU)%TAU;this.strength+=(this.targetStrength-this.strength)*blend;
  }
  const travel=dt*this.strength*(.25+this.strength*.9);
  this.phase+=travel;this.offset.x+=Math.sin(this.angle)*travel;this.offset.y-=Math.cos(this.angle)*travel;
 }
}
