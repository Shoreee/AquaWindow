import type {KernelState} from '../kernel/types';
import {kernel,workArea} from '../system/kernel';
import {ui} from '../system/ui';
import {createStore} from '../system/createStore';
import {STUDY_TASKS,studyTask,type StudyTaskId} from '../apps/data/studies';
import {studyTechniques,type StudyInteractionModeId} from './interactionModes';

export type StudyEnvironment='paper'|'files';
export type FileTaskId=StudyTaskId;
export const fileTasks=STUDY_TASKS.map(task=>({id:task.id,label:task.label,title:task.title,description:task.instruction,steps:['在“桌面”和“下载文件夹”中查找目标文件。','打开候选文件核对内容，在认定的文件中提交选择。']}));
export interface FileResult {task:StudyTaskId;participant:string;mode:string;file:string;correct:boolean;seconds:number;submittedAt:string}
const resultsKey='aquawindow.file-studies.results.v1';
function savedResults():FileResult[]{try{const value=JSON.parse(localStorage.getItem(resultsKey)??'[]');return Array.isArray(value)?value:[]}catch{return []}}
export const fileTaskStore=createStore({current:'task1' as StudyTaskId,participant:'P01',mode:null as string|null,running:false,submitted:false,startedAt:0,results:savedResults()});
const snapshots:Partial<Record<StudyEnvironment,KernelState>>={};
const modes:Partial<Record<StudyEnvironment,StudyInteractionModeId|null>>={};
const empty=():KernelState=>({windows:{},order:[],focusedId:null,screen:kernel.getState().screen,rev:0});

export function switchStudyEnvironment(next:StudyEnvironment){
 const current=ui.get().studyEnvironment;
 if(current===next)return;
 snapshots[current]=kernel.getState();
 modes[current]=ui.get().studyMode;
 kernel.restoreWorkspace(snapshots[next]??empty());
 const mode=modes[next]??null;
 ui.set({studyEnvironment:next,studyMode:mode,tech:studyTechniques(mode),missionControl:false});
 if(next==='files'&&!snapshots.files)openFileTask(fileTaskStore.get().current);
}

export function openFileTask(next:StudyTaskId){
 fileTaskStore.set({current:next,mode:null,running:false,submitted:false,startedAt:0});
 kernel.restoreWorkspace(empty());
 const area=workArea(),width=Math.min(650,Math.max(400,(area.w-36)/2));
 kernel.open({appId:'finder',title:'桌面',role:'tool',rect:{x:area.x+12,y:area.y+48,w:width,h:Math.min(570,area.h-80)},props:{path:'Desktop'}},'system');
 kernel.open({appId:'finder',title:'下载文件夹',role:'tool',rect:{x:area.x+Math.min(width*.72,area.w-width-10),y:area.y+115,w:width,h:Math.min(570,area.h-140)},props:{path:'Downloads'}},'system');
}

export function startFileTask(){const mode=ui.get().studyMode;if(!mode)return;fileTaskStore.set({mode,running:true,submitted:false,startedAt:performance.now()});}
export function submitFileDocument(documentId:string){
 const s=fileTaskStore.get(),task=studyTask(s.current),doc=task.documents.find(item=>item.id===documentId);
 if(!s.running||s.submitted||!doc)return;
 const result:FileResult={task:s.current,participant:s.participant.trim()||'P01',mode:s.mode??'none',file:doc.file,correct:documentId===task.targetId,seconds:+((performance.now()-s.startedAt)/1000).toFixed(2),submittedAt:new Date().toISOString()};
 const results=[...s.results,result];fileTaskStore.set({submitted:true,running:false,results});localStorage.setItem(resultsKey,JSON.stringify(results));
}

export function exportFileResults(){
 const blob=new Blob([JSON.stringify(fileTaskStore.get().results,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download='file-studies-results.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
