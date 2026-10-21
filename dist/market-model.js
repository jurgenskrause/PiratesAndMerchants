// Read-only local market projection. Ship ledgers consume it only at permitted contacts.
export class MarketModel{
 #ports=new Map();#listeners=new Set();
 listenerErrors=[];
 constructor(economy){this.economy=economy;for(const id of economy.getPortIds())this.#apply(economy.getMarketSnapshot(id));this.unsubscribe=economy.subscribeMarkets(event=>{this.#apply(event);for(const listener of this.#listeners)try{listener(event);}catch(error){this.listenerErrors.push(error);if(this.listenerErrors.length>32)this.listenerErrors.shift();}});}
 #apply(event){const old=this.#ports.get(event.portId),stocks=new Map(old?.stocks??[]);for(const s of event.stocks)stocks.set(s.commodity_id,s);this.#ports.set(event.portId,{...event,stocks});}
 subscribe(listener){this.#listeners.add(listener);return ()=>this.#listeners.delete(listener);}
 getPortSupplies(id){const p=this.#ports.get(id);if(!p)throw RangeError('Unknown market');return Object.freeze([...p.stocks.values()]);}
 getPortStockpile(id,commodity){const p=this.#ports.get(id)?.stocks.get(commodity);if(!p)throw RangeError('Unknown market commodity');return p;}
 getPortTaxRate(id){const p=this.#ports.get(id);if(!p)throw RangeError('Unknown market');return 0;}
 getMarketRevision(id){return this.#ports.get(id)?.revision??0;}
 dispose(){this.unsubscribe();this.#listeners.clear();}
}
