import {useEffect,useState} from 'react';
import {useStore} from '../system/createStore';
import {studyTasks,studyTaskStore} from './tasks';
import {ui} from '../system/ui';
import {fileTasks,fileTaskStore,startFileTask} from './workspaces';
import {TaskOneQuiz} from './TaskOneQuiz';
import {experimentFlow,beginPaperLevel,finishLevel} from './flow';
import {openStudyResource} from '../apps/StudyMaterials';
export function TaskCard(){
 const current=useStore(studyTaskStore,state=>state.current),environment=useStore(ui,state=>state.studyEnvironment),file=useStore(fileTaskStore,state=>state),flow=useStore(experimentFlow,state=>state);
 const [quizDone,setQuizDone]=useState(false);
 useEffect(()=>setQuizDone(false),[current]);
 if(environment==='files'){
  const task=fileTasks.find(item=>item.id===file.current)!;
  return <section className="study-task-card expanded" aria-label="文件管理实验"><div className="study-task-details">
   <h2>{task.title}</h2><p>{task.description}</p>
   {!file.running&&!file.submitted&&<><button className="experiment-primary" disabled={!file.layoutMode} onClick={startFileTask}>开始答题</button></>}
   {file.running&&<p>核对后，在目标文件中提交。</p>}
   {file.submitted&&<><p role="status">已提交</p><button className="experiment-primary" onClick={()=>finishLevel(false)}>下一题</button></>}
  </div></section>;
 }
 const task=studyTasks[current];
 return <section className="study-task-card expanded" aria-label="论文阅读实验"><div className="study-task-details">
  <h2>{task.title}</h2><p>{task.description}</p><ol>{task.steps.map(step=><li key={step}>{step}</li>)}</ol>
  {!flow.stageRunning?<button className="experiment-primary" onClick={()=>{beginPaperLevel();const resource=task.resources[0];openStudyResource(resource.id);}}>开始答题</button>:<>
   {current==='comparison'&&<TaskOneQuiz onSubmitted={setQuizDone}/>}
   <button className="experiment-primary" disabled={current==='comparison'&&!quizDone} onClick={()=>finishLevel(current!=='comparison')}>下一题</button>
  </>}
 </div></section>;
}
