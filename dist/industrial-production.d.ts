import type {GoodsRecord} from './goods-inventory.js';
import type {ManufacturingDefinition,RecipeItem} from './industry-contract.js';
export interface ProductionBatch {
 id:string;reservationId:string;serial:number;accountId:string;instanceId:string;portId:string;typeId:string;fraction:number;
 durationSeconds:number;elapsedSeconds:number;inputs:GoodsRecord[];inputRequirements:RecipeItem[];outputs:RecipeItem[];
 outputCapacities:Record<string,number>;outputCostWeights:Record<string,number>;acquisitionCost:number;acquisitionCostUnits:number;definition:ManufacturingDefinition;
}
export interface ProductionReceipt {
 id:string;accountId:string;completed:true;duplicate?:true;instanceId?:string;portId?:string;typeId?:string;fraction?:number;
 durationSeconds?:number;inputs?:GoodsRecord[];outputs?:(RecipeItem & {acquisitionCost:number;acquisitionCostUnits:number})[];acquisitionCost?:number;acquisitionCostUnits?:number;
}
export interface IndustryProductionSnapshot {
 accountId:string;instanceId:string;portId:string;typeId:string;state:'NOT_ACTIVATED'|'PRODUCING'|'WAITING_INPUTS'|'WAITING_OUTPUT';
 elapsedSeconds:number;durationSeconds:number;batch:ProductionBatch|null;completedBatches:number;
 outputs:{commodityId:string;capacity:number;stored:number;reserved:number}[];configurationPolicy:string;
}
export interface ProductionContext {effects?:{apply?:(transition:{stage:'start'|'complete';batch:ProductionBatch;receipt?:ProductionReceipt})=>void;rollback?:()=>void};}
export function productionTolerance(...values:number[]):number;
export function planProductionBatch(definition:ManufacturingDefinition,inputs:Record<string,number>,outputs:Record<string,number>):{state:IndustryProductionSnapshot['state'];fraction:number;durationSeconds?:number;inputs?:RecipeItem[];outputs?:RecipeItem[]};
