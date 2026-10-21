import {dockRegistry} from './simulation-registry.js?v=babbc3d3950e';
import {factionImage} from './faction-icons.js?v=babbc3d3950e';
import {SHIP_TYPES} from './fleet.js?v=babbc3d3950e';
export function shipHitTest(ship,pointer,camera,scale,width,height){
 const x=(ship.x-camera.x)*scale+width/2,y=(ship.y-camera.y)*scale+height/2;
 const dx=pointer.x-x,dy=pointer.y-y,c=Math.cos(ship.heading),s=Math.sin(ship.heading);
 const across=dx*c+dy*s,along=-dx*s+dy*c,spec=SHIP_TYPES[ship.type];
 return Math.abs(across)<=Math.max(7,spec.beam*scale*.7)&&Math.abs(along)<=Math.max(10,spec.length*scale*.55);
}
export function shipTooltipLines(ship){
 const cargo=ship.cargoItems?.filter(i=>i.quantity>0).map(i=>`${i.commodity_id.toLowerCase().replaceAll('_',' ')}: ${Number(i.quantity.toFixed(1))}`).join(', ')||'None';
 const lines=[SHIP_TYPES[ship.type].name+(ship.player?' · Your ship':` · ${ship.id}`),
  `Unsold cargo: ${cargo}`,`Registration: ${ship.registrationPortName??'Unregistered'}`,
  `Origin: ${ship.originPortName??'No voyage yet'}`,`Destination: ${ship.targetName??(ship.player?'Player-controlled':'At port / awaiting orders')}`];
 if(Number.isFinite(ship.paidDeliveryCargo))lines.push(`Paid deliveries aboard: ${ship.paidDeliveryCargo.toFixed(2)} units`,`Paid pickups ashore: ${ship.paidPickupCargo.toFixed(2)} units`,`Occupied or committed hold: ${ship.occupiedCargo.toFixed(2)} / ${ship.cargoCapacity.toFixed(2)} units`);
 if(ship.shipName)lines.splice(1,0,'Name: '+ship.shipName);if(ship.captainName)lines.splice(ship.shipName?2:1,0,'Captain: '+ship.captainName);
 if(ship.jobPurpose&&!ship.military)lines.push('Mission: '+ship.jobPurpose);if(ship.military)lines.push('Military patrol · Home: '+(ship.registrationPortName??'Unassigned'));if(ship.state)lines.push('Status: '+ship.state.toLowerCase().replaceAll('_',' '));if(ship.queuePosition)lines.push('Anchorage queue: '+ship.queuePosition);else if(ship.berthSlot!==undefined&&ship.berthSlot!==null)lines.push('Dock berth: '+(ship.berthSlot+1));if(ship.dockTypeId&&dockRegistry.has(ship.dockTypeId))lines.push('Dock: '+dockRegistry.get(ship.dockTypeId).display_name);if(ship.givingWay)lines.push('Giving way');return lines;
}
export function writeShipTooltip(panel,ship,pointer,width,height){
 const lines=shipTooltipLines(ship);panel.className='ship-tooltip';panel.style.pointerEvents='none';panel.onclick=null;panel.onkeydown=null;panel.onpointerleave=null;panel.removeAttribute?.('role');panel.removeAttribute?.('aria-label');panel.removeAttribute?.('tabindex');panel.replaceChildren();const heading=document.createElement('strong');heading.textContent=lines[0];if(ship.faction)heading.prepend(factionImage(ship.faction));panel.append(heading);
 for(const line of lines.slice(1))panel.append(document.createElement('br'),document.createTextNode(line));
 panel.hidden=false;panel.style.left=Math.max(8,Math.min(width-panel.offsetWidth-8,pointer.x+16))+'px';panel.style.top=Math.max(8,Math.min(height-panel.offsetHeight-8,pointer.y+16))+'px';
}
