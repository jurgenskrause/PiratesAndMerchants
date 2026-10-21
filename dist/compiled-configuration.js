import {toMicrogold} from './money.js?v=babbc3d3950e';
import {configurationRegistry,developerSelectedValues} from './configuration-registry.js?v=babbc3d3950e';
// Fixed calibration in hex/world units, independent of tunable ship speed.
const REFERENCE_SHIP_SPEED=1/Math.sqrt(3);
const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
// String-key resolution is confined to compilation. Consumers receive fixed shapes.
export function compileWorldConfiguration(input){
 const snapshot=configurationRegistry.reconstruct(input);if(snapshot.scope!=='world')throw TypeError('World snapshot required');const v=snapshot.values,revision=snapshot.revision;
 const clock={revision,secondsPerDay:v['simulation.seconds_per_day'],economicTickSeconds:v['simulation.economic_tick_seconds'],physicsTickSeconds:v['simulation.physics_tick_seconds']};
 const investment=Object.fromEntries(Object.entries(v).filter(([k])=>k.startsWith('investment.')&&!k.startsWith('investment.priority.')).map(([k,value])=>[k.slice(11),value]));investment.minimum_reserve_microgold=toMicrogold(investment.minimum_reserve_gold);investment.minimum_surplus_microgold=toMicrogold(investment.minimum_surplus_gold);delete investment.minimum_reserve_gold;delete investment.minimum_surplus_gold;investment.priorities=Object.fromEntries(Object.entries(v).filter(([k])=>k.startsWith('investment.priority.')).map(([k,value])=>[k.slice(20),value]));
 const industryGeneration={secondaryTargets:Object.fromEntries([32,64,128,256,512].map(size=>[size,v['industries.starting_secondary_'+size]]))};
 const economy={revision,manufacturingWorkerShare:v['economy.manufacturing_worker_share'],portStartingGold:v['economy.port_starting_gold'],industryStartingGold:v['economy.industry_starting_gold'],dailyWagePerCrew:v['economy.daily_wage_per_crew'],ticksPerDay:clock.secondsPerDay/clock.economicTickSeconds,secondsPerDay:clock.secondsPerDay,scarcityRatio:v['economy.scarcity_ratio'],surplusRatio:v['economy.surplus_ratio'],defaultElasticity:v['economy.default_elasticity']};
 const scaling={revision,referenceDistance:v['scaling.reference_distance'],mapScaleFactor:v['scaling.map_factor'],standardShipSpeed:v['scaling.standard_ship_speed'],referenceShipSpeed:REFERENCE_SHIP_SPEED,safetyMarginFactor:v['scaling.safety_margin'],baseUrgencyTicks:v['procurement.base_urgency_seconds'],baseLedgerAgeTicks:v['ledger.base_max_age_seconds'],baseQueueReviewTicks:v['logistics.base_queue_review_seconds'],baseJobReviewTicks:v['merchant.base_job_review_seconds'],economicTickSeconds:clock.economicTickSeconds};
 const roads={revision,radius:v['roads.feeder_radius'],mountainHeight:v['roads.mountain_height'],maxNodes:v['roads.max_search_nodes']};
 const merchant={revision,startingWallet:v['merchant.starting_wallet'],minimumProfit:v['merchant.minimum_profit'],distanceCost:v['merchant.distance_cost'],cargoHandlingRate:v['logistics.cargo_handling_rate'],turnaroundWaitSeconds:v['merchant.turnaround_wait_seconds'],explorationIntervalVoyages:v['merchant.exploration_interval_voyages']};
 const fleet={revision,maxMerchants:v['fleet.max_test_merchants'],patrolQuotas:[{vesselClass:'FRIGATE',per:v['fleet.frigate_merchants_per_patrol']},{vesselClass:'WAR_GALLEON',per:v['fleet.war_galleon_merchants_per_patrol']},{vesselClass:'FIRST_RATE',per:v['fleet.first_rate_merchants_per_patrol']}]};
 const threat={revision,maxThreat:v['threat.max_threat'],decayRate:v['threat.decay_rate'],frequencyHalfLife:v['threat.frequency_half_life'],frequencyRetention:Math.exp(-Math.LN2/v['threat.frequency_half_life']),recencyWindow:v['threat.recency_window'],maxPatrolAge:v['threat.max_patrol_age']};
 const navigation={revision,windPersistence:v['navigation.wind_persistence'],threatThreshold:v['navigation.threat_threshold'],windShiftRadians:v['navigation.wind_shift_degrees']*Math.PI/180};
 // Transitional public alias. Values are derived here, never stored in a second catalog.
 const global={id:'global',globalDailyWagePerCrew:economy.dailyWagePerCrew,...clock,...scaling,feederRoadRadius:roads.radius,roadMountainHeight:roads.mountainHeight,roadMaxSearchNodes:roads.maxNodes};
 const provisions={revision,refillSeconds:v['provisions.refill_seconds'],diversionImprovement:v['provisions.diversion_improvement']};
 return freeze({revision,clock,investment,industryGeneration,economy,merchant,fleet,scaling,roads,threat,navigation,provisions,global});
}
export function compileApplicationConfiguration(input){
 const snapshot=configurationRegistry.reconstruct(input);if(snapshot.scope!=='application')throw TypeError('Application snapshot required');const v=snapshot.values,revision=snapshot.revision;
 const rendering={revision,industryIconPixels:v['rendering.industry_icon_pixels'],industryFadeStart:v['rendering.industry_icon_fade_start'],industryFadeRange:v['rendering.industry_icon_fade_end']-v['rendering.industry_icon_fade_start'],roadVisibilityStart:v['rendering.road_visibility_start'],roadVisibilityRange:v['rendering.road_visibility_end']-v['rendering.road_visibility_start'],roadDetailStart:v['rendering.road_detail_start'],roadDetailRange:v['rendering.road_detail_end']-v['rendering.road_detail_start'],buildingDetailStart:v['rendering.building_detail_start'],buildingDetailRange:v['rendering.building_detail_end']-v['rendering.building_detail_start']};return freeze({revision,rendering});
}
export const DEFAULT_SUBSYSTEM_SETTINGS=compileWorldConfiguration(configurationRegistry.resolve(developerSelectedValues));
export const DEFAULT_APPLICATION_SETTINGS=compileApplicationConfiguration(configurationRegistry.resolve(developerSelectedValues,{scope:'application'}));
const cache=new WeakMap();
export function settingsForWorld(world,{requireSnapshot=false}={}){
 if(!world?.configuration){if(requireSnapshot)throw TypeError('World configuration snapshot required');return DEFAULT_SUBSYSTEM_SETTINGS;}
 const immutable=Object.isFrozen(world.configuration)&&Object.isFrozen(world.configuration.values),cached=immutable?cache.get(world):null;if(cached?.snapshot===world.configuration)return cached.settings;
 const settings=compileWorldConfiguration(world.configuration);if(immutable)cache.set(world,{snapshot:world.configuration,settings});return settings;
}
