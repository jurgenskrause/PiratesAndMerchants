import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {access} from 'node:fs/promises';
import {generateWorld, axialToWorld} from '../dist/world.js';
import {generatePorts} from '../dist/ports.js';
import {dockFootprint, compatibleDock} from '../dist/port-infrastructure.js';
import {dockRegistry} from '../dist/simulation-registry.js';
import {SHIP_TYPES} from '../dist/ships.js';
import {findShipSpawn, hullDepth} from '../dist/ships.js';
import {EconomicAccounts} from '../dist/economic-accounts.js';
import {configurationRegistry} from '../dist/configuration-registry.js';
import {loadCatalogs} from '../dist/catalog-loader.js';
import {catalog as browserCatalog,schema as browserSchema} from '../dist/data/catalog-bundle.js';

const config={size:128,seed:'BENCHMARK-COAST-01',density:48,scale:50,roughness:55,moisture:60,mountains:35,industryDensity:50};

test('seeded terrain and generated ports reproduce the same geography',()=>{
 const a=generateWorld(config),b=generateWorld(config);
 assert.deepEqual(a.h,b.h);assert.deepEqual(a.biomes,b.biomes);
 const portsA=generatePorts(a),portsB=generatePorts(b);
 assert.deepEqual(portsA.map(p=>[p.id,p.faction,p.docks.map(d=>d.dockTypeId)]),portsB.map(p=>[p.id,p.faction,p.docks.map(d=>d.dockTypeId)]));
 assert.notDeepEqual(generateWorld({...config,seed:'OTHER-COAST'}).h,a.h);
});

test('generated docks respect footprint and vessel size, with a safe offshore spawn',()=>{
 const world=generateWorld(config);world.ports=generatePorts(world);
 assert.ok(world.ports.length>0,'reference map must have a port');
 for(const port of world.ports)for(const dock of port.docks){
  assert.ok(dockFootprint(world,dock.land,dock.water,dock.dockTypeId).length);
  assert.ok(dockRegistry.has(dock.dockTypeId));
 }
 const small={dockTypeId:'small_pier'},large={dockTypeId:'deep_water_quay'};
 assert.equal(compatibleDock(small,SHIP_TYPES.schooner),true);
 assert.equal(compatibleDock(small,SHIP_TYPES.man_of_war),false);
 assert.equal(compatibleDock(large,SHIP_TYPES.man_of_war),true);
 const port=world.ports[0],spawn=findShipSpawn(world,port.dockPosition,0,'schooner');
 assert.ok(spawn,'reference port must support a spawn');
 assert.ok(hullDepth(world,spawn.x,spawn.y,spawn.heading,SHIP_TYPES.schooner)>0);
 assert.deepEqual(axialToWorld(port.water.q,port.water.r),port.docks[0].dockPosition);
});

test('funded transfers preserve total microgold and failed transfers do not mutate balances',()=>{
 const accounts=new EconomicAccounts();accounts.create('faction:a','faction','a',{balance:100});accounts.create('faction:b','faction','b',{balance:25});
 accounts.sealInitialization();const before=accounts.snapshot();
 accounts.transfer('faction:a','faction:b',17.25,{id:'opening-trade'});
 assert.equal(accounts.totalUnits(),before.totalUnits);
 assert.equal(accounts.inspect('faction:a').balance,82.75);
 assert.equal(accounts.inspect('faction:b').balance,42.25);
 assert.throws(()=>accounts.transfer('faction:a','faction:b',1000));
 assert.equal(accounts.totalUnits(),before.totalUnits);
 assert.equal(accounts.inspect('faction:a').balance,82.75);
});

test('fixed benchmark routes and recipes remain intact',async()=>{
 const [app,html]=await Promise.all([readFile(new URL('../dist/app.js',import.meta.url),'utf8'),readFile(new URL('../dist/index.html',import.meta.url),'utf8')]);
 for(const kind of ['world','simulation'])assert.match(app,new RegExp(`runBenchmark\\('${kind}'\\)`));
 assert.match(app,/kind==='world'\?\[32,128,512\]:\[512\]/);
 assert.match(app,/merchantTraffic\.setDensity\(50\)/);
 assert.match(app,/for\(const speed of \[1,20\]\)/);
 assert.match(app,/simulationStarted\+\(speed===1\?30000:60000\)/);
 for(const id of ['dev-world-benchmark','dev-simulation-benchmark'])assert.match(html,new RegExp(`id="${id}"`));
 assert.equal(configurationRegistry.resolve({}, {scope:'world'}).revision,0);
});

test('source catalogs match the browser bundle and all referenced art is present',async()=>{
 const {catalog,schema}=await loadCatalogs();
 assert.deepEqual(catalog,browserCatalog);assert.deepEqual(schema,browserSchema);
 await Promise.all(catalog.assets.map(asset=>access(new URL(`../dist/${asset.url}`,import.meta.url))));
});
