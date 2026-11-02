import {describe,it,expect} from 'vitest';
import {WindowKernel} from '../kernel/kernel';
import {makeContext} from '../agent/adaptive/context';
import {localPlans} from '../agent/adaptive/local';
import {validatePlans} from '../agent/adaptive/protocol';
import {compilePlan} from '../agent/adaptive/compiler';
import {TASK1_CANDIDATES,TASK1_DOCUMENTS} from '../apps/data/task1';
import {TASK1_MODES,isTask1Layout,task1CandidateIds} from './task1Modes';
import {task1Layout} from './task1Layout';
import {STUDY_TASKS,studyCandidates,studyTask,studyDocument,studyFileEntries,type StudyTaskId} from '../apps/data/studies';

function setup(mode='local-hole',taskId:StudyTaskId='task1'){
  const kernel=new WindowKernel();
  const rect={x:20,y:50,w:600,h:650};
  kernel.open({appId:'finder',title:'下载文件夹',rect,props:{pool:taskId,path:'Downloads'}});
  for(const d of studyCandidates(taskId))kernel.open({appId:'preview',title:d.file,rect,props:{pool:taskId,studyDocumentId:d.id}});
  const host=kernel.open({appId:'task1',title:studyTask(taskId).title,rect,props:{pool:taskId,studyTaskId:taskId,studyMode:mode}});
  const context=()=>makeContext(kernel.getState(),{x:0,y:32,w:1440,h:850},[host],[],{accepted:[],rejected:[]});
  return {kernel,host,context};
}
describe('task-one study isolation',()=>{
  it('places exactly four named candidates and 24 readable distractors in the requested pool',()=>{
    expect(TASK1_CANDIDATES.map(d=>[d.dir,d.file])).toEqual([
      ['Desktop','file_005.pdf'],['Downloads','2026-09-12_1254.pdf'],['Downloads','paper_0419.pdf'],['Downloads','download_8734.pdf']]);
    expect(TASK1_DOCUMENTS.filter(d=>!d.candidate)).toHaveLength(24);
    expect(TASK1_DOCUMENTS.every(d=>d.paragraphs.length>0&&d.pdfUrl.endsWith('.pdf'))).toBe(true);
  });
  it('excludes manually opened distractors from every candidate source and operation',()=>{
    const s=setup();
    for(const d of TASK1_DOCUMENTS.filter(d=>!d.candidate))s.kernel.open({appId:'preview',title:d.file,rect:{x:0,y:0,w:600,h:600},props:{pool:'task1',studyDocumentId:d.id}});
    const ctx=s.context();
    expect(ctx.sources.map(source=>source.studyDocumentId).sort()).toEqual(['task1-a','task1-b','task1-c','task1-d']);
    expect(ctx.windows.every(w=>!/^\w{18}\.pdf$/.test(w.title))).toBe(true);
    const plans=validatePlans({plans:localPlans(ctx)},ctx);
    expect(plans).toHaveLength(1);
    for(const plan of plans)expect(()=>compilePlan(s.kernel.getState(),plan,ctx)).not.toThrow();
  });
  it.each(['local-hole','local-layer'])('keeps the %s condition isolated',mode=>{
    const ctx=setup(mode).context();
    expect(validatePlans({plans:localPlans(ctx)},ctx).map(p=>p.id)).toEqual([mode]);
  });
  it('offers only the four requested fixed conditions, with the requested candidate sets',()=>{
    expect(TASK1_MODES.map(m=>m.label)).toEqual(['并列呈现','主次呈现','中央揭示','穿透']);
    expect(task1CandidateIds('parallel')).toEqual(['task1-a','task1-b','task1-c']);
    expect(task1CandidateIds('primary-secondary')).toEqual(['task1-a','task1-b','task1-c','task1-d']);
    expect(TASK1_MODES.filter(m=>isTask1Layout(m.id)).map(m=>m.id)).toEqual(['parallel','primary-secondary']);
  });
  it.each(['parallel','primary-secondary','all'])('does not expose the original seven-effect cycle for %s',mode=>{
    expect(localPlans(setup(mode).context())).toEqual([]);
  });
  it.each([{x:8,y:36,w:1424,h:878},{x:8,y:36,w:1008,h:646}])('fits independent native windows within %j',work=>{
    const parallel=task1Layout(work,'parallel','task1-a',['task1-b','task1-c','task1-d']);
    const panes=Object.values(parallel.documents);
    expect(panes).toHaveLength(3);
    expect(panes.every(p=>p.w===panes[0].w&&p.h===panes[0].h)).toBe(true);
    const hierarchy=task1Layout(work,'primary-secondary','task1-b',['task1-a','task1-c','task1-d']);
    expect(hierarchy.documents['task1-b'].x).toBe(work.x);
    expect(hierarchy.documents['task1-b'].w).toBe(hierarchy.documents['task1-a'].w);
    for(const rect of [...panes,...Object.values(hierarchy.documents)]){
      expect(rect.x).toBeGreaterThanOrEqual(work.x);
      expect(rect.y).toBeGreaterThan(parallel.host.y+parallel.host.h);
      expect(rect.w).toBeGreaterThan(0);expect(rect.h).toBeGreaterThan(0);
      expect(rect.x+rect.w).toBeLessThanOrEqual(work.x+work.w+.001);
      expect(rect.y+rect.h).toBeLessThanOrEqual(work.y+work.h+.001);
    }
  });
});

describe('invoice and practice studies',()=>{
  it.each(['task2','task3'] as StudyTaskId[])('has four readable source images and a valid target for %s',taskId=>{
    const task=studyTask(taskId);
    expect(task.documents).toHaveLength(4);
    expect(studyDocument(task.targetId)).toBeDefined();
    expect(task.documents.every(d=>d.imageUrl?.startsWith(`experiments/${taskId}/`))).toBe(true);
    expect(studyFileEntries(taskId).every(e=>e.kind==='image'&&e.agentEligible)).toBe(true);
    expect(task1CandidateIds('parallel',taskId)).toEqual(['a','b','c'].map(letter=>`${taskId}-${letter}`));
    const work={x:8,y:36,w:1424,h:878};
    const layout=task1Layout(work,'primary-secondary',`${taskId}-a`,['b','c','d'].map(letter=>`${taskId}-${letter}`),taskId);
    expect(Object.keys(layout.documents).sort()).toEqual(task.documents.map(d=>d.id).sort());
  });
  it.each(['task2','task3'] as StudyTaskId[])('isolates both adaptive effects and excludes other task material for %s',taskId=>{
    for(const mode of ['local-hole','local-layer']){
      const s=setup(mode,taskId);
      for(const foreign of STUDY_TASKS.filter(t=>t.id!==taskId))for(const doc of foreign.documents){
        s.kernel.open({appId:'preview',title:doc.file,rect:{x:0,y:0,w:600,h:600},props:{pool:foreign.id,studyDocumentId:doc.id}});
      }
      const ctx=s.context();
      expect(ctx.sources.map(source=>source.studyDocumentId).sort()).toEqual(studyCandidates(taskId).map(d=>d.id).sort());
      const plans=validatePlans({plans:localPlans(ctx)},ctx);
      expect(plans.map(p=>p.id)).toEqual([mode]);
      for(const plan of plans)expect(()=>compilePlan(s.kernel.getState(),plan,ctx)).not.toThrow();
    }
  });
});
