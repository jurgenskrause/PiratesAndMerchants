import {compatibleDock} from './port-infrastructure.js?v=babbc3d3950e';
import {cellDistance,guidedPath,dockEndSlide} from './docking.js?v=babbc3d3950e';
import {DockTraffic,dockExit,dockChannel,pierEndMooring} from './dock-traffic.js?v=babbc3d3950e';
import {safeGuidedStep} from './guided-safety.js?v=babbc3d3950e';
import {NavigationSafety,safePose} from './navigation-safety.js?v=babbc3d3950e';
import {headingTo} from './navigation.js?v=babbc3d3950e';
export class PlayerDocking {
 constructor({parent,getWorld,requestDock,releaseDock,markDock}){
  Object.assign(this,{getWorld,requestDock,releaseDock,markDock});this.ship=null;this.motion=null;this.port=null;this.docked=false;this.declined=new Set();this.mode=null;this.token=0;this.reservation=null;this.safety=new NavigationSafety();
  this.panel=document.createElement('section');this.panel.hidden=true;this.panel.setAttribute('role','dialog');this.panel.setAttribute('aria-label','Docking');
  this.text=document.createElement('p');this.accept=document.createElement('button');this.accept.textContent='Dock';this.decline=document.createElement('button');this.decline.textContent='Not now';this.undock=document.createElement('button');this.undock.textContent='Undock';
  this.panel.append(this.text,this.accept,this.decline,this.undock);parent.append(this.panel);
  this.accept.onclick=()=>{
   if(!this.ship||!this.port||this.accept.disabled)return;const token=++this.token;this.mode='REQUESTING';this.ship.docking=true;this.accept.hidden=true;this.decline.textContent='Cancel docking';this.text.textContent='Requesting a docking slot…';
   const receive=r=>{if(token!==this.token)return;if(!r?.portId){this.cancel();return;}this.reservation=r;if(this.mode==='RECOVERING_DOCK'&&r.berth){this.motion=dockEndSlide(this.ship,r.berth);this.mode='DOCKING';this.text.textContent='Sliding to the end of the pier…';}else if(this.mode==='WAITING_DEPARTURE'&&r.status==='DEPARTING')this.depart();else if(this.mode==='REQUESTING'||this.mode==='AT_ANCHOR')this.approach(r);};
   if(this.requestDock)this.requestDock(this.port.id,this.ship,receive);
   else{this.localTraffic??=new DockTraffic(this.getWorld(),this.getWorld().ports);receive(this.localTraffic.request('player',this.port.id,this.ship.spec));}
  };
  this.decline.onclick=()=>{this.declined.add(this.port.id);this.cancel();};
  this.undock.onclick=()=>{this.mode='WAITING_DEPARTURE';this.undock.hidden=true;this.text.textContent='Waiting for the dock approach to clear…';if(this.markDock)this.markDock('DEPARTING');else{this.localTraffic.mark('player','DEPARTING');if(this.localTraffic.get('player').status==='DEPARTING')this.depart();}};
 }
 depart(){
  const target={...(this.reservation?.exit??this.localTraffic?.exit('player')??dockExit(this.port))};target.heading=headingTo(this.reservation?.dockPosition??dockChannel(this.port).dock,target);
  this.motion=guidedPath(this.getWorld(),this.ship,target,{turnDuringTravel:true,turnClearance:this.reservation?.berthMode==='PIER_END'});if(!this.motion){this.mode='MOORED';this.markDock?.('MOORED');this.localTraffic?.mark('player','MOORED');this.undock.hidden=false;this.text.textContent='No clear departure. Try again shortly.';return;}
  this.mode='UNDOCKING';this.docked=false;this.ship.docked=false;this.ship.docking=true;this.text.textContent='Undocking from '+this.port.name+'…';
 }
 release(){this.releaseDock?.();this.localTraffic?.release('player');}
 cancel(){this.token++;this.release();if(this.ship){this.ship.docked=false;this.ship.docking=false;this.ship.anchored=false;}this.motion=null;this.mode=null;this.docked=false;this.port=null;this.reservation=null;this.panel.hidden=true;}
 reset(){this.cancel();this.ship=null;this.declined.clear();this.localTraffic=null;}
 approach(r){
  if(this.mode==='AT_ANCHOR'&&!r.berth){this.text.textContent=`At anchor at ${this.port.name}. Waiting for a berth${r.queuePosition?' ('+r.queuePosition+' in queue)':''}.`;return;}
  const target=r.berth??r.anchor;this.motion=target?guidedPath(this.getWorld(),this.ship,target,{turnClearance:r.berthMode==='PIER_END'}):null;
  if(!this.motion&&r.berth&&!safePose(this.getWorld(),this.ship,this.ship.spec)&&this.redirectDock())return;
  if(!this.motion){this.release();this.mode=null;this.ship.docking=false;this.accept.hidden=this.decline.hidden=false;this.decline.textContent='Not now';this.text.textContent='No clear docking approach. Sail farther from shore and try again.';return;}
  this.mode=r.berth?'DOCKING':'ANCHORING';this.ship.anchored=false;this.ship.docking=true;this.text.textContent=this.mode==='DOCKING'?`Docking at ${this.port.name} (${r.berthMode==='PIER_END'?'pier end, exclusive berth':'berth '+(r.slot+1)})…`:`Dock busy. Moving to anchor${r.queuePosition?' ('+r.queuePosition+' in queue)':''}…`;
 }
 redirectDock(){
  const end=pierEndMooring(this.getWorld(),this.port.docks?.find(d=>d.id===this.reservation?.dockId)??this.port,this.ship.spec);if(!end)return false;
  let r=null;if(this.localTraffic){r=this.localTraffic.redirectToEnd('player');if(!r)return false;this.reservation=r;}
  this.motion=dockEndSlide(this.ship,r?.berth??r?.anchor??{...end.exit,heading:end.berth.heading});this.mode=r?(r.berth?'DOCKING':'ANCHORING'):'RECOVERING_DOCK';this.ship.docked=false;this.docked=false;this.ship.docking=true;this.ship.anchored=false;this.text.textContent='Sliding to the end of the pier…';
  if(this.markDock)this.markDock('PIER_END');return true;
 }
 step(ship,dt){
  if(this.ship!==ship){this.reset();this.ship=ship;}
  if(this.motion){ship.status=this.text.textContent;if(safeGuidedStep(ship,this.motion,dt,this.getWorld(),this.safety,this.mode,()=>this.redirectDock())){
   this.motion=null;ship.docking=false;
   if(this.mode==='UNDOCKING'){this.declined.add(this.port.id);this.cancel();ship.status='Undocked: set sail';}
   else if(this.mode==='ANCHORING'||this.mode==='RECOVERING_DOCK'){this.mode='AT_ANCHOR';ship.anchored=true;if(this.reservation)this.approach(this.reservation);}
   else{this.docked=true;this.mode='MOORED';ship.docked=true;this.markDock?.('MOORED');this.localTraffic?.mark('player','MOORED');this.text.textContent='Docked at '+this.port.name;this.undock.hidden=false;this.decline.hidden=true;}
  }return true;}
  if(this.docked||this.mode==='AT_ANCHOR'||this.mode==='REQUESTING'){ship.canvas=0;ship.vx=ship.vy=ship.speed=ship.yaw=0;ship.status=this.text.textContent;return true;}
  const ports=this.getWorld().ports??[];for(const p of ports)if((p.docks??[p]).every(d=>cellDistance(ship,d.dockPosition)>4))this.declined.delete(p.id);
  const port=ports.find(p=>!this.declined.has(p.id)&&(p.docks??[p]).some(d=>cellDistance(ship,d.dockPosition)<=2));
  if(!port){this.port=null;this.panel.hidden=true;return false;}
  this.port=port;this.panel.hidden=false;this.accept.hidden=this.decline.hidden=false;this.decline.textContent='Not now';this.undock.hidden=true;const compatible=!port.docks||port.docks.some(d=>compatibleDock(d,ship.spec));this.accept.disabled=!compatible;this.text.textContent=compatible?'Do you want to dock at '+port.name+'?':'No compatible berth at '+port.name+'. Required: '+ship.required_berth_size;return false;
 }
}
