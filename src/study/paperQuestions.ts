import {createStore} from '../system/createStore';
import {studyTasks,type StudyTaskId} from './tasks';

export const questionsPerSet=2;
export type PaperQuestionSet=[string,string];

type QuestionSets=Record<StudyTaskId,PaperQuestionSet[]>;
const storageKey='aquawindow.experiment.paper-questions.v1';
const blank=():PaperQuestionSet=>['',''];
function load():QuestionSets{
 let saved:Partial<QuestionSets>={};
 try{saved=JSON.parse(localStorage.getItem(storageKey)??'{}')}catch{/* Keep empty prompts. */}
 return Object.fromEntries((Object.keys(studyTasks) as StudyTaskId[]).map(task=>[task,Array.isArray(saved[task])?saved[task]!.map(set=>[String(set?.[0]??''),String(set?.[1]??'')] as PaperQuestionSet):[]])) as QuestionSets;
}
export const paperQuestionStore=createStore<{sets:QuestionSets}>({sets:load()});
export function paperQuestionSet(task:StudyTaskId,index:number):PaperQuestionSet{return paperQuestionStore.get().sets[task][index]??blank();}
export function paperQuestionSetReady(task:StudyTaskId,index:number){return paperQuestionSet(task,index).every(question=>question.trim().length>0);}
export function paperTaskReady(task:StudyTaskId,setCount:number){return Array.from({length:setCount},(_,index)=>paperQuestionSetReady(task,index)).every(Boolean);}
export function setPaperQuestion(task:StudyTaskId,setIndex:number,questionIndex:number,text:string){
 if(!Number.isInteger(setIndex)||setIndex<0||questionIndex<0||questionIndex>=questionsPerSet)return;
 const sets={...paperQuestionStore.get().sets},taskSets=[...sets[task]];
 taskSets[setIndex]=[...(taskSets[setIndex]??blank())] as PaperQuestionSet;
 taskSets[setIndex][questionIndex]=text;
 sets[task]=taskSets;paperQuestionStore.set({sets});localStorage.setItem(storageKey,JSON.stringify(sets));
}
