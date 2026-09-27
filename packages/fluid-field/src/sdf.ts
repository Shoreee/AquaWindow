import type { Rect } from '@aquawindow/wm-kernel';

/** Superellipse (Lamé) signed distance. n=4 is a rounded-rect-like "squircle". */
export function sdSuperellipse(px: number, py: number, rect: Rect, n = 4, padding = 10): number {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const rx = rect.width / 2 + padding;
  const ry = rect.height / 2 + padding;
  const dx = Math.abs(px - cx) / Math.max(rx, 1e-4);
  const dy = Math.abs(py - cy) / Math.max(ry, 1e-4);
  const value = Math.pow(dx, n) + Math.pow(dy, n);
  return value - 1;
}

export function smin(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

export function smax(a: number, b: number, k: number): number {
  return -smin(-a, -b, k);
}

export interface FieldWindow {
  id: string;
  rect: Rect;
  groupId: string | null;
  pinned: boolean;
  depth: number;
  pressure: number;
}

export function sampleField(px: number, py: number, windows: FieldWindow[], k = 0.35): number {
  let d = 1e6;
  for (const w of windows) {
    const sd = sdSuperellipse(px, py, w.rect);
    d = w.groupId ? smin(d, sd, k) : Math.min(d, sd);
  }
  return d;
}

/** Approximate a clip-path polygon by marching around the superellipse. */
export function clipPathForRect(rect: Rect, n = 4, padding = 10, segments = 32): string {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const rx = rect.width / 2 + padding;
  const ry = rect.height / 2 + padding;
  const pts: string[] = [];
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    const factor = Math.pow(Math.abs(c) ** n + Math.abs(s) ** n, -1 / n);
    const x = cx + rx * factor * c;
    const y = cy + ry * factor * s;
    pts.push(`${x.toFixed(1)}px ${y.toFixed(1)}px`);
  }
  return `polygon(${pts.join(', ')})`;
}

/** Local (window-relative) clip-path so it can be applied on the chrome element. */
export function localClipPath(rect: Rect, n = 4, padding = 10, segments = 32): string {
  const rx = rect.width / 2 + padding;
  const ry = rect.height / 2 + padding;
  const cx = rect.width / 2;
  const cy = rect.height / 2;
  const pts: string[] = [];
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    const factor = Math.pow(Math.abs(c) ** n + Math.abs(s) ** n, -1 / n);
    const x = cx + rx * factor * c;
    const y = cy + ry * factor * s;
    pts.push(`${x.toFixed(1)}px ${y.toFixed(1)}px`);
  }
  return `polygon(${pts.join(', ')})`;
}
