export interface InputCoverage {
 target:number;capacity:number;usable:number;physical:number;inbound:number;otherOrders:number;managedOrders:number;
 desiredOrderQuantity:number;uncoveredQuantity:number;storageBlocked:boolean;
}
export interface IndustrialInput extends InputCoverage {commodityId:string;orderId:string;priceUnits:number|null;committedUnits:number;}
export interface IndustryProcurementSnapshot {
 accountId:string;instanceId:string;portId:string;typeId:string;
 state:'READY'|'WAITING_FUNDS'|'WAITING_DELIVERY'|'WAITING_MARKET'|'WAITING_STORAGE';
 lastReviewTime:number|null;nextReviewTime:number;reviewIntervalSeconds:number;inputs:IndustrialInput[];
}
export function fundedInputQuantity(shortage:number,priceUnits:number,fundsUnits:number,carryUnits?:number):{quantity:number;committedUnits:number};
export function inputCoverage(input:{target:number;capacity:number;usable:number;physical:number;inbound:number;otherOrders?:number;managedOrders?:number}):InputCoverage;
export function procurementState(inputs:InputCoverage[]):IndustryProcurementSnapshot['state'];
