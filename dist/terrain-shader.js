import {oceanGLSL} from './ocean.js?v=babbc3d3950e';
export const vertex=`#version 300 es
in vec2 aPosition;
out vec2 vTextureCoord;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
void main(){
 vec2 position=aPosition*uOutputFrame.zw+uOutputFrame.xy;
 position.x=position.x*(2.0/uOutputTexture.x)-1.0;
 position.y=position.y*(2.0*uOutputTexture.z/uOutputTexture.y)-uOutputTexture.z;
 gl_Position=vec4(position,0.,1.);
 vTextureCoord=aPosition;
}`;
export const fragment=`#version 300 es
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uMap;
uniform sampler2D uDepth;
uniform sampler2D uCoastEdges;
uniform float uUseCoastEdges;
uniform sampler2D uShore;
uniform float uShoreSpacing;
uniform vec3 uWavePhases;
uniform vec2 uWaveHeadings;
uniform float uWaveBlend;
uniform float uWaveCycle;
uniform float uWaveStrength;
uniform sampler2D uWindField;
uniform float uFieldSpacing;
uniform float uFieldAge;
uniform sampler2D uPaper;
uniform sampler2D uTerrainAtlas;
uniform sampler2D uIndustryAtlas;
uniform float uIndustryColumns;
uniform vec2 uResolution;
uniform vec2 uCamera;
uniform float uScale;
uniform float uN;
uniform float uTime;
uniform vec2 uWind;
uniform vec2 uWaveOffset;
uniform float uGrid;
uniform float uLayer;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
${oceanGLSL}
vec4 fieldSample(sampler2D tex,vec2 p){
 ivec2 last=textureSize(tex,0)-1,b=ivec2(floor(p));vec2 f=fract(p);
 return mix(mix(texelFetch(tex,clamp(b,ivec2(0),last),0),texelFetch(tex,clamp(b+ivec2(1,0),ivec2(0),last),0),f.x),mix(texelFetch(tex,clamp(b+ivec2(0,1),ivec2(0),last),0),texelFetch(tex,clamp(b+ivec2(1,1),ivec2(0),last),0),f.x),f.y);
}
// Each moving crest owns independent, overlapping break events along its length.
float crestBreaking(vec2 p,float heading,float gust){
 vec2 dir=vec2(sin(heading),-cos(heading));
 float raw=dot(p,dir)*.785398163-uWavePhases.x;
 float crestId=floor((raw+1.570796327)/6.283185307)-uWaveCycle;
 float across=dot(p,vec2(-dir.y,dir.x))/4.;
 float segment=floor(across),result=0.;
 for(int j=-1;j<=1;j++){
  float id=segment+float(j),seed=hash(vec2(crestId,id)+17.);
  float duration=mix(5.,11.,seed),clock=uTime/duration+hash(vec2(id,crestId)+41.);
  float age=fract(clock),event=floor(clock);
  float chance=hash(vec2(crestId*7.+event,id+79.));
  float eventActive=smoothstep(.68-gust*.27,.83-gust*.27,chance);
  float life=smoothstep(.03,.24,age)*(1.-smoothstep(.48,.93,age));
  float center=id+(hash(vec2(id+23.,crestId))-.5)*.7;
  float span=1.-smoothstep(.05,mix(.5,.95,hash(vec2(crestId+61.,id))),abs(across-center));
  result+=span*life*eventActive;
 }
 return clamp(result,0.,1.);
}
vec2 roundHex(vec2 a){vec3 c=vec3(a.x,-a.x-a.y,a.y),r=floor(c+.5),d=abs(r-c);if(d.x>d.y&&d.x>d.z)r.x=-r.y-r.z;else if(d.z>d.y)r.z=-r.x-r.y;return r.xz;}
// Exactly one terrain sample per gameplay hex, indexed through odd-row storage.
vec3 tileAt(vec2 c){
 vec2 p=vec2(c.x+floor(c.y*.5),c.y);
 if(min(p.x,p.y)<0.||max(p.x,p.y)>uN-1.)return vec3(0.);
 return texture(uMap,(p+.5)/uN).rgb;
}
float depthAt(vec2 c){
 vec2 p=vec2(c.x+floor(c.y*.5),c.y);
 if(min(p.x,p.y)<0.||max(p.x,p.y)>uN-1.)return 44.;
 return texture(uDepth,(p+.5)/uN).r;
}
float industryAt(vec2 c){
 vec2 p=vec2(c.x+floor(c.y*.5),c.y);
 if(min(p.x,p.y)<0.||max(p.x,p.y)>uN-1.)return 0.;
 float marker=texture(uMap,(p+.5)/uN).a;
 return marker>=2.&&marker<=4.?marker-1.:marker>=6.&&marker<=uIndustryColumns+2.?marker-2.:0.;
}
const vec2 neighbors[6]=vec2[6](vec2(1,0),vec2(1,-1),vec2(0,-1),vec2(-1,0),vec2(-1,1),vec2(0,1));
const vec2 normals[6]=vec2[6](vec2(1,0),vec2(.5,-.8660254),vec2(-.5,-.8660254),vec2(-1,0),vec2(-.5,.8660254),vec2(.5,.8660254));
void main(){
 vec2 screen=vTextureCoord*uResolution;
 vec2 w=(screen-uResolution*.5)/uScale+uCamera;
 vec2 axial=vec2(w.x/1.7320508-w.y/3.,w.y/1.5);
 vec2 cell=roundHex(axial);
 vec2 delta=w-vec2(1.7320508*(cell.x+cell.y*.5),1.5*cell.y);
 vec3 f=tileAt(cell);
 float h=f.r,isLand=step(.35,h);
 bool landPixel=isLand>.5;
 float isBeach=isLand*(1.-step(.40,h));
 float coastDistance=2.,seaHeight=0.;
 // Interior land never uses neighbor samples. Beaches still need their exact edge mask.
 if(!landPixel||isBeach>.5){
  float seaSum=min(h,.345)*2.,seaWeight=2.;
  if(landPixel&&uUseCoastEdges>.5){
   vec2 p=vec2(cell.x+floor(cell.y*.5),cell.y);
   float mask=floor(texture(uCoastEdges,(p+.5)/uN).r*255.+.5);
   for(int i=0;i<6;i++)if(mod(floor(mask/exp2(float(i))),2.)>.5){
    float edgeDistance=max(0.,.8660254-dot(delta,normals[i]));
    coastDistance=min(coastDistance,edgeDistance);
   }
  }else for(int i=0;i<6;i++){
   vec3 neighbor=tileAt(cell+neighbors[i]);
   float edgeDistance=max(0.,.8660254-dot(delta,normals[i]));
   if(abs(step(.35,neighbor.r)-isLand)>.5)coastDistance=min(coastDistance,edgeDistance);
   if(!landPixel){float weight=1./(1.+6.*edgeDistance*edgeDistance);seaSum+=min(neighbor.r,.345)*weight;seaWeight+=weight;}
  }
  if(!landPixel)seaHeight=seaSum/seaWeight;
 }
 float aa=clamp(.75/uScale,.006,.06);
 float landMask=isBeach>.5?smoothstep(-aa,aa,coastDistance):isLand;
 float tilePixels=1.7320508*uScale;
 float detail=smoothstep(10.,36.,tilePixels);
 float paper=texture(uPaper,fract(w*.009)).r;
 float gran=.78;
 if(detail>0.)gran=texture(uPaper,fract(w*.061+vec2(.41,.17))).r;
 vec3 sand=vec3(.84,.76,.54),grass=vec3(.66,.71,.40),forest=vec3(.28,.46,.29),rocks=vec3(.56,.57,.50);
 vec3 col=vec3(0.);
 // Ocean work is needed only for water and the antialiasing band on beaches.
 if(!landPixel||landMask<1.){
 float oceanDepth=depthAt(cell);
 vec3 sea=oceanDepth<12.?vec3(.25,.48,.55):oceanDepth<22.?vec3(.19,.40,.49):oceanDepth<36.?vec3(.13,.32,.43):vec3(.085,.25,.36);
 // Four generated open-ocean bands; coastal shallows retain their turquoise edge.
 sea=mix(sea,vec3(.47,.70,.68),max(smoothstep(.25,.345,seaHeight),1.-smoothstep(.02,.55,coastDistance)));
 // Below eight screen pixels per hex, depth and coast color carry the overview.
 // The fade reaches the original full water detail at 22 pixels.
 float waterDetail=smoothstep(8.,22.,tilePixels);
 if(waterDetail>0.){
 vec4 localWind=fieldSample(uWindField,w/uFieldSpacing);
 float exposure=clamp(localWind.a,0.,1.);
 vec3 shore=fieldSample(uShore,w/uShoreSpacing).xyz;
 // Visual response only: 10% wind has the former 50% contrast.
 // Phase speed and CPU sailing still use the actual wind strength.
 float strength=uWaveStrength<=.1?uWaveStrength*5.:.5+(uWaveStrength-.1)*( .5/.9);
 vec4 surface=swell(w,uWaveHeadings.y,uWavePhases,shore);
 if(uWaveBlend<.999){vec4 oldSurface=swell(w,uWaveHeadings.x,uWavePhases,shore);surface=mix(oldSurface,surface,smoothstep(0.,1.,uWaveBlend));}
 // Trochoidal crests, broad troughs and analytical slopes; shelter scales all layers.
 float localAmplitude=strength*exposure*clamp(localWind.b,.65,1.35);
 // Consistent painted contrast relative to swell, independent of compass bearing.
 float lighting=clamp(-.19*surface.x*localAmplitude,-.18,.18);
 sea+=vec3(.34,.47,.43)*lighting*waterDetail;
 // Surface reflections remain legible over every depth band, including light wind.
 // Use the travelling primary crest, never a second noise layer or crossing waves.
 float crestReflection=smoothstep(.25,.95,surface.w)*localAmplitude*.16*waterDetail;
 sea=mix(sea,vec3(.64,.79,.80),clamp(crestReflection,0.,.24));
 // Foam follows the primary crest, not intersections between wave families.
 float crestHeight=(surface.w*.85+surface.z*.15)*localAmplitude;
 float crest=smoothstep(.60,1.05,crestHeight);
 float breaking=crestBreaking(w,uWaveHeadings.y,localWind.b);
 if(uWaveBlend<.999)breaking=mix(crestBreaking(w,uWaveHeadings.x,localWind.b),breaking,smoothstep(0.,1.,uWaveBlend));
 float foam=crest*breaking*.72*waterDetail;
 float shoreFoam=(1.-smoothstep(.1,1.6,shore.x))*smoothstep(-.4,.7,surface.z)*(.35+.65*breaking)*localAmplitude*.35;
 // Exact hex edge distance keeps foam visible on sub-mask-width beaches.
 shoreFoam=max(shoreFoam,exp(-coastDistance*18.)*localAmplitude*(.10+.15*breaking));
 sea=mix(sea,vec3(.84,.90,.83),clamp(foam+shoreFoam*waterDetail,0.,.85));
 }
 col=sea;
 }
 float road=0.;
 // The biome overlay also reads road tags over water and beyond the map edge.
 if(landPixel||(uLayer>1.5&&uLayer<2.5)){
  vec2 mapCell=vec2(cell.x+floor(cell.y*.5),cell.y);
  road=1.-step(.5,abs(texture(uMap,(mapCell+.5)/uN).a-5.));
 }
 if(landPixel){
 // Five atlas rows: beach, grass, woodland, desert, rock; three painted variants each.
 float biome=h<.40?0.:f.b>.52?4.:f.g<.34?3.:f.g>.62?2.:1.;
 vec3 overview=biome<.5?vec3(.89,.77,.51):biome<1.5?vec3(.57,.63,.27):biome<2.5?vec3(.34,.43,.21):biome<3.5?vec3(.80,.56,.29):vec3(.51,.51,.42);
 vec3 land=overview;
 if(detail>0.){
  float variant=floor(hash(cell+vec2(41.,17.))*3.);
  vec2 atlasCellSize=vec2(textureSize(uTerrainAtlas,0))/vec2(3.,5.);
  // Explicit zoom-based LOD avoids derivative spikes at hex and atlas boundaries.
  float lod=clamp(log2(atlasCellSize.x/max(tilePixels,1.))+.35,.8,4.);
  vec2 inset=max(vec2(.015),(exp2(lod)+1.)/atlasCellSize);
  vec2 tileUV=clamp(delta/vec2(1.7320508,2.)+.5,inset,vec2(1.)-inset);
  vec2 atlasUV=(vec2(variant,biome)+tileUV)/vec2(3.,5.);
  vec3 painted=textureLod(uTerrainAtlas,atlasUV,lod).rgb;
  // A small pigment wash calms close-up detail; distant hexes become broad color shapes.
  land=mix(overview,painted,.88*detail);
 }
 if(road>.5)land=vec3(.65,.58,.39);
 // Industry surfaces have zero opacity at scales of ten or less.
 if(uScale>10.){
 float industry=industryAt(cell);
 if(industry>.5){
  vec2 industrySize=vec2(textureSize(uIndustryAtlas,0))/vec2(uIndustryColumns,1.);
  float industryLod=clamp(log2(industrySize.x/max(tilePixels,1.))+.35,.8,4.);
  vec2 industryInset=max(vec2(.015),(exp2(industryLod)+1.)/industrySize);
  vec2 parcelUV=clamp(delta/vec2(1.7320508,2.)+.5,industryInset,vec2(1.)-industryInset);
  vec3 parcel=textureLod(uIndustryAtlas,(vec2(industry-1.,0.)+parcelUV)/vec2(uIndustryColumns,1.),industryLod).rgb;
  vec3 parcelOverview=industry<1.5?vec3(.65,.69,.44):industry<2.5?vec3(.47,.45,.39):vec3(.48,.62,.30);
  // Replace the whole hex surface, including its edges. No building sprite overlay.
  land=mix(land,mix(parcelOverview,parcel,.90*detail),smoothstep(10.,20.,uScale));
 }
 }
 // Neighbor-dependent painting is restricted to genuine beach tiles.
 // All other land samples their unchanged pre-rendered tile right to the edge.
 if(isBeach>.5&&road<.5){
  float wetSand=1.-smoothstep(.025,.18,coastDistance);
  land=mix(land,land*vec3(.83,.86,.87),wetSand*.40);
 }
 col=landMask>=1.?land:mix(col,land,landMask);
 }
 col*=.91+paper*.11;col+=(gran-.78)*.035*detail;
 if(uLayer>.5&&uLayer<1.5){col=mix(vec3(.12,.27,.39),vec3(.89,.83,.57),smoothstep(.05,.6,h));col+=vec3(.06)*step(.35,h);col-=.065*(1.-smoothstep(.03,.10,abs(fract(h*30.)-.5)));}
 if(uLayer>1.5&&uLayer<2.5){vec3 b=h<.35?(h>.26?vec3(.47,.70,.68):vec3(.15,.34,.42)):h<.4?sand:f.b>.52?rocks:f.g<.34?sand:f.g>.62?forest:grass;col=road>.5?vec3(.65,.58,.39):b;}
 // Inset wooden trim belongs to the tile surface, not an overlapping sprite.
 if(landPixel&&tilePixels>7.){
 vec2 rimDelta=abs(delta);
 float rimEdge=max(rimDelta.x,dot(rimDelta,vec2(.5,.8660254)));
 float rimAA=min(.012,.5/uScale);
 float rimMask=smoothstep(.814-rimAA,.814+rimAA,rimEdge);
 float rimBevel=smoothstep(.814,.829,rimEdge)*(1.-smoothstep(.846,.8660254,rimEdge));
 float grain=sin(rimEdge*620.+noise(cell*3.7)*8.)*.018;
 vec3 wood=mix(vec3(.29,.18,.095),vec3(.64,.44,.24),rimBevel)+grain;
 float rimColumn=cell.x+floor(cell.y*.5);
 float inMap=step(0.,rimColumn)*step(0.,cell.y)*step(rimColumn,uN-1.)*step(cell.y,uN-1.);
 // Fine trim recedes at overview scale, avoiding a dense mesh of dark lines.
 col=mix(col,wood,rimMask*inMap*isLand*smoothstep(7.,25.,tilePixels)*.90);
 }
 if(uGrid>.5){vec2 c=roundHex(axial),delta=w-vec2(1.7320508*(c.x+c.y*.5),1.5*c.y);vec2 d=abs(delta);float edge=max(d.x,dot(d,vec2(.5,.8660254)));float width=max(.012,.75/uScale);float line=smoothstep(.8660254-width,.8660254,edge);float colIndex=c.x+floor(c.y*.5);float inside=step(0.,colIndex)*step(0.,c.y)*step(colIndex,uN-1.)*step(c.y,uN-1.);col=mix(col,vec3(.82,.89,.74),line*.35*inside);}
 if(uLayer>2.5){
  vec4 localWind=fieldSample(uWindField,w/uFieldSpacing);
  float speed=length(localWind.xy);
  col=mix(vec3(.08,.23,.34),vec3(.92,.73,.32),clamp(speed,0.,1.));
  vec2 dir=speed>.001?localWind.xy/speed:vec2(1.,0.);
  vec2 d=(fract(w/8.)-.5)*8.;float along=dot(d,dir),across=dot(d,vec2(-dir.y,dir.x));
  float shaft=max(abs(along)-1.3,abs(across)-.07);
  float head=max(abs(across)-(.9-along)*.6,max(along-.9,-along-.1));
  float arrow=1.-smoothstep(0.,max(.025,.75/uScale),min(shaft,head));
  col=mix(col,vec3(.9,.95,.9),arrow*step(.015,speed)*.75);
  col=mix(col,vec3(.25,.29,.22),isLand*.9);
 }
 // Gentle chart-edge vignette independent of world coordinates.
 float vignette=length((vTextureCoord-.5)*vec2(1.,.8));col*=1.-.09*smoothstep(.2,.7,vignette);
 finalColor=vec4(col,1.);
}`;

// Pixi logs shader errors without necessarily throwing. Fail visibly instead of showing an empty sea.
export function validateTerrainProgram(gl){
 const shaders=[];let program;
 try{
  for(const [kind,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){
   const shader=gl.createShader(kind);if(!shader)throw Error('Could not create terrain shader.');shaders.push(shader);
   gl.shaderSource(shader,source.replace('#version 300 es','#version 300 es\nprecision highp float;'));
   gl.compileShader(shader);
   if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error('Terrain shader failed: '+gl.getShaderInfoLog(shader));
  }
  program=gl.createProgram();if(!program)throw Error('Could not create terrain program.');
  for(const shader of shaders)gl.attachShader(program,shader);
  gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Terrain shader could not link: '+gl.getProgramInfoLog(program));
 }finally{for(const shader of shaders)gl.deleteShader(shader);if(program)gl.deleteProgram(program);}
}
