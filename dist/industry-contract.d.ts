import type {ProductionBatch} from './industrial-production.js';
export interface RecipeItem {readonly commodityId:string;readonly quantity:number;}
export interface ManufacturingDefinition {
 readonly typeId:string;readonly name:string;readonly version:1;readonly tuningStatus:'provisional';readonly runtimeEnabled:boolean;readonly applyMode:'simulation_restart';
 readonly recipe:{readonly inputs:readonly RecipeItem[];readonly outputs:readonly RecipeItem[];readonly durationSeconds:number};
 readonly storage:{readonly inputBuffers:Readonly<Record<string,number>>;readonly inputCapacities:Readonly<Record<string,number>>;readonly outputCapacities:Readonly<Record<string,number>>};
 readonly construction:{readonly materials:Readonly<Record<string,number>>;readonly durationSeconds:number;readonly workingCapitalUnits:number};
 readonly procurement:{readonly review_interval_seconds:number;readonly bid_multiplier:number;readonly maximum_bid_multiplier:number;readonly input_priority:readonly string[]};
 readonly selling:{readonly review_interval_seconds:number;readonly ask_multiplier:number;readonly minimum_markup_fraction:number;readonly enforce_cost_floor:boolean};
 readonly outputCostWeights:Readonly<Record<string,number>>;
}
export interface IndustryInstanceContract {
 readonly instanceId:string;readonly typeId:string;readonly parentPortId:string;readonly catchmentId:string;readonly accountId:string;readonly ownerType:'INDUSTRY';readonly definition:ManufacturingDefinition;
 readonly stores:Readonly<Record<'inputs'|'outputs',{readonly location:string;readonly compartment:'INPUT'|'OUTPUT';readonly commodityIds:readonly string[]}>>;
 readonly production:{readonly state:'NOT_ACTIVATED'|'WAITING_INPUTS'|'WAITING_OUTPUT'|'PRODUCING';readonly elapsedSeconds:number;readonly batch:ProductionBatch|null};
 readonly construction:{readonly state:'NOT_STARTED'|'BUILDING'|'COMPLETE';readonly elapsedSeconds:number};readonly connection:{readonly portId:string;readonly state:'UNCONNECTED'|'CONNECTED'};
}
export const INDUSTRY_PARAMETER_POLICY:Readonly<{applyMode:'simulation_restart';quantityUnit:string;timeUnit:string;moneyUnit:string;quantityRange:readonly number[];durationRange:readonly number[];capitalRange:readonly number[];pricingMultiplierRange:readonly number[];reason:string}>;
export function validateManufacturingDefinition(definition:Record<string,unknown>,commodityIds:Iterable<string>):Record<string,unknown>;
export function compileManufacturingDefinition(definition:Record<string,unknown>,commodityIds:Iterable<string>):ManufacturingDefinition;
export function describeIndustryInstance(definition:Record<string,unknown>,identity:{instanceId:string;portId:string},commodityIds:Iterable<string>):IndustryInstanceContract;
export function prepareManufacturingDefinitionChange(previous:Record<string,unknown>,next:Record<string,unknown>,commodityIds:Iterable<string>,options?:{sessionActive?:boolean}):ManufacturingDefinition;
