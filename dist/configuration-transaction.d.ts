import type {ConfigurationSnapshot,Diagnostic} from './configuration-registry.js';
import type {WorldSubsystemSettings,ApplicationSubsystemSettings} from './compiled-configuration.js';
export interface ConfigurationChangeRequest {
 readonly type?:'configuration-request'|'configuration-restart'|'configuration-cancel';
 readonly requestId:number;readonly sessionId:string;readonly baseRevision:number;
 readonly edits?:Readonly<Record<string,boolean|number|string>>;
}
export interface ConfigurationAcknowledgement {
 readonly type:'configuration-result';readonly requestId:number|null;readonly sessionId:string;
 readonly scope:'application'|'world';readonly status:'accepted'|'rejected'|'pending'|'restart-required';
 readonly activeRevision:number;readonly revision?:number;readonly newSessionId?:string;
 readonly activationBoundary?:'unchanged'|'next_frame'|'next_tick'|'simulation_restart'|'new_world';
 readonly position?:Readonly<{tick?:number;time?:number;frame?:number}>;
 readonly selectedSnapshot:ConfigurationSnapshot;readonly snapshot?:ConfigurationSnapshot;
 readonly diagnostics?:readonly Diagnostic[];
}
export interface PreparedConfiguration {
 readonly snapshot:ConfigurationSnapshot;readonly compiled:WorldSubsystemSettings|ApplicationSubsystemSettings;
 readonly changed:readonly string[];readonly boundary:string;
}
export interface ConfigurationReplacement {readonly target:object;readonly key:string;readonly value:unknown;}
export function atomicReplace(writes:readonly ConfigurationReplacement[]):void;
export class ConfigurationTransaction {
 constructor(options:{snapshot:ConfigurationSnapshot;sessionId:string;role?:'developer'|'local_user'|'host'|'world_owner';prepare?:(candidate:PreparedConfiguration,context:{preflight:boolean})=>readonly ConfigurationReplacement[];notify?:(message:ConfigurationAcknowledgement)=>void});
 readonly active:ConfigurationSnapshot;readonly selected:ConfigurationSnapshot;
 readonly compiled:WorldSubsystemSettings|ApplicationSubsystemSettings;readonly sessionId:string;
 readonly pending:PreparedConfiguration|null;readonly deferred:PreparedConfiguration|null;
 request(request:ConfigurationChangeRequest):ConfigurationAcknowledgement;
 activate(boundary:'next_tick'|'next_frame',position?:{tick?:number;time?:number;frame?:number}):ConfigurationAcknowledgement|null;
 cancel(reason?:string):void;
}
