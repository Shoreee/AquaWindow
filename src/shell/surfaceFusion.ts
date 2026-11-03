import {kernel,workArea} from '../system/kernel';
import {toast} from '../system/ui';
import {createStore} from '../system/createStore';
import {cancelManualWindowMotion} from '../agent/adaptive/manualMotion';
import {cancelCapsuleMotion} from '../agent/adaptive/capsule';
import {documentContent,documentSeed} from '../apps/content';
import {ease} from '../agent/adaptive/choreography';
import type {KernelState,WindowState} from '../kernel/types';
import {fusionPlacement,isSurfaceGroup,seamGeometry,splitProgress,surfaceBonds,surfaceComponent,type SurfaceBond} from './surfaceBondGeometry';
export const surfaceUi=createStore({candidate:null as {a:string;b:string}|null,split:null as {id:string;progress:number;fromEnd:boolean;dragging:boolean;release?:number}|null,push:null as {x:number;y:number;axis:'x'|'y';progress:number}|null});
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
export function relatedPartner(id:string,nearOnly=false,manual=false){
 const state=kernel.getState(),a=state.windows[id];if(!a||!normal(a))return null;
 let best:{id:string;score:number}|null=null;
 for(const b of Object.values(state.windows)){
  if(b.id===id||!normal(b)||a.group&&a.group===b.group)continue;
  const relevance=manual?1:relatedScore(a,b);if(relevance<.55)continue;
  const dx=Math.max(0,Math.max(a.rect.x-b.rect.x-b.rect.w,b.rect.x-a.rect.x-a.rect.w)),dy=Math.max(0,Math.max(a.rect.y-b.rect.y-b.rect.h,b.rect.y-a.rect.y-a.rect.h));
  const overlapX=Math.min(a.rect.x+a.rect.w,b.rect.x+b.rect.w)-Math.max(a.rect.x,b.rect.x),overlapY=Math.min(a.rect.y+a.rect.h,b.rect.y+b.rect.h)-Math.max(a.rect.y,b.rect.y);
  // Touching edges, not arbitrary overlap or distant window centres.
  const sideGap=Math.min(Math.abs(a.rect.x-b.rect.x-b.rect.w),Math.abs(a.rect.x+a.rect.w-b.rect.x)),verticalGap=Math.min(Math.abs(a.rect.y-b.rect.y-b.rect.h),Math.abs(a.rect.y+a.rect.h-b.rect.y));
  if(nearOnly&&!((sideGap<32&&overlapY>110)||(verticalGap<32&&overlapX>110)))continue;
  const score=relevance*100-Math.hypot(dx,dy)*.12;if(!best||score>best.score)best={id:b.id,score};
 }
 return best?.id??null;
}
export function previewSurfaceFusion(id:string|null,manual=false){
 const b=id?relatedPartner(id,true,manual):null,current=surfaceUi.get().candidate;
 if(current?.a===id&&current?.b===b||!current&&!b)return;
 surfaceUi.set({candidate:id&&b?{a:id,b}:null});
}
/** A deliberate horizontal shake separates the whole manually fused window group. */
export function shakeApart(id:string,continuingGesture=false){
 const base=kernel.getState(),source=base.windows[id];
 if(!source?.group){if(continuingGesture)kernel.endGesture();return false;}
 const members=isSurfaceGroup(source.group)?surfaceComponent(base,id):Object.values(base.windows).filter(w=>w.group===source.group).map(w=>w.id);
 if(members.length<2){if(continuingGesture)kernel.endGesture();return false;}
 if(!continuingGesture)kernel.beginGesture('surface:shake');
 const bond=surfaceBonds(source)[0],first=bond?base.windows[bond.a]:base.windows[members[0]],second=bond?base.windows[bond.b]:base.windows[members[1]];
 const axis=bond?.axis??'x',seam=first&&second?seamGeometry(first.rect,second.rect,axis):null;
 const center=seam?{x:axis==='x'?(seam.first+seam.second)/2:(seam.lo+seam.hi)/2,y:axis==='x'?(seam.lo+seam.hi)/2:(seam.first+seam.second)/2}:{x:source.rect.x+source.rect.w/2,y:source.rect.y+source.rect.h/2};
 const started=performance.now(),duration=560;let raf=0;
 surfaceUi.set({candidate:null,split:null,push:{...center,axis,progress:0}});
 const draw=(now:number)=>{
  const progress=Math.min(1,(now-started)/duration),amount=ease(progress),current=kernel.getState(),windows={...current.windows};
  for(const [index,memberId] of members.entries()){
   const original=base.windows[memberId],live=windows[memberId];if(!original||!live)continue;
   const midpoint=axis==='x'?original.rect.x+original.rect.w/2:original.rect.y+original.rect.h/2;
   const pivot=axis==='x'?center.x:center.y,side=midpoint<pivot?-1:midpoint>pivot?1:index===0?-1:1;
   const shift=side*42*amount;
   const rect={...original.rect,x:original.rect.x+(axis==='x'?shift:0),y:original.rect.y+(axis==='y'?shift:0)};
   windows[memberId]={...live,rect,group:progress===1?undefined:original.group,props:{...live.props,surfaceBonds:progress===1?[]:surfaceBonds(original),surfaceAnimating:progress<1||undefined}};
  }
  kernel.previewState({...current,windows});
  surfaceUi.set({push:progress<1?{...center,axis,progress}:null});
  if(progress<1)raf=requestAnimationFrame(draw);else{stopCurrent=null;kernel.endGesture();toast('已分开',true);}
 };
 stopCurrent=()=>rollback(base,raf,continuingGesture);
 raf=requestAnimationFrame(draw);
 return true;
}
function rollback(base:KernelState,raf:number,continuing=false){const changed=continuing||kernel.getState()!==base;cancelAnimationFrame(raf);stopCurrent=null;surfaceUi.set({split:null,candidate:null,push:null});kernel.endGesture();if(changed)kernel.undo('user');}
export function fuseSurfaces(movingId:string,fixedId:string,continuingGesture=false,setupOnly=false){
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
  if(t<1)raf=requestAnimationFrame(draw);else{stopCurrent=null;kernel.endGesture();toast(setupOnly?'已准备融合窗口':'已融合',true);}
 };
 stopCurrent=()=>rollback(base,raf,continuingGesture);raf=requestAnimationFrame(draw);
}
/** A zipper owns its pointer. Window rectangles stay fixed until the seam is fully open. */
export function beginSurfaceSplit(bond:SurfaceBond,event:PointerEvent){
 if(event.button!==0)return;
 event.preventDefault();event.stopImmediatePropagation();
 const live=kernel.getState(),liveA=live.windows[bond.a],liveB=live.windows[bond.b];
 if(!liveA||!liveB||liveA.props.surfaceAnimating||liveB.props.surfaceAnimating)return;
 const initial=seamGeometry(liveA.rect,liveB.rect,bond.axis),coordinate=bond.axis==='x'?event.clientY:event.clientX;
 const startZone=Math.min(38,initial.length*.18);
 // The middle of a zipper is not a title-bar drag handle.
 if(Math.min(Math.abs(coordinate-initial.lo),Math.abs(coordinate-initial.hi))>startZone)return;
 cancelSurfaceInteraction();cancelManualWindowMotion();cancelCapsuleMotion();
 const base=kernel.getState(),a=base.windows[bond.a],b=base.windows[bond.b];
 if(!a||!b||!surfaceBonds(a).some(item=>item.id===bond.id))return;
 const seam=seamGeometry(a.rect,b.rect,bond.axis);if(seam.length<30)return;
 const fromEnd=coordinate>(seam.lo+seam.hi)/2,carried=surfaceComponent(base,bond.b,bond.id);
 if(carried.includes(bond.a))return;
 kernel.beginGesture('surface:split');
 let progress=0,pending=0,raf=0,settling=false,translated=false;
 const pointerId=event.pointerId;
 const publish=(value:number,dragging:boolean,release=0)=>{progress=value;surfaceUi.set({split:{id:bond.id,progress:value,fromEnd,dragging,release}});};
 const restorePosition=()=>{
  if(!translated)return;
  const state=kernel.getState(),windows={...state.windows};
  for(const id of carried){const original=base.windows[id],w=windows[id];if(original&&w)windows[id]={...w,rect:original.rect,props:{...w.props,surfaceAnimating:undefined}};}
  kernel.previewState({...state,windows});
 };
 const detach=()=>{
  const state=kernel.getState(),windows={...state.windows};
  for(const [id,w] of Object.entries(windows))if(surfaceBonds(w).some(item=>item.id===bond.id))windows[id]={...w,props:{...w.props,surfaceBonds:surfaceBonds(w).filter(item=>item.id!==bond.id)}};
  for(const id of carried)if(windows[id])windows[id]={...windows[id],props:{...windows[id].props,surfaceAnimating:undefined}};
  const separated={...state,windows},oldMembers=Object.values(windows).filter(w=>w.group===a.group);
  for(const w of oldMembers){const component=surfaceComponent(separated,w.id);windows[w.id]={...windows[w.id],group:component.length>1?`surface:${component.slice().sort().join(':')}`:undefined};}
  kernel.previewState({...state,windows});surfaceUi.set({split:null});stopCurrent=null;kernel.endGesture();toast('已分开',true);
 };
 const cleanup=()=>{window.removeEventListener('pointermove',move,true);window.removeEventListener('pointerup',up,true);window.removeEventListener('pointercancel',cancel,true);window.removeEventListener('blur',cancel);};
 const cancel=()=>{cleanup();cancelAnimationFrame(raf);restorePosition();surfaceUi.set({split:null});stopCurrent=null;kernel.endGesture();};
 const position=(e:PointerEvent)=>splitProgress(bond.axis==='x'?e.clientY:e.clientX,seam.lo,seam.hi,fromEnd);
 const move=(e:PointerEvent)=>{
  if(e.pointerId!==pointerId||settling)return;e.preventDefault();e.stopImmediatePropagation();pending=position(e);
  if(!raf)raf=requestAnimationFrame(()=>{raf=0;publish(pending,true);if(pending===1)settle(true);});
 };
 const settle=(completed:boolean)=>{
  cleanup();cancelAnimationFrame(raf);settling=true;const from=progress,start=performance.now(),duration=matchMedia('(prefers-reduced-motion: reduce)').matches?1:completed?220:280;
  const draw=(now:number)=>{
   const t=Math.min(1,(now-start)/duration),blend=ease(t);
   if(completed){
    const state=kernel.getState(),windows={...state.windows};translated=true;
    for(const id of carried){const original=base.windows[id],w=windows[id];if(original&&w)windows[id]={...w,rect:{...original.rect,x:original.rect.x+(bond.axis==='x'?16*blend:0),y:original.rect.y+(bond.axis==='y'?16*blend:0)},props:{...w.props,surfaceAnimating:true}};}
    kernel.previewState({...state,windows});publish(1,false,blend);
   }else publish(from*(1-blend),false);
   if(t<1)raf=requestAnimationFrame(draw);else if(completed)detach();else{surfaceUi.set({split:null});stopCurrent=null;kernel.endGesture();}
  };raf=requestAnimationFrame(draw);
 };
 const up=(e:PointerEvent)=>{if(e.pointerId!==pointerId||settling)return;e.preventDefault();e.stopImmediatePropagation();publish(position(e),true);settle(progress===1);};
 publish(0,true);stopCurrent=cancel;
 window.addEventListener('pointermove',move,{capture:true,passive:false});window.addEventListener('pointerup',up,true);window.addEventListener('pointercancel',cancel,true);window.addEventListener('blur',cancel);
 return {complete(){cancelAnimationFrame(raf);publish(1,true);settle(true);}};
}
// Undo restores bond metadata with the windows; transient tension never survives it.
kernel.onEvent(e=>{
 if(['undo','reset','close'].includes(e.type))surfaceUi.set({split:null,candidate:null,push:null});
 if(e.type==='close'){
  const state=kernel.getState(),windows={...state.windows};let changed=false;
  for(const [id,w] of Object.entries(windows)){const old=surfaceBonds(w),valid=old.filter(b=>windows[b.a]&&windows[b.b]);if(valid.length!==old.length){changed=true;windows[id]={...w,props:{...w.props,surfaceBonds:valid}};}}
  if(changed){const cleaned={...state,windows};for(const [id,w] of Object.entries(windows))if(isSurfaceGroup(w.group)){const component=surfaceComponent(cleaned,id);windows[id]={...w,group:component.length>1?`surface:${component.sort().join(':')}`:undefined};}kernel.previewState({...state,windows});}
 }
});
