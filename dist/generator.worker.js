import {buildShore} from './shore.js?v=babbc3d3950e';
import {generateWorld} from './world.js?v=babbc3d3950e';
import {generatePorts} from './ports.js?v=babbc3d3950e';
import {generateIndustries} from './industries.js?v=babbc3d3950e';
import {validateWorldScenario} from './world-scenario.js';
self.onmessage=async({data:{id,config,configuration,scenario='normal'}})=>{try{if(!configuration)throw TypeError("World configuration snapshot required");const validated=validateWorldScenario({scenario,configuration});const started=performance.now(),world=generateWorld(config);world.configuration=validated.snapshot;world.scenario=validated.scenario;world.shore=buildShore(world);world.ports=generatePorts(world);world.industries=generateIndustries(world);world.workerGenerationMs=performance.now()-started;self.postMessage({id,world},[world.depth.buffer,world.oceanLevels.buffer,world.shore.data.buffer,world.h.buffer,world.moisture.buffer,world.rock.buffer,world.biomes.buffer,world.data.buffer]);}catch(error){self.postMessage({id,error:error.message});}};
