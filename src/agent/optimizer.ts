import { area, center, intersect, overlapArea } from '../kernel/geometry';
import type { Rect, WindowRole } from '../kernel/types';

/**
 * Two solvers over the same search space.
 *
 *  • "math"  — the textbook multi-objective layout: minimise overlap, maximise screen use.
 *              It is *optimal* and routinely produces layouts people find strange:
 *              slivers, swapped positions, windows teleporting across the screen.
 *  • "human" — the same solver plus human priors the agent brings: spatial stability,
 *              aspect preservation, a fixed focus, reading order, semantic adjacency,
 *              and protection of important regions.
 *
 * The comparison is the point of RQ2: the gap between the two is what an agent has to
 * know that geometry alone does not.
 */
export interface LayoutItem {
  id: string;
  rect: Rect;
  role: WindowRole;
  /** important regions in absolute coordinates, relative to the item's current rect */
  important?: Rect[];
  /** items the user just used or explicitly pinned */
  fixed?: boolean;
  /** semantic partner (e.g. reference ↔ primary) */
  partner?: string;
  minW?: number;
  minH?: number;
}

export interface LayoutMetrics {
  overlap: number; // fraction of summed window area that overlaps
  coverage: number; // fraction of work area covered
  displacement: number; // mean centre displacement, px
  aspect: number; // mean |log(aspect ratio change)|
  sizeChange: number; // mean |log(area change)|
  orderViolations: number; // pairwise left/right or top/bottom swaps
  minSide: number; // smallest window side, px
  importantHidden: number; // fraction of important area occluded
  strangeness: number; // composite "would a person find this weird?" score (0..1+)
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const gauss = (r: () => number) => {
  const u = Math.max(1e-9, r());
  const v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

function coverageOf(rects: Rect[], work: Rect, n = 24) {
  let hit = 0;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const x = work.x + ((i + 0.5) / n) * work.w;
      const y = work.y + ((j + 0.5) / n) * work.h;
      if (rects.some((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h)) hit++;
    }
  return hit / (n * n);
}

function movedImportant(item: LayoutItem, r: Rect): Rect[] {
  if (!item.important) return [];
  const sx = r.w / item.rect.w;
  const sy = r.h / item.rect.h;
  return item.important.map((im) => ({
    x: r.x + (im.x - item.rect.x) * sx,
    y: r.y + (im.y - item.rect.y) * sy,
    w: im.w * sx,
    h: im.h * sy,
  }));
}

export function metrics(items: LayoutItem[], after: Rect[], work: Rect): LayoutMetrics {
  let ov = 0;
  let tot = 0;
  for (let i = 0; i < after.length; i++) {
    tot += area(after[i]);
    for (let j = i + 1; j < after.length; j++) ov += overlapArea(after[i], after[j]);
  }
  let disp = 0;
  let asp = 0;
  let sz = 0;
  let minSide = Infinity;
  items.forEach((it, i) => {
    const a = center(it.rect);
    const b = center(after[i]);
    disp += Math.hypot(a.x - b.x, a.y - b.y);
    asp += Math.abs(Math.log(after[i].w / after[i].h / (it.rect.w / it.rect.h)));
    sz += Math.abs(Math.log(area(after[i]) / area(it.rect)));
    minSide = Math.min(minSide, after[i].w, after[i].h);
  });
  let viol = 0;
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++) {
      const a0 = center(items[i].rect);
      const b0 = center(items[j].rect);
      const a1 = center(after[i]);
      const b1 = center(after[j]);
      if (Math.abs(a0.x - b0.x) > 60 && Math.sign(a0.x - b0.x) !== Math.sign(a1.x - b1.x)) viol++;
      if (Math.abs(a0.y - b0.y) > 60 && Math.sign(a0.y - b0.y) !== Math.sign(a1.y - b1.y)) viol++;
    }
  let impTot = 0;
  let impHid = 0;
  items.forEach((it, i) => {
    for (const im of movedImportant(it, after[i])) {
      impTot += area(im);
      after.forEach((o, j) => {
        if (j !== i && j > i) {
          const x = intersect(im, o);
          if (x) impHid += area(x);
        }
      });
    }
  });
  const n = Math.max(1, items.length);
  const m = {
    overlap: tot ? ov / tot : 0,
    coverage: coverageOf(after, work),
    displacement: disp / n,
    aspect: asp / n,
    sizeChange: sz / n,
    orderViolations: viol,
    minSide: isFinite(minSide) ? minSide : 0,
    importantHidden: impTot ? Math.min(1, impHid / impTot) : 0,
    strangeness: 0,
  };
  m.strangeness =
    Math.min(1, m.displacement / 500) * 0.3 +
    Math.min(1, m.aspect / 0.9) * 0.25 +
    Math.min(1, m.orderViolations / Math.max(1, n)) * 0.25 +
    (m.minSide < 200 ? 0.2 * (1 - m.minSide / 200) : 0);
  return m;
}

export interface SolveOptions {
  mode: 'math' | 'human';
  iterations?: number;
  seed?: number;
}

export function solveLayout(items: LayoutItem[], work: Rect, opts: SolveOptions): Rect[] {
  const R = rng(opts.seed ?? 7);
  const iters = opts.iterations ?? 5000;
  const human = opts.mode === 'human';
  const cur = items.map((it) => ({ ...it.rect }));
  const idIndex = new Map(items.map((it, i) => [it.id, i]));

  const cost = (rs: Rect[]) => {
    let ov = 0;
    let out = 0;
    for (let i = 0; i < rs.length; i++) {
      const r = rs[i];
      out += Math.max(0, work.x - r.x) + Math.max(0, work.y - r.y) + Math.max(0, r.x + r.w - work.x - work.w) + Math.max(0, r.y + r.h - work.y - work.h);
      for (let j = i + 1; j < rs.length; j++) ov += overlapArea(r, rs[j]);
    }
    const W = work.w * work.h;
    let c = (ov / W) * 6 + (out / (work.w + work.h)) * 8 + (1 - coverageOf(rs, work, 16)) * 2;
    if (!human) return c;
    rs.forEach((r, i) => {
      const it = items[i];
      const a = center(it.rect);
      const b = center(r);
      c += (Math.hypot(a.x - b.x, a.y - b.y) / Math.hypot(work.w, work.h)) * (it.fixed ? 40 : 3.2);
      c += Math.abs(Math.log(r.w / r.h / (it.rect.w / it.rect.h))) * 2.4;
      c += Math.max(0, -Math.log(area(r) / area(it.rect))) * (it.role === 'primary' ? 2.5 : 0.8);
      if (r.w < 260 || r.h < 180) c += 1.5;
      if (it.partner !== undefined) {
        const p = idIndex.get(it.partner);
        if (p !== undefined) {
          const pr = rs[p];
          const gap = Math.max(0, Math.max(pr.x - (r.x + r.w), r.x - (pr.x + pr.w))) + Math.max(0, Math.max(pr.y - (r.y + r.h), r.y - (pr.y + pr.h)));
          c += (gap / work.w) * 3;
        }
      }
      for (const im of movedImportant(it, r)) {
        rs.forEach((o, j) => {
          if (j !== i) c += (overlapArea(im, o) / W) * 14;
        });
      }
    });
    for (let i = 0; i < rs.length; i++)
      for (let j = i + 1; j < rs.length; j++) {
        const a0 = center(items[i].rect);
        const b0 = center(items[j].rect);
        const a1 = center(rs[i]);
        const b1 = center(rs[j]);
        if (Math.abs(a0.x - b0.x) > 60 && Math.sign(a0.x - b0.x) !== Math.sign(a1.x - b1.x)) c += 0.9;
      }
    return c;
  };

  let best = cur.map((r) => ({ ...r }));
  let bestC = cost(best);
  let state = best.map((r) => ({ ...r }));
  let stateC = bestC;
  for (let k = 0; k < iters; k++) {
    const T = 0.08 * (1 - k / iters) + 1e-4;
    const i = Math.floor(R() * state.length);
    if (human && items[i].fixed) continue;
    const next = state.map((r) => ({ ...r }));
    const r = next[i];
    const mv = R();
    const step = 120 * (1 - k / iters) + 8;
    if (mv < 0.45) {
      r.x += gauss(R) * step;
      r.y += gauss(R) * step;
    } else if (mv < 0.8 || !human) {
      // the math solver may also reshape freely, which is where slivers come from
      r.w = Math.max(items[i].minW ?? 90, r.w + gauss(R) * step);
      r.h = Math.max(items[i].minH ?? 70, r.h + gauss(R) * step);
    } else {
      const s = Math.exp(gauss(R) * 0.08);
      r.w = Math.max(items[i].minW ?? 200, r.w * s);
      r.h = Math.max(items[i].minH ?? 140, r.h * s);
    }
    const c = cost(next);
    if (c < stateC || R() < Math.exp((stateC - c) / T)) {
      state = next;
      stateC = c;
      if (c < bestC) {
        best = next.map((q) => ({ ...q }));
        bestC = c;
      }
    }
  }
  return best.map((r) => ({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) }));
}

/**
 * Place one window (keeping its size, or shrinking in steps) so it avoids `avoid` rects,
 * stays close to where it was, and prefers not to cover `soft` rects. Used by rules.
 */
export function placeAvoiding(
  rect: Rect,
  work: Rect,
  avoid: Rect[],
  soft: Rect[] = [],
  scales = [1, 0.85, 0.7, 0.55],
): Rect | null {
  const c0 = center(rect);
  let best: Rect | null = null;
  let bestC = Infinity;
  for (const s of scales) {
    const w = Math.round(rect.w * s);
    const h = Math.round(rect.h * s);
    for (let x = work.x; x + w <= work.x + work.w; x += 20) {
      for (let y = work.y; y + h <= work.y + work.h; y += 20) {
        const r = { x, y, w, h };
        if (avoid.some((a) => overlapArea(a, r) > 0)) continue;
        const c1 = center(r);
        let c = Math.hypot(c1.x - c0.x, c1.y - c0.y) / 400 + (1 - s) * 2.2;
        for (const so of soft) c += (overlapArea(so, r) / area(r)) * 1.5;
        if (c < bestC) {
          bestC = c;
          best = r;
        }
      }
    }
    if (best) return best;
  }
  return best;
}
