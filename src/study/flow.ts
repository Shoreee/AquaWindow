import {createStore} from '../system/createStore';
import {kernel} from '../system/kernel';
import {studyTasks,switchStudyTask,type StudyTaskId} from './tasks';
import {fileTasks,fileTaskStore,openFileTask,selectFileLayoutMode,switchStudyEnvironment,type StudyEnvironment} from './workspaces';
import {selectStudyMode} from './conditions';
import {ui} from '../system/ui';
import {log,logStore} from './logger';
import {onboarding,canEnterExperiment,learningHistory} from './onboarding';
import {assignmentFor,assignmentStore,ensureAssignment,paperSequence,paperSetIndex} from './assignments';
import {paperQuestionSet,paperTaskReady,questionsPerSet} from './paperQuestions';
export const paperLevels=Object.keys(studyTasks) as StudyTaskId[];
export type ExperimentRecord={participant:string;environment:StudyEnvironment;stage:number;task:string;technique:string|null;seconds:number;selfReported:boolean;events:unknown[];questionSet?:number;questionIndex?:number;prompt?:string;response?:string};
const recordsKey='aquawindow.experiment.records.v1';
function savedRecords():ExperimentRecord[]{try{const value=JSON.parse(localStorage.getItem(recordsKey)??'[]');return Array.isArray(value)?value:[]}catch{return []}}
export const experimentFlow=createStore({view:'hub' as 'hub'|'level'|'complete',levels:{paper:0,files:0},paperRound:0,paperItem:0,stageRunning:false,startedAt:0,logStart:0,records:savedRecords()});
function participantGroup(){return onboarding.get().testMode?1:(assignmentFor(onboarding.get().studentId)??ensureAssignment(onboarding.get().studentId,onboarding.get().name))?.group??1;}
export function currentPaperCondition(){
 const state=experimentFlow.get(),task=paperLevels[state.levels.paper],group=participantGroup();
 if(!task)return null;
 const order=paperSequence(task,group),mode=order[state.paperRound];
 if(!mode)return null;
 return {task,mode,order,round:state.paperRound,item:state.paperItem,setIndex:paperSetIndex(task,mode,group),prompt:paperQuestionSet(task,paperSetIndex(task,mode,group))[state.paperItem]};
}
export function activateParticipant(studentId:string){
 const records=experimentFlow.get().records.filter(record=>record.participant===studentId);
 const group=onboarding.get().testMode?1:(assignmentFor(studentId)??ensureAssignment(studentId,onboarding.get().name))?.group??1;
 let paper=paperLevels.length,paperRound=0,paperItem=0;
 outer:for(const [taskIndex,task] of paperLevels.entries())for(const [round,mode] of paperSequence(task,group).entries())for(let item=0;item<questionsPerSet;item++){
  if(!records.some(record=>record.environment==='paper'&&record.task===task&&record.technique===mode&&record.questionIndex===item&&record.questionSet===paperSetIndex(task,mode,group))){paper=taskIndex;paperRound=round;paperItem=item;break outer;}
 }
 const files=new Set(records.filter(record=>record.environment==='files'&&fileTasks.some(task=>task.id===record.task)).map(record=>record.task)).size;
 experimentFlow.set({view:'hub',levels:{paper,files},paperRound,paperItem,stageRunning:false});
}
function applyAssignedMode(environment:StudyEnvironment,index:number){
 if(environment==='paper'){const mode=paperSequence(paperLevels[index],participantGroup())[experimentFlow.get().paperRound];selectStudyMode(mode==='standard'?null:mode);return;}
 if(onboarding.get().testMode){const choices=assignmentStore.get().eligibility.files[fileTasks[index].id];selectFileLayoutMode(choices[index%choices.length]);return;}
 const assignment=assignmentFor(onboarding.get().studentId)??ensureAssignment(onboarding.get().studentId,onboarding.get().name);
 if(assignment)selectFileLayoutMode(assignment.files[fileTasks[index].id]);
}
export function chooseExperiment(environment:StudyEnvironment){
 if(!canEnterExperiment())return;
 const flow=experimentFlow.get();
 if(environment===ui.get().studyEnvironment&&(flow.stageRunning||environment==='files'&&(fileTaskStore.get().running||fileTaskStore.get().submitted))){experimentFlow.set({view:'level'});return;}
 selectStudyMode(null);switchStudyEnvironment(environment);
 let index=experimentFlow.get().levels[environment];const count=environment==='paper'?paperLevels.length:fileTasks.length;
 if(index>=count&&onboarding.get().testMode){index=0;experimentFlow.set({levels:{...experimentFlow.get().levels,[environment]:0},paperRound:0,paperItem:0});}
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
 if(environment==='paper'){switchStudyTask(paperLevels[index]);experimentFlow.set({paperRound:0,paperItem:0});}else openFileTask(fileTasks[index].id);
 applyAssignedMode(environment,index);
 experimentFlow.set({view:'level',levels:{...experimentFlow.get().levels,[environment]:index},stageRunning:false,startedAt:performance.now(),logStart:logStore.get().records.length});
 if(kernel.get('experiment'))kernel.restore('experiment');
}
export function beginPaperLevel(){
 if(!canEnterExperiment())return;
 const condition=currentPaperCondition();if(!condition)return;
 if(!onboarding.get().testMode&&!paperTaskReady(condition.task,condition.order.length))return;
 experimentFlow.set({stageRunning:true,startedAt:performance.now(),logStart:logStore.get().records.length});
 log({src:'study',type:'question.start',data:{task:condition.task,technique:condition.mode,questionSet:condition.setIndex,questionIndex:condition.item}});
}
export function finishPaperQuestion(response=''){
 if(!canEnterExperiment())return;
 const state=experimentFlow.get(),condition=currentPaperCondition();
 if(ui.get().studyEnvironment!=='paper'||state.view!=='level'||!state.stageRunning||!condition)return;
 if(!onboarding.get().testMode&&!paperTaskReady(condition.task,condition.order.length))return;
 const record:ExperimentRecord={participant:onboarding.get().studentId,environment:'paper',stage:state.levels.paper+1,task:condition.task,technique:condition.mode,questionSet:condition.setIndex,questionIndex:condition.item,prompt:condition.prompt,response:response.trim(),seconds:+((performance.now()-state.startedAt)/1000).toFixed(2),selfReported:true,events:logStore.get().records.filter(event=>event.t>=state.startedAt)};
 const records=onboarding.get().testMode?state.records:[...state.records,record];
 if(!onboarding.get().testMode)localStorage.setItem(recordsKey,JSON.stringify(records));
 log({src:'study',type:'question.complete',data:{task:condition.task,technique:condition.mode,questionSet:condition.setIndex,questionIndex:condition.item,seconds:record.seconds}});
 if(condition.item+1<questionsPerSet){experimentFlow.set({records,paperItem:condition.item+1,startedAt:performance.now(),logStart:logStore.get().records.length});return;}
 for(const win of kernel.list())if(win.appId!=='experiment')kernel.close(win.id,'system');
 if(condition.round+1<condition.order.length){experimentFlow.set({records,paperRound:condition.round+1,paperItem:0,stageRunning:false,startedAt:performance.now(),logStart:logStore.get().records.length});applyAssignedMode('paper',state.levels.paper);return;}
 const next=state.levels.paper+1,view=next>=paperLevels.length?'complete':'level';
 experimentFlow.set({records,levels:{...state.levels,paper:next},paperRound:0,paperItem:0,stageRunning:false,view,startedAt:performance.now(),logStart:logStore.get().records.length});
 if(next<paperLevels.length){switchStudyTask(paperLevels[next]);applyAssignedMode('paper',next);}
}
export function finishLevel(selfReported=true){
 if(ui.get().studyEnvironment==='paper'){finishPaperQuestion();return;}
 if(!canEnterExperiment())return;
 const state=experimentFlow.get(),index=state.levels.files;
 if(state.view!=='level'||!fileTaskStore.get().submitted)return;
 const record:ExperimentRecord={participant:onboarding.get().studentId,environment:'files',stage:index+1,task:fileTaskStore.get().current,technique:fileTaskStore.get().mode,seconds:fileTaskStore.get().results.at(-1)?.seconds??0,selfReported,events:logStore.get().records.filter(event=>event.t>=state.startedAt)};
 const count=fileTasks.length,records=onboarding.get().testMode?state.records:[...state.records,record];
 experimentFlow.set({stageRunning:false,records,levels:{...state.levels,files:index+1},view:index+1>=count?'complete':'level',startedAt:performance.now(),logStart:logStore.get().records.length});
 if(!onboarding.get().testMode)localStorage.setItem(recordsKey,JSON.stringify(records));
 log({src:'study',type:'stage.complete',data:{...record,events:record.events.length}});
 if(index+1<count){openFileTask(fileTasks[index+1].id);applyAssignedMode('files',index+1);}
}
export function exportExperiment(){
 const enrollment=onboarding.get();
 const payload={version:4,participant:enrollment.studentId,participantInfo:{name:enrollment.name,studentId:enrollment.studentId},assignment:assignmentFor(enrollment.studentId),eligibility:assignmentStore.get().eligibility,learningResults:learningHistory.get().byParticipant[enrollment.studentId]??enrollment.records,learningSkip:learningHistory.get().skips[enrollment.studentId]??null,stages:experimentFlow.get().records.filter(record=>record.participant===enrollment.studentId),fileResults:fileTaskStore.get().results.filter(result=>result.participant===enrollment.studentId)};
 const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'})),link=document.createElement('a');
 link.href=url;link.download='aquawindow-experiment.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
