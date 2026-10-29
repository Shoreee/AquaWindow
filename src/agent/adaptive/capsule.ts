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
const stop=()=>{cancelAnimationFrame(animation);animation=0;animating=false;endMaterial();};
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
 const source=host.capsuleRect??host.rect,carrier=`capsule-release:${id}:${Math.round(performance.now())}`,start=performance.now();
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
   const member=snapshot.members[index],raw=(elapsed-.18-index*.16)/.72,amount=ease(raw),target=capsuleRectInside(member.rect);
   const pose=mixRect(source,target,ease(raw));
   pose.x+=Math.sin(Math.PI*amount)*(index%2?1:-1)*34;
   const normal=restoredMembers[index];
   windows[member.id]={...normal,rect:pose,minimized:raw<0,props:{...normal.props,agentRelease:{amount},agentMotion:releaseMotion(source,target,amount,Math.max(0,elapsed-.18-index*.16))}};
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
 const from=member.rect,initialAmount=(member.props.agentRelease as {amount:number}|undefined)?.amount??1,start=performance.now();
 animating=true;
 const frame=(now:number)=>{
  if(!animating)return;
  const t=ease((now-start)/220),amount=initialAmount+(1-initialAmount)*t,current=kernel.getState(),live=current.windows[id];
  if(!live){stop();kernel.endGesture();return;}
  const props={...live.props,agentRelease:{amount},agentMotion:releaseMotion(from,target,amount,(now-start)/1000)};
  if(t>=1){delete (props as Record<string,unknown>).agentRelease;delete (props as Record<string,unknown>).agentMotion;}
  kernel.previewState({...current,windows:{...current.windows,[id]:{...live,rect:mixRect(from,target,t),props}}});
  if(t>=1){stop();kernel.endGesture();toast('已从胶囊拖出页面',true);}else animation=requestAnimationFrame(frame);
 };animation=requestAnimationFrame(frame);
}
