import type {AgentContext} from './types';
/** Engineering tolerance for minor geometry edits, not an empirically learned user reward. */
export const SMALL_LAYOUT_CHANGE=.05;
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
export function canReuseContext(previous:AgentContext,current:AgentContext){
 if(previous.task!==current.task||previous.focusedId!==current.focusedId||!same(previous.feedback,current.feedback)||!same(previous.workspace?.constraints,current.workspace?.constraints))return false;
 if(previous.semanticKey!==current.semanticKey)return false;
 if(!same(previous.windows.map(w=>w.id).sort(),current.windows.map(w=>w.id).sort()))return false;
 const close=(a:number,b:number,scale:number)=>Math.abs(a-b)<=Math.max(1,scale)*SMALL_LAYOUT_CHANGE;
 if(!close(previous.work.w,current.work.w,previous.work.w)||!close(previous.work.h,current.work.h,previous.work.h)||!close(previous.work.x,current.work.x,previous.work.w)||!close(previous.work.y,current.work.y,previous.work.h))return false;
 return current.windows.every(w=>{const old=previous.windows.find(p=>p.id===w.id)!;return Math.abs(old.depth-w.depth)<.01&&(['x','w'] as const).every(k=>close(old.rect[k],w.rect[k],current.work.w))&&(['y','h'] as const).every(k=>close(old.rect[k],w.rect[k],current.work.h));});
}
