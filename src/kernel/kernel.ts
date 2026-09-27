import type {
  Actor,
  ImportanceRegion,
  KernelEvent,
  KernelState,
  LayoutChange,
  Rect,
  WindowId,
  WindowSpec,
  WindowState,
} from './types';

type Listener = () => void;
type EventListener = (e: KernelEvent) => void;

interface HistoryEntry {
  label: string;
  actor: Actor;
  t: number;
  before: KernelState;
}

let idSeq = 0;
const nextId = (appId: string) => `${appId}-${(++idSeq).toString(36)}`;

/**
 * WindowKernel — the only owner of window state.
 * Commands are synchronous and immutable (each produces a new state object) so the
 * shell can subscribe with useSyncExternalStore and the study logger can replay them.
 */
export class WindowKernel {
  private state: KernelState;
  private listeners = new Set<Listener>();
  private eventListeners = new Set<EventListener>();
  private history: HistoryEntry[] = [];
  private gesture: HistoryEntry | null = null;
  now: () => number = () => performance.now();

  constructor(screen = { w: 1440, h: 900 }) {
    this.state = { windows: {}, order: [], focusedId: null, screen, rev: 0 };
  }

  // ── subscription ────────────────────────────────────────────────────────────
  getState = () => this.state;
  subscribe = (fn: Listener) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  onEvent(fn: EventListener) {
    this.eventListeners.add(fn);
    return () => this.eventListeners.delete(fn);
  }

  private commit(next: Omit<KernelState, 'rev'>, ev?: Omit<KernelEvent, 't'>) {
    this.state = { ...next, rev: this.state.rev + 1 };
    if (ev) {
      const full = { ...ev, t: this.now() };
      this.eventListeners.forEach((l) => l(full));
    }
    this.listeners.forEach((l) => l());
  }

  private patch(id: WindowId, p: Partial<WindowState>, ev?: Omit<KernelEvent, 't'>) {
    const w = this.state.windows[id];
    if (!w) return;
    this.commit({ ...this.state, windows: { ...this.state.windows, [id]: { ...w, ...p } } }, ev);
  }

  // ── undo timeline ───────────────────────────────────────────────────────────
  private checkpoint(label: string, actor: Actor) {
    this.history.push({ label, actor, t: this.now(), before: this.state });
    if (this.history.length > 80) this.history.shift();
  }
  beginGesture(label: string, actor: Actor = 'user') {
    this.gesture = { label, actor, t: this.now(), before: this.state };
  }
  endGesture() {
    if (this.gesture && this.gesture.before !== this.state) this.history.push(this.gesture);
    this.gesture = null;
  }
  canUndo() {
    return this.history.length > 0;
  }
  lastHistory() {
    return this.history[this.history.length - 1];
  }
  undo(actor: Actor = 'user') {
    const h = this.history.pop();
    if (!h) return;
    // Keep windows opened after the checkpoint alive only if they existed then.
    this.commit({ ...h.before, screen: this.state.screen }, { actor, type: 'undo', data: { label: h.label } });
  }

  // ── commands ────────────────────────────────────────────────────────────────
  setScreen(w: number, h: number) {
    this.commit({ ...this.state, screen: { w, h } });
  }

  open(spec: WindowSpec, actor: Actor = 'user'): WindowId {
    const id = spec.id ?? nextId(spec.appId);
    const t = this.now();
    const win: WindowState = {
      id,
      appId: spec.appId,
      title: spec.title,
      rect: { ...spec.rect },
      depth: spec.depth ?? 0,
      minimized: spec.minimized ?? false,
      maximized: false,
      form: spec.form ?? 'normal',
      group: spec.group,
      role: spec.role ?? 'primary',
      importance: spec.importance ?? [],
      props: spec.props ?? {},
      openedFrom: spec.openedFrom,
      createdAt: t,
      lastFocusedAt: t,
    };
    const order = this.state.order.filter((o) => o !== id);
    order.push(id);
    const focus = spec.focus !== false && !win.minimized;
    this.commit(
      { ...this.state, windows: { ...this.state.windows, [id]: win }, order, focusedId: focus ? id : this.state.focusedId },
      { actor, type: 'open', windowId: id, data: { appId: spec.appId } },
    );
    return id;
  }

  close(id: WindowId, actor: Actor = 'user') {
    if (!this.state.windows[id]) return;
    this.checkpoint('close', actor);
    const windows = { ...this.state.windows };
    delete windows[id];
    const order = this.state.order.filter((o) => o !== id);
    const focusedId = this.state.focusedId === id ? this.topVisible(order, windows) : this.state.focusedId;
    this.commit({ ...this.state, windows, order, focusedId }, { actor, type: 'close', windowId: id });
  }

  closeAll() {
    this.history = [];
    this.commit({ ...this.state, windows: {}, order: [], focusedId: null }, { actor: 'system', type: 'reset' });
  }

  private topVisible(order: WindowId[], windows: Record<WindowId, WindowState>) {
    for (let i = order.length - 1; i >= 0; i--) {
      const w = windows[order[i]];
      if (w && !w.minimized) return w.id;
    }
    return null;
  }

  focus(id: WindowId, actor: Actor = 'user') {
    const w = this.state.windows[id];
    if (!w) return;
    if (this.state.focusedId === id && this.state.order[this.state.order.length - 1] === id && !w.minimized) return;
    const order = this.state.order.filter((o) => o !== id);
    order.push(id);
    this.commit(
      {
        ...this.state,
        order,
        focusedId: id,
        windows: { ...this.state.windows, [id]: { ...w, minimized: false, lastFocusedAt: this.now() } },
      },
      { actor, type: 'focus', windowId: id, data: { from: this.state.focusedId } },
    );
  }

  setRect(id: WindowId, rect: Rect, actor: Actor = 'user', type = 'move') {
    const w = this.state.windows[id];
    if (!w) return;
    this.patch(id, { rect, maximized: false }, { actor, type, windowId: id, data: { ...rect } });
  }

  minimize(id: WindowId, actor: Actor = 'user') {
    const w = this.state.windows[id];
    if (!w) return;
    this.checkpoint('minimize', actor);
    const focusedId =
      this.state.focusedId === id ? this.topVisible(this.state.order.filter((o) => o !== id), this.state.windows) : this.state.focusedId;
    this.commit(
      { ...this.state, focusedId, windows: { ...this.state.windows, [id]: { ...w, minimized: true } } },
      { actor, type: 'minimize', windowId: id },
    );
  }

  restore(id: WindowId, actor: Actor = 'user') {
    const w = this.state.windows[id];
    if (!w) return;
    this.patch(id, { minimized: false, form: 'normal' }, { actor, type: 'restore', windowId: id });
    this.focus(id, actor);
  }

  toggleMaximize(id: WindowId, bounds: Rect, actor: Actor = 'user') {
    const w = this.state.windows[id];
    if (!w) return;
    this.checkpoint('maximize', actor);
    if (w.maximized && w.restoreRect) {
      this.patch(id, { rect: w.restoreRect, maximized: false, restoreRect: undefined }, { actor, type: 'unmaximize', windowId: id });
    } else {
      this.patch(id, { restoreRect: w.rect, rect: bounds, maximized: true }, { actor, type: 'maximize', windowId: id });
    }
  }

  setDepth(id: WindowId, depth: number, actor: Actor = 'user') {
    this.patch(id, { depth: Math.max(0, Math.min(1, depth)) }, { actor, type: 'depth', windowId: id, data: { depth } });
  }

  setForm(id: WindowId, form: WindowState['form'], actor: Actor = 'user', capsuleRect?: Rect) {
    const w = this.state.windows[id];
    if (!w) return;
    this.checkpoint(`form:${form}`, actor);
    this.patch(id, { form, capsuleRect: capsuleRect ?? w.capsuleRect }, { actor, type: 'form', windowId: id, data: { form } });
  }

  setCapsuleRect(id: WindowId, capsuleRect: Rect, actor: Actor = 'user') {
    this.patch(id, { capsuleRect }, { actor, type: 'move', windowId: id, data: { capsule: true } });
  }

  setGroup(id: WindowId, group: string | undefined, actor: Actor = 'user') {
    this.patch(id, { group }, { actor, type: 'group', windowId: id, data: { group } });
  }

  setImportance(id: WindowId, importance: ImportanceRegion[]) {
    this.patch(id, { importance });
  }

  setProps(id: WindowId, props: Record<string, unknown>) {
    const w = this.state.windows[id];
    if (!w) return;
    this.patch(id, { props: { ...w.props, ...props } });
  }

  setTitle(id: WindowId, title: string) {
    this.patch(id, { title });
  }

  /** Atomic multi-window change with a single undo checkpoint. */
  apply(changes: LayoutChange[], actor: Actor, label: string) {
    if (changes.length === 0) return;
    this.checkpoint(label, actor);
    const windows = { ...this.state.windows };
    let order = [...this.state.order];
    let focusedId = this.state.focusedId;
    for (const c of changes) {
      const w = windows[c.windowId];
      if (!w) continue;
      const n: WindowState = { ...w };
      if (c.rect) {
        n.rect = { ...c.rect };
        n.maximized = false;
      }
      if (c.depth !== undefined) n.depth = c.depth;
      if (c.form) n.form = c.form;
      if (c.capsuleRect) n.capsuleRect = c.capsuleRect;
      if (c.group !== undefined) n.group = c.group ?? undefined;
      if (c.minimized !== undefined) n.minimized = c.minimized;
      windows[c.windowId] = n;
      if (c.raise || c.focus) {
        order = order.filter((o) => o !== c.windowId);
        order.push(c.windowId);
      }
      if (c.focus) {
        focusedId = c.windowId;
        n.lastFocusedAt = this.now();
      }
    }
    this.commit({ ...this.state, windows, order, focusedId }, { actor, type: 'apply', data: { label, n: changes.length } });
  }

  // ── queries ─────────────────────────────────────────────────────────────────
  get(id: WindowId) {
    return this.state.windows[id];
  }
  list(): WindowState[] {
    return this.state.order.map((id) => this.state.windows[id]).filter(Boolean);
  }
}
