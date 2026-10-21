import type {SIMULATION_SETTINGS} from './simulation-settings.js';
import type {Stockpile} from './economy.js';
export interface Point{x:number;y:number;}
export interface LocatedPort{id:string;position?:Point;dockPosition?:Point;source?:{dockPosition:Point};}
export interface PortDistanceMetrics{averageTransitDistance:number;connectedPairs:number;portCount:number;components:Array<{id:string;component:number}>;}
export interface SimulationScaling{metrics:PortDistanceMetrics;settings:typeof SIMULATION_SETTINGS;urgencyTicks:number;ledgerMaxAge:number;queueReviewTicks:number;jobReviewTicks:number;expectedTransitTicks:number;contractDeadline(currentTick:number,a:LocatedPort,b:LocatedPort):number;}
export function portPoint(port:LocatedPort):Point;
export function hexStepDistance(a:Point,b:Point):number;
export function measurePortDistances(world:{n:number;h:Float32Array;ports?:LocatedPort[]},ports?:LocatedPort[]):Readonly<PortDistanceMetrics>;
export function createSimulationScaling(metrics:PortDistanceMetrics,overrides?:Partial<typeof SIMULATION_SETTINGS>):Readonly<SimulationScaling>;
export function procurementCoverage(stock:Stockpile,scaling:SimulationScaling):Readonly<{commodityId:string;coverageTicks:number;urgencyTicks:number;urgent:boolean}>;
