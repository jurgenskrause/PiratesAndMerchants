// True local wind angle, matching the no-go and drive calculation in physics.
export function sailingDrive(angle,noGo,bestAngle=Math.PI/2){return angle<=noGo?0:Math.max(0,.72+.28*Math.cos(angle-bestAngle));}
// Green includes at least 35 degrees of usable upwind heading on each tack.
export function sailingGreenRange(noGo,bestAngle=Math.PI/2){
 const spread=Math.acos((.96-.72)/.28);
 return {start:Math.max(noGo,Math.min(bestAngle-spread,55*Math.PI/180)),end:Math.min(Math.PI,bestAngle+spread)};
}
export function sailingAngleZone(angle,noGo,bestAngle=Math.PI/2){
 angle=Math.abs(Math.atan2(Math.sin(angle),Math.cos(angle)));
 if(angle<=noGo)return 'luffing';
 const green=sailingGreenRange(noGo,bestAngle);
 if(angle>=green.start&&angle<=green.end)return 'good';
 if(angle<noGo+.18)return 'close';
 return 'sailable';
}
