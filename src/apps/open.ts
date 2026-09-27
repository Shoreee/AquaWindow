import type { WindowRole, WindowState } from '../kernel/types';
import { kernel, workArea } from '../system';
import { defaultImportance } from './importance';

export function openNear(
  parent: WindowState,
  o: { appId: string; title: string; props?: Record<string, unknown>; role?: WindowRole; size: { w: number; h: number }; group?: string },
) {
  parent = kernel.get(parent.id) ?? parent;
  const W = workArea();
  const existing = kernel.list().find((w) => w.appId === o.appId && JSON.stringify(w.props) === JSON.stringify(o.props ?? {}));
  if (existing) {
    kernel.focus(existing.id);
    return existing.id;
  }
  let x = parent.rect.x + parent.rect.w - 120;
  if (x + o.size.w > W.x + W.w) x = Math.max(W.x, parent.rect.x - o.size.w + 120);
  const y = Math.min(Math.max(W.y, parent.rect.y + 40), W.y + W.h - o.size.h);
  return kernel.open({
    appId: o.appId,
    title: o.title,
    rect: { x, y, w: o.size.w, h: Math.min(o.size.h, W.h) },
    role: o.role,
    props: o.props,
    group: o.group,
    openedFrom: parent.id,
    importance: defaultImportance(o.appId),
  });
}
