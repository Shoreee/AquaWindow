import { describe, expect, it } from 'vitest';
import { WindowStore } from './store.js';
import { computeOcclusion, isFullyOccluded } from './occlusion.js';
import { area, intersectionArea } from './geometry.js';

function store() {
  return new WindowStore({
    bounds: { x: 0, y: 0, width: 1200, height: 800 },
  });
}

describe('WindowStore', () => {
  it('opens, focuses and raises windows', () => {
    const s = store();
    s.dispatch({ type: 'open', window: { id: 'a', appId: 'finder', title: 'A', rect: { x: 10, y: 10, width: 300, height: 200 } } });
    s.dispatch({ type: 'open', window: { id: 'b', appId: 'finder', title: 'B', rect: { x: 40, y: 40, width: 300, height: 200 } } });
    expect(s.getFocusId()).toBe('b');
    expect(s.getWindow('b')!.z).toBeGreaterThan(s.getWindow('a')!.z);
    s.dispatch({ type: 'focus', id: 'a' });
    expect(s.getFocusId()).toBe('a');
    expect(s.getWindow('a')!.z).toBeGreaterThan(s.getWindow('b')!.z);
  });

  it('moves, resizes and respects min size', () => {
    const s = store();
    s.dispatch({
      type: 'open',
      window: {
        id: 'a',
        appId: 'finder',
        title: 'A',
        rect: { x: 10, y: 10, width: 400, height: 300 },
        minSize: { width: 280, height: 180 },
      },
    });
    s.dispatch({ type: 'move', id: 'a', x: 80, y: 90 });
    expect(s.getWindow('a')!.rect.x).toBe(80);
    s.dispatch({ type: 'resize', id: 'a', rect: { x: 80, y: 90, width: 40, height: 40 } });
    expect(s.getWindow('a')!.rect.width).toBe(280);
    expect(s.getWindow('a')!.rect.height).toBe(180);
  });

  it('minimizes, restores and maximizes', () => {
    const s = store();
    s.dispatch({
      type: 'open',
      window: { id: 'a', appId: 'finder', title: 'A', rect: { x: 20, y: 30, width: 400, height: 300 } },
    });
    s.dispatch({ type: 'minimize', id: 'a' });
    expect(s.getWindow('a')!.status).toBe('minimized');
    s.dispatch({ type: 'restore', id: 'a' });
    expect(s.getWindow('a')!.status).toBe('normal');
    expect(s.getWindow('a')!.rect.x).toBe(20);
    s.dispatch({ type: 'maximize', id: 'a' });
    expect(s.getWindow('a')!.status).toBe('maximized');
    expect(s.getWindow('a')!.rect.width).toBe(1200);
    s.dispatch({ type: 'restore', id: 'a' });
    expect(s.getWindow('a')!.rect.width).toBe(400);
  });

  it('fuses, moves as a group, then splits', () => {
    const s = store();
    s.dispatch({ type: 'open', window: { id: 'a', appId: 'finder', title: 'A', rect: { x: 10, y: 10, width: 300, height: 200 } } });
    s.dispatch({ type: 'open', window: { id: 'b', appId: 'notes', title: 'B', rect: { x: 200, y: 10, width: 300, height: 200 } } });
    s.dispatch({ type: 'fuse', ids: ['a', 'b'] });
    expect(s.getWindow('a')!.groupId).toBe(s.getWindow('b')!.groupId);
    s.dispatch({ type: 'move', id: 'a', x: 50, y: 40 });
    expect(s.getWindow('a')!.rect.x).toBe(50);
    expect(s.getWindow('b')!.rect.x).toBe(240);
    s.dispatch({ type: 'split', id: 'b' });
    expect(s.getWindow('b')!.groupId).toBeNull();
  });

  it('pins and sets depth', () => {
    const s = store();
    s.dispatch({ type: 'open', window: { id: 'a', appId: 'finder', title: 'A' } });
    s.dispatch({ type: 'pin', id: 'a', pinned: true });
    expect(s.getWindow('a')!.pinned).toBe(true);
    s.dispatch({ type: 'setDepth', id: 'a', depth: 2 });
    expect(s.getWindow('a')!.depth).toBe(2);
  });

  it('undoes and redoes a move', () => {
    const s = store();
    s.dispatch({
      type: 'open',
      window: { id: 'a', appId: 'finder', title: 'A', rect: { x: 10, y: 10, width: 300, height: 200 } },
    });
    s.dispatch({ type: 'move', id: 'a', x: 100, y: 120 });
    expect(s.getWindow('a')!.rect.x).toBe(100);
    s.undo();
    expect(s.getWindow('a')!.rect.x).toBe(10);
    s.redo();
    expect(s.getWindow('a')!.rect.x).toBe(100);
  });

  it('closes and undoes close', () => {
    const s = store();
    s.dispatch({ type: 'open', window: { id: 'a', appId: 'finder', title: 'A' } });
    s.dispatch({ type: 'close', id: 'a' });
    expect(s.getWindow('a')).toBeUndefined();
    s.undo();
    expect(s.getWindow('a')?.title).toBe('A');
  });

  it('computes occlusion', () => {
    const s = store();
    s.dispatch({
      type: 'open',
      window: { id: 'a', appId: 'finder', title: 'A', rect: { x: 0, y: 0, width: 200, height: 200 } },
    });
    s.dispatch({
      type: 'open',
      window: { id: 'b', appId: 'finder', title: 'B', rect: { x: 0, y: 0, width: 200, height: 200 } },
    });
    const occ = computeOcclusion(s.getWindows());
    const a = occ.find((o) => o.id === 'a')!;
    expect(isFullyOccluded(a)).toBe(true);
    expect(a.occludedBy).toContain('b');
    expect(intersectionArea({ x: 0, y: 0, width: 200, height: 200 }, { x: 0, y: 0, width: 200, height: 200 })).toBe(
      area({ x: 0, y: 0, width: 200, height: 200 }),
    );
  });
});
