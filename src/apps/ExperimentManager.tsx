import {useState} from 'react';
import {useStore} from '../system/createStore';
import {assignmentStore,ensureAssignment,fileTaskIds,paperModeOptions,paperTaskIds,rebuildAssignments,setFileAssignment,setFileEligibility,setPaperAssignment,setPaperEligibility,type AssignedPaperMode} from '../study/assignments';
import {studyTasks} from '../study/tasks';
import {STUDY_TASKS} from './data/studies';
import {experimentFlow} from '../study/flow';
import {fileLayoutModes,fileTaskStore,type FileLayoutMode} from '../study/workspaces';
import {learningHistory,onboarding} from '../study/onboarding';

function downloadJson(name:string,value:unknown){
 const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));
 const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export default function ExperimentManager({onClose}:{onClose:()=>void}){
 const {participants,eligibility}=useStore(assignmentStore,state=>state),flow=useStore(experimentFlow,state=>state),file=useStore(fileTaskStore,state=>state),current=useStore(onboarding,state=>state);
 const {byParticipant:learning,skips}=useStore(learningHistory,state=>state);
 const [tab,setTab]=useState<'assignments'|'data'>('assignments'),[name,setName]=useState(''),[studentId,setStudentId]=useState(''),[filter,setFilter]=useState('all'),[message,setMessage]=useState('');
 const stageRecords=flow.records.filter(record=>filter==='all'||record.participant===filter),fileRecords=file.results.filter(record=>filter==='all'||record.participant===filter);
 const locked=(id:string,environment:'paper'|'files',task:string)=>flow.records.some(record=>record.participant===id&&record.environment===environment&&record.task===task)||
  id===current.studentId&&flow.stageRunning&&environment==='paper'&&paperTaskIds[flow.levels.paper]===task||
  environment==='files'&&file.results.some(record=>record.participant===id&&record.task===task)||
  id===current.studentId&&environment==='files'&&file.running&&file.current===task;
 const lockedIds=(environment:'paper'|'files',task:string)=>new Set(participants.filter(person=>locked(person.studentId,environment,task)).map(person=>person.studentId));
 return <div className="experiment-app experiment-manager">
  <header className="experiment-manager-header"><button type="button" onClick={onClose} aria-label="返回实验入口">←</button><h1>实验管理</h1></header>
  <nav className="experiment-manager-tabs" aria-label="实验管理页面"><button className={tab==='assignments'?'active':''} onClick={()=>setTab('assignments')}>交互分配</button><button className={tab==='data'?'active':''} onClick={()=>setTab('data')}>收集数据</button></nav>
  {tab==='assignments'?<>
   <p className="experiment-manager-note">先为每道题勾选可用形式，再按分配组轮换。已开始或完成的题目会锁定其形式。</p>
   <h2>题目可用形式</h2>
   <div className="experiment-eligibility-list">{paperTaskIds.map(task=><details key={task} data-eligibility-task={task}><summary>论文阅读 · {studyTasks[task].label}<span>{eligibility.paper[task].length} 种</span></summary><div className="experiment-eligibility-options">{paperModeOptions.map(option=>{const checked=eligibility.paper[task].includes(option.id),fixed=participants.some(person=>locked(person.studentId,'paper',task)&&person.paper[task]===option.id);return <label key={option.id}><input type="checkbox" aria-label={`${studyTasks[task].label} 可用 ${option.label}`} checked={checked} disabled={checked&&(fixed||eligibility.paper[task].length===1)} onChange={event=>setPaperEligibility(task,option.id,event.target.checked,lockedIds('paper',task))}/>{option.label}</label>})}</div></details>)}
    {fileTaskIds.map(task=><details key={task} data-eligibility-task={task}><summary>文件管理 · {STUDY_TASKS.find(item=>item.id===task)?.title}<span>{eligibility.files[task].length} 种</span></summary><div className="experiment-eligibility-options">{fileLayoutModes.map(option=>{const checked=eligibility.files[task].includes(option.id),fixed=participants.some(person=>locked(person.studentId,'files',task)&&person.files[task]===option.id);return <label key={option.id}><input type="checkbox" aria-label={`${STUDY_TASKS.find(item=>item.id===task)?.title} 可用 ${option.label}`} checked={checked} disabled={checked&&(fixed||eligibility.files[task].length===1)} onChange={event=>setFileEligibility(task,option.id,event.target.checked,lockedIds('files',task))}/>{option.label}</label>})}</div></details>)}</div>
   <button className="experiment-rebuild" onClick={()=>{rebuildAssignments(locked);setMessage('已按筛选结果重排未开始的题目');}}>按筛选重排未开始的分配</button>
   <form className="experiment-roster-form" onSubmit={event=>{event.preventDefault();const id=studentId.trim();if(!id)return;if(assignmentStore.get().participants.some(item=>item.studentId===id)){setMessage('该学号已在分配表中');return;}ensureAssignment(id,name);setStudentId('');setName('');setMessage('已加入待测名单');}}>
    <input aria-label="待测学号" placeholder="学号" value={studentId} onChange={event=>setStudentId(event.target.value)} required/>
    <input aria-label="待测姓名" placeholder="姓名（可选）" value={name} onChange={event=>setName(event.target.value)}/>
    <button type="submit">添加待测者</button>
   </form>
   {message&&<p role="status" className="experiment-manager-status">{message}</p>}
   <h2>论文阅读分配表</h2><div className="experiment-table-scroll"><table className="experiment-data-table experiment-assignment-table"><thead><tr><th>参与者 · 分配组</th>{paperTaskIds.map(id=><th key={id}>{studyTasks[id].label}</th>)}</tr></thead><tbody>{participants.map(person=><tr key={person.studentId}><th>{person.name||person.studentId}<small>{person.name&&person.studentId} · 第 {person.group} 组</small></th>{paperTaskIds.map(id=><td key={id}><select aria-label={`${person.studentId} ${studyTasks[id].label}交互方式`} value={person.paper[id]} disabled={locked(person.studentId,'paper',id)} onChange={event=>setPaperAssignment(person.studentId,id,event.target.value as AssignedPaperMode)}>{paperModeOptions.filter(option=>eligibility.paper[id].includes(option.id)||option.id===person.paper[id]).map(option=><option key={option.id} value={option.id}>{option.label}</option>)}</select></td>)}</tr>)}</tbody></table>{participants.length===0&&<p className="experiment-empty">添加待测者后显示分配表。</p>}</div>
   <h2>文件管理分配表</h2><div className="experiment-table-scroll"><table className="experiment-data-table experiment-assignment-table"><thead><tr><th>参与者 · 分配组</th>{fileTaskIds.map(id=><th key={id}>{STUDY_TASKS.find(task=>task.id===id)?.title}</th>)}</tr></thead><tbody>{participants.map(person=><tr key={person.studentId}><th>{person.name||person.studentId}<small>{person.name&&person.studentId} · 第 {person.group} 组</small></th>{fileTaskIds.map(id=><td key={id}><select aria-label={`${person.studentId} ${id}呈现方式`} value={person.files[id]} disabled={locked(person.studentId,'files',id)} onChange={event=>setFileAssignment(person.studentId,id,event.target.value as FileLayoutMode)}>{fileLayoutModes.filter(option=>eligibility.files[id].includes(option.id)||option.id===person.files[id]).map(option=><option key={option.id} value={option.id}>{option.label}</option>)}</select></td>)}</tr>)}</tbody></table>{participants.length===0&&<p className="experiment-empty">添加待测者后显示分配表。</p>}</div>
  </>:<>
   <p className="experiment-manager-note">此浏览器已记录 {flow.records.length} 道正式题、{file.results.length} 条文件提交。数据保存在本机浏览器中。</p>
   <div className="experiment-data-actions"><label>参与者 <select aria-label="筛选参与者" value={filter} onChange={event=>setFilter(event.target.value)}><option value="all">全部</option>{participants.map(person=><option key={person.studentId} value={person.studentId}>{person.name||person.studentId} · {person.studentId}</option>)}</select></label><button onClick={()=>downloadJson('aquawindow-study-data.json',{exportedAt:new Date().toISOString(),eligibility,assignments:participants,learningResults:learning,learningSkips:skips,stages:flow.records,fileResults:file.results})}>导出全部数据</button></div>
   <h2>掌握效果测试</h2><div className="experiment-table-scroll"><table className="experiment-data-table"><thead><tr><th>学号</th><th>状态</th><th>已通过</th><th>总用时</th></tr></thead><tbody>{participants.filter(person=>filter==='all'||person.studentId===filter).map(person=><tr key={person.studentId}><td>{person.studentId}</td><td>{learning[person.studentId]?.length===7?'已通过':skips[person.studentId]?'已跳过':'进行中'}</td><td>{learning[person.studentId]?.length??0} / 7</td><td>{(learning[person.studentId]??[]).reduce((sum,item)=>sum+item.seconds,0).toFixed(1)} 秒</td></tr>)}</tbody></table></div>
   <h2>正式实验记录</h2><div className="experiment-table-scroll"><table className="experiment-data-table"><thead><tr><th>学号</th><th>场景</th><th>题目</th><th>交互形式</th><th>用时</th></tr></thead><tbody>{stageRecords.map((record,index)=><tr key={`${record.participant}-${record.environment}-${record.task}-${index}`}><td>{record.participant}</td><td>{record.environment==='paper'?'论文阅读':'文件管理'}</td><td>{record.environment==='paper'?(studyTasks[record.task as keyof typeof studyTasks]?.label??(record.task==='citation'?'引用来源（旧题）':record.task)):STUDY_TASKS.find(task=>task.id===record.task)?.title}</td><td>{record.environment==='paper'?paperModeOptions.find(option=>option.id===record.technique)?.label:fileLayoutModes.find(option=>option.id===record.technique)?.label}</td><td>{record.seconds} 秒</td></tr>)}</tbody></table>{stageRecords.length===0&&<p className="experiment-empty">暂无正式实验记录。</p>}</div>
   <h2>文件提交</h2><div className="experiment-table-scroll"><table className="experiment-data-table"><thead><tr><th>学号</th><th>题目</th><th>结果</th><th>用时</th><th>提交文件</th></tr></thead><tbody>{fileRecords.map((record,index)=><tr key={`${record.participant}-${record.task}-${index}`}><td>{record.participant}</td><td>{STUDY_TASKS.find(task=>task.id===record.task)?.title}</td><td>{record.correct?'正确':'未命中'}</td><td>{record.seconds} 秒</td><td>{record.file}</td></tr>)}</tbody></table>{fileRecords.length===0&&<p className="experiment-empty">暂无文件提交。</p>}</div>
  </>}
 </div>;
}
