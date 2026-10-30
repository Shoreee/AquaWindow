import {createStore} from '../../system/createStore';
import {makeContext} from './context';
import {PlanPerformance} from './choreography';
import {capsuleSnapshot,canPutInCapsule,insertCapsuleState,dockCapsuleState,dockParent} from './capsuleTree';
import type {KernelState,WindowState} from '../../kernel/types';
import type {Rect} from '../../kernel/types';
import type {CapsuleSnapshot} from './types';
import {kernel,workArea} from '../../system/kernel';
import {readingProgress} from '../../apps/content';
import {toast} from '../../system/ui';
import {ease,type AgentMotion} from './choreography';
import {beginMaterial,endMaterial} from './material';

import {restoredCapsuleMember as restored} from './capsuleState';
export {extractCapsuleState} from './capsuleState';
export {capsuleSize,capsuleOverstretch} from './capsuleGeometry';
export function capsuleRectInside(rect:Rect){const W=workArea(),w=Math.max(132,Math.min(W.w,rect.w)),h=Math.max(64,Math.min(W.h,rect.h));return {x:Math.max(W.x,Math.min(W.x+W.w-w,rect.x)),y:Math.max(W.y,Math.min(W.y+W.h-h,rect.y)),w,h};}
const mixRect=(a:Rect,b:Rect,t:number):Rect=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,w:a.w+(b.w-a.w)*t,h:a.h+(b.h-a.h)*t});
export function releaseMotion(from:Rect,to:Rect,amount:number,elapsed:number):AgentMotion{return {primitive:'permeate',edge:'left',transport:{active:false,coverage:0,progress:amount},docked:true,elapsed,travelDuration:.01,progress:amount,action:amount,arrival:1,contactAge:-1,seed:3,index:0,count:1,childCount:1,from,to,direction:[1,0]};}
let animation=0,animating=false,manualCancel:(()=>void)|null=null;
export function capsuleGestureCancel(cancel:(()=>void)|null){manualCancel=cancel;}
const stop=()=>{cancelAnimationFrame(animation);animation=0;animating=false;endMaterial();capsuleDropUi.set({target:null});};
kernel.onEvent(e=>{if(['undo','reset','close'].includes(e.type))stop();});
export function cancelCapsuleMotion(){if(manualCancel){const cancel=manualCancel;manualCancel=null;cancel();return true;}if(!animating)return false;stop();kernel.endGesture();kernel.undo('user');return true;}
export function capsuleMotionActive(){return animating||!!manualCancel;}

/** Every released page grows out of the same membrane and retains its original content/scroll. */
export function restoreCapsule(id:string,continuingGesture=false){
 const initial=kernel.getState(),host=initial.windows[id],snapshot=host?.props.agentCapsule as CapsuleSnapshot|undefined;
 if(!host||!snapshot)return;
 if(animating)stop();
 if(!continuingGesture)kernel.beginGesture('capsule:release');
 animating=true;
 const source=renderedCapsuleRect(id)??host.capsuleRect??host.rect,carrier=`capsule-release:${id}:${Math.round(performance.now())}`,start=performance.now();
 const restoredMembers=snapshot.members.map(member=>restored(member,snapshot));
 beginMaterial([carrier]);
 const duration=.22+Math.max(0,snapshot.members.length-1)*.16+.72;
 const animate=(now:number)=>{
  if(!animating)return;
  const elapsed=(now-start)/1000,windows={...initial.windows};
  delete windows[id];
  const rupture=ease(elapsed/.65);
  windows[carrier]={...host,id:carrier,form:'capsule',minimized:false,capsuleRect:source,props:{...host.props,agentCapsuleBusy:true,agentCapsuleRupture:rupture}};
  for(let index=0;index<snapshot.members.length;index++){
   const normal=restoredMembers[index],member=snapshot.members[index],raw=(elapsed-.18-index*.16)/.72,amount=ease(raw),target=capsuleRectInside(normal.form==='capsule'?(normal.capsuleRect??normal.rect):member.rect);
   const pose=mixRect(source,target,ease(raw));
   pose.x+=Math.sin(Math.PI*amount)*(index%2?1:-1)*34;
   windows[member.id]={...normal,...(normal.form==='capsule'?{capsuleRect:pose}:{rect:pose}),minimized:raw<0,props:{...normal.props,agentRelease:{amount},agentMotion:releaseMotion(source,target,amount,Math.max(0,elapsed-.18-index*.16))}};
  }
  const finished=elapsed>=duration;
  if(finished){delete windows[carrier];for(const member of restoredMembers){windows[member.id]=member;readingProgress.set(member.id,snapshot.scroll[member.id]??0);}}
  const order=[...snapshot.order.filter(key=>windows[key]),...initial.order.filter(key=>windows[key]&&!snapshot.order.includes(key)),...(!finished?[carrier]:[])];
  kernel.previewState({...initial,windows,order,focusedId:finished?(windows[snapshot.focusedId??'']?snapshot.focusedId:snapshot.members[0]?.id??null):carrier});
  if(finished){stop();kernel.endGesture();toast('已依次释放窗口',true);}else animation=requestAnimationFrame(animate);
 };
 animation=requestAnimationFrame(animate);
}

export function settleExtraction(id:string,target:Rect){
 const state=kernel.getState(),member=state.windows[id];if(!member){kernel.endGesture();endMaterial();return;}
 const from=member.form==='capsule'?(member.capsuleRect??member.rect):member.rect,initialAmount=(member.props.agentRelease as {amount:number}|undefined)?.amount??1,start=performance.now();
 animating=true;
 const frame=(now:number)=>{
  if(!animating)return;
  const t=ease((now-start)/220),amount=initialAmount+(1-initialAmount)*t,current=kernel.getState(),live=current.windows[id];
  if(!live){stop();kernel.endGesture();return;}
  const props={...live.props,agentRelease:{amount},agentMotion:releaseMotion(from,target,amount,(now-start)/1000)};
  if(t>=1){delete (props as Record<string,unknown>).agentRelease;delete (props as Record<string,unknown>).agentMotion;delete (props as Record<string,unknown>).agentCapsuleBusy;}
  kernel.previewState({...current,windows:{...current.windows,[id]:{...live,...(live.form==='capsule'?{capsuleRect:mixRect(from,target,t)}:{rect:mixRect(from,target,t)}),props}}});
  if(t>=1){stop();kernel.endGesture();toast('已从胶囊拖出页面',true);}else animation=requestAnimationFrame(frame);
 };animation=requestAnimationFrame(frame);
}


export type CapsuleDrop={id:string;kind:'capsule'|'titlebar'};
export const capsuleDropUi=createStore({target:null as CapsuleDrop|null});
export function renderedCapsuleRect(id:string):Rect|null{
 const element=document.querySelector<HTMLElement>(`[data-capsule-id="${CSS.escape(id)}"]`)??document.querySelector<HTMLElement>(`[data-win="${CSS.escape(id)}"]`);
 const r=element?.getBoundingClientRect();return r?{x:r.x,y:r.y,w:r.width,h:r.height}:null;
}
export function findCapsuleDrop(sourceIds:string[],x:number,y:number):CapsuleDrop|null{
 const state=kernel.getState();
 for(const el of document.elementsFromPoint(x,y)){
  const chip=el.closest<HTMLElement>('[data-capsule-id]'),windowEl=el.closest<HTMLElement>('[data-win]'),id=chip?.dataset.capsuleId??windowEl?.dataset.win;
  if(!id||sourceIds.includes(id))continue;const target=state.windows[id];if(!target)continue;
  if(capsuleSnapshot(target)&&sourceIds.every(source=>canPutInCapsule(state,source,id)))return {id,kind:'capsule'};
  if(sourceIds.length===1&&capsuleSnapshot(state.windows[sourceIds[0]])&&target.form==='normal'&&el.closest('.aw-title')&&dockCapsuleState(state,sourceIds[0],id))return {id,kind:'titlebar'};
 }
 return null;
}
export function previewCapsuleDrop(sourceIds:string[],x?:number,y?:number){
 const target=x===undefined||y===undefined?null:findCapsuleDrop(sourceIds,x,y),old=capsuleDropUi.get().target;
 if(old?.id!==target?.id||old?.kind!==target?.kind)capsuleDropUi.set({target});return target;
}
function sourceRect(w:WindowState){return w.form==='capsule'?renderedCapsuleRect(w.id)??w.capsuleRect??w.rect:w.rect;}
/** Manual and Space-triggered collection use the identical choreography and SessionCapsule UI. */
export function packWindows(ids:string[],continuing=false,restoreBase?:KernelState){
 if(!continuing)cancelCapsuleMotion();const initial=kernel.getState(),base=restoreBase??initial;
 ids=ids.filter(id=>initial.windows[id]?.form==='normal'&&!initial.windows[id]?.minimized);if(!ids.length){if(continuing)kernel.endGesture();return;}
 if(!continuing)kernel.beginGesture('capsule:collect');
 const context=makeContext(base,workArea(),ids,[],{accepted:[],rejected:[]});
 const plan={id:`manual-capsule:${Math.round(performance.now())}`,title:'会话胶囊',rationale:'收纳当前工作面',priority:1,confidence:1,primaryTargets:ids,supportTargets:[],steps:[{type:'encapsulate' as const,targets:ids,edge:'right' as const}],artifacts:[]};
 const timeline=new PlanPerformance(base,plan,context,initial),start=performanceNow();animating=true;beginMaterial(ids);
 const frame=(now:number)=>{if(!animating)return;const result=timeline.at((now-start)/1000),collected=ids.every(id=>result.state.windows[id]?.form==='capsule'||result.state.windows[id]?.minimized);kernel.previewState(collected?timeline.final:result.state);
  if(result.done||collected){stop();kernel.endGesture();toast('已收为胶囊 · 可继续拖入窗口或停靠标题栏',true);}else animation=requestAnimationFrame(frame);
 };animation=requestAnimationFrame(frame);
}
const performanceNow=()=>globalThis.performance.now();
export function putIntoCapsule(sourceIds:string[],targetId:string,continuing=false){
 if(!continuing)cancelCapsuleMotion();const initial=kernel.getState(),final=insertCapsuleState(initial,sourceIds,targetId),target=initial.windows[targetId];if(!final||!target){if(continuing)kernel.endGesture();return false;}
 const contents=capsuleSnapshot(final.windows[targetId])!;final.windows[targetId]={...final.windows[targetId],props:{...final.windows[targetId].props,agentCapsule:{...contents,scroll:{...contents.scroll,...Object.fromEntries(sourceIds.map(id=>[id,readingProgress.get(id)??0]))}}}};
 if(!continuing)kernel.beginGesture('capsule:insert');const start=performanceNow(),targetRect=renderedCapsuleRect(targetId)??target.capsuleRect??target.rect,oldCount=capsuleSnapshot(target)!.members.length;
 const sources=sourceIds.map(id=>({w:initial.windows[id],from:sourceRect(initial.windows[id])})),goal=final.windows[targetId].capsuleRect!;animating=true;capsuleDropUi.set({target:null});beginMaterial(sourceIds);
 const frame=(now:number)=>{if(!animating)return;const t=Math.min(1,(now-start)/650),k=ease(t),windows={...initial.windows};
  windows[targetId]={...final.windows[targetId],capsuleRect:dockParent(target)?target.capsuleRect:mixRect(targetRect,goal,ease((t-.35)/.65)),props:{...final.windows[targetId].props,agentCapsuleReceiving:true,agentQueue:{fill:oldCount+sourceIds.length*ease((t-.55)/.45),mergedCount:oldCount,incoming:Math.sin(Math.PI*k)}}};
  sources.forEach(({w,from},i)=>{const to={x:targetRect.x+targetRect.w*.55,y:targetRect.y+targetRect.h*.35,w:Math.min(75,targetRect.w/sourceIds.length),h:Math.min(42,targetRect.h*.6)},rect=mixRect(from,to,k);rect.y-=Math.sin(Math.PI*k)*(26+i*8);
   windows[w.id]={...w,...(w.form==='capsule'?{capsuleRect:rect}:{rect}),props:{...w.props,capsuleDock:undefined,agentCapsuleBusy:true,agentRelease:{amount:1-ease((t-.65)/.35)},agentMotion:releaseMotion(from,to,k,(now-start)/1000),...(w.form==='normal'?{agentQueue:{amount:k,travel:k,index:1,waiting:false,mergedCount:oldCount,incoming:0}}:{})}};
  });
  if(t>=1){kernel.previewState(final);stop();kernel.endGesture();toast('已融入胶囊',true);}else{kernel.previewState({...initial,windows});animation=requestAnimationFrame(frame);}
 };animation=requestAnimationFrame(frame);return true;
}
export function dockCapsule(id:string,parentId:string,continuing=false){
 if(!continuing)cancelCapsuleMotion();const initial=kernel.getState(),final=dockCapsuleState(initial,id,parentId),host=initial.windows[id],parent=initial.windows[parentId];if(!final||!host||!parent){if(continuing)kernel.endGesture();return false;}
 if(!continuing)kernel.beginGesture('capsule:dock');const start=performanceNow(),from=sourceRect(host),siblings=Object.values(initial.windows).filter(w=>dockParent(w)===parentId).length;
 const to={x:parent.rect.x+parent.rect.w-90-Math.min(3,siblings)*82,y:parent.rect.y+9,w:78,h:24};animating=true;capsuleDropUi.set({target:null});beginMaterial([id]);
 const frame=(now:number)=>{if(!animating)return;const t=Math.min(1,(now-start)/520),rect=mixRect(from,to,ease(t));
  if(t>=1){kernel.previewState(final);stop();kernel.endGesture();toast('已停靠标题栏 · 拖动胶囊可取下，双击释放',true);}else{kernel.previewState({...initial,windows:{...initial.windows,[id]:{...host,capsuleRect:rect,props:{...host.props,capsuleDock:undefined,agentCapsuleBusy:true}}}});animation=requestAnimationFrame(frame);}
 };animation=requestAnimationFrame(frame);return true;
}
export function finishCapsuleDrop(sourceIds:string[],target:CapsuleDrop|null,continuing=true){
 capsuleDropUi.set({target:null});if(!target)return false;return target.kind==='capsule'?putIntoCapsule(sourceIds,target.id,continuing):dockCapsule(sourceIds[0],target.id,continuing);
}
/** Drag an attachment back out of the title bar without losing its nested contents. */
export function beginUndock(id:string,event:PointerEvent){
 event.preventDefault();event.stopPropagation();cancelCapsuleMotion();const initial=kernel.getState(),host=initial.windows[id];if(!host||!dockParent(host))return;
 const from=sourceRect(host),sx=event.clientX,sy=event.clientY,start=performanceNow();let moved=false,x=sx,y=sy,raf=0;
 const apply=()=>{raf=0;if(!moved)return;const t=ease((performanceNow()-start)/260),natural={w:Math.max(166,host.capsuleRect?.w??166),h:Math.max(80,host.capsuleRect?.h??80)},to={x:x-natural.w*.5,y:y-20,...natural},rect=mixRect({...from,x:from.x+x-sx,y:from.y+y-sy},to,t),state=kernel.getState();
  kernel.previewState({...state,windows:{...state.windows,[id]:{...state.windows[id],capsuleRect:rect,props:{...host.props,capsuleDock:undefined,agentCapsuleBusy:true}}}});previewCapsuleDrop([id],x,y);if(t<1)raf=requestAnimationFrame(apply);
 };
 const cleanup=()=>{window.removeEventListener('pointermove',move,true);window.removeEventListener('pointerup',up,true);cancelAnimationFrame(raf);capsuleGestureCancel(null);};
 const move=(e:PointerEvent)=>{x=e.clientX;y=e.clientY;if(!moved&&Math.hypot(x-sx,y-sy)>4){moved=true;kernel.beginGesture('capsule:undock');beginMaterial([id]);}if(moved&&!raf)raf=requestAnimationFrame(apply);};
 const up=()=>{cleanup();if(!moved)return;const target=previewCapsuleDrop([id],x,y);if(!finishCapsuleDrop([id],target,true)){const natural={w:Math.max(166,host.capsuleRect?.w??166),h:Math.max(80,host.capsuleRect?.h??80)};settleExtraction(id,capsuleRectInside({x:x-natural.w*.5,y:y-20,...natural}));}};
 capsuleGestureCancel(()=>{cleanup();if(moved){kernel.endGesture();kernel.undo('user');}endMaterial();capsuleDropUi.set({target:null});});window.addEventListener('pointermove',move,true);window.addEventListener('pointerup',up,true);
}
