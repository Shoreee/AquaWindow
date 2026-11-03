import type {AgentContext,AgentPlan,RewardProvider} from './types';
/** Measured human costs must come from experiments, never model-authored confidence. */
export interface TechniqueEstimate {technique:string;contextFeatures:Record<string,number|boolean>;timeMs?:number;errorRate?:number;restorationMs?:number;source:{studyId:string;version:string};uncertainty?:number}
export interface ExperimentalEvidence {estimate(context:AgentContext,plan:AgentPlan):TechniqueEstimate|null}
export const pendingEvidence:ExperimentalEvidence={estimate:()=>null};
export const pendingReward:RewardProvider={evaluate:()=>null};
/** Existing manual mechanisms only; availability is a precondition, not a diversity quota. */
export function capabilityRejection(plan:AgentPlan,ctx:AgentContext):string|null{
 if(plan.artifacts.length)return 'generated_content_not_allowed';
 const allowed=new Set(ctx.windows.map(w=>w.id));
 for(const step of plan.steps){
  if(!['arrange','encapsulate','permeate','fuse','corner-peel','region'].includes(step.type))return 'unsupported_action';
  if(step.targets.some(id=>!allowed.has(id)))return 'missing_window';
  if(['fuse','corner-peel','region'].includes(step.type)&&step.targets.some(id=>!ctx.windows.find(w=>w.id===id)?.capabilities?.includes(step.type)))return 'action_unavailable';
  if(step.type==='fuse'){
   const a=ctx.windows.find(w=>w.id===step.movingId),b=ctx.windows.find(w=>w.id===step.fixedId);
   if(a?.group&&a.group===b?.group)return 'already_fused';
  }
  if(step.type==='region'){const window=ctx.windows.find(w=>w.id===step.targets[0]),region=window?.regions?.find(r=>r.id===step.regionId);if(!region)return 'region_not_observed';if(step.mode==='hole'&&region.kind!=='hole'&&!ctx.selectedIds.includes(step.targets[0]))return 'region_requires_explicit_selection';}
 }
 return null;
}
export function permittedPlans(plans:AgentPlan[],ctx:AgentContext):AgentPlan[]{return plans.filter(plan=>capabilityRejection(plan,ctx)===null);}
