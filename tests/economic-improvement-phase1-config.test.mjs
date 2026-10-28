import test from 'node:test';
import assert from 'node:assert/strict';
import {configurationRegistry,CONFIGURATION_FORMAT_VERSION} from '../dist/configuration-registry.js';
import {loadCatalogs} from '../dist/catalog-loader.js';
import {openingConfigurationValidator} from '../dist/opening-configuration-validator.js';

const resolve=values=>configurationRegistry.resolve(values,{scope:'world',revision:7});

test('opening defaults round-trip in a revisioned world snapshot and remain opt-in',()=>{
 const snapshot=resolve({});assert.equal(snapshot.format_version,CONFIGURATION_FORMAT_VERSION);
 assert.equal(snapshot.revision,7);assert.equal(snapshot.values['opening.enabled'],false);
 assert.equal(snapshot.values['opening.british_enabled'],true);
 assert.equal(snapshot.values['opening.spanish_enabled'],true);
 assert.equal(snapshot.values['opening.crown_warship_class'],'FIRST_RATE');
 const copy=configurationRegistry.deserialize(configurationRegistry.serialize(snapshot));
 assert.deepEqual(copy,snapshot);assert.ok(Object.isFrozen(copy.values));
});

test('participant selection requires two national factions even if Pirates are selected',()=>{
 assert.throws(()=>resolve({'opening.spanish_enabled':false,'opening.pirates_enabled':true}),/Select at least two national factions/);
 assert.doesNotThrow(()=>resolve({'opening.british_enabled':false,'opening.french_enabled':true}));
});

test('unknown IDs, negative supplies and inconsistent distances or shipyard gates are rejected',()=>{
 assert.throws(()=>resolve({'opening.small_merchant_class':'UNKNOWN'}),/not an allowed choice/);
 assert.throws(()=>resolve({'opening.small_dock_type':'missing'}),/not an allowed choice/);
 assert.throws(()=>resolve({'opening.bootstrap_wood':-1}),/outside/);
 assert.throws(()=>resolve({'opening.anchor_preferred_coast_distance':1}),/Anchorage minimum/);
 assert.throws(()=>resolve({'opening.shipyard_large_population':50}),/Shipyard population thresholds/);
});

test('new opening refuses to activate before its foundational industry and pirate hull exist',async()=>{
 assert.throws(()=>resolve({'opening.enabled':true}),/sawmill industry is not registered/);
 const {catalog}=await loadCatalogs();
 const values=resolve({}).values;
 const issues=openingConfigurationValidator(catalog).validate({...values,'opening.enabled':true,'opening.pirates_enabled':true});
 assert.ok(issues.some(issue=>issue.message.includes('Unknown vessel class CORSAIR')));
});

test('catalog-backed berth validation rejects a class if its dock no longer fits',async()=>{
 const {catalog}=await loadCatalogs();
 const altered=structuredClone(catalog),schooner=altered.vessels.find(v=>v.id==='SCHOONER');
 schooner.required_berth_size='ExtraLarge';
 const issues=openingConfigurationValidator(altered).validate(resolve({}).values);
 assert.ok(issues.some(issue=>issue.message.includes('SCHOONER cannot berth at small_pier')));
});
