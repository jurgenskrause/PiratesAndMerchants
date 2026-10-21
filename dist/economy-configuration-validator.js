// EconomicEngine requires its derived ticksPerDay to be a positive safe counter.
// Whole-number divisibility is separately declared in the constraint catalog.
export const economyConfigurationValidator=Object.freeze({
 id:'economy.accounting_counter',scope:'world',setting_ids:Object.freeze(['simulation.seconds_per_day','simulation.economic_tick_seconds']),
 validate(values){const ticks=values['simulation.seconds_per_day']/values['simulation.economic_tick_seconds'];return !Number.isFinite(ticks)||ticks<1||ticks>Number.MAX_SAFE_INTEGER?[{severity:'error',message:'Daily accounting must produce a positive, safely representable tick counter.'}]:[];}
});
