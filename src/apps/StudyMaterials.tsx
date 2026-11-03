import StudyNotes,{copyStudyNotesState} from './StudyNotes';
import {observeApp} from '../agent/adaptive/observations';
import {useEffect} from 'react';
import type {WindowState} from '../kernel/types';
import {kernel,useKernel,workArea} from '../system/kernel';
import {ui} from '../system/ui';
import { useStore } from '../system/createStore';
import { studyTasks, studyTaskStore, type StudyTaskId } from '../study/tasks';
import StudyPdf,{copyStudyPdfState} from './StudyPdf';
import StudyQa,{copyStudyQaState} from './StudyQa';
import StudyBrowser,{copyStudyBrowserState} from './StudyBrowser';
import {galleryStore,openGalleryCapture,dragGalleryCapture} from '../study/gallery';

export function copyStudyMaterialState(sourceId:string,copyId:string){
  copyStudyPdfState(sourceId,copyId);
  copyStudyBrowserState(sourceId,copyId);
  copyStudyQaState(sourceId,copyId);
  copyStudyNotesState(sourceId,copyId);
}

export function openStudyResource(resource:string,title?:string){
  const currentTask=studyTaskStore.get().current;
  const taskId=studyTasks[currentTask].resources.some(item=>item.id===resource)?currentTask:(Object.keys(studyTasks).find(id=>studyTasks[id as StudyTaskId].resources.some(item=>item.id===resource)) as StudyTaskId|undefined)??currentTask;
  if(resource==='files'||resource==='notes'||resource==='qa'||resource==='browser'||resource==='gallery'){
    const existing=kernel.list().find(win=>win.appId==='study'&&win.props.resource===resource&&win.props.taskId===taskId);
    if(existing){kernel.restore(existing.id);return existing.id;}
  }
  const item=studyTasks[taskId].resources.find(entry=>entry.id===resource);
  const area=workArea(),offset=(kernel.list().length%4)*26;
  return kernel.open({
    appId:'study',
    title:title??item?.title??(resource==='gallery'?'图库':'空白笔记'),
    role:resource==='notes'||resource==='qa'?'primary':'reference',
    rect:{x:area.x+Math.max(16,(area.w-660)/2)+offset,y:area.y+28+offset,w:Math.min(660,area.w-44),h:Math.min(620,area.h-54)},
    props:{resource,taskId},
    focus:true,
  },'user');
}

function StudyGallery({windowId}:{windowId:string}){
  const items=useStore(galleryStore,state=>state.items);
  useEffect(()=>{observeApp(windowId,{title:'图库',kind:'gallery',availability:items.length?'metadata-only':'empty',text:items.length?items.map(item=>`${item.title}（来源窗口：${item.sourceId}）`).join('\n'):'图库为空，没有截图。'});},[windowId,items]);
  return <div className="study-gallery">
    <h2>图库</h2>
    {items.length===0?<p>还没有截图。打开论文后按 Ctrl+Shift+S 框选，截图会保存在这里。</p>:<div className="study-gallery-grid">{items.map(item=><button key={item.id} type="button" draggable onDragStart={event=>dragGalleryCapture(event.dataTransfer,item.id)} onClick={()=>openGalleryCapture(item.id)} aria-label={`打开${item.title}`}><img src={item.url} alt="" draggable={false}/><span>{item.title}</span></button>)}</div>}
  </div>;
}

function StudyFiles({windowId,resources}:{windowId:string;resources:{id:string;title:string;kind:string}[]}){
 useEffect(()=>observeApp(windowId,{title:'文件',kind:'file-list',availability:resources.length?'content':'empty',text:'当前文件列表：\n'+resources.map(item=>`${item.title}（${item.kind}）`).join('\n')}),[windowId,resources.map(r=>r.id).join(',')]);
 return <div className="study-file-list"><h2>文件</h2>{resources.map(item=><button key={item.id} onClick={()=>openStudyResource(item.id)}>{item.title}</button>)}</div>;
}
function StudyImage({windowId,url,title}:{windowId:string;url:string;title:string}){
 useEffect(()=>observeApp(windowId,{title,documentId:url,kind:'image',availability:'metadata-only',text:`图片：${title}。仅有图片身份，尚未提供图像内容识别结果。`}),[windowId,url,title]);
 return <div className="study-image-scroll"><img src={url} alt={title}/></div>;
}
export default function StudyMaterials({win}:{win:WindowState}){
  const current=useStore(studyTaskStore,state=>state.current);
  const focused=useKernel(state=>state.focusedId===win.id);
  const liveForm=useKernel(state=>state.windows[win.id]?.form);
  const taskId=(win.props.taskId as StudyTaskId|undefined)??current;
  const experimentOpen=useStore(ui,s=>s.experimentOpen);
  const resources=experimentOpen?studyTasks[taskId].resources:[...new Map(Object.values(studyTasks).flatMap(task=>task.resources).map(item=>[item.url,item])).values()];
  const resource=String(win.props.resource??'pdf');
  if(liveForm==='capsule'&&win.form==='normal')return <div className="study-capsule-thumbnail"><span>{resource==='pdf'?'PDF':resource==='browser'?'网页':'材料'}</span><strong>{win.title}</strong></div>;
  if(resource==='files')return <StudyFiles windowId={win.id} resources={resources}/>;
  if(resource==='notes')return <StudyNotes windowId={win.id}/>;
  if(resource==='qa')return <StudyQa windowId={win.id} example={ui.get().experimentOpen?studyTasks[taskId].qaExample:undefined}/>;
  if(resource==='browser')return <StudyBrowser windowId={win.id}/>;
  if(resource==='gallery')return <StudyGallery windowId={win.id}/>;
  if(resource==='capture')return <div className="study-captured-image"><img src={String(win.props.imageUrl??'')} alt="论文截图" draggable onDragStart={event=>dragGalleryCapture(event.dataTransfer,String(win.props.captureId??''))}/></div>;
  const item=resources.find(entry=>entry.id===resource);
  if(!item)return null;
  if(item.kind==='pdf')return <StudyPdf windowId={win.id} url={item.url} title={item.title} focused={focused}/>;
  return <StudyImage windowId={win.id} url={item.url} title={item.title}/>;
}
