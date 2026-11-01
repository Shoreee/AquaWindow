import { kernel } from '../system/kernel';
import { studyTasks, type StudyTaskId } from '../study/tasks';

export default function StudyWeb({url,title,taskId,sourceWindowId,onOpenPaper}:{url:string;title:string;taskId:StudyTaskId;sourceWindowId?:string;onOpenPaper:()=>void}){
  const returnToPaper=()=>{
    const source=sourceWindowId&&kernel.get(sourceWindowId);
    const paper=source??kernel.list().find(win=>win.appId==='study'&&win.props.taskId===taskId&&studyTasks[taskId].resources.find(item=>item.id===win.props.resource)?.kind==='pdf');
    if(paper)kernel.focus(paper.id);
    else onOpenPaper();
  };
  return <div className="study-web">
    <div className="study-web-toolbar">
      <span className="study-web-source">{title.includes('Bilibili')?'离线存档 · 视频不可播放':'离线网页存档'}</span>
      <button type="button" onClick={returnToPaper}>返回论文</button>
      <span className="study-web-title">{title}</span>
    </div>
    <iframe src={url} title={title} sandbox="allow-same-origin" referrerPolicy="no-referrer"/>
  </div>;
}
