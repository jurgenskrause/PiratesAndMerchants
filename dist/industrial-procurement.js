import {microgold} from './money.js?v=babbc3d3950e';
const DEN=1000000000n;
const nano=q=>{if(!Number.isFinite(q)||q<0||q>1000000)throw RangeError('Invalid procurement quantity');return BigInt(Math.round(q*1e9));};
// Reservations use ceiling rounding, including the market's existing invoice carry.
export function fundedInputQuantity(shortage,priceUnits,fundsUnits,carryUnits=0){
 microgold(priceUnits);microgold(fundsUnits);microgold(carryUnits);if(!priceUnits)throw RangeError('Invalid procurement price');
 const budget=BigInt(Math.max(0,fundsUnits-carryUnits)),q=[nano(shortage),budget*DEN/BigInt(priceUnits)].reduce((a,b)=>a<b?a:b);
 return {quantity:Number(q)/1e9,committedUnits:q?microgold(Number((q*BigInt(priceUnits)+DEN-1n)/DEN)+carryUnits):0};
}
export function inputCoverage({target,capacity,usable,physical,inbound,otherOrders=0,managedOrders=0}){
 for(const q of [target,capacity,usable,physical,inbound,otherOrders,managedOrders])if(!Number.isFinite(q)||q<0)throw RangeError('Invalid input coverage');
 const required=Math.max(0,target-usable-inbound-otherOrders),space=Math.max(0,capacity-physical-inbound-otherOrders);
 return {target,capacity,usable,physical,inbound,otherOrders,managedOrders,desiredOrderQuantity:Math.min(required,space),uncoveredQuantity:Math.max(0,required-managedOrders),storageBlocked:required>space+1e-9};
}
export function procurementState(inputs){
 if(inputs.every(i=>i.usable+1e-9>=i.target))return 'READY';
 if(inputs.some(i=>i.storageBlocked))return 'WAITING_STORAGE';
 if(inputs.some(i=>i.uncoveredQuantity>1e-9))return 'WAITING_FUNDS';
 if(inputs.some(i=>i.inbound>1e-9))return 'WAITING_DELIVERY';
 return 'WAITING_MARKET';
}
