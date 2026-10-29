import {agentFetch} from './deepseekClient';
import { localPlans } from "./local";
import { validatePlans } from "./protocol";
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
  | "timeout"
  | "invalid"
  | "offline";
export const statusMessages: Record<ServiceStatus, string> = {
  local: "本地规则模式 · DeepSeek 已关闭",
  warming: "正在感知工作区",
  thinking: "正在更新备选方案",
  ready: "已准备好",
  unconfigured: "请在左上角填写 DeepSeek API Key",
  auth: "DeepSeek 密钥无效或已失效",
  limited: "DeepSeek 暂时限流，请稍后重试",
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
  private queued: {
    context: AgentContext;
    at: number;
    urgent: boolean;
  } | null = null;
  private inflight: AbortController | null = null;
  private inflightKey = "";
  private lastCall = -Infinity;
  private lastRequested = "";
  private stopped = false;
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
    this.inflight?.abort();
    this.inflight = null;
    this.inflightKey = "";
    this.lastRequested = "";
    this.lastCall = -Infinity;
    this.entries.clear();
    this.status = enabled ? "warming" : "local";
    this.onChange();
  }
  get(context: AgentContext): AgentPlan[] | null {
    if (!this.remoteEnabled) return this.rank(validatePlans({ plans: localPlans(context) }, context), context);
    const entry = this.entries.get(context.key);
    if (
      entry &&
      this.now() - entry.generatedAt <= 60000 &&
      entry.context.semanticKey === context.semanticKey
    )
      return this.rank(validatePlans({ plans: entry.plans }, context), context);
    // A global candidate can be reused only if it explicitly covers every selected subject.
    if (context.selectedIds.length)
      for (const cached of this.entries.values()) {
        if (
          cached.context.semanticKey === context.semanticKey &&
          this.now() - cached.generatedAt <= 60000
        ) {
          const plans = validatePlans({ plans: cached.plans }, context);
          if (plans.length) return this.rank(plans, context);
        }
      }
    return null;
  }
  private rank(plans: AgentPlan[], ctx: AgentContext) {
    return [...plans].sort(
      (a, b) =>
        (this.reward.evaluate(ctx, b)?.score ?? b.priority) -
        (this.reward.evaluate(ctx, a)?.score ?? a.priority),
    );
  }
  request(context: AgentContext, urgent = false) {
    if (!this.remoteEnabled) {
      this.entries.set(context.key, { context, plans: localPlans(context), generatedAt: this.now() });
      while (this.entries.size > 6) this.entries.delete(this.entries.keys().next().value!);
      this.status = "local";
      this.onChange();
      return;
    }
    const entry = this.entries.get(context.key);
    if (entry && this.now() - entry.generatedAt < 30000) return;
    if (
      this.inflightKey === context.key ||
      this.queued?.context.key === context.key
    )
      return;
    if (
      !urgent &&
      context.key === this.lastRequested &&
      this.now() - this.lastCall < 30000
    )
      return;
    this.queued = { context, at: this.now(), urgent };
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
    const generation = this.generation;
    const controller = new AbortController();
    this.inflight = controller;
    this.inflightKey = context.key;
    this.lastCall = this.now();
    this.lastRequested = context.key;
    this.status = "thinking";
    this.onChange();
    const timeout = setTimeout(() => controller.abort(), 58000);
    try {
      const response = await this.fetcher("/api/agent/plan", {
        method: "POST",
        headers: { "content-type": "application/json", "x-aw-deepseek": "enabled" },
        body: JSON.stringify({ context }),
        signal: controller.signal,
      });
      const data = (await response.json()) as {
        plans?: unknown[];
        error?: string;
      };
      if (generation !== this.generation || controller.signal.aborted) return;
      if (!response.ok) {
        this.status =
          data.error === "unconfigured"
            ? "unconfigured"
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
        const plans = validatePlans(data, context);
        if (!Array.isArray(data.plans) || (data.plans.length && !plans.length))
          this.status = "invalid";
        else {
          this.entries.delete(context.key);
          this.entries.set(context.key, {
            context,
            plans,
            generatedAt: this.now(),
          });
          while (this.entries.size > 6)
            this.entries.delete(this.entries.keys().next().value!);
          this.status = "ready";
        }
      }
    } catch {
      if (!this.stopped && generation === this.generation)
        this.status = controller.signal.aborted ? "timeout" : "offline";
    } finally {
      clearTimeout(timeout);
      if (generation !== this.generation) return;
      this.inflight = null;
      this.inflightKey = "";
      if (!this.stopped) this.onChange();
    }
  }
  start() {
    this.stopped = false;
  }
  stop() {
    this.stopped = true;
    this.queued = null;
    this.inflight?.abort();
  }
}
