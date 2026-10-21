import {DEFAULT_APPLICATION_SETTINGS} from './compiled-configuration.js?v=babbc3d3950e';
const smooth=(a,range,x)=>{const t=Math.min(1,Math.max(0,(x-a)/range));return t*t*(3-2*t);};
// Thresholds are measured in screen pixels per hex, independent of map size.
export function roadLod(scale,settings=DEFAULT_APPLICATION_SETTINGS.rendering){const pixels=Math.sqrt(3)*Math.max(0,scale);return {visibility:smooth(settings.roadVisibilityStart,settings.roadVisibilityRange,pixels),detail:smooth(settings.roadDetailStart,settings.roadDetailRange,pixels),buildings:smooth(settings.buildingDetailStart,settings.buildingDetailRange,pixels)};}
export function filterTownTexture(source){
 source.scaleMode='linear';source.autoGenerateMipmaps=true;source.mipLevelCount=1+Math.floor(Math.log2(Math.max(source.width,source.height)));source.mipmapFilter='linear';source.update();
}
// Rasterize a quiet, full-hex map symbol once; ordinary frames only blend textures.
export function bakeRoadOverview(PIXI,renderer,mask){
 const graphics=new PIXI.Graphics(),hex=[],pixels=64;
 for(let i=0;i<6;i++){const angle=(-90+i*60)*Math.PI/180;hex.push(Math.cos(angle)*pixels,Math.sin(angle)*pixels);}
 graphics.poly(hex).fill(0xa69363);
 for(const [width,color] of [[.30,0x938058],[.23,0xd9c598]]){
  for(let i=0;i<6;i++)if(mask&(1<<i)){const angle=(-120+i*60)*Math.PI/180;graphics.moveTo(0,0).lineTo(Math.cos(angle)*Math.sqrt(3)/2*pixels,Math.sin(angle)*Math.sqrt(3)/2*pixels).stroke({width:width*pixels,color,cap:'butt'});}
  if(mask)graphics.circle(0,0,width/2*pixels).fill(color);
 }
 const texture=renderer.generateTexture({target:graphics,resolution:1,antialias:true,frame:new PIXI.Rectangle(-pixels,-pixels,pixels*2,pixels*2),textureSourceOptions:{scaleMode:'linear',autoGenerateMipmaps:true,mipLevelCount:8,mipmapFilter:'linear'}});
 graphics.destroy();return texture;
}
