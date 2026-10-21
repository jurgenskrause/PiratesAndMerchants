import {marketDepth} from './market-depth.js?v=babbc3d3950e';
import {factionDefinition} from './simulation-registry.js?v=babbc3d3950e';
import {FACTIONS} from './economy.js?v=babbc3d3950e';
import {commodityRegistry,vesselRegistry} from './simulation-registry.js?v=babbc3d3950e';
import {dailyShipOverhead} from './simulation-settings.js?v=babbc3d3950e';
export const VESSEL_ROLES=Object.freeze(Object.fromEntries(vesselRegistry.values().map(v=>[v.id,Object.freeze({...v,dailyMaintenance:dailyShipOverhead(v.baseHullMaintenance,v.defaultCrew)})])));
export const COMMODITY_SPECS=Object.freeze(Object.fromEntries(commodityRegistry.values().map(v=>[v.id,v])));
const marketReport=s=>{const offers=s.offers??[],orders=s.purchase_orders??[];return {price:s.current_price,...marketDepth(offers,orders),offers:structuredClone(offers),orders:structuredClone(orders)};};
export class PriceLedger {
 constructor({maxAge=600}={}){if(!Number.isInteger(maxAge)||maxAge<1)throw RangeError('Ledger maxAge');this.maxAge=maxAge;this.entries=new Map();}
 prune(tick){for(const [id,e] of this.entries)if(tick-e.tick>=this.maxAge)this.entries.delete(id);}
 observe(port,economy,tick){this.entries.set(port.id,{portId:port.id,portName:port.name??port.id,faction:port.owner_faction,tick,originPortId:port.id,source:'LOCAL_MARKET',marketRevision:economy.getMarketRevision?.(port.id)??0,tax:0,prices:Object.fromEntries(economy.getPortSupplies(port.id).map(s=>[s.commodity_id,marketReport(s)]))});}
 recordMarketEvent(event,tick){const previous=this.entries.get(event.portId),prices={...(previous?.prices??{})};for(const s of event.stocks)prices[s.commodity_id]=marketReport(s);this.entries.set(event.portId,{portId:event.portId,portName:event.name,faction:event.faction,tick,originPortId:event.portId,source:'LOCAL_MARKET',marketRevision:event.revision,tax:0,prices});}
 merge(other,tick){this.prune(tick);for(const [id,e] of other.entries)if(e.tick<=tick&&tick-e.tick<other.maxAge&&tick-e.tick<this.maxAge&&(!this.entries.has(id)||(e.tick>this.entries.get(id).tick||e.tick===this.entries.get(id).tick&&(e.marketRevision??0)>(this.entries.get(id).marketRevision??0))))this.entries.set(id,{...structuredClone(e),tax:0});}
 sync(portLedger,port,economy,tick){this.prune(tick);portLedger.observe(port,economy,tick);portLedger.merge(this,tick);this.merge(portLedger,tick);}
 knowledge(tick){return [...this.entries.values()].filter(e=>tick-e.tick<this.maxAge).map(e=>({...structuredClone(e),tax:0,age:Math.max(0,tick-e.tick),confidence:Math.min(1,Math.max(0,1-(tick-e.tick)/this.maxAge))}));}
}
export class Diplomacy {
 constructor(){this.version=0;this.relations=new Map();for(const a of FACTIONS)for(const b of FACTIONS)this.relations.set(`${a}:${b}`,{standing:factionDefinition(a).base_relations[b]??0,war:a!==b&&(factionDefinition(a).base_relations[b]??0)<=-50,alliance:a===b||(factionDefinition(a).base_relations[b]??0)>=50,embargo:false});}
 set(a,b,{standing=0,war=false,alliance=false,embargo=false}){if(!FACTIONS.includes(a)||!FACTIONS.includes(b)||a===b||!Number.isFinite(standing)||standing<-100||standing>100||war&&alliance)throw RangeError('Diplomatic relationship');const r={standing,war:!!war,alliance:!!alliance,embargo:!!embargo};this.relations.set(`${a}:${b}`,r);this.relations.set(`${b}:${a}`,{...r});this.version++;}
 get(a,b){return this.relations.get(`${a}:${b}`)??{standing:-100,war:true,alliance:false,embargo:true};}
 isHostile(a,b){const r=this.get(a,b);return r.war||r.standing<0;}
 isFriendly(a,b){return a===b||this.get(a,b).alliance;}
 canTrade(a,b){return !this.isHostile(a,b)&&!this.get(a,b).embargo;}
 canEnter(a,b){return !this.isHostile(a,b);}
 snapshot(){return FACTIONS.map(a=>({faction:a,relations:FACTIONS.map(b=>({faction:b,...this.get(a,b)}))}));}
}
