import {describe,it,expect,vi} from 'vitest';
import {WindowKernel} from '../../kernel/kernel';
import {TaskDrivenWorkspace,compactContext} from './workspace';
import {observeApp} from './observations';
import {CandidateBuffer} from './buffer';
import {permittedPlans,pendingEvidence} from './policy';
import type {AgentContext} from './types';

// Synthetic model responses for tests, never a production candidate generator.
function immediatePlans(ctx:AgentContext):import('./types').AgentPlan[]{
 const ids=ctx.windows.map(w=>w.id);if(!ids.length)return [];
 const primary=ctx.selectedIds.length?ctx.selectedIds:[ctx.focusedId??ids[0]];
 return [{id:'model-fixture',title:'模型布局',rationale:'测试模型返回',priority:.5,confidence:.5,primaryTargets:primary,supportTargets:ids.filter(id=>!primary.includes(id)),steps:[{type:'arrange',targets:ids,layout:'compare'}],artifacts:[]}];
}
const work={x:0,y:0,w:1400,h:800};
function setup(){const k=new WindowKernel(),model=new TaskDrivenWorkspace();
 const paper=k.open({appId:'study',title:'真实论文',rect:{x:30,y:40,w:600,h:650},props:{resource:'pdf'}});
 const note=k.open({appId:'study',title:'笔记',rect:{x:400,y:70,w:600,h:650},props:{resource:'notes'}});
 const context=(selected:string[]=[])=>model.context(k.getState(),work,selected,[],{accepted:[],rejected:[]});
 return {k,model,paper,note,context};}
describe('task-driven workspace and immediate response',()=>{
 it('reuses semantic identity across geometry changes while recording local changes',()=>{
  const s=setup();observeApp(s.paper,{title:'论文',documentId:'paper.pdf',page:1,text:'第1页的可观测内容'});
  const before=s.context();s.k.setRect(s.paper,{x:180,y:100,w:600,h:650});const after=s.context();
  expect(after.semanticKey).toBe(before.semanticKey);expect(after.workspace!.revision).toBeGreaterThan(before.workspace!.revision);
  expect(after.workspace!.changes.updated).toContain(s.paper);expect(after.windows.find(w=>w.id===s.paper)!.rect.x).toBe(180);
  observeApp(s.paper,{page:2,text:'第2页不同内容'});expect(s.context().semanticKey).not.toBe(before.semanticKey);
 });
 it('keeps irrelevant content local and bounds self-contained requests',()=>{
  const s=setup();for(let i=0;i<12;i++)s.k.open({appId:'study',title:`材料${i}`,rect:{x:10,y:10,w:400,h:400},props:{resource:`different-${i}`}});
  s.k.focus(s.note);observeApp(s.note,{title:'笔记',text:'甲'.repeat(20000),editable:true});
  const ctx=s.context();expect(ctx.windows.length).toBeLessThanOrEqual(4);
  expect(ctx.windows.some(w=>w.id===s.note)).toBe(true);
  const wire=compactContext(ctx);expect(wire.sources.reduce((n,s)=>n+s.text.length,0)).toBeLessThanOrEqual(3200);
  expect(wire.sources.some(s=>s.text.length)).toBe(true);expect(wire.workspace!.constraints).toContain('explicit-confirmation');
 });
 it('does not turn an experiment panel or every window into an implicit subject',()=>{
  const s=setup();s.k.open({appId:'experiment',title:'实验',role:'tool',rect:{x:900,y:20,w:400,h:600}});
  const ctx=s.context();expect(ctx.selectedIds).toEqual([]);expect(ctx.windows.some(w=>w.app==='experiment')).toBe(false);
  expect(immediatePlans(ctx).every(p=>p.primaryTargets.length===1)).toBe(true);
 });
 it('does not create candidates while the cloud has not returned',()=>{
  const s=setup(),fetcher=vi.fn(()=>new Promise<Response>(()=>{})),buffer=new CandidateBuffer(fetcher);
  buffer.filter=permittedPlans;buffer.setRemoteEnabled(true);const ctx=s.context();buffer.request(ctx,true);
  expect(fetcher).toHaveBeenCalledOnce();expect(buffer.get(ctx)).toBeNull();expect(pendingEvidence.estimate(ctx,immediatePlans(ctx)[0])).toBeNull();buffer.stop();
 });
 it('urgent selection preempts stale background and ignores even an abort-insensitive late response',async()=>{
  const s=setup();let t=0;const pending:{ctx:AgentContext;options:RequestInit;resolve:(r:Response)=>void}[]=[];
  const fetcher=vi.fn((_url:RequestInfo|URL,options?:RequestInit)=>new Promise<Response>(resolve=>pending.push({ctx:JSON.parse(String(options!.body)).context,options:options!,resolve})));
  const buffer=new CandidateBuffer(fetcher,()=>t);buffer.setRemoteEnabled(true);const global=s.context();buffer.request(global);t=1500;buffer.tick();
  const selected=s.context([s.note]);buffer.request(selected,true);expect(pending).toHaveLength(2);expect(pending[0].options.signal!.aborted).toBe(true);
  pending[0].resolve(new Response(JSON.stringify({plans:immediatePlans(global)})));await new Promise(r=>setTimeout(r,0));
  expect(buffer.entries.has(global.key)).toBe(false);
  pending[1].resolve(new Response(JSON.stringify({plans:immediatePlans(selected)})));await new Promise(r=>setTimeout(r,0));
  expect(buffer.entries.has(selected.key)).toBe(true);expect(buffer.status).toBe('ready');buffer.stop();
 });
 it('stores grounded task interpretations as tentative and invalidates them when source semantics change',()=>{
  const s=setup();observeApp(s.note,{title:'笔记',text:'正在整理对照材料',editable:true});const ctx=s.context(),source=ctx.sources.find(source=>source.windowId===s.note)!;
  s.model.acceptInterpretation({intent:'核对材料',subjectIds:[s.note],evidenceIds:[source.id]},ctx);
  expect(s.context().workspace!.task?.status).toBe('tentative');
  observeApp(s.note,{text:'新的无关任务'});expect(s.context().workspace!.task).toBeUndefined();
  s.model.acceptInterpretation({intent:'臆造的任务',subjectIds:[s.note],evidenceIds:['missing']},s.context());expect(s.context().workspace!.task).toBeUndefined();
 });
 it('promotes an already queued context urgently instead of waiting behind another request',async()=>{
  const s=setup();let t=0;const signals:AbortSignal[]=[];
  const fetcher=vi.fn((_url:RequestInfo|URL,options?:RequestInit)=>{signals.push(options!.signal as AbortSignal);return new Promise<Response>(()=>{});});
  const buffer=new CandidateBuffer(fetcher,()=>t);buffer.setRemoteEnabled(true);buffer.request(s.context());t=1500;buffer.tick();
  const selected=s.context([s.note]);buffer.request(selected);buffer.request(selected,true);
  expect(fetcher).toHaveBeenCalledTimes(2);expect(signals[0].aborted).toBe(true);buffer.stop();
 });
 it('labels local and model output separately instead of presenting fallback as inference',()=>{
  const s=setup(),buffer=new CandidateBuffer();buffer.filter=permittedPlans;buffer.setRemoteEnabled(true);
  const ctx=s.context();expect(buffer.get(ctx)).toBeNull();
  expect(buffer.remotePlans(ctx)).toBeNull();const plan={...immediatePlans(ctx)[0],id:'context-specific'};
  buffer.entries.set(ctx.key,{context:ctx,plans:[plan],generatedAt:performance.now()});expect(buffer.get(ctx)![0].origin).toBe('deepseek');
 });
 it('retains remote candidate order instead of inserting unrelated local techniques',()=>{
  const s=setup(),buffer=new CandidateBuffer();buffer.filter=permittedPlans;buffer.setRemoteEnabled(true);
  const ctx=s.context(),plans=immediatePlans(ctx).slice(0,2).map((p,index)=>({...p,priority:1-index*.2}));
  buffer.entries.set(ctx.key,{context:ctx,plans,generatedAt:performance.now()});expect(buffer.get(ctx)!.map(p=>p.id)).toEqual(plans.map(p=>p.id));
 });
});
