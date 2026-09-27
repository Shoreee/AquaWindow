// The window-manager kernel is pure TypeScript: no React, no DOM, no agent.
// Everything above it (shell, techniques, agent) talks to it through commands.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type WindowId = string;

/** Semantic role of a window within the current task. Used by techniques and the agent. */
export type WindowRole = 'primary' | 'reference' | 'awareness' | 'tool' | 'scratch' | 'system';

/** Normal = full window; capsule = peripheral, low-fidelity fluid form (Scalable-Fabric-like). */
export type WindowForm = 'normal' | 'capsule';

/**
 * Region of a window's content that matters (figure, caret paragraph, speaker, target control).
 * Coordinates are normalised (0..1) to the window's content box.
 */
export interface ImportanceRegion {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  weight: number;
  label?: string;
}

export interface WindowState {
  id: WindowId;
  appId: string;
  title: string;
  rect: Rect;
  /** 0 = on the glass, 1 = deepest layer. Depth is a first-class layout dimension, not a z-index. */
  depth: number;
  minimized: boolean;
  maximized: boolean;
  restoreRect?: Rect;
  form: WindowForm;
  capsuleRect?: Rect;
  /** Windows sharing a group id are rendered as one fused fluid territory. */
  group?: string;
  role: WindowRole;
  importance: ImportanceRegion[];
  props: Record<string, unknown>;
  openedFrom?: WindowId;
  createdAt: number;
  lastFocusedAt: number;
}

export interface KernelState {
  windows: Record<WindowId, WindowState>;
  /** Stacking order, back → front. */
  order: WindowId[];
  focusedId: WindowId | null;
  screen: { w: number; h: number };
  /** Monotonic revision, bumped on every change. */
  rev: number;
}

export interface WindowSpec {
  id?: WindowId;
  appId: string;
  title: string;
  rect: Rect;
  depth?: number;
  role?: WindowRole;
  group?: string;
  form?: WindowForm;
  minimized?: boolean;
  importance?: ImportanceRegion[];
  props?: Record<string, unknown>;
  openedFrom?: WindowId;
  focus?: boolean;
}

/** A batch change applied atomically (used by agent proposals and layout strategies). */
export interface LayoutChange {
  windowId: WindowId;
  rect?: Rect;
  depth?: number;
  form?: WindowForm;
  capsuleRect?: Rect;
  group?: string | null;
  minimized?: boolean;
  focus?: boolean;
  raise?: boolean;
}

export type Actor = 'user' | 'agent' | 'system' | 'scenario';

export interface KernelEvent {
  t: number;
  actor: Actor;
  type: string;
  windowId?: WindowId;
  data?: Record<string, unknown>;
}
