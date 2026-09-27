import type { ImportanceRegion, Rect } from './types';

export const area = (r: Rect) => Math.max(0, r.w) * Math.max(0, r.h);

export function intersect(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const r = Math.min(a.x + a.w, b.x + b.w);
  const bt = Math.min(a.y + a.h, b.y + b.h);
  if (r <= x || bt <= y) return null;
  return { x, y, w: r - x, h: bt - y };
}

export const overlapArea = (a: Rect, b: Rect) => {
  const i = intersect(a, b);
  return i ? area(i) : 0;
};

export const center = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

export const contains = (r: Rect, x: number, y: number) =>
  x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

export function clampRect(r: Rect, bounds: Rect, minW = 160, minH = 100): Rect {
  const w = Math.max(minW, Math.min(r.w, bounds.w));
  const h = Math.max(minH, Math.min(r.h, bounds.h));
  const x = Math.min(Math.max(r.x, bounds.x - w + 80), bounds.x + bounds.w - 80);
  const y = Math.min(Math.max(r.y, bounds.y), bounds.y + bounds.h - 40);
  return { x, y, w, h };
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const lerpRect = (a: Rect, b: Rect, t: number): Rect => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  w: lerp(a.w, b.w, t),
  h: lerp(a.h, b.h, t),
});

export const rectEq = (a: Rect, b: Rect, eps = 0.5) =>
  Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps && Math.abs(a.w - b.w) < eps && Math.abs(a.h - b.h) < eps;

/** Title bar height of a normal window; importance regions live in the content box below it. */
export const TITLEBAR = 38;

export function contentBox(r: Rect): Rect {
  return { x: r.x, y: r.y + TITLEBAR, w: r.w, h: Math.max(0, r.h - TITLEBAR) };
}

/** Importance region → absolute screen rect. */
export function regionToScreen(win: Rect, reg: ImportanceRegion): Rect {
  const c = contentBox(win);
  return { x: c.x + reg.x * c.w, y: c.y + reg.y * c.h, w: reg.w * c.w, h: reg.h * c.h };
}

/**
 * Fraction of `target` that stays visible after subtracting `occluders`.
 * Uses a coarse grid sample — fast, order-independent and good enough for policy decisions.
 */
export function visibleFraction(target: Rect, occluders: Rect[], samples = 14): number {
  if (occluders.length === 0) return 1;
  let visible = 0;
  let total = 0;
  for (let i = 0; i < samples; i++) {
    for (let j = 0; j < samples; j++) {
      const px = target.x + ((i + 0.5) / samples) * target.w;
      const py = target.y + ((j + 0.5) / samples) * target.h;
      total++;
      if (!occluders.some((o) => contains(o, px, py))) visible++;
    }
  }
  return visible / total;
}

export const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
