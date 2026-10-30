import {useEffect,useRef,useId} from 'react';
import type {KernelState,WindowState} from '../kernel/types';
import {useStore} from '../system/createStore';
import {stackingOrder} from '../techniques/visuals';
import {visualRect} from '../techniques/depth';
import {LivingRim} from './LivingRim';
import {livingWave} from './livingGeometry';
import {allSurfaceBonds,fusionPlacement,seamGeometry,type SurfaceBond} from './surfaceBondGeometry';
import {beginSurfaceSplit,surfaceUi} from './surfaceFusion';
import {ease} from '../agent/adaptive/choreography';
function SurfaceSeam({bond,a,b,state}:{bond:SurfaceBond;a:WindowState;b:WindowState;state:KernelState}){
 const split=useStore(surfaceUi,s=>s.split?.id===bond.id?s.split:null),latest=useRef({bond,a,b,split,state});latest.current={bond,a,b,split,state};
 const rim=useRef<SVGGElement>(null),freeA=useRef<SVGGElement>(null),freeB=useRef<SVGGElement>(null),root=useRef<SVGGElement>(null);
 const clipId=useId().replace(/:/g,'');
 const order=stackingOrder(state),above=order.slice(Math.max(order.indexOf(a.id),order.indexOf(b.id))+1).filter(id=>state.windows[id].group!==a.group);
 const visiblePath=`M0 0H${state.screen.w}V${state.screen.h}H0Z`+above.map(id=>{const r=visualRect(state.windows[id],state.screen);return `M${r.x} ${r.y}h${r.w}v${r.h}h${-r.w}Z`;}).join('');
 const seam=seamGeometry(visualRect(a,state.screen),visualRect(b,state.screen),bond.axis);
 useEffect(()=>{
  let raf=0;const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const draw=(now:number)=>{const c=latest.current,g=seamGeometry(visualRect(c.a,c.state.screen),visualRect(c.b,c.state.screen),c.bond.axis),p=c.split?.progress??0;
   const action=Math.max(Number((c.a.props.agentMotion as {action?:number}|undefined)?.action??1),Number((c.b.props.agentMotion as {action?:number}|undefined)?.action??1)),birth=c.bond.createdAt===0?ease(action):ease((now-c.bond.createdAt)/780),start=Math.max(c.split?.fromEnd?0:p,(1-birth)/2),end=Math.min(c.split?.fromEnd?1-p:1,(1+birth)/2);
   const point=(normal:number,t:number)=>g.axis==='x'?{x:normal,y:g.lo+g.length*t}:{x:g.lo+g.length*t,y:normal};
   const wave=(t:number)=>livingWave(t*g.length,reduced?0:now/1000);
   const path=end-start>.002?Array.from({length:65},(_,i)=>{const t=start+(end-start)*i/64,q=point((g.first+g.second)/2+wave(t)*.42,t);return `${i?'L':'M'}${q.x.toFixed(2)} ${q.y.toFixed(2)}`;}).join(''):'';
   rim.current?.querySelectorAll('[data-living-path]').forEach(node=>node.setAttribute('d',path));
   for(const [ref,n] of [[freeA,g.first],[freeB,g.second]] as const){
    const lo=c.split?.fromEnd?1-p:0,hi=c.split?.fromEnd?1:p;
    const d=p>.001?Array.from({length:40},(_,i)=>{const t=lo+(hi-lo)*i/39,q=point(n+(ref===freeA?1:-1)*wave(t)*.22,t);return `${i?'L':'M'}${q.x.toFixed(2)} ${q.y.toFixed(2)}`;}).join(''):'';
    ref.current?.querySelectorAll('[data-living-path]').forEach(node=>node.setAttribute('d',d));
   }
   if(root.current)root.current.style.opacity=String(g.length<35?0:1-ease((p-.97)/.03));
   raf=requestAnimationFrame(draw);
  };raf=requestAnimationFrame(draw);return()=>cancelAnimationFrame(raf);
 },[]);
 if(seam.length<35||Math.abs(seam.second-seam.first)>90)return null;
 const mid=(seam.first+seam.second)/2,vertical=seam.axis==='x';
 return <g ref={root} clipPath={`url(#seam-${clipId})`} data-surface-bond={bond.id} data-surface-progress={split?.progress??0} className={`surface-seam ${split?'separating':''}`}>
  <defs><clipPath id={`seam-${clipId}`}><path d={visiblePath} clipRule="evenodd"/></clipPath></defs>
  <LivingRim ref={rim} path=""/><LivingRim ref={freeA} path=""/><LivingRim ref={freeB} path=""/>
  <rect className="surface-seam-hit" x={vertical?mid-14:seam.lo} y={vertical?seam.lo:mid-14} width={vertical?28:seam.length} height={vertical?seam.length:28} fill="transparent" role="button" tabIndex={0}
   aria-label="沿接缝从一端拉到底以分开窗口" onPointerDown={e=>beginSurfaceSplit(bond,e.nativeEvent)}
   onKeyDown={e=>{if(e.key==='End'){e.preventDefault();beginSurfaceSplit(bond,new PointerEvent('pointerdown',{button:0,clientX:vertical?mid:seam.lo,clientY:vertical?seam.lo:mid}))?.complete();}}}>
   <title>沿接缝从一端拉到底分开；中途松手回融 · End 完整分开 · Esc 取消</title>
  </rect>
  <g className="surface-seam-hint" transform={`translate(${vertical?mid+13:seam.lo+8} ${vertical?seam.lo+12:mid-17})`} pointerEvents="none"><rect x="0" y="-14" width="148" height="25" rx="12"/><text x="9" y="3">{split?`拉到底分开 · ${Math.round(split.progress*100)}%`:'沿接缝拉到底分开'}</text></g>
 </g>;
}
export function FusionLayer({state}:{state:KernelState}){
 const candidate=useStore(surfaceUi,s=>s.candidate),bonds=allSurfaceBonds(state);
 const preview=candidate&&state.windows[candidate.a]&&state.windows[candidate.b]?fusionPlacement(state.windows[candidate.a].rect,state.windows[candidate.b].rect,{x:8,y:36,w:state.screen.w-16,h:state.screen.h-122}):null;
 return <svg className="surface-fusion-layer" width={state.screen.w} height={state.screen.h} aria-label="窗口融合与表面张力接缝">
  {bonds.map(bond=><SurfaceSeam key={bond.id} bond={bond} a={state.windows[bond.a]} b={state.windows[bond.b]} state={state}/>)}
  {candidate&&preview&&<g className="surface-fusion-preview" pointerEvents="none"><rect x={preview.rect.x+20} y={preview.rect.y+45} width="146" height="28" rx="14"/><text x={preview.rect.x+31} y={preview.rect.y+63}>松开，让相关窗口融合</text></g>}
 </svg>;
}
