import {BASELINE,type Techniques} from '../techniques/techniques';

export type StudyInteractionModeId='fusion'|'reveal'|'capsule'|'screenshot'|'figure-pin';

export const studyInteractionModes:{id:StudyInteractionModeId;label:string;description:string}[]=[
  {id:'fusion',label:'融合与拆分',description:'拖动相邻窗口融合；沿接缝拖动或抓住标题栏左右抖动可拆分。'},
  {id:'reveal',label:'重要区域透出',description:'右键标题栏框选重点区域，窗口重叠时保持该区域可见。'},
  {id:'capsule',label:'胶囊与提案预览',description:'右键标题栏预览胶囊位置，确认后收纳窗口。'},
  {id:'screenshot',label:'截图停靠',description:'按 Shift+S 框选论文内容，图片窗口流动停靠并与论文窗口融合。'},
  {id:'figure-pin',label:'图像吸顶',description:'滚动经过图 1 时，架构图保持原尺寸停在顶部；相关论述结束后随正文移走。'},
];

export function studyTechniques(mode:StudyInteractionModeId|null):Techniques{
  const base:Techniques={...BASELINE,shape:'squircle',snap:true};
  switch(mode){
    case 'fusion':return {...base,fusion:true};
    case 'reveal':return {...base,cutout:true};
    case 'capsule':return {...base,periphery:true};
    case 'screenshot':return base;
    default:return base;
  }
}
