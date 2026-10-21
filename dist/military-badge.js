import {VESSEL_ROLES} from './bridge-rules.js?v=babbc3d3950e';
const MILITARY_CLASSES={frigate:'FRIGATE',war_galleon:'WAR_GALLEON',man_of_war:'FIRST_RATE'};
export function isMilitaryShip(ship){return ship.military===true||VESSEL_ROLES[MILITARY_CLASSES[ship.type]]?.militaryOnly===true;}
// Geometry is built once; only its screen position changes during rendering.
export function createMilitaryBadge(){
 const badge=new PIXI.Graphics();badge.eventMode='none';badge.label='Military vessel';badge.visible=false;
 const rim=[];for(let i=0;i<24;i++){const angle=i*Math.PI/12;rim.push(Math.cos(angle)*11,Math.sin(angle)*11);}
 badge.poly(rim).fill({color:0x102431,alpha:.92}).stroke({color:0xcfe5ee,width:1,alpha:.9});
 for(const angle of [-Math.PI/4,Math.PI/4]){
  const c=Math.cos(angle),s=Math.sin(angle),rotate=points=>points.flatMap(([x,y])=>[x*c-y*s,x*s+y*c]);
  badge.poly(rotate([[-1.2,2],[-1.2,-5],[0,-8],[1.2,-5],[1.2,2]])).fill({color:0xf4fbff}).stroke({color:0x15384a,width:.6});
  const guard=rotate([[-3,2],[3,2]]),grip=rotate([[0,2],[0,6]]);
  badge.moveTo(...guard.slice(0,2)).lineTo(...guard.slice(2)).stroke({color:0xffd579,width:1.8});
  badge.moveTo(...grip.slice(0,2)).lineTo(...grip.slice(2)).stroke({color:0xffd579,width:2});
 }
 return badge;
}
export function renderMilitaryBadge(badge,ship,camera,scale,width,height,visible=true){
 const x=(ship.x-camera.x)*scale+width/2,y=(ship.y-camera.y)*scale+height/2;
 badge.visible=visible&&isMilitaryShip(ship)&&x>-150&&y>-150&&x<width+150&&y<height+150;
 if(!badge.visible)return;
 // Heading zero points north. Keep the badge outside the hull and upright.
 const extent=(Math.abs(Math.sin(ship.heading))*ship.spec.length+Math.abs(Math.cos(ship.heading))*ship.spec.beam)*scale*.5;
 badge.position.set(x+Math.max(12,extent)+15,y-8);
}
