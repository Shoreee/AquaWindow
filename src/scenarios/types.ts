import type { WindowSpec } from '../kernel/types';
import type { Autonomy, Techniques } from '../techniques/techniques';

/**
 * A scenario specifies only the *problem*: task, window contents, initial placement,
 * occlusion and the user's goal. Solutions live in `strategies`, which are presets over
 * techniques + agent settings, so the same problem can be run under competing designs.
 */
export interface ScenarioWindow extends Omit<WindowSpec, 'id'> {
  key: string;
}

export interface Strategy {
  id: string;
  label: string;
  /** Where the idea comes from. */
  lineage: string;
  description: string;
  tech: Partial<Techniques>;
  agent: boolean;
  autonomy?: Autonomy;
  /** If set, only these rule ids are active. */
  rules?: string[];
  /** Extra windows or tweaks for this strategy (e.g. open the Layout Lab). */
  extraWindows?: ScenarioWindow[];
  /** Named setup steps applied after opening windows (see director). */
  setup?: ('fuse-presenter' | 'refs-depth' | 'fuse-refs')[];
  tryThis: string[];
}

export interface Scenario {
  id: string;
  n: number;
  title: string;
  zh: string;
  task: string;
  goal: string;
  whyHard: string;
  occlusion: string;
  windows: ScenarioWindow[];
  focusKey: string;
  strategies: Strategy[];
  /** Bus event type that marks the goal reached. */
  doneEvent?: string;
  rq: string[];
}
