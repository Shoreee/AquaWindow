import {useStore} from '../system/createStore';
import {ui} from '../system/ui';
import {TaskCard} from '../study/TaskCard';
import {experimentFlow,chooseExperiment,exportExperiment,paperLevels} from '../study/flow';
import {fileTasks,fileTaskStore,selectFileLayoutMode,fileLayoutModes} from '../study/workspaces';
import {studyInteractionModes,type StudyInteractionModeId} from '../study/interactionModes';
import {selectStudyMode} from '../study/conditions';
import {DesktopAppIcon} from '../shell/DesktopAppIcon';
export default function Experiment(){
 const flow=useStore(experimentFlow,s=>s),environment=useStore(ui,s=>s.studyEnvironment),mode=useStore(ui,s=>s.studyMode),file=useStore(fileTaskStore,s=>s);
 if(flow.view==='hub')return <div className="experiment-app experiment-hub"><h1>选择实验</h1><label className="experiment-participant">参与者<input aria-label="参与者编号" value={file.participant} onChange={event=>{fileTaskStore.set({participant:event.target.value});ui.set({participant:event.target.value});}}/></label><div className="experiment-worlds">
  <button onClick={()=>chooseExperiment('paper')}><DesktopAppIcon id="writer"/><strong>论文阅读</strong><span>{flow.levels.paper>=paperLevels.length?'已完成':flow.levels.paper?`继续第 ${flow.levels.paper+1} 题`:'阅读、对照与返回'}</span></button>
  <button onClick={()=>chooseExperiment('files')}><DesktopAppIcon id="finder"/><strong>文件管理</strong><span>{flow.levels.files>=fileTasks.length?'已完成':flow.levels.files?`继续第 ${flow.levels.files+1} 题`:'查找、核对与选择'}</span></button>
 </div>{flow.records.length>0&&<button className="experiment-export" onClick={exportExperiment}>导出记录</button>}</div>;
 if(flow.view==='complete')return <div className="experiment-app experiment-complete"><span className="level-complete-mark">✓</span><h1>本轮已完成</h1><button className="experiment-primary" onClick={()=>experimentFlow.set({view:'hub'})}>返回实验</button><button className="experiment-export" onClick={exportExperiment}>导出记录</button></div>;
 const count=environment==='paper'?paperLevels.length:fileTasks.length;
 return <div className="experiment-app"><header className="experiment-level-header"><button aria-label="返回实验" onClick={()=>experimentFlow.set({view:'hub'})}>‹</button><span>第 {flow.levels[environment]+1} / {count} 题</span><button className="experiment-export" onClick={exportExperiment}>导出</button></header>
  <div className="experiment-progress" aria-hidden="true">{Array.from({length:count},(_,index)=><i className={index<=flow.levels[environment]?'reached':''} key={index}/>)}</div>
  <label className="experiment-condition">交互方式<select aria-label="交互方式" value={mode??''} onChange={event=>selectStudyMode((event.target.value||null) as StudyInteractionModeId|null)}>
   <option value="">普通窗口</option>{studyInteractionModes.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}
  </select></label>
  {environment==='files'&&<label className="experiment-condition">呈现方式<select aria-label="呈现方式" disabled={file.running} value={file.layoutMode??''} onChange={event=>selectFileLayoutMode(event.target.value as 'parallel'|'primary-secondary')}>
   <option value="" disabled>选择呈现方式</option>{fileLayoutModes.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}
  </select></label>}<TaskCard/>
 </div>;
}
