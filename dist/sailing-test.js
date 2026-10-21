import {contextualName} from './contextual-names.js?v=babbc3d3950e';
import {vesselRegistry} from './simulation-registry.js?v=babbc3d3950e';
import {createMilitaryBadge,renderMilitaryBadge} from './military-badge.js?v=babbc3d3950e';
import {SHIP_TYPES,SHIP_ART,sailFrameWeights} from './fleet.js?v=babbc3d3950e';
import {SailingDial} from './sailing-dial.js?v=babbc3d3950e';
import {TackSpeedParticles} from './tack-speed-particles.js?v=babbc3d3950e';
import {TackIndicator} from './tack-indicator.js?v=babbc3d3950e';
import {PennantRenderer} from './pennant.js?v=babbc3d3950e';
import {WakeRenderer} from './wake.js?v=babbc3d3950e';
import {CANVAS_SETTINGS,Ship,findShipSpawn,localWindAt,waterDepth} from './ships.js?v=babbc3d3950e';
export function shipShadowStyle(depth,scale){
 const d=Math.max(0,depth)/(Math.max(0,depth)+4);
 return{x:(.035+.18*d)*scale,y:(.05+.26*d)*scale,alpha:.26-.15*d,blur:Math.max(.35,(.012+.075*d)*scale)};
}
export class SailingTest{
 constructor({app,map,atlas,getWorld,getWind,getField,getAnchor,getFaction=()=>null,loadAtlas,onFollow,onActiveChange=()=>{}}){
  Object.assign(this,{app,map,getWorld,getWind,getField,getAnchor,getFaction,onFollow,onActiveChange});this.loadAtlas=loadAtlas;this.frameCache=new Map();this.loadouts=new Map();this.launchRequest=0;this.ship=null;this.keys=new Set();this.holds=new Set();this.accumulator=0;this.hudTime=0;
  const $=id=>document.getElementById(id);this.panel=$('sailing-panel');this.button=$('test-ship');this.readout=$('ship-readout');this.message=$('ship-status');this.follow=$('ship-follow');this.typeSelect=$('ship-type');this.typeSelect.value='sloop';this.armamentSelect=$('ship-armament');this.armorSelect=$('ship-armor');
  this.typeSelect.onchange=()=>this.start();for(const kind of ['armament','armor'])this[kind+'Select'].onchange=()=>{if(!this.ship)return;this.ship[kind].active=Number(this[kind+'Select'].value);this.loadouts.set(this.ship.type,{armament:this.ship.armament.active,armor:this.ship.armor.active});this.updateHUD();};
  this.sailingDial=new SailingDial(app);
  this.speedParticles=new TackSpeedParticles(app);
  this.shadowLayer=new PIXI.Container({isRenderGroup:true});this.shadowLayer.visible=false;this.shadowBlur=new PIXI.BlurFilter({strength:1,quality:2});this.shadowLayer.filters=[this.shadowBlur];app.stage.addChild(this.shadowLayer);
  this.wake=new WakeRenderer(app);this.layer=new PIXI.Container({isRenderGroup:true});app.stage.addChild(this.layer);this.layer.visible=false;
  const initial=this.framesFor('sloop',atlas);
  this.sprites=Array.from({length:5},(_,i)=>{const sprite=new PIXI.Sprite(initial[Math.min(i,3)]);sprite.anchor.set(.5);this.layer.addChild(sprite);return sprite;});
  this.shadows=this.sprites.map(sprite=>{const shadow=new PIXI.Sprite(sprite.texture);shadow.anchor.set(.5);shadow.tint=0x071b25;this.shadowLayer.addChild(shadow);return shadow;});
  this.pennant=new PennantRenderer(this.layer);this.tackIndicator=new TackIndicator(app);this.militaryBadge=createMilitaryBadge();app.stage.addChild(this.militaryBadge);
  this.button.onclick=()=>this.ship?this.stop():this.start();$('ship-reset').onclick=()=>this.start();$('ship-exit').onclick=()=>this.stop();
  window.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]')||!this.ship||e.ctrlKey||e.metaKey||e.altKey||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)||e.target.isContentEditable)return;if(e.key==='Escape'){e.preventDefault();this.stop();return;}if(e.key.startsWith('Arrow')){e.preventDefault();e.stopImmediatePropagation();if(!e.repeat&&!this.keys.has(e.key))this.changeCanvas(e.key);this.keys.add(e.key);}},{capture:true});
  window.addEventListener('keyup',e=>this.keys.delete(e.key));window.addEventListener('blur',()=>this.clear());document.addEventListener('visibilitychange',()=>this.clear());
  for(const button of this.panel.querySelectorAll('[data-control]')){
   button.onpointerdown=e=>{e.preventDefault();button.setPointerCapture(e.pointerId);if(!this.holds.has(button.dataset.control))this.changeCanvas(button.dataset.control);this.holds.add(button.dataset.control);};
   const release=()=>this.holds.delete(button.dataset.control);button.onpointerup=release;button.onpointercancel=release;button.onlostpointercapture=release;
  }
 }
 framesFor(type,atlas){if(this.frameCache.has(type))return this.frameCache.get(type);const art=SHIP_ART[type],width=atlas.width/art.frames;const frames=Array.from({length:art.frames},(_,i)=>new PIXI.Texture({source:atlas.source,frame:new PIXI.Rectangle(i*width+1,1,width-2,atlas.height-2)}));this.frameCache.set(type,frames);return frames;}
 equipSprites(type){const art=SHIP_ART[type],frames=this.frameCache.get(type);for(let i=0;i<5;i++){const frame=Math.min(i,frames.length-1);for(const sprite of [this.sprites[i],this.shadows[i]]){sprite.texture=frames[frame];sprite.anchor.set(art.anchors[frame],.5);}}}
 equipmentUI(){const s=this.ship;for(const kind of ['armament','armor']){const select=this[kind+'Select'];select.innerHTML=Array.from({length:s[kind].capacity},(_,i)=>`<option value="${i+1}">Level ${i+1}</option>`).join('');select.value=String(s[kind].active);document.getElementById('ship-'+kind+'-capacity').textContent=`Capacity ${s[kind].capacity}/5`;}
  document.getElementById('ship-profile').textContent=`${s.spec.rig} · ${s.spec.role}. Hold ${s.spec.cargoCapacity} · Draft ${s.spec.draft} · Upwind limit ${Math.round(s.spec.noGo*180/Math.PI)}°`;
 }
 changeCanvas(key){if(this.ship&&(key==='ArrowUp'||key==='ArrowDown')){this.ship.adjustCanvas(key==='ArrowUp'?1:-1);this.updateHUD();}}
 clear(){this.keys.clear();this.holds.clear();this.accumulator=0;}
 async start(){
  const type=SHIP_TYPES[this.typeSelect.value]?this.typeSelect.value:'sloop',request=++this.launchRequest;
  if(!this.frameCache.has(type)){this.panel.hidden=false;this.message.textContent='Preparing '+SHIP_TYPES[type].name+'…';try{const atlas=await this.loadAtlas(type);if(request!==this.launchRequest)return;this.framesFor(type,atlas);}catch(error){if(request===this.launchRequest)this.message.textContent='Could not load this ship. Choose it again to retry.';return;}}
  const world=this.getWorld();if(!world)return;const wind=this.getWind(),heading=Math.atan2(wind.x,-wind.y)+Math.PI/2;
  const spawn=findShipSpawn(world,this.getAnchor(),heading,type);this.panel.hidden=false;
  if(!spawn){this.stop(false);this.panel.hidden=false;this.message.textContent='No safe launch water. Try a larger map or fewer islands.';return;}
  this.clear();this.wake.reset();this.ship=new Ship(type,spawn);const loadout=this.loadouts.get(type);if(loadout){this.ship.armament.active=loadout.armament;this.ship.armor.active=loadout.armor;}this.equipSprites(type);this.equipmentUI();const faction=this.getFaction();if(faction){this.ship.faction=faction.faction;this.ship.factionColor=faction.color;this.ship.pennantColor=faction.pennantColor??this.ship.pennantColor;}const role=vesselRegistry.values().find(v=>v.type===type);this.ship.shipName=contextualName(this.ship.faction,'ships',(world.config?.seed??'world')+'|player',{military:role.militaryOnly});this.ship.captainName=contextualName(this.ship.faction,'captains',(world.config?.seed??'world')+'|player');this.pennant.reset();this.tackIndicator.reset();this.speedParticles.reset();this.sailingDial.reset();this.shadowDepth=waterDepth(world,spawn.x,spawn.y);this.shadowLayer.visible=true;this.layer.visible=true;this.button.textContent='Withdraw vessel';this.button.setAttribute('aria-pressed','true');this.follow.checked=true;this.onFollow(this.ship,true);this.map.focus({preventScroll:true});this.updateHUD();this.onActiveChange(true);
 }
 stop(focus=true){this.launchRequest++;this.clear();this.docking?.reset();this.wake.reset();this.pennant.reset();this.tackIndicator.reset();this.speedParticles.reset();this.sailingDial.reset();this.ship=null;this.militaryBadge.visible=false;this.shadowLayer.visible=false;this.layer.visible=false;this.panel.hidden=true;this.button.textContent='Launch own vessel';this.button.setAttribute('aria-pressed','false');this.onActiveChange(false);if(focus)this.button.focus({preventScroll:true});}
 update(dt){if(!this.ship||document.hidden)return;this.accumulator+=Math.min(.1,dt);
  const pressed=k=>this.keys.has(k)||this.holds.has(k),input={steer:Number(pressed('ArrowRight'))-Number(pressed('ArrowLeft'))};
  while(this.accumulator>=1/60){const s=this.ship,wind=localWindAt(this.getField(),s.x,s.y,this.getWind());if(!this.docking?.step(s,1/60))s.step(1/60,input,wind,this.getWorld());this.wake.update(1/60,s);this.pennant.update(1/60,s,wind);this.tackIndicator.update(1/60);this.speedParticles.update(1/60,s);this.shadowDepth+=(waterDepth(this.getWorld(),s.x,s.y)-this.shadowDepth)*(1-Math.exp(-5/60));this.accumulator-=1/60;}
  if(this.follow.checked)this.onFollow(this.ship,false);this.hudTime+=dt;if(this.hudTime>.1){this.hudTime=0;this.updateHUD();}
 }
 updateHUD(){if(!this.ship)return;const s=this.ship;this.readout.textContent=`${CANVAS_SETTINGS[s.canvasStage]} · Canvas ${s.canvasStage}/4 (${Math.round(s.canvas*100)}%) · Speed ${s.speed.toFixed(2)} · Wind ${Math.round(s.localWind*100)}%`;this.message.textContent=`${s.status} · ${s.tack>0?'Starboard':'Port'} tack · Trim ${Math.round(Math.abs(s.sailAngle)*180/Math.PI)}°`;}
 render(camera,scale,width,height){if(!this.ship)return;this.wake.render(camera,scale,width,height,this.getWorld());const s=this.ship,weights=sailFrameWeights(s.type,s.canvasStage),art=SHIP_ART[s.type];
  this.sailingDial.render(s,localWindAt(this.getField(),s.x,s.y,this.getWind()),camera,scale,width,height);
  this.speedParticles.render(camera,scale,width,height,this.getWorld());this.pennant.render(s,scale);this.tackIndicator.render(s,camera,scale,width,height);
  renderMilitaryBadge(this.militaryBadge,s,camera,scale,width,height);
  this.layer.position.set((s.x-camera.x)*scale+width/2,(s.y-camera.y)*scale+height/2);this.layer.rotation=s.heading;
  const shadow=shipShadowStyle(this.shadowDepth,scale);this.shadowLayer.position.set((s.x-camera.x)*scale+width/2+shadow.x,(s.y-camera.y)*scale+height/2+shadow.y);this.shadowLayer.rotation=s.heading;this.shadowLayer.alpha=shadow.alpha;this.shadowBlur.strength=shadow.blur;
  for(let i=0;i<5;i++){const p=this.sprites[i];p.alpha=weights[i];p.visible=p.alpha>0;p.height=s.spec.length*scale/art.heightFraction;p.width=p.height*p.texture.width/p.texture.height;const q=this.shadows[i];q.alpha=p.alpha;q.visible=p.visible;q.width=p.width;q.height=p.height;}
 }
}
