import { describe, expect, it } from 'vitest';
import { sdSuperellipse, smin, localClipPath } from './sdf.js';
import { stepSolver, DEFAULT_SOLVER } from './solver.js';
import type { WindowState } from '@aquawindow/wm-kernel';

describe('sdf', () => {
  it('is negative inside and positive outside a superellipse', () => {
    const rect = { x: 0, y: 0, width: 200, height: 100 };
    expect(sdSuperellipse(100, 50, rect)).toBeLessThan(0);
    expect(sdSuperellipse(400, 50, rect)).toBeGreaterThan(0);
  });

  it('smooth-min is at most min', () => {
    expect(smin(0.2, 0.5, 0.4)).toBeLessThanOrEqual(0.2);
  });

  it('emits a polygon clip-path', () => {
    const path = localClipPath({ x: 0, y: 0, width: 100, height: 80 });
    expect(path.startsWith('polygon(')).toBe(true);
  });
});

describe('solver', () => {
  it('compresses overlapping unpinned windows', () => {
    const windows: WindowState[] = [
      {
        id: 'a',
        appId: 'x',
        title: 'A',
        rect: { x: 0, y: 0, width: 400, height: 300 },
        restoreRect: { x: 0, y: 0, width: 400, height: 300 },
        z: 1,
        status: 'normal',
        focused: true,
        pinned: false,
        groupId: null,
        semanticTags: [],
        minSize: { width: 200, height: 160 },
        depth: 0,
      },
      {
        id: 'b',
        appId: 'x',
        title: 'B',
        rect: { x: 200, y: 0, width: 400, height: 300 },
        restoreRect: { x: 200, y: 0, width: 400, height: 300 },
        z: 2,
        status: 'normal',
        focused: false,
        pinned: false,
        groupId: null,
        semanticTags: [],
        minSize: { width: 200, height: 160 },
        depth: 0,
      },
    ];
    let result = stepSolver(windows, { x: 0, y: 0, width: 1200, height: 800 }, { ...DEFAULT_SOLVER, enabled: true });
    expect(result.pressure.a).toBeGreaterThan(0);
    const stepped = windows.map((w) => ({ ...w, rect: result.rects[w.id]! }));
    result = stepSolver(stepped, { x: 0, y: 0, width: 1200, height: 800 }, { ...DEFAULT_SOLVER, enabled: true });
    const moved =
      Math.abs(result.rects.a!.x - 0) +
      Math.abs(result.rects.b!.x - 200) +
      Math.abs(result.rects.a!.width - 400) +
      Math.abs(result.rects.b!.width - 400);
    expect(moved).toBeGreaterThan(0);
  });
});
