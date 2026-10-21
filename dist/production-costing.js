import {microgold,toMicrogold,fromMicrogold,addMicrogold} from './money.js?v=babbc3d3950e';
// Decimal rationals avoid floating multiplication at safe-integer monetary limits.
export function decimalRatio(value){if(!Number.isFinite(value)||value<0)throw RangeError('Invalid costing ratio');const [mantissa,exponent='0']=String(value).split('e'),parts=mantissa.split('.'),digits=parts.join(''),power=Number(exponent)-(parts[1]?.length??0);return power>=0?[BigInt(digits)*10n**BigInt(power),1n]:[BigInt(digits),10n**BigInt(-power)];}
const safe=n=>microgold(Number(n));
export function costUnits(row){return microgold(row.acquisitionCostUnits??toMicrogold(row.acquisitionCost??0));}
export function costFields(units){return {acquisitionCostUnits:microgold(units),acquisitionCost:fromMicrogold(units)};}
export function proportionalCost(units,part,total){microgold(units);if(!Number.isFinite(total)||total<=0||part<0||part>total)throw RangeError('Invalid cost partition');const [pn,pd]=decimalRatio(part),[tn,td]=decimalRatio(total);return safe(BigInt(units)*pn*td/(pd*tn));}
export function workerIncome(units,share){microgold(units);if(share>=1)throw RangeError('Invalid worker share');const [n,d]=decimalRatio(share);return safe(BigInt(units)*n/d);}
export function allocateOutputCosts(inputs,outputs,weights){
 const ratios=outputs.map(o=>decimalRatio(weights[o.commodityId])),denominator=ratios.reduce((d,[,x])=>d*x,1n),integers=ratios.map(([n,d])=>n*(denominator/d)),total=integers.reduce((n,v)=>n+v,0n);if(!total)throw RangeError('Empty output cost weights');
 return outputs.map((o,index)=>({ ...o,productionInputs:inputs.map(r=>{const cost=costUnits(r),previous=integers.slice(0,-1).reduce((n,w)=>n+BigInt(cost)*w/total,0n),units=index===outputs.length-1?safe(BigInt(cost)-previous):safe(BigInt(cost)*integers[index]/total);return {commodityId:r.commodityId,originPortId:r.originPortId,quantity:r.quantity*weights[o.commodityId]/outputs.reduce((n,x)=>n+weights[x.commodityId],0),...costFields(units)};})})).map(o=>({...o,...costFields(o.productionInputs.reduce((n,r)=>addMicrogold(n,r.acquisitionCostUnits),0))}));
}
export function manufacturedPrice(rows,share,policy,baselineUnits){
 let floorUnits=0;for(const row of rows){const cost=costUnits(row),[qn,qd]=decimalRatio(row.quantity),[sn,sd]=decimalRatio(share);if(!qn||sn>=sd)throw RangeError('Invalid manufacturing floor');const numerator=BigInt(cost)*qd*sd,denominator=qn*(sd-sn);floorUnits=Math.max(floorUnits,safe((numerator+denominator-1n)/denominator));}
 const [mn,md]=decimalRatio(Math.max(policy.ask_multiplier,1+policy.minimum_markup_fraction)),basis=floorUnits||microgold(baselineUnits);let askingUnits=safe((BigInt(basis)*mn+md-1n)/md);if(policy.enforce_cost_floor)askingUnits=Math.max(askingUnits,floorUnits);return {floorUnits,askingUnits:Math.max(1,askingUnits),enforceCostFloor:policy.enforce_cost_floor};
}

export function quantityPayment(units,q){microgold(units);const [n,d]=decimalRatio(q);return safe((BigInt(units)*n*2n+d)/(2n*d));}
