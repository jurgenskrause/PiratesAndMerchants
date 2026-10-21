import {toMicrogold,fromMicrogold,addMicrogold} from './money.js?v=babbc3d3950e';
// Developer-only observation. Never used by merchants or simulation decisions.
// Bounds apply per port/resource; old samples compact while recent changes stay exact.
export class EconomicHistory {
 constructor(economy,{clock=()=>0,maxPoints=2048,maxEvents=256}={}){
  if(!Number.isInteger(maxPoints)||maxPoints<8||!Number.isInteger(maxEvents)||maxEvents<1)throw RangeError('History bounds');
  this.economy=economy;this.clock=clock;this.maxPoints=maxPoints;this.maxEvents=maxEvents;this.series=new Map();this.serial=0;
  for(const id of economy.getPortIds())this.record(economy.getMarketSnapshot(id),true);
  this.unsubscribe=economy.subscribeMarkets(event=>this.record(event));
 }
 record(change,initial=false){
  const time=this.clock();let port=this.series.get(change.portId);if(!port){port={id:change.portId,name:change.name,faction:change.faction,goods:new Map()};this.series.set(port.id,port);}
  for(const stock of change.stocks){
   let series=port.goods.get(stock.commodity_id);if(!series){series={points:[],events:[],eventIndex:new Map(),compacted:false,droppedEvents:0};port.goods.set(stock.commodity_id,series);}
   const before=series.points.at(-1),price=stock.current_price,trade=change.transaction;let eventId=null;
   if(trade){
    // Aggregate accepted trades for display, keeping separate vessels and recipients distinct.
    const key=JSON.stringify([trade.shipId??null,trade.action,trade.originPortId??null,trade.destinationPortId??null,trade.buyerAccountId??null,trade.sales?.map(s=>s.sellerAccountId)??[],trade.unitPriceUnits??null]);let event=series.eventIndex.get(key);if(event&&(time-event.endTime>2||(event.fills?.length??0)>=64))event=null;
    if(!event){event={id:++this.serial,key,shipId:trade.shipId??null,shipName:trade.shipName??null,action:trade.action,originPortId:trade.originPortId??null,destinationPortId:trade.destinationPortId??null,startTime:time,endTime:time,startTick:change.tick,endTick:change.tick,quantity:0,buyerAccountId:trade.buyerAccountId??null,commodityId:stock.commodity_id,recipients:[],sales:[],provenance:[],unitPrice:trade.unitPrice??null,unitPriceUnits:trade.unitPriceUnits??null,fills:[],priceBefore:trade.priceBefore,priceAfter:price,gold:0};series.events.push(event);series.eventIndex.set(key,event);if(series.events.length>this.maxEvents){const old=series.events.shift();if(series.eventIndex.get(old.key)===old)series.eventIndex.delete(old.key);series.droppedEvents++;}}
    for(const row of trade.provenance??[]){let item=event.provenance.find(p=>p.ownerAccountId===row.ownerAccountId&&p.originPortId===row.originPortId);if(!item){item={ownerAccountId:row.ownerAccountId,originPortId:row.originPortId,quantity:0,acquisitionCost:0};event.provenance.push(item);}item.quantity+=row.quantity;item.acquisitionCostUnits=addMicrogold(item.acquisitionCostUnits??0,row.acquisitionCostUnits??toMicrogold(row.acquisitionCost));item.acquisitionCost=fromMicrogold(item.acquisitionCostUnits);}
    for(const credit of trade.recipients??[]){let item=event.recipients.find(c=>c.accountId===credit.accountId);if(!item){item={accountId:credit.accountId,amount:0};event.recipients.push(item);}item.amountUnits=addMicrogold(item.amountUnits??0,credit.amountUnits??toMicrogold(credit.amount));item.amount=fromMicrogold(item.amountUnits);}
    for(const sale of trade.sales??[]){let item=event.sales.find(s=>s.sellerAccountId===sale.sellerAccountId&&s.allocation===sale.allocation);if(!item){item={sellerAccountId:sale.sellerAccountId,allocation:sale.allocation,quantity:0,payment:0,recipients:[]};event.sales.push(item);}item.quantity+=sale.quantity;item.acquisitionCostUnits=addMicrogold(item.acquisitionCostUnits??0,sale.acquisitionCostUnits??0);item.acquisitionCost=fromMicrogold(item.acquisitionCostUnits);item.paymentUnits=addMicrogold(item.paymentUnits??0,sale.paymentUnits??toMicrogold(sale.payment));item.payment=fromMicrogold(item.paymentUnits);for(const share of sale.recipients){let recipient=item.recipients.find(c=>c.accountId===share.accountId&&c.role===share.role);if(!recipient){recipient={accountId:share.accountId,role:share.role,amount:0};item.recipients.push(recipient);}recipient.amountUnits=addMicrogold(recipient.amountUnits??0,share.amountUnits??toMicrogold(share.amount));recipient.amount=fromMicrogold(recipient.amountUnits);}}
    event.fills.push({paymentId:trade.paymentId??null,transferId:trade.transferId??null,orderId:trade.orderId??null,offerId:trade.offerId??null,quantity:trade.quantity,unitPrice:trade.unitPrice??null,unitPriceUnits:trade.unitPriceUnits??null,totalPaymentUnits:trade.goldUnits??toMicrogold(trade.gold),buyerAccountId:trade.buyerAccountId??null,sellerAccountId:trade.sellerAccountId??null,recipients:structuredClone(trade.recipients??[])});event.quantity+=trade.quantity;event.goldUnits=addMicrogold(event.goldUnits??0,trade.goldUnits??toMicrogold(trade.gold));event.gold=fromMicrogold(event.goldUnits);event.endTime=time;event.endTick=change.tick;event.priceAfter=price;eventId=event.id;
   }
   if(!before||before.price!==price||eventId!==null){series.points.push({time,tick:change.tick,price,eventId,batch:trade?{quantity:trade.quantity,priceBefore:trade.priceBefore,priceAfter:price}:null,reason:initial?'initial':trade?trade.action:change.reason??'market_update'});}
   if(series.points.length>this.maxPoints){
    const cut=Math.floor(series.points.length/2),older=series.points.slice(0,cut),keep=[],seen=new Set();
    for(let i=0;i<older.length;i+=4){const group=older.slice(i,i+4),low=group.reduce((a,b)=>a.price<=b.price?a:b),high=group.reduce((a,b)=>a.price>=b.price?a:b);if(i===0){keep.push(group[0]);seen.add(group[0]);}for(const p of [low,high].sort((a,b)=>a.time-b.time||group.indexOf(a)-group.indexOf(b)))if(!seen.has(p)){keep.push(p);seen.add(p);}}
    series.points=[...keep,...series.points.slice(cut)];series.compacted=true;
   }
  }
 }
 snapshot(commodityId,{portId=null}={}){
  if(!this.economy.commodityRegistry.has(commodityId))throw RangeError('Unknown history resource');
  const now=this.clock();return {commodityId,time:now,tick:this.economy.timestamp_tick,maxPoints:this.maxPoints,maxEvents:this.maxEvents,ports:[...this.series.values()].filter(port=>portId===null||port.id===portId).map(port=>{const s=port.goods.get(commodityId);if(!s)return portId===null?null:{id:port.id,name:port.name,faction:port.faction,compacted:false,droppedEvents:0,points:[],events:[]};const points=s.points.map(p=>({...p,batch:p.batch?{...p.batch}:null})),last=points.at(-1);if(last&&last.time<now)points.push({...last,time:now,eventId:null,batch:null,reason:'unchanged'});return {id:port.id,name:port.name,faction:port.faction,compacted:s.compacted,droppedEvents:s.droppedEvents,points,events:s.events.map(({key,...e})=>structuredClone(e))};}).filter(Boolean)};
 }
 dispose(){this.unsubscribe();}
}
