import {kernel} from '../system/kernel';
import {ui} from '../system/ui';
import {log} from './logger';
const lastRecorded=new WeakMap<HTMLElement,number>();

/** A fused PDF to the right follows the reading position of the left PDF. */
export function syncFusedPdfScroll(sourceId:string,source:HTMLDivElement){
  if(!ui.get().experimentOpen)return;
  if(ui.get().studyEnvironment!=='paper'||ui.get().studyMode!=='sync-scroll')return;
  const current=kernel.get(sourceId);
  if(current?.appId!=='study'||!current.group?.startsWith('surface:'))return;
  const partner=kernel.list().filter(win=>win.id!==sourceId&&win.group===current.group&&win.appId==='study'&&win.rect.x>current.rect.x)
    .sort((a,b)=>a.rect.x-b.rect.x)[0];
  if(!partner)return;
  const target=document.querySelector<HTMLDivElement>(`[data-win="${CSS.escape(partner.id)}"] .study-pdf-scroll`);
  if(!target)return;
  const before=target.scrollTop;
  const sourcePages=source.querySelectorAll<HTMLElement>('.study-pdf-page');
  const targetPages=target.querySelectorAll<HTMLElement>('.study-pdf-page');
  if(!sourcePages.length||!targetPages.length)return;
  if(sourcePages.length===targetPages.length){
    let page=sourcePages[0];
    for(const candidate of sourcePages){if(candidate.offsetTop<=source.scrollTop)page=candidate;else break;}
    const matched=targetPages[Number(page.dataset.page)-1];
    if(!matched)return;
    const progress=Math.max(0,Math.min(1,(source.scrollTop-page.offsetTop)/Math.max(1,page.offsetHeight)));
    target.scrollTop=matched.offsetTop+progress*matched.offsetHeight;
  }else{
    const progress=source.scrollTop/Math.max(1,source.scrollHeight-source.clientHeight);
    target.scrollTop=progress*Math.max(0,target.scrollHeight-target.clientHeight);
  }
  if(Math.abs(target.scrollTop-before)>1&&Math.abs(source.scrollTop-(lastRecorded.get(source)??0))>80){lastRecorded.set(source,source.scrollTop);log({src:'technique',type:'pdf.sync-scroll',windowId:sourceId,data:{targetId:partner.id}});}
}
