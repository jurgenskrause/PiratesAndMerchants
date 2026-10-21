import {manufacturingDefinitions} from './simulation-registry.js?v=babbc3d3950e';
import {formatMoney} from './money.js?v=babbc3d3950e';
const node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
export class DevIndustryConstructionPanel {
 constructor({parent,getWorld,getTraffic}){
  const details=node('details'),heading=node('summary','Factory construction'),body=node('div'),port=node('select'),type=node('select'),terms=node('p'),status=node('p'),build=node('button','Start material-funded construction'),refresh=node('button','Inspect projects'),projects=node('ul');
  details.append(heading,body);body.append(node('p','Factories use owned market materials and reserve working capital. Factories use the shared funded procurement and timed production lifecycle.'),port,type,terms,build,refresh,status,projects);parent.append(details);port.setAttribute('aria-label','Construction parent port');type.setAttribute('aria-label','Factory type');status.setAttribute('role','status');
  for(const d of manufacturingDefinitions)type.add(new Option(d.name,d.typeId));
  const updateTerms=()=>{const d=manufacturingDefinitions.find(d=>d.typeId===type.value);if(d)terms.textContent=Object.entries(d.construction.materials).map(([c,q])=>q+' '+c).join(' + ')+' · '+d.construction.durationSeconds+' simulated seconds · '+formatMoney(d.construction.workingCapitalUnits/1e6)+' gold working capital';};
  const updatePorts=()=>{const selected=port.value;port.replaceChildren();for(const p of getWorld()?.ports??[])port.add(new Option(p.name,p.id));if([...port.options].some(o=>o.value===selected))port.value=selected;updateTerms();};
  details.ontoggle=()=>{if(details.open)updatePorts();};type.onchange=updateTerms;
  const inspect=()=>getTraffic()?.requestIndustryConstruction('inspect',{},r=>{if(r.error){status.textContent=r.error;return;}projects.replaceChildren(...r.result.map(p=>node('li',`${p.typeId} · ${getWorld()?.ports.find(x=>x.id===p.portId)?.name??p.portId} · ${p.state} · ${Math.min(p.durationSeconds,p.elapsedSeconds).toFixed(1)} / ${p.durationSeconds}s${p.error?' · '+p.error:''} · ${p.instanceId}`)));});
  refresh.onclick=inspect;build.onclick=()=>{build.disabled=true;getTraffic()?.requestIndustryConstruction('build',{portId:port.value,typeId:type.value},r=>{build.disabled=false;status.textContent=r.error??'Construction started. Materials and capital are reserved.';if(!r.error)inspect();});};
 }
}
