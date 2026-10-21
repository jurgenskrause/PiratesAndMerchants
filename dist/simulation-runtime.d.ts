import type {ConfigurationSnapshot,ConfigurationValue} from './configuration-registry.js';
export class SimulationRuntime{
 constructor(session:{world?:{configuration?:ConfigurationSnapshot};economy?:{tick():unknown}|null;logistics?:{tick(dt:number):unknown}|null},options?:{economicTickSeconds?:number;configurationOverrides?:Record<string,ConfigurationValue>;configurationRevision?:number});
 readonly configuration:Readonly<{application:ConfigurationSnapshot;world:ConfigurationSnapshot}>;
 time:number;economicTime:number;step(dt?:number):number;
}
