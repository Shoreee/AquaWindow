import type {WindowState} from '../kernel/types';
import {kernel,useKernel,workArea} from '../system/kernel';
import { useStore } from '../system/createStore';
import { studyTasks, studyTaskStore, type StudyTaskId } from '../study/tasks';
import StudyPdf from './StudyPdf';
import StudyQa from './StudyQa';
import StudyWeb from './StudyWeb';

export function openStudyResource(resource:string,title?:string,sourceWindowId?:string){
  const taskId=studyTaskStore.get().current;
  if(resource==='files'||resource==='notes'||resource==='qa'){
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
    props:{resource,taskId,sourceWindowId},
    focus:true,
  },'user');
}

export default function StudyMaterials({win}:{win:WindowState}){
  const current=useStore(studyTaskStore,state=>state.current);
  const focused=useKernel(state=>state.focusedId===win.id);
  const taskId=(win.props.taskId as StudyTaskId|undefined)??current;
  const resources=studyTasks[taskId].resources;
  const resource=String(win.props.resource??'pdf');
  if(resource==='files')return <div className="study-file-list">
    <h2>文件</h2>
    {resources.map(item=><button key={item.id} onClick={()=>openStudyResource(item.id)}>{item.title}</button>)}
  </div>;
  if(resource==='notes')return <div className="study-notes" contentEditable suppressContentEditableWarning aria-label="实验笔记"/>;
  if(resource==='qa')return <StudyQa example={studyTasks[taskId].qaExample}/>;
  const item=resources.find(entry=>entry.id===resource);
  if(!item)return null;
  if(item.kind==='pdf'){
    const related=resource==='pdf'&&taskId==='citation'?resources.filter(entry=>entry.id!=='pdf'&&entry.kind==='pdf'):resource==='pdf'?resources.filter(entry=>entry.kind==='web'):[];
    const returnToSource=()=>{
      const sourceId=win.props.sourceWindowId as string|undefined;
      const source=sourceId&&kernel.get(sourceId);
      const paper=source??kernel.list().find(entry=>entry.appId==='study'&&entry.props.taskId===taskId&&entry.props.resource==='pdf');
      if(paper)kernel.focus(paper.id);
      else openStudyResource('pdf');
    };
    return <StudyPdf url={item.url} title={item.title} focused={focused} related={related} relatedLabel={taskId==='citation'?'引用文献':'相关材料'} onOpenRelated={id=>openStudyResource(id,undefined,win.id)} onReturnToSource={taskId==='citation'&&resource!=='pdf'?returnToSource:undefined}/>;
  }
  if(item.kind==='web')return <StudyWeb url={item.url} title={item.title} taskId={taskId} sourceWindowId={win.props.sourceWindowId as string|undefined} onOpenPaper={()=>openStudyResource('pdf')}/>;
  return <div className="study-image-scroll"><img src={item.url} alt={item.title}/></div>;
}
