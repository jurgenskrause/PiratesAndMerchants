// Register painted artwork to exact gameplay hex vertices and edge midpoints.
// A static 12-triangle fan is built once per texture, not per simulation tick.
export function roadGeometry(vertices,edgeCenters){
 const positions=[0,0],uvs=[vertices.reduce((n,v)=>n+v[0],0)/6,vertices.reduce((n,v)=>n+v[1],0)/6],indices=[];
 for(let i=0;i<6;i++){
  const angle=(-150+i*60)*Math.PI/180,next=angle+Math.PI/3;
  const a=[Math.cos(angle),Math.sin(angle)],b=[Math.cos(next),Math.sin(next)];
  positions.push(...a,(a[0]+b[0])/2,(a[1]+b[1])/2);
  uvs.push(...vertices[i],...edgeCenters[i]);
 }
 for(let i=0;i<12;i++)indices.push(0,i+1,(i+1)%12+1);
 return {positions:new Float32Array(positions),uvs:new Float32Array(uvs),indices:new Uint32Array(indices)};
}
