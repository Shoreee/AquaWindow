import { centroid, distance, type CommandSource, type WindowCommand, type WindowStore } from '@aquawindow/wm-kernel';
import { CompositeRulePolicy } from './policies/rules.js';
import {
  DEFAULT_STABILITY,
  type AutonomyLevel,
  type LayoutProposal,
  type Observation,
  type Policy,
  type StabilityBudgetConfig,
  type StudyCondition,
} from './types.js';
import { StubVLMAdapter, type VLMAdapter } from './vlm-adapter.js';

export type ProposalHandler = (proposal: LayoutProposal) => void;

export interface AgentBridgeOptions {
  store: WindowStore;
  policy?: Policy;
  vlm?: VLMAdapter;
  stability?: StabilityBudgetConfig;
}

interface TravelSample {
  at: number;
  amount: number;
}

/**
 * The only legal path from AI → OS. Never holds a React reference.
 */
export class AgentBridge {
  readonly store: WindowStore;
  readonly policy: Policy;
  readonly vlm: VLMAdapter;
  readonly stability: StabilityBudgetConfig;

  private autonomy: AutonomyLevel = 'preview';
  private condition: StudyCondition = 'fluid-agent';
  private scenarioId: string | null = null;
  private lastUserCommand: WindowCommand | null = null;
  private lastUserCommandAt: number | null = null;
  private pending: LayoutProposal | null = null;
  private readonly listeners = new Set<ProposalHandler>();
  private readonly travel: TravelSample[] = [];
  private debounce: ReturnType<typeof setTimeout> | null = null;
  private lastSignature = '';

  constructor(options: AgentBridgeOptions) {
    this.store = options.store;
    this.policy = options.policy ?? new CompositeRulePolicy();
    this.vlm = options.vlm ?? new StubVLMAdapter();
    this.stability = options.stability ?? DEFAULT_STABILITY;

    this.store.bus.subscribe((event) => {
      if (event.type === 'command' && event.source === 'user') {
        this.lastUserCommand = event.command;
        this.lastUserCommandAt = Date.now();
        this.schedule();
      }
    });
  }

  setAutonomy(level: AutonomyLevel): void {
    this.autonomy = level;
    if (level === 'off') this.clearPending();
  }

  getAutonomy(): AutonomyLevel {
    return this.autonomy;
  }

  setCondition(condition: StudyCondition): void {
    this.condition = condition;
    if (condition !== 'fluid-agent') this.clearPending();
  }

  getCondition(): StudyCondition {
    return this.condition;
  }

  setScenario(id: string | null): void {
    this.scenarioId = id;
  }

  observe(): Observation {
    return {
      timestamp: Date.now(),
      condition: this.condition,
      autonomy: this.autonomy,
      scenarioId: this.scenarioId,
      windows: this.store.getWindows(),
      occlusion: this.store.getOcclusion(),
      lastUserCommand: this.lastUserCommand,
      lastUserCommandAt: this.lastUserCommandAt,
    };
  }

  onProposal(handler: ProposalHandler): () => void {
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }

  getPending(): LayoutProposal | null {
    return this.pending;
  }

  accept(proposal: LayoutProposal, source: CommandSource = 'agent'): void {
    this.apply(proposal.commands, source);
    if (this.pending?.id === proposal.id) this.pending = null;
  }

  acceptPartial(proposal: LayoutProposal, ids: string[]): void {
    const filtered = filterCommands(proposal.commands, new Set(ids));
    if (filtered.length) this.apply(filtered, 'user');
    if (this.pending?.id === proposal.id) this.pending = null;
  }

  reject(proposal: LayoutProposal): void {
    if (this.pending?.id === proposal.id) this.pending = null;
  }

  considerNow(): LayoutProposal | null {
    if (this.autonomy === 'off' || this.condition !== 'fluid-agent') return null;
    const observation = this.observe();
    const ctx = {
      observation,
      stabilityUsed: this.usedTravel(),
      stabilityBudget: this.stability.maxTravel,
    };
    const proposal = this.policy.propose(ctx);
    if (!proposal) return null;
    const sig = JSON.stringify(proposal.commands);
    if (sig === this.lastSignature) return this.pending;
    this.lastSignature = sig;
    this.pending = proposal;
    for (const l of this.listeners) l(proposal);
    if (this.autonomy === 'auto-with-undo') {
      this.accept(proposal, 'agent');
    }
    return proposal;
  }

  private schedule(): void {
    if (this.debounce) clearTimeout(this.debounce);
    this.debounce = setTimeout(() => this.considerNow(), 420);
  }

  private apply(commands: WindowCommand[], source: CommandSource): void {
    const before = new Map(this.store.getWindows().map((w) => [w.id, centroid(w.rect)]));
    this.store.dispatch({ type: 'batch', commands }, source);
    const after = this.store.getWindows();
    let travel = 0;
    for (const w of after) {
      const prev = before.get(w.id);
      if (prev) travel += distance(prev, centroid(w.rect));
    }
    this.travel.push({ at: Date.now(), amount: travel });
  }

  private usedTravel(): number {
    const cutoff = Date.now() - this.stability.windowMs;
    while (this.travel.length && this.travel[0]!.at < cutoff) this.travel.shift();
    return this.travel.reduce((s, t) => s + t.amount, 0);
  }

  private clearPending(): void {
    this.pending = null;
    this.lastSignature = '';
  }
}

function filterCommands(commands: WindowCommand[], ids: Set<string>): WindowCommand[] {
  const out: WindowCommand[] = [];
  for (const c of commands) {
    if (c.type === 'batch') {
      const inner = filterCommands(c.commands, ids);
      if (inner.length) out.push({ type: 'batch', commands: inner });
    } else if (c.type === 'fuse') {
      const kept = c.ids.filter((id) => ids.has(id));
      if (kept.length >= 2) out.push({ type: 'fuse', ids: kept });
    } else if (c.type === 'open') {
      if (c.window.id && ids.has(c.window.id)) out.push(c);
    } else if ('id' in c && ids.has(c.id)) {
      out.push(c);
    }
  }
  return out;
}
