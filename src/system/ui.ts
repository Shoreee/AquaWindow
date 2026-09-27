import type { Rect, WindowId } from '../kernel/types';
import { CONDITIONS, type Autonomy, type ConditionId, type Techniques } from '../techniques/techniques';
import { createStore } from './createStore';

export interface Toast {
  id: string;
  text: string;
  undo?: boolean;
  t: number;
}

export interface UiState {
  condition: ConditionId;
  tech: Techniques;
  agentEnabled: boolean;
  autonomy: Autonomy;
  scenarioId: string | null;
  strategyId: string | null;
  xray: boolean;
  activeId: WindowId | null;
  snapPreview: Rect | null;
  missionControl: boolean;
  consoleOpen: boolean;
  controlCenter: boolean;
  scenarioPanel: boolean;
  scenarioCollapsed: boolean;
  switcher: { open: boolean; index: number };
  toasts: Toast[];
  taskStartedAt: number | null;
  participant: string;
}

export const ui = createStore<UiState>({
  condition: 'fluid-agent',
  tech: CONDITIONS[3].techniques,
  agentEnabled: true,
  autonomy: 'preview',
  scenarioId: null,
  strategyId: null,
  xray: false,
  activeId: null,
  snapPreview: null,
  missionControl: false,
  consoleOpen: false,
  controlCenter: false,
  scenarioPanel: true,
  scenarioCollapsed: false,
  switcher: { open: false, index: 0 },
  toasts: [],
  taskStartedAt: null,
  participant: 'P01',
});

let toastSeq = 0;
export function toast(text: string, undo = false) {
  const id = `t${++toastSeq}`;
  ui.set((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, undo, t: Date.now() }] }));
  setTimeout(() => ui.set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), undo ? 7000 : 3200);
}

export function setTech(patch: Partial<Techniques>) {
  ui.set((s) => ({ tech: { ...s.tech, ...patch } }));
}

export function setCondition(id: ConditionId) {
  const c = CONDITIONS.find((x) => x.id === id)!;
  ui.set({ condition: id, tech: c.techniques, agentEnabled: c.agent });
}
