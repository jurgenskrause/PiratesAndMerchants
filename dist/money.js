export const MICROGOLD_PER_GOLD=1_000_000;
export function microgold(value){if(!Number.isSafeInteger(value)||value<0)throw RangeError('Invalid microgold amount');return value;}
export function toMicrogold(gold){if(!Number.isFinite(gold)||gold<0)throw RangeError('Invalid gold amount');return microgold(Math.round(gold*MICROGOLD_PER_GOLD));}
export function fromMicrogold(units){return microgold(units)/MICROGOLD_PER_GOLD;}
export function addMicrogold(a,b){return microgold(a+b);}
// Presentation only. No caller should use this string for settlement or affordability.
export function formatMoney(gold){return Number.isFinite(gold)?(Math.abs(gold)<.005?0:gold).toFixed(2):'N/A';}

export function wholeUnitsAffordable(gold,price){const priceUnits=toMicrogold(price);if(!priceUnits)throw RangeError('Invalid cargo price');return Math.floor(toMicrogold(gold)/priceUnits);}
