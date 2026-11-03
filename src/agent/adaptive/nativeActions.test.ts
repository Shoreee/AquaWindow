import {describe,it,expect} from 'vitest';
import {WindowKernel} from '../../kernel/kernel';
import {makeContext} from './context';
import {compilePlan} from './compiler';
import {inspectPlans,validatePlans} from './protocol';
import {permittedPlans} from './policy';
import {observeApp} from './observations';
import {surfaceBonds} from '../../shell/surfaceBondGeometry';
import {verifyCandidate} from './verification';
import {PlanPerformance} from './choreography';
import type {AgentPlan,PrimitiveStep} from './types';
const work={x:0,y:0,w:1440,h:900};
function setup(){const k=new WindowKernel(),a=k.open({appId:'study',title:'论文',rect:{x:80,y:80,w:500,h:600},props:{resource:'pdf'}}),b=k.open({appId:'study',title:'笔记',rect:{x:360,y:100,w:500,h:600},props:{resource:'notes'}});const context=()=>makeContext(k.getState(),work,[],[],{accepted:[],rejected:[]});return {k,a,b,context};}
function plan(targets:string[],step:PrimitiveStep):AgentPlan{return {id:'model-native',title:'模型建议',rationale:'根据已观察对象组织窗口',priority:.8,confidence:.7,primaryTargets:targets,supportTargets:[],steps:[step],artifacts:[]};}
describe('model-driven existing native actions',()=>{
 it('does not guess a paper task from an empty gallery and a note',()=>{
  const s=setup();observeApp(s.a,{title:'图库',kind:'gallery',availability:'empty',text:'图库为空，没有截图。'});const ctx=s.context();
  expect(ctx.task).toBe('workspace');expect(ctx.windows[0].content?.availability).toBe('empty');expect(ctx.sources.some(s=>s.text.includes('图库为空'))).toBe(true);
 });
 it('compiles an actual native fusion, preserving sizes, content identity and undo',()=>{
  const s=setup(),ctx=s.context(),base=s.k.getState(),p=plan([s.a,s.b],{type:'fuse',targets:[s.a,s.b],movingId:s.b,fixedId:s.a});
  expect(validatePlans({plans:[p]},ctx)).toHaveLength(1);expect(permittedPlans([p],ctx)).toHaveLength(1);expect(verifyCandidate(base,p,ctx)).not.toBeNull();
  const after=compilePlan(base,p,ctx).state;expect(after.windows[s.a].group).toBe(after.windows[s.b].group);expect(surfaceBonds(after.windows[s.a])).toHaveLength(1);
  expect(after.windows[s.b].rect.w).toBe(base.windows[s.b].rect.w);expect(Object.keys(after.windows)).toEqual(Object.keys(base.windows));
 });
 it('uses the real corner-fold state with continuous motion, not edge erosion',()=>{
  const s=setup(),base=s.k.getState(),ctx=s.context(),p=plan([s.b],{type:'corner-peel',targets:[s.b],corner:'bottom-left',amount:.25});
  expect(permittedPlans(validatePlans({plans:[p]},ctx),ctx)).toHaveLength(1);const after=compilePlan(base,p,ctx).state;
  expect(after.windows[s.b].props.agentCornerFold).toEqual({corner:'bottom-left',amount:.25});expect(after.windows[s.b].rect).toEqual(base.windows[s.b].rect);
  expect((after.windows[s.b].props.agentView as {revealed:boolean}).revealed).toBe(false);
  const motion=new PlanPerformance(base,p,ctx);const frame=motion.at(.325);expect((frame.state.windows[s.b].props.agentCornerFold as {amount:number}).amount).toBeGreaterThan(0);
 });
 it('allows only observed regions and requires explicit selection to convert a preserved region to a hole',()=>{
  const s=setup();s.k.setImportance(s.b,[{id:'marked:user',x:.2,y:.2,w:.4,h:.3,weight:1}]);let ctx=s.context();
  const p=plan([s.b],{type:'region',targets:[s.b],mode:'hole',regionId:'marked:user'});
  expect(permittedPlans([p],ctx)).toHaveLength(0);ctx={...ctx,selectedIds:[s.b]};expect(permittedPlans(validatePlans({plans:[p]},ctx),ctx)).toHaveLength(1);
  expect(compilePlan(s.k.getState(),p,ctx).state.windows[s.b].importance[0].kind).toBe('hole');
  const fake={...p,steps:[{...p.steps[0],regionId:'invented'}]};expect(inspectPlans({plans:[fake]},ctx).rejections[0].reason).toBe('region_not_observed');
 });
 it('expresses axis, proportions and a single focus anchor instead of one hard-coded template',()=>{
  const s=setup(),base=s.k.getState(),ctx=s.context();
  const x=plan([s.a,s.b],{type:'arrange',targets:[s.a,s.b],layout:'compare',axis:'x',weights:[1,2]});
  const y=plan([s.a,s.b],{type:'arrange',targets:[s.a,s.b],layout:'compare',axis:'y',weights:[1,1]});
  const xs=compilePlan(base,x,ctx).state,ys=compilePlan(base,y,ctx).state;
  expect(xs.windows[s.b].rect.w).toBeCloseTo(xs.windows[s.a].rect.w*2);expect(ys.windows[s.b].rect.y).toBeGreaterThan(ys.windows[s.a].rect.y);
  const focus=plan([s.a,s.b],{type:'arrange',targets:[s.a,s.b],layout:'focus',axis:'x',anchorId:s.b,order:[s.b,s.a],share:.7});
  const focused=compilePlan(base,focus,ctx).state;expect(focused.windows[s.b].rect.w).toBeGreaterThan(focused.windows[s.a].rect.w);
 });
 it('reports the source-ID / artifact-ID error rather than silently losing a candidate',()=>{
  const s=setup(),ctx=s.context(),p=plan([s.b],{type:'permeate',targets:[s.b],depth:.2,artifactIds:['source-not-artifact']});
  expect(inspectPlans({plans:[p]},ctx).rejections[0]).toMatchObject({stage:'protocol',reason:'artifactIds_must_reference_artifacts_not_sourceIds'});
 });
});
