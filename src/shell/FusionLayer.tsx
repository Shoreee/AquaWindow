import {useEffect,useRef,useId} from 'react';
import type {KernelState,WindowState} from '../kernel/types';
import {useStore} from '../system/createStore';
import {stackingOrder} from '../techniques/visuals';
import {visualRect} from '../techniques/depth';
import {openingFront,seamPath} from './seamShape';
import {kernel} from '../system/kernel';
import {allSurfaceBonds,fusionPlacement,seamGeometry,type SurfaceBond} from './surfaceBondGeometry';
import {beginSurfaceSplit,surfaceUi} from './surfaceFusion';
import {ease} from '../agent/adaptive/choreography';
import {anticipationPair,anticipationPath} from './fusionAnticipation';
function FusionAnticipation({state,candidate}:{state:KernelState;candidate:{a:string;b:string}}){
 const a=useRef<SVGGElement>(null),b=useRef<SVGGElement>(null),latest=useRef({state,candidate});latest.current={state,candidate};
 useEffect(()=>{let raf=0;
  const draw=()=>{const pair=anticipationPair(latest.current.state,latest.current.candidate);
   if(pair)for(const [ref,w,first] of [[a,pair.a,pair.first],[b,pair.b,!pair.first]] as const){const d=anticipationPath(w,pair.axis,first);ref.current?.querySelectorAll('[data-living-path]').forEach(node=>node.setAttribute('d',d));}
   raf=requestAnimationFrame(draw);
  };raf=requestAnimationFrame(draw);return()=>cancelAnimationFrame(raf);
 },[]);
 return <g className="surface-fusion-anticipation" pointerEvents="none"><g ref={a}><path data-living-path className="surface-seam-line"/></g><g ref={b}><path data-living-path className="surface-seam-line"/></g></g>;
}
function SurfaceSeam({bond,a,b,state}:{bond:SurfaceBond;a:WindowState;b:WindowState;state:KernelState}){
 const split=useStore(surfaceUi,s=>s.split?.id===bond.id?s.split:null),latest=useRef({bond,a,b,split,state});latest.current={bond,a,b,split,state};
 const rim=useRef<SVGGElement>(null),freeA=useRef<SVGGElement>(null),freeB=useRef<SVGGElement>(null),root=useRef<SVGGElement>(null);
 const clipId=useId().replace(/:/g,'');
 const order=stackingOrder(state),above=order.slice(Math.max(order.indexOf(a.id),order.indexOf(b.id))+1).filter(id=>state.windows[id].group!==a.group);
 const visiblePath=`M0 0H${state.screen.w}V${state.screen.h}H0Z`+above.map(id=>{const r=visualRect(state.windows[id],state.screen);return `M${r.x} ${r.y}h${r.w}v${r.h}h${-r.w}Z`;}).join('');
 const seam=seamGeometry(visualRect(a,state.screen),visualRect(b,state.screen),bond.axis);
 useEffect(()=>{
  let raf=0;const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const write=(ref:typeof rim,path:string)=>ref.current?.querySelectorAll('[data-living-path]').forEach(node=>node.setAttribute('d',path));
  const draw=(now:number)=>{
   const c=latest.current,state=kernel.getState(),a=state.windows[c.bond.a],b=state.windows[c.bond.b];if(!a||!b)return;
   const g=seamGeometry(visualRect(a,state.screen),visualRect(b,state.screen),c.bond.axis),current=surfaceUi.get().split,s=current?.id===c.bond.id?current:null,p=s?.progress??0,time=reduced?0:now/1000;
   const action=Math.max(Number((a.props.agentMotion as {action?:number}|undefined)?.action??1),Number((b.props.agentMotion as {action?:number}|undefined)?.action??1)),birth=c.bond.createdAt===0?ease(action):ease((now-c.bond.createdAt)/780);
   const {position,width}=openingFront(p,g.length),opened=Math.max(0,Math.min(1,position+width)),boundary=s?.fromEnd?1-opened:opened;
   write(rim,seamPath(g,null,s?.fromEnd?0:boundary,s?.fromEnd?boundary:1,time,s));
   write(freeA,s?seamPath(g,true,s.fromEnd?boundary:0,s.fromEnd?1:boundary,time,s):'');
   write(freeB,s?seamPath(g,false,s.fromEnd?boundary:0,s.fromEnd?1:boundary,time,s):'');
   if(root.current)root.current.style.opacity=String(g.length<35?0:birth*(1-(s?.release??0)));
   raf=requestAnimationFrame(draw);
  };raf=requestAnimationFrame(draw);return()=>cancelAnimationFrame(raf);
 },[]);
 if(seam.length<35||Math.abs(seam.second-seam.first)>90)return null;
 const mid=(seam.first+seam.second)/2,vertical=seam.axis==='x';
 return <g ref={root} clipPath={`url(#seam-${clipId})`} data-surface-bond={bond.id} data-surface-progress={split?.progress??0} className={`surface-seam ${split?'separating':''}`}>
  <defs><clipPath id={`seam-${clipId}`}><path d={visiblePath} clipRule="evenodd"/></clipPath></defs>
  <g ref={rim}><path data-living-path className="surface-seam-line"/></g><g ref={freeA}><path data-living-path className="surface-seam-line"/></g><g ref={freeB}><path data-living-path className="surface-seam-line"/></g>
  <rect className="surface-seam-hit" x={vertical?mid-18:seam.lo-12} y={vertical?seam.lo-12:mid-18} width={vertical?36:seam.length+24} height={vertical?seam.length+24:36} fill="transparent" role="button" tabIndex={0}
   aria-label="从接缝端点沿接缝拉开窗口" onPointerDown={e=>{e.preventDefault();e.stopPropagation();beginSurfaceSplit(bond,e.nativeEvent);}}
   onKeyDown={e=>{if(e.key==='End'){e.preventDefault();beginSurfaceSplit(bond,new PointerEvent('pointerdown',{button:0,clientX:vertical?mid:seam.lo,clientY:vertical?seam.lo:mid}))?.complete();}}}>
   <title>从端点沿接缝拉到底分开 · 中途松手回合 · End 分开 · Esc 取消</title>
  </rect>

 </g>;
}
export function FusionLayer({state}:{state:KernelState}){
 const candidate=useStore(surfaceUi,s=>s.candidate),bonds=allSurfaceBonds(state);
 const preview=candidate&&state.windows[candidate.a]&&state.windows[candidate.b]?fusionPlacement(state.windows[candidate.a].rect,state.windows[candidate.b].rect,{x:8,y:36,w:state.screen.w-16,h:state.screen.h-122}):null;
 return <svg className="surface-fusion-layer" width={state.screen.w} height={state.screen.h} aria-label="窗口融合与表面张力接缝">
  {bonds.map(bond=><SurfaceSeam key={bond.id} bond={bond} a={state.windows[bond.a]} b={state.windows[bond.b]} state={state}/>)}
  {candidate&&<FusionAnticipation state={state} candidate={candidate}/>}
  {candidate&&preview&&<g className="surface-fusion-preview" pointerEvents="none"><rect x={preview.rect.x+20} y={preview.rect.y+45} width="146" height="28" rx="14"/><text x={preview.rect.x+31} y={preview.rect.y+63}>松开，让相关窗口融合</text></g>}
 </svg>;
}
