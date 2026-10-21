const islandLabel=port=>port?.islandName??port?.colonyName??(Number.isFinite(port?.islandTiles)?`${port.islandTiles}-tile island`:null);

export function portTooltipLines(info){
 const port=info?.port??{};
 const lines=[];
 if(port.factionName||info?.kind)lines.push([port.factionName,info?.kind].filter(Boolean).join(' · '));
 const island=islandLabel(port);if(island)lines.push(island);
 if(Number.isFinite(port.population))lines.push(`Population ${port.population.toLocaleString()}${Number.isFinite(port.capacity)?` / ${port.capacity.toLocaleString()}`:''}`);
 const docks=port.docks?.length??(port.dockPosition?1:0);if(docks)lines.push(`${docks} dock${docks===1?'':'s'}`);
 return lines;
}

export function writePortTooltip(panel,info,pointer,width,height,onOpen=()=>{}){
 const port=info?.port??{},lines=portTooltipLines(info);panel.replaceChildren();panel.className='port-tooltip';panel.setAttribute('role','button');panel.setAttribute('tabindex','0');panel.setAttribute('aria-label',`Open ledger for ${port.name??'port'}`);panel.title='Open port ledger';panel.style.pointerEvents='auto';
 const heading=document.createElement('strong');heading.textContent=port.name??'Port';panel.append(heading);
 for(const line of lines)panel.append(document.createElement('br'),document.createTextNode(line));
 panel.append(document.createElement('br'),document.createTextNode('Click to open ledger'));
 const open=()=>onOpen(port);panel.onclick=open;panel.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}};panel.onpointerleave=e=>{if(e.relatedTarget!==document.getElementById('map')&&!document.getElementById('map')?.contains(e.relatedTarget)){panel.hidden=true;}}
 panel.hidden=false;panel.style.left=Math.max(8,Math.min(width-panel.offsetWidth-8,pointer.x+16))+'px';panel.style.top=Math.max(8,Math.min(height-panel.offsetHeight-8,pointer.y+16))+'px';
}
