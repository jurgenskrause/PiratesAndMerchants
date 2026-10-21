import {createConfigurationSession,configurationRegistry} from './configuration-registry.js?v=babbc3d3950e';
import {compileWorldConfiguration} from './compiled-configuration.js?v=babbc3d3950e';
// Pure clock/orchestration. Scheduling, snapshots, DOM and Pixi belong to adapters.
export class SimulationRuntime{
 constructor(session,{configurationOverrides,configurationRevision=0,economicTickSeconds}={}){
  if(session.settings&&configurationOverrides!==undefined)throw TypeError('Configure the session before initializing its runtime');
  const configuration=configurationOverrides===undefined&&session.world?.configuration
   ? Object.freeze({application:configurationRegistry.resolve({}, {scope:'application',revision:session.world.configuration.revision}),world:configurationRegistry.reconstruct(session.world.configuration)})
   : createConfigurationSession(configurationOverrides,{revision:configurationRevision});
  this._configuration=configuration;Object.defineProperty(this,'configuration',{get:()=>this._configuration,enumerable:true});this.configurationController=null;this.stepCount=0;
  this.settings=session.settings??compileWorldConfiguration(configuration.world);
  if(economicTickSeconds!==undefined&&session.settings&&economicTickSeconds!==this.settings.clock.economicTickSeconds)throw TypeError('Economic clock must match the configured session');
  economicTickSeconds??=this.settings.clock.economicTickSeconds;
  if(!Number.isFinite(economicTickSeconds)||economicTickSeconds<=0)throw RangeError('Economic interval');
  this.session=session;this.economicTickSeconds=economicTickSeconds;this.time=0;this.economicTime=0;
 }
 step(dt=this.settings.clock.physicsTickSeconds){
  if(!Number.isFinite(dt)||dt<=0||dt>1)throw RangeError('Simulation step');
  const controller=this.configurationController;if(controller?.pending)controller.activate('next_tick',{tick:this.stepCount+1,time:this.time});this.stepCount++;this.time+=dt;this.economicTime+=dt;
  while(this.economicTime>=this.economicTickSeconds-1e-9){this.session.economy?.tick();this.economicTime=Math.max(0,this.economicTime-this.economicTickSeconds);}
  this.session.logistics?.tick(dt);return this.time;
 }
}
