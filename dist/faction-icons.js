import {factionDefinition,assetRegistry} from './simulation-registry.js?v=babbc3d3950e';
export function factionIcon(faction){const definition=factionDefinition(faction);return definition?{name:definition.display_name,src:new URL(assetRegistry.get(definition.flag_asset).url,import.meta.url).href}:{name:'Unregistered',src:''};}
export function factionImage(faction){const icon=factionIcon(faction),img=document.createElement('img');img.src=icon.src;img.alt=icon.name+' faction';img.title=icon.name;img.className='faction-icon';img.width=30;img.height=20;return img;}
