import type { Rect } from '../kernel/types';

/** Signed distance to a rounded box centred at (cx, cy) with half-extents (hw, hh). */
export function sdRoundBox(px: number, py: number, cx: number, cy: number, hw: number, hh: number, r: number) {
  const rr = Math.min(r, hw, hh);
  const qx = Math.abs(px - cx) - hw + rr;
  const qy = Math.abs(py - cy) - hh + rr;
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - rr;
}

export const sdRect = (px: number, py: number, rect: Rect, r: number) =>
  sdRoundBox(px, py, rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w / 2, rect.h / 2, r);

/** Polynomial smooth minimum (Quilez). k is the blend radius in px — the "surface tension". */
export function smin(a: number, b: number, k: number) {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - (h * h * k) / 4;
}

/** Signed superellipse-ish implicit value: |x/a|^n + |y/b|^n - 1 (only the sign/zero-set is meaningful). */
export function superellipse(px: number, py: number, a: number, b: number, n: number) {
  return Math.pow(Math.abs(px / a), n) + Math.pow(Math.abs(py / b), n) - 1;
}

type Pt = [number, number];

/**
 * Rectangle whose corners are superellipse ("continuous", squircle) curves.
 * Returned in the local coordinate frame of the rect (0..w, 0..h).
 * n = 2 gives circular corners, n ≈ 5 gives Apple-like continuous corners.
 */
export function squirclePoints(w: number, h: number, r: number, n = 5, seg = 10): Pt[] {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  const pts: Pt[] = [];
  const corners: [number, number, number, number][] = [
    [w - rr, rr, 1, -1],
    [w - rr, h - rr, 1, 1],
    [rr, h - rr, -1, 1],
    [rr, rr, -1, -1],
  ];
  const e = 2 / n;
  corners.forEach(([cx, cy, sx, sy], ci) => {
    for (let i = 0; i <= seg; i++) {
      // sweep each corner in clockwise order
      const t = (i / seg) * (Math.PI / 2);
      const ct = Math.cos(t);
      const st = Math.sin(t);
      let dx: number, dy: number;
      if (ci % 2 === 0) {
        dx = Math.pow(st, e);
        dy = Math.pow(ct, e);
      } else {
        dx = Math.pow(ct, e);
        dy = Math.pow(st, e);
      }
      pts.push([cx + sx * rr * dx, cy + sy * rr * dy]);
    }
  });
  return pts;
}

export function pointsToPath(pts: Pt[], ox = 0, oy = 0): string {
  if (pts.length === 0) return '';
  let d = `M${(pts[0][0] - ox).toFixed(1)} ${(pts[0][1] - oy).toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) d += `L${(pts[i][0] - ox).toFixed(1)} ${(pts[i][1] - oy).toFixed(1)}`;
  return d + 'Z';
}

export interface Obstacle {
  rect: Rect;
  radius: number;
  /** Extra gap kept between the yielding window and the obstacle. */
  gap: number;
}

/** Resample a closed polyline to n points evenly spaced by arc length. */
export function resampleClosed(pts: Pt[], n: number): Pt[] {
  const seg: number[] = [];
  let total = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    seg.push(l);
    total += l;
  }
  const out: Pt[] = [];
  let si = 0;
  let acc = 0;
  for (let k = 0; k < n; k++) {
    const target = (k / n) * total;
    while (si < seg.length - 1 && acc + seg[si] < target) {
      acc += seg[si];
      si++;
    }
    const a = pts[si];
    const b = pts[(si + 1) % pts.length];
    const t = seg[si] > 0 ? (target - acc) / seg[si] : 0;
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}

export const CONTOUR_SAMPLES = 180;

/**
 * Fluid yielding contour.
 * The window keeps its content scale; instead its *boundary* retreats where an obstacle
 * (the focused / dragged window) presses into it, producing a smooth concave dent.
 * The base squircle outline is sampled evenly by arc length (so corners stay smooth);
 * for every sample a ray is cast from an interior anchor and stopped at the obstacle's
 * inflated SDF. Retreat distances are circularly smoothed so the dent reads as surface
 * tension rather than a boolean cut. The result always has CONTOUR_SAMPLES points so CSS
 * can interpolate between dented and relaxed states.
 *
 * Returns points in local space (relative to self.x/self.y).
 */
export function fluidContour(
  self: Rect,
  selfRadius: number,
  obstacles: Obstacle[],
  opts: { samples?: number; smooth?: number } = {},
): { points: Pt[]; visibleRatio: number; dented: boolean } {
  const samples = opts.samples ?? CONTOUR_SAMPLES;
  const smooth = opts.smooth ?? 5;
  const base = resampleClosed(squirclePoints(self.w, self.h, selfRadius, 5, 12), samples);
  const touching = obstacles.filter(
    (o) =>
      o.rect.x - o.gap < self.x + self.w &&
      o.rect.x + o.rect.w + o.gap > self.x &&
      o.rect.y - o.gap < self.y + self.h &&
      o.rect.y + o.rect.h + o.gap > self.y,
  );
  if (touching.length === 0) return { points: base, visibleRatio: 1, dented: false };

  const obsDist = (lx: number, ly: number) => {
    let d = Infinity;
    for (const o of touching) d = Math.min(d, sdRect(lx + self.x, ly + self.y, o.rect, o.radius) - o.gap);
    return d;
  };
  const cx = self.w / 2;
  const cy = self.h / 2;
  const inside = (lx: number, ly: number) => -sdRoundBox(lx, ly, cx, cy, cx, cy, selfRadius);

  const march = (ax: number, ay: number, bx: number, by: number) => {
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const dx = (bx - ax) / len;
    const dy = (by - ay) / len;
    let t = 0;
    for (let k = 0; k < 80 && t < len; k++) {
      const d = obsDist(ax + dx * t, ay + dy * t);
      if (d < 0.75) return { hit: t, len };
      t += Math.max(d, 1.25);
    }
    return { hit: len, len };
  };

  // Anchor: the rays are star-shaped around it, so choose the interior point that keeps the
  // most visible boundary (for an L-shaped remainder this lands in the corner "kernel").
  let ax = cx;
  let ay = cy;
  if (obsDist(cx, cy) < Math.min(cx, cy) * 0.9) {
    let bestScore = -1;
    const probe = base.filter((_, i) => i % 4 === 0);
    for (let i = 0; i <= 6; i++) {
      for (let j = 0; j <= 6; j++) {
        const px = 14 + (i / 6) * (self.w - 28);
        const py = 14 + (j / 6) * (self.h - 28);
        const od = obsDist(px, py);
        if (od < 10 || inside(px, py) < 8) continue;
        let score = 0;
        for (const [bx, by] of probe) {
          const m = march(px, py, bx, by);
          score += m.hit / m.len;
        }
        score += Math.min(od, 200) / 2000;
        if (score > bestScore) {
          bestScore = score;
          ax = px;
          ay = py;
        }
      }
    }
  }
  if (obsDist(ax, ay) <= 6) {
    // Fully swallowed: collapse into a small bead at the anchor so the window stays discoverable.
    const bead = resampleClosed(squirclePoints(30, 30, 15, 2, 12), samples).map(([x, y]) => [x + ax - 15, y + ay - 15] as Pt);
    return { points: bead, visibleRatio: 0, dented: true };
  }

  const tSelf = new Float64Array(samples);
  const tHit = new Float64Array(samples);
  for (let s = 0; s < samples; s++) {
    const m = march(ax, ay, base[s][0], base[s][1]);
    tSelf[s] = m.len;
    tHit[s] = Math.min(m.len, m.hit);
  }

  // Smooth the retreat ratio (not absolute radius) so long and short rays blend evenly.
  const ratio = new Float64Array(samples);
  for (let s = 0; s < samples; s++) ratio[s] = tHit[s] / tSelf[s];
  const sm = new Float64Array(samples);
  for (let s = 0; s < samples; s++) {
    let acc = 0;
    let wsum = 0;
    for (let k = -smooth; k <= smooth; k++) {
      const idx = (s + k + samples) % samples;
      const wgt = 1 - Math.abs(k) / (smooth + 1);
      acc += ratio[idx] * wgt;
      wsum += wgt;
    }
    // never grow into the obstacle: take the min of smoothed and raw retreat
    sm[s] = Math.min(ratio[s], acc / wsum);
  }

  let areaFull = 0;
  let areaCut = 0;
  const points: Pt[] = [];
  for (let s = 0; s < samples; s++) {
    const [bx, by] = base[s];
    const r = sm[s];
    points.push([ax + (bx - ax) * r, ay + (by - ay) * r]);
    areaFull += tSelf[s] * tSelf[s];
    areaCut += tSelf[s] * tSelf[s] * r * r;
  }
  return { points, visibleRatio: areaCut / areaFull, dented: true };
}

/**
 * RQ1 comparison condition — "scale" instead of "deform":
 * find the biggest free sub-rectangle of `self` on one side of the obstacle and
 * return the uniform scale + offset that fits the whole window into it.
 */
export function scaleToFree(self: Rect, obstacle: Rect, gap = 10): { s: number; dx: number; dy: number } | null {
  const ix = Math.max(self.x, obstacle.x - gap);
  const iy = Math.max(self.y, obstacle.y - gap);
  const ir = Math.min(self.x + self.w, obstacle.x + obstacle.w + gap);
  const ib = Math.min(self.y + self.h, obstacle.y + obstacle.h + gap);
  if (ir <= ix || ib <= iy) return null;
  const cands: Rect[] = [
    { x: self.x, y: self.y, w: ix - self.x, h: self.h },
    { x: ir, y: self.y, w: self.x + self.w - ir, h: self.h },
    { x: self.x, y: self.y, w: self.w, h: iy - self.y },
    { x: self.x, y: ib, w: self.w, h: self.y + self.h - ib },
  ];
  let bestS = 0;
  let bestR: Rect | null = null;
  for (const c of cands) {
    if (c.w < 20 || c.h < 20) continue;
    const s = Math.min(c.w / self.w, c.h / self.h);
    if (s > bestS) {
      bestS = s;
      bestR = c;
    }
  }
  if (!bestR) return { s: 0.18, dx: 0, dy: 0 };
  const w = self.w * bestS;
  const h = self.h * bestS;
  return { s: bestS, dx: bestR.x + (bestR.w - w) / 2 - self.x, dy: bestR.y + (bestR.h - h) / 2 - self.y };
}
