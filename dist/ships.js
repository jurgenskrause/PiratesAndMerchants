import {factionRegistry} from './simulation-registry.js?v=babbc3d3950e';
import {sailingDrive} from './sailing-angles.js?v=babbc3d3950e';
import {worldToAxial,SEA_LEVEL} from './world.js?v=babbc3d3950e';
import {SHIP_TYPES,UpgradeLevel} from './fleet.js?v=babbc3d3950e';
export {SHIP_TYPES} from './fleet.js?v=babbc3d3950e';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Arcade automatic sheet trim. The wind vector points downwind; subtract
// boat velocity to obtain apparent wind. Sail side is opposite incoming wind.
export function automaticTrim(heading,vx,vy,wind,previousTack=1){
 const ax=wind.x*4-vx,ay=wind.y*4-vy,strength=Math.hypot(ax,ay);
 if(Math.hypot(wind.x,wind.y)<.001||strength<.001)return{angle:0,tack:previousTack};
 const fx=Math.sin(heading),fy=-Math.cos(heading),rx=Math.cos(heading),ry=Math.sin(heading);
 const side=-(ax*rx+ay*ry)/strength;
 const tack=Math.abs(side)>.06?(side>0?1:-1):previousTack;
 const angleToWind=Math.acos(clamp(-(ax*fx+ay*fy)/strength,-1,1));
 // Sheet in close-hauled, ease progressively on a reach/run.
 const optimal=clamp((angleToWind-.45)*.55,.10,1.40);
 return{angle:-tack*optimal,tack};
}
export function waterDepth(world,x,y){const p=worldToAxial(x,y),col=p.q+Math.floor(p.r/2);if(col<0||p.r<0||col>=world.n||p.r>=world.n)return 0;const i=p.r*world.n+col,h=world.h[i];return h>=SEA_LEVEL?0:world.depth?.[i]??Math.max(0,(SEA_LEVEL-h)*50);}
export function hullDepth(world,x,y,heading,spec){
 const fx=Math.sin(heading),fy=-Math.cos(heading),rx=Math.cos(heading),ry=Math.sin(heading);let depth=Infinity;
 for(const [along,side] of [[0,0],[.48,0],[-.48,0],[.25,.48],[.25,-.48],[-.25,.48],[-.25,-.48]])depth=Math.min(depth,waterDepth(world,x+fx*along*spec.length+rx*side*spec.beam,y+fy*along*spec.length+ry*side*spec.beam));
 return depth;
}
export function localWindAt(field,x,y,fallback){
 if(!field)return fallback;const px=clamp(x/field.spacing,0,field.width-1),py=clamp(y/field.spacing,0,field.height-1),ix=Math.floor(px),iy=Math.floor(py),fx=px-ix,fy=py-iy;
 const result={x:0,y:0};for(let yy=0;yy<2;yy++)for(let xx=0;xx<2;xx++){const w=(xx?fx:1-fx)*(yy?fy:1-fy),i=(Math.min(iy+yy,field.height-1)*field.width+Math.min(ix+xx,field.width-1))*4;result.x+=field.data[i]*w;result.y+=field.data[i+1]*w;}return result;
}
export function findShipSpawn(world,anchor,heading,type='sloop'){
 const spec=SHIP_TYPES[type];const clear=(x,y)=>hullDepth(world,x,y,heading,spec)>0&&hullDepth(world,x+Math.sin(heading)*2,y-Math.cos(heading)*2,heading,spec)>0;
 // Prefer deep, open water with clearance around the whole ship and ahead.
 const open=(x,y)=>{if(waterDepth(world,x,y)<8||!clear(x,y))return false;for(let i=0;i<12;i++){const angle=i*Math.PI/6;if(waterDepth(world,x+Math.sin(angle)*3,y+Math.cos(angle)*3)<=0)return false;}return clear(x+Math.sin(heading)*3,y-Math.cos(heading)*3);};
 for(let radius=4;radius<=28;radius+=1.5)for(let i=0;i<48;i++){const a=heading+i*Math.PI/24,x=anchor.x+Math.sin(a)*radius,y=anchor.y-Math.cos(a)*radius;if(open(x,y))return{x,y,heading};}
 // Shallow-only charts remain playable. Prefer nearby navigable water.
 for(let radius=2;radius<=28;radius+=1.5)for(let i=0;i<32;i++){const a=heading+i*Math.PI/16,x=anchor.x+Math.sin(a)*radius,y=anchor.y-Math.cos(a)*radius;if(clear(x,y))return{x,y,heading};}
 let best=null,bestDistance=Infinity;
 for(let row=1;row<world.n-1;row++)for(let col=1;col<world.n-1;col++){const x=Math.sqrt(3)*(col+(row%2)*.5),y=row*1.5,distance=(x-anchor.x)**2+(y-anchor.y)**2;if(distance<bestDistance&&clear(x,y)){best={x,y,heading};bestDistance=distance;}}return best;
}
export const CANVAS_SETTINGS=['Bare poles','Shortened sail','Easy sail','Working sail','Full sail'];
export class Ship{
 constructor(type,spawn){if(!SHIP_TYPES[type])throw Error('Unknown ship type');const faction=factionRegistry.has('pirate')?factionRegistry.get('pirate'):factionRegistry.values()[0];this.faction=faction.id;this.factionColor=faction.primary_color;this.pennantColor=faction.pennant_color;this.tacking=false;this.luffing=false;this.inNoGo=false;this.blocked=false;this.tackTime=0;this.tackEntrySide=0;this.tackCrossed=false;this.tackArmed=true;this.tackRecovery=0;this.type=type;this.spec=SHIP_TYPES[type];this.required_berth_size=this.spec.required_berth_size;Object.assign(this,spawn);this.armament=new UpgradeLevel(this.spec.armamentCapacity);this.armor=new UpgradeLevel(this.spec.armorCapacity);this.vx=0;this.vy=0;this.yaw=0;this.canvas=.5;this.speed=0;this.status='Making sail';this.localWind=0;this.sailAngle=0;this.targetSailAngle=0;this.tack=1;this.trimEfficiency=1;}
 get canvas(){return this.canvasStage/4;}
 set canvas(value){this.canvasStage=clamp(Math.round(value*4),0,4);}
 adjustCanvas(delta){this.canvas=(this.canvasStage+delta)/4;}
 get minimumBaseSpeed(){return this.spec.maxSpeed*.10;}
 get tackVelocityThreshold(){return Math.max(this.minimumBaseSpeed*.9,this.spec.maxSpeed*.30*this.localWind);}
 get tackReady(){return this.canvas>0&&this.localWind>=.025&&this.tackArmed&&!this.tacking&&!this.inNoGo&&!this.blocked&&(this.vx*Math.sin(this.heading)-this.vy*Math.cos(this.heading))>this.tackVelocityThreshold;}
 get tackDuration(){return this.tackWindow??(2*this.spec.noGo/this.spec.turnRate*1.8+.5);}
 step(dt,input,wind,world){
  dt=clamp(dt,0,1/30);if(!dt)return;const s=this.spec;
  const windSpeed=Math.hypot(wind.x,wind.y);this.localWind=windSpeed;
  const forwardSpeed=this.vx*Math.sin(this.heading)-this.vy*Math.cos(this.heading);
  const turn=(input.steer||0)*s.turnRate*(.35+.65*clamp(Math.abs(forwardSpeed)/.8,0,1))/(1+this.canvas*.12);
  this.yaw+=(turn-this.yaw)*(1-Math.exp(-dt/(this.tacking?.65+s.mass/2000:.25+s.mass/2000)));
  const oldHeading=this.heading;this.heading=(this.heading+this.yaw*dt+Math.PI*2)%(Math.PI*2);
  // Arcade pivoting remains available when translation is blocked.
  const fx=Math.sin(this.heading),fy=-Math.cos(this.heading),depth=hullDepth(world,this.x,this.y,this.heading,s);
  // Signed angle to the source of the local wind. No control input is consulted.
  const windEye=Math.atan2(-wind.x,wind.y);
  const signedAngle=Math.atan2(Math.sin(this.heading-windEye),Math.cos(this.heading-windEye));
  const oldAngle=Math.atan2(Math.sin(oldHeading-windEye),Math.cos(oldHeading-windEye));
  const toWind=Math.abs(signedAngle),inNoGo=windSpeed>1e-6&&toWind<=s.noGo;
  this.inNoGo=inNoGo;
  const entered=inNoGo&&Math.abs(this.previousWindAngle??oldAngle)>s.noGo;
  this.previousWindAngle=signedAngle;
  if(entered&&this.tackArmed&&this.canvas>0&&windSpeed>=.025){
   this.tackArmed=false;this.tackRecovery=0;
   this.tacking=forwardSpeed>this.tackVelocityThreshold;
   // Snapshot the time allowance from entry speed, never from steering intent.
   const entryTurnRate=s.turnRate*(.35+.65*clamp(forwardSpeed/.8,0,1))/(1+this.canvas*.12);
   this.tackWindow=2*s.noGo/entryTurnRate*1.8+.5;
   this.tackTime=0;this.tackEntrySide=Math.sign(oldAngle);this.tackCrossed=false;
  }
  if(this.tacking){
   this.tackTime+=dt;
   if(Math.sign(signedAngle)!==this.tackEntrySide)this.tackCrossed=true;
   // Expiry also handles holding directly into wind; no recurring momentum boost.
   if(this.canvas===0||!inNoGo||this.tackTime>=this.tackDuration||forwardSpeed<this.minimumBaseSpeed*.95||depth<=0)this.tacking=false;
  }
  if(!inNoGo&&toWind>s.noGo+.12){this.tackRecovery+=dt;if(this.tackRecovery>=1)this.tackArmed=true;}else this.tackRecovery=0;
  const auto=automaticTrim(this.heading,this.vx,this.vy,wind,this.tack);this.tack=auto.tack;this.targetSailAngle=auto.angle;
  // Trim has no artwork: restore optimum drive immediately outside the cone.
  this.sailAngle=auto.angle;this.trimEfficiency=1;
  const trim=inNoGo?0:1,polar=sailingDrive(toWind,s.noGo,s.bestAngle);
  // Gentle depth-relative drag: retain at least 60% of open-water drive.
  const depthRatio=clamp(depth/(s.draft+1.8),0,1);
  const shoal=.60+.40*depthRatio*depthRatio*(3-2*depthRatio);
  // Arcade steerage floor in navigable water, without defeating hull collision.
  const minimum=this.canvas>0?this.minimumBaseSpeed:0;
  const target=Math.max(minimum,s.maxSpeed*windSpeed*Math.pow(this.canvas,.8)*polar*shoal);
  // Resolve velocity in hull coordinates. Keel resistance removes side-slip
  // quickly while fore/aft momentum retains the slower sailing response.
  const rx=Math.cos(this.heading),ry=Math.sin(this.heading);
  const along=this.vx*fx+this.vy*fy,across=this.vx*rx+this.vy*ry;
  const driftScale=.04/Math.max(1,windSpeed);
  const desiredLeeway=this.canvas===0?(wind.x*rx+wind.y*ry)*driftScale:inNoGo?0:(wind.x*rx+wind.y*ry)*this.canvas*s.leeway/(1+s.draft*.3);
  const response=(.35+s.sailArea/s.mass*.24)*(.35+this.canvas*.65);
  const lateralResistance=7+s.draft*1.8+s.length;
  const nextAlong=this.canvas===0
   ?along+((wind.x*fx+wind.y*fy)*driftScale-along)*(1-Math.exp(-dt*.6))
   :this.tacking
   ?Math.max(minimum,forwardSpeed*Math.exp(-dt*Math.min(.025,.22/this.tackDuration)))
   :Math.max(minimum,along+((inNoGo?minimum:target)-along)*(1-Math.exp(-dt*(inNoGo?3.5:response))));
  const nextAcross=across+(desiredLeeway-across)*(1-Math.exp(-dt*lateralResistance));
  this.vx=fx*nextAlong+rx*nextAcross;
  this.vy=fy*nextAlong+ry*nextAcross;
  const x=this.x+this.vx*dt,y=this.y+this.vy*dt;
  this.luffing=this.canvas>0&&windSpeed>=.025&&inNoGo&&!this.tacking&&depth>0;
  this.status=this.canvas===0?'Bare poles: slight wind drift':windSpeed<.025?'Becalmed':this.tacking?'Tacking: momentum assist':this.luffing?'Luffing: minimum steerage':shoal<.85?'Shallow water: reduced speed':toWind<1.25?'Close-hauled: automatic trim':'Under way: automatic trim';
  this.blocked=hullDepth(world,x,y,this.heading,s)<=0;
  if(this.blocked){this.vx=0;this.vy=0;this.tacking=false;this.luffing=false;this.status='Land or map edge: turn away';}else{this.x=x;this.y=y;}
  this.speed=Math.hypot(this.vx,this.vy);
 }
}
