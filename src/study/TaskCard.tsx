import { useState } from 'react';
import { useStore } from '../system/createStore';
import { studyTasks, studyTaskStore, switchStudyTask, type StudyTaskId } from './tasks';
import {ui} from '../system/ui';
import {fileTasks,fileTaskStore,openFileTask,startFileTask,exportFileResults} from './workspaces';
import {TaskOneQuiz} from './TaskOneQuiz';

export function TaskCard(){
  const [expanded,setExpanded]=useState(false);
  const current=useStore(studyTaskStore,state=>state.current);
  const studyMode=useStore(ui,state=>state.studyMode);
  const environment=useStore(ui,state=>state.studyEnvironment);
  const fileTaskId=useStore(fileTaskStore,state=>state.current);
  const fileStudy=useStore(fileTaskStore,state=>state);
  const fileTask=fileTasks.find(item=>item.id===fileTaskId)!;
  if(environment==='files')return <aside className={`study-task-card${expanded?' expanded':''}`} aria-label="文件管理实验任务">
    <button className="study-task-toggle" type="button" aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}><span className="study-task-toggle-mark" aria-hidden="true">{expanded?'−':'+'}</span><span>任务说明</span><span className="study-task-toggle-chevron" aria-hidden="true">{expanded?'收起':'展开'}</span></button>
    {expanded&&<div className="study-task-details"><div className="study-task-switch" role="group" aria-label="切换文件管理任务">{fileTasks.map(item=><button key={item.id} type="button" className={fileTaskId===item.id?'selected':''} aria-pressed={fileTaskId===item.id} onClick={()=>openFileTask(item.id)}>{item.label}</button>)}</div><div className="study-task-kicker">文件管理实验</div><h2>{fileTask.title}</h2><p>{fileTask.description}</p>{!fileStudy.running&&!fileStudy.submitted&&<><label className="file-study-participant">被试编号 <input value={fileStudy.participant} onChange={event=>fileTaskStore.set({participant:event.target.value})}/></label><button className="file-study-start" type="button" disabled={!fileStudy.layoutMode} onClick={()=>{startFileTask();setExpanded(false)}}>开始任务</button>{!fileStudy.layoutMode&&<p>请先在顶部选择并列呈现或主次呈现。</p>}</>}{fileStudy.running&&<p>正在进行：{fileStudy.mode==='parallel'?'三份候选文件并排显示，可分别阅读。':'点击次文件切换为主文件，核对后提交。'}</p>}{fileStudy.submitted&&<p>已提交。本轮答案已记录。</p>}<p className="study-task-foot">文件管理仅提供并列呈现与主次呈现；论文阅读的交互形式与窗口状态独立保留。</p><button type="button" className="file-study-export" onClick={exportFileResults}>导出文件管理任务记录</button></div>}
  </aside>;
  const task=studyTasks[current];
  return <aside className={`study-task-card${expanded?' expanded':''}`} aria-label="当前实验任务">
    <button
      className="study-task-toggle"
      type="button"
      aria-expanded={expanded}
      aria-controls="study-task-details"
      onClick={()=>setExpanded(value=>!value)}
    >
      <span className="study-task-toggle-mark" aria-hidden="true">{expanded?'−':'+'}</span>
      <span>任务说明</span>
      <span className="study-task-toggle-chevron" aria-hidden="true">{expanded?'收起':'展开'}</span>
    </button>
    {expanded&&<div id="study-task-details" className="study-task-details">
      <div className="study-task-switch" role="group" aria-label="切换实验任务">
        {(Object.keys(studyTasks) as StudyTaskId[]).map(id=><button key={id} type="button" className={current===id?'selected':''} aria-label={studyTasks[id].label} aria-pressed={current===id} onClick={()=>switchStudyTask(id)}>{studyTasks[id].switchLabel}</button>)}
      </div>
      <div className="study-task-kicker">{task.label}</div>
      <h2>{task.title}</h2>
      <p>{task.description}</p>
      <ol>
        {task.steps.map(step=><li key={step}>{step}</li>)}
      </ol>
      {current==='comparison'&&<TaskOneQuiz/>}
      <p className="study-task-foot">{studyMode==='screenshot'?'按 Shift+S 框选论文；图片会自动停靠并与论文窗口融合，同时保存到图库。':studyMode==='fusion'?'拖动窗口可融合；沿接缝拖动或左右抖动标题栏可拆分。Shift+S 截图存入图库。':studyMode?'按 Shift+S 框选论文，截图存入 Dock 的“图库”，可手动打开查看。':'请先在顶部“交互形式”中选择本次要体验的方式；Shift+S 可截图并存入图库。'}</p>
    </div>}
  </aside>;
}
