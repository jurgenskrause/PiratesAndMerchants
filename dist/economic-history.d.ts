import type {EconomicEngine} from './economy.js';
export interface HistoryPoint {time:number;tick:number;price:number;eventId:number|null;reason:string;batch:{quantity:number;priceBefore:number;priceAfter:number}|null;unitPriceUnits:number|null;fills:{paymentId:string|null;transferId:string|null;orderId:string|null;offerId:string|null;quantity:number;unitPrice:number|null;unitPriceUnits:number|null;totalPaymentUnits:number;buyerAccountId:string|null;sellerAccountId:string|null}[];priceBefore:number;priceAfter:number}|null;}
export interface CargoHistoryEvent {id:number;shipId:string|null;shipName:string|null;action:'pickup'|'delivery'|'allocation';originPortId:string|null;destinationPortId:string|null;startTime:number;endTime:number;startTick:number;endTick:number;quantity:number;unitPrice:number|null;unitPriceUnits:number|null;fills:{paymentId:string|null;transferId:string|null;orderId:string|null;offerId:string|null;quantity:number;unitPrice:number|null;unitPriceUnits:number|null;totalPaymentUnits:number;buyerAccountId:string|null;sellerAccountId:string|null}[];priceBefore:number;priceAfter:number;gold:number;}
export interface PortPriceHistory {id:string;name:string;faction:string;compacted:boolean;droppedEvents:number;points:HistoryPoint[];events:CargoHistoryEvent[];}
export interface PriceHistorySnapshot {commodityId:string;time:number;tick:number;maxPoints:number;maxEvents:number;ports:PortPriceHistory[];}
export class EconomicHistory {
 constructor(economy:EconomicEngine,options?:{clock?:()=>number;maxPoints?:number;maxEvents?:number});
 snapshot(commodityId:string,options?:{portId?:string|null}):PriceHistorySnapshot;
 dispose():void;
}
