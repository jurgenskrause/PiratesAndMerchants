import {configurationRegistry} from './configuration-registry.js?v=babbc3d3950e';
import {buildShore} from './shore.js?v=babbc3d3950e';
import {generateWorld} from './world.js?v=babbc3d3950e';
import {generatePorts} from './ports.js?v=babbc3d3950e';
import {generateIndustries} from './industries.js?v=babbc3d3950e';
self.onmessage=async({data:{id,config,configuration}})=>{try{if(!configuration)throw TypeError("World configuration snapshot required");const snapshot=configurationRegistry.reconstruct(configuration);if(snapshot.scope!=="world")throw TypeError("World snapshot required");const world=generateWorld(config);world.configuration=snapshot;world.shore=buildShore(world);world.ports=generatePorts(world);world.industries=generateIndustries(world);self.postMessage({id,world},[world.depth.buffer,world.oceanLevels.buffer,world.shore.data.buffer,world.h.buffer,world.moisture.buffer,world.rock.buffer,world.biomes.buffer,world.data.buffer]);}catch(error){self.postMessage({id,error:error.message});}};
