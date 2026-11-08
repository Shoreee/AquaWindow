import {useEffect,useState} from 'react';
import {useStore} from '../system/createStore';
import {studyTasks,studyTaskStore} from './tasks';
import {ui} from '../system/ui';
import {fileTasks,fileTaskStore,startFileTask} from './workspaces';
import {paperModeOptions} from './assignments';
import {isChoiceQuestion,paperTaskReady,questionsPerSet,type ChoiceLetter} from './paperQuestions';
import {experimentFlow,beginPaperLevel,currentPaperCondition,finishLevel,finishPaperQuestion} from './flow';
import {openStudyResource} from '../apps/StudyMaterials';
import {onboarding} from './onboarding';

export function TaskCard(){
 const current=useStore(studyTaskStore,state=>state.current),environment=useStore(ui,state=>state.studyEnvironment),file=useStore(fileTaskStore,state=>state),flow=useStore(experimentFlow,state=>state);
 const testMode=useStore(onboarding,state=>state.testMode);
 const [response,setResponse]=useState('');
 useEffect(()=>setResponse(''),[current,flow.paperRound,flow.paperItem]);
 if(environment==='files'){
  const task=fileTasks.find(item=>item.id===file.current)!;
  return <section className="study-task-card expanded" aria-label="文件管理实验"><div className="study-task-details">
   <h2>{task.title}</h2><p>{task.description}</p>
   {!file.running&&!file.submitted&&<button className="experiment-primary" disabled={!file.layoutMode} onClick={startFileTask}>开始答题</button>}
   {file.running&&<p>核对后，在目标文件中提交。</p>}
   {file.submitted&&<><p role="status">已提交</p><button className="experiment-primary" onClick={()=>finishLevel(false)}>下一题</button></>}
  </div></section>;
 }
 const task=studyTasks[current],condition=currentPaperCondition();
 if(!condition)return null;
 const ready=paperTaskReady(current,condition.order.length);
 const modeLabel=paperModeOptions.find(option=>option.id===condition.mode)?.label??condition.mode;
 const nextLabel=condition.item+1<questionsPerSet?'下一题':condition.round+1<condition.order.length?'下一种形式':'完成本任务';
 return <section className="study-task-card expanded" aria-label="论文阅读实验"><div className="study-task-details">
  <h2>{task.title}</h2>
  <p className="study-condition-progress">{modeLabel} · 形式 {condition.round+1}/{condition.order.length} · 题目 {condition.item+1}/{questionsPerSet}</p>
  {!ready&&!testMode?<p role="status">此任务的题目组尚未填全。请在实验管理中填写后开始。</p>:!flow.stageRunning?<button className="experiment-primary" onClick={()=>{beginPaperLevel();openStudyResource(task.resources[0].id);}}>开始本形式</button>:<>
   <p className="study-question-prompt">{condition.prompt.trim()||'题目待填写（测试预览）'}</p>
   {isChoiceQuestion(condition.question)?<div className="study-choice-options" role="radiogroup" aria-label="选择答案">{condition.question.options.map((option,index)=>{const letter=String.fromCharCode(65+index) as ChoiceLetter;return <label key={letter} className={response===letter?'selected':''}><input type="radio" name={`paper-question-${condition.setIndex}-${condition.item}`} value={letter} checked={response===letter} onChange={()=>setResponse(letter)}/><span>{letter}. {option}</span></label>})}</div>:<label className="study-response-label">作答记录（可选）<textarea aria-label="作答记录" value={response} onChange={event=>setResponse(event.target.value)} rows={4}/></label>}
   <button className="experiment-primary" disabled={isChoiceQuestion(condition.question)&&!response} onClick={()=>finishPaperQuestion(response)}>{nextLabel}</button>
  </>}
 </div></section>;
}
