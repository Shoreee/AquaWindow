import {livingWave,roundedContour,smoothClosed} from './livingGeometry';
import {LivingRim} from './LivingRim';
import {memo} from 'react';
import type {AgentMotion} from '../agent/adaptive/choreography';
import {ease} from '../agent/adaptive/choreography';

export function leadingEdges(direction:[number,number],fallback:AgentMotion['edge']='right'){
 const [x,y]=direction,peak=Math.max(Math.abs(x),Math.abs(y)),edges:AgentMotion['edge'][]=[];
 if(peak>.01){if(Math.abs(x)>peak*.25)edges.push(x<0?'left':'right');if(Math.abs(y)>peak*.25)edges.push(y<0?'top':'bottom');}
 return edges.length?edges:[fallback];
}
export function boundaryEnvelope(motion?:AgentMotion){
 if(!motion)return 0;
 if(motion.interaction)return motion.interaction.strength;
 const division=motion.primitive==='branch'||motion.primitive==='merge';
 const progress=division?motion.action:motion.transport.active?motion.transport.progress:motion.action;
 return progress<=0||progress>=1?0:ease(progress/.16)*(1-ease((progress-.8)/.2));
}
/** A small vector mask bends the silhouette; no full-window per-pixel SVG filter. */
export function fluidGeometry(width:number,height:number,motion?:AgentMotion){
 const envelope=boundaryEnvelope(motion);
 if(!motion||envelope<.0001)return undefined;
 const enabled=motion.transport.active||['yield','branch','merge','encapsulate','permeate'].includes(motion.primitive);
 if(!enabled)return undefined;
 const yielding=!motion.transport.active&&(motion.boundary?.kind==='yield'||motion.primitive==='yield');
 const edges=yielding?(motion.boundary?.edges.length?motion.boundary.edges:[motion.edge]):leadingEdges(motion.direction,motion.edge),time=motion.elapsed;
 const division=motion.primitive==='branch'||motion.primitive==='merge';
 const gain=division?1.2:motion.primitive==='permeate'?.65:1;
 const carrying=motion.transport.active;
 const points=roundedContour(0,0,width,height).map(p=>{
  // The field extends onto the neighbouring side, past the rounded corner.
  const tension=Math.max(...edges.map(edge=>Math.exp(-(edge==='left'?p.x:edge==='right'?width-p.x:edge==='top'?p.y:height-p.y)/38)));
  const wave=livingWave(p.s,time);
  const nearest=edges.reduce((best,edge)=>{const distance=(e:typeof edge)=>e==='left'?p.x:e==='right'?width-p.x:e==='top'?p.y:height-p.y;return distance(edge)<distance(best)?edge:best;},edges[0]);
  const normal=nearest==='left'?[-1,0]:nearest==='right'?[1,0]:nearest==='top'?[0,-1]:[0,1];
  const displacement=motion.boundary?.deltas[nearest];
  const alignment=displacement===undefined?normal[0]*motion.direction[0]+normal[1]*motion.direction[1]:displacement*(nearest==='left'||nearest==='top'?-1:1);
  const directed=yielding?(Math.sign(alignment)||-1)*wave:wave;
  const offset=carrying?0:envelope*tension*gain*directed;
  return {x:p.x+p.nx*offset,y:p.y+p.ny*offset,tension};
 });
 // Smooth quadratic joins keep the corners and travelling crests continuous.
 const path=smoothClosed(points);
 const breath=envelope*(division?1:.35),sway=Math.sin(time*5.2);
 let activePath='';let active=false;
 points.forEach((p,i)=>{const prev=points[(i+points.length-1)%points.length],next=points[(i+1)%points.length];
  if(p.tension>.12){if(!active)activePath+=`M${((prev.x+p.x)/2).toFixed(2)} ${((prev.y+p.y)/2).toFixed(2)}`;
   activePath+=`Q${p.x.toFixed(2)} ${p.y.toFixed(2)} ${((p.x+next.x)/2).toFixed(2)} ${((p.y+next.y)/2).toFixed(2)}`;active=true;
  }else active=false;
 });
 return {clipPath:`path('${path}')`,path,activePath,width,height,
  contentTransform:`translate3d(${(breath*sway*1.8).toFixed(3)}px,${(breath*Math.cos(time*4.1)*1.2).toFixed(3)}px,0) skew(${(breath*sway*.38).toFixed(3)}deg,${(breath*Math.cos(time*3.7)*.14).toFixed(3)}deg) scaleX(${(1+breath*sway*.006).toFixed(5)})`,
  points,edges,envelope,carrying};
}

// This is the window's own material behind its content, clipped by the same moving silhouette.
export const FluidBoundary=memo(function FluidBoundary({geometry,material=true}:{geometry:NonNullable<ReturnType<typeof fluidGeometry>>;material?:boolean}){return <>
 {material&&<div className="agent-fluid-material" aria-hidden="true"/>}
 <svg className="agent-fluid-rim" width={geometry.width+24} height={geometry.height+24} viewBox={`-12 -12 ${geometry.width+24} ${geometry.height+24}`} aria-hidden="true" data-fluid-edges={geometry.edges.join(',')} style={{opacity:geometry.envelope}}>
  <path d={geometry.path} fill="none" stroke="white" strokeWidth=".8" opacity=".28"/>
  {!geometry.carrying&&<LivingRim path={geometry.activePath} frontClass="agent-fluid-front"/>}
 </svg></>});
