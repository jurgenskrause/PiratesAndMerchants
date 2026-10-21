// One batch planner for every industry definition. A fractional batch retains
// the configured duration; neither frames nor handling ticks create outputs.
export const productionTolerance=(...values)=>8*Number.EPSILON*Math.max(1,...values.map(Math.abs));
export function planProductionBatch(definition,inputs,outputs){
 if(!definition.runtimeEnabled)return {state:'NOT_ACTIVATED',fraction:0};
 let fraction=1;
 for(const r of definition.recipe.inputs){const available=inputs[r.commodityId]??0;if(!Number.isFinite(available)||available<0)throw RangeError('Invalid production input');if(available<=productionTolerance(r.quantity,available))return {state:'WAITING_INPUTS',fraction:0};fraction=Math.min(fraction,available/r.quantity);}
 for(const r of definition.recipe.outputs){const used=outputs[r.commodityId]??0;if(!Number.isFinite(used)||used<0)throw RangeError('Invalid production output storage');const capacity=definition.storage.outputCapacities[r.commodityId],space=Math.max(0,capacity-used);if(space<=productionTolerance(capacity,used))return {state:'WAITING_OUTPUT',fraction:0};fraction=Math.min(fraction,space/r.quantity);}
 if(!Number.isFinite(fraction)||fraction<=0)throw RangeError('Invalid production fraction');
 return {state:'PRODUCING',fraction,durationSeconds:definition.recipe.durationSeconds,inputs:definition.recipe.inputs.map(r=>({...r,quantity:r.quantity*fraction})),outputs:definition.recipe.outputs.map(r=>({...r,quantity:r.quantity*fraction}))};
}
