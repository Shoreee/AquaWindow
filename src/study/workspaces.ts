import type {KernelState} from '../kernel/types';
import {kernel,workArea} from '../system/kernel';
import {ui} from '../system/ui';
import {CONDITIONS} from '../techniques/techniques';
import {fileCandidateOrder} from './fileOrder';
import {studyTaskStore} from './tasks';
import {createStore} from '../system/createStore';
import {STUDY_TASKS,studyTask,type StudyTaskId} from '../apps/data/studies';
import {studyTechniques,type StudyInteractionModeId} from './interactionModes';
import {beginWindowMotion,cancelManualWindowMotion} from '../agent/adaptive/manualMotion';
import {bounded} from '../agent/adaptive/compiler';

export type StudyEnvironment='paper'|'files';
export type FileTaskId=StudyTaskId;
export type FileLayoutMode='parallel'|'primary-secondary';
export const fileLayoutModes=[{id:'parallel' as const,label:'并列呈现',description:'候选文件并排阅读。'},{id:'primary-secondary' as const,label:'主次呈现',description:'一份主文件与三份次文件；点击次文件切换。'}];
export const fileTasks=STUDY_TASKS.map(task=>({id:task.id,label:task.title,title:task.title,description:task.instruction,steps:['选择顶部呈现方式并开始任务。','阅读候选文件，选出目标材料并提交。']}));
export interface FileResult {task:StudyTaskId;participant:string;mode:string;file:string;correct:boolean;seconds:number;submittedAt:string;candidateOrder:string[]}
const resultsKey='aquawindow.file-studies.results.v1';
function savedResults():FileResult[]{try{const value=JSON.parse(localStorage.getItem(resultsKey)??'[]');return Array.isArray(value)?value:[]}catch{return []}}
export const fileTaskStore=createStore({current:'task1' as StudyTaskId,participant:'P01',layoutMode:null as FileLayoutMode|null,mode:null as FileLayoutMode|null,mainDocumentId:'task1-a',candidateOrder:[] as string[],running:false,submitted:false,startedAt:0,results:savedResults()});
const snapshots:Partial<Record<StudyEnvironment,KernelState>>={};
let paperMode:StudyInteractionModeId|null=null;
const empty=():KernelState=>({windows:{},order:[],focusedId:null,screen:kernel.getState().screen,rev:0});

// The experiment owns its workspace; closing it returns to the ordinary desktop.
let desktopSnapshot:KernelState|undefined;
let desktopAgent=false;
let desktopTask=studyTaskStore.get().current,experimentTask=studyTaskStore.get().current;
let experimentEnvironment:StudyEnvironment='paper';
export function restoreStudyWorkspace(state:KernelState){
 const experiment=kernel.list().find(win=>win.appId==='experiment');
 const windows={...state.windows},order=state.order.filter(id=>windows[id]?.appId!=='experiment');
 for(const [id,win] of Object.entries(windows))if(win.appId==='experiment')delete windows[id];
 if(experiment){windows[experiment.id]=experiment;order.push(experiment.id);}
 kernel.restoreWorkspace({...state,windows,order,focusedId:experiment?.id??state.focusedId});
}
export function openExperiment(){
 const existing=kernel.list().find(win=>win.appId==='experiment');
 if(existing){kernel.restore(existing.id);return;}
 desktopSnapshot=kernel.getState();desktopAgent=ui.get().agentEnabled;
 desktopTask=studyTaskStore.get().current;studyTaskStore.set({current:experimentTask});
 ui.set({studyEnvironment:experimentEnvironment});
 const mode=experimentEnvironment==='paper'?paperMode:null;
 ui.set({experimentOpen:true,agentEnabled:false,autonomy:'off',studyMode:mode,tech:experimentEnvironment==='files'?{...studyTechniques(null),depth:true,periphery:true}:studyTechniques(mode)});
 kernel.restoreWorkspace(snapshots[ui.get().studyEnvironment]??empty());
 const area=workArea();
 kernel.open({id:'experiment',appId:'experiment',title:'实验',role:'tool',rect:{x:Math.max(area.x,area.x+area.w-420),y:area.y+20,w:Math.min(400,area.w),h:Math.min(640,area.h-40)}});
}
export function closeExperiment(){
 if(!ui.get().experimentOpen)return;
 snapshots[ui.get().studyEnvironment]=kernel.getState();experimentEnvironment=ui.get().studyEnvironment;
 if(experimentEnvironment==='paper')paperMode=ui.get().studyMode;
 experimentTask=studyTaskStore.get().current;studyTaskStore.set({current:desktopTask});
 ui.set({experimentOpen:false,studyEnvironment:'paper',studyMode:null,agentEnabled:desktopAgent,autonomy:desktopAgent?'preview':'off',tech:{...CONDITIONS[3].techniques,yield:'none',cutout:true}});
 kernel.restoreWorkspace(desktopSnapshot??empty());
}
kernel.onEvent(event=>{if(event.type==='close'&&event.windowId==='experiment')closeExperiment();});

export function switchStudyEnvironment(next:StudyEnvironment){
 const current=ui.get().studyEnvironment;
 if(current===next)return;
 snapshots[current]=kernel.getState();
 if(current==='paper')paperMode=ui.get().studyMode;
 restoreStudyWorkspace(snapshots[next]??empty());
 const mode=next==='paper'?paperMode:null;
 ui.set({studyEnvironment:next,studyMode:mode,tech:next==='files'?{...studyTechniques(null),depth:true,periphery:true}:studyTechniques(mode),missionControl:false});
 if(next==='files'&&!snapshots.files)openFileTask(fileTaskStore.get().current);
 if(kernel.get('experiment'))kernel.restore('experiment');
}

export function openFileTask(next:StudyTaskId){
 fileTaskStore.set({current:next,mode:null,mainDocumentId:`${next}-a`,candidateOrder:[],running:false,submitted:false,startedAt:0});
 restoreStudyWorkspace(empty());
 const area=workArea(),width=Math.min(650,Math.max(400,(area.w-36)/2));
 kernel.open({appId:'finder',title:'桌面',role:'tool',rect:{x:area.x+12,y:area.y+48,w:width,h:Math.min(570,area.h-80)},props:{path:'Desktop'}},'system');
 kernel.open({appId:'finder',title:'下载文件夹',role:'tool',rect:{x:area.x+Math.min(width*.72,area.w-width-10),y:area.y+115,w:width,h:Math.min(570,area.h-140)},props:{path:'Downloads'}},'system');
 if(kernel.get('experiment'))kernel.restore('experiment');
}

export function selectFileLayoutMode(mode:FileLayoutMode){if(fileTaskStore.get().running)return;fileTaskStore.set({layoutMode:mode});}
function documentRects(mode:FileLayoutMode,taskId:StudyTaskId,mainId:string){
 const work=workArea(),gap=work.w<900?12:20,headerHeight=Math.min(work.w<1100?164:142,work.h*.3);
 const host={x:work.x,y:work.y,w:work.w,h:headerHeight};
 const area={x:work.x,y:work.y+headerHeight+gap,w:work.w,h:work.h-headerHeight-gap};
 const ids=fileTaskStore.get().candidateOrder.length?fileTaskStore.get().candidateOrder:['a','b','c','d'].map(letter=>`${taskId}-${letter}`);
 const rects:Record<string,{x:number;y:number;w:number;h:number}>={};
 if(mode==='parallel'){const width=(area.w-3*gap)/4;ids.forEach((id,i)=>rects[id]={x:area.x+i*(width+gap),y:area.y,w:width,h:area.h});}
 else{
  const secondary=ids.filter(id=>id!==mainId);
  if(taskId==='task2'){
   const width=Math.min(area.w*.64,area.h*1.15),sideWidth=area.w-width-gap,previewWidth=Math.min(sideWidth*.78,area.h*.44),previewHeight=Math.min(area.h*.34,previewWidth+42),offsets=[0,.16,-.08];
   rects[mainId]={x:area.x,y:area.y,w:width,h:area.h};
   secondary.forEach((id,i)=>rects[id]={x:area.x+width+gap+(sideWidth-previewWidth)/2+previewWidth*offsets[i],y:area.y+i*(area.h-previewHeight)/2,w:previewWidth,h:previewHeight});
  }else{
   const width=(area.w-gap)/2,height=(area.h-2*gap)/3;rects[mainId]={x:area.x,y:area.y,w:width,h:area.h};
   secondary.forEach((id,i)=>rects[id]={x:area.x+width+gap,y:area.y+i*(height+gap),w:width,h:height});
  }
 }
 return {ids,rects,host};
}
export function startFileTask(){
 const s=fileTaskStore.get(),mode=s.layoutMode;if(!mode)return;
 const candidateOrder=fileCandidateOrder(s.current,s.participant),mainDocumentId=candidateOrder[0];
 fileTaskStore.set({candidateOrder,mainDocumentId});
 const {ids,rects,host}=documentRects(mode,s.current,mainDocumentId),work=workArea();
 restoreStudyWorkspace(empty());
 kernel.open({appId:'file-study-guide',title:studyTask(s.current).title,role:'primary',rect:host,focus:false,props:{fileTaskId:s.current}},'system');
 for(const [index,id] of ids.entries()){
  const doc=studyTask(s.current).documents.find(item=>item.id===id);if(!doc)continue;
  const target=rects[id],initial=matchMedia('(prefers-reduced-motion: reduce)').matches?target:bounded({x:work.x+work.w*.25+index*22,y:target.y+20+index*16,w:Math.min(650,work.w*.6),h:Math.min(560,target.h)},work);
  kernel.open({appId:'file-study',title:doc.file,role:'reference',rect:initial,focus:false,props:{studyDocumentId:id,studyLayout:true,fileTaskId:s.current}},'system');
 }
 fileTaskStore.set({mode,mainDocumentId,running:true,submitted:false,startedAt:performance.now()});
 applyFileLayout(true);
 if(kernel.get('experiment'))kernel.minimize('experiment');
}
export function applyFileLayout(animate=false,point?:{x:number;y:number}){
 const s=fileTaskStore.get();if(!s.running||!s.mode)return;
 const {host,rects}=documentRects(s.mode,s.current,s.mainDocumentId);
 cancelManualWindowMotion();
 const guide=kernel.list().find(win=>win.appId==='file-study-guide'&&win.props.fileTaskId===s.current);
 if(guide)kernel.setRect(guide.id,host,'system','file-study.layout');
 const docs=kernel.list().filter(win=>win.appId==='file-study'&&win.props.studyLayout&&win.props.fileTaskId===s.current);
 if(animate&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
  kernel.beginGesture('file-study.layout','system');
  const motion=beginWindowMotion(docs.map(win=>win.id),'move',point);
  docs.forEach(win=>{const rect=rects[String(win.props.studyDocumentId)];if(rect)motion.update(win.id,rect);});
  motion.finish();
 }else kernel.apply(docs.map(win=>({windowId:win.id,rect:rects[String(win.props.studyDocumentId)]})),'system','file-study.layout');
 const main=docs.find(win=>win.props.studyDocumentId===s.mainDocumentId);if(main)kernel.focus(main.id,'system');
}
export function promoteFileDocument(id:string,point?:{x:number;y:number}){
 const s=fileTaskStore.get();if(!s.running||s.mode!=='primary-secondary'||s.mainDocumentId===id||!id.startsWith(`${s.current}-`))return;
 fileTaskStore.set({mainDocumentId:id});
 applyFileLayout(true,point);
}
export function submitFileDocument(documentId:string){
 const s=fileTaskStore.get(),task=studyTask(s.current),doc=task.documents.find(item=>item.id===documentId);
 if(!s.running||s.submitted||!doc)return;
 const result:FileResult={task:s.current,participant:s.participant.trim()||'P01',mode:s.mode??'none',file:doc.file,correct:documentId===task.targetId,seconds:+((performance.now()-s.startedAt)/1000).toFixed(2),submittedAt:new Date().toISOString(),candidateOrder:[...s.candidateOrder]};
 const results=[...s.results,result];fileTaskStore.set({submitted:true,running:false,results});localStorage.setItem(resultsKey,JSON.stringify(results));
 if(s.current==='task3'){
  cancelManualWindowMotion();
  const guide=kernel.list().find(win=>win.appId==='file-study-guide'&&win.props.fileTaskId===s.current);
  if(guide){const work=workArea();kernel.setRect(guide.id,bounded({x:work.x+work.w*.25,y:work.y+30,w:650,h:560},work),'system','file-study.submitted');kernel.restore(guide.id);kernel.focus(guide.id,'system');}
 }
}

export function exportFileResults(){
 const blob=new Blob([JSON.stringify(fileTaskStore.get().results,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download='file-studies-results.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
