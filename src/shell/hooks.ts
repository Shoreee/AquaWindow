import { useMemo } from 'react';
import { useKernel } from '../system/kernel';

export { agent, bus, kernel, ui, undo, workArea } from '../system';
export { useKernel as useKernelState } from '../system/kernel';

/** All windows in stacking order (back → front), memoised on the kernel revision. */
export function useWindows(enabled=true) {
  const s = useKernel(st => enabled?st:null);
  return useMemo(() => s?s.order.map((id) => s.windows[id]).filter(Boolean):[], [s]);
}
