import { area, intersect, overlapArea, regionToScreen, TITLEBAR } from '../kernel/geometry';
import type { KernelState, Rect, WindowId, WindowState } from '../kernel/types';
import { fluidContour, pointsToPath, scaleToFree, squirclePoints, resampleClosed, CONTOUR_SAMPLES } from '../field/sdf';
import { depthTransform, visualRect } from './depth';
import type { Techniques } from './techniques';

export interface CutHole {
  /** local, pre-transform coordinates inside the occluding window */
  rect: Rect;
  label?: string;
  ownerId: WindowId;
}

export interface WindowVisual {
  vis: Rect;
  depthT: { s: number; dx: number; dy: number };
  clipPath?: string;
  yieldScale?: { s: number; dx: number; dy: number };
  holes: CutHole[];
  maskImage?: string;
  dented: boolean;
  visibleRatio: number;
  zIndex: number;
  radius: number;
}

export const FLUID_RADIUS = 30;
export const RECT_RADIUS = 12;

export function capsuleRectFor(w: WindowState, screen: { w: number; h: number }): Rect {
  return w.capsuleRect ?? { x: screen.w - 300, y: 44, w: 280, h: 158 };
}

/** Effective on-screen rect for layout purposes (capsule form uses its capsule rect). */
export function layoutRect(w: WindowState, screen: { w: number; h: number }): Rect {
  return w.form === 'capsule' ? capsuleRectFor(w, screen) : w.rect;
}

/** Render order: deeper layers first, then stacking order. */
export function stackingOrder(state: KernelState): WindowId[] {
  const idx = new Map(state.order.map((id, i) => [id, i]));
  return state.order
    .filter((id) => state.windows[id] && !state.windows[id].minimized)
    .sort((a, b) => {
      const wa = state.windows[a];
      const wb = state.windows[b];
      const da = Math.round(wa.depth * 20);
      const db = Math.round(wb.depth * 20);
      if (da !== db) return db - da;
      // capsules float above normal windows of the same depth
      const ca = wa.form === 'capsule' ? 1 : 0;
      const cb = wb.form === 'capsule' ? 1 : 0;
      if (ca !== cb) return ca - cb;
      return (idx.get(a) ?? 0) - (idx.get(b) ?? 0);
    });
}

function maskFor(w: number, h: number, holes: CutHole[], keep: Rect[]): string {
  const esc = (s: string) => s.replace(/#/g, '%23').replace(/"/g, "'").replace(/\n/g, '');
  const holesSvg = holes
    .map((hl) => `<rect x='${hl.rect.x.toFixed(1)}' y='${hl.rect.y.toFixed(1)}' width='${hl.rect.w.toFixed(1)}' height='${hl.rect.h.toFixed(1)}' rx='14' fill='black'/>`)
    .join('');
  const keepSvg = keep
    .map((k) => `<rect x='${k.x.toFixed(1)}' y='${k.y.toFixed(1)}' width='${k.w.toFixed(1)}' height='${k.h.toFixed(1)}' fill='white'/>`)
    .join('');
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'><defs><filter id='b' x='-20%' y='-20%' width='140%' height='140%'><feGaussianBlur stdDeviation='7'/></filter></defs><rect width='${w}' height='${h}' fill='white'/><g filter='url(#b)'>${holesSvg}</g>${keepSvg}</svg>`;
  return `url("data:image/svg+xml;utf8,${esc(svg)}")`;
}

export interface VisualInput {
  state: KernelState;
  tech: Techniques;
  /** window being dragged / resized right now, if any */
  activeId: WindowId | null;
}

const ringCache = new Map<string, string>();
function relaxedPath(w: number, h: number, r: number) {
  const key = `${Math.round(w)}x${Math.round(h)}r${r}`;
  let p = ringCache.get(key);
  if (!p) {
    p = pointsToPath(resampleClosed(squirclePoints(w, h, r, 5, 12), CONTOUR_SAMPLES));
    if (ringCache.size > 400) ringCache.clear();
    ringCache.set(key, p);
  }
  return p;
}

export function computeVisuals({ state, tech, activeId }: VisualInput): Record<WindowId, WindowVisual> {
  const order = stackingOrder(state);
  const out: Record<WindowId, WindowVisual> = {};
  const fluid = tech.shape === 'squircle';
  const radius = fluid ? FLUID_RADIUS : RECT_RADIUS;

  order.forEach((id, i) => {
    const w = state.windows[id];
    const base = layoutRect(w, state.screen);
    const depthT = tech.depth || w.depth > 0 ? depthTransform(w.depth, base, state.screen) : { s: 1, dx: 0, dy: 0 };
    out[id] = {
      vis: visualRect({ rect: base, depth: w.depth }, state.screen),
      depthT,
      holes: [],
      dented: false,
      visibleRatio: 1,
      zIndex: 10 + i,
      radius: w.form === 'capsule' ? 34 : radius,
      clipPath: fluid && w.form === 'normal' ? `path('${relaxedPath(base.w, base.h, radius)}')` : undefined,
    };
  });

  // ── RQ1: yielding boundaries (deform) vs. yielding by scaling ────────────────
  const presserId = activeId ?? state.focusedId;
  const presser = presserId ? state.windows[presserId] : undefined;
  if (tech.yield !== 'none' && presser && !presser.minimized && presser.form === 'normal' && presser.depth < 0.05) {
    const pIndex = order.indexOf(presser.id);
    const pRect = presser.rect;
    for (let i = 0; i < pIndex; i++) {
      const w = state.windows[order[i]];
      if (w.form !== 'normal' || w.depth >= 0.05 || w.role === 'system') continue;
      if (presser.group && w.group === presser.group) continue;
      // A dent is a local, readable bite. Once most of the window is covered, boolean-style
      // yielding collapses it into a sliver; classic stacking is the more honest fallback
      // and the agent (not the skin) should move the window.
      if (area(w.rect) > 0 && overlapArea(w.rect, pRect) / area(w.rect) > 0.48) continue;
      const v = out[w.id];
      if (tech.yield === 'deform') {
        const c = fluidContour(w.rect, radius, [{ rect: pRect, radius, gap: 12 }]);
        if (c.dented && c.visibleRatio >= 0.58) {
          v.clipPath = `path('${pointsToPath(c.points)}')`;
          v.dented = true;
          v.visibleRatio = c.visibleRatio;
        }
      } else {
        const sc = scaleToFree(w.rect, pRect, 12);
        if (sc) {
          v.yieldScale = sc;
          v.dented = true;
          v.visibleRatio = sc.s * sc.s;
        }
      }
    }
  }

  // ── Importance-driven compositing: important regions cut through occluders ──
  if (tech.cutout) {
    order.forEach((id, i) => {
      const occ = state.windows[id];
      if (occ.form !== 'normal') return;
      const ov = out[id];
      const s = ov.depthT.s;
      const holes: CutHole[] = [];
      for (let j = 0; j < i; j++) {
        const under = state.windows[order[j]];
        const uv = out[under.id];
        if (under.form !== 'normal' || uv.dented) continue;
        for (const reg of under.importance) {
          if (reg.weight < 0.5) continue;
          const scr = regionToScreen(uv.vis, reg);
          const hit = intersect(scr, ov.vis);
          if (!hit || hit.w < 24 || hit.h < 24) continue;
          holes.push({
            rect: { x: (hit.x - ov.vis.x) / s, y: (hit.y - ov.vis.y) / s, w: hit.w / s, h: hit.h / s },
            label: reg.label,
            ownerId: under.id,
          });
        }
      }
      if (holes.length) {
        const keep: Rect[] = [{ x: 0, y: 0, w: occ.rect.w, h: TITLEBAR }];
        for (const reg of occ.importance) {
          if (reg.weight < 0.5) continue;
          keep.push({ x: reg.x * occ.rect.w, y: TITLEBAR + reg.y * (occ.rect.h - TITLEBAR), w: reg.w * occ.rect.w, h: reg.h * (occ.rect.h - TITLEBAR) });
        }
        ov.holes = holes;
        ov.maskImage = maskFor(Math.round(occ.rect.w), Math.round(occ.rect.h), holes, keep);
      }
    });
  }

  return out;
}
