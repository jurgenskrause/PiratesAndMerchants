import {costUnits,costFields,proportionalCost} from './production-costing.js?v=babbc3d3950e';
import {addMicrogold} from './money.js?v=babbc3d3950e';
// Live coalesced inventory. Reservations partition physical goods; they never copy them.
export const goodsLocation=(type,id)=>`${type}:${encodeURIComponent(id)}`;
const quantity=n=>{if(!Number.isFinite(n)||n<0)throw RangeError('Invalid goods quantity');return n;};
const provenance=(rows=[])=>{const grouped=new Map();for(const p of rows){if(typeof p.commodityId!=='string'||!p.commodityId||p.originPortId!==null&&typeof p.originPortId!=='string')throw TypeError('Invalid production provenance');quantity(p.quantity);costUnits(p);const key=JSON.stringify([p.commodityId,p.originPortId]),old=grouped.get(key)??{...p,quantity:0,...costFields(0)};old.quantity=quantity(old.quantity+p.quantity);Object.assign(old,costFields(addMicrogold(costUnits(old),costUnits(p))));grouped.set(key,old);}return [...grouped.values()].sort((a,b)=>JSON.stringify([a.commodityId,a.originPortId]).localeCompare(JSON.stringify([b.commodityId,b.originPortId])));};
const scaled=(r,q)=>r.productionInputs?{productionInputs:r.productionInputs.map(p=>({...p,quantity:p.quantity*q/r.quantity,...costFields(proportionalCost(costUnits(p),q,r.quantity))}))}:{};
const frozen=rows=>Object.freeze(rows.map(r=>Object.freeze({...r,...(r.productionInputs?{productionInputs:Object.freeze(r.productionInputs.map(p=>Object.freeze({...p})))}:{})})));
export class GoodsInventory {
 #rows=new Map(); #flows=new Map(); #opening=new Map(); #serial=0; #ids=new Map(); #indexes=new Map(); #undo=null;
 #key(r){return JSON.stringify([r.ownerAccountId,r.location,r.commodityId,r.originPortId??null,r.reservationId??null,r.manufacturingIndustryAccountId??null,!!r.contraband]);}
 #put(r){quantity(r.quantity);costUnits(r);if(!r.quantity)return;if(!Number.isFinite(this.amount({commodityId:r.commodityId})+r.quantity))throw RangeError('Goods total overflow');for(const key of ['ownerAccountId','location','commodityId'])if(typeof r[key]!=='string'||!r[key])throw TypeError('Goods identity required');const key=this.#key(r),old=this.#rows.get(key),q=(old?.quantity??0)+r.quantity,cost=addMicrogold(old?costUnits(old):0,costUnits(r));if(!Number.isFinite(q)||!Number.isFinite(cost))throw RangeError('Goods overflow');if(old&&q===old.quantity){this.#flow(r.commodityId,'removed:rounding dust',r.quantity);return;}const row={...r,id:old?.id??`goods-${++this.#serial}`,contraband:!!r.contraband,manufacturingIndustryAccountId:r.manufacturingIndustryAccountId??null,quantity:q,...costFields(cost),...(old?.productionInputs||r.productionInputs?{productionInputs:provenance([...(old?.productionInputs??[]),...(r.productionInputs??[])])}:{})};this.#set(key,row);}
 // Indexes and a touched-record undo journal keep small operations independent of world size.
 #index(k,v){return JSON.stringify([k,v]);}
 #set(key,row){
  const old=this.#rows.get(key);if(this.#undo&&!this.#undo.has(key))this.#undo.set(key,old);
  if(old){if(old.id!==row?.id)this.#ids.delete(old.id);for(const k of ['location','ownerAccountId','commodityId','reservationId']){if(row&&old[k]===row[k])continue;const id=this.#index(k,old[k]),set=this.#indexes.get(id);set?.delete(key);if(!set?.size)this.#indexes.delete(id);}}
  if(!row){this.#rows.delete(key);return;}
  this.#rows.set(key,row);this.#ids.set(row.id,key);
  for(const k of ['location','ownerAccountId','commodityId','reservationId']){if(old&&old[k]===row[k])continue;const id=this.#index(k,row[k]),set=this.#indexes.get(id)??new Set();set.add(key);this.#indexes.set(id,set);}
 }
 #atomic(fn){
  const parent=this.#undo,undo=new Map(),flows=new Map(this.#flows),opening=new Map(this.#opening),serial=this.#serial;this.#undo=undo;
  try{const value=fn();if(parent)for(const [key,row] of undo)if(!parent.has(key))parent.set(key,row);return value;}catch(error){this.#undo=null;for(const [key,row] of undo)this.#set(key,row);this.#flows=flows;this.#opening=opening;this.#serial=serial;throw error;}finally{this.#undo=parent;}
 }
 transaction(fn){return this.#atomic(fn);}
 #flow(c,kind,q){const key=c+'|'+kind,v=(this.#flows.get(key)??0)+q;if(!Number.isFinite(v))throw RangeError('Goods flow overflow');this.#flows.set(key,v);}
 create(record,reason){if(typeof reason!=='string'||!reason)throw TypeError('Goods creation reason required');return this.#atomic(()=>{this.#put(record);if(reason==='initial inventory')this.#opening.set(record.commodityId,(this.#opening.get(record.commodityId)??0)+record.quantity);else this.#flow(record.commodityId,'created:'+reason,record.quantity);});}
 *#matching(filter,ordered=false){
  const entries=Object.entries(filter);let keys=null;
  if(filter.id)keys=[this.#ids.get(filter.id)];
  else for(const [k,v] of entries)if(['location','ownerAccountId','commodityId','reservationId'].includes(k)){const candidate=this.#indexes.get(this.#index(k,v));if(!candidate)return;if(!keys||candidate.size<keys.size)keys=candidate;}
  const candidates=keys??this.#rows.keys();for(const key of ordered?[...candidates].sort((a,b)=>Number(this.#rows.get(a)?.id.slice(6))-Number(this.#rows.get(b)?.id.slice(6))):candidates){const r=this.#rows.get(key);if(r&&entries.every(([k,v])=>r[k]===v))yield r;}
 }
 inspect(filter={}){return frozen([...this.#matching(filter,true)]);}
 amount(filter={}){let total=0;for(const r of this.#matching(filter))total+=r.quantity;if(!Number.isFinite(total))throw RangeError('Goods total overflow');return total;}
 select(filter,q){quantity(q);const rows=this.inspect(filter),out=[];let left=q;for(const row of rows){const units=Math.min(left,row.quantity);if(units>0)out.push({...row,quantity:units,...costFields(proportionalCost(costUnits(row),units,row.quantity)),...scaled(row,units)});left-=units;if(left<=0)break;}if(left>1e-8)throw Error('Insufficient owned goods');return frozen(out);}
 take(filter,q){const rows=this.select(filter,q);for(const row of rows){const key=this.#key(row),old=this.#rows.get(key),left=old.quantity-row.quantity;this.#set(key,left<=0?null:{...old,quantity:left,...costFields(costUnits(old)-costUnits(row)),...(old.productionInputs?{productionInputs:old.productionInputs.map((p,i)=>({...p,quantity:Math.max(0,p.quantity-row.productionInputs[i].quantity),...costFields(costUnits(p)-costUnits(row.productionInputs[i]))}))}:{})});}return rows;}
 move(filter,q,changes={}){return this.#atomic(()=>{const rows=this.take(filter,q);for(const row of rows)this.#put({...row,...changes,...(Object.hasOwn(changes,'acquisitionCost')&&!Object.hasOwn(changes,'acquisitionCostUnits')?costFields(costUnits({acquisitionCost:changes.acquisitionCost})): {})});return rows;});}
 remove(filter,q,reason){if(typeof reason!=='string'||!reason)throw TypeError('Goods removal reason required');return this.#atomic(()=>{const rows=this.take(filter,q);for(const row of rows)this.#flow(row.commodityId,'removed:'+reason,row.quantity);return rows;});}
 checkpoint(){return {rows:new Map(this.#rows),flows:new Map(this.#flows),opening:new Map(this.#opening),serial:this.#serial};}
 restore(s){this.#rows=new Map();this.#indexes=new Map();this.#ids=new Map();for(const [key,r] of s.rows)this.#set(key,r);this.#flows=new Map(s.flows);this.#opening=new Map(s.opening);this.#serial=s.serial;}
 snapshot(){const records=this.inspect(),commodities=new Set([...this.#opening.keys(),...records.map(r=>r.commodityId),...[...this.#flows.keys()].map(k=>k.split('|')[0])]);return Object.freeze({records,totals:Object.freeze(Object.fromEntries([...commodities].map(c=>[c,this.amount({commodityId:c})]))),opening:Object.freeze(Object.fromEntries(this.#opening)),flows:Object.freeze(Object.fromEntries(this.#flows))});}
}
