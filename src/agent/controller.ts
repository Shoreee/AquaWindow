import type { WindowKernel } from '../kernel/kernel';
import type { Rect } from '../kernel/types';
import { log } from '../study/logger';
import { createStore } from '../system/createStore';
import type { BusEvent } from '../system/bus';
import type { Autonomy, Techniques } from '../techniques/techniques';
import { LlmPolicy } from './llm';
import { observe } from './observe';
import { RulePolicy } from './rules';
import type { LayoutProposal, Observation, Policy, PreferenceMemory, ProposalDraft } from './types';

export interface AgentState {
  pending: LayoutProposal[];
  history: LayoutProposal[];
  hoverId: string | null;
  policyId: 'rules' | 'llm' | 'hybrid';
  memory: PreferenceMemory;
  lastObservation: Observation | null;
}

export const agentStore = createStore<AgentState>({
  pending: [],
  history: [],
  hoverId: null,
  policyId: 'rules',
  memory: { rules: {}, scratch: {} },
  lastObservation: null,
});

export interface AgentHost {
  kernel: WindowKernel;
  work: () => Rect;
  events: () => BusEvent[];
  autonomy: () => Autonomy;
  enabled: () => boolean;
  tech: () => Techniques;
  scenarioId: () => string | null;
  applyTechniques: (t: Partial<Techniques>) => void;
  notify: (text: string, undo: boolean) => void;
}

const COOLDOWN_MS = 12000;
const EXPIRE_MS = 40000;
let seq = 0;

/**
 * Controller = negotiation protocol. It owns: when to observe, which policy to ask,
 * de-duplication and cool-downs, the autonomy gate, partial acceptance, and the preference
 * memory that makes repeated rejections quieter (the agent learns *not* to ask).
 */
export class AgentController {
  rules = new RulePolicy();
  llm = new LlmPolicy();
  private focusHistory: { id: string; t: number }[] = [];
  private timer: number | null = null;
  private debounce: number | null = null;

  constructor(private host: AgentHost) {
    host.kernel.onEvent((e) => {
      if (e.type === 'focus' && e.windowId && e.actor === 'user') {
        const last = this.focusHistory[this.focusHistory.length - 1];
        if (!last || last.id !== e.windowId) this.focusHistory.push({ id: e.windowId, t: e.t });
        if (this.focusHistory.length > 60) this.focusHistory.shift();
        this.schedule(600);
      }
    });
  }

  start() {
    this.stop();
    this.timer = window.setInterval(() => this.tick(), 1000);
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
  reset() {
    this.focusHistory = [];
    agentStore.set({ pending: [], history: [], memory: { rules: {}, scratch: {} }, hoverId: null });
  }
  schedule(ms = 300) {
    if (this.debounce) clearTimeout(this.debounce);
    this.debounce = window.setTimeout(() => this.tick(), ms);
  }

  private policies(): Policy[] {
    const id = agentStore.get().policyId;
    if (id === 'llm') return this.llm.available ? [this.llm] : [this.rules];
    if (id === 'hybrid') return this.llm.available ? [this.rules, this.llm] : [this.rules];
    return [this.rules];
  }

  observation() {
    const { kernel } = this.host;
    return observe(kernel.getState(), this.host.work(), this.focusHistory, this.host.events(), this.host.tech(), this.host.scenarioId(), performance.now());
  }

  async tick() {
    const now = performance.now();
    // expire stale proposals
    const { pending } = agentStore.get();
    const alive = pending.filter((p) => now - p.createdAt < EXPIRE_MS);
    if (alive.length !== pending.length) {
      pending.filter((p) => !alive.includes(p)).forEach((p) => this.close(p, 'expired'));
    }
    if (!this.host.enabled() || this.host.autonomy() === 'off') return;
    const obs = this.observation();
    agentStore.set({ lastObservation: obs });
    const mem = agentStore.get().memory;
    for (const pol of this.policies()) {
      const drafts = await pol.propose(obs, mem);
      for (const d of drafts) this.consider(d, pol.id === 'llm' ? 'llm' : 'rules');
    }
  }

  private effectiveConfidence(d: ProposalDraft) {
    const m = agentStore.get().memory.rules[baseRule(d.ruleId)];
    if (!m) return d.confidence;
    return d.confidence * Math.pow(0.7, m.rejects) * Math.pow(1.08, Math.min(3, m.accepts));
  }

  consider(d: ProposalDraft, source: LayoutProposal['source']) {
    const now = performance.now();
    const st = agentStore.get();
    if (st.pending.some((p) => p.ruleId === d.ruleId)) return;
    const base = baseRule(d.ruleId);
    const decided = st.memory.rules[d.ruleId];
    // Cooldown is per concrete proposal (so step 2 of a tutorial can follow step 1);
    // rejection learning still rolls up to the rule family via effectiveConfidence.
    if (decided && now - decided.lastDecisionAt < COOLDOWN_MS && source !== 'user-request') return;
    if (st.history.some((p) => p.ruleId === d.ruleId && now - p.createdAt < COOLDOWN_MS * 2) && source !== 'user-request') return;
    const conf = this.effectiveConfidence(d);
    if (conf < 0.35 && source !== 'user-request') return;
    const p: LayoutProposal = { ...d, confidence: conf, id: `p${++seq}`, source, createdAt: now, status: 'pending' };
    this.touch(base, (r) => ({ ...r, lastFiredAt: now }));
    log({ src: 'agent', type: 'proposal', data: { id: p.id, rule: p.ruleId, source, confidence: +conf.toFixed(2), n: p.changes.length } });
    if (this.host.autonomy() === 'auto' && source !== 'user-request') {
      this.apply(p, undefined, 'auto');
      return;
    }
    agentStore.set((s) => ({ pending: [...s.pending.slice(-2), p] }));
  }

  /** Accept all (or a subset of window ids) of a proposal. */
  accept(id: string, subset?: string[]) {
    const p = agentStore.get().pending.find((x) => x.id === id);
    if (!p) return;
    const partial = !!subset && subset.length < p.changes.length + (p.open?.length ?? 0);
    this.apply(p, subset, partial ? 'partial' : 'accepted');
  }

  private apply(p: LayoutProposal, subset: string[] | undefined, status: LayoutProposal['status']) {
    const { kernel } = this.host;
    const changes = subset ? p.changes.filter((c) => subset.includes(c.windowId)) : p.changes;
    const openAll = !subset || subset.includes('__open__');
    kernel.apply(changes, 'agent', `agent:${p.ruleId}`);
    if (openAll) p.open?.forEach((spec) => kernel.open(spec, 'agent'));
    if (p.techniques && (!subset || subset.includes('__tech__'))) this.host.applyTechniques(p.techniques);
    this.close(p, status);
    log({ src: 'agent', type: status === 'auto' ? 'auto-apply' : status === 'partial' ? 'partial' : 'accept', data: { id: p.id, rule: p.ruleId, subset } });
    if (status === 'auto') this.host.notify(`Agent: ${p.title}`, true);
  }

  reject(id: string) {
    const p = agentStore.get().pending.find((x) => x.id === id);
    if (!p) return;
    this.close(p, 'rejected');
    log({ src: 'agent', type: 'reject', data: { id: p.id, rule: p.ruleId } });
  }

  /** Undo of an auto-applied change counts as a rejection for learning purposes. */
  noteUndo() {
    const last = agentStore.get().history.find((h) => h.status === 'auto');
    if (last) this.touch(baseRule(last.ruleId), (r) => ({ ...r, rejects: r.rejects + 1 }));
  }

  private close(p: LayoutProposal, status: LayoutProposal['status']) {
    const now = performance.now();
    const base = baseRule(p.ruleId);
    if (status !== 'expired') {
      this.touch(base, (r) => ({
        ...r,
        accepts: r.accepts + (status === 'accepted' || status === 'auto' ? 1 : 0),
        partials: r.partials + (status === 'partial' ? 1 : 0),
        rejects: r.rejects + (status === 'rejected' ? 1 : 0),
      }));
      this.touch(p.ruleId, (r) => ({ ...r, lastDecisionAt: now }));
    }
    agentStore.set((s) => ({
      pending: s.pending.filter((x) => x.id !== p.id),
      history: [{ ...p, status }, ...s.history].slice(0, 60),
      hoverId: s.hoverId === p.id ? null : s.hoverId,
    }));
  }

  private touch(rule: string, f: (r: PreferenceMemory['rules'][string]) => PreferenceMemory['rules'][string]) {
    agentStore.set((s) => {
      const cur = s.memory.rules[rule] ?? { accepts: 0, partials: 0, rejects: 0, lastFiredAt: 0, lastDecisionAt: 0 };
      return { memory: { ...s.memory, rules: { ...s.memory.rules, [rule]: f(cur) } } };
    });
  }
}

const baseRule = (id: string) => id.split(':')[0];
