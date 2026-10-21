import {stepGuided} from './docking.js?v=babbc3d3950e';
import {safeSweep,safePose} from './navigation-safety.js?v=babbc3d3950e';
// Preserve the Layer 2 path/service machine; validate its position AND rotating hull.
export function safeGuidedStep(ship,motion,dt,world,safety,state,onDockCollision=null){if(motion.emergencySlide)return stepGuided(ship,motion,dt);const before={...ship},index=motion.index,traveled=motion.traveled,done=stepGuided(ship,motion,dt);if(safePose(world,before,ship.spec)&&safeSweep(world,before,ship,ship.spec))return done;safety.telemetry.guidedInterventions++;
 const proposed={...ship};
 if((state==='DOCKING'||state==='APPROACHING')&&onDockCollision){Object.assign(ship,before);motion.index=index;motion.traveled=traveled;if(onDockCollision()){safety.telemetry.dockEndSlides=(safety.telemetry.dockEndSlides??0)+1;return false;}}
 const translation={...proposed,heading:before.heading};
 if(safeSweep(world,before,translation,ship.spec)){Object.assign(ship,translation);if(motion.index===motion.path.length&&(state==='ANCHORING'||state==='RECOVERING'))motion.target={...motion.target,heading:ship.heading};return false;}
 Object.assign(ship,before);motion.index=index;motion.traveled=traveled;
 const pivot={...before,heading:proposed.heading};if(safeSweep(world,before,pivot,ship.spec)){ship.heading=pivot.heading;ship.vx=ship.vy=ship.speed=0;return false;}
 // A small, swept backing step makes room for the next pivot. Never extract through terrain.
 const back={...before,x:before.x-Math.sin(before.heading)*.18*dt,y:before.y+Math.cos(before.heading)*.18*dt};if(safeSweep(world,before,back,ship.spec)){ship.x=back.x;ship.y=back.y;}ship.vx=ship.vy=ship.speed=0;return false;
}
