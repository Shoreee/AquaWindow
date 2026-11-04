import {createStore} from '../system/createStore';
import {kernel} from '../system/kernel';
import {studyTasks,studyTaskStore,switchStudyTask,type StudyTaskId} from './tasks';
import {fileTasks,fileTaskStore,openFileTask,selectFileLayoutMode,switchStudyEnvironment,type StudyEnvironment} from './workspaces';
import {selectStudyMode} from './conditions';
import {ui} from '../system/ui';
import {log,logStore} from './logger';
import {onboarding,canEnterExperiment,learningHistory} from './onboarding';
import {assignmentFor,assignmentStore,ensureAssignment} from './assignments';
export const paperLevels=Object.keys(studyTasks) as StudyTaskId[];
export type ExperimentRecord={participant:string;environment:StudyEnvironment;stage:number;task:string;technique:string|null;seconds:number;selfReported:boolean;events:unknown[]};
const recordsKey='aquawindow.experiment.records.v1';
function savedRecords():ExperimentRecord[]{try{const value=JSON.parse(localStorage.getItem(recordsKey)??'[]');return Array.isArray(value)?value:[]}catch{return []}}
export const experimentFlow=createStore({view:'hub' as 'hub'|'level'|'complete',levels:{paper:0,files:0},stageRunning:false,startedAt:0,logStart:0,records:savedRecords()});
export function activateParticipant(studentId:string){
 const records=experimentFlow.get().records.filter(record=>record.participant===studentId);
 const count=(environment:StudyEnvironment)=>new Set(records.filter(record=>record.environment===environment&&(environment==='paper'?paperLevels.includes(record.task as StudyTaskId):fileTasks.some(task=>task.id===record.task))).map(record=>record.task)).size;
 experimentFlow.set({view:'hub',levels:{paper:count('paper'),files:count('files')},stageRunning:false});
}
function applyAssignedMode(environment:StudyEnvironment,index:number){
 if(onboarding.get().testMode){
  const eligible=assignmentStore.get().eligibility;
  if(environment==='paper'){const choices=eligible.paper[paperLevels[index]],mode=choices[index%choices.length];selectStudyMode(mode==='standard'?null:mode);}
  else {const choices=eligible.files[fileTasks[index].id];selectFileLayoutMode(choices[index%choices.length]);}
  return;
 }
 const assignment=assignmentFor(onboarding.get().studentId)??ensureAssignment(onboarding.get().studentId,onboarding.get().name);
 if(!assignment)return;
 if(environment==='paper'){const mode=assignment.paper[paperLevels[index]];selectStudyMode(mode==='standard'?null:mode);}
 else selectFileLayoutMode(assignment.files[fileTasks[index].id]);
}
export function chooseExperiment(environment:StudyEnvironment){
 if(!canEnterExperiment())return;
 const flow=experimentFlow.get();
 if(environment===ui.get().studyEnvironment&&(flow.stageRunning||environment==='files'&&(fileTaskStore.get().running||fileTaskStore.get().submitted))){experimentFlow.set({view:'level'});return;}
 selectStudyMode(null);switchStudyEnvironment(environment);
 let index=experimentFlow.get().levels[environment];const count=environment==='paper'?paperLevels.length:fileTasks.length;
 if(index>=count&&onboarding.get().testMode){index=0;experimentFlow.set({levels:{...experimentFlow.get().levels,[environment]:0}});}
 if(index>=count){experimentFlow.set({view:'complete'});return;}
 if(environment==='paper')switchStudyTask(paperLevels[index]);
 else if(fileTaskStore.get().current!==fileTasks[index].id||!fileTaskStore.get().running)openFileTask(fileTasks[index].id);
 applyAssignedMode(environment,index);
 experimentFlow.set({view:'level',stageRunning:false,startedAt:performance.now(),logStart:logStore.get().records.length});
 log({src:'study',type:'stage.enter',data:{environment,stage:index+1}});
}
export function jumpToTask(environment:StudyEnvironment,index:number){
 if(!onboarding.get().testMode||!canEnterExperiment()||environment!==ui.get().studyEnvironment)return;
 const count=environment==='paper'?paperLevels.length:fileTasks.length;if(!Number.isInteger(index)||index<0||index>=count)return;
 if(environment==='paper')switchStudyTask(paperLevels[index]);else openFileTask(fileTasks[index].id);
 applyAssignedMode(environment,index);
 experimentFlow.set({view:'level',levels:{...experimentFlow.get().levels,[environment]:index},stageRunning:false,startedAt:performance.now(),logStart:logStore.get().records.length});
 if(kernel.get('experiment'))kernel.restore('experiment');
}
export function beginPaperLevel(){
 if(!canEnterExperiment())return;
 experimentFlow.set({stageRunning:true,startedAt:performance.now(),logStart:logStore.get().records.length});
 log({src:'study',type:'stage.start',data:{environment:'paper',task:studyTaskStore.get().current,technique:ui.get().studyMode}});
}
export function finishLevel(selfReported=true){
 if(!canEnterExperiment())return;
 const state=experimentFlow.get(),environment=ui.get().studyEnvironment,index=state.levels[environment];
 if(state.view!=='level'||(environment==='paper'?!state.stageRunning:!fileTaskStore.get().submitted))return;
 const record:ExperimentRecord={participant:onboarding.get().studentId,environment,stage:index+1,task:environment==='paper'?studyTaskStore.get().current:fileTaskStore.get().current,technique:environment==='paper'?(ui.get().studyMode??'standard'):fileTaskStore.get().mode,seconds:environment==='files'?(fileTaskStore.get().results.at(-1)?.seconds??0):+((performance.now()-state.startedAt)/1000).toFixed(2),selfReported,events:logStore.get().records.filter(event=>event.t>=state.startedAt)};
 const count=environment==='paper'?paperLevels.length:fileTasks.length;
 const records=onboarding.get().testMode?state.records:[...state.records,record];experimentFlow.set({stageRunning:false,records,levels:{...state.levels,[environment]:index+1},view:index+1>=count?'complete':'level',startedAt:performance.now(),logStart:logStore.get().records.length});
 if(!onboarding.get().testMode)localStorage.setItem(recordsKey,JSON.stringify(records));
 log({src:'study',type:'stage.complete',data:{...record,events:record.events.length}});
 if(index+1<count){if(environment==='paper')switchStudyTask(paperLevels[index+1]);else openFileTask(fileTasks[index+1].id);applyAssignedMode(environment,index+1);}
}
export function exportExperiment(){
 const enrollment=onboarding.get();
 const payload={version:3,participant:enrollment.studentId,participantInfo:{name:enrollment.name,studentId:enrollment.studentId},assignment:assignmentFor(enrollment.studentId),learningResults:learningHistory.get().byParticipant[enrollment.studentId]??enrollment.records,learningSkip:learningHistory.get().skips[enrollment.studentId]??null,stages:experimentFlow.get().records.filter(record=>record.participant===enrollment.studentId),fileResults:fileTaskStore.get().results.filter(result=>result.participant===enrollment.studentId)};
 const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'})),link=document.createElement('a');
 link.href=url;link.download='aquawindow-experiment.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
