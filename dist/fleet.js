import {assetRegistry,vesselRegistry} from './simulation-registry.js?v=babbc3d3950e';
// Gameplay tuning and upgrade ceilings. Cargo is an abstract hold unit.
export const SHIP_TYPES=Object.freeze(Object.fromEntries(vesselRegistry.values().map(v=>[v.type,v.physics])));
export class UpgradeLevel{
 #active=1;
 constructor(capacity){Object.defineProperty(this,'capacity',{value:capacity,enumerable:true});}
 get active(){return this.#active;}
 set active(value){if(!Number.isInteger(value)||value<1||value>this.capacity)throw RangeError(`Upgrade must be between 1 and ${this.capacity}`);this.#active=value;}
 toJSON(){return{capacity:this.capacity,active:this.active};}
}
export const SHIP_ART=Object.freeze(Object.fromEntries(vesselRegistry.values().map(v=>[v.type,Object.freeze({...v.graphics,url:assetRegistry.get(v.graphics.sprite_asset).url})])));
export function sailFrameWeights(type,stage){const record=vesselRegistry.values().find(v=>v.type===type);if(!record||!Number.isInteger(stage)||stage<0||stage>4)throw RangeError('Invalid sail stage');return [...record.graphics.sail_frame_weights[stage]];}
