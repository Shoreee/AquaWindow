import {useEffect,useState} from 'react';
import type {WindowState} from '../kernel/types';
import {useStore} from '../system/createStore';
import {bootStudy,exportTask1Results,startTask1,TASK1_MODES,task1Study} from '../study/task1';
import {applyTask1Layout} from '../study/task1';
import {isTask1Layout} from '../study/task1Modes';
import {exportJsonl} from '../study/logger';
import {STUDY_TASKS,studyTask,type StudyTaskId} from './data/studies';

export default function Task1({win: _win}:{win:WindowState}){
  const s=useStore(task1Study,s=>s);
  const task=studyTask(s.taskId);
  const [mode,setMode]=useState(s.mode),[participant,setParticipant]=useState(s.participant);
  useEffect(()=>{
    let frame=0;
    const resize=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>applyTask1Layout());};
    window.addEventListener('resize',resize);
    return ()=>{cancelAnimationFrame(frame);window.removeEventListener('resize',resize);};
  },[]);
  if(s.running&&isTask1Layout(s.mode))return <div className="writer"><div className="writer-page task1-guide task1-layout-guide">
    <p>{task.instruction}</p>
    <p>{s.mode==='primary-secondary'?'点击右侧文件，切换到主窗口查看。':'三份文件可分别查看。'}{s.taskId==='task2'&&s.mode==='primary-secondary'?'发票默认整张显示，可放大核对细节。':''}在你认定的文件中点击“选择此文件并提交”。</p>
  </div></div>;
  return <div className="writer"><div className="writer-page task1-guide">
    <h1>{task.label}：{task.title}</h1>
    <p>{task.instruction}</p>
    <p>查看文件后，在你认定的文件末尾点击“选择此文件并提交”。</p>
    {s.running?<>
      <h2>{TASK1_MODES.find(m=>m.id===s.mode)?.label}</h2>
      <p>长按空格唤出 Agent，系统会准备四份候选文件。等待效果出现后松开空格采用；Esc 撤回。</p>
      <p>你也可以在“桌面”和“下载文件夹”中双击文件阅读。</p>
      {!s.appliedModes.length&&<p>请先采用本轮交互效果，再提交所选文件。</p>}
    </>:s.submitted?<>
      <h2>已提交</h2><p>本轮答案已记录。请根据研究人员的安排填写量表。</p>
      <button className="chip" onClick={()=>bootStudy(s.taskId)}>返回实验设置</button>
    </>:<>
      <p><label>实验任务 <select aria-label="实验任务" value={s.taskId} onChange={e=>bootStudy(e.target.value as StudyTaskId)}>
        {STUDY_TASKS.map(t=><option key={t.id} value={t.id}>{t.label} · {t.title}</option>)}
      </select></label></p>
      <p><label>被试编号 <input className="finder-search" value={participant} onChange={e=>setParticipant(e.target.value)}/></label></p>
      <p><label>交互方式 <select aria-label="交互方式" value={mode} onChange={e=>setMode(e.target.value)}>
        {TASK1_MODES.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}
      </select></label></p>
      <p>每轮固定使用所选方式，点击“开始任务”后计时。</p>
      <p>{mode==='parallel'?'并列呈现：三份候选文件等宽排列，可分别滚动查看。':mode==='primary-secondary'?(s.taskId==='task2'?'主次呈现：主发票整张显示，另外三份以错落的小窗口预览；点击任一预览即可切换到主窗口。':'主次呈现：左侧为占阅读区一半的大文件，右侧为另外三份缩小文件；点击右侧文件即可与左侧互换。'):'长按空格唤出四份候选文件，等待效果出现后松开采用。本轮只提供所选效果。'}</p>
      <button className="chip on" onClick={()=>startTask1(mode,participant)}>开始任务</button>
    </>}
    {!s.running&&<div className="task1-paper-actions"><button className="chip" onClick={()=>exportTask1Results()}>导出本任务记录</button><button className="chip" onClick={()=>exportTask1Results(true)}>导出三个任务记录</button><button className="chip" onClick={exportJsonl}>导出操作日志</button></div>}
  </div></div>;
}
