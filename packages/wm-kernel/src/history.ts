import type { CommandSource, HistoryEntry, WindowCommand } from './types.js';

const MAX_HISTORY = 200;

export class UndoTimeline {
  private past: HistoryEntry[] = [];
  private future: HistoryEntry[] = [];

  get entries(): readonly HistoryEntry[] {
    return this.past;
  }

  get redoEntries(): readonly HistoryEntry[] {
    return this.future;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  push(command: WindowCommand, inverse: WindowCommand, source: CommandSource): HistoryEntry {
    const entry: HistoryEntry = {
      id: cryptoRandomId(),
      command,
      inverse,
      source,
      timestamp: Date.now(),
    };
    this.past.push(entry);
    if (this.past.length > MAX_HISTORY) this.past.shift();
    this.future = [];
    return entry;
  }

  undo(): HistoryEntry | undefined {
    const entry = this.past.pop();
    if (!entry) return undefined;
    this.future.push(entry);
    return entry;
  }

  redo(): HistoryEntry | undefined {
    const entry = this.future.pop();
    if (!entry) return undefined;
    this.past.push(entry);
    return entry;
  }

  clear(): void {
    this.past = [];
    this.future = [];
  }
}

function cryptoRandomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `h-${Math.random().toString(36).slice(2, 10)}`;
}
