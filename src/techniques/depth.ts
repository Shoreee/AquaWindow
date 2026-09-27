import type { Rect, WindowState } from '../kernel/types';

/**
 * Depth is rendered as a perspective recession toward a vanishing point slightly above the
 * screen centre: receding windows shrink, drift inward, lose contrast and blur a little,
 * but stay spatially stable and clickable (unlike minimise, which removes them).
 */
export const DEPTH_SCALE = 0.34;

export function depthTransform(depth: number, rect: Rect, screen: { w: number; h: number }) {
  const s = 1 - DEPTH_SCALE * depth;
  const vx = screen.w / 2;
  const vy = screen.h * 0.42;
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const ncx = cx + (vx - cx) * depth * 0.28;
  const ncy = cy + (vy - cy) * depth * 0.28 - depth * 26;
  return { s, dx: ncx - cx, dy: ncy - cy };
}

/** The rectangle a window actually occupies on screen after depth recession. */
export function visualRect(w: Pick<WindowState, 'rect' | 'depth'>, screen: { w: number; h: number }): Rect {
  if (!w.depth) return w.rect;
  const { s, dx, dy } = depthTransform(w.depth, w.rect, screen);
  const nw = w.rect.w * s;
  const nh = w.rect.h * s;
  return { x: w.rect.x + dx + (w.rect.w - nw) / 2, y: w.rect.y + dy + (w.rect.h - nh) / 2, w: nw, h: nh };
}

export const depthStyle = (depth: number, xray: boolean) => ({
  filter: depth > 0.02 ? `blur(${(depth * 2.2).toFixed(2)}px) saturate(${1 - depth * 0.35}) brightness(${1 - depth * 0.08})` : undefined,
  opacity: xray ? (depth < 0.02 ? 0.12 : 1) : 1 - depth * 0.25,
});
