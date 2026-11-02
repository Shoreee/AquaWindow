import {TASK1_DOCUMENTS,type StudyDocument} from './task1';
export type StudyTaskId='task1'|'task2'|'task3';
export interface StudyTask {id:StudyTaskId;label:string;title:string;instruction:string;targetId:string;documents:StudyDocument[];}

function imageDoc(task:StudyTaskId,letter:string,file:string,title:string,abstract:string):StudyDocument{
  const imageUrl=`experiments/${task}/${file}`;
  return {id:`${task}-${letter}`,file,dir:letter==='c'?'Desktop':'Downloads',title,abstract,paragraphs:[],candidate:true,pdfUrl:'',imageUrl,size:'PNG'};
}
const invoices=[
  imageDoc('task2','a','download_6382.png','发票样张','开票日期 2026-10-12；文创打印制作费，A4 彩印与装订；价税合计 326.00 元。'),
  imageDoc('task2','b','IMG_2048.png','发票样张','开票日期 2026-10-11；餐饮服务，奶茶与点心；价税合计 150.00 元。'),
  imageDoc('task2','c','scan_0916.png','发票样张','开票日期 2026-10-13；办公用品，纸质笔记本与文件夹；价税合计 245.19 元。'),
  imageDoc('task2','d','file_7205.png','发票样张','开票日期 2026-10-12；物流辅助服务，快递服务费；价税合计 90.00 元。'),
];
const practice=[
  imageDoc('task3','a','scan_5721.png','社会实践材料','大学生社会实践回执。社区老年用户访谈、居家适老化产品需求收集与需求清单整理；含社会实践单位意见和实践认定。'),
  imageDoc('task3','b','document_2607.png','社会实践材料','大学生社会实践申报申请表。社区老年群体用户调研的实践方案、预期成果和申报审批意见。'),
  imageDoc('task3','c','IMG_3918.png','社会实践材料','社会实践个人日志。按 7 月 10 日到 7 月 24 日记录社区访谈、需求整理和回执准备过程，附日志小结。'),
  imageDoc('task3','d','file_0842.png','社会实践材料','社区适老化产品调研实践成果总结报告。包含实践背景、20 位老年住户调研方法、主要发现、收获与成果清单。'),
];
export const STUDY_TASKS:StudyTask[]=[
  {id:'task1',label:'任务一',title:'查找文章',targetId:'task1-a',instruction:'请找到一篇中文文章：它以家用吹风机为研究对象，使用设计心理学理论分析并改良产品的使用体验。',documents:TASK1_DOCUMENTS},
  {id:'task2',label:'任务二',title:'查找发票',targetId:'task2-a',instruction:'请找到开票日期为 2026 年 10 月 12 日、项目为文创打印制作费、价税合计为 326 元的发票样张。',documents:invoices},
  {id:'task3',label:'任务三',title:'查找实践材料',targetId:'task3-a',instruction:'请找到关于社区老年用户访谈和居家适老化产品需求整理的社会实践回执，文件中应包含实践单位的评价意见。',documents:practice},
];
export const isStudyTaskId=(id:unknown):id is StudyTaskId=>STUDY_TASKS.some(t=>t.id===id);
export const studyTask=(id:StudyTaskId)=>STUDY_TASKS.find(t=>t.id===id)!;
export const studyDocument=(id:string)=>STUDY_TASKS.flatMap(t=>t.documents).find(d=>d.id===id);
export const studyCandidates=(id:StudyTaskId)=>studyTask(id).documents.filter(d=>d.candidate);
export const studyFileEntries=(id:StudyTaskId)=>studyTask(id).documents.map(d=>({name:d.file,dir:d.dir,kind:d.imageUrl?'image' as const:'pdf' as const,size:d.size,modified:'2026-10-12',age:100,studyDocumentId:d.id,agentEligible:d.candidate}));
