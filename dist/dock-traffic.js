import {BerthManager,largeVessel,dockableCells} from './port-infrastructure.js?v=babbc3d3950e';
import {dockRegistry,settlementRegistry} from './simulation-registry.js?v=babbc3d3950e';
import {coastDistances,tileIndex,hexDistance,hexNeighbors,waterDepthAt} from './hex-topology.js?v=babbc3d3950e';
import {SHIP_TYPES,hullDepth} from './ships.js?v=babbc3d3950e';
import {safePose} from './navigation-safety.js?v=babbc3d3950e';
import {direction,distance,Navigator,headingTo} from './navigation.js?v=babbc3d3950e';
import {worldToAxial,axialToWorld,DIRECTIONS} from './world.js?v=babbc3d3950e';
export function dockChannel(port){const raw=port.source??port,dock=raw.dockPosition??port.position,out=raw.harborPosition?direction(headingTo(raw.harborPosition,dock)):direction((port.berth?.heading??0)+Math.PI/2);return{dock,out};}
export function dockExit(port){const {dock,out}=dockChannel(port),cell=worldToAxial(dock.x,dock.y);let target=null,best=-Infinity;for(const [dq,dr] of DIRECTIONS){const p=axialToWorld(cell.q+dq,cell.r+dr),score=(p.x-dock.x)*out.x+(p.y-dock.y)*out.y;if(score>best){best=score;target=p;}}return target;}
export function dockingSlots(world,port){
 const raw=port.source??port,spec=SHIP_TYPES.fluyt,dock=raw.dockPosition??port.position;
 if(!raw.harborPosition){const base=port.berth??{...dock,heading:0},right={x:Math.cos(base.heading),y:Math.sin(base.heading)};return [base,{x:base.x+right.x*2.6,y:base.y+right.y*2.6,heading:base.heading}];}
 const heading=headingTo(raw.harborPosition,dock),out=direction(heading),right={x:Math.cos(heading),y:Math.sin(heading)};
 const slots=[];for(const side of [-1,1]){
  let found=null;for(let offset=.5;offset<=16&&!found;offset+=.5)for(const lateral of [.9,1.3,1.7,2.1,2.5]){const p={x:dock.x+out.x*offset+right.x*side*lateral,y:dock.y+out.y*offset+right.y*side*lateral,heading};
   if(Array.from({length:8},(_,i)=>hullDepth(world,p.x,p.y,i*Math.PI/4,spec)).every(d=>d>0)){found=p;break;}
  }if(found)slots.push(found);
 }return slots.length===2?slots:[];
}
// Capital ships lie across the pier tip, with room to swing their entire hull.
export function pierEndMooring(world,port,spec){
 if(port.tiles){const p=hexDockingSlots(world,port,spec,{exclusive:true}).find(p=>p.safe);return p?{berth:p,exit:p.exit}:null;}
 const {dock,out}=dockChannel(port),heading=Math.atan2(out.x,-out.y)+Math.PI/2,nav=new Navigator(world),diameter=Math.hypot(spec.length,spec.beam)+.6,clearance={...spec,length:diameter,beam:diameter,draft:.001};
 const clear=p=>Array.from({length:32},(_,i)=>safePose(world,{...p,heading:i*Math.PI/16},clearance)&&hullDepth(world,p.x,p.y,i*Math.PI/16,spec)>=spec.draft).every(Boolean);
 for(let offset=spec.length*.5+1;offset<=24;offset+=.5){
  const berth={x:dock.x+out.x*offset,y:dock.y+out.y*offset,heading},exit={x:berth.x+out.x*(spec.length+2),y:berth.y+out.y*(spec.length+2)};
  if(clear(berth)&&clear(exit)&&nav.clearSegment(berth,exit,clearance))return {berth,exit};
 }return null;
}
// Every modern berth is centered on a designated water hex beside the tip.
export function hexDockingSlots(world,dock,spec,{exclusive=largeVessel(spec)}={}){
 const nav=new Navigator(world),{out}=dockChannel(dock),heading=headingTo(dock.harborPosition,dock.dockPosition)+(exclusive?Math.PI/2:0);
 return dockableCells(world,dock.tip,dock.tiles).map(cell=>{
  const p={...axialToWorld(cell.q,cell.r),heading,cell:{...cell}};
  const step=dock.tiles.length>1?{q:dock.tip.q-dock.tiles.at(-2).q,r:dock.tip.r-dock.tiles.at(-2).r}:{q:dock.water.q-dock.land.q,r:dock.water.r-dock.land.r};
  p.exit={...axialToWorld(cell.q+step.q,cell.r+step.r),heading};
  const clearance=exclusive?{...spec,length:Math.hypot(spec.length,spec.beam)+.6,beam:Math.hypot(spec.length,spec.beam)+.6,draft:.001}:{...spec,draft:.001};
  p.safe=hullDepth(world,p.x,p.y,heading,spec)>=spec.draft&&safePose(world,p,spec)&&safePose(world,p.exit,spec)&&nav.clearSegment(p,p.exit,clearance)&&(!exclusive||Array.from({length:16},(_,i)=>i*Math.PI/8).every(h=>safePose(world,{...p,heading:h},clearance)&&safePose(world,{...p.exit,heading:h},clearance)));
  return p;
 });
}
export function berthHullsOverlap(a,aSpec,b,bSpec){
 const forwardA=direction(a.heading),forwardB=direction(b.heading),sideA={x:-forwardA.y,y:forwardA.x},sideB={x:-forwardB.y,y:forwardB.x};
 const radius=(spec,forward,side,axis)=>Math.abs(forward.x*axis.x+forward.y*axis.y)*spec.length*.5+Math.abs(side.x*axis.x+side.y*axis.y)*spec.beam*.5+.08;
 return [forwardA,sideA,forwardB,sideB].every(axis=>Math.abs((b.x-a.x)*axis.x+(b.y-a.y)*axis.y)<radius(aSpec,forwardA,sideA,axis)+radius(bSpec,forwardB,sideB,axis));
}
// Reservations cover approach, mooring and departure. Queue order is deterministic.
export class DockTraffic {
 constructor(world,ports){this.world=world;this.ports=new Map(ports.map(p=>[p.id,p]));this.managers=new Map([...this.ports].map(([id,p])=>[id,new BerthManager(world,p)]));this.reservations=new Map();this.indexDirty=true;this.sequence=0;this.navigator=new Navigator(world);this.slots=new Map();this.endMoorings=new Map();this.endRequired=new Map();this.offers=new Map();this.previewDocks=new Map();this.docksById=new Map([...this.managers.values()].flatMap(m=>m.docks.map(d=>[d.id,d])));this.tickNumber=0;this.waitSamples=new Map();this.infrastructureChanges=new Map();}
 previewAnchor(portId,spec){const port=this.ports.get(portId);return port?this.#anchor(port,spec,this.plannedDock(portId,spec)):null;}
 #invalidate(){this.indexDirty=true;}
 #indexes(){if(!this.indexDirty)return;this.byPort=new Map();this.byDock=new Map();this.occupiedCells=new Map();this.anchorCells=new Map();this.queues=new Map();this.busyDocks=new Map();this.queuePositions=new Map();for(const r of this.reservations.values()){
  const port=this.byPort.get(r.portId)??[];port.push(r);this.byPort.set(r.portId,port);
  const dock=this.byDock.get(r.dockId)??[];dock.push(r);this.byDock.set(r.dockId,dock);
  if(r.slot!==null)for(const cell of r.occupiedCells??[]){const ids=this.occupiedCells.get(cell)??new Set();ids.add(r.id);this.occupiedCells.set(cell,ids);}
  if(r.anchor&&r.slot===null){const cell=tileIndex(this.world,worldToAxial(r.anchor.x,r.anchor.y));const ids=this.anchorCells.get(cell)??new Set();ids.add(r.id);this.anchorCells.set(cell,ids);}
  if(['APPROACHING','DEPARTING'].includes(r.status)){const key=r.portId+'|'+r.dockId;this.busyDocks.set(key,(this.busyDocks.get(key)??0)+1);}
  if(r.slot===null&&r.waiting){const q=this.queues.get(r.portId)??[];q.push(r);this.queues.set(r.portId,q);}
 }for(const queue of this.queues.values()){queue.sort((a,b)=>a.sequence-b.sequence);queue.forEach((r,i)=>this.queuePositions.set(r.id,i+1));}this.indexDirty=false;}
 manager(portId){return this.managers.get(portId);}
 compatible(portId,spec){return this.manager(portId)?.compatible(spec)??[];}
 #dock(portId,dockId){return this.docksById.get(dockId)??this.previewDocks.get(dockId)??this.manager(portId)?.docks[0];}
 #key(dock,spec){return `${dock.id}:${dock.dockTypeId}:${spec.length}:${spec.beam}:${spec.draft}:${spec.berthsRequired??1}`;}
 offer(portId,dock,spec){this.previewDocks.set(dock.id,dock);const key=this.#key(dock,spec);if(this.offers.has(key))return this.offers.get(key);const definition=dockRegistry.get(dock.dockTypeId);
  if(dock.tiles){
   const exclusive=largeVessel(spec)||this.endRequired.get(key)===true,slots=hexDockingSlots(this.world,dock,spec,{exclusive});this.slots.set(dock.id,slots);
   const result=slots.some(p=>p.safe)?{dock,slots,capacity:definition.max_simultaneous_ships,needed:exclusive?definition.max_simultaneous_ships:1,exclusive,modern:true}:null;this.offers.set(key,result);return result;
  }
  const slots=this.slots.get(dock.id)??dockingSlots(this.world,dock);this.slots.set(dock.id,slots);
  const end=this.requiresPierEnd(portId,spec,dock.id),needed=end?2:1,mooring=end?this.mooring(portId,spec,dock.id):null;
  const valid=end?!!mooring:slots.length>=2&&slots.every(p=>hullDepth(this.world,p.x,p.y,p.heading,spec)>=spec.draft);
  const result=valid?{dock,slots:end&&slots.length<needed?Array.from({length:needed},()=>mooring.berth):slots,needed,endMooring:mooring}:null;this.offers.set(key,result);return result;
 }
 plannedDock(portId,spec){for(const dock of this.compatible(portId,spec)){const offer=this.offer(portId,dock,spec);if(offer)return offer;}return null;}
 approach(portId,spec){const offer=this.plannedDock(portId,spec);if(!offer)return null;return offer.modern?offer.slots.find(p=>p.safe)?.exit:offer.endMooring?.exit??dockExit(offer.dock);}
 destination(portId,spec){return this.plannedDock(portId,spec)?.dock.dockPosition??this.ports.get(portId)?.position;}
 canDock(portId,spec){return !!this.plannedDock(portId,spec);}
 request(id,portId,spec){this.#invalidate();
  const existing=this.reservations.get(id);if(existing?.portId===portId&&existing.waiting!==false){this.update();return this.get(id);}if(existing)this.release(id);
  const port=this.ports.get(portId),offer=this.plannedDock(portId,spec);if(!port||!offer)return null;
  const reservation={id,portId,dockId:null,slot:null,slots:[],sequence:++this.sequence,spec,status:'QUEUED',anchor:null,waiting:true,queuedAt:this.tickNumber};
  reservation.anchor=this.#anchor(port,spec,offer);if(!reservation.anchor)return null;
  this.reservations.set(id,reservation);this.#invalidate();this.#promote(portId);this.update();return this.get(id);
 }
 standby(id,portId,spec){this.#invalidate();
  let r=this.reservations.get(id);if(r&&r.portId!==portId){this.release(id);r=null;}
  const port=this.ports.get(portId);if(!port)return null;const offer=r?.dockId?this.offer(portId,this.#dock(portId,r.dockId),spec):this.plannedDock(portId,spec);
  const anchor=r&&r.slot!==null?this.#anchor(port,spec,offer):r?.anchor??this.#anchor(port,spec,offer);if(!anchor)return null;
  if(!r){r={id,portId,dockId:null,slot:null,slots:[],sequence:++this.sequence,spec,anchor};this.reservations.set(id,r);}
  r.anchor=anchor;r.waiting=false;r.status=r.slot===null?'ANCHORED':'DEPARTING';this.#invalidate();this.update();return this.get(id);
 }
 requiresPierEnd(portId,spec,dockId=null){
  const modern=this.#dock(portId,dockId);if(modern?.tiles)return largeVessel(spec)||this.endRequired.get(this.#key(modern,spec))===true;
  if(spec.berthsRequired===2)return true;const dock=this.#dock(portId,dockId);if(!dock)return false;const key=this.#key(dock,spec);if(this.endRequired.has(key))return this.endRequired.get(key);
  const slots=this.slots.get(dock.id)??dockingSlots(this.world,dock);this.slots.set(dock.id,slots);
  const diameter=Math.hypot(spec.length,spec.beam)+.4,clearance={...spec,length:diameter,beam:diameter,draft:.001},exit=dockExit(dock);
  const risky=slots.length!==2||slots.some(p=>Array.from({length:32},(_,i)=>!safePose(this.world,{...p,heading:i*Math.PI/16},clearance)).some(Boolean)||hullDepth(this.world,p.x,p.y,p.heading,spec)<spec.draft||!this.navigator.clearSegment(exit,p,clearance));
  this.endRequired.set(key,risky);return risky;
 }
 redirectToEnd(id){this.#invalidate();
  const r=this.reservations.get(id);if(!r)return null;const dock=this.#dock(r.portId,r.dockId);if(dock.tiles){this.endRequired.set(this.#key(dock,r.spec),true);this.offers.delete(this.#key(dock,r.spec));r.preferredDockId=dock.id;r.slot=null;r.slots=[];r.occupiedCells=[];r.berth=null;r.exit=null;r.dockId=null;r.endMooring=null;r.waiting=true;r.status='QUEUED';this.#promote(r.portId);this.update();return this.get(id);}const end=this.mooring(r.portId,r.spec,dock.id);if(!end)return null;
  this.endRequired.set(this.#key(dock,r.spec),true);this.offers.delete(this.#key(dock,r.spec));r.endMooring=end;r.berthsRequired=dockRegistry.get(dock.dockTypeId).max_simultaneous_ships;r.waiting=true;r.preferredDockId=dock.id;
  if(r.slots.length!==r.berthsRequired){r.slot=null;r.slots=[];r.dockId=null;r.status='QUEUED';this.#promote(r.portId);}
  r.anchor={...end.exit,heading:end.berth.heading};this.#invalidate();this.update();return this.get(id);
 }
 mooring(portId,spec,dockId=null){const dock=this.#dock(portId,dockId);if(!dock)return null;if(dock.tiles){const point=hexDockingSlots(this.world,dock,spec,{exclusive:true}).find(p=>p.safe);return point?{berth:point,exit:point.exit}:null;}const key=this.#key(dock,spec);if(!this.endMoorings.has(key))this.endMoorings.set(key,pierEndMooring(this.world,dock,spec));return this.endMoorings.get(key);}
 exit(id){const r=this.reservations.get(id),dock=r&&this.#dock(r.portId,r.dockId);return dock?(r.exit??r.endMooring?.exit??dockExit(dock)):null;}
 #anchor(port,spec,offer){
  const reference=offer?.dock??this.manager(port.id)?.docks[0]??port,{dock,out}=dockChannel(reference),cell=worldToAxial(dock.x,dock.y),base=offer?.modern?offer.slots.find(p=>p.safe)?.exit:offer?.endMooring?.exit??dockExit(reference),diameter=Math.hypot(spec.length,spec.beam)+.6,anchorSpec=offer?.endMooring||offer?.exclusive?{...spec,length:diameter,beam:diameter}:spec,width=1.25+Math.max(SHIP_TYPES.man_of_war.beam,spec.beam)*.5,shore=coastDistances(this.world),profile=settlementRegistry.get((port.source??port).settlementType??'port').dock_growth;
  // Prefer the 2–3-hex coastal band; extend offshore only when it cannot accommodate the fleet.
  for(let pass=0;pass<2;pass++)for(let ring=2;ring<=24;ring++)for(let dq=-ring;dq<=ring;dq++)for(let dr=Math.max(-ring,-dq-ring);dr<=Math.min(ring,-dq+ring);dr++){
   if(Math.max(Math.abs(dq),Math.abs(dr),Math.abs(dq+dr))!==ring)continue;
   const c={q:cell.q+dq,r:cell.r+dr},index=tileIndex(this.world,c);if(index<0)continue;const coastal=shore[index];if(coastal>=0&&(coastal<profile.min_anchor_coast_distance||pass===0&&coastal>profile.preferred_anchor_coast_distance))continue;
   const p=axialToWorld(c.q,c.r);p.heading=headingTo(p,dock);
   if(this.manager(port.id).docks.some(d=>{const channel=dockChannel(d),dx=p.x-channel.dock.x,dy=p.y-channel.dock.y;return dx*channel.out.x+dy*channel.out.y>=0&&Math.abs(dx*channel.out.y-dy*channel.out.x)<width;}))continue;
   this.#indexes();if(this.occupiedCells.has(index))continue;
   if(hullDepth(this.world,p.x,p.y,p.heading,spec)<spec.draft)continue;
   // Every anchored hull needs room to finish its turn, including at map borders.
   if(Array.from({length:16},(_,i)=>!safePose(this.world,{...p,heading:i*Math.PI/8},anchorSpec)).some(Boolean))continue;
   if([...this.reservations.values()].some(r=>r.anchor&&distance(r.anchor,p)<Math.max(Math.sqrt(3),(r.spec.length+spec.length)*.5+.25)))continue;
   if(offer&&!this.navigator.clearSegment(base,p,{...anchorSpec,draft:.001}))continue;return p;
  }return null;
 }
 available(id){const r=this.reservations.get(id);if(!r)return false;this.#indexes();const own=['APPROACHING','DEPARTING'].includes(r.status)?1:0;return (this.busyDocks.get(r.portId+'|'+r.dockId)??0)<=own;}
 // Simulation/command boundary only. Reservation insertion order is the stable arbitration order.
 update(){for(const r of this.reservations.values()){if(r.status==='RESERVED'&&this.available(r.id)){r.status='APPROACHING';this.#invalidate();this.#recordWait(r);}if(r.status==='WAITING_DEPARTURE'&&this.available(r.id)){r.status='DEPARTING';this.#invalidate();}}}
 get(id){this.#indexes();const r=this.reservations.get(id);if(!r)return null;
  const dock=r.dockId?this.#dock(r.portId,r.dockId):null;
  return structuredClone({portId:r.portId,dockId:r.dockId,dockTypeId:dock?.dockTypeId??null,dockPosition:dock?.dockPosition??null,slot:r.slot,slots:[...(r.slots??[])],dockingCell:r.berth?.cell??null,occupiedCells:[...(r.occupiedCells??[])],exclusive:!!r.exclusive,berthMode:r.endMooring?'PIER_END':'ALONGSIDE',exit:this.exit(id),status:r.status,anchor:r.anchor,berth:r.slot===null||r.status==='RESERVED'?null:r.berth??r.endMooring?.berth??this.slots.get(r.dockId)[r.slot],queuePosition:r.slot===null&&r.waiting?this.queuePositions.get(r.id)??0:0});
 }
 #recordWait(r){if(r.queuedAt===undefined||r.waitRecorded)return;const samples=this.waitSamples.get(r.portId)??[];samples.push({tick:this.tickNumber,wait:this.tickNumber-r.queuedAt});if(samples.length>32)samples.shift();this.waitSamples.set(r.portId,samples);r.waitRecorded=true;}
 mark(id,status){this.#invalidate();const r=this.reservations.get(id);if(!r)return;if(status==='MOORED')this.#recordWait(r);if(status==='ANCHORED'&&r.slot!==null){const neighboringCells=r.occupiedCells?.length;r.slot=null;r.slots=[];r.occupiedCells=[];r.berth=null;r.exit=null;r.dockId=null;r.endMooring=null;r.exclusive=false;this.#invalidate();this.#promote(r.portId);if(neighboringCells)this.#wakeAdjacentQueues(r.portId);}r.status=status==='DEPARTING'&&!this.available(id)?'WAITING_DEPARTURE':status;this.#invalidate();this.update();}
 #berthConflict(next,point,dockId){return [...this.reservations.values()].some(r=>{if(r.id===next.id||r.slot===null||r.dockId===dockId)return false;const berth=r.berth??r.endMooring?.berth??this.slots.get(r.dockId)?.[r.slot];return berth&&distance(point,berth)<(next.spec.length+r.spec.length)*.5+.25;});}
 #promote(portId){this.#indexes();
  const used=new Map();for(const r of this.byPort.get(portId)??[])if(r.slot!==null){const slots=used.get(r.dockId)??new Set();for(const slot of r.slots)slots.add(slot);used.set(r.dockId,slots);}
  const queue=[...(this.queues.get(portId)??[])],blocked=new Set();
  for(const next of queue)for(const dock of this.compatible(portId,next.spec)){
   if(blocked.has(dock.id)||next.preferredDockId&&next.preferredDockId!==dock.id)continue;const offer=this.offer(portId,dock,next.spec);if(!offer)continue;if(offer.modern){if(this.#claimHexBerth(next,offer)){break;}blocked.add(dock.id);continue;}const occupied=used.get(dock.id)??new Set(),free=offer.slots.slice(0,2).map((_,i)=>i).filter(i=>!occupied.has(i)&&!this.#berthConflict(next,offer.endMooring?.berth??offer.slots[i],dock.id));
   if(free.length<offer.needed){blocked.add(dock.id);continue;}next.slots=free.slice(0,offer.needed);next.slot=next.slots[0];next.dockId=dock.id;next.endMooring=offer.endMooring;next.berthsRequired=offer.needed;next.status='RESERVED';this.#invalidate();for(const slot of next.slots)occupied.add(slot);used.set(dock.id,occupied);break;
  }
 }
 #claimHexBerth(next,offer){this.#indexes();
  const others=[...this.reservations.values()].filter(r=>r.id!==next.id),atDock=(this.byDock.get(offer.dock.id)??[]).filter(r=>r.id!==next.id&&r.slot!==null);
  if(atDock.length>=offer.capacity||offer.exclusive&&atDock.length||atDock.some(r=>r.exclusive))return false;
  const {out}=dockChannel(offer.dock),ordered=offer.slots.map((point,index)=>({point,index})).filter(p=>p.point.safe).sort((a,b)=>(b.point.x*out.x+b.point.y*out.y)-(a.point.x*out.x+a.point.y*out.y)||a.index-b.index);
  for(const {point,index} of ordered){
   const cells=offer.exclusive?[point.cell,...hexNeighbors(point.cell).filter(c=>waterDepthAt(this.world,c)>0),...offer.dock.dockingCells]:[point.cell],occupied=[...new Set(cells.map(c=>tileIndex(this.world,c)))];
   if(occupied.some(c=>[...(this.occupiedCells.get(c)??[])].some(id=>id!==next.id)))continue;
   if(occupied.some(c=>[...(this.anchorCells.get(c)??[])].some(id=>id!==next.id)))continue;
   if(others.some(r=>r.slot!==null&&(r.berth??r.endMooring?.berth)&&berthHullsOverlap(point,next.spec,r.berth??r.endMooring.berth,r.spec)))continue;
   next.slot=index;next.slots=offer.exclusive?offer.slots.map((_,i)=>i):[index];next.dockId=offer.dock.id;next.berth=point;next.exit=point.exit;next.exclusive=offer.exclusive;next.occupiedCells=occupied;next.endMooring=offer.exclusive?{berth:point,exit:point.exit}:null;next.berthsRequired=offer.needed;next.status='RESERVED';this.#invalidate();return true;
  }return false;
 }
 #wakeAdjacentQueues(exclude){for(const portId of new Set([...this.reservations.values()].filter(r=>r.slot===null&&r.waiting).map(r=>r.portId)))if(portId!==exclude)this.#promote(portId);}
 addDock(portId,dock){const manager=this.manager(portId);if(!manager)return null;manager.add(dock);this.docksById.set(dock.id,dock);this.infrastructureChanges.set(portId,{id:portId,docks:structuredClone(manager.docks),townTiles:[...(manager.port.townTiles??[])],buildings:structuredClone(manager.port.buildings??[]),roadTiles:structuredClone(manager.port.roadTiles??[]),population:manager.port.population,capacity:manager.port.capacity,infrastructureRevision:manager.port.infrastructureRevision});this.#promote(portId);this.update();return dock;}
 drainInfrastructureChanges(){const changes=[...this.infrastructureChanges.values()];this.infrastructureChanges.clear();return changes;}
 advanceTick(tick){this.tickNumber=tick;this.update();}
 queueStats(portId,window=180){this.#indexes();const waiting=(this.byPort.get(portId)??[]).filter(r=>r.waiting&&!r.waitRecorded),queued=waiting.filter(r=>r.slot===null||r.status==='RESERVED'),samples=(this.waitSamples.get(portId)??[]).filter(s=>this.tickNumber-s.tick<=window);const waits=[...queued.map(r=>this.tickNumber-r.queuedAt),...samples.map(s=>s.wait)];return {queueLength:queued.length,averageWaitTicks:waits.length?waits.reduce((a,b)=>a+b,0)/waits.length:0,oldestWaitTicks:queued.length?Math.max(...queued.map(r=>this.tickNumber-r.queuedAt)):0,dockCount:this.manager(portId)?.docks.length??0};}
 release(id){const r=this.reservations.get(id);if(!r)return;this.reservations.delete(id);this.#invalidate();if(r.slot!==null||r.waiting){this.#promote(r.portId);if(r.occupiedCells?.length)this.#wakeAdjacentQueues(r.portId);}this.update();}
}
