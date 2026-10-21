// Four ordered queues preserve role alternation and running-job preference.
// Map insertion order provides constant-time enqueue, unlink and head selection.
export class PlanningQueue {
 constructor(items=[]){this.all=new Map();this.byActor=new Map();this.buckets=Array.from({length:4},()=>new Map());for(const j of items)this.push(j);return new Proxy(this,{get:(target,key)=>typeof key==='string'&&/^\d+$/.test(key)?[...target.all.keys()][Number(key)]:Reflect.get(target,key)});}
 get length(){return this.all.size;}
 push(j){this.all.set(j,true);const set=this.byActor.get(j.a.id)??new Set();set.add(j);this.byActor.set(j.a.id,set);this.buckets[(j.a.role.militaryOnly?2:0)+(j.running?1:0)].set(j,true);return this.length;}
 remove(j){if(!j)return;this.all.delete(j);const set=this.byActor.get(j.a.id);set?.delete(j);if(!set?.size)this.byActor.delete(j.a.id);for(const b of this.buckets)b.delete(j);return j;}
 cancelActor(id){const jobs=[...(this.byActor.get(id)??[])];for(const j of jobs)this.remove(j);return jobs;}
 shift(){return this.remove(this.all.keys().next().value);}
 take(military){const base=military?2:0,other=military?0:2;const head=b=>this.buckets[b].keys().next().value;return this.remove(head(base+1)??head(base)??head(other+1)??this.all.keys().next().value);}
 find(fn){for(const j of this.all.keys())if(fn(j))return j;}
 every(fn){for(const j of this.all.keys())if(!fn(j))return false;return true;}
 [Symbol.iterator](){return this.all.keys();}
}
