import { describe, expect, it } from 'vitest';
import { WindowStore } from '@aquawindow/wm-kernel';
import { AgentBridge } from './bridge.js';
import { RevealOccludedPolicy } from './policies/rules.js';

describe('AgentBridge', () => {
  it('never writes to the store until a proposal is accepted', () => {
    const store = new WindowStore({ bounds: { x: 0, y: 0, width: 1200, height: 800 } });
    store.dispatch({
      type: 'open',
      window: { id: 'a', appId: 'finder', title: 'A', rect: { x: 0, y: 0, width: 400, height: 300 } },
    });
    store.dispatch({
      type: 'open',
      window: { id: 'b', appId: 'finder', title: 'B', rect: { x: 0, y: 0, width: 400, height: 300 } },
    });
    const bridge = new AgentBridge({ store, policy: new RevealOccludedPolicy() });
    bridge.setCondition('fluid-agent');
    bridge.setAutonomy('preview');
    const proposal = bridge.considerNow();
    expect(proposal).not.toBeNull();
    expect(store.getWindow('b')!.rect.x).toBe(0);
    bridge.accept(proposal!);
    expect(store.getWindow('b')!.rect.x).toBeGreaterThan(0);
  });

  it('respects ice (pinned) windows in reveal policy', () => {
    const store = new WindowStore({ bounds: { x: 0, y: 0, width: 1200, height: 800 } });
    store.dispatch({
      type: 'open',
      window: { id: 'a', appId: 'finder', title: 'A', rect: { x: 0, y: 0, width: 400, height: 300 } },
    });
    store.dispatch({
      type: 'open',
      window: { id: 'b', appId: 'finder', title: 'B', rect: { x: 0, y: 0, width: 400, height: 300 }, pinned: true },
    });
    const bridge = new AgentBridge({ store, policy: new RevealOccludedPolicy() });
    bridge.setCondition('fluid-agent');
    expect(bridge.considerNow()).toBeNull();
  });
});
