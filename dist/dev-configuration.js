import {formatMoney} from './money.js?v=babbc3d3950e';
import {settingsForWorld} from './compiled-configuration.js?v=babbc3d3950e';
import {configurationRegistry,createConfigurationSession,developerSelectedValues,loadDeveloperSelections,persistDeveloperSelections,ConfigurationValidationError} from './configuration-registry.js?v=babbc3d3950e';
import {configurationDescription} from './configuration-description.js?v=babbc3d3950e';
// All current definitions now have compiled consumer bindings. This is the
// existing developer setup panel; edits still require a fresh world.
export const DEV_CONNECTED_SETTINGS=Object.freeze(configurationRegistry.definitions().map(d=>d.id));
export function validateDevSelections(overrides){
 const result=configurationRegistry.validateSelections(overrides);
 if(!result.ok)throw new ConfigurationValidationError(result.diagnostics);
 return result.selected;
}
export function compileDevSimulation(world){
 const settings=settingsForWorld(world);
 return Object.freeze({revision:settings.revision,wallet:settings.merchant.startingWallet,minProfit:settings.merchant.minimumProfit,distanceCost:settings.merchant.distanceCost,cargoHandlingRate:settings.merchant.cargoHandlingRate,windPersistence:settings.navigation.windPersistence,threatThreshold:settings.navigation.threatThreshold,threat:settings.threat});
}
function configurationCategoryLabel(category){
 return String(category||'uncategorized').replace(/[._-]+/g,' ').replace(/\b\w/g,letter=>letter.toUpperCase());
}
export class DevConfigurationPanel{
 constructor({onApply=()=>{}}={}){
  this.selected=validateDevSelections(loadDeveloperSelections(developerSelectedValues));this.revision=0;this.onApply=onApply;this.inputs=new Map();this.entries=[];this.categoryGroups=new Map();
  const $=id=>document.getElementById(id);this.dialog=$('dev-options');this.fields=$('dev-config-fields');this.error=$('dev-config-error');
  this.search=$('dev-config-search');this.empty=$('dev-config-empty');
  const definitions=configurationRegistry.definitions(),active=document.createElement('div');active.className='dev-config-groups';this.fields.append(active);
  const inactiveDefinitions=definitions.filter(d=>!DEV_CONNECTED_SETTINGS.includes(d.id));
  let inactive=null,inactiveBody=null;
  if(inactiveDefinitions.length){inactive=document.createElement('details');inactive.className='dev-config-unconnected';const summary=document.createElement('summary');summary.textContent='Remaining registry settings (read-only)';inactiveBody=document.createElement('div');inactiveBody.className='dev-config-groups';inactive.append(summary,inactiveBody);this.fields.append(inactive);}
  const ensureCategory=(category,connected)=>{
   const key=(connected?'active:':'inactive:')+(category||'uncategorized');let group=this.categoryGroups.get(key);if(group)return group;
   const details=document.createElement('details');details.className='dev-config-category';details.open=true;const summary=document.createElement('summary');summary.className='dev-config-category-summary';const heading=document.createElement('span');heading.className='dev-config-category-title';heading.textContent=configurationCategoryLabel(category);const count=document.createElement('span');count.className='dev-config-category-count';summary.append(heading,count);const body=document.createElement('div');body.className='dev-config-category-body';details.append(summary,body);(connected?active:inactiveBody).append(details);group={category:category||'uncategorized',connected,details,body,count,entries:[]};this.categoryGroups.set(key,group);return group;
  };
  for(const d of definitions){
   const connected=DEV_CONNECTED_SETTINGS.includes(d.id),label=document.createElement('label'),title=document.createElement('span'),input=document.createElement(d.type==='enum'?'select':'input'),meta=document.createElement('small');
   label.className='dev-config-field';title.textContent=d.label;input.id='config-'+d.id;if(d.type==='enum')for(const value of d.options)input.add(new Option(value,value));else{input.type=d.type==='boolean'?'checkbox':'number';if(d.type!=='boolean'){input.min=d.min;input.max=d.max;input.step=d.step;}}input.disabled=!connected;input.required=connected&&d.type!=='boolean';input.dataset.setting=d.id;
   meta.textContent=d.type==='boolean'?'Enabled/disabled · New world':d.type==='enum'?'Catalog choice · New world':`${d.unit||'value'} · ${d.unit?.includes('gold')?formatMoney(d.min):d.min} to ${d.unit?.includes('gold')?formatMoney(d.max):d.max} · ${d.apply_mode==='new_world'?'New world':d.scope==='world'?'New simulation':'Display'}`;const description=document.createElement('small');description.textContent=configurationDescription(d);label.append(title,input,meta,description);
   const group=ensureCategory(d.category,connected);group.body.append(label);this.inputs.set(d.id,input);const entry={row:label,group,searchText:`${d.category||''} ${d.id} ${d.label} ${description.textContent}`.toLocaleLowerCase()};group.entries.push(entry);this.entries.push(entry);
  }
  this.filter=()=>{const query=this.search.value.trim().toLocaleLowerCase();let visible=0,unconnectedVisible=0;for(const group of this.categoryGroups.values()){let groupVisible=0;for(const entry of group.entries){const match=!query||entry.searchText.includes(query);entry.row.hidden=!match;if(match)groupVisible++;}group.count.textContent=query?`${groupVisible}/${group.entries.length}`:`${group.entries.length}`;group.details.hidden=groupVisible===0;if(query)group.details.open=groupVisible>0;visible+=groupVisible;if(!group.connected)unconnectedVisible+=groupVisible;}if(inactive){inactive.hidden=unconnectedVisible===0;if(query)inactive.open=unconnectedVisible>0;}this.empty.hidden=visible!==0;};this.search.oninput=()=>this.filter();
  $('dev-options-button').onclick=()=>this.open();$('dev-options-cancel').onclick=()=>this.dialog.close();
  $('dev-options-reset').onclick=()=>this.fill(Object.fromEntries(configurationRegistry.definitions().map(d=>[d.id,d.default])));
  $('dev-options-form').onsubmit=e=>{e.preventDefault();try{const edits={...this.selected};for(const id of DEV_CONNECTED_SETTINGS){const type=configurationRegistry.get(id).type;if(type==='boolean'){edits[id]=this.inputs.get(id).checked;continue;}if(!this.inputs.get(id).value.trim())throw TypeError('Enter a value for '+id);edits[id]=type==='enum'?this.inputs.get(id).value:this.renderedValues?.get(id)?.display===this.inputs.get(id).value?this.renderedValues.get(id).value:Number(this.inputs.get(id).value);}const selected=validateDevSelections(edits);const worldChanged=configurationRegistry.definitions('world').some(d=>(this.selected[d.id]??d.default)!==(selected[d.id]??d.default));this.selected=selected;if(worldChanged)this.revision++;persistDeveloperSelections(selected);this.onApply(createConfigurationSession(selected,{revision:this.revision}),configurationRegistry.validateSelections(selected).warnings);this.dialog.close();}catch(error){this.error.textContent=error.message;}};
 }
 fill(selected=this.selected){this.error.textContent='';this.renderedValues=new Map();for(const d of configurationRegistry.definitions()){const value=Object.hasOwn(selected,d.id)?selected[d.id]:d.default,display=d.unit?.includes('gold')?formatMoney(value):String(value);this.inputs.get(d.id).value=display;if(d.type==='boolean')this.inputs.get(d.id).checked=value;this.renderedValues.set(d.id,{value,display});}}
  open(){this.search.value='';this.filter();this.fill();this.dialog.showModal();}
}
