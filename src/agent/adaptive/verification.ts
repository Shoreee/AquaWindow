import type {AgentContext,AgentPlan} from './types';
import type {KernelState} from '../../kernel/types';
import {compilePlan} from './compiler';
export interface CandidateGeometry {movedWindows:number;translationPx:number;resizedWindows:number;minimizedWindows:number}
/** Geometric transition checks are deterministic. These diagnostics are not a fitted user reward. */
export function verifyCandidate(base:KernelState,plan:AgentPlan,ctx:AgentContext):CandidateGeometry|null{
 const ids=[...plan.primaryTargets,...plan.supportTargets,...plan.steps.flatMap(s=>s.targets)];
 if(ids.some(id=>!base.windows[id]||base.windows[id].appId==='experiment'||base.windows[id].role==='system'))return null;
 let after:KernelState;try{after=compilePlan(base,plan,ctx).state;}catch{return null;}
 if(Object.keys(after.windows).length!==Object.keys(base.windows).length)return null;
 let effect=false;
 const metrics:CandidateGeometry={movedWindows:0,translationPx:0,resizedWindows:0,minimizedWindows:0};
 for(const [id,previous] of Object.entries(base.windows)){
  const next=after.windows[id];if(!next||next.appId!==previous.appId||next.title!==previous.title||next.props.resource!==previous.props.resource||next.props.docId!==previous.props.docId||next.props.studyDocumentId!==previous.props.studyDocumentId)return null;
  if(next.group!==previous.group||next.form!==previous.form||next.minimized!==previous.minimized||next.depth!==previous.depth||JSON.stringify(next.importance)!==JSON.stringify(previous.importance)||JSON.stringify(next.props.agentCornerFold)!==JSON.stringify(previous.props.agentCornerFold))effect=true;
  const r=next.rect,changed=JSON.stringify(r)!==JSON.stringify(previous.rect);
  if(changed&&(![r.x,r.y,r.w,r.h].every(Number.isFinite)||r.w<=0||r.h<=0||r.x<ctx.work.x-.5||r.y<ctx.work.y-.5||r.x+r.w>ctx.work.x+ctx.work.w+.5||r.y+r.h>ctx.work.y+ctx.work.h+.5))return null;
  if(changed)effect=true;
  const distance=Math.hypot(r.x-previous.rect.x,r.y-previous.rect.y);
  if(distance>.5){metrics.movedWindows++;metrics.translationPx+=distance;}
  if(Math.abs(r.w-previous.rect.w)>.5||Math.abs(r.h-previous.rect.h)>.5)metrics.resizedWindows++;
  if(next.minimized&&!previous.minimized)metrics.minimizedWindows++;
 }
 return effect?metrics:null;
}
