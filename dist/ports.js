import {initializeColonyPresets} from './colony-presets.js?v=babbc3d3950e';
import {hexDistance} from './hex-topology.js?v=babbc3d3950e';
import {initializePortInfrastructure,dockFootprint} from './port-infrastructure.js?v=babbc3d3950e';
import {factionRegistry,namingRegistry,settlementRegistry,dockRegistry} from './simulation-registry.js?v=babbc3d3950e';
import {contextualName} from './contextual-names.js?v=babbc3d3950e';
import {measurePortDistances} from './simulation-scaling.js?v=babbc3d3950e';
import {DIRECTIONS,SEA_LEVEL,hashSeed,random,axialToOffset,offsetToAxial,axialToWorld} from './world.js?v=babbc3d3950e';
export const MIN_PORT_ISLAND_TILES=settlementRegistry.get('port').min_island_tiles;
export const DOCK_EDGES=['east','northeast','northwest','west','southwest','southeast'];
function roman(n){let result='';for(const[v,s]of[[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']])while(n>=v){result+=s;n-=v;}return result;}
export function generatePorts(world,database){
 const databaseCatalog={factions:factionRegistry.values().sort((a,b)=>a.harbor_frame-b.harbor_frame).map(f=>({id:f.id,harborFrame:f.harbor_frame,name:f.display_name,color:f.primary_color,pennantColor:f.pennant_color,names:namingRegistry.get(f.naming_bank_ref).ports.prefixes.flatMap(prefix=>namingRegistry.get(f.naming_bank_ref).ports.roots.map(root=>prefix+root))}))};database=databaseCatalog;
 const {n,h}=world,biomes=world.terrainBiomes??world.biomes,count=n*n;
 const ocean=new Uint8Array(count),visited=new Uint8Array(count),queue=new Int32Array(count);let head=0,tail=0;
 const neighbor=(q,r)=>{const c=axialToOffset(q,r);return c.col<0||c.row<0||c.col>=n||c.row>=n?-1:c.row*n+c.col;};
 for(let i=0;i<count;i++){const col=i%n,row=Math.floor(i/n);if(h[i]<SEA_LEVEL&&(col===0||row===0||col===n-1||row===n-1)){ocean[i]=1;queue[tail++]=i;}}
 while(head<tail){const i=queue[head++],c=offsetToAxial(i%n,Math.floor(i/n));for(const[dq,dr]of DIRECTIONS){const j=neighbor(c.q+dq,c.r+dr);if(j>=0&&!ocean[j]&&h[j]<SEA_LEVEL){ocean[j]=1;queue[tail++]=j;}}}
 const ports=[],occupied=new Set(),usedNames=new Set(),dockTypes=dockRegistry.values().map(d=>d.id);
 for(let start=0;start<count;start++){
  if(h[start]<SEA_LEVEL||visited[start])continue;
  head=0;tail=1;queue[0]=start;visited[start]=1;
  while(head<tail){const i=queue[head++],c=offsetToAxial(i%n,Math.floor(i/n));for(const[dq,dr]of DIRECTIONS){const j=neighbor(c.q+dq,c.r+dr);if(j>=0&&!visited[j]&&h[j]>=SEA_LEVEL){visited[j]=1;queue[tail++]=j;}}}
  if(tail<MIN_PORT_ISLAND_TILES)continue;
  const islandTiles=tail,candidates=[];let best=null,bestScore=-Infinity;
  for(let k=0;k<islandTiles;k++){
   const landIndex=queue[k],c=offsetToAxial(landIndex%n,Math.floor(landIndex/n));if(biomes[landIndex]===5)continue;
   for(let direction=0;direction<6;direction++){
    const[dq,dr]=DIRECTIONS[direction],q=c.q+dq,r=c.r+dr,waterIndex=neighbor(q,r);
    if(waterIndex<0||!ocean[waterIndex]||occupied.has(waterIndex))continue;
    if(!dockTypes.some(type=>dockFootprint(world,c,{q,r},type).length))continue;
    let open=0;for(const[aq,ar]of DIRECTIONS){const j=neighbor(q+aq,r+ar);if(j>=0&&ocean[j])open++;}
    const outward=neighbor(q+dq,r+dr);
    const flatness=biomes[landIndex]===1?4:biomes[landIndex]===2||biomes[landIndex]===4?3:biomes[landIndex]===3?1:0;
    const score=open*2+flatness+(outward>=0&&ocean[outward]?3:0)+random(hashSeed(world.config.seed+'|dock|'+c.q+','+c.r+'|'+direction))();
    candidates.push({landIndex,waterIndex,land:c,water:{q,r},attachmentEdge:(direction+3)%6,score});
    if(score>bestScore){bestScore=score;best={landIndex,waterIndex,land:c,water:{q,r},attachmentEdge:(direction+3)%6};}
   }
  }
  if(!best)continue;
  const origin=offsetToAxial(start%n,Math.floor(start/n)),islandKey=origin.q+','+origin.r;
  const rng=random(hashSeed(world.config.seed+'|port|'+islandKey)),factionIndex=Math.floor(rng()*database.factions.length),faction=database.factions[factionIndex];
  const sites=[best],growth=settlementRegistry.get('port').extra_ports;
  if(growth&&islandTiles>=growth.min_island_tiles){const limit=Math.min(growth.max_ports,Math.floor(islandTiles/growth.min_island_tiles)+1);candidates.sort((a,b)=>b.score-a.score||a.landIndex-b.landIndex||a.waterIndex-b.waterIndex);for(let k=1;k<limit;k++){if(random(hashSeed(world.config.seed+'|extra-port|'+islandKey+'|'+k))()>=growth.spawn_chance)continue;const site=candidates.find(c=>!occupied.has(c.waterIndex)&&sites.every(p=>hexDistance(c.land,p.land)>=growth.min_hex_spacing&&hexDistance(c.water,p.water)>=2));if(site)sites.push(site);}}
  for(const [siteIndex,site] of sites.entries()){
  const nameOffset=Math.floor(random(hashSeed(world.config.seed+'|port-name|'+islandKey+'|'+siteIndex))()*faction.names.length);let name='',cycle=0;
  while(!name){for(let k=0;k<faction.names.length;k++){const root=faction.names[(nameOffset+k)%faction.names.length],candidate=root+(cycle?' '+roman(cycle+1):'');if(!usedNames.has(candidate)){name=candidate;break;}}cycle++;}
  usedNames.add(name);occupied.add(site.waterIndex);
  ports.push({id:'port-'+islandKey+(siteIndex?':'+siteIndex:''),islandId:islandKey,name,settlementType:'port',governor:{name:contextualName(faction.id,'governors',world.config.seed+'|'+islandKey+'|'+siteIndex)},islandName:contextualName(faction.id,'islands',world.config.seed+'|'+islandKey),faction:faction.id,factionName:faction.name,factionIndex:faction.harborFrame,color:faction.color,pennantColor:faction.pennantColor,islandTiles,...site,attachmentName:DOCK_EDGES[site.attachmentEdge],dockPosition:axialToWorld(site.water.q,site.water.r),harborPosition:axialToWorld(site.land.q,site.land.r)});
 }
 }
 const portsByIsland=new Map(ports.map(port=>[port.id,port]));
 for(const [index,island] of (world.islands??[]).entries()){const origin=offsetToAxial(island.originIndex%n,Math.floor(island.originIndex/n)),owner=portsByIsland.get('port-'+origin.q+','+origin.r);const faction=owner?.faction??database.factions[index%database.factions.length].id;island.faction=faction;island.name=owner?.islandName??contextualName(faction,'islands',world.config.seed+'|island|'+index);}

 const profile=settlementRegistry.get('port'),mix=profile.initial_dock_mix??[profile.initial_dock_type];
 for(const faction of new Set(ports.map(p=>p.faction))){
  const homes=ports.filter(p=>p.faction===faction).sort((a,b)=>Number(!!dockFootprint(world,b.land,b.water,profile.initial_dock_type).length)-Number(!!dockFootprint(world,a.land,a.water,profile.initial_dock_type).length)||b.islandTiles-a.islandTiles||a.id.localeCompare(b.id));
  homes.forEach((port,i)=>{port.initialDockType=i?mix[(i-1)%mix.length]:profile.initial_dock_type;initializePortInfrastructure(world,port);});
 }
 initializeColonyPresets(world,ports);world.economyMetrics=measurePortDistances(world,ports);return ports;
}

export function centralPort(world){
 if(!world?.ports?.length)return null;
 const center={x:world.bounds.width/2,y:world.bounds.height/2};
 return world.ports.reduce((best,port)=>{const distance=p=>(p.dockPosition.x-center.x)**2+(p.dockPosition.y-center.y)**2;return distance(port)<distance(best)?port:best;});
}
