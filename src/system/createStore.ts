import { useSyncExternalStore } from 'react';

export interface Store<T> {
  get: () => T;
  set: (patch: Partial<T> | ((s: T) => Partial<T>)) => void;
  subscribe: (fn: () => void) => () => void;
}

export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial;
  const ls = new Set<() => void>();
  return {
    get: () => state,
    set(patch) {
      const p = typeof patch === 'function' ? patch(state) : patch;
      state = { ...state, ...p };
      ls.forEach((l) => l());
    },
    subscribe(fn) {
      ls.add(fn);
      return () => ls.delete(fn);
    },
  };
}

export function useStore<T extends object, S>(store: Store<T>, sel: (s: T) => S): S {
  return useSyncExternalStore(store.subscribe, () => sel(store.get()));
}
