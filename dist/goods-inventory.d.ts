export type GoodsLocationType='MARKET'|'TOWN'|'INDUSTRY'|'INDUSTRY_OUTPUT'|'SHIP'|'ACCOUNT'|'CONSTRUCTION'|'TRANSFER';
export function goodsLocation(type:GoodsLocationType,id:string):string;
export interface ProductionInputProvenance {readonly commodityId:string;readonly originPortId:string|null;readonly quantity:number;readonly acquisitionCost:number;readonly acquisitionCostUnits:number;}
export interface GoodsRecord {readonly productionInputs?:readonly ProductionInputProvenance[];readonly id:string;readonly ownerAccountId:string;readonly location:string;readonly commodityId:string;readonly quantity:number;readonly originPortId:string|null;readonly reservationId:string|null;readonly acquisitionCost:number;readonly acquisitionCostUnits:number;readonly contraband:boolean;readonly manufacturingIndustryAccountId:string|null;}
export type GoodsInput=Omit<GoodsRecord,'id'|'originPortId'|'reservationId'|'acquisitionCost'|'acquisitionCostUnits'|'contraband'|'manufacturingIndustryAccountId'>&Partial<Pick<GoodsRecord,'originPortId'|'reservationId'|'acquisitionCost'|'acquisitionCostUnits'|'contraband'|'manufacturingIndustryAccountId'>>;
export type GoodsFilter=Partial<GoodsRecord>;
export interface GoodsSnapshot {readonly records:readonly GoodsRecord[];readonly totals:Readonly<Record<string,number>>;readonly opening:Readonly<Record<string,number>>;readonly flows:Readonly<Record<string,number>>;}
export class GoodsInventory {
 create(record:GoodsInput,reason:string):void;
 inspect(filter?:GoodsFilter):readonly GoodsRecord[];
 amount(filter?:GoodsFilter):number;
 select(filter:GoodsFilter,quantity:number):readonly GoodsRecord[];
 take(filter:GoodsFilter,quantity:number):readonly GoodsRecord[];
 move(filter:GoodsFilter,quantity:number,changes?:Partial<GoodsRecord>):readonly GoodsRecord[];
 remove(filter:GoodsFilter,quantity:number,reason:string):readonly GoodsRecord[];
 snapshot():GoodsSnapshot;
 checkpoint():unknown;restore(checkpoint:unknown):void;
}
