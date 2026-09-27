import type { LayoutChange, Rect, WindowForm, WindowId, WindowRole, WindowSpec } from '../kernel/types';
import type { BusEvent } from '../system/bus';
import type { Techniques } from '../techniques/techniques';

/**
 * Agent protocol. Agents never touch the kernel: they read an Observation and return
 * LayoutProposals. The controller decides — together with the user's autonomy setting —
 * whether a proposal is shown as a chip, previewed as ghosts, or applied with undo.
 * A rule policy, a numeric optimiser and an LLM/VLM policy all implement the same interface.
 */
export interface RegionSummary {
  id: string;
  label?: string;
  weight: number;
  rect: Rect;
  visibleFraction: number;
}

export interface WindowSummary {
  id: WindowId;
  appId: string;
  title: string;
  role: WindowRole;
  rect: Rect;
  vis: Rect;
  depth: number;
  form: WindowForm;
  group?: string;
  focused: boolean;
  minimized: boolean;
  stackIndex: number;
  visibleFraction: number;
  importance: RegionSummary[];
  lastFocusedAt: number;
  openedFrom?: WindowId;
  props: Record<string, unknown>;
}

export interface Observation {
  t: number;
  screen: { w: number; h: number };
  work: Rect;
  focusedId: WindowId | null;
  windows: WindowSummary[];
  focusHistory: { id: WindowId; t: number }[];
  events: BusEvent[];
  tech: Techniques;
  scenarioId: string | null;
}

export interface ProposalDraft {
  ruleId: string;
  title: string;
  rationale: string;
  evidence: string[];
  confidence: number;
  technique: string;
  changes: LayoutChange[];
  open?: WindowSpec[];
  techniques?: Partial<Techniques>;
  /** Short labels for ghosts, per window id. */
  labels?: Record<WindowId, string>;
}

export interface LayoutProposal extends ProposalDraft {
  id: string;
  source: 'rules' | 'optimizer' | 'llm' | 'user-request';
  createdAt: number;
  status: 'pending' | 'accepted' | 'partial' | 'rejected' | 'expired' | 'auto';
}

export interface Policy {
  id: string;
  label: string;
  propose(obs: Observation, mem: PreferenceMemory): ProposalDraft[] | Promise<ProposalDraft[]>;
}

export interface RuleMemory {
  accepts: number;
  partials: number;
  rejects: number;
  lastFiredAt: number;
  lastDecisionAt: number;
}

export interface PreferenceMemory {
  rules: Record<string, RuleMemory>;
  /** per-rule scratch state (timers, counters) */
  scratch: Record<string, unknown>;
}
