import { describe, expect, it } from 'vitest';
import { WindowKernel } from '../../kernel/kernel';
import { makeContext } from './context';
import { localPlans } from './local';
import { PlanPerformance, ease } from './choreography';

function setup() {
  const k = new WindowKernel();
  k.open({appId:'preview',title:'paper',rect:{x:80,y:80,w:550,h:600},props:{paperId:'2403.11872'}});
  k.open({appId:'writer',title:'note',rect:{x:700,y:150,w:550,h:600},props:{docId:'draft'}});
  const base=k.getState(), context=makeContext(base,{x:8,y:36,w:1424,h:778},[],[],{accepted:[],rejected:[]});
  const candidates=localPlans(context),yielding=candidates[2],peel=candidates[1],branch=candidates[4],merge=candidates[5];
  const layout={...yielding,steps:[...yielding.steps,{type:'arrange' as const,targets:[...yielding.primaryTargets,...yielding.supportTargets],layout:'compare' as const},...peel.steps,{type:'anchor' as const,targets:yielding.primaryTargets,edge:'right' as const,artifactIds:[]} ]};
  const combined={...branch,steps:[...branch.steps,...candidates[6].steps,...merge.steps],artifacts:merge.artifacts};
  return {base,context,plans:[layout,combined,candidates[3]],candidates};
}
describe('embodied operations',()=>{
  it('closes an accepted reveal continuously even when no window position changed',()=>{
    const {base,context,candidates}=setup(),plan=candidates[1];
    const accepted=new PlanPerformance(base,plan,context).final;
    const returning=new PlanPerformance(base,{...plan,steps:[]},context,accepted,true),id=plan.primaryTargets[0];
    expect(returning.duration).toBeGreaterThan(0);
    const start=returning.at(0).state.windows[id],middle=returning.at(.3).state.windows[id];
    expect(start.props.agentRevealProgress).toBe(1);
    expect(middle.props.agentRevealProgress).toBeGreaterThan(0);expect(middle.props.agentRevealProgress).toBeLessThan(1);
    expect(returning.at(returning.duration).state.windows[id].props.agentView).toBeUndefined();
  });
  it('keeps windows still until arrival, then moves them while the pulling organism works',()=>{
    const {base,context,plans}=setup(), performance=new PlanPerformance(base,plans[0],context);
    const segment=performance.segments[0], id=plans[0].primaryTargets[0];
    expect(performance.at(.4).state.windows[id].rect).toEqual(base.windows[id].rect);
    expect(performance.at(segment.travel-.01).state.windows[id].props.agentMotion).toMatchObject({arrival:expect.any(Number),contactAge:expect.closeTo(-.01)});
    expect(performance.at(segment.travel).state.windows[id].props.agentMotion).toMatchObject({arrival:1,contactAge:0});
    const middle=performance.at(segment.travel+segment.work*.5).state.windows[id];
    expect(middle.rect).not.toEqual(base.windows[id].rect);
    expect(middle.rect).not.toEqual(segment.after.windows[id].rect);
    expect(middle.props.agentMotion).toMatchObject({primitive:'yield',action:expect.closeTo(.5)});
    expect(middle.rect.y).toBe(base.windows[id].rect.y);
    expect(middle.rect.h).toBe(base.windows[id].rect.h);
    expect(middle.rect.x+middle.rect.w).toBe(base.windows[id].rect.x+base.windows[id].rect.w);
    expect(performance.at(performance.duration).state).toEqual(performance.final);
    expect(performance.final.windows[id].props.agentMotion).toBeUndefined();
  });
  it('covers all seven primitives in local mode and keeps results closed until a deliberate peel',()=>{
    const {base,context,plans}=setup();
    const operations=new Set(plans.flatMap(p=>p.steps.map(s=>s.type)));
    for(const type of ['anchor','peel','yield','encapsulate','branch','merge','permeate'] as const)expect(operations.has(type)).toBe(true);
    const p=new PlanPerformance(base,plans[0],context), id=plans[0].primaryTargets[0];
    expect(p.at(1.5).state.windows[id].props.agentView).toMatchObject({revealed:false});
    const reveal=p.segments.find(s=>s.concurrent==='peel')!;
    expect(p.at(reveal.start+reveal.travel+.1).state.windows[id].props.agentView).toMatchObject({revealed:true});
    expect(p.at(reveal.start+reveal.travel+reveal.work*.5).state.windows[id].props.agentMotion).toMatchObject({concurrent:'peel',transport:{active:true,coverage:1}});
    expect(p.segments.some(s=>s.primitive==='anchor')).toBe(false);
    const branch=new PlanPerformance(base,plans[1],context).segments.find(s=>s.primitive==='branch')!;
    expect(branch.targets.length).toBeGreaterThan(1);
    expect(Math.max(...Object.values(branch.children))).toBe(2);
    const branchPerformance = new PlanPerformance(base,plans[1],context);
    expect(branchPerformance.at(branch.start+branch.travel+.4).state.windows[id].props.agentView).toMatchObject({revealed:false});
  });
  it('spreads from a corner before travel and releases only after reaching the destination',()=>{
    const {base,context,plans}=setup(),p=new PlanPerformance(base,plans[0],context);
    const segment=p.segments.find(s=>s.primitive==='arrange')!,id=plans[0].primaryTargets[0];
    const beforeMove=p.at(segment.start+segment.travel+segment.work*.41).state.windows[id];
    expect(beforeMove.rect).toEqual(segment.before.windows[id].rect);
    expect((beforeMove.props.agentMotion as {transport:{coverage:number}}).transport.coverage).toBeGreaterThan(.95);
    const arrived=p.at(segment.start+segment.travel+segment.work*.85).state.windows[id];
    expect(arrived.rect).toEqual(segment.after.windows[id].rect);
  });
  it('cleaves actual independently addressable result windows and absorbs them at merge',()=>{
    const {base,context,plans}=setup(),p=new PlanPerformance(base,plans[1],context);
    const branch=p.segments.find(s=>s.primitive==='branch')!,merge=p.segments.find(s=>s.primitive==='merge')!;
    const early=p.at(branch.start+branch.travel+branch.work*.25).state;
    const split=p.at(branch.start+branch.travel+branch.work*.95).state;
    const children=Object.values(split.windows).filter(w=>w.props.agentBranch);
    expect(children).toHaveLength(2);
    for(const child of children){
      expect(split.order).toContain(child.id);
      expect(child.openedFrom).toBe(plans[1].primaryTargets[0]);
      expect(child.rect).not.toEqual(early.windows[child.id].rect);
      expect(child.props.agentDivision).toMatchObject({born:true});
      expect(child.props.agentBranch).toMatchObject({artifact:{sourceIds:expect.any(Array)}});
    }
    const merging=p.at(merge.start+merge.travel+merge.work*.5).state;
    for(const child of children){
      expect(merging.windows[child.id].props.agentDivision).toMatchObject({absorbed:true});
      expect(merging.windows[child.id].rect).not.toEqual(child.rect);
    }
    const final=p.at(p.duration).state;
    expect(Object.values(final.windows).some(w=>w.props.agentBranch)).toBe(false);
    expect(final.windows[plans[1].primaryTargets[0]].props.agentBond).toBe(plans[1].id);
    expect(final.order.sort()).toEqual(Object.keys(final.windows).sort());
  });
  it('feeds the capsule in a queue with at most one moving member',()=>{
    const {base,context,plans}=setup(),p=new PlanPerformance(base,plans[2],context),segment=p.segments[0];
    for(let t=segment.travel;t<p.duration;t+=.025){
      const state=p.at(t).state;
      const moving=Object.values(state.windows).filter(w=>{
        const q=w.props.agentQueue as {travel:number;waiting:boolean}|undefined;
        return q&&!q.waiting&&q.travel>.001&&q.travel<.999;
      });
      expect(moving.length).toBeLessThanOrEqual(1);
      for(const w of Object.values(state.windows)){
        const q=w.props.agentQueue as {waiting:boolean;index:number}|undefined;
        if(q?.waiting){expect(w.minimized).toBe(false);expect(w.rect).toEqual(base.windows[w.id].rect);}
      }
    }
    expect(p.at(p.duration).state.windows[plans[2].steps[0].targets[1]].minimized).toBe(true);
  });
  it('can preview Merge directly, without first running Branch or flashing invisible children',()=>{
    const {base,context,candidates}=setup(),p=new PlanPerformance(base,candidates[5],context);
    const segment=p.segments[0],frame=p.at(segment.travel+segment.work*.4).state;
    const inputs=Object.values(frame.windows).filter(w=>w.props.agentMergeSeed);
    expect(inputs).toHaveLength(2);
    expect(inputs.every(w=>(w.props.agentBranch as {artifact:{sourceIds:string[]}}).artifact.sourceIds.length>0)).toBe(true);
    expect(Object.values(p.at(p.duration).state.windows).some(w=>w.props.agentMergeSeed)).toBe(false);
  });
  it('keeps velocity and acceleration flat at both ends of a transition',()=>{
    const h=.0001;
    expect(ease(0)).toBe(0);expect(ease(1)).toBe(1);
    expect(ease(h)/h).toBeLessThan(.0001);
    expect((1-ease(1-h))/h).toBeLessThan(.0001);
    expect((ease(2*h)-2*ease(h))/(h*h)).toBeLessThan(.02);
  });
  it('wraps visible member windows before replacing them with a recoverable capsule',()=>{
    const {base,context,plans}=setup(), p=new PlanPerformance(base,plans[2],context), segment=p.segments[0];
    const middle=p.at(segment.travel+segment.work*.5).state;
    for(const id of plans[2].steps[0].targets){
      expect(middle.windows[id].minimized).toBe(false);
      expect(middle.windows[id].props.agentMotion).toMatchObject({primitive:'encapsulate'});
    }
    expect(Object.values(p.at(p.duration).state.windows).filter(w=>w.form==='capsule')).toHaveLength(1);
  });
});
