import {createStore} from '../system/createStore';
import {studyTasks,type StudyTaskId} from './tasks';

export const questionsPerSet=2;
export type ChoiceLetter='A'|'B'|'C'|'D';
export type PaperChoiceQuestion={kind:'choice';prompt:string;options:[string,string,string,string];answer:ChoiceLetter};
export type PaperQuestion=string|PaperChoiceQuestion;
export type PaperQuestionSet=[PaperQuestion,PaperQuestion];

type QuestionSets=Record<StudyTaskId,PaperQuestionSet[]>;
const storageKey='aquawindow.experiment.paper-questions.v2';
const legacyKey='aquawindow.experiment.paper-questions.v1';
const blank=():PaperQuestionSet=>['',''];
const choice=(prompt:string,options:[string,string,string,string],answer:ChoiceLetter):PaperChoiceQuestion=>({kind:'choice',prompt,options,answer});

export const comparisonQuestionSets:PaperQuestionSet[]=[
 [
  choice('根据文字，解码器比编码器多出的注意力子层，在架构图中位于哪个模块的上方？',['Masked Multi-Head Attention','Feed Forward','Linear','Input Embedding'],'A'),
  choice('根据文字，负责防止模型提前获取后续位置信息的模块，在架构图中位于哪一侧？',['左侧编码器','右侧解码器','顶部输出层','两个部分都有'],'B'),
 ],
 [
  choice('根据文字，负责从多个表示空间关注信息的机制，在 Figure 1 中位于编码器 Feed Forward 模块的哪个方向？',['上方','下方','右侧','不在编码器中'],'B'),
  choice('根据文字，解码器中用于关注编码器输出的注意力模块，在图中直接接收来自哪一侧结构的连接？',['左侧编码器','顶部 Softmax','底部 Output Embedding','右侧 Linear'],'A'),
 ],
 [
  choice('根据文字，负责为序列提供位置信息的结构，在架构图中分别与哪两个模块的输出相加？',['Input Embedding 和 Output Embedding','两个 Feed Forward','Linear 和 Softmax','两个 Add & Norm'],'A'),
  choice('根据文字，负责将解码器输出转换为下一个词的概率分布的操作，在图中紧接哪个模块之后？',['Masked Multi-Head Attention','Input Embedding','Linear','Feed Forward'],'C'),
 ],
];

export function isChoiceQuestion(question:PaperQuestion):question is PaperChoiceQuestion{return typeof question==='object'&&question?.kind==='choice';}
export function questionPrompt(question:PaperQuestion):string{return isChoiceQuestion(question)?question.prompt:question;}
function normalizeQuestion(value:unknown):PaperQuestion{
 if(typeof value==='string')return value;
 if(!value||typeof value!=='object')return '';
 const item=value as Partial<PaperChoiceQuestion>;
 if(item.kind!=='choice'||!Array.isArray(item.options)||item.options.length!==4||!['A','B','C','D'].includes(item.answer??''))return '';
 return choice(String(item.prompt??''),item.options.map(option=>String(option)) as PaperChoiceQuestion['options'],item.answer as ChoiceLetter);
}
function load():QuestionSets{
 let saved:Partial<QuestionSets>={};
 const hasCurrent=localStorage.getItem(storageKey)!==null;
 try{saved=JSON.parse(localStorage.getItem(hasCurrent?storageKey:legacyKey)??'{}')}catch{/* Use prepared questions. */}
 return Object.fromEntries((Object.keys(studyTasks) as StudyTaskId[]).map(task=>{
  const stored=task==='comparison'&&!hasCurrent?[]:Array.isArray(saved[task])?saved[task]!:[];
  const count=Math.max(stored.length,task==='comparison'?comparisonQuestionSets.length:0);
  const sets=Array.from({length:count},(_,index)=>{
   const pair=stored[index],defaults=task==='comparison'?comparisonQuestionSets[index]:undefined;
   return [0,1].map(item=>{
    const current=normalizeQuestion(pair?.[item]);
    return questionPrompt(current).trim()?current:defaults?.[item]??'';
   }) as PaperQuestionSet;
  });
  return [task,sets];
 })) as QuestionSets;
}
export const paperQuestionStore=createStore<{sets:QuestionSets}>({sets:load()});
export function paperQuestionSet(task:StudyTaskId,index:number):PaperQuestionSet{return paperQuestionStore.get().sets[task][index]??blank();}
export function paperQuestionSetReady(task:StudyTaskId,index:number){return paperQuestionSet(task,index).every(question=>questionPrompt(question).trim().length>0&&(!isChoiceQuestion(question)||question.options.every(option=>option.trim().length>0)));}
export function paperTaskReady(task:StudyTaskId,setCount:number){return Array.from({length:setCount},(_,index)=>paperQuestionSetReady(task,index)).every(Boolean);}
function updateQuestion(task:StudyTaskId,setIndex:number,questionIndex:number,update:(question:PaperQuestion)=>PaperQuestion){
 if(!Number.isInteger(setIndex)||setIndex<0||questionIndex<0||questionIndex>=questionsPerSet)return;
 const sets={...paperQuestionStore.get().sets},taskSets=[...sets[task]];
 taskSets[setIndex]=[...(taskSets[setIndex]??blank())] as PaperQuestionSet;
 taskSets[setIndex][questionIndex]=update(taskSets[setIndex][questionIndex]);
 sets[task]=taskSets;paperQuestionStore.set({sets});localStorage.setItem(storageKey,JSON.stringify(sets));
}
export function setPaperQuestion(task:StudyTaskId,setIndex:number,questionIndex:number,text:string){
 updateQuestion(task,setIndex,questionIndex,question=>isChoiceQuestion(question)?{...question,prompt:text}:text);
}
export function setPaperOption(task:StudyTaskId,setIndex:number,questionIndex:number,optionIndex:number,text:string){
 if(optionIndex<0||optionIndex>3)return;
 updateQuestion(task,setIndex,questionIndex,question=>{
  if(!isChoiceQuestion(question))return question;
  const options=[...question.options] as PaperChoiceQuestion['options'];options[optionIndex]=text;return {...question,options};
 });
}
export function setPaperAnswer(task:StudyTaskId,setIndex:number,questionIndex:number,answer:ChoiceLetter){
 updateQuestion(task,setIndex,questionIndex,question=>isChoiceQuestion(question)?{...question,answer}:question);
}
