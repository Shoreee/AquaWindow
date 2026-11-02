import { createStore } from '../system/createStore';
import { bus, kernel, ui, workArea } from '../system';
import { adaptation, setDeepSeekEnabled } from '../agent/adaptive/runtime';
import { BASELINE } from '../techniques/techniques';
import { bounded } from '../agent/adaptive/compiler';
import {STUDY_TASKS,isStudyTaskId,studyTask,studyDocument as task1Document,studyCandidates,type StudyTaskId} from '../apps/data/studies';
import { log } from './logger';
import { isTask1Layout, TASK1_MODES, task1CandidateIds } from './task1Modes';
import { task1Layout } from './task1Layout';
import { beginWindowMotion,cancelManualWindowMotion } from '../agent/adaptive/manualMotion';
export { TASK1_MODES } from './task1Modes';

export interface Task1Result { participant:string; mode:string; appliedModes:string[]; trialId:string; selectedFile:string; correct:boolean; seconds:number; submittedAt:string; conditionVersion?:number; candidateFiles?:string[]; task?:StudyTaskId; }
const storageKey=(taskId:StudyTaskId)=>`aquawindow.${taskId}.results.v1`;
function savedResults():Task1Result[]{
  return STUDY_TASKS.flatMap(task=>{
    try { const value=JSON.parse(localStorage.getItem(storageKey(task.id))??'[]');return Array.isArray(value)?value.map((r:Task1Result)=>({...r,task:task.id})):[]; } catch{return [];}
  });
}
export const task1Study=createStore({taskId:'task1' as StudyTaskId,running:false,submitted:false,mode:'parallel',mainDocumentId:'task1-a',secondaryDocumentIds:['task1-b','task1-c','task1-d'],appliedModes:[] as string[],participant:'P01',startedAt:0,trialId:'',results:savedResults()});
let offTrial:(()=>void)|undefined;

function openWorkspace(previews:boolean,mode:string){
  const {taskId}=task1Study.get(),task=studyTask(taskId);
  cancelManualWindowMotion();
  adaptation.cancel(true);
  setDeepSeekEnabled(false);
  kernel.closeAll();
  ui.set({scenarioId:taskId,strategyId:mode,agentEnabled:false,autonomy:'off',scenarioPanel:false,scenarioCollapsed:true,
    participant:task1Study.get().participant,condition:'fluid-agent',taskStartedAt:previews?performance.now():null,
    tech:{...BASELINE,shape:'squircle',depth:true,snap:true,periphery:true,semanticFiles:false,provenance:false}});
  const W=workArea();
  if(previews&&isTask1Layout(mode)){
    const s=task1Study.get(),layout=task1Layout(W,mode,s.mainDocumentId,s.secondaryDocumentIds,taskId);
    kernel.open({appId:'task1',title:`${task.label} · ${TASK1_MODES.find(m=>m.id===mode)?.label}`,rect:layout.host,
      role:'primary',props:{pool:taskId,studyTaskId:taskId,studyMode:mode}} ,'system');
    task1CandidateIds(mode,taskId).forEach((id,i)=>{
      const doc=task1Document(id)!;
      const target=layout.documents[id];
      kernel.open({appId:'preview',title:doc.file,focus:false,role:'reference',
        rect:matchMedia('(prefers-reduced-motion: reduce)').matches?target:
          bounded({x:W.x+W.w*.25+i*22,y:target.y+20+i*16,w:Math.min(650,W.w*.6),h:Math.min(560,target.h)},W),
        props:{pool:taskId,studyDocumentId:id,studyLayout:true,studyFitImage:taskId==='task2'&&mode==='primary-secondary',studyCompact:mode==='primary-secondary'&&id!==s.mainDocumentId}},'system');
    });
    applyTask1Layout(true);
    return;
  }
  const open=(appId:string,title:string,x:number,y:number,w:number,h:number,props:Record<string,unknown>)=>kernel.open({
    appId,title,rect:bounded({x:W.x+x*W.w,y:W.y+y*W.h,w:Math.min(w,W.w*.7),h:Math.min(h,W.h*.9)},W),
    role:appId==='task1'?'primary':appId==='preview'?'reference':'tool',props:{pool:taskId,...props},focus:false,
    importance:appId==='preview'?[{id:'abstract',label:'文章摘要',x:.07,y:.08,w:.86,h:.6,weight:1}]:[]},'system');
  open('finder','桌面',.015,.04,690,420,{path:'Desktop'});
  open('finder','下载文件夹',.31,.37,770,440,{path:'Downloads'});
  const host=open('task1',`${task.label} · ${task.title}`,previews?.22:.5,previews?.16:.04,650,560,{studyTaskId:taskId,studyMode:mode});
  kernel.focus(host,'system');
}
export function applyTask1Layout(animate=false,point?:{x:number;y:number}){
  const s=task1Study.get();if(!s.running||!isTask1Layout(s.mode))return;
  cancelManualWindowMotion();
  const layout=task1Layout(workArea(),s.mode,s.mainDocumentId,s.secondaryDocumentIds,s.taskId);
  const host=kernel.list().find(w=>w.appId==='task1'&&!w.props.agentBranch);
  if(host)kernel.setRect(host.id,layout.host,'system',`${s.taskId}.layout`);
  const docs=kernel.list().filter(w=>w.props.studyLayout);
  docs.forEach(w=>kernel.setProps(w.id,{studyCompact:s.mode==='primary-secondary'&&w.props.studyDocumentId!==s.mainDocumentId}));
  if(animate&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
    kernel.beginGesture(`${s.taskId}.layout`,'system');
    const motion=beginWindowMotion(docs.map(w=>w.id),'move',point);
    docs.forEach(w=>{const rect=layout.documents[String(w.props.studyDocumentId)];if(rect)motion.update(w.id,rect);});
    motion.finish();
  }else{
    kernel.apply(docs.map(w=>({windowId:w.id,rect:layout.documents[String(w.props.studyDocumentId)]})),'system',`${s.taskId}.layout`);
  }
  const primary=docs.find(w=>w.props.studyDocumentId===s.mainDocumentId);if(primary)kernel.focus(primary.id,'system');
}
export function bootStudy(taskId:StudyTaskId){
  if(!isStudyTaskId(taskId))return;
  const url=new URL(location.href);url.searchParams.set('study',taskId);history.replaceState(null,'',url);
  offTrial?.();offTrial=undefined;
  task1Study.set({taskId,running:false,submitted:false,mode:'parallel',mainDocumentId:`${taskId}-a`,secondaryDocumentIds:['b','c','d'].map(letter=>`${taskId}-${letter}`),appliedModes:[]});
  openWorkspace(false,'parallel');
}
export function bootTask1(){bootStudy('task1');}
export function startTask1(mode:string,participant:string){
  if(!TASK1_MODES.some(m=>m.id===mode))return;
  offTrial?.();
  const taskId=task1Study.get().taskId;
  task1Study.set({running:true,submitted:false,mode,mainDocumentId:`${taskId}-a`,secondaryDocumentIds:['b','c','d'].map(letter=>`${taskId}-${letter}`),appliedModes:isTask1Layout(mode)?[mode]:[],participant:participant.trim()||'P01',startedAt:performance.now(),trialId:crypto.randomUUID()});
  openWorkspace(true,mode);
  log({src:'study',type:`${taskId}.start`,data:{task:taskId,trialId:task1Study.get().trialId,mode,conditionVersion:mode==='primary-secondary'&&taskId!=='task3'?4:3,candidateCount:task1CandidateIds(mode,taskId).length}});
  if(isTask1Layout(mode)){
    offTrial=undefined;
    log({src:'study',type:`${taskId}.layout.present`,data:{task:taskId,mode,trialId:task1Study.get().trialId}});
    return;
  }
  let prepared=false;
  offTrial=bus.on(event=>{
    if(!task1Study.get().running||ui.get().scenarioId!==taskId)return;
    if(event.type==='adaptation.invoke'&&!prepared){
      prepared=true;const W=workArea();
      studyCandidates(taskId).forEach((doc,i)=>{
        if(kernel.list().some(w=>w.props.studyDocumentId===doc.id&&!w.props.agentBranch))return;
        kernel.open({appId:'preview',title:doc.file,focus:false,role:'reference',
          rect:bounded({x:W.x+(.06+i*.13)*W.w,y:W.y+(.03+i*.035)*W.h,w:Math.min(580,W.w*.7),h:Math.min(690,W.h*.9)},W),
          props:{pool:taskId,studyDocumentId:doc.id},importance:[{id:'abstract',label:'文件内容',x:.07,y:.08,w:.86,h:.6,weight:1}]},'system');
      });
      const host=kernel.list().find(w=>w.appId==='task1'&&!w.props.agentBranch);if(host)kernel.focus(host.id,'system');
    }
    if(event.type==='adaptation.accept'&&typeof event.data?.planId==='string'){
      const id=event.data.planId;if(id===mode)task1Study.set(s=>({appliedModes:[...new Set([...s.appliedModes,id])]}));
    }
  });
}
export function promoteTask1Document(id:string,point?:{x:number;y:number}){
  const s=task1Study.get();
  if(!s.running||s.mode!=='primary-secondary'||!task1CandidateIds(s.mode,s.taskId).includes(id)||s.mainDocumentId===id)return;
  task1Study.set({mainDocumentId:id,secondaryDocumentIds:s.secondaryDocumentIds.map(previous=>previous===id?s.mainDocumentId:previous)});
  applyTask1Layout(true,point);
  log({src:'study',type:`${s.taskId}.primary.switch`,data:{task:s.taskId,trialId:s.trialId,from:task1Document(s.mainDocumentId)?.file,to:task1Document(id)?.file,seconds:+((performance.now()-s.startedAt)/1000).toFixed(3)}});
}
export function openTask1Document(id:string,parentId?:string){
  const doc=task1Document(id);if(!doc)return;
  const {taskId}=task1Study.get();if(!studyTask(taskId).documents.some(d=>d.id===id))return;
  if(task1Study.get().running&&isTask1Layout(task1Study.get().mode)){
    promoteTask1Document(id);
    const existing=kernel.list().find(w=>w.props.studyDocumentId===id);if(existing)kernel.focus(existing.id);
    return;
  }
  const existing=kernel.list().find(w=>w.props.studyDocumentId===id&&!w.props.agentBranch);
  if(existing){kernel.restore(existing.id);kernel.focus(existing.id);return;}
  const W=workArea();
  kernel.open({appId:'preview',title:doc.file,rect:bounded({x:W.x+W.w*.18,y:W.y+32,w:620,h:Math.min(720,W.h-40)},W),role:'reference',
    props:{pool:taskId,studyDocumentId:id},openedFrom:parentId,
    importance:[{id:'abstract',label:'文章摘要',x:.07,y:.08,w:.86,h:.6,weight:1}]});
}
export function submitTask1Answer(id:string){
  const s=task1Study.get(),doc=task1Document(id);if(!s.running||s.submitted||!doc||!s.appliedModes.length)return;
  if(!studyTask(s.taskId).documents.some(d=>d.id===id))return;
  if(isTask1Layout(s.mode)&&!task1CandidateIds(s.mode,s.taskId).includes(id))return;
  adaptation.cancel(true);
  cancelManualWindowMotion();
  const result:Task1Result={task:s.taskId,participant:s.participant,mode:s.mode,appliedModes:s.appliedModes,trialId:s.trialId,selectedFile:doc.file,correct:id===studyTask(s.taskId).targetId,
    seconds:+((performance.now()-s.startedAt)/1000).toFixed(3),submittedAt:new Date().toISOString(),conditionVersion:s.mode==='primary-secondary'&&s.taskId!=='task3'?4:3,
    candidateFiles:task1CandidateIds(s.mode,s.taskId).map(id=>task1Document(id)!.file)};
  const results=[...s.results,result];
  task1Study.set({submitted:true,running:false,results});
  try{localStorage.setItem(storageKey(s.taskId),JSON.stringify(results.filter(r=>r.task===s.taskId)));}catch{/* Export remains available for this page. */}
  log({src:'study',type:`${s.taskId}.submit`,data:{...result}});
  const host=kernel.list().find(w=>w.appId==='task1'&&!w.props.agentBranch);if(host){
    if(isTask1Layout(s.mode)){const W=workArea();kernel.setRect(host.id,bounded({x:W.x+W.w*.25,y:W.y+30,w:650,h:560},W),'system');}
    kernel.restore(host.id);kernel.focus(host.id);
  }
}
export function exportTask1Results(all=false){
  const s=task1Study.get(),task=all?'all':s.taskId;
  const body=JSON.stringify({task,version:3,results:s.results.filter(r=>all||r.task===s.taskId)},null,2);
  const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([body],{type:'application/json'}));
  link.download=`AquaWindow-${task}-results.json`;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);
}
