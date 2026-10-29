import {boundaryChange,type BoundaryChange} from './boundaryMotion';
import {capsuleSize} from "./capsuleGeometry";
import type { KernelState, Rect } from '../../kernel/types';
import { compilePlan } from './compiler';
import type { AgentContext, AgentPlan, Primitive } from './types';

export interface AgentMotion {
  boundary?: BoundaryChange;
  interaction?: {strength:number};
  primitive: Primitive;
  edge: 'left'|'right'|'top'|'bottom';
  concurrent?: Primitive;
  transport: { coverage:number; progress:number; active:boolean; origin?:[number,number] };
  docked: boolean;
  departure?: Rect;
  elapsed: number;
  travelDuration: number;
  progress: number;
  action: number;
  arrival: number;
  contactAge: number;
  seed: number;
  index: number;
  count: number;
  childCount: number;
  direction: [number, number];
  from: Rect;
  to: Rect;
}
interface Segment {
  primitive: Primitive;
  edge: 'left'|'right'|'top'|'bottom';
  concurrent?: Primitive;
  start: number;
  travel: number;
  work: number;
  duration: number;
  targets: string[];
  children: Record<string,number>;
  before: KernelState;
  after: KernelState;
}
const timing: Record<Primitive, [number, number]> = {
  arrange: [.85, 2.15], anchor: [0, 0], peel: [.6, 1.75],
  yield: [.6, 1.6], encapsulate: [.55, 1.8], branch: [.85, 2.25],
  merge: [.85, 2.25], permeate: [.6, 1.35],
};
export const ease = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t*t*t*(t*(t*6-15)+10); };
const lerpRect = (a: Rect, b: Rect, t: number): Rect => ({
  x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t,
  w: a.w + (b.w - a.w) * t, h: a.h + (b.h - a.h) * t,
});

/** The very same clock moves the organism and the actual window state. No post-hoc orbit. */
export class PlanPerformance {
  readonly segments: Segment[] = [];
  readonly duration: number;
  readonly final: KernelState;
  constructor(base: KernelState, readonly plan: AgentPlan, context: AgentContext, origin = base, retarget=false) {
    let start = 0, before = origin;
    plan.steps.forEach((step, i) => {
      if(step.type==='anchor')return;
      if(step.type==='merge'){
        const visibleChild=Object.values(before.windows).some(w=>{
          if(!w.props.agentBranch)return false;
          const d=w.props.agentDivision as {born:boolean;amount:number;sourceVisibility?:number}|undefined;
          return !d||(d.born?ease((d.amount-.08)/.45):1-ease((d.amount-.52)/.46))*(d.sourceVisibility??1)>.1;
        });
        if(!visibleChild){
          const windows={...before.windows};
          for(const [id,w] of Object.entries(windows))if(w.props.agentBranch)delete windows[id];
          const ids:string[]=[];
          plan.artifacts.filter(a=>step.artifactIds.includes(a.id)).forEach((artifact,index)=>{
            const sourceId=context.sources.find(source=>artifact.sourceIds.includes(source.id))?.windowId;
            const source=sourceId?before.windows[sourceId]:undefined;if(!source)return;
            const id=`merge-input:${plan.id}:${artifact.id}`;ids.push(id);
            windows[id]={...source,id,title:artifact.title,form:'normal',depth:0,minimized:false,rect:{x:source.rect.x+source.rect.w*.35+index*18,y:source.rect.y+76+index*108,w:Math.min(330,source.rect.w*.8),h:220},props:{agentBranch:{artifact,parentId:plan.primaryTargets[0],parentSnapshot:source,planId:plan.id},agentMergeSeed:true}};
          });
          before={...before,windows,order:[...before.order.filter(id=>windows[id]),...ids]};
        }
      }
      const after = compilePlan(base, { ...plan, steps: plan.steps.slice(0, i + 1) }, context).state;
      const targets = new Set(step.targets);
      if(step.type==='branch')for(const id of Object.keys(after.windows))if(!before.windows[id])targets.add(id);
      for(const id of Object.keys(before.windows))if(!after.windows[id])targets.add(id);
      // Yield acts on the neighbour it displaces, not only the window named in the request.
      for (const [id, w] of Object.entries(after.windows)) {
        const old = before.windows[id];
        if (old && (JSON.stringify(old.rect) !== JSON.stringify(w.rect) || old.depth !== w.depth || old.minimized !== w.minimized)) targets.add(id);
      }
      if (step.type === 'merge') {
        const sourceIds = plan.artifacts.filter(a => step.artifactIds.includes(a.id)).flatMap(a => a.sourceIds);
        context.sources.filter(s => sourceIds.includes(s.id)).forEach(s => targets.add(s.windowId));
      }
      const children: Record<string,number> = {};
      const groups = step.type === 'branch' ? step.branches.map(b=>b.sourceIds)
        : step.type === 'merge' ? plan.artifacts.filter(a=>step.artifactIds.includes(a.id)).map(a=>a.sourceIds) : [];
      for(const group of groups)for(const id of new Set(context.sources.filter(source=>group.includes(source.id)).map(source=>source.windowId)))children[id]=(children[id]??0)+1;
      const [defaultTravel, defaultWork] = timing[step.type];
      const previousReveal=[...targets].some(id=>(before.windows[id]?.props.agentView as {revealed?:boolean}|undefined)?.revealed);
      const travel=retarget?Math.min(previousReveal?.3:.12,defaultTravel):defaultTravel;
      const work=step.type==='encapsulate'?(targets.size-1)*1.08+.98:defaultWork;
      const duration = travel + work + .3;
      this.segments.push({ primitive: step.type, edge: "direction" in step ? step.direction : "edge" in step ? step.edge : "right", start, travel, work, duration, targets: [...targets], children, before, after });
      start += duration; before = after;
    });
    // Translation is a carrier lane: combine it with the next body operation.
    // The side operation retains its own geometry and semantics while the carrier moves.
    const movement=this.segments.find(s=>s.primitive==='arrange');
    const activity=movement?this.segments.find(s=>s.start>movement.start && s.targets.some(id=>movement.targets.includes(id))):undefined;
    if(movement && activity){
      const geometry=movement.after;
      movement.concurrent=activity.primitive;
      movement.edge=activity.edge;
      movement.children=activity.children;
      movement.targets=[...new Set([...movement.targets,...activity.targets])];
      movement.after={...activity.after,windows:Object.fromEntries(Object.entries(activity.after.windows).map(([id,w])=>[id,{...w,rect:activity.primitive==='yield'?w.rect:geometry.windows[id]?.rect??w.rect}]))};
      movement.work=Math.max(1.7,movement.work,activity.work);
      movement.duration=movement.travel+movement.work+.3;
      this.segments.splice(this.segments.indexOf(activity),1);
      let cursor=0;for(const s of this.segments){s.start=cursor;cursor+=s.duration;}start=cursor;
    }
    this.final = compilePlan(base, plan, context).state;
    const geometryChanged=Object.keys(origin.windows).length!==Object.keys(this.final.windows).length||Object.entries(origin.windows).some(([id,w])=>{
      const to=this.final.windows[id];return !to||JSON.stringify(w.rect)!==JSON.stringify(to.rect)||w.depth!==to.depth||w.form!==to.form||w.minimized!==to.minimized||!!(w.props.agentView as {revealed?:boolean}|undefined)?.revealed!==!!(to.props.agentView as {revealed?:boolean}|undefined)?.revealed;
    });
    if(!this.segments.length && geometryChanged){
      const targets=[...new Set([...Object.keys(origin.windows),...Object.keys(this.final.windows)])];
      this.segments.push({primitive:'anchor',edge:'right',start:0,travel:0,work:.5,duration:.7,targets,children:{},before:origin,after:this.final});start=.7;
    }
    this.duration = start;
  }
  at(seconds: number) {
    const segment = this.segments.find(s => seconds < s.start + s.duration);
    if (!segment) return { state: this.final, motion: null, done: true };
    const age = Math.max(0, seconds - segment.start);
    const linear = Math.max(0,Math.min(1,(age-segment.travel)/segment.work));
    const globalAction = ease(linear);
    const progress = Math.min(1, age / segment.duration);
    const globalArrival = segment.travel?ease(age / segment.travel):1;
    const windows = { ...segment.before.windows };
    const allIds=new Set([...Object.keys(segment.before.windows),...Object.keys(segment.after.windows)]);
    for (const id of allIds) {
      const queue=segment.primitive==='encapsulate';
      const queueIndex=segment.targets.indexOf(id);
      const itemAge=queue?age-Math.max(0,queueIndex)*1.08:age;
      const itemLinear=queue?Math.max(0,Math.min(1,(itemAge-segment.travel)/.98)):linear;
      const action=queue?ease(itemLinear):globalAction;
      const arrival=queue?ease(itemAge/segment.travel):globalArrival;
      const target=segment.after.windows[id],prior=segment.before.windows[id];
      const child=(target??prior).props.agentBranch as {parentId:string}|undefined;
      const parent=child?segment.before.windows[child.parentId]:undefined;
      const born=!!target&&!prior,absorbed=!!prior&&!target;
      const ordinal=((target??prior).props.agentBranch as {ordinal?:number}|undefined)?.ordinal??0;
      const left=parent&&target?target.rect.x<parent.rect.x:false;
      const birthRect=parent&&target?{...target.rect,x:left?parent.rect.x-target.rect.w*.08:parent.rect.x+parent.rect.w-target.rect.w*.92,y:parent.rect.y+parent.rect.h*.12+ordinal*36}:target?.rect;
      const next=target??{...prior,rect:parent?{...prior.rect,x:parent.rect.x+(parent.rect.w-prior.rect.w)*.5,y:parent.rect.y+(parent.rect.h-prior.rect.h)*.5}:prior.rect};
      const old=prior??{...next,rect:birthRect!};
      const previousDivision=old.props.agentDivision as {born:boolean;amount:number;sourceVisibility?:number}|undefined;
      const previousOpacity=previousDivision?(previousDivision.born?ease((previousDivision.amount-.08)/.45):1-ease((previousDivision.amount-.52)/.46))*(previousDivision.sourceVisibility??1)*(old.props.agentMergeSeed?ease(previousDivision.amount/.16):1):1;
      if(absorbed&&action>=1){delete windows[id];continue;}
      if (!segment.targets.includes(id)) continue;
      const capsule = segment.primitive === 'encapsulate'
        ? segment.targets.map(id => segment.after.windows[id]).find(w => w?.form === 'capsule' && w.capsuleRect)?.capsuleRect : undefined;
      const count=queue?Math.min(segment.targets.length,Math.max(1,segment.targets.reduce((sum,_,i)=>sum+ease(((age-i*1.08-segment.travel)/.98-.58)/.42),0))):1;
      const packetSize=capsuleSize(queueIndex+1),receiverSize=capsuleSize(count);
      const queueTarget=capsule?{x:capsule.x+capsule.w-packetSize.w,y:capsule.y,w:packetSize.w,h:packetSize.h}:undefined;
      const to = queueTarget ?? (next.form === 'capsule' && next.capsuleRect ? next.capsuleRect : next.rect);
      const hiddenContainer=old.minimized?Object.values(segment.before.windows).find(w=>(w.props.agentCapsule as {members:{id:string}[]}|undefined)?.members.some(member=>member.id===id)):undefined;
      const from = hiddenContainer?.capsuleRect ?? (old.form === 'capsule' && old.capsuleRect ? old.capsuleRect : old.rect);
      const boundary=boundaryChange(from,to);
      const relocating = segment.primitive !== 'encapsulate' &&
        ((boundary.kind==='move'&&Math.max(...Object.values(boundary.deltas).map(Math.abs))>3) || Math.abs(next.depth-old.depth)>.03);
      const coverage=relocating && !born && !absorbed?ease(linear/.42)*(1.-ease((linear-.84)/.16)):0;
      const travelProgress=queue?ease((itemLinear-.24)/.64):born||absorbed?action:relocating?ease((linear-.42)/.42):action;
      const rect=lerpRect(from,to,travelProgress);
      if(queue){
        const dx=to.x-from.x,dy=to.y-from.y,len=Math.max(1,Math.hypot(dx,dy));
        const bend=Math.sin(Math.PI*travelProgress)*Math.min(62,len*.16)*(queueIndex%2?1:-1);
        rect.x-=dy/len*bend;rect.y+=dx/len*bend;
      }
      const vx = to.x + to.w / 2 - from.x - from.w / 2, vy = to.y + to.h / 2 - from.y - from.h / 2;
      const length = Math.max(1, Math.hypot(vx, vy));
      const segmentIndex = this.segments.indexOf(segment);
      const primaryId = this.plan.primaryTargets[0];
      const bodyOperation=segment.concurrent??segment.primitive;
      const splitFlow = bodyOperation === 'branch' || bodyOperation === 'merge';
      const docked = segment.primitive==='anchor'||(splitFlow ? id === primaryId : this.segments.slice(0,segmentIndex).some(s => s.targets.includes(id)));
      let pullDirection:[number,number]=[vx/length,vy/length];
      if(splitFlow&&id===primaryId&&Math.hypot(vx,vy)<3){
        const child=Object.values(bodyOperation==='branch'?segment.after.windows:segment.before.windows).find(w=>(w.props.agentBranch as {parentId:string}|undefined)?.parentId===id);
        if(child){const dx=child.rect.x+child.rect.w*.5-from.x-from.w*.5,dy=child.rect.y+child.rect.h*.5-from.y-from.h*.5,l=Math.max(1,Math.hypot(dx,dy));pullDirection=[dx/l,dy/l];}
      }
      const departure = bodyOperation === 'branch' ? segment.before.windows[primaryId]?.rect
        : bodyOperation === 'merge' ? old.rect : undefined;
      const motion: AgentMotion = { boundary, primitive: segment.primitive, concurrent:segment.concurrent, edge:segment.edge, transport:{coverage,progress:travelProgress,active:relocating}, docked, departure, elapsed: itemAge, travelDuration: Math.max(.01,segment.travel), action, arrival, contactAge: docked ? -1 : itemAge - segment.travel, progress,
        seed: this.segments.indexOf(segment) * 3.17 + segment.targets.indexOf(id) * 1.71,
        index: segment.targets.indexOf(id), count: segment.targets.length, childCount: Math.min(3,segment.children[id]??1), from, to, direction: pullDirection };
      const oldView=old.props.agentView as {revealed?:boolean;planId?:string}|undefined;
      const nextView=next.props.agentView as {revealed?:boolean;planId?:string}|undefined;
      const exitingReveal=oldView?.revealed&&(!nextView?.revealed||oldView.planId!==nextView.planId);
      const oldMotion=old.props.agentMotion as AgentMotion|undefined;
      const oldReveal=Number(old.props.agentRevealProgress??((oldMotion?.primitive==='peel'||oldMotion?.concurrent==='peel')?ease((oldMotion.action-.12)/.88):1));
      const revealExit=exitingReveal?oldReveal*(1-ease(Math.max(0,itemAge)/(segment.travel||segment.work))):undefined;
      const keepOldReveal=exitingReveal&&(itemAge<segment.travel||!nextView?.revealed&&action<1);
      const mergedCount=queue?segment.targets.filter((_,i)=>age-i*1.08>=segment.travel+.98).length:0;
      const incoming=queue?Math.max(0,...segment.targets.map((_,i)=>{
        const q=Math.max(0,Math.min(1,(age-i*1.08-segment.travel)/.98));
        return Math.sin(Math.PI*ease((q-.58)/.42));
      })):0;
      // Minimize / replace the content only after the wrapping organism has closed its shell.
      const unwrapping=old.form==='capsule'&&next.form!=='capsule';
      windows[id] = { ...old, rect, ...(unwrapping?{form:'normal' as const}:{}), ...(old.minimized&&!next.minimized?{minimized:false}:{}), depth: old.depth + (next.depth - old.depth) * action,
        ...(action >= 1 ? { form:next.form,capsuleRect:queue&&capsule&&next.form==='capsule'?{x:capsule.x+capsule.w-receiverSize.w,y:capsule.y,w:receiverSize.w,h:receiverSize.h}:next.capsuleRect,minimized:next.minimized } : {}),
        props: { ...(itemAge >= segment.travel ? next.props : old.props), agentMotion: motion,
          ...(unwrapping||hiddenContainer?{agentReentry:{amount:action,source:unwrapping?old.props.agentCapsule:undefined,rect:from}}:{}),
          ...(keepOldReveal?{agentView:old.props.agentView,agentRevealProgress:revealExit}: {agentRevealProgress:undefined}),
          ...(queue?{agentQueue:{index:queueIndex,total:segment.targets.length,amount:action,travel:travelProgress,waiting:itemAge<segment.travel,mergedCount,incoming,fill:count}}:{}), ...(born||absorbed?{agentDivision:{born,absorbed,amount:action,sourceVisibility:born?1:previousOpacity}}:{}),
          ...(old.props.agentMergeSeed?{agentMergeSeed:bodyOperation==='merge'?true:undefined}:{}) } };
    }
    return { state: { ...segment.before, windows,order:[...segment.before.order.filter(id=>windows[id]),...Object.keys(windows).filter(id=>!segment.before.order.includes(id))] }, motion: { primitive: segment.primitive, progress, action:globalAction, arrival:globalArrival }, done: false };
  }
}
