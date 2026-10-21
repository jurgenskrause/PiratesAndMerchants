import type {ManufacturingDefinition,IndustryInstanceContract} from './industry-contract.js';
import type {IndustryProductionSnapshot,ProductionBatch,ProductionReceipt,ProductionContext} from './industrial-production.js';
import type {IndustryProcurementSnapshot} from './industrial-procurement.js';
import type {IndustryProject,ConstructionEffects} from './industry-construction.js';
import type {PurchaseOrderInput,PurchaseOrder,SellingOfferInput,SellingOffer,FundedMarketSnapshot,MarketBuyer,CargoTransfer,HandlingKind,MarketFill,MarketFillInput} from './funded-market.js';
import type {GoodsRecord,GoodsInput,GoodsFilter,GoodsSnapshot} from './goods-inventory.js';
import type {CargoItem} from './logistics.js';
import type {EconomicAccounts,AccountSnapshot,FinancialSnapshot} from './economic-accounts.js';
import type {Registry,CommodityDefinition,Definition} from './simulation-registry.js';
export type CommodityID='COTTON'|'IRON_ORE'|'SUGAR'|'WOOD'|'TEXTILES'|'RUM'|'IRON_BARS'|'CANNONS'|'CANNONBALLS'|'SPICES'|(string & {});
export type PortID=string;
export type FactionID='ENGLAND'|'FRANCE'|'SPAIN'|'PIRATES'|(string & {});
export type EventName='ON_CRITICAL_SCARCITY'|'ON_MARKET_SURPLUS'|'ON_RESERVATION_STALLED'|'ON_TREASURY_DEPLETED';
export const COMMODITIES:readonly CommodityID[];
export const FACTIONS:readonly FactionID[];
export const EventType:Readonly<{[K in EventName]:K}>;
export interface Stockpile {
 readonly offers:readonly SellingOffer[];readonly purchase_orders:readonly PurchaseOrder[];
 readonly ownership:readonly GoodsRecord[];
 commodity_id:CommodityID; current_stock:number; reserved_stock:number; target_capacity:number;
 trade_stock:number; consumption_stock:number; consumption_target:number; production_pool:'TRADE'|'CONSUMPTION';
 base_production_rate:number; base_consumption_rate:number; base_price:number; current_price:number;
 elasticity_gamma:number; prod_modifier:number; cons_modifier:number;
}
export interface MaterialReservation {
 reservation_id:string; requester_id:string; port_id:PortID; commodity_id:CommodityID;
 owner_account_id:string;location:string;
 units_requested:number; units_fulfilled:number; is_complete:boolean;
}
export interface Port {
 id:PortID; name:string; owner_faction:FactionID; tax_rate:number; accumulated_tax_gold:number;
 stockpiles:Map<CommodityID,Stockpile>; active_reservations:MaterialReservation[];
}
export interface FactionTreasury {
 faction_id:FactionID; balance_gold:number;
 last_income_gross:number; last_expense_gross:number;
}
export interface EconomicEventSignal {
 event_type:EventName; port_id:PortID; faction_id:FactionID; commodity_id:CommodityID|null;
 metadata_value:number; timestamp_tick:number;
}
export type Result<T,E>={ok:true;value:T}|{ok:false;error:{code:E}};
export type TransactionError='USE_FUNDED_MARKET'|'FUNDED_SETTLEMENT_REQUIRED'|'LOCAL_ALLOCATION_REQUIRED'|'MARITIME_TRANSPORT_REQUIRED'|'USE_MARKET_OFFERS'|'INVALID_TRANSACTION'|'UNKNOWN_STOCKPILE'|'OUT_OF_STOCK'|'NUMERIC_OVERFLOW'|'ACCOUNT_REQUIRED'|'UNKNOWN_ACCOUNT'|'INSUFFICIENT_FUNDS'|'TRANSACTION_CONFLICT'|'SETTLEMENT_FAILED'|'OWNERSHIP_REQUIRED'|'INSUFFICIENT_OWNED_GOODS'|'INVALID_LOCATION'|'MARITIME_TRANSPORT_REQUIRED';
export interface RevenueRecipient {readonly accountId:string;readonly amountUnits:number;readonly amount:number;}
export interface SellerRevenue {readonly sellerAccountId:string;readonly quantity:number;readonly paymentUnits:number;readonly payment:number;readonly allocation:boolean;readonly recipients:readonly (RevenueRecipient & {readonly role:'owner_revenue'|'industry_retained'|'manufacturing_worker_income'})[];}
export interface TradeRecord {readonly acceptanceId?:string|null;readonly sellerAccountId?:string;readonly sourceLocation?:string;readonly sourceReservationId?:string|null;readonly goods?:MarketFill['goods'];readonly unitPrice?:number;readonly unitPriceUnits?:number;readonly orderId?:string;readonly offerId?:string|null;readonly transferId?:string|null;readonly id:string;readonly paymentId:string|null;readonly tick:number;readonly buyerAccountId:string;readonly commodityId:CommodityID;readonly quantity:number;readonly totalPaymentUnits:number;readonly totalPayment:number;readonly recipients:readonly RevenueRecipient[];readonly sales:readonly SellerRevenue[];readonly action:'pickup'|'delivery'|'allocation';}
export interface TradeResult {readonly total_microgold:number;readonly total_gold_cost:number;readonly units_transacted:number;readonly recipients:readonly RevenueRecipient[];readonly sales:readonly SellerRevenue[];readonly provenance:readonly {ownerAccountId:string;originPortId:string|null;quantity:number;acquisitionCost:number}[];}
export interface ShipGoodsInventory {readonly unsold:readonly GoodsRecord[];readonly physical:readonly GoodsRecord[];readonly deliveries:readonly (CargoTransfer&{readonly goods:readonly GoodsRecord[]})[];readonly pickups:readonly (CargoTransfer&{readonly goods:readonly GoodsRecord[]})[];readonly completed:readonly CargoTransfer[];readonly physicalQuantity:number;readonly committedPickupQuantity:number;readonly occupiedQuantity:number;}
export interface CargoLoss {readonly id:string;readonly shipId:string;readonly ownerAccountId:string;readonly commodityId:CommodityID;readonly location:string;readonly quantity:number;readonly acquisitionCost:number;readonly tick:number;readonly reason:'dumping';readonly goods:readonly GoodsRecord[];}
export interface TradeContext {acceptanceId?:string;buyerAccountId?:string;sellerAccountId?:string;merchantAccountId?:string;transactionId?:string;destinationLocation?:string;effects?:{apply?:(result:TradeResult)=>void;rollback?:()=>void};shipId?:string;shipName?:string;originPortId?:string;destinationPortId?:string;}
export interface MarketTransaction extends TradeContext {readonly action:'pickup'|'delivery'|'allocation';readonly buyerAccountId:string;readonly commodityId:CommodityID;readonly recipients:readonly RevenueRecipient[];readonly sales:readonly SellerRevenue[];readonly paymentId:string|null;readonly quantity:number;readonly goldUnits:number;readonly gold:number;readonly priceBefore:number;readonly priceAfter:number;}
export interface PurchaseQuote {readonly port_id:PortID;readonly commodity_id:CommodityID;readonly quantity:number;readonly market_price:number;readonly tax_rate:number;readonly unit_price:number;}
export type AllocationError='INVALID_ALLOCATION'|'UNKNOWN_STOCKPILE'|'INSUFFICIENT_SUPPLIES'|'NUMERIC_OVERFLOW';
export type ReservationError='INVALID_RESERVATION'|'UNKNOWN_STOCKPILE'|'UNKNOWN_RESERVATION'|'RESERVATION_COMPLETE';
export type InsufficientFundsError='UNKNOWN_FACTION'|'INVALID_AMOUNT'|'INSUFFICIENT_FUNDS'|'NUMERIC_OVERFLOW';
export interface ILayer1EconomicEngine {
 readonly accounts:EconomicAccounts;
 getFinancialSnapshot():FinancialSnapshot;
 getPortTreasury(id:string):AccountSnapshot;
 getIndustryDefinitions():Definition[];
 getIndustryInvestments(portId?:string|null):IndustryInvestment[];
 beginIndustryInvestment(input:{id:string;portId:string;typeId:string;reserveUnits:number;minimumSurplusUnits?:number;materialPrices:Record<string,number>;evidence:unknown;estimate:unknown}):IndustryInvestment;
 getIndustryProjects(portId?:string|null):IndustryProject[];
 beginIndustryConstruction(input:{id:string;instanceId:string;portId:string;typeId:string;site:IndustryProject['site']},effects?:ConstructionEffects):IndustryProject;
 advanceIndustryConstruction(id:string,dt:number):IndustryProject;
 completeIndustryConstruction(id:string,effects?:ConstructionEffects):IndustryProject;
 removeConstructedIndustry(instanceId:string,effects?:ConstructionEffects):IndustryProject;
 getIndustrySupplyDiagnostics(owner?:string|null):IndustrySupplyDiagnostic[];
 getIndustryAccounts():readonly {id:string;owner:string;portId:string;industryId:string;account:AccountSnapshot;definition:ManufacturingDefinition;instance:IndustryInstanceContract;production:IndustryProductionSnapshot;productionMode:'ELAPSED_SIMULATION_TIME'|'NOT_ACTIVATED'}[];
 allocateSupplies(port_id:PortID,commodity_id:CommodityID,quantity:number,from_pool:'TRADE'|'CONSUMPTION'):Result<number,AllocationError>;
 getPortSupplies(port_id:PortID):readonly Readonly<Stockpile>[];
 executeTransaction(port_id:PortID,commodity_id:CommodityID,quantity:number,is_buy_action:boolean,context?:TradeContext):Result<TradeResult,TransactionError>;
 requestMaterialReservation(port_id:PortID,requester_id:string,commodity_id:CommodityID,quantity:number):Result<Readonly<MaterialReservation>,ReservationError>;
 cancelMaterialReservation(reservation_id:string):Result<boolean,ReservationError>;
 applyStockpileModifier(port_id:PortID,commodity_id:CommodityID,prod_multiplier:number,cons_multiplier:number):void;
 modifyTreasuryBalance(faction_id:FactionID,amount_gold:number):Result<number,InsufficientFundsError>;
 getPortStockpile(port_id:PortID,commodity_id:CommodityID):Readonly<Stockpile>;
 getFactionTreasury(faction_id:FactionID):Readonly<FactionTreasury>;
}
export type StockpileInput=Pick<Stockpile,'target_capacity'|'base_price'>&Partial<Omit<Stockpile,'ownership'>>;
export interface PortInput {
 initial_gold?:number;
 id:PortID; owner_faction:FactionID; name?:string; tax_rate?:number; accumulated_tax_gold?:number;
 stockpiles:Map<CommodityID,StockpileInput>|Partial<Record<CommodityID,StockpileInput>>;
 active_reservations?:never[];
}
export interface EngineOptions {economicTickSeconds?:number;
 industryRegistry?:Registry;industries?:{port_id:string;industry_id:string;instance_id?:string;initial_gold?:number;count?:number}[];
 ports?:PortInput[]; treasuries?:Array<Pick<FactionTreasury,'faction_id'>&Partial<FactionTreasury>>;
 eventBus?:{emit(type:EventName,event:Readonly<EconomicEventSignal>):void}|null;
 commodityRegistry?:Registry<CommodityDefinition>;
 ticksPerDay?:number; scarcityRatio?:number; surplusRatio?:number;
}
export function availableStock(stock:Stockpile):number;
export function calculatePrice(stock:Stockpile):number;
export interface MarketChange{readonly type?:'MARKET_CHANGED';readonly reason?:string;readonly transaction?:Readonly<MarketTransaction>;readonly portId:string;readonly name:string;readonly faction:FactionID;readonly tax:number;readonly revision:number;readonly tick:number;readonly stocks:readonly Readonly<Stockpile>[];}
export interface IndustrySupplyDiagnostic {accountId:string;instanceId:string;portId:string;typeId:string;inputs:{commodityId:string;primaryTypes:string[];supplierTypes:string[];producerPorts:string[];producerAccounts:string[];status:'NO_SUPPLIER_DEFINITION'|'NO_ACTIVE_PRODUCTION'|'LOCAL_PRODUCTION'|'IMPORT_REQUIRED'}[];}
export interface IndustryInvestment {id:string;portId:string;typeId:string;ownerAccountId:string;location:string;reservationId:string;state:'ACQUIRING'|'BUILDING'|'COMPLETE'|'REMOVED';capitalUnits:number;capitalCommittedUnits:number;reserveAtDecisionUnits:number;estimatedCommitmentUnits:number;evidence:unknown;estimate:unknown;materials:Record<string,number>;materialsStatus:{commodityId:string;quantity:number;held:number;inbound:number;ordered:number}[];}
export class EconomicEngine implements ILayer1EconomicEngine {
 getFundedMarket(portId?:string|null):FundedMarketSnapshot;
 registerMarketBuyer(input:{accountId:string;portId:string;kind?:'SHIPYARD'}):MarketBuyer;
 getMarketBuyers():readonly MarketBuyer[];
 createPurchaseOrder(input:PurchaseOrderInput):PurchaseOrder;
 amendPurchaseOrder(id:string,changes:{quantity:number;priceUnits:number}):PurchaseOrder;
 cancelPurchaseOrder(id:string):boolean;
 amendSellingOffer(id:string,changes:{priceUnits?:number;askingPrice?:number}):SellingOffer;
 createSellingOffer(input:SellingOfferInput):SellingOffer;
 cancelSellingOffer(id:string):boolean;
 fillMarketOrder(id:string,input:MarketFillInput):MarketFill;
 getIndustryProduction(owner?:string|null):IndustryProductionSnapshot[];
 getIndustrySupplyDiagnostics(owner?:string|null):IndustrySupplyDiagnostic[];
 getIndustryProductionHistory(owner?:string|null):ProductionReceipt[];
 startIndustryBatch(owner:string,context?:ProductionContext):ProductionBatch|null;
 completeIndustryBatch(owner:string,id:string,context?:ProductionContext):ProductionReceipt;
 advanceIndustryProduction(dt:number,context?:ProductionContext):void;
 getIndustryProcurement(owner?:string|null):IndustryProcurementSnapshot[];
 advanceIndustryProcurement(dt:number):void;
 reviewIndustryProcurement(owner?:string|null,context?:{effects?:{apply?:()=>void;rollback?:()=>void}}):IndustryProcurementSnapshot[];
 refreshFundedDemand():void;
 setShipDocked(shipId:string,portId:string|null):void;
 getPendingTransfers(shipId:string,kind?:HandlingKind|null):readonly CargoTransfer[];
 getShipDockVisit(shipId:string):number;
 acceptCargoDelivery(shipId:string,portId:string,commodity:string,quantity:number,context?:TradeContext):readonly MarketFill[];
 acceptCargoPickup(shipId:string,portId:string,commodity:string,quantity:number,capacity:number,context?:TradeContext):readonly MarketFill[];
 handleCargoTransfers(shipId:string,kind:HandlingKind,budget:number,context?:{updateSequence?:number|null}):readonly {transferId:string;commodityId:string;quantity:number}[];
 getShipInventory(shipId:string):ShipGoodsInventory;
 getGoodsLossHistory(shipId?:string|null):readonly CargoLoss[];
 dumpShipCargo(shipId:string,commodityId:CommodityID,quantity:number,context?:{effects?:{apply?:(loss:CargoLoss)=>void;rollback?:()=>void}}):CargoLoss;
 allocateOwnedSupplies(ownerAccountId:string,portId:string,commodityId:CommodityID,quantity:number):Result<TradeResult,TransactionError>;
 getPhysicalShipCargo(shipId:string):readonly GoodsRecord[];
 getShipOccupiedQuantity(shipId:string):number;
 readonly accounts:EconomicAccounts;
 initializeInventory(record:GoodsInput):void;
 getGoods(filter?:GoodsFilter):readonly GoodsRecord[];
 getGoodsSnapshot():GoodsSnapshot;
 getRevenueRules():Readonly<{manufacturingWorkerShare:number;tradeTaxRate:0;precision:string;defaultIsProvisional:true}>;
 getTradeHistory():readonly TradeRecord[];
 getShipCargo(shipId:string):Map<CommodityID,Readonly<CargoItem>>;
 receiveExternalCargo(shipId:string,item:Pick<CargoItem,'commodity_id'|'quantity'>&Partial<CargoItem>):void;
 removeShipCargo(shipId:string,commodity:CommodityID,quantity:number,reason:string):void;
 retireGoodsOwner(ownerAccountId:string,portId:string):void;
 retireActorAccount(ownerAccountId:string,portId:string|null,recipientAccountId?:string,effects?:{apply?:()=>void;rollback?:()=>void}):void;
 consumeConstructionMaterials(reservationId:string,quantity:number):Result<number,'UNKNOWN_RESERVATION'|'INSUFFICIENT_MATERIALS'>;
 getFinancialSnapshot:ILayer1EconomicEngine['getFinancialSnapshot'];
 getPortTreasury:ILayer1EconomicEngine['getPortTreasury'];
 getIndustryDefinitions:ILayer1EconomicEngine['getIndustryDefinitions'];
 getIndustryInvestments:ILayer1EconomicEngine['getIndustryInvestments'];
 beginIndustryInvestment:ILayer1EconomicEngine['beginIndustryInvestment'];
 getIndustryProjects:ILayer1EconomicEngine['getIndustryProjects'];
 beginIndustryConstruction:ILayer1EconomicEngine['beginIndustryConstruction'];
 advanceIndustryConstruction:ILayer1EconomicEngine['advanceIndustryConstruction'];
 completeIndustryConstruction:ILayer1EconomicEngine['completeIndustryConstruction'];
 removeConstructedIndustry:ILayer1EconomicEngine['removeConstructedIndustry'];
 getIndustryAccounts:ILayer1EconomicEngine['getIndustryAccounts'];
 getIndustryProduction:ILayer1EconomicEngine['getIndustryProduction'];
 getIndustryProductionHistory:ILayer1EconomicEngine['getIndustryProductionHistory'];
 startIndustryBatch:ILayer1EconomicEngine['startIndustryBatch'];
 completeIndustryBatch:ILayer1EconomicEngine['completeIndustryBatch'];
 advanceIndustryProduction:ILayer1EconomicEngine['advanceIndustryProduction'];
 getIndustryProcurement:ILayer1EconomicEngine['getIndustryProcurement'];
 advanceIndustryProcurement:ILayer1EconomicEngine['advanceIndustryProcurement'];
 reviewIndustryProcurement:ILayer1EconomicEngine['reviewIndustryProcurement'];
 purchaseInfrastructure(portId:string,cost:Record<string,number>,options?:{withdrawAutomaticOffers?:boolean;commit?:()=>void;rollback?:()=>void;afterDeduction?:(commodityId:string)=>void}):Result<boolean,'INVALID_CONSTRUCTION'|'NUMERIC_OVERFLOW'|'INSUFFICIENT_FUNDS'|'INSUFFICIENT_MATERIALS'>;
 configureIndustries(instances:{port_id:string;industry_id:string;instance_id?:string;initial_gold?:number;count?:number}[]):void;
 constructor(options?:EngineOptions);
 readonly timestamp_tick:number;
 readonly commodityIds:CommodityID[];
 readonly commodityRegistry:Registry<CommodityDefinition>;
 marketListenerErrors:unknown[];
 registerPort(port:PortInput):void;
 addStockpile(port:string,id:CommodityID,input:StockpileInput):Readonly<Stockpile>;
 getPortIds():string[];
 getMarketSnapshot(port:string):Readonly<MarketChange>;
 subscribeMarkets(listener:(event:Readonly<MarketChange>)=>void):()=>void;
 getPortTaxRate(port_id:PortID):number;
 allocateSupplies:ILayer1EconomicEngine['allocateSupplies'];
 getPortSupplies:ILayer1EconomicEngine['getPortSupplies'];
 depositCargo(port_id:PortID,commodity_id:CommodityID,quantity:number,context?:{ownerAccountId:string;sourceLocation:string;recipientAccountId?:string}):Result<number,TransactionError>;
 transferStock(origin_id:PortID,destination_id:PortID,commodity_id:CommodityID,quantity:number):Result<number,TransactionError>;
 quotePurchase(port_id:PortID,commodity_id:CommodityID,quantity:number):Result<Readonly<PurchaseQuote>,TransactionError>;
 executePurchaseQuote(quote:PurchaseQuote,quantity:number,context?:TradeContext):Result<TradeResult,TransactionError>;
 executeTransaction:ILayer1EconomicEngine['executeTransaction'];
 requestMaterialReservation:ILayer1EconomicEngine['requestMaterialReservation'];
 cancelMaterialReservation:ILayer1EconomicEngine['cancelMaterialReservation'];
 applyStockpileModifier:ILayer1EconomicEngine['applyStockpileModifier'];
 modifyTreasuryBalance:ILayer1EconomicEngine['modifyTreasuryBalance'];
 getPortStockpile:ILayer1EconomicEngine['getPortStockpile'];
 getFactionTreasury:ILayer1EconomicEngine['getFactionTreasury'];
 getMaterialReservation(id:string):Readonly<MaterialReservation>;
 tick():{timestamp_tick:number;events:readonly Readonly<EconomicEventSignal>[];listener_errors:unknown[]};
}
