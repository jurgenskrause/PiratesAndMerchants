import test from 'node:test';
import assert from 'node:assert/strict';
import {configurationRegistry,CONFIGURATION_FORMAT_VERSION} from '../dist/configuration-registry.js';
import {compileWorldConfiguration,settingsForWorld} from '../dist/compiled-configuration.js';
import {configurationForScenario,validateWorldScenario,WORLD_SCENARIOS} from '../dist/world-scenario.js';
import {ConfigurationTransaction} from '../dist/configuration-transaction.js';
import {generateWorld} from '../dist/world.js';
import {generatePorts} from '../dist/ports.js';
import {generateIndustries} from '../dist/industries.js';

test('compiled opening retains selected classes, funds, participants and immutable revision',()=>{
 const snapshot=configurationForScenario(WORLD_SCENARIOS.NORMAL,{'opening.french_enabled':true,'opening.crown_merchant_class_a':'SCHOONER','opening.bootstrap_wood':300},9);
 const world={configuration:snapshot},compiled=settingsForWorld(world,{requireSnapshot:true});
 assert.equal(compiled.revision,9);assert.equal(compiled.opening.revision,9);
 assert.equal(compiled.opening.participants.french,true);
 assert.deepEqual(compiled.opening.fleet.crownMerchantClasses,['SCHOONER','SCHOONER']);
 assert.equal(compiled.opening.funding.bootstrapWood,300);
 assert.equal(compiled.opening.docks.crown,'deep_water_quay');
 assert.equal(compiled.opening.shipyards.large.population,600);
 assert.equal(compiled.opening.anchorage.minDepth,6);
 assert.strictEqual(settingsForWorld(world,{requireSnapshot:true}),compiled);
 assert.ok(Object.isFrozen(compiled.opening.fleet.crownMerchantClasses));
 assert.throws(()=>{compiled.opening.funding.bootstrapWood=0;},TypeError);
 assert.deepEqual(compileWorldConfiguration(configurationRegistry.deserialize(configurationRegistry.serialize(snapshot))).opening,compiled.opening);
});

test('legacy benchmark profile ignores developer selections, rejects tampering and stays revision zero',()=>{
 const benchmark=configurationForScenario(WORLD_SCENARIOS.LEGACY_BENCHMARK,{'opening.french_enabled':true,'economy.port_starting_gold':10000},27);
 assert.equal(benchmark.revision,0);assert.equal(benchmark.values['opening.french_enabled'],false);
 const verified=validateWorldScenario({scenario:WORLD_SCENARIOS.LEGACY_BENCHMARK,configuration:benchmark});
 assert.equal(verified.scenario,WORLD_SCENARIOS.LEGACY_BENCHMARK);
 assert.throws(()=>validateWorldScenario({scenario:WORLD_SCENARIOS.LEGACY_BENCHMARK,configuration:configurationForScenario(WORLD_SCENARIOS.NORMAL,{'opening.french_enabled':true},2)}),/fixed legacy configuration/);
 assert.throws(()=>validateWorldScenario({scenario:'bad',configuration:benchmark}),/scenario mismatch/);
 assert.throws(()=>validateWorldScenario({scenario:WORLD_SCENARIOS.NORMAL,configuration:benchmark},{expected:WORLD_SCENARIOS.LEGACY_BENCHMARK}),/scenario mismatch/);
});

test('format-1 snapshots fill only newly introduced opening keys without changing their revision',()=>{
 const current=configurationForScenario(WORLD_SCENARIOS.NORMAL,{},3),legacy={...current,format_version:1,values:Object.fromEntries(Object.entries(current.values).filter(([id])=>!id.startsWith('opening.')))};
 const upgraded=configurationRegistry.reconstruct(legacy);
 assert.equal(upgraded.format_version,CONFIGURATION_FORMAT_VERSION);
 assert.equal(upgraded.revision,3);assert.equal(upgraded.values['opening.enabled'],false);
 assert.equal(upgraded.values['opening.british_enabled'],true);
 assert.throws(()=>configurationRegistry.reconstruct({...current,values:legacy.values}),/every key/);
 const missing={...legacy,values:{...legacy.values}};delete missing.values['economy.port_starting_gold'];
 assert.throws(()=>configurationRegistry.reconstruct(missing),/every key/);
});

test('opening edit waits for world regeneration and stale revision cannot activate it',()=>{
 const messages=[],snapshot=configurationForScenario(WORLD_SCENARIOS.NORMAL);
 const transaction=new ConfigurationTransaction({snapshot,sessionId:'seeded-session',notify:m=>messages.push(m)});
 const request={requestId:1,sessionId:'seeded-session',baseRevision:0,edits:{'opening.french_enabled':true}};
 const pending=transaction.request(request);
 assert.equal(pending.status,'restart-required');assert.equal(pending.activationBoundary,'new_world');
 assert.equal(transaction.active.revision,0);assert.equal(transaction.selected.revision,1);
 assert.equal(transaction.activate('next_tick'),null);
 const stale=transaction.request({...request,requestId:2,baseRevision:8});
 assert.equal(stale.status,'rejected');assert.match(stale.diagnostics[0].message,/Stale base revision/);
 transaction.cancel();assert.equal(transaction.selected.revision,0);
});

test('real generator handler carries the validated scenario and snapshot unchanged',async()=>{
 const messages=[];globalThis.self={postMessage:message=>messages.push(message)};
 await import('../dist/generator.worker.js');
 const config={size:32,seed:'BENCHMARK-COAST-01',density:48,scale:50,roughness:55,moisture:60,mountains:35,industryDensity:50};
 const configuration=configurationForScenario(WORLD_SCENARIOS.LEGACY_BENCHMARK);
 await self.onmessage({data:{id:1,config,configuration,scenario:WORLD_SCENARIOS.LEGACY_BENCHMARK}});
 assert.equal(messages[0].error,undefined);
 assert.equal(messages[0].world.scenario,WORLD_SCENARIOS.LEGACY_BENCHMARK);
 assert.equal(messages[0].world.configuration.revision,0);
 assert.deepEqual(messages[0].world.configuration.values,configuration.values);
 await self.onmessage({data:{id:2,config,configuration:configurationForScenario(WORLD_SCENARIOS.NORMAL,{'opening.french_enabled':true},1),scenario:WORLD_SCENARIOS.LEGACY_BENCHMARK}});
 assert.match(messages[1].error,/fixed legacy configuration/);
 delete globalThis.self;
});

test('real simulation worker retains the profile and revision and rejects benchmark edits',async()=>{
 const config={size:128,seed:'BENCHMARK-COAST-01',density:48,scale:50,roughness:55,moisture:60,mountains:35,industryDensity:50};
 const world=generateWorld(config);world.ports=generatePorts(world);world.industries=generateIndustries(world);
 const messages=[],originalInterval=globalThis.setInterval;
 globalThis.setInterval=()=>1;
 globalThis.self={postMessage:message=>messages.push(message)};
 try{
  await import('../dist/merchant.worker.js');
  const start=(scenario,configuration)=>self.onmessage({data:{type:'start',world:{...world,scenario,configuration},wind:{x:0,y:-1},field:null,basePortId:world.ports[0].id,density:0,simulationSpeed:1,player:null}});
  start(WORLD_SCENARIOS.LEGACY_BENCHMARK,configurationForScenario(WORLD_SCENARIOS.LEGACY_BENCHMARK));
  assert.equal(messages.at(-1).type,'state');assert.equal(messages.at(-1).configurationRevision,0);
  const sessionId=messages.at(-1).sessionId;
  self.onmessage({data:{type:'configuration-request',requestId:1,sessionId,baseRevision:0,edits:{'opening.french_enabled':true}}});
  assert.equal(messages.at(-1).status,'rejected');assert.match(messages.at(-1).diagnostics[0].message,/fixed benchmark profile/);
  start(WORLD_SCENARIOS.NORMAL,configurationForScenario(WORLD_SCENARIOS.NORMAL,{'opening.french_enabled':true},3));
  assert.equal(messages.at(-1).type,'state');assert.equal(messages.at(-1).configurationRevision,3);
  self.onmessage({data:{type:'configuration-request',requestId:2,sessionId:messages.at(-1).sessionId,baseRevision:2,edits:{'opening.french_enabled':false}}});
  assert.equal(messages.at(-1).status,'rejected');assert.match(messages.at(-1).diagnostics[0].message,/Stale base revision/);
 }finally{globalThis.setInterval=originalInterval;delete globalThis.self;}
});
