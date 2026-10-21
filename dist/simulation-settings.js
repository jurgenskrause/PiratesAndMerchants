// Time is simulated seconds, independent of rendering and requested speed-up.
import {systemSettings} from './simulation-registry.js?v=babbc3d3950e';
export const GLOBAL_DAILY_WAGE_PER_CREW=systemSettings.globalDailyWagePerCrew;
export const SIMULATION_SETTINGS=systemSettings;
export function dailyShipOverhead(baseHullMaintenance,currentCrewCount,wage=GLOBAL_DAILY_WAGE_PER_CREW){if(!Number.isFinite(baseHullMaintenance)||baseHullMaintenance<0||!Number.isSafeInteger(currentCrewCount)||currentCrewCount<0||!Number.isFinite(wage)||wage<0)throw RangeError('Invalid ship overhead');return baseHullMaintenance+currentCrewCount*wage;}
