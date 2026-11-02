import type { Rect } from '../kernel/types';
import { task1CandidateIds } from './task1Modes';

/** Positions only. Window skin and transport come from the existing AquaWindow shell. */
export function task1Layout(work:Rect,mode:string,mainId:string,secondaryIds:string[],taskId='task1'){
  const gap=work.w<900?12:20;
  const headerHeight=Math.min(work.w<1100?164:142,work.h*.3);
  const host={x:work.x,y:work.y,w:work.w,h:headerHeight};
  const area={x:work.x,y:work.y+headerHeight+gap,w:work.w,h:work.h-headerHeight-gap};
  const documents:Record<string,Rect>={};
  if(mode==='parallel'){
    const width=(area.w-2*gap)/3;
    task1CandidateIds(mode,taskId).forEach((id,i)=>documents[id]={x:area.x+i*(width+gap),y:area.y,w:width,h:area.h});
  }else if(taskId==='task2'){
    // Leave the invoice enough height to fit its whole page, with a loose preview cluster beside it.
    const width=Math.min(area.w*.64,area.h*1.15);
    documents[mainId]={x:area.x,y:area.y,w:width,h:area.h};
    const sideWidth=area.w-width-gap,previewWidth=Math.min(sideWidth*.78,area.h*.44);
    const previewHeight=Math.min(area.h*.34,previewWidth+42);
    const offsets=[0,.16,-.08];
    secondaryIds.forEach((id,i)=>documents[id]={
      x:area.x+width+gap+(sideWidth-previewWidth)/2+previewWidth*offsets[i],
      y:area.y+i*(area.h-previewHeight)/2,w:previewWidth,h:previewHeight,
    });
  }else{
    const width=(area.w-gap)/2,height=(area.h-2*gap)/3;
    documents[mainId]={x:area.x,y:area.y,w:width,h:area.h};
    secondaryIds.forEach((id,i)=>documents[id]={x:area.x+width+gap,y:area.y+i*(height+gap),w:width,h:height});
  }
  return {host,documents};
}
