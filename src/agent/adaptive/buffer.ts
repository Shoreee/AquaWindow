import {compactContext} from './workspace';
import {agentFetch} from './deepseekClient';
import {canReuseContext} from './reuse';
import {contextDelta,type PlanningPacket} from './planningIO';
import {capabilityRejection} from './policy';
import {diagnose,planIds} from './diagnostics';
import { inspectPlans,validatePlans } from "./protocol";
import type {
  AgentContext,
  AgentPlan,
  PlanBuffer,
  RewardProvider,
} from "./types";
import { unconfiguredReward } from "./types";

export type ServiceStatus =
  | "local"
  | "warming"
  | "thinking"
  | "ready"
  | "unconfigured"
  | "auth"
  | "limited"
  | "busy"
  | "timeout"
  | "invalid"
  | "offline";
export const statusMessages: Record<ServiceStatus, string> = {
  local: "DeepSeek 未开启",
  warming: "正在感知工作区",
  thinking: "正在自适应布局",
  ready: "已准备好",
  unconfigured: "请在右下角设置中填写 DeepSeek Key",
  auth: "DeepSeek 密钥无效或已失效",
  limited: "DeepSeek 暂时限流，请稍后重试",
  busy:"DeepSeek 服务繁忙",
  timeout: "DeepSeek 响应超时",
  invalid: "方案未通过校验，正在等待下一次更新",
  offline: "无法连接 Agent 服务",
};

export class CandidateBuffer {
  entries = new Map<string, PlanBuffer>();
  status: ServiceStatus = "local";
  remoteEnabled = false;
  private generation = 0;
  onChange: () => void = () => {};
  onInterpretation: (value:unknown,context:AgentContext)=>void=()=>{};
  private queued: {
    context: AgentContext;
    at: number;
    urgent: boolean;
  } | null = null;
  private inflight: AbortController | null = null;
  private inflightKey = "";
  private inflightContext:AgentContext|null=null;
  private requestSequence=0;
  /** Runtime supplies capability validation. Only real model results enter this buffer. */
  filter=(plans:AgentPlan[],_context:AgentContext)=>plans;
  private lastCall = -Infinity;
  private lastRequested = "";
  private stopped = false;
  private lastReuse='';
  constructor(
    private fetcher: typeof fetch = agentFetch,
    private now: () => number = () => performance.now(),
    public reward: RewardProvider = unconfiguredReward,
  ) {}
  setRemoteEnabled(enabled: boolean) {
    if (this.remoteEnabled === enabled) return;
    this.remoteEnabled = enabled;
    this.generation++;
    this.queued = null;
    this.requestSequence++;
    this.inflight?.abort();
    this.inflight = null;
    this.inflightKey = "";
    this.inflightContext=null;
    this.lastRequested = "";
    this.lastCall = -Infinity;
    this.entries.clear();
    this.status = enabled ? "warming" : "local";
    this.onChange();
  }
  remotePlans(context:AgentContext):AgentPlan[]|null{
    if(!this.remoteEnabled)return null;
    const plans=this.cached(context);
    return plans?.map(plan=>({...plan,origin:'deepseek' as const}))??null;
  }
  get(context:AgentContext):AgentPlan[]|null{return this.remotePlans(context);}
  private cached(context:AgentContext):AgentPlan[]|null{
    if(!this.remoteEnabled)return null;
    for(const entry of [...this.entries.values()].reverse()){
      if(this.now()-entry.generatedAt>60000||!canReuseContext(entry.context,context))continue;
      const valid=this.rank(validatePlans({plans:entry.plans},context),context);
      if(valid.length||entry.plans.length===0){const stamp=`${context.key}:${entry.generatedAt}`;if(this.lastReuse!==stamp){this.lastReuse=stamp;diagnose('reuse',context,{acceptedIds:planIds(valid)});}return valid;}
    }
    return null;
  }
  private identity(context:AgentContext){return JSON.stringify([context.key,context.focusedId,context.work,context.windows.map(w=>[w.id,w.rect,w.depth])]);}
  cancelContext(context:AgentContext){
    const identity=this.identity(context);
    if(this.inflightKey===identity){this.requestSequence++;this.inflight?.abort();this.inflight=null;this.inflightKey='';this.inflightContext=null;}
    if(this.queued&&this.identity(this.queued.context)===identity)this.queued=null;
    this.status='timeout';this.onChange();
  }
  private rank(plans: AgentPlan[], ctx: AgentContext) {
    return [...this.filter(plans,ctx)].sort(
      (a, b) =>
        (this.reward.evaluate(ctx, b)?.score ?? b.priority) -
        (this.reward.evaluate(ctx, a)?.score ?? a.priority),
    );
  }
  request(context: AgentContext, urgent = false) {
    if(!this.remoteEnabled)return;
    const entry=[...this.entries.values()].reverse().find(entry=>canReuseContext(entry.context,context)&&(entry.plans.length===0||this.rank(validatePlans({plans:entry.plans},context),context).length>0));
    if(entry&&this.now()-entry.generatedAt<(urgent?60000:30000))return;
    const identity=this.identity(context);
    if(this.inflightKey===identity||this.inflightContext&&canReuseContext(this.inflightContext,context)&&JSON.stringify(this.inflightContext.selectedIds)===JSON.stringify(context.selectedIds))return;
    if(urgent&&this.inflight){
      this.requestSequence++;this.inflight.abort();this.inflight=null;this.inflightKey='';this.inflightContext=null;
    }
    if(this.queued&&this.identity(this.queued.context)===identity){if(urgent){this.queued.urgent=true;this.queued.at=-Infinity;this.tick();}return;}
    if (
      !urgent &&
      identity === this.lastRequested &&
      this.now() - this.lastCall < 30000
    )
      return;
    this.queued = { context, at: urgent?-Infinity:this.now(), urgent };
    if(urgent)this.tick();
  }
  tick() {
    const job = this.queued;
    if (
      !this.remoteEnabled ||
      !job ||
      this.inflight ||
      this.stopped ||
      this.now() - job.at < (job.urgent ? 600 : 1200) ||
      (!job.urgent && this.now() - this.lastCall < 8000)
    )
      return;
    this.queued = null;
    void this.run(job.context);
  }
  private async run(context: AgentContext) {
    if (!this.remoteEnabled || this.stopped) return;
    const generation = this.generation,sequence=++this.requestSequence;
    const controller = new AbortController();
    this.inflight = controller;
    this.inflightKey = this.identity(context);
    this.inflightContext=context;
    this.lastCall = this.now();
    this.lastRequested = this.identity(context);
    this.status = "thinking";
    this.onChange();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const wireContext=compactContext(context);
      const previous=[...this.entries.values()].reverse().find(entry=>entry.referenceId&&entry.wireContext);
      let packet:PlanningPacket=previous?{baseId:previous.referenceId!,delta:contextDelta(previous.wireContext!,wireContext)}:{context:wireContext};
      const send=()=>this.fetcher('/api/agent/plan',{method:'POST',headers:{'content-type':'application/json','x-aw-deepseek':'enabled'},body:JSON.stringify(packet),signal:controller.signal});
      diagnose('request',context,{requestMode:'baseId' in packet?'delta':'full',windowCount:wireContext.windows.length,sourceCharacters:wireContext.sources.reduce((n,s)=>n+s.text.length,0)});
      let response=await send();
      // An evicted server reference is a transport cache miss, never a local-plan fallback.
      if(response.status===409){packet={context:wireContext};response=await send();}
      const data = (await response.json()) as {
        rawIds?:string[];
        traceId?:string;
        rejections?:import('./protocol').PlanRejection[];
        referenceId?:string;
        interpretation?:unknown;
        plans?: unknown[];
        error?: string;
      };
      if (generation !== this.generation || sequence!==this.requestSequence || controller.signal.aborted) return;
      if (!response.ok) {
        diagnose('error',context,{message:data.error??String(response.status)});
        this.status =
          data.error === "unconfigured"
            ? "unconfigured"
            : data.error==='busy'||response.status===503?'busy'
            : response.status === 401
              ? "auth"
              : response.status === 429
                ? "limited"
                : response.status === 504
                  ? "timeout"
                  : data.error === "invalid"
                    ? "invalid"
                    : "offline";
      } else {
        const inspected=inspectPlans(data,context),plans=inspected.plans;
        const permitted=this.filter(plans,context);
        const rejections=[...(data.rejections??[]),...inspected.rejections,...plans.filter(p=>!permitted.some(v=>v.id===p.id)).map(p=>({id:p.id,stage:(capabilityRejection(p,context)?'capability':'geometry') as 'capability'|'geometry',reason:capabilityRejection(p,context)??'layout_out_of_bounds_or_unreadable'}))];
        diagnose('response',context,{traceId:data.traceId,rawIds:data.rawIds??(Array.isArray(data.plans)?data.plans.map(p=>p&&typeof p==='object'&&typeof (p as {id?:unknown}).id==='string'?String((p as {id:string}).id):'unknown'):[]),acceptedIds:planIds(permitted),rejections});
        if (!Array.isArray(data.plans) || (data.plans.length && !plans.length))
          this.status = "invalid";
        else {
          this.onInterpretation(data.interpretation,context);
          this.entries.delete(context.key);
          this.entries.set(context.key, {
            context,
            referenceId:typeof data.referenceId==='string'?data.referenceId:undefined,
            wireContext,
            plans,
            generatedAt: this.now(),
          });
          while (this.entries.size > 6)
            this.entries.delete(this.entries.keys().next().value!);
          this.status = "ready";
        }
      }
    } catch {
      if (!this.stopped && generation === this.generation && sequence===this.requestSequence)
        this.status = controller.signal.aborted ? "timeout" : "offline";
    } finally {
      clearTimeout(timeout);
      if (generation !== this.generation||sequence!==this.requestSequence) return;
      this.inflight = null;
      this.inflightKey = "";
      this.inflightContext=null;
      if (!this.stopped) this.onChange();
    }
  }
  start() {
    this.stopped = false;
  }
  stop() {
    this.stopped = true;
    this.requestSequence++;
    this.inflightKey="";
    this.inflightContext=null;
    this.queued = null;
    this.inflight?.abort();
    this.inflight=null;
  }
}
