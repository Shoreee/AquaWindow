/**
 * App → system signal bus. Apps publish semantic events (a mention in a meeting, a tutorial
 * step change, a failed file search) that techniques and the agent can react to. Apps never
 * move windows themselves.
 */
export interface BusEvent {
  t: number;
  type:
    | 'meeting.mention'
    | 'meeting.slide'
    | 'meeting.speaker'
    | 'chat.message'
    | 'tutorial.step'
    | 'tutorial.done'
    | 'files.search'
    | 'files.open'
    | 'files.hover'
    | 'agentlog.created'
    | 'wiki.navigate'
    | 'design.stroke'
    | 'task.done';
  windowId?: string;
  data?: Record<string, unknown>;
}

type L = (e: BusEvent) => void;

class Bus {
  private ls = new Set<L>();
  recent: BusEvent[] = [];
  emit(e: Omit<BusEvent, 't'>) {
    const full = { ...e, t: performance.now() } as BusEvent;
    this.recent.push(full);
    if (this.recent.length > 200) this.recent.shift();
    this.ls.forEach((l) => l(full));
  }
  on(fn: L) {
    this.ls.add(fn);
    return () => {
      this.ls.delete(fn);
    };
  }
  clear() {
    this.recent = [];
  }
}

export const bus = new Bus();
