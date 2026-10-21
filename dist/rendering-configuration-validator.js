const pairs=['industry_icon_fade','road_visibility','road_detail','building_detail'];
export const renderingConfigurationValidator=Object.freeze({
 id:'rendering.ordered_detail_thresholds',scope:'application',setting_ids:Object.freeze(pairs.flatMap(p=>['rendering.'+p+'_start','rendering.'+p+'_end'])),
 validate(values){return pairs.filter(p=>values['rendering.'+p+'_start']>=values['rendering.'+p+'_end']).map(p=>({severity:'error',setting_ids:['rendering.'+p+'_start','rendering.'+p+'_end'],message:p.replaceAll('_',' ')+' start must be strictly below end to preserve a positive fade range.'}));}
});
