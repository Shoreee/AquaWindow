import type { WindowCommand, WindowStore } from '@aquawindow/wm-kernel';
import type { StudyEvent } from './logger.js';

export async function replayEvents(store: WindowStore, events: StudyEvent[], speed = 4): Promise<void> {
  const commands = events.filter((e) => e.kind === 'kernel' && isCommandEvent(e.payload));
  let last = commands[0]?.t ?? Date.now();
  for (const event of commands) {
    const wait = Math.max(0, (event.t - last) / speed);
    last = event.t;
    if (wait) await sleep(wait);
    const payload = event.payload as { type: 'command'; command: WindowCommand };
    store.dispatch(payload.command, 'replay');
  }
}

function isCommandEvent(payload: unknown): payload is { type: 'command'; command: WindowCommand } {
  return typeof payload === 'object' && payload !== null && (payload as { type?: string }).type === 'command';
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
