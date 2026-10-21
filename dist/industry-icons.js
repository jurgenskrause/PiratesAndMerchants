import {DEFAULT_APPLICATION_SETTINGS} from './compiled-configuration.js?v=babbc3d3950e';
import {industryRegistry,assetRegistry} from './simulation-registry.js?v=babbc3d3950e';
import {axialToWorld} from './world.js?v=babbc3d3950e';

export function industryIconAlpha(scale,settings=DEFAULT_APPLICATION_SETTINGS.rendering){return 1-Math.max(0,Math.min(1,(scale-settings.industryFadeStart)/settings.industryFadeRange));}
// Shared pre-rendered atlas; no text layout, asset loads or simulation work per frame.
export class IndustryIconRenderer{
 constructor(app,textures,{settings=DEFAULT_APPLICATION_SETTINGS.rendering,iconPixels=settings.industryIconPixels}={}){
  this.settings=settings;this.configurationRevision=settings.revision;this.iconPixels=iconPixels;
  this.layer=new PIXI.Container({isRenderGroup:true});app.stage.addChild(this.layer);this.items=[];this.frames=new Map();
  for(const definition of industryRegistry.values()){
   const {icon_asset,icon_frame}=definition.graphics,atlas=textures.get(icon_asset),asset=assetRegistry.get(icon_asset),w=atlas.width/asset.columns,h=atlas.height/asset.rows;
   this.frames.set(definition.id,new PIXI.Texture({source:atlas.source,frame:new PIXI.Rectangle(icon_frame%asset.columns*w,Math.floor(icon_frame/asset.columns)*h,w,h)}));
  }
 }
 setSettings(settings){this.settings=settings;this.configurationRevision=settings.revision;this.setIconSize(settings.industryIconPixels);}
 setIconSize(pixels){this.iconPixels=pixels;for(const {sprite} of this.items){sprite.width=pixels;sprite.height=pixels;}this.lastView=null;}
 setWorld(world){
  for(const item of this.items)item.sprite.destroy();this.items=[];
  for(const industry of world.industries??[]){
   const sprite=new PIXI.Sprite(this.frames.get(industry.type));sprite.anchor.set(.5);sprite.width=this.iconPixels;sprite.height=this.iconPixels;sprite.eventMode='none';this.layer.addChild(sprite);
   const position=industry.position??axialToWorld(industry.q,industry.r);this.items.push({sprite,position});
  }
  this.lastView=null;if(this.view)this.update(...this.view);
 }
 update(camera,scale,width,height,mapLayer=0){
  if(this.renderedIconPixels!==this.iconPixels){for(const {sprite} of this.items){sprite.width=this.iconPixels;sprite.height=this.iconPixels;}this.renderedIconPixels=this.iconPixels;}this.view=[{...camera},scale,width,height,mapLayer];const key=[camera.x,camera.y,scale,width,height,mapLayer].join(':');if(key===this.lastView)return;this.lastView=key;
  const alpha=industryIconAlpha(scale,this.settings);this.layer.visible=alpha>0&&mapLayer===0;if(!this.layer.visible)return;this.layer.alpha=alpha;
  for(const {sprite,position} of this.items){const x=(position.x-camera.x)*scale+width/2,y=(position.y-camera.y)*scale+height/2;sprite.visible=x>=-this.iconPixels&&x<=width+this.iconPixels&&y>=-this.iconPixels&&y<=height+this.iconPixels;if(sprite.visible)sprite.position.set(x,y);}
 }
}
