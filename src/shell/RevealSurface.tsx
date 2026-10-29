import {LivingRim} from './LivingRim';
import {useEffect,useRef,type RefObject,type PointerEvent as RPE} from 'react';
import type {AgentView} from '../agent/adaptive/types';
import {kernel} from '../system';

import {revealContour,type RevealClosure} from './revealGeometry';
export type {RevealClosure} from './revealGeometry';
type Config={id:string;view:AgentView;width:number;height:number;progress:number;closure?:RevealClosure;body:RefObject<HTMLDivElement|null>;baseClip?:string};
export function RevealSurface(config:Config){
 const latest=useRef(config);latest.current=config;
 const isActive=config.progress>.0001&&(config.closure?.amount??0)<.9999;
 const rimGroup=useRef<SVGGElement>(null);
 const hitContour=useRef<SVGPathElement>(null);
 const flow=useRef<HTMLDivElement>(null),hit=useRef<SVGGElement>(null);
 useEffect(()=>{
  let frame=0;const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const draw=(now:number)=>{const c=latest.current,g=revealContour(c,reduced?0:now/1000);
   if(c.body.current)c.body.current.style.clipPath=g.active?`path(evenodd, 'M0 0H${c.width}V${c.height}H0Z ${g.path}')`:c.baseClip??'';
   rimGroup.current?.querySelectorAll('[data-living-path]').forEach(node=>node.setAttribute('d',g.active?g.rimPath:''));
   hitContour.current?.setAttribute('d',g.active?g.path:'');

   if(flow.current){flow.current.style.clipPath=`path('${g.path}')`;flow.current.style.opacity=g.active?String(c.progress*.24):'0';}
   if(hit.current){hit.current.style.display=g.active?'':'none';Array.from(hit.current.children).forEach((node,i)=>{const handle=g.handles[i];if(handle){node.setAttribute('cx',String(handle[0]));node.setAttribute('cy',String(handle[1]));}});}
   if(isActive)frame=requestAnimationFrame(draw);
  };frame=requestAnimationFrame(draw);
  return()=>{cancelAnimationFrame(frame);if(latest.current.body.current)latest.current.body.current.style.clipPath=latest.current.baseClip??'';};
 },[isActive]);
 const drag=(edge:string)=>(e:RPE)=>{
  if(e.button!==0)return;e.preventDefault();e.stopPropagation();
  const c=latest.current,g=revealContour(c,0),sx=e.clientX,sy=e.clientY,start=c.closure?.amount??0;
  kernel.beginGesture('reveal:close');let amount=start,frame=0;
  const set=(value:number)=>kernel.setProps(c.id,{agentRevealClosure:{edge,amount:value}});
  const move=(ev:PointerEvent)=>{const delta=(c.view.revealMode!=='hole'?-1:1)*(edge==='left'?ev.clientX-sx:edge==='right'?sx-ev.clientX:edge==='top'?ev.clientY-sy:sy-ev.clientY);amount=Math.max(0,Math.min(1,start+delta/Math.max(24,(edge==='left'||edge==='right'?g.rw:g.rh))));set(amount);};
  const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);const from=amount,to=amount>start+.06?1:start,t0=performance.now();
   const settle=(now:number)=>{if(!kernel.get(c.id)){kernel.endGesture();return;}const t=Math.min(1,(now-t0)/200),s=t*t*(3-2*t);set(from+(to-from)*s);if(t<1)frame=requestAnimationFrame(settle);else kernel.endGesture();};frame=requestAnimationFrame(settle);
  };
  cancelAnimationFrame(frame);window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);
 };
 const g=revealContour(config,0);
 return <>
  <div className="agent-reveal-flow" ref={flow} aria-hidden="true"/>
  <svg className="agent-reveal-rim" width={config.width} height={config.height} data-reveal-mode={config.view.revealMode??'edge'} data-reveal-source={config.view.revealSource}>
   <LivingRim ref={rimGroup} path={g.active?g.rimPath:''} frontClass="agent-reveal-contour"/>
   <path ref={hitContour} d={g.active?g.path:''} fill="none" stroke="transparent" strokeWidth="20" style={{pointerEvents:'stroke',cursor:'grab'}} data-reveal-handle="rim" onPointerDown={e=>{
    const bounds=e.currentTarget.ownerSVGElement!.getBoundingClientRect(),x=(e.clientX-bounds.x)*config.width/bounds.width,y=(e.clientY-bounds.y)*config.height/bounds.height;
    const closest=[...g.handles].sort((a,b)=>Math.hypot(Number(a[0])-x,Number(a[1])-y)-Math.hypot(Number(b[0])-x,Number(b[1])-y))[0];
    drag(String(closest[2]))(e);
   }}/>
   <g ref={hit}>{g.handles.map((q,i)=><circle key={i} cx={Number(q[0])} cy={Number(q[1])} r="18" fill="transparent" data-reveal-handle={String(q[2])} onPointerDown={drag(String(q[2]))}><title>拖动边缘闭合揭示</title></circle>)}</g>
  </svg>
 </>;
}
