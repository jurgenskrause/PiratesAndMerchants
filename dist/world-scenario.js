import {configurationRegistry} from './configuration-registry.js?v=babbc3d3950e';

export const WORLD_SCENARIOS=Object.freeze({NORMAL:'normal',LEGACY_BENCHMARK:'legacy_benchmark'});
export function configurationForScenario(scenario,selections={},revision=0){
 if(scenario===WORLD_SCENARIOS.NORMAL)return configurationRegistry.resolve(selections,{scope:'world',revision});
 if(scenario===WORLD_SCENARIOS.LEGACY_BENCHMARK)return configurationRegistry.resolve({}, {scope:'world',revision:0});
 throw TypeError('Unknown world scenario: '+scenario);
}
export function validateWorldScenario(world,{expected=null}={}){
 const scenario=world.scenario??WORLD_SCENARIOS.NORMAL;
 if(!Object.values(WORLD_SCENARIOS).includes(scenario)||expected&&scenario!==expected)throw TypeError('World scenario mismatch');
 const snapshot=configurationRegistry.reconstruct(world.configuration);
 if(snapshot.scope!=='world')throw TypeError('World configuration snapshot required');
 if(scenario===WORLD_SCENARIOS.LEGACY_BENCHMARK){
  const fixed=configurationForScenario(scenario);
  if(snapshot.revision!==0||configurationRegistry.serialize(snapshot)!==configurationRegistry.serialize(fixed))throw TypeError('Benchmark requires the fixed legacy configuration profile');
 }
 return Object.freeze({scenario,snapshot});
}
