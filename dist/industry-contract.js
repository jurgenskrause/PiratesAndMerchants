// Pure Phase 3A contract. No accounts, goods, orders or production are mutated here.
const freeze=v=>{if(v&&typeof v==='object'){for(const x of Object.values(v))freeze(x);Object.freeze(v);}return v;};
export const INDUSTRY_PARAMETER_POLICY=freeze({applyMode:'simulation_restart',quantityUnit:'cargo units',timeUnit:'elapsed simulation seconds',moneyUnit:'integer microgold',quantityRange:[0.000000001,1000000],durationRange:[0.001,31536000],capitalRange:[0,Number.MAX_SAFE_INTEGER],pricingMultiplierRange:[0.01,100],reason:'Definitions are immutable during a session; existing batches, inventories, orders and accepted transfers retain their original terms.'});
const object=(v,keys,label)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k))||keys.some(k=>!Object.hasOwn(v,k)))throw TypeError('Invalid '+label);};
const bounded=(v,min,max,label)=>{if(!Number.isFinite(v)||v<min||v>max)throw RangeError('Invalid '+label);};
const qty=(v,label)=>{bounded(v,1e-9,1e6,label);if(!Number.isSafeInteger(Math.round(v*1e9))||v!==Math.round(v*1e9)/1e9)throw RangeError('Quantity precision: '+label);};
const quantities=(rows,known,label)=>{if(!Array.isArray(rows)||!rows.length)throw TypeError('Empty '+label);const seen=new Set();for(const r of rows){object(r,['commodity_id','quantity_per_tick'],label);if(!known.has(r.commodity_id)||seen.has(r.commodity_id))throw TypeError('Unknown or duplicate '+label+' commodity');seen.add(r.commodity_id);qty(r.quantity_per_tick,label);}return seen;};
const map=(v,keys,label)=>{if(!v||Array.isArray(v)||typeof v!=='object'||Object.keys(v).length!==keys.size||Object.keys(v).some(k=>!keys.has(k)))throw TypeError('Invalid '+label+' commodities');for(const q of Object.values(v))qty(q,label);};
export function validateManufacturingDefinition(d,commodityIds){
 if(d.type!=='SecondaryManufacturing'){if(d.manufacturing!==undefined)throw TypeError('Primary industry has manufacturing parameters');return d;}
 if(typeof d.id!=='string'||!d.id.trim()||d.industry_id!==d.id||typeof d.display_name!=='string'||!d.display_name.trim())throw TypeError('Stable industry type identity required');
 const known=new Set(commodityIds),input=quantities(d.inputs,known,'inputs'),output=quantities(d.outputs,known,'outputs'),m=d.manufacturing;
 object(m,['version','tuning_status','runtime_enabled','production_duration_seconds','input_buffer_targets','input_storage_capacities','output_storage_capacities','construction_duration_seconds','working_capital_microgold','procurement','selling','output_cost_weights'],'manufacturing parameters');
 if(m.version!==1||m.tuning_status!=='provisional'||typeof m.runtime_enabled!=='boolean')throw TypeError('Invalid manufacturing version or status');
 for(const k of ['production_duration_seconds','construction_duration_seconds'])bounded(m[k],.001,31536000,k);
 if(!Number.isSafeInteger(m.working_capital_microgold)||m.working_capital_microgold<0)throw RangeError('Invalid working capital microgold');
 for(const k of ['input_buffer_targets','input_storage_capacities'])map(m[k],input,k);map(m.output_storage_capacities,output,'output storage');
 for(const r of d.inputs)if(m.input_buffer_targets[r.commodity_id]>m.input_storage_capacities[r.commodity_id]||r.quantity_per_tick>m.input_buffer_targets[r.commodity_id])throw RangeError('Input buffer must fit a batch and its storage');
 for(const r of d.outputs)if(r.quantity_per_tick>m.output_storage_capacities[r.commodity_id])throw RangeError('Output batch exceeds storage');
 if(!d.base_build_cost||!Object.keys(d.base_build_cost).length)throw TypeError('Construction materials required');for(const [c,q] of Object.entries(d.base_build_cost)){if(!known.has(c))throw TypeError('Unknown construction material');qty(q,'construction material');}
 object(m.procurement,['review_interval_seconds','bid_multiplier','maximum_bid_multiplier','input_priority'],'procurement');object(m.selling,['review_interval_seconds','ask_multiplier','minimum_markup_fraction','enforce_cost_floor'],'selling');
 for(const p of [m.procurement,m.selling])bounded(p.review_interval_seconds,.001,31536000,'review interval');
 for(const v of [m.procurement.bid_multiplier,m.procurement.maximum_bid_multiplier,m.selling.ask_multiplier])bounded(v,.01,100,'price multiplier');
 if(m.procurement.bid_multiplier>m.procurement.maximum_bid_multiplier)throw RangeError('Bid exceeds limit');
 const priorities=m.procurement.input_priority;if(!Array.isArray(priorities)||priorities.length!==input.size||new Set(priorities).size!==input.size||priorities.some(c=>!input.has(c)))throw TypeError('Invalid procurement priority');
 bounded(m.selling.minimum_markup_fraction,0,10,'markup');if(typeof m.selling.enforce_cost_floor!=='boolean')throw TypeError('Invalid cost-floor policy');
 map(m.output_cost_weights,output,'output cost weights');if(Math.abs(Object.values(m.output_cost_weights).reduce((n,q)=>n+q,0)-1)>1e-9)throw RangeError('Output cost weights must sum to one');
 return d;
}
export function compileManufacturingDefinition(definition,commodityIds){
 validateManufacturingDefinition(definition,commodityIds);if(definition.type!=='SecondaryManufacturing')throw TypeError('Manufacturing definition required');
 const d=structuredClone(definition),m=d.manufacturing;
 return freeze({typeId:d.id,name:d.display_name,version:m.version,tuningStatus:m.tuning_status,runtimeEnabled:m.runtime_enabled,applyMode:INDUSTRY_PARAMETER_POLICY.applyMode,recipe:{inputs:d.inputs.map(r=>({commodityId:r.commodity_id,quantity:r.quantity_per_tick})),outputs:d.outputs.map(r=>({commodityId:r.commodity_id,quantity:r.quantity_per_tick})),durationSeconds:m.production_duration_seconds},storage:{inputBuffers:m.input_buffer_targets,inputCapacities:m.input_storage_capacities,outputCapacities:m.output_storage_capacities},construction:{materials:d.base_build_cost,durationSeconds:m.construction_duration_seconds,workingCapitalUnits:m.working_capital_microgold},procurement:m.procurement,selling:m.selling,outputCostWeights:m.output_cost_weights});
}
export function describeIndustryInstance(definition,{instanceId,portId},commodityIds){
 for(const id of [instanceId,portId])if(typeof id!=='string'||!id.trim())throw TypeError('Stable instance and parent port identities required');
 const config=compileManufacturingDefinition(definition,commodityIds),location='INDUSTRY:'+encodeURIComponent(instanceId);
 return freeze({instanceId,typeId:config.typeId,parentPortId:portId,catchmentId:portId,accountId:'INDUSTRY:'+encodeURIComponent(instanceId),ownerType:'INDUSTRY',definition:config,stores:{inputs:{location,compartment:'INPUT',commodityIds:config.recipe.inputs.map(r=>r.commodityId)},outputs:{location:'INDUSTRY_OUTPUT:'+encodeURIComponent(instanceId),compartment:'OUTPUT',commodityIds:config.recipe.outputs.map(r=>r.commodityId)}},production:{state:config.runtimeEnabled?'WAITING_INPUTS':'NOT_ACTIVATED',elapsedSeconds:0,batch:null},construction:{state:'NOT_STARTED',elapsedSeconds:0},connection:{portId,state:'UNCONNECTED'}});
}
export function prepareManufacturingDefinitionChange(previous,next,commodityIds,{sessionActive=false}={}){
 const before=compileManufacturingDefinition(previous,commodityIds),after=compileManufacturingDefinition(next,commodityIds);
 if(before.typeId!==after.typeId)throw TypeError('Industry type identity cannot change');
 if(sessionActive&&JSON.stringify(before)!==JSON.stringify(after))throw Error('Industry definition changes require simulation_restart');return after;
}
