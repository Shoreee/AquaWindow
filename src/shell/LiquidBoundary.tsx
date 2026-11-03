import {useEffect,useRef} from 'react';
import {LivingRim} from './LivingRim';
const resting='M8 1 C30 1 66 1 92 1 Q99 1 99 8 C99 35 99 65 99 92 Q99 99 92 99 C65 99 35 99 8 99 Q1 99 1 92 C1 65 1 35 1 8 Q1 1 8 1Z';
/** Shared pearl optics, moving only the boundary so document text stays sharp. */
export function LiquidBoundary(){
 const root=useRef<SVGSVGElement>(null);
 useEffect(()=>{
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const timer=setInterval(()=>{
   if(document.hidden)return;
   const t=performance.now()/1200,a=Math.sin(t)*.8,b=Math.cos(t*.8)*.8;
   const path=`M8 1 C30 ${1+a} 66 ${1-b} 92 1 Q99 1 99 8 C${99+b} 35 ${99-a} 65 99 92 Q99 99 92 99 C65 ${99-a} 35 ${99+b} 8 99 Q1 99 1 92 C${1-b} 65 ${1+a} 35 1 8 Q1 1 8 1Z`;
   root.current?.querySelectorAll('path').forEach(node=>node.setAttribute('d',path));
  },60);
  return()=>clearInterval(timer);
 },[]);
 return <svg ref={root} className="liquid-boundary" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><LivingRim path={resting}/></svg>;
}
