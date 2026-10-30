import {DockedCapsules} from './DockedCapsules';
import {capsuleSnapshot} from '../agent/adaptive/capsuleTree';
import {useStore} from '../system/createStore';
import {cancelManualWindowMotion} from "../agent/adaptive/manualMotion";
import {useRef,useState,type PointerEvent as ReactPointerEvent} from 'react';
import type {Rect} from '../kernel/types';
import type {CapsuleSnapshot} from '../agent/adaptive/types';
import {kernel} from '../system/kernel';
import {AppSurface} from './AppSurface';
import {capsuleMotionActive,capsuleDropUi,previewCapsuleDrop,finishCapsuleDrop,capsuleGestureCancel,capsuleOverstretch,capsuleRectInside,extractCapsuleState,releaseMotion,restoreCapsule,settleExtraction} from '../agent/adaptive/capsule';
import {beginMaterial,endMaterial} from '../agent/adaptive/material';
import {ease} from '../agent/adaptive/choreography';

export function SessionCapsule({id,snapshot,mergedCount,incoming=0}:{id:string;snapshot:CapsuleSnapshot;mergedCount?:number;incoming?:number}){
 const [hover,setHover]=useState<string|null>(null),[dragging,setDragging]=useState(false);
 const root=useRef<HTMLDivElement>(null),win=kernel.get(id);
 const accepting=useStore(capsuleDropUi,s=>s.target?.id===id&&s.target.kind==='capsule');
 const rupture=win?.props.agentCapsuleRupture as number|undefined;
 const collecting=(win?.props.agentMotion as {primitive?:string}|undefined)?.primitive==='encapsulate'&&capsuleMotionActive();
 const busy=dragging||collecting||!!win?.props.agentCapsuleBusy||rupture!==undefined;
 const locked=busy||!!win?.props.agentCapsuleReceiving;
 const filling=(win?.props.agentQueue as {fill:number}|undefined)?.fill??(mergedCount??snapshot.members.length)+incoming;
 const shown=mergedCount===undefined?snapshot.members.length:Math.min(snapshot.members.length,Math.max(1,Math.ceil(filling-.0001)));
 const hovered=snapshot.members.find(member=>member.id===hover);
 const manipulate=(event:ReactPointerEvent,edge?:string)=>{
  if(event.button!==0||rupture!==undefined||win?.props.agentCapsuleReceiving||win?.props.agentCapsuleBusy||collecting)return;
  if(!edge&&(event.target as HTMLElement).closest('.capsule-action,.capsule-rz'))return;
  event.preventDefault();event.stopPropagation();cancelManualWindowMotion();
  const host=kernel.get(id);if(!host?.capsuleRect)return;
  const box=root.current?.parentElement?.getBoundingClientRect();
  const from=box?{x:box.left,y:box.top,w:box.width,h:box.height}:{...host.capsuleRect};
  const sx=event.clientX,sy=event.clientY,memberId=event.altKey?(event.target as HTMLElement).closest<HTMLElement>('[data-capsule-page]')?.dataset.capsulePage:undefined;
  const hit=memberId?(event.target as HTMLElement).closest<HTMLElement>('[data-capsule-page]')?.getBoundingClientRect():undefined;
  const pageOrigin=hit?{x:hit.left,y:hit.top,w:hit.width,h:hit.height}:undefined;
  let x=sx,y=sy,moved=false,bursting=false,raf=0,carrier:string|undefined=id,extracted:ReturnType<typeof extractCapsuleState>=null,started=0;
  const setBusy=(key:string|undefined,value:boolean)=>{if(key&&kernel.get(key))kernel.setProps(key,{agentCapsuleBusy:value});};
  const apply=()=>{
   raf=0;if(!moved)return;
   const dx=x-sx,dy=y-sy;
   if(memberId){
    if(!extracted){extracted=extractCapsuleState(kernel.getState(),id,memberId);if(!extracted)return;carrier=extracted.carrierId;started=performance.now();kernel.previewState(extracted.state);setBusy(carrier,true);}
    const current=kernel.getState(),member=current.windows[memberId];if(!member||!extracted)return;
    const amount=ease((performance.now()-started)/420),target=capsuleRectInside({...((extracted.member.form==='capsule'?extracted.member.capsuleRect:undefined)??extracted.member.rect),x:x-75,y:y-24});
    const source=pageOrigin??{...extracted.source,w:Math.min(120,extracted.source.w),h:extracted.source.h};
    const rect={x:source.x+(target.x-source.x)*amount,y:source.y+(target.y-source.y)*amount,w:source.w+(target.w-source.w)*amount,h:source.h+(target.h-source.h)*amount};
    kernel.previewState({...current,windows:{...current.windows,[memberId]:{...member,...(member.form==='capsule'?{capsuleRect:rect}:{rect}),props:{...member.props,agentCapsuleBusy:member.form==='capsule'?true:undefined,agentRelease:{amount},agentMotion:releaseMotion(source,target,amount,(performance.now()-started)/1000)}}}});
    if(amount<1)raf=requestAnimationFrame(apply);
   }else{
    const rect:Rect={...from};
    if(edge){
      if(edge.includes('e'))rect.w+=dx;
      if(edge.includes('s'))rect.h+=dy;
      if(edge.includes('w')){rect.x+=dx;rect.w-=dx;}
      if(edge.includes('n')){rect.y+=dy;rect.h-=dy;}
    }else{rect.x+=dx;rect.y+=dy;}
    const next=capsuleRectInside(rect);kernel.setCapsuleRect(id,next);if(!edge)previewCapsuleDrop([id],x,y);
    if(edge&&!bursting&&capsuleOverstretch(next,snapshot.members.length)>=1){
      bursting=true;capsuleGestureCancel(null);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',finish);window.removeEventListener('blur',finish);cancelAnimationFrame(raf);setBusy(carrier,false);setDragging(false);restoreCapsule(id,true);
    }
   }
  };
  const move=(e:PointerEvent)=>{
   x=e.clientX;y=e.clientY;
   if(!moved&&Math.hypot(x-sx,y-sy)>3){moved=true;kernel.beginGesture(memberId?'capsule:extract':edge?'capsule:resize':'capsule:move');setBusy(id,true);setDragging(true);setHover(null);beginMaterial([id]);capsuleGestureCancel(()=>{
      capsuleGestureCancel(null);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',finish);window.removeEventListener('blur',finish);cancelAnimationFrame(raf);setDragging(false);kernel.endGesture();kernel.undo('user');endMaterial();
    });}
   if(moved&&!raf)raf=requestAnimationFrame(apply);
  };
  const finish=()=>{
   if(bursting)return;
   capsuleGestureCancel(null);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',finish);window.removeEventListener('blur',finish);cancelAnimationFrame(raf);
   if(moved){
    if(memberId&&extracted){
      setBusy(carrier,false);setDragging(false);
      settleExtraction(memberId,capsuleRectInside({...((extracted.member.form==='capsule'?extracted.member.capsuleRect:undefined)??extracted.member.rect),x:x-75,y:y-24}));return;
    }else apply();
    if(bursting)return;
    setBusy(carrier,false);setDragging(false);
    const current=kernel.get(id),rect=current?.capsuleRect;
    if(edge&&rect&&capsuleOverstretch(rect,snapshot.members.length)>=1){restoreCapsule(id,true);return;}
    if(!edge&&finishCapsuleDrop([id],capsuleDropUi.get().target,true))return;
    previewCapsuleDrop([]);kernel.endGesture();endMaterial();
   }else kernel.focus(id);
  };
  window.addEventListener('pointermove',move);window.addEventListener('pointerup',finish);window.addEventListener('blur',finish);
 };
 const size=win?.capsuleRect,stretch=size?capsuleOverstretch(size,snapshot.members.length):0;
 return <div ref={root} className={`session-capsule ${accepting?'capsule-accepting':''} ${win?.props.agentCapsuleReceiving?'capsule-receiving':''} ${busy?'capsule-busy':''} ${hovered&&!busy?'capsule-hovering':''} ${rupture!==undefined?'capsule-rupturing':''}`}
  style={{borderRadius:`${27+incoming*8}px ${31-incoming*8}px ${27+incoming*7}px ${30-incoming*7}px`,opacity:rupture===undefined?1:1-rupture,['--capsule-stretch' as string]:Math.max(0,(stretch-.65)/.35)}}
  role="group" aria-label={`会话胶囊：${snapshot.members.length} 个页面`} tabIndex={0}
  onPointerDown={e=>manipulate(e)} onDoubleClick={()=>{if(!locked)restoreCapsule(id);}} onPointerLeave={()=>setHover(null)}
  onKeyDown={e=>{if(e.key==='Enter'&&!locked){e.preventDefault();restoreCapsule(id);}}}
  title="拖动移动 · 拖边缩放 · Option 拖出单个页面 · 拉大释放全部">
   <div className="capsule-glass">
    <div className="capsule-inner-tide"/>
    {!busy&&<div className="capsule-pages" style={{gridTemplateColumns:`repeat(${shown},1fr)`}} role="tablist">
     {snapshot.members.slice(0,shown).map((member,index)=><div key={member.id} className="capsule-page" data-capsule-page={member.id} role="tab" aria-selected={hover===member.id} aria-label={member.title} tabIndex={0}
      onPointerEnter={()=>setHover(member.id)} onFocus={()=>setHover(member.id)} onBlur={()=>setHover(null)} style={{opacity:mergedCount===undefined||index<mergedCount?1:Math.min(1,Math.max(.15,filling-index))}}>
       <div className="capsule-page-view" aria-hidden="true" inert>{capsuleSnapshot(member)?<div className="nested-capsule-preview"><i className="capsule-inner-tide"/><b>◉</b><span>{capsuleSnapshot(member)!.members.length} 项胶囊</span></div>:<AppSurface win={member} peripheral={false}/>} </div>
       <span className="capsule-page-dot"/>
     </div>)}
    </div>}
    <div className="capsule-memory-light"/>
    {hovered&&!busy&&<div className="capsule-page-title">{hovered.title}{capsuleSnapshot(hovered)?` · ${capsuleSnapshot(hovered)!.members.length} 项胶囊`:''}</div>}
    <small className="capsule-count">{accepting?'松开收纳':busy?'流动中':`${mergedCount===undefined?snapshot.members.length:mergedCount} / ${snapshot.members.length}`}</small>
    {busy&&stretch>.75&&rupture===undefined&&<span className="capsule-break-hint">继续拉大，释放全部</span>}
   </div>
   <DockedCapsules parentId={id}/>
   {!locked&&<button className="capsule-action" aria-label="释放胶囊中的全部窗口" onPointerDown={e=>e.stopPropagation()} onClick={()=>restoreCapsule(id)}>↗</button>}
   {['n','s','e','w','ne','nw','se','sw'].map(edge=><div key={edge} className={`capsule-rz rz rz-${edge}`} onPointerDown={e=>manipulate(e,edge)} aria-label={`缩放胶囊 ${edge}`}/>)}
 </div>;
}
