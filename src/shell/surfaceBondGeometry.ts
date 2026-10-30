import type {KernelState,Rect,WindowState} from '../kernel/types';
export interface SurfaceBond{id:string;a:string;b:string;axis:'x'|'y';createdAt:number}
export const surfaceBonds=(w?:WindowState)=>(w?.props.surfaceBonds as SurfaceBond[]|undefined)??[];
export const isSurfaceGroup=(group?:string)=>!!group?.startsWith('surface:');
export function allSurfaceBonds(state:KernelState){return [...new Map(Object.values(state.windows).flatMap(surfaceBonds).filter(b=>state.windows[b.a]&&state.windows[b.b]&&!state.windows[b.a].minimized&&!state.windows[b.b].minimized&&state.windows[b.a].form==='normal'&&state.windows[b.b].form==='normal').map(b=>[b.id,b])).values()];}
export function surfaceComponent(state:KernelState,id:string,excluded?:string){
 const found=new Set([id]),bonds=allSurfaceBonds(state).filter(b=>b.id!==excluded);let changed=true;
 while(changed){changed=false;for(const b of bonds)if(found.has(b.a)!==found.has(b.b)){found.add(b.a);found.add(b.b);changed=true;}}
 return [...found];
}
export function seamGeometry(a:Rect,b:Rect,axis:'x'|'y'){
 const first=axis==='x'?a.x+a.w:a.y+a.h,second=axis==='x'?b.x:b.y;
 const lo=Math.max(axis==='x'?a.y:a.x,axis==='x'?b.y:b.x)+25;
 const hi=Math.min(axis==='x'?a.y+a.h:a.x+a.w,axis==='x'?b.y+b.h:b.x+b.w)-25;
 return {first,second,lo,hi,length:Math.max(0,hi-lo),axis};
}
export function splitProgress(position:number,lo:number,hi:number,fromEnd:boolean){return Math.max(0,Math.min(1,fromEnd?(hi-position)/Math.max(1,hi-lo):(position-lo)/Math.max(1,hi-lo)));}
/** Move only the requested window to a neighbouring edge, preserving both sizes. */
export function fusionPlacement(moving:Rect,fixed:Rect,work:Rect){
 const gap=4;
 const variants=[
  {axis:'x' as const,x:fixed.x+fixed.w+gap,y:Math.max(fixed.y-Math.max(0,moving.h-130),Math.min(moving.y,fixed.y+fixed.h-130))},
  {axis:'x' as const,x:fixed.x-moving.w-gap,y:Math.max(fixed.y-Math.max(0,moving.h-130),Math.min(moving.y,fixed.y+fixed.h-130))},
  {axis:'y' as const,x:Math.max(fixed.x-Math.max(0,moving.w-130),Math.min(moving.x,fixed.x+fixed.w-130)),y:fixed.y+fixed.h+gap},
  {axis:'y' as const,x:Math.max(fixed.x-Math.max(0,moving.w-130),Math.min(moving.x,fixed.x+fixed.w-130)),y:fixed.y-moving.h-gap},
 ];
 const cost=(r:typeof variants[number])=>Math.hypot(r.x-moving.x,r.y-moving.y)+12*(Math.max(0,work.x-r.x)+Math.max(0,r.x+moving.w-work.x-work.w)+Math.max(0,work.y-r.y)+Math.max(0,r.y+moving.h-work.y-work.h));
 variants.sort((a,b)=>cost(a)-cost(b));const best=variants[0];return {axis:best.axis,rect:{...moving,x:best.x,y:best.y}};
}
/** Resizing one member moves neighbours along the bonded normal, keeping the seam attached. */
export function attachedResize(state:KernelState,id:string,rect:Rect){
 const rects=new Map<string,Rect>([[id,rect]]),queue=[id],bonds=allSurfaceBonds(state);
 while(queue.length){const current=queue.shift()!;for(const bond of bonds){const peer=bond.a===current?bond.b:bond.b===current?bond.a:null;if(!peer||rects.has(peer))continue;
  const r=rects.get(current)!,other={...state.windows[peer].rect};
  if(bond.axis==='x')other.x=bond.a===current?r.x+r.w+4:r.x-other.w-4;
  else other.y=bond.a===current?r.y+r.h+4:r.y-other.h-4;
  rects.set(peer,other);queue.push(peer);
 }}return rects;
}
