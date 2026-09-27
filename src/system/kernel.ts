import { useSyncExternalStore } from 'react';
import { WindowKernel } from '../kernel/kernel';
import type { KernelState } from '../kernel/types';

export const kernel = new WindowKernel({ w: window.innerWidth, h: window.innerHeight });

export function useKernel<T>(sel: (s: KernelState) => T): T {
  return useSyncExternalStore(kernel.subscribe, () => sel(kernel.getState()));
}

export const MENUBAR = 28;
export const DOCK_H = 78;

export function workArea() {
  const { w, h } = kernel.getState().screen;
  return { x: 8, y: MENUBAR + 8, w: w - 16, h: h - MENUBAR - DOCK_H - 16 };
}
