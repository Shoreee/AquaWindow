import type { WindowKernel } from '../kernel/kernel';
import type { LayoutChange, WindowState } from '../kernel/types';

/**
 * Depth trails: exploration (wiki, docs) opens new pages *in front* while the path recedes
 * behind in depth — a spatial breadcrumb instead of a tab strip or a pile of windows.
 */
export const TRAIL_STEP = 0.2;

export function trailMembers(kernel: WindowKernel, group: string): WindowState[] {
  return kernel.list().filter((w) => w.group === group && !w.minimized);
}

export function openInTrail(kernel: WindowKernel, from: WindowState, spec: { title: string; props: Record<string, unknown> }) {
  const group = from.group?.startsWith('trail') ? from.group : `trail-${from.id}`;
  const members = trailMembers(kernel, group).filter((w) => w.id !== from.id);
  const changes: LayoutChange[] = [
    { windowId: from.id, group, depth: Math.min(0.9, TRAIL_STEP) },
    ...members.map((m) => ({ windowId: m.id, group, depth: Math.min(0.92, m.depth + TRAIL_STEP) })),
  ];
  kernel.apply(changes, 'user', 'trail:open');
  return kernel.open({
    appId: from.appId,
    title: spec.title,
    rect: { ...from.rect },
    role: from.role,
    group,
    props: spec.props,
    openedFrom: from.id,
    importance: from.importance,
  });
}

/** Bring `frontId` to depth 0 and re-stack the rest of the trail by visit order. */
export function rerankTrail(kernel: WindowKernel, group: string, frontId: string, label = 'trail:scrub') {
  const members = trailMembers(kernel, group).sort((a, b) => a.depth - b.depth);
  const front = members.find((m) => m.id === frontId);
  if (!front) return;
  const rest = members.filter((m) => m.id !== frontId);
  const changes: LayoutChange[] = [{ windowId: frontId, depth: 0, focus: true }, ...rest.map((m, i) => ({ windowId: m.id, depth: Math.min(0.92, (i + 1) * TRAIL_STEP) }))];
  kernel.apply(changes, 'user', label);
}

/** ⌥+scroll over a trail: walk one step deeper (dir = 1) or back toward the front (dir = −1). */
export function scrubTrail(kernel: WindowKernel, group: string, dir: 1 | -1) {
  const members = trailMembers(kernel, group).sort((a, b) => a.depth - b.depth);
  if (members.length < 2) return;
  // Walking deeper = the current front goes to the back; walking back = the deepest comes forward.
  const order = dir === 1 ? [...members.slice(1), members[0]] : [members[members.length - 1], ...members.slice(0, -1)];
  const changes: LayoutChange[] = order.map((m, i) => ({ windowId: m.id, depth: Math.min(0.92, i * TRAIL_STEP), ...(i === 0 ? { focus: true } : {}) }));
  kernel.apply(changes, 'user', 'trail:scrub');
}
