import type {ShipGoodsInventory} from './economy.js';
import type {LedgerReport} from './bridge-rules.js';
import type {PriceLedger} from './bridge-rules.js';
import type {GoodsRecord} from './goods-inventory.js';
import type {CargoTransfer} from './funded-market.js';
import type {RunningCostSnapshot} from './ship-running-costs.js';
import type {AccountSnapshot} from './economic-accounts.js';
import type {CommodityID,PortID,FactionID,Result,TransactionError,Stockpile,TradeContext,TradeResult,EconomicEngine} from './economy.js';
export type VesselID=string;
export type Vector2D={x:number;y:number};
export type Waypoint=Vector2D;
export type Rect={x:number;y:number;width:number;height:number};
export type ZoneID=string;
export type VesselClassID='SLOOP'|'SCHOONER'|'BRIGANTINE'|'FLUYT'|'FRIGATE'|'WAR_GALLEON'|'FIRST_RATE';
export const VesselClass:Readonly<{[K in VesselClassID]:K}>;
export type AgentStateID='IDLE_AT_PORT'|'LOADING_CARGO'|'IN_TRANSIT'|'FLEEING_THREAT'|'UNLOADING_CARGO'|'DOCKING'|'UNDOCKING'|'RECOVERING'|'ANCHORING'|'AT_ANCHOR';
export const AgentState:Readonly<{[K in AgentStateID]:K}>;
export interface PolarPoint {wind_angle_degrees:number;speed_multiplier:number}
export interface VesselPhysicsProfile {
 vessel_class:VesselClassID;max_speed_knots:number;no_go_zone_angle:number;optimal_tack_angle:number;
 draft_depth:number;turn_rate_degrees_per_sec:number;polar_performance:PolarPoint[];
}
export interface CargoItem {
 commodity_id:CommodityID;quantity:number;purchase_price_per_unit:number;origin_port_id:PortID|null;is_contraband:boolean;
 owner_account_id:string;location:string;acquisition_cost:number;provenance:readonly {origin_port_id:PortID|null;quantity:number;acquisition_cost:number}[];
}
export interface CargoManifest {readonly inventory?:ShipGoodsInventory;readonly physical?:readonly GoodsRecord[];readonly pending_transfers?:readonly CargoTransfer[];items:Map<CommodityID,CargoItem>;total_volume:number;total_purchase_value:number}
export interface ThreatEntity {
 entity_id:string;faction_id:FactionID;position:Waypoint;velocity:Vector2D;estimated_threat_level:number;
}
export interface ShipAgent {
 PriceLedger:LedgerReport[];vessel_id:VesselID;owner_faction:FactionID;vessel_class:VesselClassID;physics_profile:VesselPhysicsProfile;manifest:CargoManifest;
 current_position:Waypoint;current_heading:number;current_speed:number;target_port_id:PortID|null;planned_waypoints:Waypoint[];
 state:AgentStateID;detected_threats:ThreatEntity[];threat_tolerance:number;
 planned_wind_angle:number|null;route_replans:number;berth_slot:number|null;queue_position:number;giving_way:boolean;
 navigation_waypoints:Waypoint[];tack_phase:'SAILING'|'PREPARING'|'TACKING'|'RECOVERING';completed_tacks:number;failed_tacks:number;
 current_crew_count:number;maintenance_paid:number;velocity:Vector2D;canvas_stage:number;wallet_gold:number;running_costs:RunningCostSnapshot;financial_accounts:Readonly<{wallet:AccountSnapshot;sailors:AccountSnapshot;maintenance:AccountSnapshot}>;max_cargo_capacity:number;registration_port_id:PortID|null;origin_port_id:PortID|null;docked:boolean;docked_port_id:PortID|null;stalled_seconds:number;active:boolean;tacking:boolean;luffing:boolean;
}
export interface IncidentReport {
 incident_id:string;attacker_faction:FactionID;victim_faction:FactionID;victim_vessel_class:VesselClassID;
 location:Waypoint;commodity_affected:CommodityID|null;cargo_value_lost:number;is_fatal_sinking:boolean;timestamp_tick:number;
 kind:'INTERDICTION'|'CARGO_DUMP'|'BORDER_INCURSION';victim_vessel_id:VesselID;
}
export type LogisticsError='UNKNOWN_ENTITY'|'INVALID_RATIO'|'NOT_DOCKED'|'BLACK_MARKET_DENIED'|'EMPTY_CARGO'|'INVALID_QUANTITY'|'TRADE_DENIED'|'NO_CAPACITY_OR_FUNDS'|TransactionError;
export interface ILayer2LogisticsEngine {
 spawnVessel(faction_id:FactionID,vessel_class:VesselClassID,spawn_position:Waypoint):ShipAgent;
 updateAgentPhysicsControls(vessel_id:VesselID,wind_vector:Vector2D,delta_time:number):{rudder_input:number;sail_trim_input:number};
 reportThreatInProximity(vessel_id:VesselID,threat:ThreatEntity):void;
 executeCargoDump(vessel_id:VesselID,target_port_id:PortID,dump_ratio:number):Result<IncidentReport,LogisticsError>;
 processVesselInterdiction(attacker_faction:FactionID,victim_vessel_id:VesselID,is_fatal:boolean):IncidentReport;
 getZoneThreatHeatmap(zone_bounds:Rect):Map<ZoneID,number>;
 getAgentState(vessel_id:VesselID):ShipAgent;
 receiveMarketReports(vessel_id:VesselID,ledger:PriceLedger):void;
}
export interface EconomicLogisticsAPI extends Pick<EconomicEngine,'accounts'|'commodityRegistry'|'commodityIds'|'getShipCargo'|'getFundedMarket'|'getShipInventory'|'getShipOccupiedQuantity'|'getPhysicalShipCargo'|'getPendingTransfers'|'acceptCargoPickup'|'acceptCargoDelivery'|'handleCargoTransfers'|'setShipDocked'|'dumpShipCargo'|'receiveExternalCargo'|'removeShipCargo'|'retireActorAccount'> {
 getPortStockpile(port:PortID,commodity:CommodityID):Readonly<Stockpile>;
 getPortTaxRate(port:PortID):number;
}
export interface DiplomaticPolicy {
 canTrade(trader:FactionID,owner:FactionID,commodity:CommodityID):boolean;
 canEnter(visitor:FactionID,owner:FactionID):boolean;
 isHostile(first:FactionID,second:FactionID):boolean;
 isFriendly(first:FactionID,second:FactionID):boolean;
}
export interface LogisticsPort {
 id:PortID;owner_faction:FactionID;position:Waypoint;approach_position?:Waypoint;berth?:(Waypoint&{heading:number});island_id?:string;black_market?:boolean;
}
export interface VesselSettings {
 current_crew_count?:number;wallet_gold?:number;base_vessel_value?:number;operational_range?:number;voyage_cost_per_unit?:number;
 threat_tolerance?:number;max_cargo_capacity?:number;heading?:number;home_port_id?:PortID;preferred_voyage_distance?:number;
}
export interface NativeWorld {
 n:number;h:Float32Array;moisture:Float32Array;rock:Float32Array;biomes:Uint8Array;
 depth?:Float32Array;bounds?:{width:number;height:number};
}
export interface WindField {width:number;height:number;spacing:number;data:Float32Array}
export interface LogisticsOptions {
 economy:EconomicLogisticsAPI;world:NativeWorld;ports:LogisticsPort[];policy:DiplomaticPolicy;
 wind?:Vector2D;windField?:WindField|null;defaults?:VesselSettings;
 eventBus?:{emit(name:'ON_LOGISTICS_INCIDENT',incident:IncidentReport):void}|null;
 scanInterval?:number;detectionRadius?:number;dockRadius?:number;zoneSize?:number;trickleRadius?:number;trickleRate?:number;
 cargoTransferRate?:number;stuckSeconds?:number;planningBudgetMs?:number;
 knotsPerSpeedUnit?:number;worldUnitsPerMile?:number;navigation?:{spacing?:number;maxNodes?:number};
 threatProvider?:(agent:ShipAgent)=>ThreatEntity[];
 hazardProvider?:(agent:ShipAgent)=>Array<{position:Waypoint;radius:number;type?:'STORM'|'REEF'}>;
 coverProvider?:(agent:ShipAgent)=>Array<{position:Waypoint;faction_id:FactionID;port_id?:PortID}>;
 territoryAt?:(position:Waypoint)=>FactionID|null;
}
export class LogisticsEngine implements ILayer2LogisticsEngine {
 setCrewCount(id:string,count:number):void;dispose():void;
 constructor(options:LogisticsOptions);
 wind:Vector2D;windField:WindField|null;
 spawnVessel(faction_id:FactionID,vessel_class:VesselClassID,spawn_position:Waypoint,options?:VesselSettings):ShipAgent;
 updateAgentPhysicsControls:ILayer2LogisticsEngine['updateAgentPhysicsControls'];
 reportThreatInProximity:ILayer2LogisticsEngine['reportThreatInProximity'];
 executeCargoDump:ILayer2LogisticsEngine['executeCargoDump'];
 processVesselInterdiction:ILayer2LogisticsEngine['processVesselInterdiction'];
 getZoneThreatHeatmap:ILayer2LogisticsEngine['getZoneThreatHeatmap'];
 getAgentState:ILayer2LogisticsEngine['getAgentState'];
 receiveMarketReports:ILayer2LogisticsEngine['receiveMarketReports'];
 loadCargo(vessel_id:VesselID,port_id:PortID,commodity:CommodityID,quantity:number):Result<{total_gold_cost:number;units_transacted:number},LogisticsError>;
 receiveCargo(vessel_id:VesselID,item:Pick<CargoItem,'commodity_id'|'quantity'|'purchase_price_per_unit'>&Partial<CargoItem>):void;
 setZoneThreat(position:Waypoint,rating:number):void;
 requestRecovery(vessel_id:VesselID):boolean;
 removeVessel(vessel_id:VesselID):void;
 setExternalVessels(vessels:Array<Waypoint&{id:string;heading:number;vx:number;vy:number;speed:number;spec:unknown;stationary?:boolean;assisted?:boolean}>):void;
 tick(delta_time?:number):{timestamp_tick:number;incidents:IncidentReport[];listener_errors:unknown[]};
}
export function scoreRoute(input:{buyPrice:number;sellPrice:number;volume:number;distance:number;voyageCost:number;zoneThreat:number;threatTolerance:number;cargoValue:number;baseVesselValue:number}):number;
