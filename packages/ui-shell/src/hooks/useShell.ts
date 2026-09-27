import { useSyncExternalStore } from 'react';
import { getSnapshot, subscribe } from '../runtime.js';

export function useShell() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
