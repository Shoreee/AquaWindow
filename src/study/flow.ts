import {createStore} from '../system/createStore';
import {studyTasks,studyTaskStore,switchStudyTask,type StudyTaskId} from './tasks';
import {fileTasks,fileTaskStore,openFileTask,switchStudyEnvironment,type StudyEnvironment} from './workspaces';
import {selectStudyMode} from './conditions';
import {ui} from '../system/ui';
import {log,logStore} from './logger';
import {onboarding,canEnterExperiment} from './onboarding';
export const paperLevels=Object.keys(studyTasks) as StudyTaskId[];
export const experimentFlow=createStore({view:'hub' as 'hub'|'level'|'complete',levels:{paper:0,files:0},stageRunning:false,startedAt:0,logStart:0,records:[] as {participant:string;environment:StudyEnvironment;stage:number;task:string;technique:string|null;seconds:number;selfReported:boolean;events:unknown[]}[]});
export function chooseExperiment(environment:StudyEnvironment){
 if(!canEnterExperiment())return;
 const flow=experimentFlow.get();
 if(environment===ui.get().studyEnvironment&&(flow.stageRunning||environment==='files'&&(fileTaskStore.get().running||fileTaskStore.get().submitted))){experimentFlow.set({view:'level'});return;}
 selectStudyMode(null);switchStudyEnvironment(environment);
 const index=experimentFlow.get().levels[environment],count=environment==='paper'?paperLevels.length:fileTasks.length;
 if(index>=count){experimentFlow.set({view:'complete'});return;}
 if(environment==='paper')switchStudyTask(paperLevels[index]);
 else if(fileTaskStore.get().current!==fileTasks[index].id||!fileTaskStore.get().running)openFileTask(fileTasks[index].id);
 experimentFlow.set({view:'level',stageRunning:false,startedAt:performance.now(),logStart:logStore.get().records.length});
 log({src:'study',type:'stage.enter',data:{environment,stage:index+1}});
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
 const record={participant:fileTaskStore.get().participant,environment,stage:index+1,task:environment==='paper'?studyTaskStore.get().current:fileTaskStore.get().current,technique:environment==='paper'?ui.get().studyMode:fileTaskStore.get().mode,seconds:environment==='files'?(fileTaskStore.get().results.at(-1)?.seconds??0):+((performance.now()-state.startedAt)/1000).toFixed(2),selfReported,events:logStore.get().records.filter(event=>event.t>=state.startedAt)};
 const count=environment==='paper'?paperLevels.length:fileTasks.length;
 experimentFlow.set({stageRunning:false,records:[...state.records,record],levels:{...state.levels,[environment]:index+1},view:index+1>=count?'complete':'level',startedAt:performance.now(),logStart:logStore.get().records.length});
 log({src:'study',type:'stage.complete',data:{...record,events:record.events.length}});
 if(index+1<count){if(environment==='paper')switchStudyTask(paperLevels[index+1]);else openFileTask(fileTasks[index+1].id);}
}
export function exportExperiment(){
 const enrollment=onboarding.get();
 const payload={version:2,participant:fileTaskStore.get().participant,participantInfo:{name:enrollment.name,studentId:enrollment.studentId},learningResults:enrollment.records,stages:experimentFlow.get().records.filter(record=>record.participant===fileTaskStore.get().participant),fileResults:fileTaskStore.get().results.filter(result=>result.participant===fileTaskStore.get().participant)};
 const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'})),link=document.createElement('a');
 link.href=url;link.download='aquawindow-experiment.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
