import type { KernelEvent } from './types.js';

export type EventHandler = (event: KernelEvent) => void;

export class EventBus {
  private readonly listeners = new Set<EventHandler>();

  subscribe(handler: EventHandler): () => void {
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }

  emit(event: KernelEvent): void {
    for (const handler of [...this.listeners]) {
      handler(event);
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}
