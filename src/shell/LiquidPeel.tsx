import {useLayoutEffect,useRef,type RefObject} from 'react';
import {LivingRim} from './LivingRim';
import {kernel} from '../system/kernel';
import {log} from '../study/logger';
import {pointer,adaptation} from '../agent/adaptive/runtime';
import {peelGeometry,polyCss,liquidFlapPath} from '../techniques/peel';
import {cornerIntent,cornerMetrics,type Corner} from './cornerIntent';

type Pin={right:boolean;bottom:boolean;x:number;y:number};
/** Corner proximity is the affordance. Only the native outer border resizes. */
export function LiquidPeel({id,width,height,body,enabled,baseClip}:{id:string;width:number;height:number;body:RefObject<HTMLDivElement|null>;enabled:boolean;baseClip?:string}){
 const svg=useRef<SVGSVGElement>(null),edge=useRef<SVGGElement>(null),sheet=useRef<SVGPathElement>(null),foldEdge=useRef<SVGPathElement>(null),pin=useRef<Pin|null>(null);
 const clipRef=useRef(baseClip);clipRef.current=baseClip;
 useLayoutEffect(()=>{
  const surface=body.current,host=surface?.closest<HTMLElement>('[data-win]');
  if(!surface||!host||!enabled){pin.current=null;return;}
  let controlled=false,lastControlled='';
  let frame=0,active=false,held=false,pinned=false,hover=false,last=0,clock=0,pointerId=-1;
  let corner:Corner=[width,height],point:Corner=[width,height],target:Corner=[width,height],velocity:Corner=[0,0];
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  const local=(x:number,y:number):Corner=>{const bounds=surface.getBoundingClientRect();return [(x-bounds.left)*width/bounds.width,(y-bounds.top)*height/bounds.height];};
  const reset=(clearPin=true)=>{
   cancelAnimationFrame(frame);frame=0;active=held=pinned=hover=false;
   if(clearPin)pin.current=null;
   surface.style.clipPath=clipRef.current??'';surface.classList.remove('liquid-peeling');host.classList.remove('peeling','peel-preview','peel-dragging');
   if(svg.current)svg.current.style.visibility='hidden';
  };
  const draw=(now:number)=>{
   if(!active)return;const dt=Math.min(.04,(now-last)/1000||1/60);last=now;
   if(document.hidden){frame=requestAnimationFrame(draw);return;}clock+=dt;
   for(let axis=0;axis<2;axis++){
    if(held||pinned||hover){point[axis]+=(target[axis]-point[axis])*(reduce.matches?1:1-Math.exp(-dt*65));velocity[axis]=0;}
    else{velocity[axis]+=((corner[axis]-point[axis])*210-velocity[axis]*25)*dt;point[axis]+=velocity[axis]*dt;}
   }
   const distance=Math.hypot(point[0]-corner[0],point[1]-corner[1]);
   if(!held&&!pinned&&!hover&&distance<.35&&Math.hypot(...velocity)<4){reset();return;}
   const geometry=peelGeometry(width,height,corner,point);
   if(geometry){
    surface.style.clipPath=polyCss(geometry.visible);
    const amplitude=reduce.matches?0:Math.min(1.4,distance*.025),path=liquidFlapPath(geometry.flap,geometry.fold,clock,amplitude);
    sheet.current?.setAttribute('d',path);edge.current?.querySelectorAll('path').forEach(node=>node.setAttribute('d',path));
    if(geometry.fold){const [a,b]=geometry.fold,mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2,wave=reduce.matches?0:Math.sin(clock*3.2)*Math.min(.4,distance*.012);foldEdge.current?.setAttribute('d',`M${a} Q${mx+wave} ${my-wave} ${b}`);}
    if(svg.current)svg.current.style.visibility='visible';
   }else{surface.style.clipPath=clipRef.current??'';if(svg.current)svg.current.style.visibility='hidden';}
   frame=requestAnimationFrame(draw);
  };
  const wake=()=>{if(active)return;active=true;last=performance.now();surface.classList.add('liquid-peeling');frame=requestAnimationFrame(draw);};
  const release=()=>{held=pinned=hover=false;pin.current=null;host.classList.remove('peel-dragging','peel-preview');if(reduce.matches)reset();};
  const preview=(event:PointerEvent)=>{
   if(held||pinned)return;
   if(event.buttons||event.pointerType==='touch'||host.classList.contains('active')||host.dataset.agentMotion||!(event.target instanceof Element)||event.target.closest('button,input,textarea,select,a,.rz')){if(hover)release();return;}
   const p=local(event.clientX,event.clientY),intent=cornerIntent(p[0],p[1],width,height);
   if(intent.kind!=='peel'){if(hover)release();return;}
   const next=intent.corner,changed=next[0]!==corner[0]||next[1]!==corner[1];
   if(changed){reset();corner=next;point=[...next];}
   const dx=p[0]-corner[0],dy=p[1]-corner[1],distance=Math.hypot(dx,dy),pull=Math.min(cornerMetrics(width,height).preview,distance*.4);
   target=[corner[0]+dx/Math.max(1,distance)*pull,corner[1]+dy/Math.max(1,distance)*pull];
   hover=true;pointer.kind='arrow';host.classList.add('peel-preview');wake();
  };
  const begin=(event:PointerEvent)=>{
   if(event.button!==0||held||!(event.target instanceof Element))return;
   if(pinned&&event.target.closest('.liquid-peel')){event.preventDefault();event.stopImmediatePropagation();release();return;}
   if(event.target.closest('button,input,textarea,select,a,.rz'))return;
   const p=local(event.clientX,event.clientY),intent=cornerIntent(p[0],p[1],width,height);
   const altCorner=event.altKey?([[0,0],[width,0],[width,height],[0,height]] as Corner[]).find(c=>Math.hypot(c[0]-p[0],c[1]-p[1])<70):null;
   if(intent.kind!=='peel'&&!altCorner)return;
   event.preventDefault();event.stopImmediatePropagation();
   if(controlled){controlled=false;lastControlled='';kernel.setProps(id,{agentCornerFold:undefined});}
   kernel.focus(id);
   const next=altCorner??intent.corner!;
   if(!active||next[0]!==corner[0]||next[1]!==corner[1]){reset();corner=next;point=[...next];}
   target=p;pointer.kind='arrow';velocity=[0,0];held=true;pinned=hover=false;pointerId=event.pointerId;pin.current=null;
   host.classList.remove('peel-preview');host.classList.add('peeling','peel-dragging');wake();log({src:'technique',type:'peel',windowId:id});
  };
  const move=(event:PointerEvent)=>{if(!held||event.pointerId!==pointerId)return;event.preventDefault();event.stopImmediatePropagation();target=local(event.clientX,event.clientY);};
  const up=(event:PointerEvent)=>{
   if(!held||event.pointerId!==pointerId)return;event.preventDefault();event.stopImmediatePropagation();held=false;host.classList.remove('peel-dragging');pinned=event.shiftKey;
   if(pinned)pin.current={right:corner[0]>0,bottom:corner[1]>0,x:target[0]/width,y:target[1]/height};else if(reduce.matches)reset();
  };
  const leave=()=>{if(hover&&!held&&!pinned)release();};
  const key=(event:KeyboardEvent)=>{if(event.key==='Escape'&&active){
   if(controlled&&adaptation.active)return;
   event.preventDefault();event.stopImmediatePropagation();
   if(controlled){controlled=false;kernel.beginGesture('peel:release');kernel.setProps(id,{agentCornerFold:undefined});kernel.endGesture();}
   release();
  }};
  const command=(event:Event)=>{
   if((event as CustomEvent<{id:string}>).detail?.id!==id)return;
   if(pinned){release();return;}
   reset();corner=[width,height];point=[...corner];const amount=Math.min(110,Math.min(width,height)*.3);target=[width-amount,height-amount];pinned=true;
   pin.current={right:true,bottom:true,x:target[0]/width,y:target[1]/height};host.classList.add('peeling');wake();log({src:'technique',type:'peel',windowId:id});
  };
  const saved=pin.current;
  if(saved){corner=[saved.right?width:0,saved.bottom?height:0];point=target=[saved.x*width,saved.y*height];active=pinned=true;last=performance.now();surface.classList.add('liquid-peeling');host.classList.add('peeling');draw(performance.now());}
  const syncControlled=()=>{
   const spec=kernel.get(id)?.props.agentCornerFold as import('../agent/adaptive/types').FoldSpec|undefined;
   const signature=spec?`${spec.corner}:${spec.amount.toFixed(4)}`:'';
   if(signature===lastControlled)return;lastControlled=signature;
   if(!spec){if(controlled){controlled=false;release();}return;}
   const next:Corner=[spec.corner.endsWith('right')?width:0,spec.corner.startsWith('bottom')?height:0];
   if((!controlled&&!saved)||corner[0]!==next[0]||corner[1]!==next[1]){reset();corner=next;point=[...next];}
   controlled=true;held=hover=false;pinned=true;
   target=[corner[0]+(corner[0]?-1:1)*width*spec.amount,corner[1]+(corner[1]?-1:1)*height*spec.amount];
   pin.current={right:corner[0]>0,bottom:corner[1]>0,x:target[0]/width,y:target[1]/height};host.classList.add('peeling');wake();
  };
  const offControlled=kernel.subscribe(syncControlled);syncControlled();
  host.addEventListener('pointerdown',begin,true);host.addEventListener('pointermove',preview);host.addEventListener('pointerleave',leave);
  window.addEventListener('pointermove',move,{capture:true,passive:false});window.addEventListener('pointerup',up,true);window.addEventListener('pointercancel',release,true);window.addEventListener('blur',release);window.addEventListener('keydown',key,true);window.addEventListener('window:peel',command);
  return()=>{
   offControlled();
   if(pinned)pin.current={right:corner[0]>0,bottom:corner[1]>0,x:target[0]/width,y:target[1]/height};reset(false);
   host.removeEventListener('pointerdown',begin,true);host.removeEventListener('pointermove',preview);host.removeEventListener('pointerleave',leave);window.removeEventListener('pointermove',move,true);window.removeEventListener('pointerup',up,true);window.removeEventListener('pointercancel',release,true);window.removeEventListener('blur',release);window.removeEventListener('keydown',key,true);window.removeEventListener('window:peel',command);
  };
 },[id,width,height,enabled,body]);
 if(!enabled)return null;
 return <svg className="liquid-peel" ref={svg} width={width} height={height} aria-hidden="true"><defs><linearGradient id={`peel-glass-${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".95"/><stop offset=".5" stopColor="#e5f1f6" stopOpacity=".88"/><stop offset="1" stopColor="#bdd5e2" stopOpacity=".8"/></linearGradient></defs><path ref={sheet} data-peel-flap className="peel-backside" fill={`url(#peel-glass-${id})`}/><LivingRim ref={edge} path=""/><path ref={foldEdge} className="peel-fold-edge"/></svg>;
}
