// ThreatGrid.corridorHotspots uses a strict > threshold comparison.
export const navigationConfigurationValidator=Object.freeze({
 id:'navigation.hotspot_trigger',scope:'world',setting_ids:Object.freeze(['navigation.threat_threshold','threat.max_threat']),
 validate(values){return values['navigation.threat_threshold']===values['threat.max_threat']?[{severity:'warning',message:'Threat threshold equals the threat cap; strict hotspot checks cannot trigger threat-based replanning.'}]:[];}
});
