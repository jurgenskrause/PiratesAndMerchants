// Half-resolution, screen-sized overlay. World anchoring keeps shadows attached
// to terrain during camera movement; altitude changes scale, softness and drift.
export const cloudFragment=`#version 300 es
in vec2 vTextureCoord;
out vec4 finalColor;
uniform vec2 uResolution;
uniform vec2 uCamera;
uniform float uScale;
uniform float uTime;
uniform vec2 uFlow;
float cloudHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float cloudNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(cloudHash(i),cloudHash(i+vec2(1,0)),f.x),mix(cloudHash(i+vec2(0,1)),cloudHash(i+1.),f.x),f.y);}
float cloudMass(vec2 p,float evolution){
 vec2 warp=vec2(cloudNoise(p*.43+13.),cloudNoise(p*.43-27.))-.5;
 p+=warp*.8;
 return cloudNoise(p)*.68+cloudNoise(p*2.07+vec2(19.,evolution))*.32;
}
void main(){
 vec2 w=(vTextureCoord*uResolution-uResolution*.5)/uScale+uCamera;
 float low=cloudMass((w-uFlow*.8)*.052+vec2(34.,71.),uTime*.008);
 float high=cloudMass((w-uFlow*1.35)*.024+vec2(-53.,18.),-uTime*.004);
 float lowerShadow=smoothstep(.43,.73,low)*.14;
 float upperShadow=smoothstep(.36,.79,high)*.075;
 float alpha=1.-(1.-lowerShadow)*(1.-upperShadow);
 // Pixi's filter output is premultiplied; no visible cloud paint or white layer.
 finalColor=vec4(vec3(.025,.065,.09)*alpha,alpha);
}`;
