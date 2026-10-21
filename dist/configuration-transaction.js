import {configurationRegistry} from './configuration-registry.js?v=babbc3d3950e';
import {compileWorldConfiguration,compileApplicationConfiguration} from './compiled-configuration.js?v=babbc3d3950e';
const freeze=value=>{if(value&&typeof value==='object'){for(const v of Object.values(value))freeze(v);Object.freeze(value);}return value;};
const error=(id,message,keys=[])=>({id,setting_ids:keys,severity:'error',message,source:'validator'});
const plain=value=>value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
// Owner plans contain data writes only: no arbitrary commit callbacks or setters.
// Preparation is pure. All descriptors are checked before the first replacement.
function replacementJournal(writes){
 if(!Array.isArray(writes))throw TypeError('Owner must return a write plan');
 const journal=[],seen=new Map();
 for(const w of writes){if(!w?.target||typeof w.key!=='string')throw TypeError('Invalid replacement');const keys=seen.get(w.target)??new Set();if(keys.has(w.key))throw TypeError('Duplicate replacement');keys.add(w.key);seen.set(w.target,keys);const old=Object.getOwnPropertyDescriptor(w.target,w.key);if(old? !Object.hasOwn(old,'value')||!old.writable:!Object.isExtensible(w.target))throw TypeError('Replacement requires a writable data field: '+w.key);journal.push({...w,old});}
 return journal;
}
export function atomicReplace(writes){
 const journal=replacementJournal(writes);let applied=0;try{for(const w of journal){Object.defineProperty(w.target,w.key,w.old?{...w.old,value:w.value}:{value:w.value,writable:true,configurable:true,enumerable:true});applied++;}}catch(cause){for(let i=applied-1;i>=0;i--){const w=journal[i];if(w.old)Object.defineProperty(w.target,w.key,w.old);else delete w.target[w.key];}throw cause;}
}
export class ConfigurationTransaction{
 constructor({snapshot,sessionId,role='developer',prepare=()=>[],notify=()=>{}}){this.registry=configurationRegistry;this.active=this.registry.reconstruct(snapshot);this.selected=this.active;this.sessionId=sessionId;this.role=role;this.prepare=prepare;this.notify=notify;this.pending=null;this.deferred=null;this.lastRequestId=0;this.compiled=this.compile(this.active);}
 compile(snapshot){return snapshot.scope==='world'?compileWorldConfiguration(snapshot):compileApplicationConfiguration(snapshot);}
 response(request,status,extra={}){const message=freeze({type:'configuration-result',requestId:request?.requestId??null,sessionId:this.sessionId,scope:this.active.scope,status,activeRevision:this.active.revision,selectedSnapshot:this.selected,...extra});try{this.notify(message);}catch{/* Delivery failure must not undo a committed revision. */}return message;}
 reject(request,id,message,keys=[]){return this.response(request,'rejected',{diagnostics:[error(id,message,keys)]});}
 check(request){if(!plain(request)||!Number.isSafeInteger(request.requestId)||request.requestId<=this.lastRequestId)return 'Invalid or repeated request ID';this.lastRequestId=request.requestId;if(request.sessionId!==this.sessionId)return 'Obsolete session';if(request.baseRevision!==this.active.revision)return 'Stale base revision';return null;}
 request(request){
  const conflict=this.check(request);if(conflict)return this.reject(request,'configuration.conflict',conflict);
  if(this.pending||this.deferred)return this.reject(request,'configuration.busy','Complete or cancel the outstanding batch first');
  const result=this.registry.validateBatch(this.active,request.edits);if(!result.ok)return this.response(request,'rejected',{diagnostics:result.diagnostics});
  const changed=Object.keys(request.edits).filter(id=>this.active.values[id]!==result.candidate.values[id]);
  for(const id of changed){const d=this.registry.get(id);if(d.permission!==this.role&&!(this.role==='developer')&&!(this.role==='local_user'&&d.permission==='local_user'))return this.reject(request,'configuration.permission','Change permission denied',[id]);}
  if(!changed.length)return this.response(request,'accepted',{revision:this.active.revision,activationBoundary:'unchanged',snapshot:this.active,diagnostics:result.diagnostics});
  try{
   const compiled=this.compile(result.candidate),modes=changed.map(id=>this.registry.get(id).apply_mode),boundary=modes.includes('new_world')?'new_world':modes.includes('simulation_restart')?'simulation_restart':this.active.scope==='world'?'next_tick':'next_frame';
   const prepared={request:{requestId:request.requestId},snapshot:result.candidate,compiled,changed:Object.freeze(changed),boundary,diagnostics:result.diagnostics};
   if(['new_world','simulation_restart'].includes(boundary)){this.deferred=prepared;this.selected=prepared.snapshot;return this.response(request,'restart-required',{revision:prepared.snapshot.revision,activationBoundary:boundary,snapshot:prepared.snapshot,diagnostics:prepared.diagnostics});}
   // Preflight checks ownership and dependencies without writing active state.
   replacementJournal(this.prepare(prepared,{preflight:true}));this.pending=prepared;this.selected=prepared.snapshot;
   return this.response(request,'pending',{revision:prepared.snapshot.revision,activationBoundary:boundary,snapshot:prepared.snapshot,diagnostics:prepared.diagnostics});
  }catch(cause){return this.reject(request,'configuration.preparation',cause.message,changed);}
 }
 activate(boundary,position={}){
  const p=this.pending;if(!p||p.boundary!==boundary)return null;
  try{
   // Rebuild the plan against current entities: intervening player/traffic messages
   // may have changed membership while a paused request waited for a boundary.
   const writes=this.prepare(p,{preflight:false});atomicReplace([...writes,{target:this,key:'active',value:p.snapshot},{target:this,key:'compiled',value:p.compiled},{target:this,key:'selected',value:p.snapshot}]);this.pending=null;
   return this.response(p.request,'accepted',{revision:this.active.revision,activationBoundary:boundary,position,snapshot:this.active,diagnostics:p.diagnostics});
  }catch(cause){this.pending=null;this.selected=this.active;return this.reject(p.request,'configuration.application',cause.message,p.changed);}
 }
 cancel(reason='Session replaced'){if(this.pending)this.reject(this.pending.request,'configuration.cancelled',reason);this.pending=null;this.deferred=null;this.selected=this.active;}
}
