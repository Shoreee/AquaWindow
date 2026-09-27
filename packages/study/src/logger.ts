import type { KernelEvent, WindowStore } from '@aquawindow/wm-kernel';
import type { LayoutProposal } from '@aquawindow/agent-sdk';

export interface StudyEvent {
  t: number;
  kind: string;
  payload: unknown;
}

export interface TaskSession {
  taskId: string;
  condition: string;
  startedAt: number | null;
  completedAt: number | null;
}

export class StudyLogger {
  private events: StudyEvent[] = [];
  private session: TaskSession | null = null;
  private unsubscribe: (() => void) | null = null;

  attach(store: WindowStore): void {
    this.detach();
    this.unsubscribe = store.bus.subscribe((event: KernelEvent) => {
      if (event.type === 'state' || event.type === 'focus') return;
      this.push('kernel', event);
    });
  }

  detach(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  startTask(taskId: string, condition: string): void {
    this.session = { taskId, condition, startedAt: Date.now(), completedAt: null };
    this.push('task-start', this.session);
  }

  completeTask(): void {
    if (!this.session) return;
    this.session.completedAt = Date.now();
    this.push('task-complete', this.session);
  }

  proposal(kind: 'proposed' | 'accept' | 'partial' | 'reject', proposal: LayoutProposal, extra?: unknown): void {
    this.push(`proposal-${kind}`, { proposal, extra });
  }

  note(kind: string, payload: unknown): void {
    this.push(kind, payload);
  }

  getEvents(): StudyEvent[] {
    return [...this.events];
  }

  getSession(): TaskSession | null {
    return this.session;
  }

  toJSONL(): string {
    return this.events.map((e) => JSON.stringify(e)).join('\n');
  }

  clear(): void {
    this.events = [];
    this.session = null;
  }

  private push(kind: string, payload: unknown): void {
    this.events.push({ t: Date.now(), kind, payload });
  }
}

export function downloadText(filename: string, text: string, mime = 'application/jsonl'): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
