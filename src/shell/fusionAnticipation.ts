import type {KernelState,WindowState} from '../kernel/types';
import {fusionPlacement} from './surfaceBondGeometry';
import {livingWave} from './livingGeometry';
export function anticipationPair(state:KernelState,candidate:{a:string;b:string}|null){
 if(!candidate)return null;
 const a=state.windows[candidate.a],b=state.windows[candidate.b];if(!a||!b)return null;
 const {axis}=fusionPlacement(a.rect,b.rect,{x:8,y:36,w:state.screen.w-16,h:state.screen.h-122});
 const first=axis==='x'?a.rect.x+a.rect.w/2<b.rect.x+b.rect.w/2:a.rect.y+a.rect.h/2<b.rect.y+b.rect.h/2;
 return {a,b,axis,first};
}
/** Same travelling stress crest as Yield, directed into the material. */
export function anticipationOffset(along:number,length:number,time:number){
 const end=Math.max(0,Math.min(1,(along-18)/28,(length-18-along)/28));
 return livingWave(along,time)*end*end;
}
export function anticipationPath(w:WindowState,axis:'x'|'y',first:boolean,time:number){
 const r=w.rect,length=axis==='x'?r.h:r.w;
 return Array.from({length:65},(_,i)=>{
  const along=22+(length-44)*i/64,offset=anticipationOffset(along,length,time)*(first?-1:1);
  const x=axis==='x'?r.x+(first?r.w:0)+offset:r.x+along;
  const y=axis==='y'?r.y+(first?r.h:0)+offset:r.y+along;
  return `${i?'L':'M'}${x.toFixed(2)} ${y.toFixed(2)}`;
 }).join('');
}
