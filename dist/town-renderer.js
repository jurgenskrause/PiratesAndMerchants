import {DEFAULT_APPLICATION_SETTINGS} from './compiled-configuration.js?v=babbc3d3950e';
import {roadLod,filterTownTexture,bakeRoadOverview} from './road-lod.js?v=babbc3d3950e';
import {roadGeometry} from './road-geometry.js?v=babbc3d3950e';
import {assetRegistry,townBuildingRegistry,createAssetLoader} from './simulation-registry.js?v=babbc3d3950e';
import {resolveRoadTile} from './road-network.js?v=babbc3d3950e';
import {tileCoordinates,tileIndex} from './hex-topology.js?v=babbc3d3950e';
import {axialToWorld} from './world.js?v=babbc3d3950e';
// Read-only renderer: no population growth, commodity consumption or tick work.
export class TownRenderer{
 constructor(app,{settings=DEFAULT_APPLICATION_SETTINGS.rendering}={}){this.settings=settings;this.configurationRevision=settings.revision;this.layer=new PIXI.Container({isRenderGroup:true});app.stage.addChild(this.layer);this.textures=new Map();this.roadGeometries=new Map();this.overviewTextures=new Map();this.filteredSources=new WeakSet();this.renderer=app.renderer;this.load=createAssetLoader(url=>PIXI.Assets.load(url));this.revision=0;}
 async setWorld(world){
  const revision=++this.revision,records=[],industryTiles=new Set((world.industries??[]).map(i=>i.tileIndex));
  for(const port of world.ports??[]){
   const roadIndices=new Set((port.roadTiles??[]).map(r=>tileIndex(world,r)));
   for(const index of port.townTiles??[]){if(roadIndices.has(index))continue;const c=tileCoordinates(world,index);records.push({asset:'road:urban-infill',position:axialToWorld(c.q,c.r),rotation:0});}
   for(const road of port.roadTiles??[]){const visual=resolveRoadTile(road.mask);if(road.mask&&!industryTiles.has(tileIndex(world,road)))records.push({asset:visual.definition.asset_id,position:axialToWorld(road.q,road.r),rotation:visual.rotation,road:true,mask:road.mask});}
   for(const building of port.buildings??[]){const definition=townBuildingRegistry.get(building.buildingTypeId),variant=building.variant??0;records.push({asset:building.derelict?definition.derelict_variant:definition.variants[((variant%definition.variants.length)+definition.variants.length)%definition.variants.length],position:axialToWorld(building.q,building.r),rotation:0,building:true});}
  }
  try{await Promise.all([...new Set(records.map(r=>r.asset))].map(async id=>{if(this.textures.has(id))return;const base=await this.load(id),asset=assetRegistry.get(id);if(!this.filteredSources.has(base.source)){filterTownTexture(base.source);this.filteredSources.add(base.source);}let texture=base;if(asset.atlas_frame!==undefined&&!asset.hex_geometry){const width=base.width/asset.columns,height=base.height/asset.rows;texture=new PIXI.Texture({source:base.source,frame:new PIXI.Rectangle((asset.atlas_frame%asset.columns)*width,Math.floor(asset.atlas_frame/asset.columns)*height,width,height)});}this.textures.set(id,texture);}));}catch(error){console.error('Town artwork:',error);return;}
  if(revision!==this.revision)return;
  for(const child of this.layer.removeChildren())child.destroy({children:true});
  for(const record of records){const asset=assetRegistry.get(record.asset);let sprite;
   if(asset.hex_geometry){if(!this.roadGeometries.has(record.asset))this.roadGeometries.set(record.asset,new PIXI.MeshGeometry(roadGeometry(asset.hex_geometry.vertices,asset.hex_geometry.edge_centers)));sprite=new PIXI.Mesh({texture:this.textures.get(record.asset),geometry:this.roadGeometries.get(record.asset)});}
   else{sprite=new PIXI.Sprite(this.textures.get(record.asset));sprite.anchor.set(.5);sprite.width=sprite.height=record.building?1.8:2;}
   sprite.rotation=record.rotation*Math.PI/180;const tint=asset.tint;if(tint)sprite.tint=parseInt(tint.slice(1),16);
   if(record.road){
    if(!this.overviewTextures.has(record.mask))this.overviewTextures.set(record.mask,bakeRoadOverview(PIXI,this.renderer,record.mask));
    const overview=new PIXI.Sprite(this.overviewTextures.get(record.mask));overview.anchor.set(.5);overview.width=overview.height=2;
    const group=new PIXI.Container();group.addChild(overview,sprite);group.isRoad=true;group.overview=overview;group.paint=sprite;group.position.set(record.position.x,record.position.y);this.layer.addChild(group);
   }else{sprite.position.set(record.position.x,record.position.y);this.layer.addChild(sprite);}
  }
  if(this.view)this.update(this.view.camera,this.view.scale,this.view.width,this.view.height);
 }
 setSettings(settings){this.settings=settings;this.configurationRevision=settings.revision;this.lastView=null;}
 update(camera,scale,width,height){
  this.view={camera:{...camera},scale,width,height};
  const lod=roadLod(scale,this.settings);this.layer.position.set(width/2-camera.x*scale,height/2-camera.y*scale);this.layer.scale.set(scale);this.layer.visible=lod.visibility>0||lod.buildings>0;
  if(!this.layer.visible)return;
  for(const sprite of this.layer.children){
   const x=(sprite.x-camera.x)*scale+width/2,y=(sprite.y-camera.y)*scale+height/2;sprite.visible=x>-100&&x<width+100&&y>-100&&y<height+100;
   if(!sprite.visible)continue;
   if(sprite.isRoad){sprite.alpha=lod.visibility;sprite.paint.alpha=lod.detail;sprite.paint.visible=lod.detail>0;sprite.overview.visible=lod.detail<1;}
   else sprite.alpha=lod.buildings;
  }
 }
}
