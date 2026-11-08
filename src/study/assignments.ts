import {createStore} from '../system/createStore';
import {studyTasks,type StudyTaskId} from './tasks';
import {STUDY_TASKS,type StudyTaskId as FileTaskId} from '../apps/data/studies';
import {studyInteractionModes,type StudyInteractionModeId} from './interactionModes';
import type {FileLayoutMode} from './workspaces';

export type AssignedPaperMode=StudyInteractionModeId|'standard';
export interface ParticipantAssignment{
 slotId:string;
 studentId:string;
 name:string;
 pending:boolean;
 group:number;
 paper:Record<StudyTaskId,AssignedPaperMode>;
 files:Record<FileTaskId,FileLayoutMode>;
 createdAt:string;
}

const storageKey='aquawindow.experiment.assignments.v1';
const eligibilityKey='aquawindow.experiment.eligibility.v1';
export const paperTaskIds=Object.keys(studyTasks) as StudyTaskId[];
export const fileTaskIds=STUDY_TASKS.map(task=>task.id);
export const plannedParticipantCount=paperTaskIds.length+fileTaskIds.length;
export const paperModeOptions=[{id:'standard' as const,label:'普通窗口'},...studyInteractionModes];
const fileModeOptions=['parallel','primary-secondary'] as const;
export type Eligibility={paper:Record<StudyTaskId,AssignedPaperMode[]>;files:Record<FileTaskId,FileLayoutMode[]>};
const rotation=(group:number,taskIndex:number,count:number)=>(group-1+taskIndex)%count;
export function paperSequence(task:StudyTaskId,group:number):AssignedPaperMode[]{
 const choices=assignmentStore.get().eligibility.paper[task];
 const start=rotation(group,paperTaskIds.indexOf(task),choices.length);
 return choices.map((_,index)=>choices[(start+index)%choices.length]);
}
export function paperSetIndex(task:StudyTaskId,mode:AssignedPaperMode,group:number):number{
 const choices=assignmentStore.get().eligibility.paper[task];
 return (choices.indexOf(mode)+group-1+choices.length)%choices.length;
}
function loadEligibility():Eligibility{
 let saved:Partial<Eligibility>={};try{saved=JSON.parse(localStorage.getItem(eligibilityKey)??'{}')}catch{/* Use all available forms. */}
 const paper=Object.fromEntries(paperTaskIds.map(task=>[task,(saved.paper?.[task]??[]).filter(mode=>paperModeOptions.some(option=>option.id===mode))])) as Eligibility['paper'];
 const files=Object.fromEntries(fileTaskIds.map(task=>[task,(saved.files?.[task]??[]).filter(mode=>fileModeOptions.includes(mode))])) as Eligibility['files'];
 for(const task of paperTaskIds)if(!paper[task].length)paper[task]=paperModeOptions.map(option=>option.id);
 for(const task of fileTaskIds)if(!files[task].length)files[task]=[...fileModeOptions];
 return {paper,files};
}

function assignmentForGroup(group:number,eligibility:Eligibility){
 const paper=Object.fromEntries(paperTaskIds.map((task,index)=>{const choices=eligibility.paper[task];return [task,choices[rotation(group,index,choices.length)]]})) as ParticipantAssignment['paper'];
 const files=Object.fromEntries(fileTaskIds.map((task,index)=>{const choices=eligibility.files[task];return [task,choices[rotation(group,index,choices.length)]]})) as ParticipantAssignment['files'];
 return {paper,files};
}
function makePendingSlot(group:number,eligibility:Eligibility):ParticipantAssignment{
 return {slotId:`slot-${group}`,studentId:'',name:'',pending:true,group,...assignmentForGroup(group,eligibility),createdAt:new Date().toISOString()};
}
function loadAssignments(eligibility:Eligibility):ParticipantAssignment[]{
 try{
  const value=JSON.parse(localStorage.getItem(storageKey)??'[]');
  const participants:ParticipantAssignment[]=Array.isArray(value)?value.filter(item=>item&&typeof item.studentId==='string'&&item.paper&&item.files).map((item:ParticipantAssignment,index:number)=>{
   const group=Number.isInteger(item.group)&&item.group>0?item.group:index+1;
   return {...item,slotId:item.slotId||`slot-${index+1}`,pending:item.pending===true||!item.studentId.trim(),group,
    paper:Object.fromEntries(paperTaskIds.map((task,taskIndex)=>[task,paperModeOptions.some(option=>option.id===item.paper[task])?item.paper[task]:paperModeOptions[rotation(group,taskIndex,paperModeOptions.length)].id])) as ParticipantAssignment['paper'],
    files:Object.fromEntries(fileTaskIds.map((task,taskIndex)=>[task,fileModeOptions.includes(item.files[task])?item.files[task]:fileModeOptions[rotation(group,taskIndex,fileModeOptions.length)]])) as ParticipantAssignment['files']};
  }):[];
  while(participants.length>plannedParticipantCount){
   const pendingIndex=participants.findLastIndex(person=>person.pending);
   if(pendingIndex<0)break;
   participants.splice(pendingIndex,1);
  }
  while(participants.length<plannedParticipantCount)participants.push(makePendingSlot(participants.length+1,eligibility));
  localStorage.setItem(storageKey,JSON.stringify(participants));
  return participants;
 }catch{return Array.from({length:plannedParticipantCount},(_,index)=>makePendingSlot(index+1,eligibility))}
}
const initialEligibility=loadEligibility();
export const assignmentStore=createStore({participants:loadAssignments(initialEligibility),eligibility:initialEligibility});
function save(participants:ParticipantAssignment[]){assignmentStore.set({participants});localStorage.setItem(storageKey,JSON.stringify(participants));}
function saveEligibility(eligibility:Eligibility){assignmentStore.set({eligibility});localStorage.setItem(eligibilityKey,JSON.stringify(eligibility));}
export function setPaperEligibility(task:StudyTaskId,mode:AssignedPaperMode,checked:boolean,lockedIds:Set<string>){
 const state=assignmentStore.get(),current=state.eligibility.paper[task],next=checked?paperModeOptions.map(option=>option.id).filter(id=>id===mode||current.includes(id)):current.filter(id=>id!==mode);
 if(!next.length||!checked&&state.participants.some(person=>lockedIds.has(person.studentId)&&person.paper[task]===mode))return false;
 saveEligibility({...state.eligibility,paper:{...state.eligibility.paper,[task]:next}});
 save(state.participants.map(person=>!lockedIds.has(person.studentId)?{...person,paper:{...person.paper,[task]:next[rotation(person.group,paperTaskIds.indexOf(task),next.length)]}}:person));
 return true;
}
export function setFileEligibility(task:FileTaskId,mode:FileLayoutMode,checked:boolean,lockedIds:Set<string>){
 const state=assignmentStore.get(),current=state.eligibility.files[task],next=checked?fileModeOptions.filter(id=>id===mode||current.includes(id)):current.filter(id=>id!==mode);
 if(!next.length||!checked&&state.participants.some(person=>lockedIds.has(person.studentId)&&person.files[task]===mode))return false;
 saveEligibility({...state.eligibility,files:{...state.eligibility.files,[task]:next}});
 save(state.participants.map(person=>!lockedIds.has(person.studentId)?{...person,files:{...person.files,[task]:next[rotation(person.group,fileTaskIds.indexOf(task),next.length)]}}:person));
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
export function assignmentFor(studentId:string){const id=studentId.trim();return id?assignmentStore.get().participants.find(item=>!item.pending&&item.studentId===id):undefined;}
export function ensureAssignment(studentId:string,name=''){
 const id=studentId.trim();if(!id)return null;
 const existing=assignmentFor(id);
 if(existing){
  if(name.trim()&&name.trim()!==existing.name)save(assignmentStore.get().participants.map(item=>item.studentId===id?{...item,name:name.trim()}:item));
  return assignmentFor(id)!;
 }
 const participants=assignmentStore.get().participants;
 const pending=participants.find(item=>item.pending);
 if(pending){save(participants.map(item=>item.slotId===pending.slotId?{...item,studentId:id,name:name.trim(),pending:false}:item));return assignmentFor(id)!;}
 const group=Math.max(0,...participants.map(item=>item.group))+1;
 const eligibility=assignmentStore.get().eligibility;
 const assignment:ParticipantAssignment={slotId:`slot-${group}`,studentId:id,name:name.trim(),pending:false,group,...assignmentForGroup(group,eligibility),createdAt:new Date().toISOString()};
 save([...participants,assignment]);return assignment;
}
export function setPaperAssignment(slotId:string,task:StudyTaskId,mode:AssignedPaperMode){
 if(!assignmentStore.get().eligibility.paper[task].includes(mode))return;
 save(assignmentStore.get().participants.map(item=>item.slotId===slotId?{...item,paper:{...item.paper,[task]:mode}}:item));
}
export function setFileAssignment(slotId:string,task:FileTaskId,mode:FileLayoutMode){
 if(!assignmentStore.get().eligibility.files[task].includes(mode))return;
 save(assignmentStore.get().participants.map(item=>item.slotId===slotId?{...item,files:{...item.files,[task]:mode}}:item));
}
