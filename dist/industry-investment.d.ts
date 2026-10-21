import type {EconomicEngine} from './economy.js';
import type {IndustryConstructionEngine} from './industry-construction.js';
import type {WorldSubsystemSettings} from './compiled-configuration.js';
export class IndustryInvestmentGovernor {
 constructor(input:{world:any;economy:EconomicEngine;construction:IndustryConstructionEngine;settings?:WorldSubsystemSettings;canTrade?:(receiverPortId:string,sourcePortId:string)=>boolean});
 observeVisit(portId:string,shipId:string,ledger:any,now:number,visitId:string|number):void;
 reserve(portId:string):number;review(portId:string,now:number):void;tick(now:number):void;
 snapshot(portId?:string|null,now?:number):any;
}
