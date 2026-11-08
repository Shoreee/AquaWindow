import {useEffect,useState} from 'react';
import {useStore} from '../system/createStore';
import {ui} from '../system/ui';
import {TaskCard} from '../study/TaskCard';
import {experimentFlow,chooseExperiment,exportExperiment,paperLevels,activateParticipant,jumpToTask} from '../study/flow';
import {studyTasks} from '../study/tasks';
import {fileTasks,fileTaskStore,fileLayoutModes} from '../study/workspaces';
import {paperModeOptions} from '../study/assignments';
import {DesktopAppIcon} from '../shell/DesktopAppIcon';
import {onboarding} from '../study/onboarding';
import ExperimentOnboarding from './ExperimentOnboarding';
import ExperimentManager from './ExperimentManager';
export default function Experiment(){
 const flow=useStore(experimentFlow,s=>s),environment=useStore(ui,s=>s.studyEnvironment),mode=useStore(ui,s=>s.studyMode),file=useStore(fileTaskStore,s=>s);
 const enrollment=useStore(onboarding,s=>s);
 const [showManager,setShowManager]=useState(false);
 useEffect(()=>{if(enrollment.stage==='ready')activateParticipant(enrollment.studentId);},[enrollment.stage,enrollment.studentId]);
 if(enrollment.stage!=='ready')return showManager?<ExperimentManager onClose={()=>setShowManager(false)}/>:<ExperimentOnboarding onOpenManager={()=>setShowManager(true)}/>;
 if(showManager&&flow.view==='hub')return <ExperimentManager onClose={()=>setShowManager(false)}/>;
 if(flow.view==='hub')return <div className="experiment-app experiment-hub"><h1>选择实验</h1><p>{enrollment.testMode?'测试模式 · 不计入正式数据':`${enrollment.name} · ${enrollment.studentId}`}</p><div className="experiment-worlds">
  <button onClick={()=>chooseExperiment('paper')}><DesktopAppIcon id="writer"/><strong>论文阅读</strong><span>{flow.levels.paper>=paperLevels.length?'已完成':flow.levels.paper?`继续第 ${flow.levels.paper+1} 题`:'阅读、对照与返回'}</span></button>
  <button onClick={()=>chooseExperiment('files')}><DesktopAppIcon id="finder"/><strong>文件管理</strong><span>{flow.levels.files>=fileTasks.length?'已完成':flow.levels.files?`继续第 ${flow.levels.files+1} 题`:'查找、核对与选择'}</span></button>
  <button onClick={()=>setShowManager(true)}><DesktopAppIcon id="experiment"/><strong>实验管理</strong><span>交互分配与数据</span></button>
 </div>{!enrollment.testMode&&flow.records.length>0&&<button className="experiment-export" onClick={exportExperiment}>导出当前被试记录</button>}</div>;
 if(flow.view==='complete')return <div className="experiment-app experiment-complete"><span className="level-complete-mark">✓</span><h1>本轮已完成</h1><button className="experiment-primary" onClick={()=>experimentFlow.set({view:'hub'})}>返回实验</button>{!enrollment.testMode&&<button className="experiment-export" onClick={exportExperiment}>导出记录</button>}</div>;
 const count=environment==='paper'?paperLevels.length:fileTasks.length;
 return <div className="experiment-app"><header className="experiment-level-header"><button aria-label="返回实验" onClick={()=>experimentFlow.set({view:'hub'})}>‹</button><span>第 {flow.levels[environment]+1} / {count} 题</span>{!enrollment.testMode&&<button className="experiment-export" onClick={exportExperiment}>导出</button>}</header>
  {enrollment.testMode&&<label className="experiment-test-switch">测试切换题目<select aria-label="测试切换题目" value={flow.levels[environment]} onChange={event=>jumpToTask(environment,Number(event.target.value))}>{environment==='paper'?paperLevels.map((id,index)=><option key={id} value={index}>{studyTasks[id].label}</option>):fileTasks.map((task,index)=><option key={task.id} value={index}>{task.title}</option>)}</select></label>}
  <div className="experiment-progress" aria-hidden="true">{Array.from({length:count},(_,index)=><i className={index<=flow.levels[environment]?'reached':''} key={index}/>)}</div>
  {environment==='paper'?<div className="experiment-condition"><span>本题交互形式</span><strong>{paperModeOptions.find(item=>item.id===(mode??'standard'))?.label}</strong></div>:<div className="experiment-condition"><span>本题呈现方式</span><strong>{fileLayoutModes.find(item=>item.id===file.layoutMode)?.label}</strong></div>}<TaskCard/>
 </div>;
}
