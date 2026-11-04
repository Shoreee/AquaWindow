import {createStore} from '../system/createStore';
import {kernel,workArea} from '../system/kernel';
import {ui} from '../system/ui';
import {fileTaskStore,switchStudyEnvironment} from './workspaces';
import {selectStudyMode} from './conditions';
import {logStore} from './logger';
import {galleryStore} from './gallery';
import {ensureAssignment} from './assignments';
import {TEST_PARTICIPANT_ID} from './testMode';
import {dockParent} from '../agent/adaptive/capsuleTree';
import type {StudyInteractionModeId} from './interactionModes';

export const learningQuestions:{mode:StudyInteractionModeId;prompt:string}[]=[
 {mode:'peel',prompt:'查看被上层材料遮住的四位数字，并填写答案。两扇窗口的位置保持不变。'},
 {mode:'fusion',prompt:'将两份材料连成一组，一起移动一段距离，再恢复成两个独立窗口。'},
 {mode:'reveal',prompt:'让参考卡片中的数字在被另一份材料覆盖时仍然可见，并填写数字。'},
 {mode:'capsule',prompt:'将练习论文收为胶囊，再把胶囊停靠在笔记窗口顶部。'},
 {mode:'screenshot',prompt:'截取论文第 3 页的模型架构图，让截图停靠在论文旁，并与论文连成一组。'},
 {mode:'figure-pin',prompt:'继续阅读到论文第 4 页，让第 3 页的模型架构图保持在阅读区顶部。'},
 {mode:'sync-scroll',prompt:'让两份论文左右融合并联动阅读，继续读到第 3 页。'},
];
export type LearningRecord={mode:StudyInteractionModeId;seconds:number;attempts:number;passedAt:string};
const learningKey='aquawindow.experiment.learning.v1';
const learningSkipKey='aquawindow.experiment.learning-skips.v1';
function savedLearning():Record<string,LearningRecord[]>{try{return JSON.parse(localStorage.getItem(learningKey)??'{}')}catch{return {}}}
function savedSkips():Record<string,{skippedAt:string;completedQuestions:number}>{try{return JSON.parse(localStorage.getItem(learningSkipKey)??'{}')}catch{return {}}}
export const learningHistory=createStore({byParticipant:savedLearning(),skips:savedSkips()});
export const onboarding=createStore({stage:'profile' as 'profile'|'practice'|'assessment'|'passed'|'ready',name:'',studentId:'',question:0,records:[] as LearningRecord[],masterySkipped:false,testMode:false});
export function registerParticipant(name:string,studentId:string){
 if(!name.trim()||!studentId.trim())return false;
 ensureAssignment(studentId,name);
 onboarding.set({name:name.trim(),studentId:studentId.trim(),stage:'practice',question:0,records:[],masterySkipped:false,testMode:false});
 fileTaskStore.set({participant:studentId.trim()});ui.set({participant:studentId.trim()});
 switchStudyEnvironment('paper');selectStudyMode(null);return true;
}
export function skipParticipantInfo(){
 onboarding.set({name:'测试模式',studentId:TEST_PARTICIPANT_ID,stage:'practice',question:0,records:[],masterySkipped:false,testMode:true});
 fileTaskStore.set({participant:TEST_PARTICIPANT_ID});ui.set({participant:TEST_PARTICIPANT_ID});
 switchStudyEnvironment('paper');selectStudyMode(null);
}
export const canEnterExperiment=()=>onboarding.get().stage==='ready'&&(onboarding.get().testMode||!!onboarding.get().name&&!!onboarding.get().studentId&&(onboarding.get().records.length===learningQuestions.length||onboarding.get().masterySkipped));
export function clearLearningWindows(){for(const win of kernel.list())if(win.appId!=='experiment')kernel.close(win.id,'system');}
let trial:{ids:string[];code:string;started:number;attempts:number;groupOrigin:{x:number;y:number}|null;moved:boolean;capsule:boolean;origin:{x:number;y:number}[]}|null=null;
export function setupLearningQuestion(){
 clearLearningWindows();switchStudyEnvironment('paper');
 const question=learningQuestions[onboarding.get().question];selectStudyMode(question.mode);
 const area=workArea(),width=Math.max(260,Math.min(440,(area.w-430)/2)),height=Math.min(570,area.h-40);
 const code=String(Math.floor(1000+Math.random()*9000));
 const open=(title:string,x:number,props:Record<string,unknown>,appId='study')=>kernel.open({appId,title,rect:{x,y:area.y+24,w:width,h:height},props:{...props,learning:true}});
 let ids:string[]=[];
 if(question.mode==='peel'||question.mode==='reveal'){
  ids=[open('参考卡片',area.x+20,{code},'learning-card'),open('阅读材料',area.x+20,{code:'',cover:true},'learning-card')];
  if(question.mode==='reveal')kernel.setRect(ids[1],{x:area.x+width+36,y:area.y+24,w:width,h:height});
 }else{
  ids=[open('练习论文',area.x+12,{taskId:'comparison',resource:'pdf'})];
  if(question.mode==='fusion'||question.mode==='sync-scroll')ids.push(open('对照论文',area.x+width+28,{taskId:'bilingual',resource:'english-pdf'}));
  if(question.mode==='capsule')ids.push(open('笔记',area.x+width+28,{taskId:'comparison',resource:'notes'}));
 }
 trial={ids,code,started:performance.now(),attempts:0,groupOrigin:null,moved:false,capsule:false,origin:ids.map(id=>({...kernel.get(id)!.rect}))};
 if(question.mode==='screenshot'||question.mode==='figure-pin'){
  const id=ids[0];let attempts=0;
  const position=()=>{if(!trial?.ids.includes(id)||onboarding.get().stage!=='assessment')return;const root=document.querySelector<HTMLElement>(`[data-win="${id}"] .study-pdf-scroll`),page=root?.querySelector<HTMLElement>('[data-page="3"]');if(root&&page){root.scrollTop=page.offsetTop;return;}if(attempts++<100)setTimeout(position,100);};position();
 }
 if(kernel.get('experiment'))kernel.focus('experiment');
}
export function startLearningTest(){onboarding.set({stage:'assessment'});setupLearningQuestion();}
export function skipLearningTest(){
 const state=onboarding.get();if(state.stage!=='assessment'||!state.studentId)return;
 clearLearningWindows();selectStudyMode(null);trial=null;
 if(!state.testMode){const skips={...learningHistory.get().skips,[state.studentId]:{skippedAt:new Date().toISOString(),completedQuestions:state.records.length}};learningHistory.set({skips});localStorage.setItem(learningSkipKey,JSON.stringify(skips));}
 onboarding.set({stage:'ready',masterySkipped:true});
}
export function sampleLearning(){
 if(!trial||onboarding.get().stage!=='assessment'||!ui.get().experimentOpen)return;
 const [a,b]=trial.ids.map(id=>kernel.get(id));if(!a)return;
 if(a.form==='capsule')trial.capsule=true;
 if(a.group&&a.group===b?.group&&!a.props.surfaceAnimating&&!b.props.surfaceAnimating){
  if(!trial.groupOrigin)trial.groupOrigin={...a.rect};
  else if(Math.hypot(a.rect.x-trial.groupOrigin.x,a.rect.y-trial.groupOrigin.y)>35)trial.moved=true;
 }
}
export function submitLearning(answer:string){
 if(!trial||onboarding.get().stage!=='assessment')return false;
 sampleLearning();trial.attempts++;
 const [a,b]=trial.ids.map(id=>kernel.get(id)),q=learningQuestions[onboarding.get().question];
 const root=(id:string)=>document.querySelector<HTMLElement>(`[data-win="${id}"]`);
 let success=false;
 if(q.mode==='peel'&&a&&b){
  const peeled=logStore.get().records.some(r=>r.type==='peel'&&r.windowId===b.id&&r.t>=trial!.started);
  success=peeled&&answer.trim()===trial.code&&[a,b].every((w,i)=>Math.hypot(w.rect.x-trial!.origin[i].x,w.rect.y-trial!.origin[i].y)<3);
 }
 if(q.mode==='fusion')success=trial.moved&&!!a&&!!b&&!a.group&&!b.group;
 if(q.mode==='reveal'&&a&&b){
  const content=root(a.id)?.querySelector('.aw-content')?.getBoundingClientRect(),codeBox=root(a.id)?.querySelector('.learning-card-code strong')?.getBoundingClientRect();
  const covered=!!codeBox&&b.rect.x<codeBox.left&&b.rect.y<codeBox.top&&b.rect.x+b.rect.w>codeBox.right&&b.rect.y+b.rect.h>codeBox.bottom;
  const marked=!!content&&!!codeBox&&a.importance.some(r=>r.kind!=='hole'&&content.left+r.x*content.width<=codeBox.left&&content.top+r.y*content.height<=codeBox.top&&content.left+(r.x+r.w)*content.width>=codeBox.right&&content.top+(r.y+r.h)*content.height>=codeBox.bottom);
  success=answer.trim()===trial.code&&covered&&marked&&!!root(b.id)?.querySelector('.cut-rim');
 }
 if(q.mode==='capsule')success=trial.capsule&&a?.form==='capsule'&&!a.minimized&&!a.props.agentCapsuleBusy&&!!b&&b.form==='normal'&&dockParent(a)===b.id;
 if(q.mode==='screenshot'&&a&&!a.props.surfaceAnimating)success=galleryStore.get().items.some(item=>item.sourceId===a.id&&kernel.list().some(w=>w.props.captureId===item.id&&!!a.group&&w.group===a.group&&!w.props.surfaceAnimating));
 if(q.mode==='figure-pin'&&a){const reader=root(a.id),scroll=reader?.querySelector<HTMLElement>('.study-pdf-scroll'),page=scroll?.querySelector<HTMLElement>('[data-page="4"]'),pin=reader?.querySelector<HTMLElement>('.study-pdf-pin-anchor');success=!!scroll&&!!page&&scroll.scrollTop>=page.offsetTop&&!!pin&&getComputedStyle(pin).visibility==='visible';}
 if(q.mode==='sync-scroll'&&a&&b&&a.group&&a.group===b.group){
  const pair=[a,b].sort((x,y)=>x.rect.x-y.rect.x),positions=pair.map(w=>{const scroll=root(w.id)?.querySelector<HTMLElement>('.study-pdf-scroll'),page=scroll?.querySelector<HTMLElement>('[data-page="3"]');return scroll&&page?(scroll.scrollTop-page.offsetTop)/page.offsetHeight:-10;});
  success=positions[0]>=0&&Math.abs(positions[0]-positions[1])<.08&&logStore.get().records.some(r=>r.type==='pdf.sync-scroll'&&r.windowId===pair[0].id&&r.t>=trial!.started);
 }
 if(!success)return false;
 const state=onboarding.get(),records=[...state.records,{mode:q.mode,seconds:+((performance.now()-trial.started)/1000).toFixed(2),attempts:trial.attempts,passedAt:new Date().toISOString()}];
 onboarding.set({records,question:state.question+1});
 if(!state.testMode){const byParticipant={...learningHistory.get().byParticipant,[state.studentId]:records};learningHistory.set({byParticipant});localStorage.setItem(learningKey,JSON.stringify(byParticipant));}
 if(state.question+1===learningQuestions.length){clearLearningWindows();selectStudyMode(null);onboarding.set({stage:'passed'});trial=null;}else setupLearningQuestion();
 return true;
}
