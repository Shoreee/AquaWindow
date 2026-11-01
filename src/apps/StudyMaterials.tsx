import type {WindowState} from '../kernel/types';
import {kernel,useKernel,workArea} from '../system/kernel';
import { useStore } from '../system/createStore';
import { studyTasks, studyTaskStore, type StudyTaskId } from '../study/tasks';
import StudyPdf from './StudyPdf';
import StudyQa from './StudyQa';
import StudyBrowser from './StudyBrowser';

export function openStudyResource(resource:string,title?:string){
  const taskId=studyTaskStore.get().current;
  if(resource==='files'||resource==='notes'||resource==='qa'||resource==='browser'){
    const existing=kernel.list().find(win=>win.appId==='study'&&win.props.resource===resource&&win.props.taskId===taskId);
    if(existing){kernel.focus(existing.id);return existing.id;}
  }
  const item=studyTasks[taskId].resources.find(entry=>entry.id===resource);
  const area=workArea(),offset=(kernel.list().length%4)*26;
  return kernel.open({
    appId:'study',
    title:title??item?.title??'空白笔记',
    role:resource==='notes'||resource==='qa'?'primary':'reference',
    rect:{x:area.x+Math.max(16,(area.w-660)/2)+offset,y:area.y+28+offset,w:Math.min(660,area.w-44),h:Math.min(620,area.h-54)},
    props:{resource,taskId},
    focus:true,
  },'user');
}

export default function StudyMaterials({win}:{win:WindowState}){
  const current=useStore(studyTaskStore,state=>state.current);
  const focused=useKernel(state=>state.focusedId===win.id);
  const liveForm=useKernel(state=>state.windows[win.id]?.form);
  const taskId=(win.props.taskId as StudyTaskId|undefined)??current;
  const resources=studyTasks[taskId].resources;
  const resource=String(win.props.resource??'pdf');
  if(liveForm==='capsule'&&win.form==='normal')return <div className="study-capsule-thumbnail"><span>{resource==='pdf'?'PDF':resource==='browser'?'网页':'材料'}</span><strong>{win.title}</strong></div>;
  if(resource==='files')return <div className="study-file-list">
    <h2>文件</h2>
    {resources.map(item=><button key={item.id} onClick={()=>openStudyResource(item.id)}>{item.title}</button>)}
  </div>;
  if(resource==='notes')return <div className="study-notes" contentEditable suppressContentEditableWarning aria-label="实验笔记"/>;
  if(resource==='qa')return <StudyQa windowId={win.id} example={studyTasks[taskId].qaExample}/>;
  if(resource==='browser')return <StudyBrowser windowId={win.id}/>;
  const item=resources.find(entry=>entry.id===resource);
  if(!item)return null;
  if(item.kind==='pdf')return <StudyPdf windowId={win.id} url={item.url} title={item.title} focused={focused}/>;
  return <div className="study-image-scroll"><img src={item.url} alt={item.title}/></div>;
}
