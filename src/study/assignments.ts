import {createStore} from '../system/createStore';
import {studyTasks,type StudyTaskId} from './tasks';
import {STUDY_TASKS,type StudyTaskId as FileTaskId} from '../apps/data/studies';
import {studyInteractionModes,type StudyInteractionModeId} from './interactionModes';
import type {FileLayoutMode} from './workspaces';

export type AssignedPaperMode=StudyInteractionModeId|'standard';
export interface ParticipantAssignment{
 studentId:string;
 name:string;
 group:number;
 paper:Record<StudyTaskId,AssignedPaperMode>;
 files:Record<FileTaskId,FileLayoutMode>;
 createdAt:string;
}

const storageKey='aquawindow.experiment.assignments.v1';
const eligibilityKey='aquawindow.experiment.eligibility.v1';
export const paperTaskIds=Object.keys(studyTasks) as StudyTaskId[];
export const fileTaskIds=STUDY_TASKS.map(task=>task.id);
export const paperModeOptions=[{id:'standard' as const,label:'普通窗口'},...studyInteractionModes];
const fileModeOptions=['parallel','primary-secondary'] as const;
export type Eligibility={paper:Record<StudyTaskId,AssignedPaperMode[]>;files:Record<FileTaskId,FileLayoutMode[]>};
function loadEligibility():Eligibility{
 let saved:Partial<Eligibility>={};try{saved=JSON.parse(localStorage.getItem(eligibilityKey)??'{}')}catch{/* Use all available forms. */}
 const paper=Object.fromEntries(paperTaskIds.map(task=>[task,(saved.paper?.[task]??[]).filter(mode=>paperModeOptions.some(option=>option.id===mode))])) as Eligibility['paper'];
 const files=Object.fromEntries(fileTaskIds.map(task=>[task,(saved.files?.[task]??[]).filter(mode=>fileModeOptions.includes(mode))])) as Eligibility['files'];
 for(const task of paperTaskIds)if(!paper[task].length)paper[task]=paperModeOptions.map(option=>option.id);
 for(const task of fileTaskIds)if(!files[task].length)files[task]=[...fileModeOptions];
 return {paper,files};
}

function loadAssignments():ParticipantAssignment[]{
 try{
  const value=JSON.parse(localStorage.getItem(storageKey)??'[]');
  return Array.isArray(value)?value.filter(item=>item&&typeof item.studentId==='string'&&item.paper&&item.files).map((item:ParticipantAssignment)=>({
   ...item,
   paper:Object.fromEntries(paperTaskIds.map((task,index)=>[task,paperModeOptions.some(option=>option.id===item.paper[task])?item.paper[task]:paperModeOptions[(item.group-1+index)%paperModeOptions.length].id])) as ParticipantAssignment['paper'],
   files:Object.fromEntries(fileTaskIds.map((task,index)=>[task,fileModeOptions.includes(item.files[task])?item.files[task]:fileModeOptions[(item.group-1+index)%fileModeOptions.length]])) as ParticipantAssignment['files'],
  })):[];
 }catch{return []}
}
export const assignmentStore=createStore({participants:loadAssignments(),eligibility:loadEligibility()});
function save(participants:ParticipantAssignment[]){assignmentStore.set({participants});localStorage.setItem(storageKey,JSON.stringify(participants));}
function saveEligibility(eligibility:Eligibility){assignmentStore.set({eligibility});localStorage.setItem(eligibilityKey,JSON.stringify(eligibility));}
const rotation=(group:number,taskIndex:number,count:number)=>(group-1+taskIndex)%count;
export function setPaperEligibility(task:StudyTaskId,mode:AssignedPaperMode,checked:boolean,lockedIds:Set<string>){
 const state=assignmentStore.get(),current=state.eligibility.paper[task],next=checked?paperModeOptions.map(option=>option.id).filter(id=>id===mode||current.includes(id)):current.filter(id=>id!==mode);
 if(!next.length||!checked&&state.participants.some(person=>lockedIds.has(person.studentId)&&person.paper[task]===mode))return false;
 saveEligibility({...state.eligibility,paper:{...state.eligibility.paper,[task]:next}});
 save(state.participants.map(person=>!lockedIds.has(person.studentId)&&!next.includes(person.paper[task])?{...person,paper:{...person.paper,[task]:next[rotation(person.group,paperTaskIds.indexOf(task),next.length)]}}:person));
 return true;
}
export function setFileEligibility(task:FileTaskId,mode:FileLayoutMode,checked:boolean,lockedIds:Set<string>){
 const state=assignmentStore.get(),current=state.eligibility.files[task],next=checked?fileModeOptions.filter(id=>id===mode||current.includes(id)):current.filter(id=>id!==mode);
 if(!next.length||!checked&&state.participants.some(person=>lockedIds.has(person.studentId)&&person.files[task]===mode))return false;
 saveEligibility({...state.eligibility,files:{...state.eligibility.files,[task]:next}});
 save(state.participants.map(person=>!lockedIds.has(person.studentId)&&!next.includes(person.files[task])?{...person,files:{...person.files,[task]:next[rotation(person.group,fileTaskIds.indexOf(task),next.length)]}}:person));
 return true;
}
export function rebuildAssignments(locked:(studentId:string,environment:'paper'|'files',task:string)=>boolean){
 const {participants,eligibility}=assignmentStore.get();
 save(participants.map(person=>{
  const paper={...person.paper},files={...person.files};
  for(const [index,task] of paperTaskIds.entries())if(!locked(person.studentId,'paper',task)){const choices=eligibility.paper[task];paper[task]=choices[rotation(person.group,index,choices.length)];}
  for(const [index,task] of fileTaskIds.entries())if(!locked(person.studentId,'files',task)){const choices=eligibility.files[task];files[task]=choices[rotation(person.group,index,choices.length)];}
  return {...person,paper,files};
 }));
}
export function assignmentFor(studentId:string){return assignmentStore.get().participants.find(item=>item.studentId===studentId.trim());}
export function ensureAssignment(studentId:string,name=''){
 const id=studentId.trim();if(!id)return null;
 const existing=assignmentFor(id);
 if(existing){
  if(name.trim()&&name.trim()!==existing.name)save(assignmentStore.get().participants.map(item=>item.studentId===id?{...item,name:name.trim()}:item));
  return assignmentFor(id)!;
 }
 const participants=assignmentStore.get().participants,group=participants.length%paperModeOptions.length;
 const eligibility=assignmentStore.get().eligibility;
 const paper=Object.fromEntries(paperTaskIds.map((task,index)=>{const choices=eligibility.paper[task];return [task,choices[rotation(group+1,index,choices.length)]]})) as Record<StudyTaskId,AssignedPaperMode>;
 const files=Object.fromEntries(fileTaskIds.map((task,index)=>{const choices=eligibility.files[task];return [task,choices[rotation(group+1,index,choices.length)]]})) as Record<FileTaskId,FileLayoutMode>;
 const assignment={studentId:id,name:name.trim(),group:group+1,paper,files,createdAt:new Date().toISOString()};
 save([...participants,assignment]);return assignment;
}
export function setPaperAssignment(studentId:string,task:StudyTaskId,mode:AssignedPaperMode){
 if(!assignmentStore.get().eligibility.paper[task].includes(mode))return;
 save(assignmentStore.get().participants.map(item=>item.studentId===studentId?{...item,paper:{...item.paper,[task]:mode}}:item));
}
export function setFileAssignment(studentId:string,task:FileTaskId,mode:FileLayoutMode){
 if(!assignmentStore.get().eligibility.files[task].includes(mode))return;
 save(assignmentStore.get().participants.map(item=>item.studentId===studentId?{...item,files:{...item.files,[task]:mode}}:item));
}
