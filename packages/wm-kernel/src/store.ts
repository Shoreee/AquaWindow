import { cloneRect, clampRect } from './geometry.js';
import { EventBus } from './event-bus.js';
import { UndoTimeline } from './history.js';
import { computeOcclusion } from './occlusion.js';
import {
  DEFAULT_BOUNDS,
  DEFAULT_MIN_SIZE,
  type CommandSource,
  type DesktopBounds,
  type OpenWindowInput,
  type Rect,
  type Snapshot,
  type WindowCommand,
  type WindowState,
} from './types.js';

export interface WindowStoreOptions {
  bounds?: DesktopBounds;
}

function nextId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `w-${Math.random().toString(36).slice(2, 10)}`;
}

function cloneWindow(w: WindowState): WindowState {
  return {
    ...w,
    rect: cloneRect(w.rect),
    restoreRect: cloneRect(w.restoreRect),
    semanticTags: [...w.semanticTags],
  };
}

export class WindowStore {
  readonly bus = new EventBus();
  readonly history = new UndoTimeline();

  private windows = new Map<string, WindowState>();
  private nextZ = 1;
  private focusId: string | null = null;
  private bounds: DesktopBounds;
  private silent = false;

  constructor(options: WindowStoreOptions = {}) {
    this.bounds = options.bounds ?? { ...DEFAULT_BOUNDS };
  }

  setBounds(bounds: DesktopBounds): void {
    this.bounds = bounds;
  }

  getBounds(): DesktopBounds {
    return this.bounds;
  }

  getWindows(): WindowState[] {
    return [...this.windows.values()].map(cloneWindow).sort((a, b) => a.z - b.z);
  }

  getWindow(id: string): WindowState | undefined {
    const w = this.windows.get(id);
    return w ? cloneWindow(w) : undefined;
  }

  getFocusId(): string | null {
    return this.focusId;
  }

  getOcclusion() {
    return computeOcclusion(this.getWindows());
  }

  snapshot(): Snapshot {
    return {
      windows: this.getWindows(),
      nextZ: this.nextZ,
      focusId: this.focusId,
    };
  }

  restoreSnapshot(snapshot: Snapshot): void {
    this.windows = new Map(snapshot.windows.map((w) => [w.id, cloneWindow(w)]));
    this.nextZ = snapshot.nextZ;
    this.focusId = snapshot.focusId;
    this.emitState();
  }

  dispatch(command: WindowCommand, source: CommandSource = 'user'): void {
    if (command.type === 'batch') {
      const inverses: WindowCommand[] = [];
      this.runSilent(() => {
        for (const child of command.commands) {
          const inverse = this.apply(child);
          if (inverse) inverses.unshift(inverse);
        }
      });
      if (inverses.length && source !== 'replay' && source !== 'system') {
        this.history.push(command, { type: 'batch', commands: inverses }, source);
      }
      this.bus.emit({ type: 'command', command, source });
      this.emitState();
      return;
    }

    const inverse = this.apply(command);
    if (inverse && source !== 'replay' && source !== 'system') {
      this.history.push(command, inverse, source);
    }
    this.bus.emit({ type: 'command', command, source });
    this.emitState();
  }

  undo(): void {
    const entry = this.history.undo();
    if (!entry) return;
    this.apply(entry.inverse);
    this.bus.emit({ type: 'undo' });
    this.emitState();
  }

  redo(): void {
    const entry = this.history.redo();
    if (!entry) return;
    this.apply(entry.command);
    this.bus.emit({ type: 'redo' });
    this.emitState();
  }

  private runSilent(fn: () => void): void {
    this.silent = true;
    try {
      fn();
    } finally {
      this.silent = false;
    }
  }

  private emitState(): void {
    if (this.silent) return;
    this.bus.emit({ type: 'state', windows: this.getWindows() });
    this.bus.emit({ type: 'focus', id: this.focusId });
  }

  private apply(command: WindowCommand): WindowCommand | null {
    switch (command.type) {
      case 'open':
        return this.applyOpen(command.window);
      case 'move':
        return this.applyMove(command.id, command.x, command.y);
      case 'resize':
        return this.applyResize(command.id, command.rect);
      case 'focus':
        return this.applyFocus(command.id);
      case 'raise':
        return this.applyRaise(command.id);
      case 'minimize':
        return this.applyMinimize(command.id);
      case 'restore':
        return this.applyRestore(command.id);
      case 'maximize':
        return this.applyMaximize(command.id);
      case 'close':
        return this.applyClose(command.id);
      case 'fuse':
        return this.applyFuse(command.ids);
      case 'split':
        return this.applySplit(command.id);
      case 'pin':
        return this.applyPin(command.id, command.pinned);
      case 'setDepth':
        return this.applyDepth(command.id, command.depth);
      case 'setTitle':
        return this.applyTitle(command.id, command.title);
      case 'batch': {
        const inverses: WindowCommand[] = [];
        for (const child of command.commands) {
          const inverse = this.apply(child);
          if (inverse) inverses.unshift(inverse);
        }
        return inverses.length ? { type: 'batch', commands: inverses } : null;
      }
      default:
        return null;
    }
  }

  private applyOpen(input: OpenWindowInput): WindowCommand | null {
    const id = input.id ?? nextId();
    if (this.windows.has(id)) return null;
    const cascaded = this.cascadeRect();
    const rect = clampRect(input.rect ?? cascaded, this.bounds);
    const window: WindowState = {
      id,
      appId: input.appId,
      title: input.title,
      rect,
      restoreRect: cloneRect(rect),
      z: this.nextZ++,
      status: 'normal',
      focused: false,
      pinned: input.pinned ?? false,
      groupId: input.groupId ?? null,
      semanticTags: input.semanticTags ?? [],
      minSize: input.minSize ?? { ...DEFAULT_MIN_SIZE },
      depth: input.depth ?? 0,
    };
    this.windows.set(id, window);
    this.focusInternal(id);
    return { type: 'close', id };
  }

  private applyMove(id: string, x: number, y: number): WindowCommand | null {
    const w = this.windows.get(id);
    if (!w || w.status === 'minimized') return null;
    const prev = cloneRect(w.rect);
    const members = this.groupMembers(w);
    const dx = x - w.rect.x;
    const dy = y - w.rect.y;
    if (members.length > 1) {
      const inverses: WindowCommand[] = members.map((m) => ({
        type: 'resize',
        id: m.id,
        rect: cloneRect(m.rect),
      }));
      for (const m of members) {
        m.rect = clampRect({ ...m.rect, x: m.rect.x + dx, y: m.rect.y + dy }, this.bounds);
        if (m.status === 'normal') m.restoreRect = cloneRect(m.rect);
      }
      return { type: 'batch', commands: inverses };
    }
    w.rect = clampRect({ ...w.rect, x, y }, this.bounds);
    if (w.status === 'normal') w.restoreRect = cloneRect(w.rect);
    return { type: 'resize', id, rect: prev };
  }

  private applyResize(id: string, rect: Rect): WindowCommand | null {
    const w = this.windows.get(id);
    if (!w || w.status === 'minimized') return null;
    const prev = cloneRect(w.rect);
    const minW = w.minSize.width;
    const minH = w.minSize.height;
    const next = clampRect(
      {
        x: rect.x,
        y: rect.y,
        width: Math.max(minW, rect.width),
        height: Math.max(minH, rect.height),
      },
      this.bounds,
    );
    w.rect = next;
    if (w.status === 'normal') w.restoreRect = cloneRect(next);
    return { type: 'resize', id, rect: prev };
  }

  private applyFocus(id: string): WindowCommand | null {
    if (!this.windows.has(id)) return null;
    const prev = this.focusId;
    this.raiseInternal(id);
    this.focusInternal(id);
    return prev ? { type: 'focus', id: prev } : { type: 'focus', id };
  }

  private applyRaise(id: string): WindowCommand | null {
    const w = this.windows.get(id);
    if (!w) return null;
    const prevZ = w.z;
    this.raiseInternal(id);
    return {
      type: 'batch',
      commands: [{ type: 'raise', id }],
    };
    void prevZ;
  }

  private applyMinimize(id: string): WindowCommand | null {
    const w = this.windows.get(id);
    if (!w || w.status === 'minimized') return null;
    const was = w.status;
    w.restoreRect = cloneRect(w.rect);
    w.status = 'minimized';
    if (this.focusId === id) {
      this.focusId = this.topNormalId();
      this.syncFocus();
    }
    return was === 'maximized' ? { type: 'maximize', id } : { type: 'restore', id };
  }

  private applyRestore(id: string): WindowCommand | null {
    const w = this.windows.get(id);
    if (!w) return null;
    const prevStatus = w.status;
    const prevRect = cloneRect(w.rect);
    w.status = 'normal';
    w.rect = clampRect(cloneRect(w.restoreRect), this.bounds);
    this.raiseInternal(id);
    this.focusInternal(id);
    if (prevStatus === 'minimized') return { type: 'minimize', id };
    if (prevStatus === 'maximized') {
      return { type: 'batch', commands: [{ type: 'maximize', id }, { type: 'resize', id, rect: prevRect }] };
    }
    return { type: 'resize', id, rect: prevRect };
  }

  private applyMaximize(id: string): WindowCommand | null {
    const w = this.windows.get(id);
    if (!w) return null;
    if (w.status !== 'maximized') {
      w.restoreRect = cloneRect(w.rect);
    }
    w.status = 'maximized';
    w.rect = {
      x: this.bounds.x,
      y: this.bounds.y,
      width: this.bounds.width,
      height: this.bounds.height,
    };
    this.raiseInternal(id);
    this.focusInternal(id);
    return { type: 'restore', id };
  }

  private applyClose(id: string): WindowCommand | null {
    const w = this.windows.get(id);
    if (!w) return null;
    const snapshot = cloneWindow(w);
    this.windows.delete(id);
    if (this.focusId === id) {
      this.focusId = this.topNormalId();
      this.syncFocus();
    }
    return {
      type: 'open',
      window: {
        id: snapshot.id,
        appId: snapshot.appId,
        title: snapshot.title,
        rect: snapshot.rect,
        semanticTags: snapshot.semanticTags,
        minSize: snapshot.minSize,
        pinned: snapshot.pinned,
        depth: snapshot.depth,
        groupId: snapshot.groupId,
      },
    };
  }

  private applyFuse(ids: string[]): WindowCommand | null {
    const unique = [...new Set(ids)].filter((id) => this.windows.has(id));
    if (unique.length < 2) return null;
    const existing = unique
      .map((id) => this.windows.get(id)!)
      .map((w) => w.groupId)
      .find((g) => g);
    const groupId = existing ?? `g-${nextId()}`;
    const prev: WindowCommand[] = unique.map((id) => {
      const w = this.windows.get(id)!;
      return w.groupId ? { type: 'fuse', ids: this.groupIds(w.groupId) } : { type: 'split', id };
    });
    for (const id of unique) {
      this.windows.get(id)!.groupId = groupId;
    }
    return { type: 'batch', commands: prev };
  }

  private applySplit(id: string): WindowCommand | null {
    const w = this.windows.get(id);
    if (!w || !w.groupId) return null;
    const groupId = w.groupId;
    const members = this.groupIds(groupId);
    w.groupId = null;
    return { type: 'fuse', ids: members };
  }

  private applyPin(id: string, pinned: boolean): WindowCommand | null {
    const w = this.windows.get(id);
    if (!w) return null;
    const prev = w.pinned;
    w.pinned = pinned;
    return { type: 'pin', id, pinned: prev };
  }

  private applyDepth(id: string, depth: WindowState['depth']): WindowCommand | null {
    const w = this.windows.get(id);
    if (!w) return null;
    const prev = w.depth;
    w.depth = depth;
    return { type: 'setDepth', id, depth: prev };
  }

  private applyTitle(id: string, title: string): WindowCommand | null {
    const w = this.windows.get(id);
    if (!w) return null;
    const prev = w.title;
    w.title = title;
    return { type: 'setTitle', id, title: prev };
  }

  private cascadeRect(): Rect {
    const n = this.windows.size;
    const originX = this.bounds.x + 48 + (n % 8) * 28;
    const originY = this.bounds.y + 36 + (n % 8) * 28;
    return { x: originX, y: originY, width: 720, height: 480 };
  }

  private groupMembers(w: WindowState): WindowState[] {
    if (!w.groupId) return [w];
    return [...this.windows.values()].filter((o) => o.groupId === w.groupId);
  }

  private groupIds(groupId: string): string[] {
    return [...this.windows.values()].filter((w) => w.groupId === groupId).map((w) => w.id);
  }

  private raiseInternal(id: string): void {
    const w = this.windows.get(id);
    if (!w) return;
    w.z = this.nextZ++;
  }

  private focusInternal(id: string): void {
    this.focusId = id;
    this.syncFocus();
  }

  private syncFocus(): void {
    for (const w of this.windows.values()) {
      w.focused = w.id === this.focusId && w.status !== 'minimized';
    }
  }

  private topNormalId(): string | null {
    let best: WindowState | null = null;
    for (const w of this.windows.values()) {
      if (w.status === 'minimized') continue;
      if (!best || w.z > best.z) best = w;
    }
    return best?.id ?? null;
  }
}
