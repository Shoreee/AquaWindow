import {BASELINE,type Techniques} from '../techniques/techniques';

export type StudyInteractionModeId='yield'|'shake'|'fusion'|'reveal'|'capsule';

export const studyInteractionModes:{id:StudyInteractionModeId;label:string;description:string}[]=[
  {id:'yield',label:'边界退让',description:'拖动前窗压近后窗，观察后窗边缘局部让位。'},
  {id:'shake',label:'抖动分裂',description:'打开两个窗口并准备融合状态，再抓住标题栏左右抖动。'},
  {id:'fusion',label:'融合与拆分',description:'拖动相邻窗口使其融合；沿连接处拖动可拆开。'},
  {id:'reveal',label:'重要区域透出',description:'右键标题栏框选重点区域，窗口重叠时保持该区域可见。'},
  {id:'capsule',label:'胶囊与提案预览',description:'右键标题栏预览胶囊位置，确认后收纳窗口。'},
];

export function studyTechniques(mode:StudyInteractionModeId|null):Techniques{
  const base:Techniques={...BASELINE,shape:'squircle'};
  switch(mode){
    case 'yield':return {...base,yield:'deform'};
    case 'shake':return {...base,fusion:true};
    case 'fusion':return {...base,fusion:true};
    case 'reveal':return {...base,cutout:true};
    case 'capsule':return {...base,periphery:true};
    default:return base;
  }
}
