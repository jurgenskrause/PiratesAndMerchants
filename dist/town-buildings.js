import {townBuildingRegistry} from './simulation-registry.js?v=babbc3d3950e';
export function buildingCost(type,{renovation=false}={}){const b=townBuildingRegistry.get(type),scale=renovation?b.renovation_multiplier:1;return Object.fromEntries(Object.entries(b.build_cost).map(([id,quantity])=>[id,quantity*scale]));}
// Same atomic transaction used by docks. No production or prosperity side effects.
export function purchaseTownBuilding(economy,portId,type,options){const cost=buildingCost(type,options);return economy.purchaseInfrastructure(portId,cost,{withdrawAutomaticOffers:true});}
export function townHousingCapacity(buildings){return buildings.reduce((total,b)=>total+(b.derelict?0:townBuildingRegistry.get(b.buildingTypeId).housing_capacity),0);}
