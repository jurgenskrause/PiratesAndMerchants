import type {Waypoint,Vector2D,NativeWorld,WindField} from './logistics.js';
export interface NavigationHull {name:string;length:number;beam:number;draft:number;noGo:number;bestAngle:number}
export function distance(a:Waypoint,b:Waypoint):number;
export function headingTo(a:Waypoint,b:Waypoint):number;
export function angleDifference(a:number,b:number):number;
export function direction(heading:number):Vector2D;
export function windEye(wind:Vector2D):number;
export function optimalTackAngle(spec:NavigationHull):number;
export class Navigator {
 constructor(world:NativeWorld,options?:{spacing?:number;maxNodes?:number});
 cache:Map<string,boolean>;
 clearSegment(a:Waypoint,b:Waypoint,spec:NavigationHull):boolean;
 route(start:Waypoint,goal:Waypoint,spec:NavigationHull,wind:Vector2D,field?:WindField|null):Waypoint[];
 tacks(start:Waypoint,goal:Waypoint,spec:NavigationHull,wind:Vector2D):Waypoint[];
}
