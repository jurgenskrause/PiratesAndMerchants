import type {EconomicEngine} from './economy.js';
import type {IndustryInstanceContract} from './industry-contract.js';
export interface IndustryProject {
 id:string;instanceId:string;portId:string;typeId:string;site:{q:number;r:number;tileIndex:number;path:{q:number;r:number}[]};
 state:'BUILDING'|'COMPLETE'|'REMOVED';elapsedSeconds:number;durationSeconds:number;materials:Record<string,number>;capitalUnits:number;
 commitmentId:string;reservationId:string;location:string;accountId:string;descriptor:IndustryInstanceContract;
}
export interface ConstructionEffects {apply?:(instance?:IndustryInstanceContract)=>void;rollback?:()=>void;}
export class IndustryConstructionEngine {
 constructor(options:{world:any;economy:EconomicEngine;traffic?:any;registry?:any;afterPlacement?:(factory:any)=>void});
 start(input:{portId:string;typeId:string;site?:{q:number;r:number}|null;id?:string|null},effects?:ConstructionEffects):IndustryProject;
 snapshot():(IndustryProject & {error:string|null})[];
 tick(dt:number):void;complete(id:string):IndustryProject;remove(instanceId:string):IndustryProject;
}
