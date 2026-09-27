import { AgentBridge, type AutonomyLevel, type LayoutProposal, type StudyCondition } from '@aquawindow/agent-sdk';
import { APP_CATALOG, SCENARIO_LAUNCH, appHost, type AppManifest } from '@aquawindow/apps';
import { DEFAULT_SOLVER, type SolverConfig } from '@aquawindow/fluid-field';
import { StudyLogger, type QuestionnaireResponse } from '@aquawindow/study';
import { WindowStore, type DesktopBounds, type WindowState } from '@aquawindow/wm-kernel';

export interface ShellSnapshot {
  windows: WindowState[];
  focusId: string | null;
  condition: StudyCondition;
  autonomy: AutonomyLevel;
  proposal: LayoutProposal | null;
  depthEnabled: boolean;
  consoleOpen: boolean;
  menu: string | null;
  now: number;
}

const listeners = new Set<() => void>();

function emit(): void {
  snapshot = read();
  for (const l of listeners) l();
}

export const store = new WindowStore();
export const bridge = new AgentBridge({ store });
export const logger = new StudyLogger();
logger.attach(store);

let interacting = false;
export function setInteracting(value: boolean): void {
  interacting = value;
}
export function isInteracting(): boolean {
  return interacting;
}

let depthEnabled = true;
let consoleOpen = false;
let menu: string | null = null;
let snapshot: ShellSnapshot = read();
const questionnaires: QuestionnaireResponse[] = [];

bridge.onProposal((p) => {
  logger.proposal('proposed', p);
  emit();
});

store.bus.subscribe(() => emit());

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getSnapshot(): ShellSnapshot {
  return snapshot;
}

function read(): ShellSnapshot {
  return {
    windows: store.getWindows(),
    focusId: store.getFocusId(),
    condition: bridge.getCondition(),
    autonomy: bridge.getAutonomy(),
    proposal: bridge.getPending(),
    depthEnabled,
    consoleOpen,
    menu,
    now: Date.now(),
  };
}

export function setDesktopBounds(bounds: DesktopBounds): void {
  store.setBounds(bounds);
}

export function setCondition(condition: StudyCondition): void {
  bridge.setCondition(condition);
  if (condition === 'fluid-agent' && bridge.getAutonomy() === 'off') {
    bridge.setAutonomy('preview');
  }
  if (condition !== 'fluid-agent') {
    bridge.setAutonomy('off');
  }
  emit();
}

export function setAutonomy(level: AutonomyLevel): void {
  bridge.setAutonomy(level);
  emit();
}

export function setDepthEnabled(value: boolean): void {
  depthEnabled = value;
  emit();
}

export function toggleConsole(): void {
  consoleOpen = !consoleOpen;
  emit();
}

export function setMenu(id: string | null): void {
  menu = id;
  emit();
}

export function solverConfigFor(condition: StudyCondition): SolverConfig {
  if (condition === 'baseline') return { ...DEFAULT_SOLVER, enabled: false };
  if (condition === 'tiling') return { ...DEFAULT_SOLVER, enabled: true, tileMode: true };
  return { ...DEFAULT_SOLVER, enabled: true };
}

export function openApp(appId: string, offset = 0): void {
  const app = appHost.get(appId);
  if (!app) return;
  const existing = store.getWindows().find((w) => w.appId === appId && w.status !== 'minimized');
  if (existing) {
    store.dispatch({ type: 'focus', id: existing.id });
    return;
  }
  const minimized = store.getWindows().find((w) => w.appId === appId && w.status === 'minimized');
  if (minimized) {
    store.dispatch({ type: 'restore', id: minimized.id });
    return;
  }
  const bounds = store.getBounds();
  store.dispatch({
    type: 'open',
    window: {
      appId: app.id,
      title: app.title,
      semanticTags: app.semanticTags,
      minSize: app.minSize,
      rect: {
        x: bounds.x + 48 + offset * 36,
        y: bounds.y + 36 + offset * 28,
        width: app.defaultSize.width,
        height: app.defaultSize.height,
      },
    },
  });
}

export function launchScenario(scenarioId: string): void {
  bridge.setScenario(scenarioId);
  const ids = SCENARIO_LAUNCH[scenarioId] ?? [];
  ids.forEach((id, i) => openApp(id, i));
}

export function manifestOf(appId: string): AppManifest | undefined {
  return APP_CATALOG.find((a) => a.id === appId);
}

export function acceptProposal(): void {
  const p = bridge.getPending();
  if (!p) return;
  logger.proposal('accept', p);
  bridge.accept(p);
  emit();
}

export function rejectProposal(): void {
  const p = bridge.getPending();
  if (!p) return;
  logger.proposal('reject', p);
  bridge.reject(p);
  emit();
}

export function acceptPartial(ids: string[]): void {
  const p = bridge.getPending();
  if (!p) return;
  logger.proposal('partial', p, ids);
  bridge.acceptPartial(p, ids);
  emit();
}

export function pushQuestionnaire(response: QuestionnaireResponse): void {
  questionnaires.push(response);
}

export function getQuestionnaires(): QuestionnaireResponse[] {
  return [...questionnaires];
}
