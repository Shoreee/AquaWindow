import type {KernelState,Rect} from '../../kernel/types';
import type {AgentContext,PrimitiveStep} from './types';
type Arrange=Extract<PrimitiveStep,{type:'arrange'}>;
/** Relative layout constraints, solved locally. No model-generated CSS or arbitrary screen code. */
export function solveArrangement(base:KernelState,step:Arrange,ctx:AgentContext):Map<string,Rect>|null{
 const ids=step.order??step.targets;if(!ids.length||ids.some(id=>!base.windows[id]))return null;
 const W=ctx.work,gap=Math.min(24,W.w*.025),axis=step.axis??'x',minW=Math.min(280,W.w),minH=Math.min(190,W.h),out=new Map<string,Rect>();
 const put=(id:string,rect:Rect)=>{if(rect.w<minW-.5||rect.h<minH-.5)return false;out.set(id,rect);return true;};
 if(step.layout==='compare'){
  const weights=step.weights??ids.map(()=>1),sum=weights.reduce((n,v)=>n+v,0),length=(axis==='x'?W.w:W.h)-gap*(ids.length+1);let offset=gap;
  for(const [index,id] of ids.entries()){
   const size=length*weights[index]/sum,original=base.windows[id].rect;
   if(!put(id,axis==='x'?{x:W.x+offset,y:W.y+gap,w:size,h:Math.min(original.h,W.h-2*gap)}:{x:W.x+gap,y:W.y+offset,w:Math.min(original.w,W.w-2*gap),h:size}))return null;
   offset+=size+gap;
  }
 }else{
  const anchor=step.anchorId??(ids.includes(ctx.focusedId??'')?ctx.focusedId!:ids[0]),peers=ids.filter(id=>id!==anchor);
  if(!peers.length){const r=base.windows[anchor].rect;return new Map([[anchor,{...r,x:W.x+(W.w-r.w)/2,y:W.y+(W.h-r.h)/2}]]);}
  const total=(axis==='x'?W.w:W.h)-gap*3,main=total*(step.share??.65),side=total-main,end=ids.at(-1)===anchor;
  const mainOffset=end?side+2*gap:gap,sideOffset=end?gap:main+2*gap;
  if(!put(anchor,axis==='x'?{x:W.x+mainOffset,y:W.y+gap,w:main,h:W.h-gap*2}:{x:W.x+gap,y:W.y+mainOffset,w:W.w-gap*2,h:main}))return null;
  const peerSize=((axis==='x'?W.h:W.w)-gap*(peers.length+1))/peers.length;
  for(const [i,id] of peers.entries())if(!put(id,axis==='x'?{x:W.x+sideOffset,y:W.y+gap+i*(peerSize+gap),w:side,h:peerSize}:{x:W.x+gap+i*(peerSize+gap),y:W.y+sideOffset,w:peerSize,h:side}))return null;
 }
 return out;
}
