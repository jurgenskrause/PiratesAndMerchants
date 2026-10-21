import type {ManufacturingDefinition} from './industry-contract.js';
export interface Definition {id:string;[key:string]:unknown;}
export class Registry<T extends Definition=Definition>{constructor(definitions?:T[],schema?:object|null);register(definition:T):Readonly<T>;has(id:string):boolean;get(id:string):Readonly<T>;ids():string[];values():Readonly<T>[];}
export interface CommodityDefinition extends Definition {name:string;basePrice:number;market_enabled?:boolean;settlement_supply_enabled?:boolean;}
export interface VesselDefinition extends Definition {type:string;baseHullMaintenance:number;defaultCrew:number;water_endurance_voyages:number;crewCapacity:number;militaryOnly:boolean;canTrade:boolean;assetId:string;ship_class_id:string;display_name:string;category:string;required_berth_size:string;cargo_capacity:number;base_speed:number;hull_points:number;crew_complement:{min_crew:number;max_crew:number};base_hull_maintenance_per_day:number;physics:Record<string,unknown>;graphics:Record<string,unknown>;}
export interface AssetDefinition extends Definition {url:string;kind:string;}
export const commodityRegistry:Registry<CommodityDefinition>;
export const vesselRegistry:Registry<VesselDefinition>;
export const industryRegistry:Registry;
export const manufacturingDefinitions:readonly ManufacturingDefinition[];
export const assetRegistry:Registry<AssetDefinition>;
export function createAssetLoader<T>(load:(url:string,asset:Readonly<AssetDefinition>)=>T|Promise<T>,registry?:Registry<AssetDefinition>):(id:string)=>Promise<T>;

export interface FactionDefinition extends Definition {faction_id:string;runtime_id:string;display_name:string;primary_color:string;secondary_color:string;pennant_color:string;flag_asset:string;naming_bank_ref:string;harbor_frame:number;runtime_order:number;base_relations:Record<string,number>;}
export const factionRegistry:Registry<FactionDefinition>;
export const namingRegistry:Registry;
export const settlementRegistry:Registry;
export const systemSettings:Readonly<{id:string;globalDailyWagePerCrew:number;secondsPerDay:number;economicTickSeconds:number;physicsTickSeconds:number;baseUrgencyTicks:number;referenceDistance:number;mapScaleFactor:number;standardShipSpeed:number;safetyMarginFactor:number;baseLedgerAgeTicks:number;baseQueueReviewTicks:number;baseJobReviewTicks:number;feederRoadRadius:number;roadMountainHeight:number;roadMaxSearchNodes:number}>;
export function runtimeFaction(id:string):string|undefined;
export function factionDefinition(id:string):Readonly<FactionDefinition>|undefined;

export type BerthSize='Small'|'Medium'|'Large'|'ExtraLarge';
export interface DockDefinition extends Definition {dock_type_id:string;display_name:string;required_min_berth_size:BerthSize;max_simultaneous_ships:number;min_water_depth:number;build_cost:Record<string,number>;layout:{side_slots:number;pier_end_occupies_all:boolean};graphics:{rotations:Record<string,{asset_id:string;atlas_frame:number}>;tint:string};}
export const dockRegistry:Registry<DockDefinition>;

export interface TownBuildingDefinition extends Definition {building_type_id:string;display_name:string;prosperity_tier_required:number;housing_capacity:number;variants:string[];derelict_variant:string;build_cost:Record<string,number>;renovation_multiplier:number;}
export interface RoadDefinition extends Definition {kind:'endpoint'|'straight'|'curve'|'junction'|'urban_infill';mask:number;asset_id:string;}
export const townBuildingRegistry:Registry<TownBuildingDefinition>;
export const roadRegistry:Registry<RoadDefinition>;
