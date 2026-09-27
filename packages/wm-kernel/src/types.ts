export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export type WindowStatus = 'normal' | 'minimized' | 'maximized';

export type AttentionDepth = 0 | 1 | 2;

export interface WindowState {
  id: string;
  appId: string;
  title: string;
  rect: Rect;
  restoreRect: Rect;
  z: number;
  status: WindowStatus;
  focused: boolean;
  pinned: boolean;
  groupId: string | null;
  semanticTags: string[];
  minSize: Size;
  depth: AttentionDepth;
}

export type WindowCommand =
  | { type: 'open'; window: OpenWindowInput }
  | { type: 'move'; id: string; x: number; y: number }
  | { type: 'resize'; id: string; rect: Rect }
  | { type: 'focus'; id: string }
  | { type: 'raise'; id: string }
  | { type: 'minimize'; id: string }
  | { type: 'restore'; id: string }
  | { type: 'maximize'; id: string }
  | { type: 'close'; id: string }
  | { type: 'fuse'; ids: string[] }
  | { type: 'split'; id: string }
  | { type: 'pin'; id: string; pinned: boolean }
  | { type: 'setDepth'; id: string; depth: AttentionDepth }
  | { type: 'setTitle'; id: string; title: string }
  | { type: 'batch'; commands: WindowCommand[] };

export interface OpenWindowInput {
  id?: string;
  appId: string;
  title: string;
  rect?: Rect;
  semanticTags?: string[];
  minSize?: Size;
  pinned?: boolean;
  depth?: AttentionDepth;
  groupId?: string | null;
}

export interface DesktopBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OcclusionInfo {
  id: string;
  visibleRatio: number;
  occludedBy: string[];
}

export type KernelEvent =
  | { type: 'command'; command: WindowCommand; source: CommandSource }
  | { type: 'state'; windows: WindowState[] }
  | { type: 'focus'; id: string | null }
  | { type: 'undo' | 'redo' };

export type CommandSource = 'user' | 'agent' | 'system' | 'replay';

export interface HistoryEntry {
  id: string;
  command: WindowCommand;
  inverse: WindowCommand;
  source: CommandSource;
  timestamp: number;
}

export interface Snapshot {
  windows: WindowState[];
  nextZ: number;
  focusId: string | null;
}

export const DEFAULT_MIN_SIZE: Size = { width: 280, height: 180 };

export const DEFAULT_BOUNDS: DesktopBounds = {
  x: 0,
  y: 28,
  width: 1440,
  height: 820,
};
