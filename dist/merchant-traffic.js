import {industryMarker} from './industry-markers.js?v=babbc3d3950e';
import {configurationRegistry,developerSelectedValues} from './configuration-registry.js?v=babbc3d3950e';
import {settingsForWorld} from './compiled-configuration.js?v=babbc3d3950e';
import {replaceRoadTerrain,resetRoadTerrain} from './feeder-roads.js?v=babbc3d3950e';
import {runtimeFaction} from './simulation-registry.js?v=babbc3d3950e';
import {createMilitaryBadge,renderMilitaryBadge} from './military-badge.js?v=babbc3d3950e';
import {SHIP_TYPES,SHIP_ART,sailFrameWeights} from './fleet.js?v=babbc3d3950e';
import {PennantRenderer} from './pennant.js?v=babbc3d3950e';
import {WakeRenderer} from './wake.js?v=babbc3d3950e';
import {waterDepth,localWindAt} from './ships.js?v=babbc3d3950e';
import {shipShadowStyle} from './sailing-test.js?v=babbc3d3950e';
import {trafficPose} from './traffic-motion.js?v=babbc3d3950e';
const fieldCopy=field=>field?{width:field.width,height:field.height,spacing:field.spacing,data:field.data}:null;
export class MerchantTraffic {
 constructor({app,getWorld,getWind,getField,getBasePort,getFrames,getPlayer=()=>null,onInfrastructure=()=>{},onConfiguration=()=>{},workerFactory=()=>new Worker(new URL('./merchant.worker.js?v=babbc3d3950e',import.meta.url),{type:'module'}),status}){
  Object.assign(this,{app,getWorld,getWind,getField,getBasePort,getFrames,getPlayer,onInfrastructure,onConfiguration,workerFactory,status});this.configurationRequests=new Map();this.configurationSerial=0;this.sessionId=null;this.worker=null;this.records=new Map();this.failed=new Set();this.epoch=0;this.environmentTime=0;this.playerTime=0;this.dockRequest=0;this.dockListener=null;this.density=6;this.simulationSpeed=1;
  this.layer=new PIXI.Container({isRenderGroup:true});this.layer.eventMode='none';app.stage.addChild(this.layer);this.layer.visible=false;
  this.showRoutes=false;this.routeLayer=new PIXI.Container({isRenderGroup:true});this.routes=new PIXI.Graphics();this.routeLayer.addChild(this.routes);this.layer.addChild(this.routeLayer);
  document.addEventListener('visibilitychange',()=>this.worker?.postMessage({type:'pause',paused:document.hidden}));
 }
 start(){
  if(this.worker)return;this.stop();const epoch=this.epoch,world=this.getWorld();if(!world)return;
  world.configuration=world.configuration?configurationRegistry.reconstruct(world.configuration):configurationRegistry.resolve(developerSelectedValues);this.settings=settingsForWorld(world);this.configurationRevision=this.settings.revision;this.density=Math.min(this.density,this.settings.fleet.maxMerchants);this.infrastructureWorld=world;this.industryBaseline=structuredClone(world.industries??[]);this.industryDataBaseline=world.data?.slice();this.infrastructureBaseline=new Map(world.ports.map(p=>[p.id,{docks:structuredClone(p.docks??[]),townTiles:[...(p.townTiles??[])],buildings:structuredClone(p.buildings??[]),roadTiles:structuredClone(p.roadTiles??[]),population:p.population,capacity:p.capacity,infrastructureRevision:p.infrastructureRevision??0}]));this.layer.visible=true;this.status.textContent='Preparing merchant traffic…';
  try{
   const worker=this.workerFactory();this.worker=worker;
   worker.onmessage=({data})=>{
    if(this.worker!==worker||this.epoch!==epoch)return;
    if(data.type==='configuration-result'){this.configurationResult(data);return;}
    if(data.sessionId){if(this.sessionId&&this.sessionId!==data.sessionId)return;this.sessionId=data.sessionId;}
    if(data.configurationRevision!==undefined&&data.configurationRevision!==this.configurationRevision)return;
    if(['economic-history','port-economy','port-cargo-history','industry-construction'].includes(data.type)){const callback=this.historyRequests?.get(data.requestId);this.historyRequests?.delete(data.requestId);callback?.(data);return;}
    if(data.type==='error'){this.stop();this.status.textContent='Merchant traffic unavailable. Restart the test to retry.';console.error('Merchant traffic:',data.message);return;}
    this.effectiveSpeed=data.effectiveSpeed??this.simulationSpeed;
    if(data.shipDetails!==undefined)this.shipDetails=data.shipDetails;
    if(data.type==='allocation'){const callback=this.allocationRequests?.get(data.requestId);this.allocationRequests?.delete(data.requestId);callback?.(data.result);return;}
    if(data.bridge)this.bridgeState=data.bridge;
    if(data.portInfrastructure){this.portInfrastructure??=new Map();this.portInfrastructure.set(data.portInfrastructure.portId,data.portInfrastructure);}
    if(data.infrastructure?.length){const world=this.getWorld();for(const change of data.infrastructure){const port=world?.ports.find(p=>p.id===change.id);if(port){Object.assign(port,Object.fromEntries(Object.entries(change).filter(([key])=>key!=='industries')));if(change.industries&&world.data)for(const i of world.industries.filter(i=>i.portId===port.id&&!change.industries.some(next=>next.id===i.id)))world.data[i.tileIndex*4+3]=1;if(change.industries)world.industries=[...world.industries.filter(i=>i.portId!==port.id),...structuredClone(change.industries)];if(change.industries&&world.data){for(const i of world.industries)world.data[i.tileIndex*4+3]=industryMarker(i.code);}if(change.roadTiles)replaceRoadTerrain(world,change.roadTiles);}}this.onInfrastructure(data.infrastructure);}
    if(data.portSupplies){this.portSupplies??=new Map();this.portSupplies.set(data.portSupplies.portId,data.portSupplies.stocks);}
    const sampleTime=data.simulationTime??(this.snapshotTime??-.1)+.1;this.snapshotTime=sampleTime;if(this.playTime===null)this.playTime=sampleTime-.1;
    if(data.playerReservation?.requestId===this.dockRequest)this.dockListener?.(data.playerReservation);
    const ships=data.ships.filter(s=>s.active);this.fleetSnapshots=ships;const moving=ships.filter(s=>s.speed>.05).length;
    const text=this.failed.size?'Some ship sprites could not load. Restart the test to retry.':data.note||`Merchants: ${ships.filter(s=>!s.military).length} · Patrols: ${ships.filter(s=>s.military).length} · Sailing: ${moving}`;if(this.status.textContent!==text)this.status.textContent=text;
    for(const ship of ships){
     const record=this.records.get(ship.id);
     if(record){record.samples.push({...ship,time:sampleTime});if(record.samples.length>8)record.samples.shift();record.target=ship;Object.assign(record.ship,{vx:ship.vx,vy:ship.vy,speed:ship.speed,canvasStage:ship.canvasStage,pennantColor:ship.pennantColor});}
     else if(!this.records.has(ship.id)&&!this.failed.has(ship.id)){
      // Reserve a slot before loading so repeated snapshots cannot duplicate art.
      this.records.set(ship.id,null);const recordSessionId=this.sessionId;
      this.getFrames(ship.type).then(frames=>{if(this.epoch!==epoch||this.worker!==worker||this.sessionId!==recordSessionId||!this.records.has(ship.id))return;this.records.set(ship.id,this.create(ship,frames,sampleTime));}).catch(error=>{if(this.epoch===epoch&&this.sessionId===recordSessionId){this.records.delete(ship.id);this.failed.add(ship.id);this.status.textContent='Some merchant sprites could not load. Restart the test to retry.';}console.error(error);});
     }
    }
    const active=new Set(ships.map(s=>s.id));for(const [id,record] of this.records)if(!active.has(id)){if(record)this.destroy(record);this.records.delete(id);}
   };
   worker.onerror=()=>{if(this.worker===worker){this.stop();this.status.textContent='Merchant traffic unavailable. Restart the test to retry.';}};
   const {n,bounds,h,depth,moisture,rock,biomes,ports,industries,config,configuration}=world;
   const s=this.getPlayer(),player=s?{type:s.type,x:s.x,y:s.y,heading:s.heading,vx:s.vx,vy:s.vy,speed:s.speed,stationary:!!s.docked||!!s.anchored,assisted:!!s.docking}:null;
   // Structured clone copies these arrays. Never transfer/detach renderer buffers.
   worker.postMessage({type:'start',world:{n,bounds,h,depth,moisture,rock,biomes,ports,industries,config,configuration},wind:this.getWind(),field:fieldCopy(this.getField()),basePortId:this.getBasePort()?.id,density:this.density,simulationSpeed:this.simulationSpeed,player});
  }catch(error){this.stop();this.status.textContent='Merchant traffic unavailable. Restart the test to retry.';console.error(error);}
 }
 create(snapshot,frames,time=this.snapshotTime??0){
  const ship={...snapshot,spec:SHIP_TYPES[snapshot.type]},art=SHIP_ART[snapshot.type];
  const shadow=new PIXI.Container({isRenderGroup:true}),hull=new PIXI.Container({isRenderGroup:true});
  this.layer.addChild(shadow);const wake=new WakeRenderer({stage:this.layer},{maxPoints:48,maxLife:3.5,redrawInterval:.1,detail:'merchant'});this.layer.addChild(hull);
  const sprites=[],shadows=[];
  for(let i=0;i<5;i++){const frame=Math.min(i,frames.length-1),sprite=new PIXI.Sprite(frames[frame]),shade=new PIXI.Sprite(frames[frame]);sprite.anchor.set(art.anchors[frame],.5);shade.anchor.set(art.anchors[frame],.5);shade.tint=0x071b25;hull.addChild(sprite);shadow.addChild(shade);sprites.push(sprite);shadows.push(shade);}
  const pennant=new PennantRenderer(hull),militaryBadge=createMilitaryBadge();this.layer.addChild(militaryBadge);
  return {ship,target:snapshot,samples:[{...snapshot,time}],hull,shadow,wake,pennant,militaryBadge,sprites,shadows};
 }
 destroy(record){record.militaryBadge.destroy();record.wake.layer.destroy({children:true});record.hull.destroy({children:true});record.shadow.destroy({children:true});}
 stop(){
  if(this.infrastructureBaseline&&this.getWorld()===this.infrastructureWorld){let changed=false;for(const port of this.infrastructureWorld.ports){const initial=this.infrastructureBaseline.get(port.id);if(initial&&port.infrastructureRevision!==initial.infrastructureRevision){Object.assign(port,structuredClone(initial));changed=true;}}if(changed){this.infrastructureWorld.industries=structuredClone(this.industryBaseline??[]);if(this.industryDataBaseline)this.infrastructureWorld.data.set(this.industryDataBaseline);const roads=this.infrastructureWorld.ports.map(p=>p.roadTiles??[]);resetRoadTerrain(this.infrastructureWorld);this.infrastructureWorld.ports.forEach((p,i)=>{p.roadTiles=roads[i];replaceRoadTerrain(this.infrastructureWorld,roads[i]);});this.onInfrastructure();}}this.infrastructureBaseline=null;this.infrastructureWorld=null;this.industryBaseline=null;this.industryDataBaseline=null;
  for(const callback of this.historyRequests?.values()??[])callback({error:'Simulation ended'});this.historyRequests=new Map();
  this.bridgeState=null;this.fleetSnapshots=[];this.shipDetails=null;this.inspectedShip=null;
  for(const callback of this.allocationRequests?.values()??[])callback({ok:false,error:{code:'TEST_ENDED'}});this.allocationRequests=new Map();this.portSupplies=new Map();this.inspectedPort=null;this.portInfrastructure=new Map();
  for(const callback of this.configurationRequests.values())callback({status:'rejected',diagnostics:[{message:'Test ended'}]});this.configurationRequests.clear();this.sessionId=null;
  this.dockRequest++;this.dockListener=null;this.playerTime=0;
  this.epoch++;this.worker?.terminate();this.worker=null;for(const record of this.records.values())if(record)this.destroy(record);this.records.clear();this.failed.clear();this.layer.visible=false;this.environmentTime=0;this.status.textContent='';
  this.routes.clear();
  this.snapshotTime=null;this.playTime=null;
 }
 configurationResult(data){
  const callback=this.configurationRequests.get(data.requestId);
  if(data.status!=='pending')this.configurationRequests.delete(data.requestId);
  if(data.sessionId===this.sessionId){
   if(data.status==='accepted'&&data.snapshot){
    const snapshot=configurationRegistry.reconstruct(data.snapshot);this.getWorld().configuration=snapshot;this.settings=settingsForWorld(this.getWorld());this.configurationRevision=snapshot.revision;
    if(data.newSessionId){for(const callback of this.historyRequests?.values()??[])callback({error:'Simulation restarted'});this.historyRequests=new Map();this.sessionId=data.newSessionId;for(const record of this.records.values())if(record)this.destroy(record);this.records.clear();this.failed.clear();this.snapshotTime=this.playTime=null;this.shipDetails=null;this.fleetSnapshots=[];this.portSupplies.clear();this.portInfrastructure.clear();this.bridgeState=null;this.dockRequest++;this.dockListener=null;
     const w=this.getWorld();w.industries=structuredClone(this.industryBaseline??[]);if(this.industryDataBaseline)w.data.set(this.industryDataBaseline);for(const port of w.ports){const initial=this.infrastructureBaseline?.get(port.id);if(initial)Object.assign(port,structuredClone(initial));}const roads=w.ports.map(p=>p.roadTiles??[]);resetRoadTerrain(w);w.ports.forEach((p,i)=>{p.roadTiles=roads[i];replaceRoadTerrain(w,roads[i]);});this.onInfrastructure();
    }
   }
   this.onConfiguration(data);
  }
  callback?.(data);
 }
 configurationOperation(type,edits,callback=()=>{}){
  if(!this.worker||!this.sessionId){callback({status:'rejected',diagnostics:[{message:'Wait for the worker to initialize'}]});return null;}
  const requestId=++this.configurationSerial;this.configurationRequests.set(requestId,callback);this.worker.postMessage({type,requestId,sessionId:this.sessionId,baseRevision:this.configurationRevision,...(edits===undefined?{}:{edits})});return requestId;
 }
 requestConfiguration(edits,callback){return this.configurationOperation('configuration-request',edits,callback);}
 restartConfiguration(callback){return this.configurationOperation('configuration-restart',undefined,callback);}
 cancelConfiguration(callback){return this.configurationOperation('configuration-cancel',undefined,callback);}
 requestEconomicHistory(commodityId,callback){if(!this.worker||!this.sessionId){callback({error:'Start the simulation first'});return;}this.historySerial=(this.historySerial??0)+1;const requestId=this.historySerial;this.historyRequests??=new Map();this.historyRequests.set(requestId,callback);this.worker.postMessage({type:'economic-history',requestId,sessionId:this.sessionId,commodityId});}
 requestIndustryConstruction(action,input,callback){if(!this.worker||!this.sessionId){callback({error:'Start the simulation first'});return;}const requestId=this.historySerial=(this.historySerial??0)+1;this.historyRequests??=new Map();this.historyRequests.set(requestId,callback);this.worker.postMessage({type:'industry-construction',requestId,sessionId:this.sessionId,baseRevision:this.configurationRevision,action,...input});return requestId;}
 requestPortEconomy(portId,callback){return this.requestPortReport('port-economy',portId,callback);}
 requestPortCargoHistory(portId,callback){return this.requestPortReport('port-cargo-history',portId,callback);}
 requestPortReport(type,portId,callback){if(!this.worker||!this.sessionId){callback({error:'Start the simulation first'});return;}const requestId=this.historySerial=(this.historySerial??0)+1;this.historyRequests??=new Map();this.historyRequests.set(requestId,callback);this.worker.postMessage({type,requestId,sessionId:this.sessionId,portId});}
 inspectShip(id){if(id!==this.inspectedShip){this.inspectedShip=id;this.shipDetails=null;this.worker?.postMessage({type:'ship-details',id});}}
 setSimulationSpeed(speed){this.simulationSpeed=Math.max(1,Math.min(20,Math.round(Number(speed)||1)));this.worker?.postMessage({type:'simulation-speed',speed:this.simulationSpeed});}
 setDebugRoutes(value){this.showRoutes=!!value;if(!value)this.routes.clear();}
 setHeatmap(faction){this.worker?.postMessage({type:'bridge-heatmap',faction});}
 inspectPort(portId){if(this.worker&&portId!==this.inspectedPort){this.inspectedPort=portId;this.worker.postMessage({type:'port-supplies',portId});}}
 allocateSupplies(portId,commodity,quantity,fromPool,callback){if(!this.worker){callback({ok:false,error:{code:'TEST_ENDED'}});return;}this.allocationSerial=(this.allocationSerial??0)+1;this.allocationRequests.set(this.allocationSerial,callback);this.worker.postMessage({type:'allocate-supplies',requestId:this.allocationSerial,portId,commodity,quantity,fromPool});}
 recoverStuck(){this.worker?.postMessage({type:'panic'});}
 setDensity(count){this.density=Math.max(0,Math.min(this.settings?.fleet.maxMerchants??settingsForWorld(this.getWorld()).fleet.maxMerchants,Math.round(Number(count)||0)));this.worker?.postMessage({type:'density',count:this.density});}
 requestDock(portId,ship,listener){this.dockRequest++;this.dockListener=listener;if(this.worker)this.worker.postMessage({type:'dock-request',requestId:this.dockRequest,portId,ship:{type:ship.type}});else listener(null);}
 releaseDock(){this.dockRequest++;this.dockListener=null;this.worker?.postMessage({type:'dock-release'});}
 markDock(status){this.worker?.postMessage({type:'dock-state',requestId:this.dockRequest,status});}
 inspectedShips(){return (this.fleetSnapshots??[]).map(ship=>{const record=this.records.get(ship.id);return record?{...ship,x:record.ship.x,y:record.ship.y,heading:record.ship.heading}:ship;});}
 update(dt){
  if(!this.worker||document.hidden)return;dt=Math.min(.1,dt);this.environmentTime+=dt;
  this.playerTime+=dt;if(this.playerTime>=.2){this.playerTime=0;const s=this.getPlayer();this.worker.postMessage({type:'player',ship:s?{type:s.type,faction:runtimeFaction(this.getBasePort()?.faction)??'ENGLAND',x:s.x,y:s.y,heading:s.heading,vx:s.vx,vy:s.vy,speed:s.speed,stationary:!!s.docked||!!s.anchored,assisted:!!s.docking}:null});}
  if(this.environmentTime>=.5){this.environmentTime=0;this.worker.postMessage({type:'environment',wind:this.getWind(),field:fieldCopy(this.getField())});}
  if(this.playTime!==null){const lag=this.snapshotTime-this.playTime;this.playTime+=dt*(this.effectiveSpeed??this.simulationSpeed)*Math.max(.8,Math.min(1.2,1+(lag-.1)*2));this.playTime=Math.min(this.playTime,this.snapshotTime+.2);}
  for(const record of this.records.values()){if(!record)continue;const s=record.ship;
   Object.assign(s,trafficPose(record.samples,this.playTime??this.snapshotTime));
   record.wake.update(dt*(this.effectiveSpeed??this.simulationSpeed),s);record.pennant.update(dt*(this.effectiveSpeed??this.simulationSpeed),s,localWindAt(this.getField(),s.x,s.y,this.getWind()));
  }
 }
 render(camera,scale,width,height){
  if(!this.worker)return;
  this.routes.clear();if(this.showRoutes)for(const record of this.records.values()){
   if(!record||!record.target.waypoints?.length)continue;const color=record.ship.pennantColor;
   const screen=p=>({x:(p.x-camera.x)*scale+width/2,y:(p.y-camera.y)*scale+height/2}),start=screen(record.ship);
   this.routes.moveTo(start.x,start.y);for(const p of record.target.waypoints){const q=screen(p);this.routes.lineTo(q.x,q.y);}this.routes.stroke({color,width:1.5,alpha:.7});
   for(const p of record.target.waypoints){const q=screen(p);this.routes.circle(q.x,q.y,2.5).fill({color,alpha:.8});}
  }
  for(const record of this.records.values()){if(!record)continue;const s=record.ship,x=(s.x-camera.x)*scale+width/2,y=(s.y-camera.y)*scale+height/2;
   const visible=x>-150&&y>-150&&x<width+150&&y<height+150;record.hull.visible=record.shadow.visible=record.wake.layer.visible=visible;
   renderMilitaryBadge(record.militaryBadge,s,camera,scale,width,height,visible);
   if(!visible)continue;
   record.hull.position.set(x,y);record.hull.rotation=s.heading;
   const shadow=shipShadowStyle(waterDepth(this.getWorld(),s.x,s.y),scale);record.shadow.position.set(x+shadow.x,y+shadow.y);record.shadow.rotation=s.heading;record.shadow.alpha=shadow.alpha;
   const weights=sailFrameWeights(s.type,s.canvasStage),art=SHIP_ART[s.type];
   for(let i=0;i<5;i++){const sprite=record.sprites[i],shade=record.shadows[i];sprite.alpha=shade.alpha=weights[i];sprite.visible=shade.visible=weights[i]>0;sprite.height=s.spec.length*scale/art.heightFraction;sprite.width=sprite.height*sprite.texture.width/sprite.texture.height;shade.width=sprite.width;shade.height=sprite.height;}
   record.wake.render(camera,scale,width,height,this.getWorld());if(scale>6)record.pennant.render(s,scale);record.pennant.layer.visible=scale>6;
  }
 }
}
