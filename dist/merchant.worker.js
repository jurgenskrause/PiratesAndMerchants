import {portEconomicInfo,portCargoHistories} from './port-economic-info.js?v=babbc3d3950e';
import {EconomicHistory} from './economic-history.js?v=babbc3d3950e';
import {ConfigurationTransaction} from './configuration-transaction.js?v=babbc3d3950e';
import {prepareWorldActivation} from './runtime-configuration-owner.js?v=babbc3d3950e';
import {configurationRegistry} from './configuration-registry.js?v=babbc3d3950e';
import {FACTIONS} from './economy.js?v=babbc3d3950e';
import {SimulationRuntime} from './simulation-runtime.js?v=babbc3d3950e';
import {settingsForWorld} from './compiled-configuration.js?v=babbc3d3950e';
import {createMerchantSession,merchantSnapshots,setMerchantDensity} from './merchant-session.js?v=babbc3d3950e';
import {VoyageJournal} from './voyage-journal.js?v=babbc3d3950e';
import {SHIP_TYPES} from './fleet.js?v=babbc3d3950e';
let economicHistory=null;
let controller=null,sessionSerial=0,initialWorld=null,startOptions=null;
let runtime=null,session=null,harbor=null,playerRequest=null,timer=null,publishTime=0,simulationTime=0,wind={x:0,y:-1},paused=false;
let inspectedPort=null,supplies=null,suppliesTime=-Infinity;
let lastPublishWall=0,lastPublishSimulation=0,effectiveSpeed=1,playerJournal=null,playerOrigin=null;
let simulationSpeed=1,inspectedShip=null,detailsAt=-Infinity,shipDetails=null,lastTickMs=null;
let playerDockedPort=null,heatFaction=null,bridgeSnapshot=null,bridgePublishAt=-Infinity;
function publish(){const now=performance.now();if(now-lastPublishWall>=50){effectiveSpeed=Math.max(.1,Math.min(simulationSpeed,(simulationTime-lastPublishSimulation)/((now-lastPublishWall)/1000)));lastPublishWall=now;lastPublishSimulation=simulationTime;}if(inspectedShip&&simulationTime>=detailsAt){detailsAt=simulationTime+1;const e=session.logistics;shipDetails=inspectedShip==='player'?{id:'player',tick:e.currentTick,ledger:e.playerLedger.knowledge(e.currentTick),voyages:playerJournal.snapshot()}:e.agents.has(inspectedShip)?{id:inspectedShip,tick:e.currentTick,runningCosts:e.state(inspectedShip).runningCosts.snapshot(),financialAccounts:Object.fromEntries(Object.entries(e.state(inspectedShip).financialAccountIds).map(([key,id])=>[key,session.economy.accounts.inspect(id)])),water:e.getAgentState(inspectedShip,{includeKnowledge:false}).water_status,morale:e.state(inspectedShip).morale,ledger:e.state(inspectedShip).PriceLedger.knowledge(e.currentTick),voyages:e.state(inspectedShip).journal.snapshot(),trade:{state:e.state(inspectedShip).state,purpose:e.state(inspectedShip).jobPurpose,wallet:e.state(inspectedShip).wallet,cargo:[...e.state(inspectedShip).manifest.values()],physicalCargo:session.economy.getPhysicalShipCargo(inspectedShip),pendingTransfers:session.economy.getPendingTransfers(inspectedShip),inventory:session.economy.getShipInventory(inspectedShip),losses:session.economy.getGoodsLossHistory(inspectedShip),expectedProfitMatrix:e.state(inspectedShip).matrix,abortReason:e.state(inspectedShip).abortReason??null,planningError:e.state(inspectedShip).planningError??null,turnaroundWaitSeconds:e.state(inspectedShip).turnaround?.emptySince==null?null:Math.max(0,e.time-e.state(inspectedShip).turnaround.emptySince),wind,worldConfig:session.logistics.world.config},navigation:{mode:e.state(inspectedShip).helmsman.mode,...e.state(inspectedShip).helmsman.safety.telemetry}}:null;}if(inspectedPort&&session.economy&&simulationTime-suppliesTime>=1){supplies=(session.logistics?.market??session.economy).getPortSupplies(inspectedPort);suppliesTime=simulationTime;}const bridge=session.logistics;const infrastructure=(harbor?.drainInfrastructureChanges?.()??[]).map(change=>({...change,industries:structuredClone((session.world.industries??[]).filter(i=>i.portId===change.id))}));if(bridge?.playerLedger&&simulationTime>=bridgePublishAt){bridgePublishAt=simulationTime+1;bridgeSnapshot={tick:bridge.currentTick,playerLedger:bridge.playerLedger.knowledge(bridge.currentTick),diplomacy:bridge.diplomacy.snapshot(),heatFaction,threat:heatFaction?bridge.threatGrid.snapshot(heatFaction,bridge.diplomacy):[],maxThreat:bridge.threatGrid.maxThreat};}self.postMessage({type:'state',sessionId:controller?.sessionId,configurationRevision:runtime?.settings.revision,simulationTime,simulationSpeed,effectiveSpeed,benchmarkTickMs:lastTickMs,shipDetails,ships:merchantSnapshots(session),bridge:bridgeSnapshot,note:session.note,portSupplies:supplies?{portId:inspectedPort,stocks:supplies}:null,infrastructure,portInfrastructure:inspectedPort&&harbor?.manager(inspectedPort)?{portId:inspectedPort,...harbor.queueStats(inspectedPort),docks:harbor.manager(inspectedPort).docks}:null,playerReservation:playerRequest?{requestId:playerRequest,...harbor.get('player')}:null});}
self.onmessage=({data})=>{
 if(data.type==='industry-construction'){
  if(!session?.logistics||data.sessionId!==controller.sessionId||data.baseRevision!==runtime.settings.revision){self.postMessage({type:'industry-construction',sessionId:controller?.sessionId,requestId:data.requestId,error:'Start the simulation and use its current configuration'});return;}
  try{const engine=session.logistics.industryConstruction;const result=data.action==='build'?engine.start({portId:data.portId,typeId:data.typeId,site:data.site??null,id:'developer-build:'+data.requestId}):data.action==='remove'?engine.remove(data.instanceId):data.action==='inspect'?engine.snapshot():null;if(result===null)throw Error('Unknown construction operation');self.postMessage({type:'industry-construction',sessionId:controller.sessionId,requestId:data.requestId,result});publish();}
  catch(error){self.postMessage({type:'industry-construction',sessionId:controller.sessionId,requestId:data.requestId,error:error.message});}return;
 }
 if(data.type?.startsWith('configuration-')){configurationMessage(data);return;}
 try{
  if(data.type==='start'){
   install(prepareStart(data));
  }else if((data.type==='port-economy'||data.type==='port-cargo-history')&&session?.economy){
   if(data.sessionId!==controller.sessionId)return;
   try{const payload=data.type==='port-economy'?{info:{...portEconomicInfo(session.economy,data.portId,{world:session.world,time:simulationTime,harbor,knowledge:session.logistics.portLedgers.get(data.portId)?.knowledge(session.logistics.currentTick)??[]}),investmentReview:session.logistics.industryInvestment.snapshot(data.portId,session.logistics.currentTick)}}:{histories:portCargoHistories(economicHistory,session.economy.commodityIds,data.portId)};self.postMessage({type:data.type,sessionId:controller.sessionId,requestId:data.requestId,portId:data.portId,...payload});}
   catch(error){self.postMessage({type:data.type,sessionId:controller.sessionId,requestId:data.requestId,portId:data.portId,error:error.message});}
  }else if(data.type==='economic-accounts'&&session?.economy){if(data.sessionId!==controller.sessionId)return;self.postMessage({type:'economic-accounts',sessionId:controller.sessionId,requestId:data.requestId,finances:session.economy.getFinancialSnapshot()});}else if(data.type==='economic-history'&&economicHistory){if(data.sessionId!==controller.sessionId)return;try{self.postMessage({type:'economic-history',sessionId:controller.sessionId,requestId:data.requestId,history:economicHistory.snapshot(data.commodityId)});}catch(error){self.postMessage({type:'economic-history',sessionId:controller.sessionId,requestId:data.requestId,error:error.message});}}else if(data.type==='environment'&&session?.logistics){wind=data.wind;session.logistics.windField=data.field;startOptions.field=data.field;}
  else if(data.type==='player'&&session?.logistics){const p=data.ship;session.logistics.setExternalVessels(p?[{...p,id:'player',spec:SHIP_TYPES[p.type]}]:[]);}
  else if(data.type==='dock-request'&&harbor){playerRequest=data.requestId;harbor.request('player',data.portId,SHIP_TYPES[data.ship.type]);publish();}
  else if(data.type==='dock-state'&&harbor&&data.requestId===playerRequest){if(data.status==='PIER_END')harbor.redirectToEnd('player');else harbor.mark('player',data.status);playerDockedPort=data.status==='MOORED'?harbor.get('player')?.portId:null;if(playerDockedPort){session.logistics?.dockPlayer?.(playerDockedPort);playerJournal.complete(playerDockedPort,session.logistics.currentTick,0);playerOrigin=playerDockedPort;detailsAt=-Infinity;}bridgePublishAt=-Infinity;publish();}
  else if(data.type==='dock-release'&&harbor){harbor.release('player');playerRequest=null;playerDockedPort=null;if(!playerJournal.current)playerJournal.begin(playerOrigin,null,session.logistics.currentTick,0);publish();}
  else if(data.type==='bridge-heatmap'){heatFaction=FACTIONS.includes(data.faction)?data.faction:null;bridgePublishAt=-Infinity;publish();}
  else if(data.type==='simulation-speed'){if(Number.isInteger(data.speed)&&data.speed>=1&&data.speed<=20){simulationSpeed=data.speed;effectiveSpeed=data.speed;lastPublishWall=performance.now();lastPublishSimulation=simulationTime;}}
  else if(data.type==='ship-details'){inspectedShip=data.id;detailsAt=-Infinity;shipDetails=null;publish();}
  else if(data.type==='pause')paused=data.paused;
  else if(data.type==='density'&&session){setMerchantDensity(session,data.count);startOptions.density=data.count;publish();}
  else if(data.type==='port-supplies'&&session?.economy){inspectedPort=data.portId;supplies=null;suppliesTime=-Infinity;publish();}
  else if(data.type==='allocate-supplies'&&session?.economy){const result=session.economy.allocateSupplies(data.portId,data.commodity,data.quantity,data.fromPool);self.postMessage({type:'allocation',requestId:data.requestId,result});if(result.ok){inspectedPort=data.portId;supplies=null;}suppliesTime=-Infinity;publish();}
  else if(data.type==='panic'&&session?.logistics){for(const id of [...session.ids,...(session.militaryIds??[])]){const a=session.logistics.getAgentState(id);if(a.stalled_seconds>=5)session.logistics.requestRecovery(id);}publish();}
 }catch(error){if(data.type!=='start'){clearInterval(timer);timer=null;}self.postMessage({type:'error',message:error.message});}
};

// Construct replacement state in isolation. The old session remains authoritative
// until all initialization and timer preparation have succeeded.
function prepareStart(data){
 if(!data.world?.configuration)throw TypeError('World configuration snapshot required');
 const world=structuredClone(data.world);world.configuration=configurationRegistry.reconstruct(world.configuration);settingsForWorld(world,{requireSnapshot:true});
 const baseline=structuredClone(world),nextSession=createMerchantSession(world,data.wind,data.field,data.basePortId,{maxShips:data.density??6,player:data.player??null,bridge:true}),nextRuntime=new SimulationRuntime(nextSession);
 const nextController=new ConfigurationTransaction({snapshot:world.configuration,sessionId:'session-'+(sessionSerial+1),prepare:p=>prepareWorldActivation(nextRuntime,p),notify:m=>self.postMessage(m)});nextRuntime.configurationController=nextController;
 const journal=new VoyageJournal();journal.begin(data.basePortId,null,0,0);
 return {world:baseline,options:{...data,world:undefined},session:nextSession,runtime:nextRuntime,controller:nextController,journal};
}
function install(next,ack){
 const nextTimer=setInterval(advance,next.runtime.settings.clock.physicsTickSeconds*1000);
 const oldTimer=timer,oldSession=session;sessionSerial++;runtime=next.runtime;session=next.session;controller=next.controller;initialWorld=next.world;startOptions=next.options;
 economicHistory?.dispose();economicHistory=session.economy?new EconomicHistory(session.economy,{clock:()=>runtime.time}):null;
 timer=nextTimer;clearInterval(oldTimer);try{oldSession?.logistics?.dispose?.();}catch(error){console.error('Retired session cleanup:',error);}wind=startOptions.wind;paused=false;simulationSpeed=Math.max(1,Math.min(20,Math.round(startOptions.simulationSpeed??1)));inspectedShip=null;shipDetails=null;detailsAt=-Infinity;effectiveSpeed=simulationSpeed;lastPublishWall=performance.now();lastPublishSimulation=0;playerJournal=next.journal;playerOrigin=startOptions.basePortId;publishTime=simulationTime=0;
 harbor=session.logistics.dockTraffic;playerRequest=null;playerDockedPort=null;heatFaction=null;bridgeSnapshot=null;bridgePublishAt=-Infinity;inspectedPort=null;supplies=null;suppliesTime=-Infinity;
 if(ack)self.postMessage({...ack,newSessionId:controller.sessionId,snapshot:controller.active,revision:controller.active.revision,activeRevision:controller.active.revision});publish();
}
function advance(){
 if(paused)return;try{
  const tickStart=performance.now(),dt=runtime.settings.clock.physicsTickSeconds,deadline=tickStart+24;
  for(let i=0;i<simulationSpeed;i++){session.logistics.wind=wind;simulationTime=runtime.step(dt);if(playerDockedPort)session.logistics.dockPlayer(playerDockedPort);if(performance.now()>=deadline)break;}
  lastTickMs=performance.now()-tickStart;publishTime+=dt;if(publishTime>=.1-1e-9){publishTime=0;publish();}
 }catch(error){clearInterval(timer);timer=null;self.postMessage({type:'error',message:error.message});}
}
function configurationMessage(data){
 if(!controller){self.postMessage({type:'configuration-result',requestId:data.requestId,status:'rejected',diagnostics:[{id:'configuration.uninitialized',severity:'error',setting_ids:[],message:'Start the simulation first'}]});return;}
 if(data.type==='configuration-request'){controller.request(data);return;}
 const conflict=controller.check(data);if(conflict){controller.reject(data,'configuration.conflict',conflict);return;}
 if(data.type==='configuration-cancel'){controller.cancel('Developer cancelled batch');controller.response(data,'accepted',{revision:controller.active.revision,activationBoundary:'unchanged',snapshot:controller.active});return;}
 if(data.type!=='configuration-restart'){controller.reject(data,'configuration.message','Unknown configuration operation');return;}
 if(controller.deferred?.boundary==='new_world'){controller.response(data,'restart-required',{revision:controller.selected.revision,activationBoundary:'new_world',snapshot:controller.selected});return;}
 try{
  const next=prepareStart({...startOptions,world:{...initialWorld,configuration:controller.selected},wind,simulationSpeed,player:null});
  const old=controller;install(next,{type:'configuration-result',requestId:data.requestId,sessionId:old.sessionId,scope:'world',status:'accepted',activationBoundary:'simulation_restart'});
  // Installation discards old pending batches. Explicitly terminate their callbacks.
  old.cancel('Simulation restarted');
 }catch(error){controller.reject(data,'configuration.restart',error.message);}
}
