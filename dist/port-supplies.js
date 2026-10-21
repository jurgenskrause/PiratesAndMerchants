import {resolveIndustryTuning} from './industry-tuning.js?v=babbc3d3950e';
import {formatMarketDepth} from './market-depth.js?v=babbc3d3950e';
import {formatMoney} from './money.js?v=babbc3d3950e';
import {EconomicEngine,FACTIONS} from './economy.js?v=babbc3d3950e';

import {commodityRegistry,industryRegistry,settlementRegistry,runtimeFaction} from './simulation-registry.js?v=babbc3d3950e';
import {settingsForWorld} from './compiled-configuration.js?v=babbc3d3950e';
export const commodityName=id=>id.toLowerCase().replaceAll('_',' ').replace(/^./,c=>c.toUpperCase());
export const supplyUnits=n=>n.toLocaleString('en-GB',{maximumFractionDigits:1});
export function createPortEconomy(world,{registry=commodityRegistry}={}){
 const industries=resolveIndustryTuning(world.industryDefinitions??[]);
 const settings=settingsForWorld(world).economy,commodities=registry.ids().filter(id=>registry.get(id).market_enabled!==false);
 const byPort=new Map(),factories=[];for(const [industryIndex,i] of (world.industries??[]).entries()){if(!industries.has(i.type)||!i.portId)continue;const definition=industries.get(i.type);if(definition.inputs.length){factories.push({port_id:i.portId,industry_id:i.type,instance_id:i.id??`${i.portId}|${i.type}|${i.tileIndex??industryIndex}`,count:1});continue;}const production=byPort.get(i.portId)??{};for(const output of definition.outputs)if(registry.has(output.commodity_id))production[output.commodity_id]=(production[output.commodity_id]??0)+output.quantity_per_tick;byPort.set(i.portId,production);}
 const ports=world.ports.map((p,index)=>{
  const production=byPort.get(p.id)??{},profile=settlementRegistry.get(p.settlementType??'port');
  const specialties=commodities.filter(c=>registry.get(c).settlement_supply_enabled!==false),specialty=specialties[index%specialties.length],mult=p.initialStockMultipliers??{trade:1,consumption:1};
  return {id:p.id,name:p.name,owner_faction:runtimeFaction(p.faction),tax_rate:0,stockpiles:Object.fromEntries(commodities.map((c,j)=>{const settlementSupply=registry.get(c).settlement_supply_enabled!==false;return [c,{
   trade_stock:settlementSupply?(c===specialty||production[c]?profile.specialty_stock:profile.ordinary_stock+(index+j)%profile.ordinary_stock_variants*profile.ordinary_stock_step)*mult.trade:0,consumption_stock:settlementSupply?profile.consumption_stock*mult.consumption:0,consumption_target:settlementSupply?profile.consumption_target*mult.consumption:0,
   target_capacity:profile.trade_capacity*mult.trade,base_price:registry.get(c).basePrice,base_production_rate:production[c]??0,base_consumption_rate:settlementSupply?profile.base_consumption_rate:0
  }];}))};
 });
 return new EconomicEngine({ports,industryRegistry:industries,industries:factories,commodityRegistry:registry,settings,ticksPerDay:settings.ticksPerDay,treasuries:FACTIONS.map(faction_id=>({faction_id,balance_gold:settlementRegistry.get('port').treasury_balance}))});
}
export function appendPortSupplies(panel,supplies){
 const title=document.createElement('p');title.textContent='Current supplies';title.className='supplies-title';panel.append(title);
 const table=document.createElement('table');table.className='supplies-table';const head=document.createElement('tr');
 for(const label of ['Goods','Consumption','Physical market stock','Supply asks: quantity @ price (seller)','Funded bids: quantity @ price (buyer)']){const th=document.createElement('th');th.textContent=label;head.append(th);}table.append(head);
 for(const s of supplies){const row=document.createElement('tr');for(const value of [commodityName(s.commodity_id),supplyUnits(s.consumption_stock),supplyUnits(s.trade_stock),formatMarketDepth(s.offers,'ask'),formatMarketDepth(s.purchase_orders,'bid')]){const td=document.createElement('td');td.textContent=value;row.append(td);}table.append(row);}panel.append(table);
 const note=document.createElement('small');note.textContent='Trade includes reserved materials and paid pickups. Funded demand is finite; reports do not reserve a delivery. Consumption stores are protected from sale.';panel.append(note);
}
