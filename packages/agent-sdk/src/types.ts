import type { OcclusionInfo, WindowCommand, WindowState } from '@aquawindow/wm-kernel';

export type AutonomyLevel = 'off' | 'suggest' | 'preview' | 'auto-with-undo';

export type StudyCondition = 'baseline' | 'tiling' | 'fluid' | 'fluid-agent';

export interface Observation {
  timestamp: number;
  condition: StudyCondition;
  autonomy: AutonomyLevel;
  scenarioId: string | null;
  windows: WindowState[];
  occlusion: OcclusionInfo[];
  lastUserCommand: WindowCommand | null;
  lastUserCommandAt: number | null;
  screenshotDataUrl?: string;
}

export interface LayoutProposal {
  id: string;
  createdAt: number;
  policyId: string;
  rationale: string;
  confidence: number;
  commands: WindowCommand[];
  affectedIds: string[];
}

export interface PolicyContext {
  observation: Observation;
  stabilityUsed: number;
  stabilityBudget: number;
}

export interface Policy {
  id: string;
  propose(ctx: PolicyContext): LayoutProposal | null;
}

export interface StabilityBudgetConfig {
  /** Max sum of centroid travel (px) allowed for agent-originated moves per window (ms). */
  maxTravel: number;
  windowMs: number;
}

export const DEFAULT_STABILITY: StabilityBudgetConfig = {
  maxTravel: 420,
  windowMs: 8_000,
};
