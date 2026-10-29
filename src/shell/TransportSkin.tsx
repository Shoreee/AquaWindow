import {useId} from 'react';
import type {AgentMotion} from '../agent/adaptive/choreography';
import {livingWave,roundedContour,smoothClosed} from './livingGeometry';
import {LivingRim} from './LivingRim';
/** The carrier grows over the page before travel, stays with it, then peels away at arrival. */
export function TransportSkin({width,height,motion}:{width:number;height:number;motion?:AgentMotion}){
 const key=useId().replace(/:/g,'');
 if(!motion?.transport.active||motion.transport.coverage<.0001)return null;
 const coverage=Math.max(0,Math.min(1,motion.transport.coverage)),x=motion.transport.origin?motion.transport.origin[0]*width:motion.direction[0]<0?width:0,y=motion.transport.origin?motion.transport.origin[1]*height:motion.direction[1]<0?height:0;
 const radius=Math.hypot(Math.max(x,width-x),Math.max(y,height-y))*(coverage*1.025),path=smoothClosed(roundedContour(0,0,width,height));
 const frontier=Array.from({length:100},(_,i)=>{const angle=i/100*Math.PI*2,r=radius+livingWave(i*Math.max(1,radius)*Math.PI/50,motion.elapsed)*Math.sin(Math.PI*coverage);return {x:x+Math.cos(angle)*r,y:y+Math.sin(angle)*r};});
 const frontPath=smoothClosed(frontier);
 const phase=coverage<.98?(motion.transport.progress>.7?'release':'engulf'):'carry';
 return <svg className="agent-transport-skin" width={width} height={height} data-transport-origin={`${x},${y}`} data-transport-stage={phase} data-transport-coverage={coverage} aria-hidden="true">
  <defs>
   <clipPath id={`carry-page-${key}`}><path d={path}/></clipPath>
   <clipPath id={`carry-growth-${key}`}><path d={frontPath}/></clipPath>
   <radialGradient id={`carry-tissue-${key}`} cx={`${x/width*100}%`} cy={`${y/height*100}%`} r="130%">
    <stop offset="0" stopColor="#f9fdff" stopOpacity=".04"/><stop offset=".7" stopColor="#effaff" stopOpacity=".12"/><stop offset="1" stopColor="#fff" stopOpacity=".24"/>
   </radialGradient>
  </defs>
  <g clipPath={`url(#carry-page-${key})`}>
   <g clipPath={`url(#carry-growth-${key})`}>
    <rect width={width} height={height} fill={`url(#carry-tissue-${key})`}/>
    <path d={path} fill="none" stroke="#fbfeff" strokeWidth="11" opacity=".28"/>
    <LivingRim path={path}/>
   </g>
   {coverage<.98&&<>
    <path className="agent-engulf-front" d={frontPath} fill="none" stroke="#fbfeff" strokeWidth="10" opacity=".34"/>
    <LivingRim path={frontPath}/>
   </>}
  </g>
 </svg>;
}
