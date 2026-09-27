import { createStore } from '../system/createStore';

export interface LogRecord {
  t: number;
  wall: string;
  src: 'kernel' | 'bus' | 'agent' | 'study' | 'technique';
  type: string;
  actor?: string;
  windowId?: string;
  data?: Record<string, unknown>;
  condition?: string;
  scenario?: string | null;
  strategy?: string | null;
  participant?: string;
}

const MAX = 4000;
export const logStore = createStore<{ records: LogRecord[] }>({ records: [] });

let ctx: () => Pick<LogRecord, 'condition' | 'scenario' | 'strategy' | 'participant'> = () => ({});
export function setLogContext(fn: typeof ctx) {
  ctx = fn;
}

// Drag frames are high-frequency; keep only one per window per 250 ms in the log.
const lastMove = new Map<string, number>();

export function log(r: Omit<LogRecord, 't' | 'wall'>) {
  const t = performance.now();
  if ((r.type === 'move' || r.type === 'resize') && r.windowId) {
    const k = r.windowId + r.type;
    if (t - (lastMove.get(k) ?? -1e9) < 250) return;
    lastMove.set(k, t);
  }
  const rec: LogRecord = { t: Math.round(t), wall: new Date().toISOString(), ...ctx(), ...r };
  logStore.set((s) => ({ records: s.records.length > MAX ? [...s.records.slice(-MAX / 2), rec] : [...s.records, rec] }));
}

export function exportJsonl() {
  const body = logStore.get().records.map((r) => JSON.stringify(r)).join('\n');
  const blob = new Blob([body], { type: 'application/x-ndjson' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `aquawindow-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Summary metrics shown in the researcher console. */
export function summarize(records: LogRecord[]) {
  const by = (p: (r: LogRecord) => boolean) => records.filter(p).length;
  return {
    focusSwitches: by((r) => r.type === 'focus'),
    moves: by((r) => r.type === 'move'),
    proposals: by((r) => r.src === 'agent' && r.type === 'proposal'),
    accepted: by((r) => r.src === 'agent' && r.type === 'accept'),
    partial: by((r) => r.src === 'agent' && r.type === 'partial'),
    rejected: by((r) => r.src === 'agent' && r.type === 'reject'),
    undos: by((r) => r.type === 'undo'),
    peels: by((r) => r.type === 'peel'),
    depthOps: by((r) => r.type === 'depth'),
  };
}
