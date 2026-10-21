export type ConfigurationValue=number|boolean|string;
export type ConfigurationScope='application'|'world';
export interface SettingDefinition {
 readonly id:string; readonly type:'integer'|'number'|'boolean'|'enum';
 readonly default:ConfigurationValue; readonly min?:number; readonly max?:number; readonly step?:number;
 readonly options?:readonly string[]; readonly label:string; readonly description:string;
 readonly category:string; readonly unit:string; readonly user_settable:boolean;
 readonly scope:ConfigurationScope;
 readonly apply_mode:'next_frame'|'next_tick'|'simulation_restart'|'new_world';
 readonly permission:'local_user'|'world_owner'|'host'|'developer';
}
export interface ConfigurationSnapshot {
 readonly format_version:1; readonly revision:number; readonly scope:ConfigurationScope;
 readonly values:Readonly<Record<string,ConfigurationValue>>;
}
export class ConfigurationRegistry {
 constructor(definitions:readonly SettingDefinition[],schema:object,options?:{constraints?:readonly ConstraintDefinition[];constraintSchema?:object;validators?:readonly DomainValidator[]});
 get(id:string):SettingDefinition;
 definitions(scope?:ConfigurationScope|null):readonly SettingDefinition[];
 selected(overrides?:Record<string,ConfigurationValue>):Readonly<Record<string,ConfigurationValue>>;
 resolve(overrides?:Record<string,ConfigurationValue>,options?:{scope?:ConfigurationScope;revision?:number}):ConfigurationSnapshot;
 reconstruct(input:unknown):ConfigurationSnapshot;
 validateSnapshot(input:unknown):ValidationResult;
 validateBatch(active:ConfigurationSnapshot,edits:Record<string,ConfigurationValue>,options?:{revision?:number}):ValidationResult;
 validateSelections(overrides?:Record<string,ConfigurationValue>,options?:{revision?:number}):ValidationResult & {readonly selected:Readonly<Record<string,ConfigurationValue>>|null;readonly session:Readonly<{application:ConfigurationSnapshot;world:ConfigurationSnapshot}>|null};
 serialize(snapshot:ConfigurationSnapshot):string;
 deserialize(text:string):ConfigurationSnapshot;
}
export const CONFIGURATION_FORMAT_VERSION:1;
export const configurationRegistry:ConfigurationRegistry;
export const developerSelectedValues:Readonly<Record<string,ConfigurationValue>>;
export function createConfigurationSession(overrides?:Record<string,ConfigurationValue>,options?:{revision?:number}):Readonly<{application:ConfigurationSnapshot;world:ConfigurationSnapshot}>;

export interface ConstraintDefinition {
 readonly id:string; readonly setting_ids:readonly string[];
 readonly operator:'less_than_or_equal'|'required_when'|'mutually_exclusive'|'integer_multiple'|'compatible_timing_intervals';
 readonly args:Readonly<Record<string,ConfigurationValue>>; readonly severity:'error'|'warning'; readonly message:string;
}
export interface Diagnostic {readonly id:string;readonly setting_ids:readonly string[];readonly severity:'error'|'warning';readonly message:string;readonly source:'constraint'|'validator'|'setting'|'snapshot';}
export interface DomainValidator {
 readonly id:string;readonly scope:ConfigurationScope;readonly setting_ids:readonly string[];
 readonly validate:(values:Readonly<Record<string,ConfigurationValue>>)=>readonly {readonly severity:'error'|'warning';readonly message:string;readonly setting_ids?:readonly string[]}[];
}
export interface ValidationResult {readonly ok:boolean;readonly candidate:ConfigurationSnapshot|Readonly<{application:ConfigurationSnapshot;world:ConfigurationSnapshot}>|null;readonly diagnostics:readonly Diagnostic[];readonly errors:readonly Diagnostic[];readonly warnings:readonly Diagnostic[];}
export class ConfigurationValidationError extends TypeError {readonly diagnostics:readonly Diagnostic[];}
