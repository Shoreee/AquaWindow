import {useEffect,useRef,type RefObject} from 'react';
import type {WindowState} from '../kernel/types';
import {kernel} from '../system/kernel';
import {visualRect} from '../techniques/depth';
import {roundedContour,smoothClosed} from './livingGeometry';
import {surfaceBonds,seamGeometry} from './surfaceBondGeometry';
import {surfaceUi} from './surfaceFusion';
import {seamOffset} from './seamShape';
import {ease} from '../agent/adaptive/choreography';
import type {fluidGeometry} from './FluidBoundary';
/** Closed fusion never clips or dents a window. Only a deliberately opened zipper
 * separates its edges; preview/fused endpoint styling belongs to the optical rim. */
export function NativeBondSkin({win,shell,geometry,baseClip}:{win:WindowState;shell:RefObject<HTMLDivElement|null>;geometry?:ReturnType<typeof fluidGeometry>;baseClip?:string}){
 const latest=useRef({win,geometry,baseClip});latest.current={win,geometry,baseClip};
 useEffect(()=>{let raf=0;const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const draw=(now:number)=>{
   const c=latest.current,state=kernel.getState(),w=state.windows[c.win.id]??c.win,split=surfaceUi.get().split;
   const bond=split&&split.progress>0?surfaceBonds(w).find(b=>b.id===split.id):undefined;
   const restore=()=>{if(shell.current){shell.current.style.clipPath=c.geometry?.clipPath??c.baseClip??'';delete shell.current.dataset.nativeSeam;}};
   const a=bond&&state.windows[bond.a],b=bond&&state.windows[bond.b];
   if(!bond||!split||!a||!b||a.minimized||b.minimized||a.form!=='normal'||b.form!=='normal')restore();
   else{
    const vis=visualRect(w,state.screen),scale=vis.w/w.rect.w,g=seamGeometry(visualRect(a,state.screen),visualRect(b,state.screen),bond.axis);
    if(g.length<35||Math.abs(g.second-g.first)>90)restore();
    else{
     const first=w.id===bond.a,edge=first?(bond.axis==='x'?w.rect.w:w.rect.h):0;
     const points=(c.geometry?.points??roundedContour(0,0,w.rect.w,w.rect.h,10)).map(q=>({...q}));
     for(const q of points){
      const normal=bond.axis==='x'?q.x:q.y,along=bond.axis==='x'?vis.y+q.y*scale:vis.x+q.x*scale;
      const contact=ease((along-g.lo+25)/28)*ease((g.hi+25-along)/28)*Math.exp(-Math.abs(normal-edge)/24);
      const offset=seamOffset(g,first,(along-g.lo)/Math.max(1,g.length),reduced?0:now/1000,split)/scale*contact;
      if(bond.axis==='x')q.x+=offset;else q.y+=offset;
     }
     if(shell.current){shell.current.style.clipPath=`path('${smoothClosed(points)}')`;shell.current.dataset.nativeSeam='true';}
    }
   }
   raf=requestAnimationFrame(draw);
  };raf=requestAnimationFrame(draw);return()=>{cancelAnimationFrame(raf);if(shell.current){shell.current.style.clipPath=latest.current.geometry?.clipPath??latest.current.baseClip??'';delete shell.current.dataset.nativeSeam;}};
 },[win.id,shell]);return null;
}
