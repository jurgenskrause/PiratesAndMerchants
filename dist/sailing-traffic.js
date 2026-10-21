import {angleDifference,direction,headingTo,distance,windEye} from './navigation.js?v=babbc3d3950e';
export function windSide(ship,wind){const incoming=-(wind.x*Math.cos(ship.heading)+wind.y*Math.sin(ship.heading));return Math.abs(incoming)<.03?0:incoming>0?1:-1;}
export function givesWay(a,b,wind){
 if(b.stationary||b.assisted)return true;
 // Overtaking remains give-way regardless of tack (Rule 13).
 if(Math.abs(angleDifference(headingTo(b,a),b.heading))>Math.PI*5/8&&a.speed>b.speed+.05)return true;
 if(Math.abs(angleDifference(headingTo(a,b),a.heading))>Math.PI*5/8&&b.speed>a.speed+.05)return false;
 const one=windSide(a,wind),two=windSide(b,wind);
 const windward=(a.x-b.x)*wind.x+(a.y-b.y)*wind.y<0;
 if(one===-1&&two===0&&!windward)return true;
 if(one&&two&&one!==two)return one===-1;
 if(one===two&&one!==0&&Math.abs((a.x-b.x)*wind.x+(a.y-b.y)*wind.y)>.03)return windward;
 return String(a.id)<String(b.id);
}
export function closestApproach(a,b,horizon=12){
 const px=b.x-a.x,py=b.y-a.y,vx=b.vx-a.vx,vy=b.vy-a.vy,v2=vx*vx+vy*vy;
 const time=v2>1e-8?Math.max(0,Math.min(horizon,-(px*vx+py*vy)/v2)):0;
 return {time,distance:Math.hypot(px+vx*time,py+vy*time),closing:px*vx+py*vy<0};
}
export function avoidTraffic(ship,desired,wind,others,navigator){
 const horizon=Math.max(12,Math.PI/ship.spec.turnRate),self={...ship,id:ship.id},near=(others instanceof TrafficIndex?others.query(ship,horizon):others).filter(o=>o.id!==self.id&&distance(self,o)<Math.max(14,(Math.max(ship.speed,Math.hypot(ship.vx,ship.vy))+Math.max(o.speed,Math.hypot(o.vx,o.vy)))*horizon+(ship.spec.length+o.spec.length)*.65+1));
 const hazards=near.filter(o=>{const c=closestApproach(self,o,horizon),radius=(ship.spec.length+o.spec.length)*.65+1;return (c.closing||c.distance<radius)&&c.distance<radius&&(givesWay(self,o,wind)||distance(self,o)<radius*1.1);});
 if(!hazards.length)return {heading:desired,sail:1,giveWay:false};
 let best=null;const look=Math.max(4,ship.speed/ship.spec.turnRate*2+ship.spec.length*2);
 for(const offset of [Math.PI/6,-Math.PI/6,Math.PI/3,-Math.PI/3,Math.PI/2,-Math.PI/2,Math.PI]){
  const heading=desired+offset;if(Math.hypot(wind.x,wind.y)>=.025&&Math.abs(angleDifference(heading,windEye(wind)))<ship.spec.noGo+.12)continue;const v=direction(heading),p={x:ship.x+v.x*look,y:ship.y+v.y*look};if(!navigator.clearSegment(ship,p,ship.spec))continue;
  const probe={...self,vx:v.x*Math.max(.2,ship.speed),vy:v.y*Math.max(.2,ship.speed)};
  let penalty=0;for(const other of near){const c=closestApproach(probe,other,horizon),radius=(ship.spec.length+other.spec.length)*.65+1;penalty+=Math.max(0,radius-c.distance)*20;
   const pass={x:probe.x+probe.vx*c.time-other.x-other.vx*c.time,y:probe.y+probe.vy*c.time-other.y-other.vy*c.time},f=direction(other.heading);if(hazards.includes(other)&&pass.x*f.x+pass.y*f.y>0)penalty+=2;
  }
  const score=penalty+Math.abs(offset)+(offset<0?.05:0);if(!best||score<best.score)best={heading,score};
 }
 const urgent=hazards.some(o=>distance(self,o)<(ship.spec.length+o.spec.length)*.65+1);return {heading:best?.heading??desired,sail:urgent?.5:1,giveWay:true};
}

// One immutable fleet position snapshot per bridge tick. Conservatively include
// both ships' motion over the complete prediction horizon and hull clearance.
export class TrafficIndex {
 constructor(vessels,cellSize=24){this.cellSize=cellSize;this.cells=new Map();this.order=new Map();this.maxSpeed=0;this.maxLength=0;let i=0;for(const v of vessels){this.order.set(v,i++);this.maxSpeed=Math.max(this.maxSpeed,v.speed??0,Math.hypot(v.vx??0,v.vy??0));this.maxLength=Math.max(this.maxLength,v.spec.length);const key=`${Math.floor(v.x/cellSize)},${Math.floor(v.y/cellSize)}`,cell=this.cells.get(key)??[];cell.push(v);this.cells.set(key,cell);}}
 query(ship,horizon){const ownSpeed=Math.max(ship.speed,Math.hypot(ship.vx,ship.vy)),radius=Math.max(14,(ownSpeed+this.maxSpeed)*horizon+(ship.spec.length+this.maxLength)*.65+1),s=this.cellSize,result=[];
  const x0=Math.floor((ship.x-radius)/s),x1=Math.floor((ship.x+radius)/s),y0=Math.floor((ship.y-radius)/s),y1=Math.floor((ship.y+radius)/s);
  // Sparse large horizons must not enumerate thousands of empty buckets.
  if((x1-x0+1)*(y1-y0+1)>this.cells.size*4){for(const cell of this.cells.values())for(const v of cell)if(distance(ship,v)<=radius)result.push(v);}else for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)for(const v of this.cells.get(`${x},${y}`)??[])if(distance(ship,v)<=radius)result.push(v);
  return result.sort((a,b)=>this.order.get(a)-this.order.get(b));
 }
}
