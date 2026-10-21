import {renderingConfigurationValidator} from './rendering-configuration-validator.js?v=babbc3d3950e';
import {compileConstraint} from './configuration-constraints.js?v=babbc3d3950e';
import {economyConfigurationValidator} from './economy-configuration-validator.js?v=babbc3d3950e';
import {logisticsConfigurationValidator} from './logistics-configuration-validator.js?v=babbc3d3950e';
import {navigationConfigurationValidator} from './navigation-configuration-validator.js?v=babbc3d3950e';
import {loadCatalogs,validateSchema} from './catalog-loader.js?v=babbc3d3950e';
export const CONFIGURATION_FORMAT_VERSION=1;
const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
const record=(value,label)=>{if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw TypeError(label+': expected plain object');};
const fail=(id,message)=>{throw TypeError(`${id}: ${message}`);};
function checkValue(d,value){
 if(d.type==='boolean'){if(typeof value!=='boolean')fail(d.id,'expected boolean');}
 else if(d.type==='enum'){if(!d.options.includes(value))fail(d.id,'not an allowed choice');}
 else{
  if(typeof value!=='number'||!Number.isFinite(value)||Object.is(value,-0)||(d.type==='integer'&&!Number.isSafeInteger(value)))fail(d.id,'expected finite '+d.type);
  if(value<d.min||value>d.max)fail(d.id,`outside [${d.min}, ${d.max}]`);
  const steps=(value-d.min)/d.step,tolerance=Math.min(1e-6,Number.EPSILON*32*Math.max(1,Math.abs(steps)));
  if(Math.abs(steps-Math.round(steps))>tolerance)fail(d.id,'not aligned to step from min');
 }
}
const canonical=value=>JSON.stringify(sort(value));
function sort(value){if(Array.isArray(value))return value.map(sort);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,sort(value[key])]));return value;}
export class ConfigurationValidationError extends TypeError{
 constructor(diagnostics){super(diagnostics.filter(d=>d.severity==='error').map(d=>`${d.id}: ${d.message}`).join('\n'));this.name='ConfigurationValidationError';this.diagnostics=freeze(structuredClone(diagnostics));}
}
const diagnostic=(id,setting_ids,severity,message,source)=>freeze({id,setting_ids:[...setting_ids],severity,message,source});
export class ConfigurationRegistry{
 #definitions=new Map();
 #constraints=[];
 #validators=[];
 constructor(definitions,schema,{constraints=[],constraintSchema,validators=[]}={}){
  if(!Array.isArray(definitions)||!schema)throw TypeError('Definitions and schema required');
  for(const input of definitions){validateSchema(input,schema);const d=structuredClone(input);
   if(this.#definitions.has(d.id))fail(d.id,'duplicate definition');
   const numeric=['integer','number'].includes(d.type);
   if(numeric){for(const field of ['min','max','step'])if(!Number.isFinite(d[field]))fail(d.id,'numeric definition requires '+field);if(d.min>d.max||d.step<=0)fail(d.id,'invalid numeric bounds');if(d.type==='integer'&&![d.min,d.max,d.step].every(Number.isSafeInteger))fail(d.id,'integer bounds and step must be safe integers');if(d.options!==undefined)fail(d.id,'numeric definition cannot have options');}
   else{if(['min','max','step'].some(key=>d[key]!==undefined))fail(d.id,'non-numeric definition cannot have numeric bounds');if(d.type==='enum'){if(!Array.isArray(d.options)||!d.options.length||new Set(d.options).size!==d.options.length)fail(d.id,'enum needs unique options');}else if(d.options!==undefined)fail(d.id,'boolean definition cannot have options');}
   if(d.scope==='application'&&d.permission!=='local_user'&&d.permission!=='developer')fail(d.id,'invalid application permission');
   if(d.scope==='world'&&(d.permission==='local_user'||d.apply_mode==='next_frame'))fail(d.id,'world setting cannot use local/frame authority');
   checkValue(d,d.default);this.#definitions.set(d.id,freeze(d));
  }
  const ids=new Set();
  for(const c of constraints){if(ids.has(c.id))fail(c.id,'duplicate validation ID');ids.add(c.id);if(!constraintSchema)throw TypeError('Constraint schema required');const compiled=compileConstraint(c,this,constraintSchema,checkValue);freeze(compiled.definition);this.#constraints.push(compiled);}
  for(const v of validators){
   if(!v||typeof v.id!=='string'||!/^[-a-z0-9_]+\.[-a-z0-9_.]+$/.test(v.id)||ids.has(v.id)||!['application','world'].includes(v.scope)||typeof v.validate!=='function'||!Array.isArray(v.setting_ids)||!v.setting_ids.length||new Set(v.setting_ids).size!==v.setting_ids.length)throw TypeError('Invalid subsystem validator');
   for(const id of v.setting_ids)if(this.get(id).scope!==v.scope)fail(v.id,'validator scope mismatch');
   ids.add(v.id);this.#validators.push(Object.freeze({id:v.id,scope:v.scope,setting_ids:Object.freeze([...v.setting_ids]),validate:v.validate}));
  }
  for(const scope of ['application','world'])this.resolve({}, {scope});
  Object.freeze(this);
 }
 get(id){const d=this.#definitions.get(id);if(!d)fail(id,'unknown configuration key');return d;}
 definitions(scope=null){if(scope!==null&&!['application','world'].includes(scope))throw TypeError('Invalid scope');return Object.freeze([...this.#definitions.values()].filter(d=>scope===null||d.scope===scope));}
 selected(overrides={}){record(overrides,'Overrides');for(const [id,value] of Object.entries(overrides))checkValue(this.get(id),value);return freeze(structuredClone(overrides));}
 resolve(overrides={}, {scope='world',revision=0}={}){
  if(!['application','world'].includes(scope)||!Number.isSafeInteger(revision)||revision<0)throw TypeError('Invalid snapshot scope or revision');
  const selected=this.selected(overrides),values=Object.fromEntries(this.definitions(scope).map(d=>[d.id,Object.hasOwn(selected,d.id)?selected[d.id]:d.default]));
  const snapshot=freeze({format_version:CONFIGURATION_FORMAT_VERSION,revision,scope,values});
  const diagnostics=this.#evaluate(snapshot);if(diagnostics.some(d=>d.severity==='error'))throw new ConfigurationValidationError(diagnostics);return snapshot;
 }
 reconstruct(input){
  record(input,'Snapshot');if(Object.keys(input).sort().join(',')!=='format_version,revision,scope,values')throw TypeError('Invalid snapshot fields');
  if(input.format_version!==CONFIGURATION_FORMAT_VERSION)throw TypeError('Unsupported configuration format version');
  record(input.values,'Snapshot values');const snapshot=this.resolve(input.values,{scope:input.scope,revision:input.revision});
  const expected=Object.keys(snapshot.values).sort(),actual=Object.keys(input.values).sort();if(canonical(expected)!==canonical(actual))throw TypeError('Snapshot must contain every key in its scope and no other keys');
  return snapshot;
 }
 #evaluate(snapshot){
  const diagnostics=[];
  for(const c of this.#constraints)if(c.scope===snapshot.scope&&!c.evaluate(snapshot.values)){const d=c.definition;diagnostics.push(diagnostic(d.id,d.setting_ids,d.severity,d.message,'constraint'));}
  for(const v of this.#validators)if(v.scope===snapshot.scope){
   try{
    const input=freeze(Object.fromEntries(v.setting_ids.map(id=>[id,snapshot.values[id]]))),results=v.validate(input);
    if(!Array.isArray(results))throw TypeError('Validator must synchronously return an array');
    const output=[];
    for(const r of results){if(!r||!['error','warning'].includes(r.severity)||typeof r.message!=='string'||!r.message.trim()||r.setting_ids!==undefined&&(!Array.isArray(r.setting_ids)||!r.setting_ids.length||r.setting_ids.some(id=>!v.setting_ids.includes(id))))throw TypeError('Invalid validator diagnostic');output.push(diagnostic(v.id,r.setting_ids||v.setting_ids,r.severity,r.message,'validator'));}
    diagnostics.push(...output);
   }catch(error){diagnostics.push(diagnostic(v.id,v.setting_ids,'error','Validator failed: '+error.message,'validator'));}
  }
  return freeze(diagnostics);
 }
 #result(candidate,diagnostics){const errors=diagnostics.filter(d=>d.severity==='error'),warnings=diagnostics.filter(d=>d.severity==='warning');return freeze({ok:!errors.length,candidate:errors.length?null:candidate,diagnostics,errors,warnings});}
 validateSnapshot(input){
  try{const candidate=this.reconstruct(input);return this.#result(candidate,this.#evaluate(candidate));}
  catch(error){return this.#result(null,error.diagnostics||[diagnostic('configuration.snapshot',[],'error',error.message,'snapshot')]);}
 }
 validateBatch(active,edits,{revision=active.revision+1}={}){
  const base=this.reconstruct(active),diagnostics=[];
  try{record(edits,'Edits');}catch(error){return this.#result(null,[diagnostic('configuration.edits',[],'error',error.message,'setting')]);}
  for(const [id,value] of Object.entries(edits)){try{const d=this.get(id);if(d.scope!==base.scope)fail(id,'edit belongs to another scope');checkValue(d,value);}catch(error){diagnostics.push(diagnostic(id,[id],'error',error.message,'setting'));}}
  if(diagnostics.length)return this.#result(null,diagnostics);
  return this.validateSnapshot({...base,revision,values:{...base.values,...edits}});
 }
 validateSelections(overrides={}, {revision=0}={}){
  const diagnostics=[];let selected;
  try{selected=this.selected(overrides);}catch(error){return freeze({...this.#result(null,[diagnostic('configuration.selections',Object.keys(overrides||{}),'error',error.message,'setting')]),selected:null,session:null});}
  const session={};for(const scope of ['application','world']){try{session[scope]=this.resolve(selected,{scope,revision});diagnostics.push(...this.#evaluate(session[scope]));}catch(error){diagnostics.push(...(error.diagnostics||[diagnostic('configuration.snapshot',[],'error',error.message,'snapshot')]));}}
  const result=this.#result(session,diagnostics);return freeze({...result,selected:result.ok?selected:null,session:result.ok?session:null});
 }
 serialize(snapshot){return canonical(this.reconstruct(snapshot));}
 deserialize(text){if(typeof text!=='string')throw TypeError('Serialized configuration must be a string');return this.reconstruct(JSON.parse(text));}
}
const {catalog,schema}=await loadCatalogs();
export const configurationRegistry=new ConfigurationRegistry(catalog.configuration_definitions,schema.properties.configuration_definitions.items,{constraints:catalog.configuration_constraints,constraintSchema:schema.properties.configuration_constraints.items,validators:[economyConfigurationValidator,logisticsConfigurationValidator,navigationConfigurationValidator,renderingConfigurationValidator]});
const initialSelections=configurationRegistry.validateSelections(catalog.configuration_overrides);
if(!initialSelections.ok)throw new ConfigurationValidationError(initialSelections.diagnostics);
export const developerSelectedValues=initialSelections.selected;
/**
 * Developer setup selections are local preferences, not part of a generated
 * world's authoritative configuration snapshot. Keep the storage envelope
 * versioned so a changed registry can reject old or corrupt values safely.
 */
export const DEVELOPER_CONFIGURATION_STORAGE_KEY='pirates-and-merchants:developer-configuration:v1';
const DEVELOPER_CONFIGURATION_STORAGE_VERSION=1;
function developerConfigurationStorage(){
 try{
  const storage=globalThis.localStorage;
  return storage&&typeof storage.getItem==='function'&&typeof storage.setItem==='function'&&typeof storage.removeItem==='function'?storage:null;
 }catch{return null;}
}
export function loadDeveloperSelections(fallback=developerSelectedValues){
 const safeFallback=configurationRegistry.validateSelections(fallback);
 const fallbackValues=safeFallback.ok?safeFallback.selected:developerSelectedValues;
 const storage=developerConfigurationStorage();
 if(!storage)return fallbackValues;
 try{
  const raw=storage.getItem(DEVELOPER_CONFIGURATION_STORAGE_KEY);
  if(!raw)return fallbackValues;
  const envelope=JSON.parse(raw);
  if(!envelope||envelope.format_version!==DEVELOPER_CONFIGURATION_STORAGE_VERSION||!envelope.selected)return fallbackValues;
  const result=configurationRegistry.validateSelections(envelope.selected);
  return result.ok?result.selected:fallbackValues;
 }catch{return fallbackValues;}
}
export function persistDeveloperSelections(selections){
 const result=configurationRegistry.validateSelections(selections);
 if(!result.ok)throw new ConfigurationValidationError(result.diagnostics);
 const storage=developerConfigurationStorage();
 if(!storage)return false;
 try{
  storage.setItem(DEVELOPER_CONFIGURATION_STORAGE_KEY,JSON.stringify({format_version:DEVELOPER_CONFIGURATION_STORAGE_VERSION,selected:result.selected}));
  return true;
 }catch{return false;}
}
export function clearDeveloperSelections(){
 const storage=developerConfigurationStorage();
 if(!storage)return false;
 try{storage.removeItem(DEVELOPER_CONFIGURATION_STORAGE_KEY);return true;}catch{return false;}
}
export function createConfigurationSession(overrides=developerSelectedValues,{revision=0}={}){
 return freeze({application:configurationRegistry.resolve(overrides,{scope:'application',revision}),world:configurationRegistry.resolve(overrides,{scope:'world',revision})});
}
