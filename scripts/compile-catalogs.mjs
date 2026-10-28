import {readFile,writeFile} from 'node:fs/promises';
import {CATALOG_KEYS,loadCatalogs} from '../dist/catalog-loader.js';
import {configurationRegistry} from '../dist/configuration-registry.js';

const directory=new URL('../dist/data/',import.meta.url);
const {catalog,schema}=await loadCatalogs();
const selections=configurationRegistry.validateSelections(catalog.configuration_overrides);
if(!selections.ok)throw Error('Invalid catalog configuration defaults: '+selections.diagnostics.map(d=>d.message).join('; '));
const rendered=`// Generated from the JSON catalogs by scripts/compile-catalogs.mjs.\nexport const schema=${JSON.stringify(schema)};\nexport const catalog=${JSON.stringify(catalog)};\n`;
const target=new URL('catalog-bundle.js',directory);
if(process.argv.includes('--check')){
 const current=await readFile(target,'utf8');
 if(current!==rendered)throw Error('catalog-bundle.js is stale; run node scripts/compile-catalogs.mjs');
 console.log(`Catalog bundle matches ${CATALOG_KEYS.length} source catalogs.`);
}else{
 await writeFile(target,rendered);
 console.log(`Compiled ${CATALOG_KEYS.length} source catalogs to dist/data/catalog-bundle.js.`);
}
