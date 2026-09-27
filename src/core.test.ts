import { describe, expect, it } from 'vitest';
import { WindowKernel } from './kernel/kernel';
import { fluidContour, CONTOUR_SAMPLES, sdRect } from './field/sdf';
import { metrics, solveLayout, type LayoutItem } from './agent/optimizer';
import { peelGeometry } from './techniques/peel';
import { RULES } from './agent/rules';
import type { Observation } from './agent/types';
import { BASELINE } from './techniques/techniques';

describe('kernel', () => {
  it('applies batches atomically and undoes them in one step', () => {
    const k = new WindowKernel();
    const a = k.open({ appId: 'x', title: 'A', rect: { x: 0, y: 0, w: 300, h: 200 } });
    const b = k.open({ appId: 'x', title: 'B', rect: { x: 50, y: 50, w: 300, h: 200 } });
    k.apply([{ windowId: a, rect: { x: 400, y: 0, w: 300, h: 200 } }, { windowId: b, depth: 0.5 }], 'agent', 'test');
    expect(k.get(a).rect.x).toBe(400);
    expect(k.get(b).depth).toBe(0.5);
    k.undo();
    expect(k.get(a).rect.x).toBe(0);
    expect(k.get(b).depth).toBe(0);
  });

  it('focus raises to the top of the order', () => {
    const k = new WindowKernel();
    const a = k.open({ appId: 'x', title: 'A', rect: { x: 0, y: 0, w: 1, h: 1 } });
    k.open({ appId: 'x', title: 'B', rect: { x: 0, y: 0, w: 1, h: 1 } });
    k.focus(a);
    expect(k.getState().order.at(-1)).toBe(a);
    expect(k.getState().focusedId).toBe(a);
  });
});

describe('fluid contour', () => {
  const self = { x: 0, y: 0, w: 400, h: 300 };
  it('is relaxed without obstacles and always has the same sample count', () => {
    const c = fluidContour(self, 30, []);
    expect(c.dented).toBe(false);
    expect(c.points).toHaveLength(CONTOUR_SAMPLES);
  });
  it('dents away from an overlapping obstacle and never enters it', () => {
    const obstacle = { x: 300, y: 50, w: 400, h: 200 };
    const c = fluidContour(self, 30, [{ rect: obstacle, radius: 30, gap: 12 }]);
    expect(c.dented).toBe(true);
    expect(c.points).toHaveLength(CONTOUR_SAMPLES);
    expect(c.visibleRatio).toBeLessThan(1);
    for (const [x, y] of c.points) expect(sdRect(x, y, obstacle, 30)).toBeGreaterThan(-1);
  });
});

describe('peel', () => {
  it('folds the corner: visible part excludes the corner, flap is its reflection', () => {
    const g = peelGeometry(400, 300, [400, 300], [300, 200])!;
    expect(g.visible.some(([x, y]) => x === 400 && y === 300)).toBe(false);
    expect(g.flap.length).toBeGreaterThanOrEqual(3);
  });
});

describe('optimizer vs agent priors (RQ2)', () => {
  const work = { x: 0, y: 30, w: 1440, h: 780 };
  const items: LayoutItem[] = [
    { id: 'draft', rect: { x: 250, y: 50, w: 780, h: 700 }, role: 'primary', fixed: true },
    { id: 'paper', rect: { x: 110, y: 70, w: 600, h: 700 }, role: 'reference', partner: 'draft' },
    { id: 'wiki', rect: { x: 860, y: 110, w: 540, h: 620 }, role: 'reference', partner: 'draft' },
  ];
  it('human-prior layout is less strange than the math-optimal one', () => {
    const math = metrics(items, solveLayout(items, work, { mode: 'math', seed: 3 }), work);
    const human = metrics(items, solveLayout(items, work, { mode: 'human', seed: 3 }), work);
    expect(human.strangeness).toBeLessThan(math.strangeness + 1e-9);
    expect(human.displacement).toBeLessThan(math.displacement + 1e-9);
  });
});

describe('rules', () => {
  it('glance-dock fires on a short A-B-A-B rhythm', () => {
    const rule = RULES.find((r) => r.id === 'glance-dock')!;
    const w = (id: string, role: 'primary' | 'reference', x: number, focused: boolean) => ({
      id, appId: id, title: id, role, rect: { x, y: 50, w: 700, h: 700 }, vis: { x, y: 50, w: 700, h: 700 }, depth: 0, form: 'normal' as const,
      focused, minimized: false, stackIndex: focused ? 1 : 0, visibleFraction: 1, importance: [], lastFocusedAt: 0, props: {},
    });
    const t = 100000;
    const obs: Observation = {
      t, screen: { w: 1440, h: 900 }, work: { x: 8, y: 36, w: 1424, h: 778 }, focusedId: 'draft',
      windows: [w('paper', 'reference', 100, false), w('draft', 'primary', 250, true)],
      focusHistory: [
        { id: 'draft', t: t - 30000 }, { id: 'paper', t: t - 26000 }, { id: 'draft', t: t - 23000 },
        { id: 'paper', t: t - 18000 }, { id: 'draft', t: t - 15000 }, { id: 'paper', t: t - 9000 }, { id: 'draft', t: t - 6000 },
      ],
      events: [], tech: BASELINE, scenarioId: 'glance',
    };
    const d = rule.run(obs, { rules: {}, scratch: {} });
    expect(d).not.toBeNull();
    expect(d!.changes.find((c) => c.windowId === 'paper')?.group).toBeTruthy();
  });
});
