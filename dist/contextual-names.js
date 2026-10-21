import {factionDefinition,namingRegistry} from './simulation-registry.js?v=babbc3d3950e';
import {hashSeed,random} from './world.js?v=babbc3d3950e';
// Stateless seeded selection: no global counters and no fallback to another faction.
export function contextualName(faction,category,seed,{military=false}={}){
 const definition=factionDefinition(faction);if(!definition)throw RangeError('Unknown naming faction: '+faction);
 const bank=namingRegistry.get(definition.naming_bank_ref),rng=random(hashSeed(String(seed))),pick=values=>values[Math.floor(rng()*values.length)];
 if(category==='captains'||category==='governors')return pick(bank[category].first_names)+' '+pick(bank[category].last_names);
 if(category==='ports')return pick(bank.ports.prefixes)+pick(bank.ports.roots);
 if(category==='islands')return pick(bank.islands);
 if(category==='ships')return pick(bank.ships[military?'military':'merchant']);
 throw RangeError('Unknown name category: '+category);
}
