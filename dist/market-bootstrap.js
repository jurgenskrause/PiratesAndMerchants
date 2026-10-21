// One-time generation reports. Subsequent intelligence travels with ships.
export function seedPortLedgers({economy,market,ports,ledgers,tick=0}){
 const locations=new Map(ports.map(p=>[p.id,p.position??p.dockPosition]));
 const records=economy.getPortIds().map(id=>{const snapshot=economy.getMarketSnapshot(id);return {id,name:snapshot.name,owner_faction:snapshot.faction,position:locations.get(id)};});
 // Ports share immutable initial price snapshots instead of duplicating every commodity.
 const reports=new Map();
 for(const p of records){const ledger=ledgers.get(p.id);if(!ledger)continue;ledger.observe(p,market,tick);const report=structuredClone(ledger.entries.get(p.id));for(const price of Object.values(report.prices))Object.freeze(price);Object.freeze(report.prices);reports.set(p.id,report);}
 const squaredDistance=(a,b)=>a.position&&b.position?(a.position.x-b.position.x)**2+(a.position.y-b.position.y)**2:Infinity;
 for(const port of records){const ledger=ledgers.get(port.id);if(!ledger)continue;
  const copy=(p,source)=>{const report=reports.get(p.id);if(report)ledger.entries.set(p.id,{...report,source});};
  for(const other of records)if(other.id!==port.id&&other.owner_faction===port.owner_faction)copy(other,'INITIAL_FACTION_REPORT');
  const foreign=records.filter(p=>p.owner_faction!==port.owner_faction&&Number.isFinite(squaredDistance(port,p))).sort((a,b)=>squaredDistance(port,a)-squaredDistance(port,b)||a.id.localeCompare(b.id))[0];
  if(foreign)copy(foreign,'INITIAL_NEIGHBOR_REPORT');
 }
}
