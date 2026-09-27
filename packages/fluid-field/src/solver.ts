import { centroid, type Rect, type WindowState } from '@aquawindow/wm-kernel';

export interface SolverConfig {
  enabled: boolean;
  fusionRadius: number;
  splitRadius: number;
  spring: number;
  damping: number;
  overlapThreshold: number;
  tileMode: boolean;
}

export const DEFAULT_SOLVER: SolverConfig = {
  enabled: false,
  fusionRadius: 56,
  splitRadius: 140,
  spring: 0.18,
  damping: 0.72,
  overlapThreshold: 0.22,
  tileMode: false,
};

export interface SolverResult {
  rects: Record<string, Rect>;
  pressure: Record<string, number>;
  fuse: string[][];
  split: string[];
}

interface Body {
  id: string;
  rect: Rect;
  vx: number;
  vy: number;
  pinned: boolean;
  groupId: string | null;
  tags: string[];
  minW: number;
  minH: number;
}

const velocities = new Map<string, { vx: number; vy: number }>();

export function resetSolverVelocities(): void {
  velocities.clear();
}

export function stepSolver(
  windows: WindowState[],
  bounds: Rect,
  config: SolverConfig,
  dt = 1,
): SolverResult {
  const visible = windows.filter((w) => w.status !== 'minimized');
  const bodies: Body[] = visible.map((w) => {
    const v = velocities.get(w.id) ?? { vx: 0, vy: 0 };
    return {
      id: w.id,
      rect: { ...w.rect },
      vx: v.vx,
      vy: v.vy,
      pinned: w.pinned || w.status === 'maximized',
      groupId: w.groupId,
      tags: w.semanticTags,
      minW: w.minSize.width,
      minH: w.minSize.height,
    };
  });

  const pressure: Record<string, number> = {};
  for (const b of bodies) pressure[b.id] = 0;

  if (config.tileMode) {
    tileBodies(bodies, bounds);
  } else if (config.enabled) {
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i]!;
        const b = bodies[j]!;
        resolvePair(a, b, config, pressure);
      }
    }
    for (const b of bodies) {
      if (b.pinned) {
        b.vx = 0;
        b.vy = 0;
        continue;
      }
      b.vx *= config.damping;
      b.vy *= config.damping;
      b.rect.x += b.vx * dt;
      b.rect.y += b.vy * dt;
      clampBody(b, bounds);
    }
  }

  const fuse: string[][] = [];
  const split: string[] = [];
  if (config.enabled && !config.tileMode) {
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i]!;
        const b = bodies[j]!;
        const gap = surfaceGap(a.rect, b.rect);
        const related = sharesTag(a, b) || a.groupId === b.groupId;
        if (related && gap < config.fusionRadius && a.groupId !== b.groupId) {
          fuse.push([a.id, b.id]);
        }
        if (a.groupId && a.groupId === b.groupId && gap > config.splitRadius) {
          split.push(b.id);
        }
      }
    }
  }

  const rects: Record<string, Rect> = {};
  for (const b of bodies) {
    rects[b.id] = b.rect;
    velocities.set(b.id, { vx: b.vx, vy: b.vy });
  }

  return { rects, pressure, fuse, split };
}

function sharesTag(a: Body, b: Body): boolean {
  return a.tags.some((t) => b.tags.includes(t));
}

function surfaceGap(a: Rect, b: Rect): number {
  const dx = Math.max(0, Math.max(a.x - (b.x + b.width), b.x - (a.x + a.width)));
  const dy = Math.max(0, Math.max(a.y - (b.y + b.height), b.y - (a.y + a.height)));
  return Math.hypot(dx, dy);
}

function overlapAmount(a: Rect, b: Rect): { ox: number; oy: number } {
  const ox = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const oy = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return { ox, oy };
}

function resolvePair(a: Body, b: Body, config: SolverConfig, pressure: Record<string, number>): void {
  const { ox, oy } = overlapAmount(a.rect, b.rect);
  if (ox <= 0 || oy <= 0) return;

  const ca = centroid(a.rect);
  const cb = centroid(b.rect);
  const alongX = ox < oy;
  const push = (alongX ? ox : oy) * config.spring;
  const dirX = ca.x <= cb.x ? -1 : 1;
  const dirY = ca.y <= cb.y ? -1 : 1;

  const intensity = Math.min(1, (alongX ? ox / Math.min(a.rect.width, b.rect.width) : oy / Math.min(a.rect.height, b.rect.height)));
  pressure[a.id] = (pressure[a.id] ?? 0) + intensity;
  pressure[b.id] = (pressure[b.id] ?? 0) + intensity;

  if (intensity < config.overlapThreshold) {
    compressPair(a, b, alongX, push);
    return;
  }

  if (!a.pinned) {
    if (alongX) a.vx += dirX * push;
    else a.vy += dirY * push;
  }
  if (!b.pinned) {
    if (alongX) b.vx -= dirX * push;
    else b.vy -= dirY * push;
  }
}

function compressPair(a: Body, b: Body, alongX: boolean, push: number): void {
  const shrink = push * 0.5;
  if (alongX) {
    if (!a.pinned && a.rect.width - shrink >= a.minW) {
      if (a.rect.x < b.rect.x) a.rect.width -= shrink;
      else {
        a.rect.x += shrink;
        a.rect.width -= shrink;
      }
    }
    if (!b.pinned && b.rect.width - shrink >= b.minW) {
      if (b.rect.x < a.rect.x) b.rect.width -= shrink;
      else {
        b.rect.x += shrink;
        b.rect.width -= shrink;
      }
    }
  } else {
    if (!a.pinned && a.rect.height - shrink >= a.minH) {
      if (a.rect.y < b.rect.y) a.rect.height -= shrink;
      else {
        a.rect.y += shrink;
        a.rect.height -= shrink;
      }
    }
    if (!b.pinned && b.rect.height - shrink >= b.minH) {
      if (b.rect.y < a.rect.y) b.rect.height -= shrink;
      else {
        b.rect.y += shrink;
        b.rect.height -= shrink;
      }
    }
  }
}

function clampBody(b: Body, bounds: Rect): void {
  b.rect.width = Math.min(b.rect.width, bounds.width);
  b.rect.height = Math.min(b.rect.height, bounds.height);
  b.rect.x = Math.min(Math.max(bounds.x, b.rect.x), bounds.x + bounds.width - b.rect.width);
  b.rect.y = Math.min(Math.max(bounds.y, b.rect.y), bounds.y + bounds.height - b.rect.height);
}

function tileBodies(bodies: Body[], bounds: Rect): void {
  const n = bodies.length;
  if (n === 0) return;
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const gap = 10;
  const cellW = (bounds.width - gap * (cols + 1)) / cols;
  const cellH = (bounds.height - gap * (rows + 1)) / rows;
  bodies.forEach((b, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    b.rect = {
      x: bounds.x + gap + c * (cellW + gap),
      y: bounds.y + gap + r * (cellH + gap),
      width: cellW,
      height: cellH,
    };
    b.vx = 0;
    b.vy = 0;
  });
}
