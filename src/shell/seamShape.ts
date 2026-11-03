import {seamGeometry} from './surfaceBondGeometry';
export type SeamGeometry=ReturnType<typeof seamGeometry>;
export type SeamSplit={progress:number;fromEnd:boolean;release?:number};
const smooth=(value:number)=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};
export function openingFront(progress:number,length:number){const width=Math.min(.12,Math.max(.025,22/Math.max(1,length)));return {position:progress+width*(2*progress-1),width};}
/** The native contours and their optical rims use exactly the same opening. */
export function seamOpening(t:number,length:number,split:SeamSplit|null){
 if(!split||split.progress<=0)return 0;
 if(split.progress>=1)return 1;
 const u=split.fromEnd?1-t:t,{position,width}=openingFront(split.progress,length);
 return smooth((position-u+width)/(2*width));
}
export function seamWave(t:number,time:number){return Math.sin(Math.PI*Math.max(0,Math.min(1,t)))*(Math.sin(t*15-time*1.6)*.34+Math.sin(t*7+time*.9)*.12);}
export function seamOffset(g:SeamGeometry,first:boolean,t:number,time:number,split:SeamSplit|null){
 const opening=seamOpening(t,g.length,split),wave=seamWave(t,time);
 if(opening===0||split?.release===1)return 0;
 const relief=1-(split?.release??0),spread=7*relief;
 return (first?-1:1)*(spread+wave*.22*relief)*opening;
}
export function seamPath(g:SeamGeometry,first:boolean|null,from:number,to:number,time:number,split:SeamSplit|null){
 if(to-from<.0005)return '';
 const steps=Math.max(2,Math.ceil(g.length*(to-from)/7));
 return Array.from({length:steps+1},(_,i)=>{
  const t=from+(to-from)*i/steps;
  const normal=first===null?(g.first+g.second)/2+seamWave(t,time):(first?g.first:g.second)+seamOffset(g,first,t,time,split);
  const x=g.axis==='x'?normal:g.lo+g.length*t,y=g.axis==='x'?g.lo+g.length*t:normal;
  return `${i?'L':'M'}${x.toFixed(2)} ${y.toFixed(2)}`;
 }).join('');
}
