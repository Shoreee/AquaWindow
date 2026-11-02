import { useState } from 'react';
import { useStore } from '../system/createStore';
import { studyTasks, studyTaskStore, switchStudyTask, type StudyTaskId } from './tasks';
import {ui} from '../system/ui';

export function TaskCard(){
  const [expanded,setExpanded]=useState(false);
  const current=useStore(studyTaskStore,state=>state.current);
  const studyMode=useStore(ui,state=>state.studyMode);
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
      <p className="study-task-foot">{studyMode==='screenshot'?'按 Shift+S 框选论文；图片会自动停靠并与论文窗口融合，同时保存到图库。':studyMode==='fusion'?'拖动窗口可融合；沿接缝拖动或左右抖动标题栏可拆分。Shift+S 截图存入图库。':studyMode?'按 Shift+S 框选论文，截图存入 Dock 的“图库”，可手动打开查看。':'请先在顶部“交互形式”中选择本次要体验的方式；Shift+S 可截图并存入图库。'}</p>
    </div>}
  </aside>;
}
