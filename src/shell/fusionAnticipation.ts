import type {KernelState,WindowState} from '../kernel/types';
import {fusionPlacement} from './surfaceBondGeometry';
export function anticipationPair(state:KernelState,candidate:{a:string;b:string}|null){
 if(!candidate)return null;
 const a=state.windows[candidate.a],b=state.windows[candidate.b];if(!a||!b)return null;
 const {axis}=fusionPlacement(a.rect,b.rect,{x:8,y:36,w:state.screen.w-16,h:state.screen.h-122});
 const first=axis==='x'?a.rect.x+a.rect.w/2<b.rect.x+b.rect.w/2:a.rect.y+a.rect.h/2<b.rect.y+b.rect.h/2;
 return {a,b,axis,first};
}
/** Highlight the existing border; approaching another window never indents it. */
export function anticipationPath(w:WindowState,axis:'x'|'y',first:boolean){
 const r=w.rect,length=axis==='x'?r.h:r.w;
 const start=Math.min(22,length/2),end=Math.max(start,length-22);
 const normal=axis==='x'?r.x+(first?r.w:0):r.y+(first?r.h:0);
 return axis==='x'?`M${normal} ${r.y+start}L${normal} ${r.y+end}`:`M${r.x+start} ${normal}L${r.x+end} ${normal}`;
}
