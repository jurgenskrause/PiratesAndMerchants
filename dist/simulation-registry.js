import {compileManufacturingDefinition} from './industry-contract.js?v=babbc3d3950e';
import {DEFAULT_SUBSYSTEM_SETTINGS} from './compiled-configuration.js?v=babbc3d3950e';
import {loadCatalogs,validateSchema} from './catalog-loader.js?v=babbc3d3950e';
// Domain definitions contain identifiers and asset references, never renderer objects.
const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
export class Registry{
 #items=new Map(); #schema;
 constructor(definitions=[],schema=null){this.#schema=schema;for(const definition of definitions)this.register(definition);}
 register(definition){if(this.#schema)validateSchema(definition,this.#schema);if(!definition||typeof definition.id!=='string'||!definition.id||this.#items.has(definition.id))throw TypeError('Invalid or duplicate registry ID');const record=freeze(structuredClone(definition));this.#items.set(record.id,record);return record;}
 has(id){return this.#items.has(id);}
 get(id){const value=this.#items.get(id);if(!value)throw RangeError('Unknown registry ID: '+id);return value;}
 ids(){return [...this.#items.keys()];}
 values(){return [...this.#items.values()];}
}
const {catalog,schema}=await loadCatalogs();
const catalogRegistry=key=>new Registry(catalog[key],schema.properties[key].items);
export const commodityRegistry=catalogRegistry('commodities');
export const industryRegistry=catalogRegistry('industries');
export const manufacturingDefinitions=Object.freeze(industryRegistry.values().filter(d=>d.type==='SecondaryManufacturing').map(d=>compileManufacturingDefinition(d,commodityRegistry.ids())));
export const vesselRegistry=catalogRegistry('vessels');
export const assetRegistry=catalogRegistry('assets');
export const factionRegistry=catalogRegistry('factions');
export const namingRegistry=catalogRegistry('naming');
export const dockRegistry=catalogRegistry('docks');
export const colonyPresetRegistry=catalogRegistry('colony_presets');
export const townBuildingRegistry=catalogRegistry('town_buildings');
export const roadRegistry=catalogRegistry('roads');
export const settlementRegistry=catalogRegistry('settlements');
export const systemSettings=DEFAULT_SUBSYSTEM_SETTINGS.global;
export const runtimeFaction=id=>factionRegistry.values().find(f=>f.id===id||f.runtime_id===id)?.runtime_id;
export const factionDefinition=id=>factionRegistry.values().find(f=>f.id===id||f.runtime_id===id);
// Inject any loader (Pixi, fetch, tests). Concurrent loads share one promise; failures can retry.
export function createAssetLoader(load,registry=assetRegistry){const pending=new Map();return id=>{if(pending.has(id))return pending.get(id);const asset=registry.get(id),promise=Promise.resolve().then(()=>load(asset.url,asset)).catch(error=>{pending.delete(id);throw error;});pending.set(id,promise);return promise;};}
