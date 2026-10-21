import {formatMoney} from './money.js?v=babbc3d3950e';
const rank=(a,b)=>a.sequence-b.sequence||a.id.localeCompare(b.id);
export function marketDepth(offers=[],orders=[]){
 const asks=[...offers].filter(o=>o.remainingQuantity>0).sort((a,b)=>a.priceUnits-b.priceUnits||rank(a,b)),bids=[...orders].filter(o=>o.remainingQuantity>0).sort((a,b)=>b.priceUnits-a.priceUnits||rank(a,b));
 const levels=rows=>{const out=[];for(const row of rows){let level=out.at(-1);if(level?.priceUnits!==row.priceUnits){level={priceUnits:row.priceUnits,quantity:0};out.push(level);}level.quantity+=row.remainingQuantity;}return out;};
 const supplyLevels=levels(asks),demandLevels=levels(bids);return {ask:asks[0]?.askingPrice??null,bid:bids[0]?.offeredPrice??null,askQuantity:supplyLevels[0]?.quantity??0,bidQuantity:demandLevels[0]?.quantity??0,available:asks.reduce((n,o)=>n+o.remainingQuantity,0),demand:bids.reduce((n,o)=>n+o.remainingQuantity,0),supplyLevels,demandLevels};
}
export function formatMarketDepth(rows=[],side='ask'){
 const supply=side==='ask',ordered=[...rows].filter(o=>o.remainingQuantity>0).sort((a,b)=>(supply?a.priceUnits-b.priceUnits:b.priceUnits-a.priceUnits)||rank(a,b));
 return ordered.length?ordered.map(o=>`${o.remainingQuantity.toLocaleString('en-GB',{maximumFractionDigits:6})} @ ${formatMoney(supply?o.askingPrice:o.offeredPrice)} (${supply?o.sellerAccountId:o.buyerAccountId})`).join('; '):'—';
}
