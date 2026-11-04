import {useEffect,useState} from 'react';
import {useStore} from '../system/createStore';
import {studyTasks,studyTaskStore} from './tasks';
import {ui} from '../system/ui';
import {fileTasks,fileTaskStore,startFileTask} from './workspaces';
import {TaskOneQuiz} from './TaskOneQuiz';
import {TaskFourMatching} from './TaskFourMatching';
import {TaskFiveQuiz} from './TaskFiveQuiz';
import {experimentFlow,beginPaperLevel,finishLevel} from './flow';
import {openStudyResource} from '../apps/StudyMaterials';
import {log,logStore} from './logger';
const comparable=(value:string)=>value.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function TaskCard(){
 const current=useStore(studyTaskStore,state=>state.current),environment=useStore(ui,state=>state.studyEnvironment),file=useStore(fileTaskStore,state=>state),flow=useStore(experimentFlow,state=>state);
 const [quizDone,setQuizDone]=useState(false),[matchingDone,setMatchingDone]=useState(false),[imageQuizDone,setImageQuizDone]=useState(false),[bilingualAnswer,setBilingualAnswer]=useState(''),[bilingualDone,setBilingualDone]=useState(false),[bilingualFeedback,setBilingualFeedback]=useState('');
 const imageSent=useStore(logStore,state=>state.records.some(record=>record.type==='qa.image.send'&&record.t>=flow.startedAt&&record.data?.task==='answer'&&record.data?.hasImage===true));
 useEffect(()=>{setQuizDone(false);setMatchingDone(false);setImageQuizDone(false);setBilingualAnswer('');setBilingualDone(false);setBilingualFeedback('');},[current]);
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
  <h2>{task.title}</h2><p>{task.description}</p>{task.bilingualPrompt&&<blockquote className="study-bilingual-quote">{task.bilingualPrompt.chinese}</blockquote>}<ol>{task.steps.map(step=><li key={step}>{step}</li>)}</ol>
  {!flow.stageRunning?<button className="experiment-primary" onClick={()=>{beginPaperLevel();const resource=task.resources[0];openStudyResource(resource.id);}}>开始答题</button>:<>
   {current==='comparison'&&<TaskOneQuiz onSubmitted={setQuizDone}/>}
   {current==='external'&&<TaskFourMatching onSubmitted={setMatchingDone}/>}
   {current==='answer'&&<TaskFiveQuiz imageSent={imageSent} onSubmitted={setImageQuizDone}/>}
   {task.bilingualPrompt&&<form className="study-bilingual-answer" onSubmit={event=>{event.preventDefault();const correct=comparable(bilingualAnswer)===comparable(task.bilingualPrompt!.english);log({src:'study',type:'bilingual.answer',data:{correct,answer:bilingualAnswer}});setBilingualDone(correct);setBilingualFeedback(correct?'已提交英文原文':'与目标段落未匹配，请核对后重试。');}}><label htmlFor="bilingual-original">对应英文原文</label><textarea id="bilingual-original" aria-label="对应英文原文" value={bilingualAnswer} onChange={event=>{setBilingualAnswer(event.target.value);setBilingualFeedback('');}} disabled={bilingualDone} rows={4} placeholder="从英文版论文复制原文"/><button className="experiment-primary" type="submit" disabled={!bilingualAnswer.trim()||bilingualDone}>提交英文原文</button>{bilingualFeedback&&<p role="status">{bilingualFeedback}</p>}</form>}
   <button className="experiment-primary" disabled={current==='comparison'&&!quizDone||current==='bilingual'&&!bilingualDone||current==='external'&&!matchingDone||current==='answer'&&(!imageSent||!imageQuizDone)} onClick={()=>finishLevel(current!=='comparison'&&current!=='external'&&current!=='answer')}>下一题</button>
  </>}
 </div></section>;
}
