import type {
  AgentContext,
  AgentPlan,
  Artifact,
  Edge,
  PrimitiveStep,
} from "./types";


const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, n = 800): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= n;
const fraction = (v: unknown, min = 0, max = 1): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const edge = (v: unknown): v is Edge =>
  ["left", "right", "top", "bottom"].includes(String(v));
const ids = (
  v: unknown,
  allowed: Set<string>,
  min = 0,
  max = 16,
): v is string[] =>
  Array.isArray(v) &&
  v.length >= min &&
  v.length <= max &&
  v.every((x) => typeof x === "string" && allowed.has(x)) &&
  new Set(v).size === v.length;

/** Reject a whole malformed candidate: silently dropping a branch changes its meaning. */
export function validatePlans(value: unknown, ctx: AgentContext): AgentPlan[] {
  if (!record(value) || !Array.isArray(value.plans)) return [];
  const windows = new Set(ctx.windows.map((w) => w.id)),
    sources = new Set(ctx.sources.map((s) => s.id));
  const result: AgentPlan[] = [];
  for (const p of value.plans.slice(0, 7)) {
    if (
      !record(p) ||
      !str(p.id, 80) ||
      !str(p.title, 80) ||
      !str(p.rationale, 400) ||
      !fraction(p.priority) ||
      !fraction(p.confidence) ||
      !ids(p.primaryTargets, windows, 1) ||
      !ids(p.supportTargets, windows) ||
      !ctx.selectedIds.every((id) =>
        (p.primaryTargets as string[]).includes(id),
      )
    )
      continue;
    if (
      !Array.isArray(p.artifacts) ||
      p.artifacts.length > 5 ||
      !Array.isArray(p.steps) ||
      !p.steps.length ||
      p.steps.length > 7
    )
      continue;
    const artifacts: Artifact[] = [];
    for (const a of p.artifacts) {
      if (
        !record(a) ||
        !str(a.id, 80) ||
        !str(a.title, 120) ||
        !str(a.body, 1000) ||
        !["evidence", "comparison", "files", "summary"].includes(
          String(a.kind),
        ) ||
        !ids(a.sourceIds, sources, 1)
      )
        break;
      artifacts.push(a as unknown as Artifact);
    }
    const artifactIds = new Set(artifacts.map((a) => a.id));
    if (
      artifacts.length !== p.artifacts.length ||
      artifactIds.size !== artifacts.length
    )
      continue;
    const permitted = new Set([
      ...p.primaryTargets,
      ...p.supportTargets,
    ] as string[]);
    const steps: PrimitiveStep[] = [];
    for (const s of p.steps) {
      if (!record(s) || !ids(s.targets, permitted, 1)) break;
      let valid = false;
      switch (s.type) {
        case "arrange":
          valid = (s.layout === "compare" || s.layout === "focus")
            &&(s.axis===undefined||s.axis==='x'||s.axis==='y')
            &&(s.order===undefined||ids(s.order,new Set(s.targets as string[]),(s.targets as string[]).length,(s.targets as string[]).length))
            &&(s.weights===undefined||Array.isArray(s.weights)&&s.weights.length===(s.targets as string[]).length&&s.weights.every(w=>fraction(w,.05,20)))
            &&(s.anchorId===undefined||typeof s.anchorId==='string'&&(s.targets as string[]).includes(s.anchorId))
            &&(s.share===undefined||fraction(s.share,.3,.8));
          break;
        case 'fuse':
          valid=(s.targets as string[]).length===2&&typeof s.movingId==='string'&&typeof s.fixedId==='string'&&s.movingId!==s.fixedId&&(s.targets as string[]).includes(s.movingId)&&(s.targets as string[]).includes(s.fixedId);break;
        case 'corner-peel':
          valid=(s.targets as string[]).length===1&&['top-left','top-right','bottom-left','bottom-right'].includes(String(s.corner))&&fraction(s.amount,.08,.4);break;
        case 'region':
          valid=(s.targets as string[]).length===1&&(s.mode==='preserve'||s.mode==='hole')&&str(s.regionId,100)&&!!ctx.windows.find(w=>w.id===(s.targets as string[])[0])?.regions?.some(r=>r.id===s.regionId);break;
        case "anchor":
          valid = edge(s.edge) && ids(s.artifactIds, artifactIds);
          break;
        case "peel":
          valid =
            edge(s.edge) &&
            fraction(s.extent, 0.2, 0.45) &&
            ids(s.artifactIds, artifactIds) && (s.mode===undefined||s.mode==="edge"||s.mode==="hole");
          break;
        case "yield":
          valid = edge(s.direction) && fraction(s.amount, 0.1, 0.4);
          break;
        case "encapsulate":
          valid = edge(s.edge);
          break;
        case "permeate":
          valid = fraction(s.depth, 0, 0.6) && ids(s.artifactIds, artifactIds);
          break;
        case "branch":
          valid =
            Array.isArray(s.branches) &&
            s.branches.length >= 2 &&
            s.branches.length <= 3 &&
            new Set(s.branches.map((b) => (record(b) ? b.id : null))).size ===
              s.branches.length &&
            s.branches.every(
              (b) =>
                record(b) &&
                str(b.id, 80) &&
                typeof b.targetId === "string" &&
                (s.targets as string[]).includes(b.targetId) &&
                ids(b.sourceIds, sources, 1) &&
                typeof b.artifactId === "string" &&
                artifactIds.has(b.artifactId) &&
                b.sourceIds.every((id) =>
                  artifacts
                    .find((a) => a.id === b.artifactId)!
                    .sourceIds.includes(id),
                ),
            );
          break;
        case "merge":
          valid =
            ids(s.artifactIds, artifactIds, 1) &&
            typeof s.resultId === "string" &&
            artifactIds.has(s.resultId) &&
            !(s.artifactIds as string[]).includes(s.resultId) &&
            (s.artifactIds as string[]).every((id) =>
              artifacts
                .find((a) => a.id === id)!
                .sourceIds.every((source) =>
                  artifacts
                    .find((a) => a.id === s.resultId)!
                    .sourceIds.includes(source),
                ),
            );
          break;
      }
      if (!valid) break;
      steps.push(s as unknown as PrimitiveStep);
    }
    if (steps.length !== p.steps.length) continue;
    const allTargets = new Set(steps.flatMap((s) => s.targets));
    if (
      !(p.primaryTargets as string[]).every((id) => allTargets.has(id)) ||
      result.some((r) => r.id === p.id)
    )
      continue;
    result.push({
      id: p.id,
      title: p.title,
      rationale: p.rationale,
      priority: p.priority,
      confidence: p.confidence,
      primaryTargets: p.primaryTargets,
      supportTargets: p.supportTargets,
      steps,
      artifacts,
    });
  }
  return result.sort((a, b) => b.priority - a.priority);
}

export interface PlanRejection {id:string;stage:'protocol'|'capability'|'geometry';reason:string}
/** Report filtering without relaxing schema checks just to retain more candidates. */
export function inspectPlans(value:unknown,ctx:AgentContext){
 const plans=validatePlans(value,ctx),accepted=new Set(plans.map(p=>p.id)),rejections:PlanRejection[]=[];
 if(!record(value)||!Array.isArray(value.plans))return {plans,rejections:[{id:'response',stage:'protocol' as const,reason:'plans_array_missing'}]};
 for(const raw of value.plans.slice(0,7)){
  if(record(raw)&&accepted.has(String(raw.id)))continue;
  let reason='invalid_parameters_or_references';
  if(record(raw)&&Array.isArray(raw.steps)){
   const artifacts=new Set(Array.isArray(raw.artifacts)?raw.artifacts.filter(record).map(a=>a.id):[]);
   if(raw.steps.some(s=>record(s)&&Array.isArray(s.artifactIds)&&s.artifactIds.some(id=>!artifacts.has(id))))reason='artifactIds_must_reference_artifacts_not_sourceIds';
   else if(raw.steps.some(s=>record(s)&&Array.isArray(s.targets)&&s.targets.some(id=>!ctx.windows.some(w=>w.id===id))))reason='target_window_missing';
   else if(raw.steps.some(s=>record(s)&&s.type==='region'&&!ctx.windows.some(w=>w.regions?.some(r=>r.id===s.regionId))))reason='region_not_observed';
  }
  rejections.push({id:record(raw)?String(raw.id??'unknown'):'unknown',stage:'protocol',reason});
 }
 return {plans,rejections};
}
