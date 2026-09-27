/**
 * Peeling back windows (after Beaudouin-Lafon, UIST 2001).
 * Dragging a corner C to point P folds the window along the perpendicular bisector of CP.
 * The corner side is removed from the window (revealing what is beneath) and reflected
 * across the fold to form the flap (the window's back side).
 */
type Pt = [number, number];

function clipHalfPlane(poly: Pt[], m: Pt, n: Pt, keepPositive: boolean): Pt[] {
  const side = (p: Pt) => ((p[0] - m[0]) * n[0] + (p[1] - m[1]) * n[1]) * (keepPositive ? 1 : -1);
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const sa = side(a);
    const sb = side(b);
    if (sa >= 0) out.push(a);
    if (sa * sb < 0) {
      const t = sa / (sa - sb);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

export interface PeelGeometry {
  visible: Pt[];
  flap: Pt[];
  fold: [Pt, Pt] | null;
  amount: number;
}

export function peelGeometry(w: number, h: number, corner: Pt, p: Pt): PeelGeometry | null {
  const dx = p[0] - corner[0];
  const dy = p[1] - corner[1];
  const len = Math.hypot(dx, dy);
  if (len < 4) return null;
  const n: Pt = [dx / len, dy / len];
  const m: Pt = [(corner[0] + p[0]) / 2, (corner[1] + p[1]) / 2];
  const rect: Pt[] = [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ];
  const visible = clipHalfPlane(rect, m, n, true);
  const cut = clipHalfPlane(rect, m, n, false);
  const reflect = (q: Pt): Pt => {
    const d = (q[0] - m[0]) * n[0] + (q[1] - m[1]) * n[1];
    return [q[0] - 2 * d * n[0], q[1] - 2 * d * n[1]];
  };
  const flap = cut.map(reflect);
  const onFold = visible.filter((q) => Math.abs((q[0] - m[0]) * n[0] + (q[1] - m[1]) * n[1]) < 0.5);
  return { visible, flap, fold: onFold.length >= 2 ? [onFold[0], onFold[1]] : null, amount: len / Math.hypot(w, h) };
}

export const polyCss = (pts: Pt[]) => `polygon(${pts.map((q) => `${q[0].toFixed(1)}px ${q[1].toFixed(1)}px`).join(',')})`;
export const polySvg = (pts: Pt[]) => pts.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(' ');
