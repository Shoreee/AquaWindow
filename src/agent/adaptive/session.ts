import {diagnose,planIds} from './diagnostics';
import type { KernelState } from "../../kernel/types";
import type { WindowKernel } from "../../kernel/kernel";
import { createStore } from "../../system/createStore";
import { PlanPerformance } from "./choreography";
import type { AgentContext, AgentPlan } from "./types";

export type Phase =
  | "idle"
  | "charging"
  | "hatching"
  | "waiting"
  | "cycling"
  | "frozen"
  | "applying"
  | "returning";
export interface SessionState {
  phase: Phase;
  selectedIds: string[];
  startedAt: number;
  deadline: number;
  index: number;
  plans: AgentPlan[];
  plan: AgentPlan | null;
  burstAt: number;
  message: string;
  performing: boolean;
  operation: string;
}
export const sessionInitial = (): SessionState => ({
  phase: "idle",
  selectedIds: [],
  startedAt: 0,
  deadline: 0,
  index: 0,
  plans: [],
  plan: null,
  burstAt: 0,
  message: "",
  performing: false,
  operation: "",
});
export interface SessionHost {
  kernel: WindowKernel;
  context(selected: string[]): AgentContext;
  plans(context: AgentContext): AgentPlan[] | null;
  request(context: AgentContext): void;
  refinements?(context:AgentContext):AgentPlan[]|null;
  timeout?(context:AgentContext):void;
  failure?():string|undefined;
  feedback(plan: AgentPlan, accepted: boolean): void;
  notify(message: string): void;
  reducedMotion?(): boolean;
}
export class AdaptationSession {
  store = createStore(sessionInitial());
  private base: KernelState | null = null;
  private ctx: AgentContext | null = null;
  private performance: PlanPerformance | null = null;
  private performanceAt = 0;
  private pendingConfirm = false;
  private releasedWhileWaiting=false;
  constructor(
    private host: SessionHost,
    private now: () => number = () => performance.now(),
  ) {}
  get active() {
    return this.store.get().phase !== "idle";
  }
  press() {
    const s = this.store.get();
    if (s.phase === "frozen") return this.confirm();
    if (this.active) return;
    this.releasedWhileWaiting=false;
    this.base = this.host.kernel.getState();
    const selectedIds: string[] = [];
    this.ctx = this.host.context(selectedIds);
    const t = this.now();
    this.store.set({
      ...sessionInitial(),
      phase: "charging",
      selectedIds,
      startedAt: t,
      deadline: t + 2500,
    });
    this.host.request(this.ctx);
  }
  select(id: string | null) {
    const s = this.store.get();
    if (!["charging", "hatching", "waiting"].includes(s.phase)) return;
    const selectedIds = id
      ? s.selectedIds.includes(id)
        ? s.selectedIds.filter((x) => x !== id)
        : [...s.selectedIds, id]
      : [];
    if(selectedIds.length>8){this.host.notify("一次最多选择 8 个窗口");return;}
    this.ctx = this.host.context(selectedIds);
    this.store.set({
      selectedIds,
      deadline: this.now() + 2500,
      phase: this.now() - s.startedAt >= 420 ? "hatching" : "charging",
    });
    this.host.request(this.ctx);
  }
  release() {
    const s=this.store.get();
    if(s.phase==='cycling'){
      this.store.set({phase:'applying'});
      this.pendingConfirm=true;
      if(!this.performance)this.confirm();
      else this.host.notify(`已接受 · ${s.plan?.title??'当前方案'}`);
    }else if(s.phase==='waiting'||['charging','hatching'].includes(s.phase)&&this.now()-s.startedAt>=2500){this.releasedWhileWaiting=true;this.store.set({phase:'waiting'});}
    else if(['charging','hatching'].includes(s.phase))this.cancel();
  }
  /** Append model results without replacing or moving the current preview. */
  refreshCandidates(){
    const state=this.store.get();
    if(state.phase!=='cycling'||!this.ctx||!this.host.refinements)return;
    const incoming=this.host.refinements(this.ctx);
    if(!incoming?.length)return;
    const existing=new Set(state.plans.filter(plan=>plan.origin==='deepseek').map(plan=>plan.id));
    const additions=incoming.filter(plan=>!existing.has(plan.id)).map(plan=>({...plan,origin:'deepseek' as const}));
    if(additions.length)this.store.set({plans:[...state.plans,...additions].slice(0,8)});
  }
  navigate(direction:number){
    const s=this.store.get();if(!['cycling','frozen'].includes(s.phase)||!s.plans.length)return;
    this.show((s.index+direction+s.plans.length)%s.plans.length);
  }
  advance() {
    const t = this.now();
    if (this.performance) {
      const frame = this.performance.at((t - this.performanceAt) / 1000);
      this.host.kernel.previewState(frame.state);
      const current = this.store.get(), operation = frame.motion?.primitive ?? "";
      if (current.performing !== !frame.done || current.operation !== operation)
        this.store.set({ performing: !frame.done, operation });
      if (frame.done) {
        this.performance = null;
        if(this.store.get().phase==='returning'){
          this.finishCancel();return;
        }
        if (this.pendingConfirm) { this.pendingConfirm = false; this.confirm(); return; }
      }
    }
    const s = this.store.get();
    if(['charging','hatching','waiting'].includes(s.phase)&&this.ctx&&t-s.startedAt>=10000&&this.host.plans(this.ctx)===null){
      const reason=this.host.failure?.()??'模型未返回可用结果';this.host.timeout?.(this.ctx);
      diagnose('timeout',this.ctx,{message:reason});this.cancel(true);this.host.notify(`Error：自适应等待超过 10 秒，${reason}`);return;
    }
    if (s.phase === "charging" && t - s.startedAt >= 420)
      this.store.set({ phase: "hatching" });
    if (
      ["charging", "hatching", "waiting"].includes(s.phase) &&
      t >= s.deadline &&
      this.ctx
    ) {
      const plans = this.host.plans(this.ctx);
      if (plans) {
        if (!plans.length) {
          this.cancel();
          this.host.notify("当前没有可用的布局候选");
          return;
        }
        this.store.set({
          plans:plans.slice(0,7),
          phase: this.releasedWhileWaiting?"frozen":"cycling",
          index: 0,
          burstAt: t,
        });
        diagnose('present',this.ctx,{acceptedIds:planIds(plans)});
        this.show(0);
      }else if(s.phase!=='waiting')this.store.set({phase:'waiting'});
    }
  }

  private show(index: number) {
    if (!this.base || !this.ctx) return;
    const plan = this.store.get().plans[index];
    if (!plan) return;
    this.performance = new PlanPerformance(this.base, plan, this.ctx, this.host.kernel.getState(),!!this.store.get().plan);
    if (this.host.reducedMotion?.()) {
      this.host.kernel.previewState(this.performance.final);
      this.performance = null;
      this.store.set({ index, plan, burstAt: this.now(), performing: false, operation: "" });
      return;
    }
    this.performanceAt = this.now();
    this.host.kernel.previewState(this.performance.at(0).state);
    this.store.set({ index, plan, burstAt: this.now(), performing: true, operation: plan.steps[0]?.type ?? "" });
  }
  confirm() {
    const s = this.store.get();
    if (!["frozen","applying"].includes(s.phase) || !this.base || !s.plan) return;
    if (this.performance) { this.pendingConfirm = true; return; }
    this.host.kernel.commitAdaptation(this.base, `adaptation:${s.plan.title}`);
    if(this.ctx)diagnose('adopt',this.ctx,{acceptedIds:[s.plan.id]});
    this.host.feedback(s.plan, true);
    this.performance = null;
    this.pendingConfirm = false;
    this.store.set(sessionInitial());
    this.base = null;
    this.ctx = null;
    this.host.notify(`已采用 · ${s.plan.title}`);
  }
  private finishCancel(){
    if(this.base)this.host.kernel.previewState(this.base);
    this.performance=null;this.pendingConfirm=false;this.store.set(sessionInitial());this.base=null;this.ctx=null;
  }
  cancel(immediate=false) {
    const s=this.store.get();if(!this.active)return;
    if(s.plan)this.host.feedback(s.plan,false);
    this.pendingConfirm=false;
    if(!immediate&&s.phase!=='returning'&&s.plan&&this.base&&this.ctx&&!this.host.reducedMotion?.()){
      this.performance=new PlanPerformance(this.base,{...s.plan,steps:[]},this.ctx,this.host.kernel.getState(),true);
      this.performanceAt=this.now();this.store.set({phase:'returning',plan:null,performing:true,operation:''});
      if(!this.performance.duration)this.finishCancel();
    }else this.finishCancel();
  }
  /** Invalidate a session rather than resurrecting a window closed externally. */
  invalidate() {
    if (this.base) {
      const current = this.host.kernel.getState();
      const windows = { ...current.windows };
      for (const id of Object.keys(windows)){
        if (this.base.windows[id]) windows[id] = this.base.windows[id];
        else if(windows[id].props.agentBranch)delete windows[id];
      }
      this.host.kernel.previewState({
        ...this.base,
        windows,
        order: [
          ...this.base.order.filter((id) => windows[id]),
          ...current.order.filter((id) => windows[id] && !this.base!.windows[id]),
        ],
        focusedId: windows[this.base.focusedId ?? ""]
          ? this.base.focusedId
          : current.focusedId,
      });
    }
    this.performance = null;
    this.pendingConfirm = false;
    this.store.set(sessionInitial());
    this.base = null;
    this.ctx = null;
  }
}
