import type { Rect } from './types.js';

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function intersectionArea(a: Rect, b: Rect): number {
  const x = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return x * y;
}

export function area(r: Rect): number {
  return Math.max(0, r.width) * Math.max(0, r.height);
}

export function centroid(r: Rect): { x: number; y: number } {
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}

export function cloneRect(r: Rect): Rect {
  return { x: r.x, y: r.y, width: r.width, height: r.height };
}

export function clampRect(r: Rect, bounds: Rect): Rect {
  const width = Math.min(Math.max(80, r.width), bounds.width);
  const height = Math.min(Math.max(60, r.height), bounds.height);
  const x = Math.min(Math.max(bounds.x, r.x), bounds.x + bounds.width - width);
  const y = Math.min(Math.max(bounds.y, r.y), bounds.y + bounds.height - height);
  return { x, y, width, height };
}

export function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}
