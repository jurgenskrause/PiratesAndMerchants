// Catalog data is injected by the registry owner to avoid loading a second copy.
export function openingConfigurationValidator(catalog){
 const ids=catalog.configuration_definitions.filter(d=>d.id.startsWith('opening.')).map(d=>d.id);
 const vessels=new Map(catalog.vessels.map(v=>[v.id,v])),docks=new Map(catalog.docks.map(d=>[d.id,d]));
 const sizes=['Small','Medium','Large','ExtraLarge'];
 return {id:'opening.validity',scope:'world',setting_ids:ids,validate:v=>{
  const issues=[],error=(message,setting_ids)=>issues.push({severity:'error',message,setting_ids});
  const nationals=['british','spanish','french'].filter(f=>v[`opening.${f}_enabled`]);
  if(nationals.length<2)error('Select at least two national factions. Pirates do not count.',['opening.british_enabled','opening.spanish_enabled','opening.french_enabled']);
  if(v['opening.colonies_per_faction']!==2||v['opening.crown_colonies_per_nation']+v['opening.small_colonies_per_nation']!==2||v['opening.small_colonies_per_pirate']!==2||v['opening.industries_per_colony']!==1)error('The opening requires two colonies per faction and one starter industry per colony.',['opening.colonies_per_faction','opening.industries_per_colony']);
  const role=(key,dockKey,category)=>{
   const vessel=vessels.get(v[key]),dock=docks.get(v[dockKey]);
   if(!vessel)error(`Unknown vessel class ${v[key]}.`,[key]);
   else if(vessel.category!==category)error(`${vessel.id} is not a ${category.toLowerCase()} vessel.`,[key]);
   if(!dock)error(`Unknown dock type ${v[dockKey]}.`,[dockKey]);
   else if(vessel&&sizes.indexOf(vessel.required_berth_size)>sizes.indexOf(dock.required_min_berth_size))error(`${vessel.id} cannot berth at ${dock.id}.`,[key,dockKey]);
  };
  role('opening.crown_warship_class','opening.crown_dock_type','Military');
  for(const key of ['opening.crown_merchant_class_a','opening.crown_merchant_class_b'])role(key,'opening.crown_dock_type','Merchant');
  role('opening.small_merchant_class','opening.small_dock_type','Merchant');
  // CORSAIR is a reserved ID until Phase 5; enabling the new Pirate opening before it exists is invalid.
  if(v['opening.enabled']&&v['opening.pirates_enabled'])role('opening.pirate_ship_class','opening.small_dock_type','Pirate');
  if(v['opening.enabled']&&v['opening.required_industry_policy']==='foundation_three'&&!['sawmill','iron','cotton'].every(id=>catalog.industries.some(i=>i.id===id)))error('The required sawmill industry is not registered yet. Complete Phase 2 before enabling this opening.',['opening.enabled','opening.required_industry_policy']);
  for(const unit of ['population','wood','iron_bars']){
   const keys=['small','medium','large'].map(tier=>`opening.shipyard_${tier}_${unit}`);
   if(v[keys[0]]>v[keys[1]]||v[keys[1]]>v[keys[2]])error(`Shipyard ${unit} thresholds must increase by tier.`,keys);
  }
  const coast=['opening.anchor_min_coast_distance','opening.anchor_preferred_coast_distance','opening.anchor_max_coast_distance'];
  if(v[coast[0]]>v[coast[1]]||v[coast[1]]>v[coast[2]])error('Anchorage minimum, preferred and maximum distances must be ordered.',coast);
  return issues;
 }};
}
