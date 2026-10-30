import {kernel,workArea} from '../system/kernel';
import {toast} from '../system/ui';
import {createStore} from '../system/createStore';
import {cancelManualWindowMotion} from '../agent/adaptive/manualMotion';
import {cancelCapsuleMotion} from '../agent/adaptive/capsule';
import {documentContent,documentSeed} from '../apps/content';
import {ease} from '../agent/adaptive/choreography';
import type {KernelState,WindowState} from '../kernel/types';
import {fusionPlacement,isSurfaceGroup,seamGeometry,splitProgress,surfaceBonds,surfaceComponent,type SurfaceBond} from './surfaceBondGeometry';
export const surfaceUi=createStore({candidate:null as {a:string;b:string}|null,split:null as {id:string;progress:number;fromEnd:boolean;dragging:boolean}|null});
let stopCurrent:(()=>void)|null=null;
export const surfaceBusy=()=>!!stopCurrent;
export function cancelSurfaceInteraction(){if(!stopCurrent)return false;stopCurrent();return true;}
const normal=(w:WindowState)=>!w.minimized&&w.form==='normal'&&w.depth<.08;
export function relatedScore(a:WindowState,b:WindowState){
 const body=(w:WindowState)=>[w.title,w.props.paperId,w.props.docId,documentContent.get(String(w.props.docId))??documentSeed[String(w.props.docId)]??'',JSON.stringify(w.props.agentBranch??{})].join(' ').toLowerCase();
 const x=body(a),y=body(b);
 for(const id of [a.props.paperId,b.props.paperId])if(typeof id==='string'&&x.includes(id)&&y.includes(id))return 1;
 const apps=new Set([a.appId,b.appId]);
 if(apps.has('preview')&&apps.has('writer')&&/论文|研究|证据|paper|research/.test(x+y))return .8;
 if(apps.has('preview')&&apps.has('finder')&&String((a.appId==='finder'?a:b).props.path)==='Downloads')return .65;
 const tokens=new Set(x.match(/[a-z0-9]{4,}|[\u4e00-\u9fff]{2}/g)??[]),other=new Set(y.match(/[a-z0-9]{4,}|[\u4e00-\u9fff]{2}/g)??[]);
 const shared=[...tokens].filter(t=>other.has(t));return shared.length>=3?Math.min(.9,shared.length/Math.max(3,Math.min(tokens.size,other.size))):0;
}
export function relatedPartner(id:string,nearOnly=false){
 const state=kernel.getState(),a=state.windows[id];if(!a||!normal(a))return null;
 let best:{id:string;score:number}|null=null;
 for(const b of Object.values(state.windows)){
  if(b.id===id||!normal(b)||a.group&&a.group===b.group)continue;
  const relevance=relatedScore(a,b);if(relevance<.55)continue;
  const dx=Math.max(0,Math.max(a.rect.x-b.rect.x-b.rect.w,b.rect.x-a.rect.x-a.rect.w)),dy=Math.max(0,Math.max(a.rect.y-b.rect.y-b.rect.h,b.rect.y-a.rect.y-a.rect.h));
  const overlapX=Math.min(a.rect.x+a.rect.w,b.rect.x+b.rect.w)-Math.max(a.rect.x,b.rect.x),overlapY=Math.min(a.rect.y+a.rect.h,b.rect.y+b.rect.h)-Math.max(a.rect.y,b.rect.y);
  // Touching edges, not arbitrary overlap or distant window centres.
  const sideGap=Math.min(Math.abs(a.rect.x-b.rect.x-b.rect.w),Math.abs(a.rect.x+a.rect.w-b.rect.x)),verticalGap=Math.min(Math.abs(a.rect.y-b.rect.y-b.rect.h),Math.abs(a.rect.y+a.rect.h-b.rect.y));
  if(nearOnly&&!((sideGap<32&&overlapY>110)||(verticalGap<32&&overlapX>110)))continue;
  const score=relevance*100-Math.hypot(dx,dy)*.12;if(!best||score>best.score)best={id:b.id,score};
 }
 return best?.id??null;
}
export function previewSurfaceFusion(id:string|null){
 const b=id?relatedPartner(id,true):null,current=surfaceUi.get().candidate;
 if(current?.a===id&&current?.b===b||!current&&!b)return;
 surfaceUi.set({candidate:id&&b?{a:id,b}:null});
}
function rollback(base:KernelState,raf:number,continuing=false){const changed=continuing||kernel.getState()!==base;cancelAnimationFrame(raf);stopCurrent=null;surfaceUi.set({split:null,candidate:null});kernel.endGesture();if(changed)kernel.undo('user');}
export function fuseSurfaces(movingId:string,fixedId:string,continuingGesture=false){
 if(!continuingGesture){cancelSurfaceInteraction();cancelManualWindowMotion();cancelCapsuleMotion();}
 const base=kernel.getState(),moving=base.windows[movingId],fixed=base.windows[fixedId];
 if(!moving||!fixed||moving.group&&moving.group===fixed.group){if(continuingGesture)kernel.endGesture();return;}
 if(!continuingGesture)kernel.beginGesture('surface:fuse');
 const placement=fusionPlacement(moving.rect,fixed.rect,workArea()),group=isSurfaceGroup(moving.group)?moving.group:isSurfaceGroup(fixed.group)?fixed.group:`surface:${moving.id}:${fixed.id}`;
 const movingMembers=surfaceComponent(base,moving.id),members=new Set([...movingMembers,...surfaceComponent(base,fixed.id)]),start=performance.now();
 const ahead=placement.axis==='x'?placement.rect.x<fixed.rect.x:placement.rect.y<fixed.rect.y;
 const bond:SurfaceBond={id:`bond:${moving.id}:${fixed.id}:${Math.round(start)}`,a:ahead?moving.id:fixed.id,b:ahead?fixed.id:moving.id,axis:placement.axis,createdAt:start};
 const dx=placement.rect.x-moving.rect.x,dy=placement.rect.y-moving.rect.y;let raf=0;
 surfaceUi.set({candidate:null});
 const draw=(now:number)=>{
  const t=Math.min(1,(now-start)/780),k=ease(t),current=kernel.getState(),windows={...current.windows};
  for(const id of members){const original=base.windows[id],w=windows[id];if(!w)continue;
   const bonds=surfaceBonds(original);windows[id]={...w,group,depth:0,rect:movingMembers.includes(id)?{...original.rect,x:original.rect.x+dx*k,y:original.rect.y+dy*k}:original.rect,
    props:{...w.props,surfaceAnimating:t<1?true:undefined,surfaceBonds:id===bond.a||id===bond.b?[...bonds,bond]:bonds}};
  }
  kernel.previewState({...current,windows});
  if(t<1)raf=requestAnimationFrame(draw);else{stopCurrent=null;kernel.endGesture();toast('已融合 · 拖动任一标题栏一起移动；沿接缝拉到底可分开',true);}
 };
 stopCurrent=()=>rollback(base,raf,continuingGesture);raf=requestAnimationFrame(draw);
}
/** The opened part remains a liquid neck until the pointer reaches the far end. */
export function beginSurfaceSplit(bond:SurfaceBond,event:PointerEvent){
 if(event.button!==0)return;event.preventDefault();event.stopPropagation();cancelSurfaceInteraction();cancelManualWindowMotion();cancelCapsuleMotion();
 const base=kernel.getState(),a=base.windows[bond.a],b=base.windows[bond.b];if(!a||!b)return;
 const seam=seamGeometry(a.rect,b.rect,bond.axis);if(seam.length<30)return;
 const coordinate=bond.axis==='x'?event.clientY:event.clientX,fromEnd=coordinate>(seam.lo+seam.hi)/2;
 const carried=surfaceComponent(base,bond.b,bond.id);if(carried.includes(bond.a))return;
 kernel.beginGesture('surface:split');let progress=0,raf=0;
 const apply=(value:number,dragging:boolean)=>{
  progress=value;const state=kernel.getState(),windows={...state.windows};
  for(const id of carried){const original=base.windows[id],w=windows[id];if(w)windows[id]={...w,rect:{...original.rect,x:original.rect.x+(bond.axis==='x'?30*ease(value):0),y:original.rect.y+(bond.axis==='y'?30*ease(value):0)},props:{...w.props,surfaceAnimating:true}};}
  kernel.previewState({...state,windows});surfaceUi.set({split:{id:bond.id,progress:value,fromEnd,dragging}});
 };
 const detach=()=>{
  const state=kernel.getState(),windows={...state.windows};
  for(const [id,w] of Object.entries(windows))if(surfaceBonds(w).some(item=>item.id===bond.id))windows[id]={...w,props:{...w.props,surfaceBonds:surfaceBonds(w).filter(item=>item.id!==bond.id)}};
  for(const id of carried)if(windows[id])windows[id]={...windows[id],props:{...windows[id].props,surfaceAnimating:undefined}};
  let separated={...state,windows};const oldMembers=Object.values(windows).filter(w=>w.group===a.group);
  for(const w of oldMembers){const component=surfaceComponent(separated,w.id);windows[w.id]={...windows[w.id],group:component.length>1?`surface:${component.slice().sort().join(':')}`:undefined};}
  kernel.previewState({...state,windows});surfaceUi.set({split:null});stopCurrent=null;kernel.endGesture();toast('已分开 · 可独立移动',true);
 };
 const cleanup=()=>{window.removeEventListener('pointermove',move,true);window.removeEventListener('pointerup',up,true);window.removeEventListener('blur',cancel);};
 const cancel=()=>{cleanup();rollback(base,raf);};
 const move=(e:PointerEvent)=>{e.preventDefault();e.stopImmediatePropagation();apply(splitProgress(bond.axis==='x'?e.clientY:e.clientX,seam.lo,seam.hi,fromEnd),true);};
 const up=(e:PointerEvent)=>{
  move(e);cleanup();const completed=progress===1,from=progress,start=performance.now();
  const settle=(now:number)=>{const t=Math.min(1,(now-start)/(completed?190:420));apply(from*(1-ease(t))+(completed?ease(t):0),false);
   if(t<1)raf=requestAnimationFrame(settle);else if(completed)detach();else rollback(base,raf);
  };raf=requestAnimationFrame(settle);
 };
 surfaceUi.set({split:{id:bond.id,progress:0,fromEnd,dragging:true}});stopCurrent=cancel;
 window.addEventListener('pointermove',move,{capture:true,passive:false});window.addEventListener('pointerup',up,true);window.addEventListener('blur',cancel);
 return {complete(){up(new PointerEvent('pointerup',{button:0,clientX:bond.axis==='x'?(seam.first+seam.second)/2:Math.ceil(seam.hi)+2,clientY:bond.axis==='x'?Math.ceil(seam.hi)+2:(seam.first+seam.second)/2}));}};
}
// Undo restores bond metadata with the windows; transient tension never survives it.
kernel.onEvent(e=>{
 if(['undo','reset','close'].includes(e.type))surfaceUi.set({split:null,candidate:null});
 if(e.type==='close'){
  const state=kernel.getState(),windows={...state.windows};let changed=false;
  for(const [id,w] of Object.entries(windows)){const old=surfaceBonds(w),valid=old.filter(b=>windows[b.a]&&windows[b.b]);if(valid.length!==old.length){changed=true;windows[id]={...w,props:{...w.props,surfaceBonds:valid}};}}
  if(changed){const cleaned={...state,windows};for(const [id,w] of Object.entries(windows))if(isSurfaceGroup(w.group)){const component=surfaceComponent(cleaned,id);windows[id]={...w,group:component.length>1?`surface:${component.sort().join(':')}`:undefined};}kernel.previewState({...state,windows});}
 }
});
