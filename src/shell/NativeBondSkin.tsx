import {useEffect,useRef,type RefObject} from 'react';
import type {WindowState} from '../kernel/types';
import {kernel} from '../system/kernel';
import {visualRect} from '../techniques/depth';
import {resampleClosed,squirclePoints,CONTOUR_SAMPLES} from '../field/sdf';
import {livingWave,smoothClosed} from './livingGeometry';
import {surfaceBonds,seamGeometry} from './surfaceBondGeometry';
import {surfaceUi} from './surfaceFusion';
import {ease} from '../agent/adaptive/choreography';
import type {fluidGeometry} from './FluidBoundary';
import {anticipationPair,anticipationOffset} from './fusionAnticipation';
/** Deform the actual two page silhouettes into a shared interface. No bridge is painted above them. */
export function NativeBondSkin({win,shell,geometry,baseClip}:{win:WindowState;shell:RefObject<HTMLDivElement|null>;geometry?:ReturnType<typeof fluidGeometry>;baseClip?:string}){
 const latest=useRef({win,geometry,baseClip});latest.current={win,geometry,baseClip};
 useEffect(()=>{let raf=0;const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const draw=(now:number)=>{const c=latest.current,state=kernel.getState(),w=state.windows[c.win.id]??c.win,vis=visualRect(w,state.screen),scale=vis.w/w.rect.w,split=surfaceUi.get().split;
   const points=(c.geometry?.points??resampleClosed(squirclePoints(w.rect.w,w.rect.h,30,5,12),CONTOUR_SAMPLES).map(q=>({x:q[0],y:q[1]}))).map(q=>({...q}));
   const pending=anticipationPair(state,surfaceUi.get().candidate);
   if(pending&&(w.id===pending.a.id||w.id===pending.b.id)){
    const first=w.id===pending.a.id?pending.first:!pending.first,axis=pending.axis,edge=first?(axis==='x'?w.rect.w:w.rect.h):0,length=axis==='x'?w.rect.h:w.rect.w;
    for(const q of points){const normal=axis==='x'?q.x:q.y,along=axis==='x'?q.y:q.x;
     const offset=anticipationOffset(along,length,reduced?0:now/1000)*(first?-1:1)*Math.exp(-Math.abs(normal-edge)/20);
     if(axis==='x')q.x+=offset;else q.y+=offset;
    }
   }
   for(const bond of surfaceBonds(w)){
    const a=state.windows[bond.a],b=state.windows[bond.b];if(!a||!b||a.minimized||b.minimized||a.form!=='normal'||b.form!=='normal')continue;
    const g=seamGeometry(visualRect(a,state.screen),visualRect(b,state.screen),bond.axis);if(g.length<35||Math.abs(g.second-g.first)>90)continue;
    const first=w.id===bond.a,edge=first?(bond.axis==='x'?w.rect.w:w.rect.h):0,p=split?.id===bond.id?split.progress:0;
    const birth=bond.createdAt===0?Math.min(1,Number((w.props.agentMotion as {action?:number}|undefined)?.action??1)):ease((now-bond.createdAt)/780);
    for(const q of points){const normalLocal=bond.axis==='x'?q.x:q.y,alongWorld=bond.axis==='x'?vis.y+q.y*scale:vis.x+q.x*scale;
     const contact=ease((alongWorld-g.lo+25)/28)*ease((g.hi+25-alongWorld)/28)*Math.exp(-Math.abs(normalLocal-edge)/24)*birth;
     const t=(alongWorld-g.lo)/Math.max(1,g.length),closed=split?.fromEnd?1-ease((t-(1-p))/.07):ease((t-p)/.07),wave=livingWave(alongWorld-g.lo,reduced?0:now/1000);
     const own=first?g.first:g.second,shared=(g.first+g.second)/2+wave*.42;
     const other=visualRect(first?b:a,state.screen),ownLo=bond.axis==='x'?vis.y:vis.x,ownHi=bond.axis==='x'?vis.y+vis.h:vis.x+vis.w,otherLo=bond.axis==='x'?other.y:other.x,otherHi=bond.axis==='x'?other.y+other.h:other.x+other.w;
     const splitHere=split?.id===bond.id,startJoin=splitHere?(split.fromEnd?1-ease((p-.9)/.1):1-ease(p/.1)):1,endJoin=splitHere?(split.fromEnd?1-ease(p/.1):1-ease((p-.9)/.1)):1;
     // Relieve the inside turn; an outward Gaussian makes a bead at the junction.
     const fillet=(ownLo<otherLo-1?5*Math.exp(-Math.pow((alongWorld-otherLo)/26,2))*startJoin:0)+(ownHi>otherHi+1?5*Math.exp(-Math.pow((alongWorld-otherHi)/26,2))*endJoin:0);
     const filletOffset=(first?-1:1)*fillet*birth*Math.exp(-Math.abs(normalLocal-edge)/24)/scale;
     if(bond.axis==='x')q.x+=filletOffset;else q.y+=filletOffset;
     const displacement=((shared-own)*closed+(first?1:-1)*wave*.22*(1-closed))/scale;
     if(bond.axis==='x')q.x+=displacement*contact;else q.y+=displacement*contact;
    }
   }
   if(shell.current){shell.current.style.clipPath=`path('${smoothClosed(points)}')`;shell.current.dataset.nativeSeam='true';}
   raf=requestAnimationFrame(draw);
  };raf=requestAnimationFrame(draw);return()=>{cancelAnimationFrame(raf);if(shell.current){shell.current.style.clipPath=latest.current.geometry?.clipPath??latest.current.baseClip??'';delete shell.current.dataset.nativeSeam;}};
 },[win.id,shell]);return null;
}
