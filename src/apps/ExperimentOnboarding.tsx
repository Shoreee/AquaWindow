import {useEffect,useState} from 'react';
import {useStore} from '../system/createStore';
import {ui} from '../system/ui';
import {openStudyResource} from './StudyMaterials';
import {onboarding,registerParticipant,skipParticipantInfo,learningQuestions,startLearningTest,submitLearning,sampleLearning,clearLearningWindows,setupLearningQuestion,skipLearningTest} from '../study/onboarding';
import {studyInteractionModes,type StudyInteractionModeId} from '../study/interactionModes';
import {selectStudyMode} from '../study/conditions';

export default function ExperimentOnboarding(){
 const state=useStore(onboarding,s=>s),mode=useStore(ui,s=>s.studyMode);
 const [name,setName]=useState(state.name),[studentId,setStudentId]=useState(state.studentId),[answer,setAnswer]=useState(''),[message,setMessage]=useState('');
 useEffect(()=>{setAnswer('');setMessage('');},[state.question,state.stage]);
 useEffect(()=>{if(state.stage!=='assessment')return;const timer=setInterval(sampleLearning,100);return()=>clearInterval(timer);},[state.stage]);
 if(state.stage==='profile')return <div className="experiment-app experiment-profile-screen"><h1>参与者信息</h1><form className="experiment-profile" onSubmit={event=>{event.preventDefault();registerParticipant(name,studentId);}}>
  <label>姓名<input aria-label="姓名" required autoComplete="off" value={name} onChange={event=>setName(event.target.value)}/></label>
  <label>学号<input aria-label="学号" required autoComplete="off" value={studentId} onChange={event=>setStudentId(event.target.value)}/></label>
  <button className="experiment-primary" disabled={!name.trim()||!studentId.trim()}>进入教学</button>
  <button className="experiment-skip-test" type="button" onClick={skipParticipantInfo}>跳过信息录入（测试）</button>
 </form></div>;
 if(state.stage==='practice')return <div className="experiment-app experiment-onboarding-screen"><h1>交互练习</h1><p>打开材料窗口，选择交互方式进行练习。</p>
  <label className="experiment-condition">交互方式<select aria-label="练习交互方式" value={mode??''} onChange={event=>selectStudyMode((event.target.value||null) as StudyInteractionModeId|null)}><option value="">普通窗口</option>{studyInteractionModes.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
  {mode&&<p>{studyInteractionModes.find(item=>item.id===mode)?.description}</p>}
  <div className="learning-materials">{[['pdf','中文论文'],['english-pdf','英文论文'],['architecture','架构图'],['notes','笔记'],['qa','AI 问答'],['browser','网页'],['gallery','图库'],['files','文件夹']].map(([id,label])=><button key={id} onClick={()=>openStudyResource(id,label)}>{label}</button>)}</div>
  <button className="experiment-export" onClick={()=>{clearLearningWindows();selectStudyMode(null);}}>清空练习窗口</button>
  <button className="experiment-primary" onClick={startLearningTest}>进入掌握效果测试</button>
 </div>;
 if(state.stage==='passed')return <div className="experiment-app experiment-onboarding-screen"><h1>掌握效果测试已通过</h1><p>已完成全部 {learningQuestions.length} 道操作题。</p><button className="experiment-primary" onClick={()=>{clearLearningWindows();onboarding.set({stage:'ready'});}}>进入实验</button></div>;
 const question=learningQuestions[state.question];
 return <div className="experiment-app experiment-onboarding-screen"><h1>掌握效果测试</h1><p>第 {state.question+1} / {learningQuestions.length} 题</p><p className="learning-technique"><strong>测试交互：{studyInteractionModes.find(item=>item.id===question.mode)?.label}</strong></p><p>{question.prompt}</p>
  <form onSubmit={event=>{event.preventDefault();if(!submitLearning(answer))setMessage('尚未完成本题，请继续操作。');}}>
   {(question.mode==='peel'||question.mode==='reveal')&&<label className="experiment-participant">参考编号<input aria-label="参考编号" value={answer} onChange={event=>setAnswer(event.target.value)} autoComplete="off"/></label>}
   {message&&<p role="status">{message}</p>}<button className="experiment-primary">提交结果</button>
  </form>
  <button className="experiment-export" onClick={()=>{setupLearningQuestion();setAnswer('');setMessage('');}}>重新布置本题</button>
  <button className="experiment-export" onClick={()=>{clearLearningWindows();onboarding.set({stage:'practice'});selectStudyMode(null);}}>返回练习</button>
  <button className="experiment-skip-test" type="button" onClick={skipLearningTest}>跳过掌握测试</button>
 </div>;
}
