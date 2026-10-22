import {DevIndustryTuningPanel} from './dev-industry-tuning.js?v=babbc3d3950e';
import {DevIndustryConstructionPanel} from './dev-industry-construction.js?v=babbc3d3950e';
import {PortDashboard} from './port-dashboard.js?v=babbc3d3950e';
import {portEconomicInfo} from './port-economic-info.js?v=babbc3d3950e';
import {createPortLedgerData} from './ledger-demo-data.js?v=babbc3d3950e';
import {EconomicOverview} from './economic-overview.js?v=babbc3d3950e';
import {ConfigurationTransaction} from './configuration-transaction.js?v=babbc3d3950e';
import {prepareRenderingActivation} from './runtime-configuration-owner.js?v=babbc3d3950e';
import {DevRuntimeConfigurationPanel} from './dev-runtime-configuration.js?v=babbc3d3950e';
import {DEFAULT_APPLICATION_SETTINGS} from './compiled-configuration.js?v=babbc3d3950e';
let applicationSettings=DEFAULT_APPLICATION_SETTINGS;
import {configurationRegistry,createConfigurationSession,persistDeveloperSelections} from './configuration-registry.js?v=babbc3d3950e';
import {DevConfigurationPanel} from './dev-configuration.js?v=babbc3d3950e';
import {IndustryIconRenderer} from './industry-icons.js?v=babbc3d3950e';
import {createAssetLoader,industryRegistry,dockRegistry,assetRegistry} from './simulation-registry.js?v=babbc3d3950e';
function startupTimeout(promise,label,ms=25000){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(label+' did not finish loading. Please reload this page.')),ms);Promise.resolve(promise).then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});});}
const loadAsset=createAssetLoader(url=>startupTimeout(PIXI.Assets.load(url),'Artwork '+url));
import {SHIP_ART} from './fleet.js?v=babbc3d3950e';
import {MerchantTraffic} from './merchant-traffic.js?v=benchmark-20261021';
import {RenderBudget} from './render-budget.js?v=babbc3d3950e';
import {shipHitTest,writeShipTooltip} from './ship-tooltip.js?v=babbc3d3950e';
import {writePortTooltip} from './port-tooltip.js?v=babbc3d3950e';
import {PlayerDocking} from './player-docking.js?v=babbc3d3950e';
import {centralPort} from './ports.js?v=babbc3d3950e';
import {cloudFragment} from './atmosphere.js?v=babbc3d3950e';
import {SailingTest} from './sailing-test.js?v=babbc3d3950e';
import {Ocean} from './ocean.js?v=babbc3d3950e';
import {axialToWorld,offsetToAxial,sampleWorld,BUILDING_SCALE} from './world.js?v=babbc3d3950e';
import {Wind} from './wind.js?v=babbc3d3950e';
import {WindField} from './wind-field.js?v=babbc3d3950e';
import {PortRenderer} from './port-renderer.js?v=babbc3d3950e';
import {TownRenderer} from './town-renderer.js?v=babbc3d3950e';
import {createPortEconomy} from './port-supplies.js?v=babbc3d3950e';
import {ShipInspector} from './ship-inspector.js?v=babbc3d3950e';
import {BridgeUI} from './bridge-ui.js?v=babbc3d3950e';
import {vertex,fragment,validateTerrainProgram} from './terrain-shader.js?v=opt-phase2-20261021';
const $=id=>document.getElementById(id),map=$('map');
const fields=['density','scale','roughness','moisture','mountains','industryDensity'];
const renderBudget=new RenderBudget();
const worker=new Worker(new URL('./generator.worker.js?v=benchmark-20261021',import.meta.url),{type:'module'});
let world,app,filter,mapSource,plane,camera={x:0,y:0},scale=1,fitScale=1,id=0,activeId=0,generating=false,ready=false,generationTimer=null;
let resolveGeneration,rejectGeneration,townRenderer,portRenderer,industryIconRenderer,windField,windSource,shoreSource,sailingTest,merchantTraffic,cloudFilter,cloudPlane,depthSource;
const portByTile=new Map(),industryByTile=new Map();
let shipHoverPointer=null,shipTooltipVisible=false,playerRegistrationPort=null;
let previewEconomy=null,portHoverInfo=null;
const portLedgerReports=new Map();
const portLedgerHistories=new Map(),portLedgerSelections=new Map(),portLedgerRanges=new Map(),portLedgerNextRequest=new Map();
let portDashboard=null,ledgerPreview=null,economicOverview=null,bridgeUI=null,shipInspector=null,simulationSpeed=1,simulationRunning=false;
const ledgerPreviewPort=Object.freeze({id:'ledger-preview-port',name:'Port Aurelia',faction:'british',factionName:'British'});
const applicationHolder={snapshot:configurationRegistry.resolve({}, {scope:'application'}),settings:applicationSettings};
let applicationRequestId=0,frameNumber=0;const applicationCallbacks=new Map();
function rememberDeveloperSelection(m){if(!m.selectedSnapshot||typeof devConfiguration==='undefined')return;const selected=Object.freeze({...devConfiguration.selected,...m.selectedSnapshot.values});devConfiguration.selected=selected;if(m.status==='accepted')persistDeveloperSelections(selected);}
const applicationController=new ConfigurationTransaction({snapshot:applicationHolder.snapshot,sessionId:'application-tab',prepare:p=>prepareRenderingActivation({holder:applicationHolder,industry:industryIconRenderer,town:townRenderer},p),notify:m=>{rememberDeveloperSelection(m);const callback=applicationCallbacks.get(m.requestId);if(m.status!=='pending')applicationCallbacks.delete(m.requestId);callback?.(m);}});
function requestApplication(edits,callback=()=>{}){const requestId=++applicationRequestId;applicationCallbacks.set(requestId,callback);applicationController.request({requestId,sessionId:applicationController.sessionId,baseRevision:applicationController.active.revision,edits});}
function worldConfigurationResult(m){if(m.selectedSnapshot){rememberDeveloperSelection(m);devConfiguration.revision=m.selectedSnapshot.revision;$('simulate').disabled=generating||!world||world.configuration?.revision!==devConfiguration.revision;}if(m.status==='accepted'&&m.activationBoundary==='simulation_restart'){sailingTest?.stop(false);shipInspector?.reset();previewEconomy=createPortEconomy(world);}}
const devConfiguration=new DevConfigurationPanel({onApply:(session,warnings=[])=>{requestApplication(session.application.values);$('simulate').disabled=!world||world.configuration?.revision!==devConfiguration.revision;$('seed-note').textContent=($('simulate').disabled?'World configuration changed. Generate a new world to apply.':'Display preferences queued for the next frame.')+(warnings.length?' Warnings: '+warnings.map(w=>w.message).join(' '):'');}});
ledgerPreview=new PortDashboard({getWorld:()=>({ports:[ledgerPreviewPort]})});
let benchmarkRunning=false,benchmarkReport=null,benchmarkMainSamples=[];
const benchmarkStatus=$('benchmark-status'),benchmarkProgress=$('benchmark-progress');
const roundMetric=value=>Number.isFinite(value)?Math.round(value*100)/100:null;
function percentile(values,p){if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b),position=(sorted.length-1)*p,low=Math.floor(position);return roundMetric(sorted[low]+(sorted[Math.ceil(position)]-sorted[low])*(position-low));}
function benchmarkGpuTimer(samples){
 const gl=app.renderer.gl,ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
 if(!ext)return null;
 const renderer=app.renderer,render=renderer.render,pending=[];
 const poll=()=>{if(gl.getParameter(ext.GPU_DISJOINT_EXT)){for(const q of pending)gl.deleteQuery(q);pending.length=0;return;}
  for(let i=0;i<pending.length;){const q=pending[i];if(!gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE)){i++;continue;}samples.push(gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6);gl.deleteQuery(q);pending.splice(i,1);}
 };
 renderer.render=function(...args){const q=gl.createQuery();if(!q)return render.apply(this,args);
  gl.beginQuery(ext.TIME_ELAPSED_EXT,q);try{return render.apply(this,args);}finally{gl.endQuery(ext.TIME_ELAPSED_EXT);pending.push(q);}
 };
 return{poll,stop(){renderer.render=render;poll();for(const q of pending)gl.deleteQuery(q);}};
}
function benchmarkPoint(kind){
 const n=world.n,h=world.h,at=i=>{const row=Math.floor(i/n),col=i%n,{q,r}=offsetToAxial(col,row);return axialToWorld(q,r);};
 let land=-1,water=-1,coast=-1;
 for(let i=0;i<h.length;i++){
  if(land<0&&h[i]>.48)land=i;
  if(water<0&&h[i]<.1&&world.depth[i]>=28)water=i;
  if(coast<0&&h[i]>=.35&&h[i]<.4)coast=i;
 }
 return at(kind==='land'?(land>=0?land:Math.max(0,coast)):kind==='water'?(water>=0?water:0):coast>=0?coast:land>=0?land:0);
}
async function benchmarkFrames(label,size,view,speed,endTime,onProgress){
 const width=map.clientWidth,height=map.clientHeight,intervals=[],ticks=[],sizes=[],gpuSamples=[];
 const sceneBegan=performance.now(),warmupEnd=sceneBegan+1500;
 let messages=0,longTaskMs=0,started=Infinity,ended=Infinity,sampling=false,lastProgress=0,gpuTimer=null;
 const observer=typeof PerformanceObserver==='function'&&PerformanceObserver.supportedEntryTypes?.includes('longtask')?new PerformanceObserver(list=>{for(const entry of list.getEntries())if(entry.startTime>=started&&entry.startTime<ended)longTaskMs+=entry.duration;}):null;
 observer?.observe({entryTypes:['longtask']});
 merchantTraffic.benchmarkObserver=data=>{if(data.type!=='state'||!sampling)return;messages++;if(Number.isFinite(data.benchmarkTickMs))ticks.push(data.benchmarkTickMs);if(messages%5===1)sizes.push(new TextEncoder().encode(JSON.stringify(data)).byteLength);};
 try{
  let previous=null;await new Promise((resolve,reject)=>{
   const frame=now=>{if(document.hidden||map.clientWidth!==width||map.clientHeight!==height){reject(Error('Tab was hidden or viewport changed. Run again without resizing.'));return;}
    if(!sampling&&now>=warmupEnd){started=now;sampling=true;benchmarkMainSamples=[];gpuTimer=benchmarkGpuTimer(gpuSamples);}
    gpuTimer?.poll();
    if(previous!==null&&sampling&&now>started)intervals.push(now-previous);previous=now;
    if(now-lastProgress>=1000){lastProgress=now;onProgress?.(Math.max(0,Math.ceil((endTime-now)/1000)));}
    if(now<endTime)requestAnimationFrame(frame);else resolve();};requestAnimationFrame(frame);
  });
  ended=performance.now();sampling=false;await new Promise(resolve=>setTimeout(resolve,0));gpuTimer?.stop();gpuTimer=null;
  return{kind:label,mapSize:size,view,simulationSpeed:speed,seed:world.config.seed,zoom:roundMetric(scale),hexPixels:roundMetric(scale*1.7320508),viewport:[width,height],outputPixels:[app.canvas.width,app.canvas.height],filterResolution:filter.resolution,ships:merchantTraffic.fleetSnapshots?.length??0,sceneElapsedMs:roundMetric(ended-sceneBegan),sampleElapsedMs:roundMetric(ended-started),frameCount:intervals.length,frameMedianMs:percentile(intervals,.5),frameP95Ms:percentile(intervals,.95),gpuFrameCount:gpuSamples.length,gpuFrameMedianMs:percentile(gpuSamples,.5),gpuFrameP95Ms:percentile(gpuSamples,.95),tickerMedianMs:percentile(benchmarkMainSamples,.5),tickerP95Ms:percentile(benchmarkMainSamples,.95),longTaskMs:roundMetric(longTaskMs),workerTickMedianMs:percentile(ticks,.5),workerTickP95Ms:percentile(ticks,.95),messageRateHz:roundMetric(messages/((ended-started)/1000)),sampledMessageBytesMedian:percentile(sizes,.5),jsHeapMiB:performance.memory?.usedJSHeapSize?roundMetric(performance.memory.usedJSHeapSize/1048576):null,generationMs:roundMetric(world.generationMs),workerGenerationMs:roundMetric(world.workerGenerationMs)};
 }finally{gpuTimer?.stop();merchantTraffic.benchmarkObserver=null;observer?.disconnect();}
}
async function runBenchmark(kind){
 if(benchmarkRunning||!ready||!['world','simulation'].includes(kind))return;benchmarkRunning=true;benchmarkReport=null;$('dev-world-benchmark').disabled=true;$('dev-simulation-benchmark').disabled=true;$('benchmark-copy').disabled=true;$('benchmark-download').disabled=true;
 const previousSettings={seed:$('seed').value,size:$('size').value,fields:Object.fromEntries(fields.map(k=>[k,$(k).value])),layer:$('layer').value,grid:$('grid').checked,windDegrees:wind.angle*180/Math.PI,windStrength:wind.strength},previousAnimate=$('animate').checked;
 const gl=app.renderer.gl,debug=gl.getExtension('WEBGL_debug_renderer_info');
 const report={
  schema:'pirates-merchants-benchmark-v7',build:'split-benchmarks-20261022',benchmarkType:kind,capturedAt:new Date().toISOString(),
  userAgent:navigator.userAgent,platform:navigator.platform,deviceMemoryGiB:navigator.deviceMemory??null,
  hardwareConcurrency:navigator.hardwareConcurrency??null,devicePixelRatio:devicePixelRatio,screen:[screen.width,screen.height],
  glVendor:debug?gl.getParameter(debug.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR),
  glRenderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),
  notes:[
   'The fixed seed, map settings, viewport and render resolution make repeat runs comparable.',
   'Frame intervals include browser scheduling and rendering; they are not GPU time. Per-scene GPU frame times use a WebGL timer query when supported and measure the complete app render.',
   'Ticker time measures the app update callback, not total main-thread work. Long-task time includes tasks longer than 50 ms only.',
   ...(kind==='simulation'?['Message byte size samples one in five state messages using JSON serialization on the main thread.']:[]),
   kind==='world'?'Terrain scenes cover overview, land, water and coast on 32, 128 and 512 hex maps with simulation off. Each scene includes 1.5 seconds of warmup.':'Only the 512 hex world is generated. The 60-second fleet window starts when its worker first reports ready; each speed gets 30 seconds including 1.5 seconds of warmup.'
  ],scenes:[],
  ...(kind==='simulation'?{requestedMerchants:50,simulationDurationTargetMs:60000}:{})
 };
 const progress=message=>{benchmarkProgress.textContent=message;benchmarkProgress.hidden=false;benchmarkStatus.textContent=message;};
 try{
  $('seed').value='BENCHMARK-COAST-01';$('animate').checked=false;
  for(const [key,value] of Object.entries({density:48,scale:50,roughness:55,moisture:60,mountains:35,industryDensity:50})){$(key).value=value;$(key+'-out').value=value+'%';}
  $('layer').value='0';$('layer').onchange();$('grid').checked=false;$('grid').onchange();wind.set(90,.5);windUI();
  const {size:unusedSize,...fixedSettings}=settings();report.mapSettings={...fixedSettings,...(kind==='world'?{sizeSequence:[32,128,512]}:{size:512})};report.worldConfigurationRevision=devConfiguration.revision;
  for(const size of kind==='world'?[32,128,512]:[512]){
   $('size').value=String(size);$('tile-count').textContent=(size*size).toLocaleString()+' hexes';
   progress(`Generating the ${size} × ${size} benchmark world…`);await generate();
   if(kind==='world'){
    mode('simulation');filter.resolution=1;cloudFilter.resolution=.5;
    for(const view of ['overview','land','water','coast']){
     if(view==='overview')fit();else{camera=benchmarkPoint(view);scale=BUILDING_SCALE;sync();}
     progress(`Measuring ${size} × ${size} ${view} terrain…`);
     report.scenes.push(await benchmarkFrames('terrain',size,view,0,performance.now()+3500));
    }
   }
  }
  if(kind==='world'){
   progress('World benchmark finished. Copy or download the JSON report.');
  }else{
   if(world.ports.length<2)throw Error('Benchmark seed has fewer than two trading ports.');
   $('animate').checked=true;
   mode('simulation');camera=benchmarkPoint('coast');scale=BUILDING_SCALE;sync();filter.resolution=1;cloudFilter.resolution=.5;
   progress('Launching 50 merchants…');merchantTraffic.setDensity(50);merchantTraffic.setSimulationSpeed(1);merchantTraffic.start();
   const deadline=performance.now()+90000;while(!merchantTraffic.sessionId&&performance.now()<deadline)await new Promise(resolve=>setTimeout(resolve,100));
   if(!merchantTraffic.sessionId)throw Error('Fleet worker did not start. See browser console for the worker error.');
   const simulationStarted=performance.now();
   for(const speed of [1,20]){
    progress(`Measuring 50 merchants at ${speed}×…`);merchantTraffic.setSimulationSpeed(speed);
    report.scenes.push(await benchmarkFrames('fleet',512,'coast',speed,simulationStarted+(speed===1?30000:60000),remaining=>progress(`Measuring 50 merchants at ${speed}× · ${remaining}s remaining in this phase…`)));
   }
   report.simulationElapsedMs=roundMetric(performance.now()-simulationStarted);
   const actual=merchantTraffic.fleetSnapshots.filter(ship=>!ship.military).length;report.actualMerchants=actual;
   if(actual<50)report.notes.push(`Only ${actual} of 50 merchants could launch in this world; measurements use the actual fleet.`);
   progress(`Finished. ${actual} merchants active. Copy or download the JSON report.`);
  }
 }catch(error){report.error=error.message;progress(`Stopped: ${error.message} Partial report is available.`);}
 finally{
  benchmarkRunning=false;merchantTraffic.benchmarkObserver=null;merchantTraffic.stop();$('seed').value=previousSettings.seed;$('size').value=previousSettings.size;$('tile-count').textContent=(Number(previousSettings.size)**2).toLocaleString()+' hexes';for(const [key,value] of Object.entries(previousSettings.fields)){$(key).value=value;$(key+'-out').value=value+'%';}$('layer').value=previousSettings.layer;$('layer').onchange();$('grid').checked=previousSettings.grid;$('grid').onchange();wind.set(previousSettings.windDegrees,previousSettings.windStrength);windUI();$('animate').checked=previousAnimate;$('dev-world-benchmark').disabled=false;$('dev-simulation-benchmark').disabled=false;benchmarkReport=report;$('benchmark-copy').disabled=false;$('benchmark-download').disabled=false;
  $('dev-benchmark-title').textContent=kind==='world'?'World generation benchmark':'50-merchant simulation benchmark';$('benchmark-description').textContent=kind==='world'?'Fixed-seed 32, 128 and 512 hex maps, each measured in overview, land, water and coast views with simulation off. Keep the tab visible and avoid resizing.':'A fixed-seed 512 hex world starts 50 merchants automatically. The fleet runs for one minute: 30 seconds at 1× and 30 seconds at 20×. Keep the tab visible and avoid resizing.';
  $('benchmark-result').textContent=JSON.stringify(report,null,2);$('benchmark-result').hidden=false;benchmarkProgress.hidden=true;mode('home');$('dev-benchmark').showModal();
 }
}
$('dev-world-benchmark').onclick=()=>runBenchmark('world');
$('dev-simulation-benchmark').onclick=()=>runBenchmark('simulation');
$('benchmark-close').onclick=()=>$('dev-benchmark').close();
$('benchmark-copy').onclick=async()=>{if(!benchmarkReport)return;try{await navigator.clipboard.writeText(JSON.stringify(benchmarkReport,null,2));benchmarkStatus.textContent='JSON copied. Paste it in our chat.';}catch{benchmarkStatus.textContent='Copy failed. Use Download JSON instead.';}};
$('benchmark-download').onclick=()=>{if(!benchmarkReport)return;const blob=new Blob([JSON.stringify(benchmarkReport,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='pirates-merchants-'+benchmarkReport.benchmarkType+'-benchmark-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
const previewButton=$('dev-ledger-preview')??(()=>{const actions=document.querySelector('.dev-menu-actions');if(!actions)return null;const button=document.createElement('button');button.id='dev-ledger-preview';button.type='button';button.textContent='Preview ledger';actions.append(button);return button;})();
if(previewButton)previewButton.onclick=()=>ledgerPreview.open(ledgerPreviewPort);
new DevRuntimeConfigurationPanel({requestApplication,requestWorld:(edits,callback)=>merchantTraffic?.requestConfiguration(edits,callback),restart:callback=>merchantTraffic?.restartConfiguration(callback),cancel:(scope,callback)=>{if(scope==='world')merchantTraffic?.cancelConfiguration(callback);else{applicationController.cancel('Developer cancelled batch');callback(applicationController.response({requestId:++applicationRequestId},'accepted',{revision:applicationController.active.revision,activationBoundary:'unchanged',snapshot:applicationController.active}));}},regenerate:()=>generate().catch(error=>{$('runtime-config-status').textContent=error.message;})});
const dynamicControls=$('dev-dynamic-controls');dynamicControls.append(document.querySelector('.wind-panel'),document.querySelector('.port-browser'));
function mode(name){
 document.body.classList.toggle('dev-home',name==='home');document.body.classList.toggle('dev-simulation',name==='simulation');
 $('dev-opening').hidden=name!=='home';document.querySelector('main').inert=name==='home';
 $('adjust-simulation').hidden=name!=='simulation';$('test-ship').hidden=name!=='simulation';
 if(name==='home')$('dev-options-button').focus();else if(name==='world')$('seed').focus();
 requestAnimationFrame(()=>sync());
}
function stopSimulation(){ledgerPreview?.reset();portDashboard?.reset();portLedgerReports.clear();portLedgerHistories.clear();portLedgerSelections.clear();portLedgerRanges.clear();portLedgerNextRequest.clear();simulationRunning=false;sailingTest?.stop(false);merchantTraffic?.stop();shipInspector?.reset();$('fleet-list').disabled=true;$('test-ship').textContent='Launch own vessel';}
function showWorldGeneration(){if(!ready)return;stopSimulation();mode('world');$('loading').hidden=true;}
$('dev-home-button').onclick=()=>{stopSimulation();mode('home');};
$('dev-world-button').onclick=showWorldGeneration;$('dev-start-world').onclick=showWorldGeneration;
$('adjust-simulation').onclick=()=>{sailingTest?.clear();$('dev-adjust').showModal();};$('dev-adjust-close').onclick=()=>{$('dev-adjust').close();map.focus();};
$('simulate').onclick=()=>{if(!world||generating||!ready||world.configuration?.revision!==devConfiguration.revision)return;simulationRunning=true;mode('simulation');merchantTraffic.setDensity(Number($('merchant-density').value));merchantTraffic.start();$('fleet-list').disabled=!merchantTraffic.worker;$('test-ship').disabled=!merchantTraffic.worker;};

function refreshPortTooltip(){if(portHoverInfo&&shipHoverPointer&&!shipTooltipVisible)writePortTooltip($('inspect'),portHoverInfo,shipHoverPointer,map.clientWidth,map.clientHeight,openPortLedgerFromTooltip);}
function ledgerDataForPort(port){const report=portLedgerReports.get(port?.id),options={histories:portLedgerHistories.get(port?.id)??[],selectedCommodity:portLedgerSelections.get(port?.id)??null,rangeSeconds:portLedgerRanges.get(port?.id)??0};if(report)return createPortLedgerData(port,report,options);if(!merchantTraffic?.worker&&previewEconomy&&port?.id)return createPortLedgerData(port,portEconomicInfo(previewEconomy,port.id,{world}),options);return createPortLedgerData(port,null,options);}
function requestPortLedgerHistory(port){if(!port||!merchantTraffic?.worker)return;merchantTraffic.requestPortCargoHistory(port.id,result=>{if(result?.histories){portLedgerHistories.set(port.id,result.histories);portDashboard?.refresh({force:true});}});}
function requestPortLedger(port){if(!port||!merchantTraffic?.worker)return;const now=performance.now();if(now<(portLedgerNextRequest.get(port.id)??0))return;portLedgerNextRequest.set(port.id,now+5000);merchantTraffic.requestPortEconomy(port.id,result=>{if(result?.info){portLedgerReports.set(port.id,result.info);portDashboard?.refresh({force:true});}});requestPortLedgerHistory(port);}
function selectPortMarketCommodity(portId,commodityId){portLedgerSelections.set(portId,commodityId);const port=world?.ports.find(item=>item.id===portId);requestPortLedgerHistory(port);portDashboard?.refresh({force:true});}
function selectPortMarketRange(portId,rangeSeconds){portLedgerRanges.set(portId,rangeSeconds);portDashboard?.refresh({force:true});}
function openPortLedger(port){if(!port)return;requestPortLedger(port);portDashboard?.open(port);}
function openPortLedgerFromTooltip(port){if(!port)return;openPortLedger(port);const panel=$('inspect');panel.hidden=true;panel.style.pointerEvents='none';panel.className='';portHoverInfo=null;}
function indexPortTiles(){portByTile.clear();for(const port of world?.ports??[]){portByTile.set(port.landIndex,{port,kind:'Harbor Master'});for(const index of port.townTiles??[])if(index!==port.landIndex)portByTile.set(index,{port,kind:'Town quarter'});for(const dock of port.docks??[port]){const kind=dock.dockTypeId?dockRegistry.get(dock.dockTypeId).display_name:'Dock';for(const tile of dock.tiles??[{tileIndex:dock.waterIndex}])portByTile.set(tile.tileIndex,{port,dock,kind});for(const cell of dock.dockingCells??[])if(!portByTile.has(cell.tileIndex))portByTile.set(cell.tileIndex,{port,dock,kind:kind+' docking hex'});if(dock.landIndex!==port.landIndex)portByTile.set(dock.landIndex,{port,dock,kind});}}}
function activeShips(){const player=sailingTest?.ship?{...sailingTest.ship,id:'player',player:true,state:sailingTest.ship.docked?'MOORED':sailingTest.ship.docking?'DOCKING':sailingTest.ship.anchored?'AT_ANCHOR':'PLAYER_CONTROLLED',maxSpeed:sailingTest.ship.spec.maxSpeed,cargoCapacity:sailingTest.ship.spec.cargoCapacity,cargo:0,cargoItems:[],faction:playerRegistrationPort?.faction,registrationPortName:playerRegistrationPort?.name,originPortName:playerRegistrationPort?.name,targetName:sailingTest.docking?.port?.name}:null;return [...(player?[player]:[]),...(merchantTraffic?.inspectedShips()??[])];}
function hoveredShip(pointer){
 if(!merchantTraffic?.worker&&!sailingTest?.ship)return null;
 return activeShips().reverse().find(ship=>shipHitTest(ship,pointer,camera,scale,map.clientWidth,map.clientHeight));
}
function refreshShipTooltip(){if(!shipHoverPointer||(!merchantTraffic?.worker&&!sailingTest?.ship))return;const ship=hoveredShip(shipHoverPointer);if(ship){writeShipTooltip($('inspect'),ship,shipHoverPointer,map.clientWidth,map.clientHeight);shipTooltipVisible=true;}else if(shipTooltipVisible){$('inspect').hidden=true;shipTooltipVisible=false;}}
const wind=new Wind(),ocean=new Ocean(wind.angle);
function windUI(){
 const degrees=Math.round(wind.angle*180/Math.PI)%360,strength=Math.round(wind.strength*100);
 if(document.activeElement!==$('wind-direction'))$('wind-direction').value=degrees;if(document.activeElement!==$('wind-strength'))$('wind-strength').value=strength;
 $('wind-direction-out').value=`${degrees}° ${['N','NE','E','SE','S','SW','W','NW'][Math.round(degrees/45)%8]}`;
 $('wind-strength-out').value=`${strength}%`;
 const v=wind.vector;$('wind-vector').textContent=`Vector (${v.x.toFixed(2)}, ${v.y.toFixed(2)}) · prevailing wind; sheltered water is calmer`;
}
function setWind(e){wind.set(e.target.id==='wind-direction'?Number(e.target.value):wind.angle*180/Math.PI,e.target.id==='wind-strength'?Number(e.target.value)/100:wind.strength);windUI();}
$('wind-direction').oninput=setWind;$('wind-strength').oninput=setWind;$('wind-random').onclick=()=>{wind.randomize();windUI();};windUI();
const names=['Deep sea','Shore & shallows','Grassland','Forest','Desert','Rock','Road'];
const launchPort=()=>world?.ports.find(p=>p.id===$('port-selector').value)||centralPort(world);
const settings=()=>({seed:$('seed').value.trim()||'TRADEWINDS',size:Number($('size').value),...Object.fromEntries(fields.map(k=>[k,Number($(k).value)]))});
function busy(value){if(!value){clearTimeout(generationTimer);generationTimer=null;}if(value)$('loading').textContent='Charting the archipelago…';generating=value;$('simulate').disabled=value||!world||world.configuration?.revision!==devConfiguration.revision;$('dev-world-button').disabled=value||!ready;$('dev-start-world').disabled=value||!ready;$('test-ship').disabled=value||!sailingTest;$('generate').disabled=value;$('loading').hidden=!value;}
function fail(message){$('dev-ready-status').textContent=message;busy(false);$('loading').textContent=message;$('loading').hidden=false;$('seed-note').textContent='Could not generate this world. Try again.';if(rejectGeneration)rejectGeneration(Error(message));resolveGeneration=rejectGeneration=null;}
function generate(){if(!ready||generating)return Promise.reject(Error('The map is busy. Try again shortly.'));stopSimulation();mode('world');busy(true);const config=settings();$('seed').value=config.seed;activeId=++id;generationTimer=setTimeout(()=>{activeId=++id;fail('The terrain generator did not respond. Please reload this page.');},45000);worker.postMessage({id:activeId,config,configuration:createConfigurationSession(devConfiguration.selected,{revision:devConfiguration.revision}).world});return new Promise((resolve,reject)=>{resolveGeneration=resolve;rejectGeneration=reject;});}
function sync(){if(!filter)return;const u=filter.resources.worldUniforms.uniforms;u.uCamera=new Float32Array([camera.x,camera.y]);u.uScale=scale;u.uResolution=new Float32Array([map.clientWidth,map.clientHeight]);if(cloudFilter){const c=cloudFilter.resources.cloudUniforms.uniforms;c.uCamera=u.uCamera;c.uScale=scale;c.uResolution=u.uResolution;}$('zoom-label').textContent=Math.round(scale/BUILDING_SCALE*100)+'%';townRenderer?.update(camera,scale,map.clientWidth,map.clientHeight);portRenderer?.update(camera,scale,map.clientWidth,map.clientHeight);industryIconRenderer?.update(camera,scale,map.clientWidth,map.clientHeight,Number($('layer').value));sailingTest?.render(camera,scale,map.clientWidth,map.clientHeight);merchantTraffic?.render(camera,scale,map.clientWidth,map.clientHeight);}
function fit(){if(!world)return;if(sailingTest?.ship)sailingTest.follow.checked=false;camera={x:world.bounds.width/2,y:world.bounds.height/2};fitScale=Math.min((map.clientWidth-70)/world.bounds.width,Math.max(180,map.clientHeight-180)/world.bounds.height)*.94;scale=fitScale;sync();}
function buildingView(center=false){if(!world)return;const island=world.islands[0];if(center===true&&world.ports?.length)camera={...centralPort(world).harborPosition};else if(center===true)camera=island?axialToWorld(island.q,island.r):{x:world.bounds.width/2,y:world.bounds.height/2};scale=BUILDING_SCALE;sync();}
function zoom(factor,point={x:map.clientWidth/2,y:map.clientHeight/2}){if(!world)return;const next=Math.max(fitScale*.6,Math.min(Math.max(BUILDING_SCALE*4,fitScale*18),scale*factor));const sx=point.x-map.clientWidth/2,sy=point.y-map.clientHeight/2;camera.x+=sx/scale-sx/next;camera.y+=sy/scale-sy/next;scale=next;sync();}
worker.onmessage=({data})=>{if(data.id!==activeId)return;if(data.error)return fail(data.error);try{
 world=data.world;world.configuration=configurationRegistry.reconstruct(world.configuration);const old=mapSource;
 mapSource=new PIXI.BufferImageSource({resource:world.data,width:world.terrainN,height:world.terrainN,format:'rgba32float',scaleMode:'nearest',alphaMode:'no-premultiply-alpha',autoGenerateMipmaps:false});
 filter.resources.uMap=mapSource;filter.resources.worldUniforms.uniforms.uN=world.n;if(old)old.destroy();
 const oldShore=shoreSource;shoreSource=new PIXI.BufferImageSource({resource:world.shore.data,width:world.shore.width,height:world.shore.height,format:'rgba32float',scaleMode:'nearest',alphaMode:'no-premultiply-alpha',autoGenerateMipmaps:false});
 filter.resources.uShore=shoreSource;filter.resources.worldUniforms.uniforms.uShoreSpacing=world.shore.spacing;if(oldShore)oldShore.destroy();
 windField=new WindField(world,wind.vector);
 const oldWind=windSource;windSource=new PIXI.BufferImageSource({resource:windField.data,width:windField.width,height:windField.height,format:'rgba32float',scaleMode:'nearest',alphaMode:'no-premultiply-alpha',autoGenerateMipmaps:false});
 filter.resources.uWindField=windSource;filter.resources.worldUniforms.uniforms.uFieldSpacing=windField.spacing;filter.resources.worldUniforms.uniforms.uFieldAge=0;if(oldWind)oldWind.destroy();
 const oldDepth=depthSource;depthSource=new PIXI.BufferImageSource({resource:world.depth,width:world.n,height:world.n,format:'r32float',scaleMode:'nearest',alphaMode:'no-premultiply-alpha',autoGenerateMipmaps:false});filter.resources.uDepth=depthSource;if(oldDepth)oldDepth.destroy();
 portDashboard?.reset();portLedgerReports.clear();portLedgerHistories.clear();portLedgerSelections.clear();portLedgerRanges.clear();portLedgerNextRequest.clear();townRenderer.setWorld(world);portRenderer.setWorld(world);industryIconRenderer.setSettings(applicationSettings.rendering);townRenderer.setSettings(applicationSettings.rendering);industryIconRenderer.setWorld(world);portByTile.clear();industryByTile.clear();previewEconomy=createPortEconomy(world);portHoverInfo=null;
 for(const industry of world.industries)industryByTile.set(industry.tileIndex,industry);
 $('industry-summary').textContent=industryRegistry.values().filter(d=>d.placement.enabled||d.manufacturing?.runtime_enabled).map(d=>d.id).map(type=>`${world.industries.filter(i=>i.type===type).length} ${type}`).join(' · ')+(world.industryGeneration?.secondary?.unmet?' · Factory target shortfall: '+world.industryGeneration.secondary.unmet+' ('+world.industryGeneration.secondary.reason+')':'');
 const selector=$('port-selector');selector.replaceChildren(new Option('Choose a port…',''));
 for(const port of world.ports){selector.add(new Option(`${port.name} · ${port.factionName}`,port.id));}
 indexPortTiles();selector.value=centralPort(world)?.id||'';

 selector.disabled=!world.ports.length;$('port-information').disabled=!world.ports.length;$('port-count').textContent=`${world.ports.length} ports`;
 $('port-note').textContent=world.ports.length?'Select a port to visit. Click a dock, office or town quarter for its economic dashboard.':'No eligible ports. Islands need at least 50 land tiles.';
 fit();buildingView(true);const config=world.config,title=config.seed.toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());$('world-name').textContent=`The ${title} Archipelago`;
 $('world-meta').textContent=`${world.n} × ${world.n} hexes · Seed ${config.seed}`;
 $('stats').textContent=`${world.islands.length} islands · ${Math.round(world.land/(world.n*world.n)*100)}% land · ${world.ports.length} ports · ${world.industries.length} industries`;
 $('seed-note').textContent=world.islands.length?`Charted in ${Math.round(world.generationMs)} ms. Ready to explore.`:'No islands at these settings. Try more density, smaller islands, or a larger map.';busy(false);
 app.render();resolveGeneration?.({seed:config.seed,size:world.n,islands:world.islands.length,landTiles:world.land,ports:world.ports.length,industries:world.industries.length});resolveGeneration=rejectGeneration=null;
}catch(e){fail('This browser could not draw the terrain. '+e.message);}};
worker.onerror=()=>fail('The terrain generator could not start. Reload the page to try again.');
for(const k of fields)$(k).addEventListener('input',()=>{$(k+'-out').value=$(k).value+'%';$('seed-note').textContent='Settings changed. Generate to apply.';});
$('size').addEventListener('change',()=>{$('tile-count').textContent=(Number($('size').value)**2).toLocaleString()+' hexes';$('seed-note').textContent='Settings changed. Generate to apply.';});
$('seed').addEventListener('input',()=>{$('seed-note').textContent='Seed changed. Generate to apply.';});
$('settings').addEventListener('submit',e=>{e.preventDefault();generate().catch(()=>{});});
$('random').onclick=()=>{if(generating)return;const words=['CORAL','GOLDEN','MISTRAL','SAPPHIRE','SAFFRON','MARINER','TORTUGA','MONSOON'];const numbers=new Uint32Array(2);crypto.getRandomValues(numbers);$('seed').value=words[numbers[0]%words.length]+'-'+(numbers[1]%10000).toString().padStart(4,'0');generate().catch(()=>{});};
$('zoom-in').onclick=()=>zoom(1.35);$('zoom-out').onclick=()=>zoom(1/1.35);$('fit').onclick=fit;$('building-view').onclick=buildingView;
$('port-information').onclick=()=>{const port=world?.ports.find(p=>p.id===$('port-selector').value);if(port)openPortLedger(port);};
$('port-selector').onchange=()=>{const port=world?.ports.find(p=>p.id===$('port-selector').value);$('port-information').disabled=!port;if(port){camera={...port.harborPosition};scale=BUILDING_SCALE;sync();}};
$('grid').onchange=()=>{if(filter)filter.resources.worldUniforms.uniforms.uGrid=Number($('grid').checked);$('inspect').hidden=true;};
$('layer').onchange=()=>{$('terrain-legend').hidden=$('layer').value==='3';$('wind-legend').hidden=$('layer').value!=='3';if(filter)filter.resources.worldUniforms.uniforms.uLayer=Number($('layer').value);sync();};
map.addEventListener('wheel',e=>{e.preventDefault();const b=map.getBoundingClientRect();zoom(Math.exp(-e.deltaY*.0015),{x:e.clientX-b.left,y:e.clientY-b.top});},{passive:false});
const pointers=new Map();let lastDistance=0,pointerStart=null;
map.addEventListener('pointerdown',e=>{pointerStart=pointers.size?null:{id:e.pointerId,x:e.clientX,y:e.clientY,moved:false};portHoverInfo=null;shipHoverPointer=null;shipTooltipVisible=false;map.focus({preventScroll:true});map.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});map.classList.add('dragging');$('inspect').hidden=true;if(pointers.size===2){const[a,b]=[...pointers.values()];lastDistance=Math.hypot(a.x-b.x,a.y-b.y);}});
map.addEventListener('pointermove',e=>{const prev=pointers.get(e.pointerId);if(prev){if(pointerStart&&Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y)>5)pointerStart.moved=true;if(pointers.size===1){camera.x-=(e.clientX-prev.x)/scale;camera.y-=(e.clientY-prev.y)/scale;sync();}pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const[a,b]=[...pointers.values()],distance=Math.hypot(a.x-b.x,a.y-b.y),rect=map.getBoundingClientRect();if(lastDistance>0)zoom(distance/lastDistance,{x:(a.x+b.x)/2-rect.left,y:(a.y+b.y)/2-rect.top});lastDistance=distance;}return;}
 if(!world)return;portHoverInfo=null;const b=map.getBoundingClientRect(),x=e.clientX-b.left,y=e.clientY-b.top;shipHoverPointer={x,y};shipTooltipVisible=false;if((merchantTraffic?.worker||sailingTest?.ship)&&hoveredShip(shipHoverPointer)){refreshShipTooltip();return;}
 const cell=sampleWorld(world,(x-map.clientWidth/2)/scale+camera.x,(y-map.clientHeight/2)/scale+camera.y);if(!cell){$('inspect').hidden=true;return;}const info=portByTile.get(cell.row*world.n+cell.col),industry=industryByTile.get(cell.row*world.n+cell.col);if(info){portHoverInfo=info;merchantTraffic?.inspectPort(info.port.id);writePortTooltip($('inspect'),info,{x,y},map.clientWidth,map.clientHeight,openPortLedgerFromTooltip);return;}if(!industry&&!$('grid').checked){$('inspect').hidden=true;return;}const panel=$('inspect');panel.className='';panel.style.pointerEvents='none';panel.onclick=null;panel.onkeydown=null;panel.onpointerleave=null;panel.removeAttribute?.('role');panel.removeAttribute?.('aria-label');panel.removeAttribute?.('tabindex');panel.replaceChildren();const strong=document.createElement('strong');strong.textContent=industry?industry.name:names[cell.biome];panel.append(strong,document.createElement('br'));if(industry)panel.append(`Produces ${industry.commodity}`,document.createElement('br'),industry.portName?`Island port: ${industry.portName}`:'Unserved island');else panel.append(cell.height<.35?`Depth ${cell.depth.toFixed(1)} · ${cell.oceanLevel?"Ocean level "+cell.oceanLevel+" / 4":"Coastal shallows"}`:`q ${cell.q} · r ${cell.r} · elevation ${cell.height.toFixed(3)}`,document.createElement('br'),`cube (${cell.x}, ${cell.y}, ${cell.z})`);panel.style.left=Math.max(8,Math.min(map.clientWidth-220,x+16))+'px';panel.style.top=Math.max(8,Math.min(map.clientHeight-100,y+16))+'px';panel.hidden=false;
});
function endPointer(e){if(e.type==='pointerup'&&pointerStart?.id===e.pointerId&&!pointerStart.moved){const b=map.getBoundingClientRect(),x=e.clientX-b.left,y=e.clientY-b.top,ship=hoveredShip({x,y});if(ship){shipInspector.select(ship.id);$('inspect').hidden=true;}else if(world){const cell=sampleWorld(world,(x-map.clientWidth/2)/scale+camera.x,(y-map.clientHeight/2)/scale+camera.y),info=cell?portByTile.get(cell.row*world.n+cell.col):null;if(info){openPortLedger(info.port);$('inspect').hidden=true;}}}pointerStart=null;pointers.delete(e.pointerId);if(!pointers.size)map.classList.remove('dragging');lastDistance=0;}
map.addEventListener('pointerup',endPointer);map.addEventListener('pointercancel',endPointer);map.addEventListener('lostpointercapture',endPointer);map.addEventListener('pointerleave',e=>{const panel=$('inspect');if(portHoverInfo&&panel.contains(e.relatedTarget))return;portHoverInfo=null;shipHoverPointer=null;shipTooltipVisible=false;panel.hidden=true;});
map.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','0','1'].includes(e.key)){e.preventDefault();if(e.key==='0')fit();else if(e.key==='1')buildingView();else if(e.key==='+'||e.key==='=')zoom(1.2);else if(e.key==='-')zoom(1/1.2);else{camera.x+=((e.key==='ArrowRight')-(e.key==='ArrowLeft'))*40/scale;camera.y+=((e.key==='ArrowDown')-(e.key==='ArrowUp'))*40/scale;sync();}}});
async function init(){try{
 $('loading').textContent='Starting graphics…';
 app=new PIXI.Application();await startupTimeout(app.init({preference:'webgl',preferWebGLVersion:2,width:map.clientWidth,height:map.clientHeight,resolution:Math.min(devicePixelRatio,1.5),autoDensity:true,antialias:false,background:'#376d7a'}),'Graphics renderer');map.appendChild(app.canvas);
 validateTerrainProgram(app.renderer.gl);
 $('loading').textContent='Loading map artwork…';
 const [paper,terrainAtlas,dockAtlas,harborAtlas,industryAtlas,sloopAtlas,industryIcons]=await Promise.all(['paper','terrain','docks','harbors','industries','ship:sloop','industry:icons'].map(loadAsset));
 for(const atlas of [industryAtlas,dockAtlas,harborAtlas,sloopAtlas]){atlas.source.scaleMode='linear';atlas.source.autoGenerateMipmaps=true;atlas.source.mipLevelCount=1+Math.floor(Math.log2(Math.max(atlas.width,atlas.height)));atlas.source.mipmapFilter='linear';atlas.source.update();}
 terrainAtlas.source.scaleMode='linear';
 terrainAtlas.source.autoGenerateMipmaps=true;
 terrainAtlas.source.mipLevelCount=1+Math.floor(Math.log2(Math.max(terrainAtlas.width,terrainAtlas.height)));
 terrainAtlas.source.mipmapFilter='linear';
 terrainAtlas.source.update();
 const blank=new PIXI.BufferImageSource({resource:new Float32Array([0,0,0,1]),width:1,height:1,format:'rgba32float',scaleMode:'nearest'});mapSource=blank;
 filter=new PIXI.Filter({glProgram:PIXI.GlProgram.from({vertex,fragment,preferredFragmentPrecision:'highp'}),resources:{uMap:blank,uDepth:blank,uWindField:blank,uShore:blank,uPaper:paper.source,uTerrainAtlas:terrainAtlas.source,uIndustryAtlas:industryAtlas.source,worldUniforms:{uIndustryColumns:{value:assetRegistry.get('industries').columns,type:'f32'},uResolution:{value:new Float32Array([map.clientWidth,map.clientHeight]),type:'vec2<f32>'},uCamera:{value:new Float32Array([0,0]),type:'vec2<f32>'},uScale:{value:1,type:'f32'},uN:{value:64,type:'f32'},uTime:{value:0,type:'f32'},uWind:{value:new Float32Array([wind.vector.x,wind.vector.y]),type:'vec2<f32>'},uShoreSpacing:{value:1,type:'f32'},uWavePhases:{value:new Float32Array(3),type:'vec3<f32>'},uWaveHeadings:{value:new Float32Array([ocean.previous,ocean.heading]),type:'vec2<f32>'},uWaveCycle:{value:0,type:'f32'},uWaveBlend:{value:1,type:'f32'},uWaveStrength:{value:0,type:'f32'},uFieldSpacing:{value:5,type:'f32'},uFieldAge:{value:0,type:'f32'},uWaveOffset:{value:new Float32Array(2),type:'vec2<f32>'},uGrid:{value:0,type:'f32'},uLayer:{value:0,type:'f32'}}},padding:0,resolution:1});
 plane=new PIXI.Sprite(PIXI.Texture.WHITE);plane.width=map.clientWidth;plane.height=map.clientHeight;plane.filters=[filter];plane.filterArea=new PIXI.Rectangle(0,0,map.clientWidth,map.clientHeight);app.stage.addChild(plane);
 townRenderer=new TownRenderer(app);
 portRenderer=new PortRenderer(app,dockAtlas,harborAtlas);
 industryIconRenderer=new IndustryIconRenderer(app,new Map([['industry:icons',industryIcons]]));
 const merchantStatus=document.createElement('p');merchantStatus.id='merchant-status';merchantStatus.setAttribute('role','status');$('dev-debug-controls').append(merchantStatus);
 merchantTraffic=new MerchantTraffic({app,onConfiguration:worldConfigurationResult,onInfrastructure:()=>{mapSource?.update();townRenderer.setWorld(world);portRenderer.setWorld(world);industryIconRenderer.setWorld(world);industryByTile.clear();for(const industry of world.industries)industryByTile.set(industry.tileIndex,industry);indexPortTiles();},getWorld:()=>world,getWind:()=>wind.vector,getField:()=>windField,getBasePort:launchPort,getPlayer:()=>sailingTest?.ship,status:merchantStatus,getFrames:async type=>sailingTest.frameCache.get(type)??sailingTest.framesFor(type,await sailingTest.loadAtlas(type))});
 shipInspector=new ShipInspector({parent:map.parentElement,getTraffic:()=>merchantTraffic,getShips:activeShips,onLocate:ship=>{camera={x:ship.x,y:ship.y};scale=Math.max(scale,BUILDING_SCALE);if(sailingTest?.ship)sailingTest.follow.checked=false;sync();}});
 $('fleet-list').onclick=()=>shipInspector.open('fleet');
 portDashboard=new PortDashboard({getWorld:()=>world,getLedgerData:ledgerDataForPort,onMarketCommodity:selectPortMarketCommodity,onMarketRange:selectPortMarketRange});
 economicOverview=new EconomicOverview({button:$('economic-overview'),getTraffic:()=>merchantTraffic});
 $('simulation-speed').oninput=()=>{simulationSpeed=Number($('simulation-speed').value);$('simulation-speed-out').value=simulationSpeed+'×';merchantTraffic.setSimulationSpeed(simulationSpeed);};
 new DevIndustryConstructionPanel({parent:$('dev-debug-controls'),getWorld:()=>world,getTraffic:()=>merchantTraffic});
 new DevIndustryTuningPanel({parent:$('dev-debug-controls'),getWorld:()=>world});
 bridgeUI=new BridgeUI({app,parent:$('dev-debug-controls'),getTraffic:()=>merchantTraffic,getPlayer:()=>sailingTest?.ship});
 const debugLabel=document.createElement('label'),debugRoutes=document.createElement('input');debugRoutes.type='checkbox';debugRoutes.id='merchant-debug-routes';debugLabel.append(debugRoutes,document.createTextNode(' Show planned routes (debug)'));merchantStatus.after(debugLabel);debugRoutes.onchange=()=>merchantTraffic.setDebugRoutes(debugRoutes.checked);
 const panicButton=document.createElement('button');panicButton.textContent='Recover stuck AI';panicButton.onclick=()=>merchantTraffic.recoverStuck();debugLabel.after(panicButton);
 const densityLabel=document.createElement('label'),densitySlider=document.createElement('input'),densityValue=document.createElement('output');densityLabel.className='traffic-density';densityLabel.textContent='Merchant traffic: ';densitySlider.type='range';densitySlider.id='merchant-density';densitySlider.min='0';densitySlider.max='100';densitySlider.step='1';densitySlider.value='6';densitySlider.setAttribute('aria-label','Merchant traffic density');densityValue.textContent='6 merchants';densityLabel.append(densityValue,densitySlider);panicButton.after(densityLabel);densitySlider.oninput=()=>densityValue.textContent=densitySlider.value+' merchants';densitySlider.onchange=()=>merchantTraffic.setDensity(Number(densitySlider.value));
 window.addEventListener('pagehide',()=>merchantTraffic.stop(),{once:true});
 sailingTest=new SailingTest({app,map,atlas:sloopAtlas,loadAtlas:async type=>{const atlas=await loadAsset('ship:'+type);atlas.source.scaleMode='linear';atlas.source.autoGenerateMipmaps=true;atlas.source.mipLevelCount=1+Math.floor(Math.log2(Math.max(atlas.width,atlas.height)));atlas.source.mipmapFilter='linear';atlas.source.update();return atlas;},getWorld:()=>world,getWind:()=>wind.vector,getField:()=>windField,getFaction:launchPort,getAnchor:()=>launchPort()?.dockPosition||{x:world.bounds.width/2,y:world.bounds.height/2},onActiveChange:active=>{if(active)playerRegistrationPort=launchPort();else{merchantTraffic.worker?.postMessage({type:'player',ship:null});shipHoverPointer=null;shipTooltipVisible=false;$('inspect').hidden=true;if(shipInspector.selected==='player')shipInspector.reset();}$('test-ship').textContent=active?'Withdraw vessel':'Launch own vessel';},onFollow:(ship,start)=>{camera={x:ship.x,y:ship.y};if(start)scale=BUILDING_SCALE*1.5;if(map.clientWidth<650)camera.y+=map.clientHeight*.22/scale;sync();}});
 cloudFilter=new PIXI.Filter({glProgram:PIXI.GlProgram.from({vertex,fragment:cloudFragment,preferredFragmentPrecision:'highp'}),resources:{cloudUniforms:{uResolution:{value:new Float32Array([map.clientWidth,map.clientHeight]),type:'vec2<f32>'},uCamera:{value:new Float32Array(2),type:'vec2<f32>'},uScale:{value:1,type:'f32'},uTime:{value:0,type:'f32'},uFlow:{value:new Float32Array(2),type:'vec2<f32>'}}},padding:0,resolution:.5});
 sailingTest.docking=new PlayerDocking({parent:$('ship-settings-body'),getWorld:()=>world,requestDock:(...args)=>merchantTraffic.requestDock(...args),releaseDock:()=>merchantTraffic.releaseDock(),markDock:status=>merchantTraffic.markDock(status)});
 cloudPlane=new PIXI.Sprite(PIXI.Texture.WHITE);cloudPlane.width=map.clientWidth;cloudPlane.height=map.clientHeight;cloudPlane.filters=[cloudFilter];cloudPlane.filterArea=new PIXI.Rectangle(0,0,map.clientWidth,map.clientHeight);cloudPlane.eventMode='none';app.stage.addChild(cloudPlane);
 app.stage.addChild(bridgeUI.heat);
 new ResizeObserver(entries=>{for(const entry of entries)map.parentElement.style.setProperty('--map-hud-height',`${entry.contentRect.height}px`);}).observe(document.querySelector('.map-hud'));
 new ResizeObserver(()=>{const w=map.clientWidth,h=map.clientHeight;app.renderer.resize(w,h);plane.width=w;plane.height=h;cloudPlane.width=w;cloudPlane.height=h;cloudPlane.filterArea=new PIXI.Rectangle(0,0,w,h);plane.filterArea=new PIXI.Rectangle(0,0,w,h);sync();}).observe(map);
 let elapsed=0,frames=0,windUIElapsed=0;const windUniform=new Float32Array(2),waveOffset=new Float32Array(2),waveHeadings=new Float32Array(2);app.ticker.maxFPS=60;app.ticker.add(t=>{const benchmarkTickStart=benchmarkRunning?performance.now():0;const applied=applicationController.activate('next_frame',{frame:++frameNumber});if(applied?.status==='accepted'){applicationSettings=applicationHolder.settings;sync();}const uniforms=filter.resources.worldUniforms.uniforms;
 if($('animate').checked&&!document.hidden){const speed=merchantTraffic.worker?(merchantTraffic.effectiveSpeed??simulationSpeed):1,steps=Math.ceil(speed),dt=Math.min(t.deltaMS/1000,.1)*speed/steps;for(let i=0;i<steps;i++){uniforms.uTime+=dt;wind.update(dt,$('wind-drift').checked);ocean.update(dt,wind);uniforms.uWavePhases=ocean.phases;uniforms.uWaveCycle=ocean.cycle;waveHeadings[0]=ocean.previous;waveHeadings[1]=ocean.heading;uniforms.uWaveHeadings=waveHeadings;uniforms.uWaveBlend=ocean.blend;uniforms.uWaveStrength=ocean.speed;if(windField){if(windField.update(dt,wind.vector))windSource.update();uniforms.uFieldAge=windField.age;}}}
 const vector=wind.vector;windUniform[0]=vector.x;windUniform[1]=vector.y;uniforms.uWind=windUniform;waveOffset[0]=wind.offset.x;waveOffset[1]=wind.offset.y;uniforms.uWaveOffset=waveOffset;cloudFilter.resources.cloudUniforms.uniforms.uFlow=waveOffset;cloudFilter.resources.cloudUniforms.uniforms.uTime=uniforms.uTime;cloudPlane.visible=$('layer').value==='0';
 if(!document.hidden&&!generating&&!benchmarkRunning){const resolution=renderBudget.update(t.elapsedMS/1000);if(resolution!==null){filter.resolution=resolution;cloudFilter.resolution=resolution*.5;}}
 const sailingRate=merchantTraffic.worker?(merchantTraffic.effectiveSpeed??simulationSpeed):1,sailingSteps=Math.ceil(sailingRate);for(let i=0;i<sailingSteps;i++)sailingTest.update(Math.min(t.deltaMS/1000,.1)*sailingRate/sailingSteps);sailingTest.render(camera,scale,map.clientWidth,map.clientHeight);
 merchantTraffic.update(t.deltaMS/1000);merchantTraffic.render(camera,scale,map.clientWidth,map.clientHeight);
 bridgeUI.render(camera,scale,map.clientWidth,map.clientHeight);
 windUIElapsed+=t.deltaMS;if(windUIElapsed>250){windUIElapsed=0;windUI();refreshShipTooltip();refreshPortTooltip();bridgeUI.refresh();shipInspector.refresh();economicOverview.refresh();if(portDashboard?.dialog?.open&&portDashboard.port)requestPortLedger(portDashboard.port);portDashboard.refresh();$('simulation-clock').textContent=merchantTraffic.worker?'Tick '+(merchantTraffic.bridgeState?.tick??0)+' · '+(merchantTraffic.effectiveSpeed??simulationSpeed).toFixed(1)+'× actual':'Simulation not started';}
 elapsed+=t.elapsedMS;frames++;if(elapsed>1000){$('performance').textContent=`${Math.round(frames*1000/elapsed)} FPS · WebGL2`;elapsed=0;frames=0;}if(benchmarkRunning&&benchmarkTickStart)benchmarkMainSamples.push(performance.now()-benchmarkTickStart);});
 app.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();$('loading').textContent='Graphics connection lost. Reload to restore the chart.';$('loading').hidden=false;});
 ready=true;busy(false);$('dev-ready-status').textContent='Ready for testing. Configure options, then generate a world.';$('dev-world-button').disabled=false;$('dev-start-world').disabled=false;$('dev-world-benchmark').disabled=false;$('dev-simulation-benchmark').disabled=false;mode('home');registerTools();
}catch(e){console.error(e);fail('Unable to start the map. '+e.message);}}
function registerTools(){if(!document.modelContext?.registerTool)return;const lifecycle=new AbortController();window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});const properties={seed:{type:'string',minLength:1,maxLength:64},size:{type:'integer',enum:[32,64,128,256,512]},...Object.fromEntries(fields.map(k=>[k,{type:'number',minimum:k==='density'?10:0,maximum:k==='density'?90:100}]))};try{Promise.resolve(document.modelContext.registerTool({name:'generate_terrain',title:'Generate terrain',description:'Apply terrain settings and generate a new seeded archipelago in the workshop.',inputSchema:{type:'object',properties,additionalProperties:false},annotations:{readOnlyHint:false},async execute(input){if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Expected terrain settings');for(const[k,v]of Object.entries(input)){const p=properties[k];if(!p)throw Error('Unknown setting: '+k);if(k==='seed'){if(typeof v!=='string'||!v.trim()||v.length>64)throw Error('Invalid seed');}else if(typeof v!=='number'||!Number.isFinite(v)||(p.enum?!p.enum.includes(v):v<p.minimum||v>p.maximum))throw Error('Invalid '+k);}if(generating||!ready)throw Error('Map is busy');for(const[k,v]of Object.entries(input))$(k).value=v;for(const k of fields)$(k+'-out').value=$(k).value+'%';$('tile-count').textContent=(Number($('size').value)**2).toLocaleString()+' hexes';return await generate();}},{signal:lifecycle.signal})).catch(console.warn);}catch(e){console.warn(e);}}
init();
