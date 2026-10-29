import {kernel} from '../../system/kernel';
import {beginMaterial,endMaterial} from './material';
import {boundaryChange} from './boundaryMotion';
import type {AgentMotion} from './choreography';
import type {Rect} from '../../kernel/types';
let cancelCurrent:(()=>void)|null=null;
export function manualWindowMotionActive(){return !!cancelCurrent;}
export function cancelManualWindowMotion(){if(!cancelCurrent)return false;cancelCurrent();return true;}
/** Native gestures and agent plans write the same motion contract, without rerendering documents. */
export function beginWindowMotion(ids:string[],intent:'move'|'resize',point?:{x:number;y:number}){
 cancelCurrent?.();
 const starts=new Map(ids.map(id=>[id,{...kernel.get(id)!.rect}]));let started=performance.now();
 let raf=0,ending=0,releaseAt=0,stopped=false,activated=false,lastAt=started,activity=0,coverage=0;
 const origins=new Map<string,[number,number]>();
 if(point)for(const id of ids){const box=document.querySelector<HTMLElement>(`[data-win="${CSS.escape(id)}"]`)?.getBoundingClientRect();if(box)origins.set(id,[Math.max(0,Math.min(1,(point.x-box.x)/box.width)),Math.max(0,Math.min(1,(point.y-box.y)/box.height))]);}
 const previous=new Map<string,Rect>(starts),targets=new Map<string,Rect>(starts);
 const clear=()=>{if(stopped)return;stopped=true;cancelAnimationFrame(raf);
  if(activated)for(const id of ids){const w=kernel.get(id);if(w)kernel.setProps(id,{agentMotion:undefined});}
  if(activated)endMaterial();cancelCurrent=null;
 };

 const draw=(now:number)=>{
  if(stopped)return;const dt=Math.min(.05,(now-lastAt)/1000);lastAt=now;
  const fade=releaseAt?Math.max(0,1-(now-releaseAt)/190):1;
  let moving=false,settled=true;
  const state=kernel.getState(),windows={...state.windows};
  for(const id of ids){const w=windows[id],from=starts.get(id);if(!w||!from)continue;
   const desired=targets.get(id)!,classification=boundaryChange(from,desired),carried=intent==='move'||classification.kind==='move';
   const blend=ending&&fade<=0?1:carried?(1-Math.exp(-dt*26))*Math.max(0,Math.min(1,(coverage-.94)/.06)):1;
   const to={x:w.rect.x+(desired.x-w.rect.x)*blend,y:w.rect.y+(desired.y-w.rect.y)*blend,w:w.rect.w+(desired.w-w.rect.w)*blend,h:w.rect.h+(desired.h-w.rect.h)*blend};
   if(Math.hypot(desired.x-to.x,desired.y-to.y,desired.w-to.w,desired.h-to.h)>1)settled=false;
   const old=previous.get(id)!,delta=Math.hypot(to.x-old.x,to.y-old.y,to.w-old.w,to.h-old.h);previous.set(id,{...to});
   if(delta>.05)moving=true;
   const boundary=boundaryChange(from,to),carry=intent==='move'||boundary.kind==='move';
   const dx=to.x+to.w/2-from.x-from.w/2,dy=to.y+to.h/2-from.y-from.h/2,len=Math.max(1,Math.hypot(dx,dy));
   const edge=boundary.edges.filter(e=>e!=='top')[0]??boundary.edges[0]??'right';
   const motion:AgentMotion={primitive:carry?'arrange':'yield',boundary,interaction:{strength:activity*fade},edge,
    transport:{active:carry,origin:origins.get(id),coverage:coverage*fade,progress:carry?(releaseAt?1:.5):0},docked:false,elapsed:(now-started)/1000,travelDuration:.35,progress:.5,action:.5,arrival:Math.min(1,(now-started)/350),contactAge:(now-started)/1000-.35,seed:started*.001,index:ids.indexOf(id),count:ids.length,childCount:1,from,to:{...to},direction:[dx/len,dy/len]};
   windows[id]={...w,rect:to,props:{...w.props,agentMotion:motion}};
  }
  kernel.previewState({...state,windows});
  activity+=( (moving?1:.7)-activity)*(1-Math.exp(-dt*16));
  const age=(now-started)/1000;coverage+=(Math.min(1,age/.48)-coverage)*(1-Math.exp(-dt*25));
  if(ending&&!releaseAt&&settled&&coverage>.98)releaseAt=now;
  if(releaseAt&&fade<=0){clear();kernel.endGesture();return;}
  raf=requestAnimationFrame(draw);
 };
 cancelCurrent=()=>{clear();kernel.endGesture();};
 return {update(id:string,rect:Rect){if(stopped)return;targets.set(id,{...rect});
 if(!activated){const from=starts.get(id)!;if(Math.hypot(rect.x-from.x,rect.y-from.y,rect.w-from.w,rect.h-from.h)<1)return;activated=true;started=lastAt=performance.now();beginMaterial(ids);raf=requestAnimationFrame(draw);}
 },get stopped(){return stopped;},finish(){if(!activated){clear();kernel.endGesture();}else if(!stopped&&!ending)ending=performance.now();},cancel(){clear();kernel.endGesture();}};
}

/** Maximise/restore uses the same carrier instead of jumping to its new rectangle. */
export function maximizeWithMotion(id:string,bounds:Rect,point?:{x:number;y:number}){
 cancelManualWindowMotion();const state=kernel.getState(),w=state.windows[id];if(!w)return;
 const target=w.maximized&&w.restoreRect?w.restoreRect:bounds;
 kernel.beginGesture('maximize');
 kernel.previewState({...state,windows:{...state.windows,[id]:{...w,maximized:!w.maximized,restoreRect:w.maximized?undefined:w.rect}}});
 const gesture=beginWindowMotion([id],'move',point);gesture.update(id,target);
 window.setTimeout(()=>gesture.finish(),520);
}
