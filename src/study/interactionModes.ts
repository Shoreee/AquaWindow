import {BASELINE,type Techniques} from '../techniques/techniques';

export type StudyInteractionModeId='fusion'|'reveal'|'capsule'|'screenshot'|'figure-pin'|'peel'|'sync-scroll';

export const studyInteractionModes:{id:StudyInteractionModeId;label:string;description:string}[]=[
  {id:'peel',label:'掀角查看',description:'拖动窗口角查看下层，松手回弹；Shift 松手保持。'},
  {id:'fusion',label:'融合与拆分',description:'拖动相邻窗口融合；沿接缝拖动或抓住标题栏左右抖动可拆分。'},
  {id:'reveal',label:'重要区域透出',description:'右键标题栏框选重点区域，窗口重叠时保持该区域可见。'},
  {id:'capsule',label:'胶囊与提案预览',description:'右键标题栏预览胶囊位置，确认后收纳窗口。'},
  {id:'screenshot',label:'截图停靠',description:'按 Ctrl+Shift+S 框选论文内容，图片窗口流动停靠并与论文窗口融合。'},
  {id:'figure-pin',label:'图像吸顶',description:'滚动经过图 1 时，架构图保持原尺寸停在顶部；相关论述结束后随正文移走。'},
  {id:'sync-scroll',label:'融合后同步滚动',description:'两个 PDF 窗口左右融合后，滚动左侧时右侧跟随阅读进度。'},
];

export function studyTechniques(mode:StudyInteractionModeId|null):Techniques{
  const base:Techniques={...BASELINE,shape:'squircle',snap:true};
  switch(mode){
    case 'peel':return {...base,peel:true};
    case 'fusion':case 'sync-scroll':return {...base,fusion:true};
    case 'reveal':return {...base,cutout:true};
    case 'capsule':return {...base,periphery:true};
    case 'screenshot':return base;
    default:return base;
  }
}
