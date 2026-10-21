import {filterTownTexture} from './road-lod.js?v=babbc3d3950e';
import {axialToWorld} from './world.js?v=babbc3d3950e';
import {assetRegistry,settlementRegistry,dockRegistry,createAssetLoader} from './simulation-registry.js?v=babbc3d3950e';
// Every dock orientation is separately painted; perspective artwork is never rotated.
export const DOCK_ANCHORS=[[.96582,.59381],[.71056,.17988],[.18395,.17486],[.28027,.47771],[.34404,.72827],[.55977,.73914]];
export const EDGE_NORMALS=[[1,0],[.5,-.8660254],[-.5,-.8660254],[-1,0],[-.5,.8660254],[.5,.8660254]];
export const TILE_INSET=.94, DOCK_SPAN=2*TILE_INSET, HARBOR_SPAN=1.8;
export const HEX_MASK=Array.from({length:6},(_,i)=>{const a=(i*60-90)*Math.PI/180;return [Math.cos(a)*TILE_INSET,Math.sin(a)*TILE_INSET];}).flat();
export function dockSpritePosition(port){const a=DOCK_ANCHORS[port.attachmentEdge],normal=EDGE_NORMALS[port.attachmentEdge];return{x:port.dockPosition.x+normal[0]*Math.sqrt(3)/2*TILE_INSET-(a[0]-.5)*DOCK_SPAN,y:port.dockPosition.y+normal[1]*Math.sqrt(3)/2*TILE_INSET-(a[1]-.5)*DOCK_SPAN};}
export class PortRenderer{
 constructor(app,dockAtlas,harborAtlas){
  this.app=app;this.layer=new PIXI.Container({isRenderGroup:true});this.labels=new PIXI.Container({isRenderGroup:true});this.items=[];this.assetFrames=new Map();this.tileTextures=new Map();this.tileGeometries=new Map();this.filteredSources=new WeakSet();this.assetPromises=new Map();this.loadAsset=createAssetLoader(url=>PIXI.Assets.load(url));app.stage.addChild(this.layer,this.labels);
  this.frames=(atlas,cols,rows)=>Array.from({length:cols*rows},(_,i)=>new PIXI.Texture({source:atlas.source,frame:new PIXI.Rectangle((i%cols)*atlas.width/cols+1,Math.floor(i/cols)*atlas.height/rows+1,atlas.width/cols-2,atlas.height/rows-2)}));
  const profile=settlementRegistry.get('port'),dock=assetRegistry.get(profile.graphics.dock_asset),harbor=assetRegistry.get(profile.graphics.harbor_asset);this.docks=this.frames(dockAtlas,dock.columns,dock.rows);this.harbors=this.frames(harborAtlas,harbor.columns,harbor.rows);this.assetFrames.set(profile.graphics.dock_asset,this.docks);
 }
 dockVisual(record){const definition=record.dockTypeId?dockRegistry.get(record.dockTypeId):null;if(record.tiles&&definition)return this.perspectiveDockVisual(record,definition);const rotation=definition?.graphics.rotations[String(record.rotation??0)],frames=this.assetFrames.get(rotation?.asset_id)??this.docks;
  if(rotation&&!this.assetFrames.has(rotation.asset_id)&&!this.assetPromises.has(rotation.asset_id)){const promise=this.loadAsset(rotation.asset_id).then(atlas=>{const asset=assetRegistry.get(rotation.asset_id);this.assetFrames.set(rotation.asset_id,this.frames(atlas,asset.columns,asset.rows));if(this.world)this.setWorld(this.world);}).catch(error=>{this.assetPromises.delete(rotation.asset_id);console.error('Dock artwork:',error);});this.assetPromises.set(rotation.asset_id,promise);}
  const sprite=new PIXI.Sprite(frames[rotation?.atlas_frame??record.attachmentEdge]??frames[0]);sprite.anchor.set(.5);sprite.width=DOCK_SPAN;sprite.height=DOCK_SPAN;const position=dockSpritePosition(record);sprite.position.set(position.x,position.y);if(definition)sprite.tint=Number.parseInt(definition.graphics.tint.slice(1),16);return sprite;
 }
 perspectiveDockVisual(record,definition){
  if(record.tiles.length===1)return this.dockPaintedPart(record,definition,'small',0);
  const group=new PIXI.Container();
  for(const [index,part] of ['base','tip'].entries())group.addChild(this.dockPaintedPart(record,definition,part,index));
  return group;
 }
 dockPaintedPart(record,definition,part,index){
  const views=part==='tip'?definition.graphics.tip_rotations:definition.graphics.rotations,view=views[String(record.rotation??0)],id=view.asset_id;
  if(!this.tileTextures.has(id)){
   if(!this.assetPromises.has(id))this.assetPromises.set(id,this.loadAsset(id).then(atlas=>{if(!this.filteredSources.has(atlas.source)){filterTownTexture(atlas.source);this.filteredSources.add(atlas.source);}this.tileTextures.set(id,atlas);if(this.world)this.setWorld(this.world);}).catch(error=>{this.assetPromises.delete(id);console.error('Dock artwork:',error);}));
   return new PIXI.Container();
  }
  const texture=this.tileTextures.get(id),asset=assetRegistry.get(id),key=id+':'+view.atlas_frame;
  if(!this.tileGeometries.has(key)){
   const fw=texture.width/asset.columns,fh=texture.height/asset.rows,cx=(view.atlas_frame%asset.columns+.5+(view.center_offset?.[0]??0))*fw,cy=(Math.floor(view.atlas_frame/asset.columns)+.5+(view.center_offset?.[1]??0))*fh,radius=Math.min(fw,fh)*asset.tile_radius;
   // Map source pixels uniformly into one regular hex: no endpoint stretching, rotation, or mirroring.
   const vertices=[0,0],uvs=[cx/texture.width,cy/texture.height],indices=[];
   for(let i=0;i<6;i++){const a=(i*60-90)*Math.PI/180,x=Math.cos(a),y=Math.sin(a);vertices.push(x,y);uvs.push((cx+x*radius)/texture.width,(cy+y*radius)/texture.height);indices.push(0,i+1,(i+1)%6+1);}
   this.tileGeometries.set(key,new PIXI.MeshGeometry({positions:new Float32Array(vertices),uvs:new Float32Array(uvs),indices:new Uint32Array(indices)}));
  }
  const sprite=new PIXI.Mesh({texture,geometry:this.tileGeometries.get(key)}),tile=record.tiles[index],position=axialToWorld(tile.q,tile.r);
  sprite.position.set(position.x,position.y);sprite.tint=Number.parseInt(definition.graphics.tint.slice(1),16);sprite.label=part;return sprite;
 }

 setWorld(world){
  this.world=world;for(const item of this.items){for(const d of item.dockItems){d.sprite.mask=null;d.sprite.destroy({children:true});d.mask.destroy();}item.harbor.mask=null;item.harbor.destroy();item.harborMask.destroy();item.marker.destroy();item.label.destroy();}this.items=[];
  for(const port of world.ports){
   const records=port.docks??[port],dockItems=records.map(record=>{const sprite=this.dockVisual(record),mask=new PIXI.Graphics().poly(HEX_MASK).fill(0xffffff);if(record.tiles){mask.clear();for(const tile of record.tiles){const p=axialToWorld(tile.q,tile.r);mask.poly(HEX_MASK.map((v,i)=>v/TILE_INSET+(i%2?p.y:p.x))).fill(0xffffff);}}else mask.position.set(record.dockPosition.x,record.dockPosition.y);this.layer.addChild(mask,sprite);sprite.mask=mask;return {record,sprite,mask};}),dock=dockItems[0].sprite,dockMask=dockItems[0].mask;
   const harbor=new PIXI.Sprite(this.harbors[port.factionIndex]);harbor.anchor.set(.5);harbor.width=HARBOR_SPAN;harbor.height=HARBOR_SPAN;harbor.position.set(port.harborPosition.x,port.harborPosition.y);
   const harborMask=new PIXI.Graphics().poly(HEX_MASK).fill(0xffffff);
   harborMask.position.set(port.harborPosition.x,port.harborPosition.y);
   this.layer.addChild(harborMask);harbor.mask=harborMask;
   const marker=new PIXI.Graphics().circle(0,0,1).fill(port.color).stroke({color:0xf7edcf,width:.4});marker.position.set(port.dockPosition.x,port.dockPosition.y);marker.visible=false;
   const label=new PIXI.Text({text:port.name,style:{fontFamily:'Georgia',fontSize:13,fill:0xfff3ce,stroke:{color:0x213c3f,width:3},fontWeight:'600'}});label.anchor.set(.5,0);
   this.layer.addChild(harbor,marker);this.labels.addChild(label);this.items.push({port,dock,harbor,dockMask,harborMask,marker,label,dockItems});
  }
  // Asset loads can rebuild the scene after its last camera update, including while paused.
  if(this.view)this.update(this.view.camera,this.view.scale,this.view.width,this.view.height);
 }
 update(camera,scale,width,height){
  this.view={camera:{...camera},scale,width,height};
  this.layer.position.set(width/2-camera.x*scale,height/2-camera.y*scale);this.layer.scale.set(scale);const occupied=[];
  for(const item of this.items){const {port,dock,harbor,dockMask,harborMask,marker,label,dockItems}=item;const x=(port.dockPosition.x-camera.x)*scale+width/2,y=(port.dockPosition.y-camera.y)*scale+height/2;const visible=x>-120&&x<width+120&&y>-120&&y<height+120;
   const detail=Math.max(0,Math.min(1,(scale-7)/9));harbor.alpha=detail;
   const showStructures=visible&&detail>0;
   // Pixi can clear didViewUpdate on masks that have never entered a draw list.
   // Rebuild their geometry when a previously hidden port enters the view.
   if(showStructures&&!harbor.visible)harborMask.onViewUpdate();for(const d of item.dockItems){const dx=(d.record.dockPosition.x-camera.x)*scale+width/2,dy=(d.record.dockPosition.y-camera.y)*scale+height/2,show=(d.record.tiles??[d.record.dockPosition]).some(tile=>{const p=tile.q===undefined?tile:axialToWorld(tile.q,tile.r),tx=(p.x-camera.x)*scale+width/2,ty=(p.y-camera.y)*scale+height/2;return tx>-120&&tx<width+120&&ty>-120&&ty<height+120;})&&detail>0;if(show&&!d.sprite.visible)d.mask.onViewUpdate();d.sprite.alpha=detail;d.sprite.visible=show;}
   harbor.visible=showStructures;marker.visible=visible&&detail<1;marker.alpha=1-detail;marker.scale.set(3.2/scale);
   label.position.set(x,y+scale*.85);let show=visible&&scale>=20;const rect={x:x-label.width/2,y:y+scale*.85,w:label.width,h:label.height};
   if(show&&occupied.some(r=>rect.x<r.x+r.w+8&&rect.x+rect.w+8>r.x&&rect.y<r.y+r.h+5&&rect.y+rect.h+5>r.y))show=false;
   label.visible=show;if(show)occupied.push(rect);
  }
 }
}
