import { regionToScreen, visibleFraction } from '../kernel/geometry';
import type { KernelState, Rect } from '../kernel/types';
import type { BusEvent } from '../system/bus';
import { visualRect } from '../techniques/depth';
import type { Techniques } from '../techniques/techniques';
import { layoutRect, stackingOrder } from '../techniques/visuals';
import type { Observation, WindowSummary } from './types';

export function observe(
  state: KernelState,
  work: Rect,
  focusHistory: { id: string; t: number }[],
  events: BusEvent[],
  tech: Techniques,
  scenarioId: string | null,
  now: number,
): Observation {
  const order = stackingOrder(state);
  const vis = new Map(order.map((id) => {
    const w = state.windows[id];
    return [id, visualRect({ rect: layoutRect(w, state.screen), depth: w.depth }, state.screen)];
  }));
  const windows: WindowSummary[] = state.order
    .map((id) => state.windows[id])
    .filter(Boolean)
    .map((w) => {
      const si = order.indexOf(w.id);
      const v = vis.get(w.id) ?? w.rect;
      const above = si < 0 ? [] : order.slice(si + 1).map((o) => vis.get(o)!);
      return {
        id: w.id,
        appId: w.appId,
        title: w.title,
        role: w.role,
        rect: w.rect,
        vis: v,
        depth: w.depth,
        form: w.form,
        group: w.group,
        focused: state.focusedId === w.id,
        minimized: w.minimized,
        stackIndex: si,
        visibleFraction: w.minimized ? 0 : visibleFraction(v, above),
        importance: w.importance.map((r) => {
          const rr = regionToScreen(v, r);
          return { id: r.id, label: r.label, weight: r.weight, rect: rr, visibleFraction: w.minimized ? 0 : visibleFraction(rr, above, 8) };
        }),
        lastFocusedAt: w.lastFocusedAt,
        openedFrom: w.openedFrom,
        props: w.props,
      };
    });
  return { t: now, screen: state.screen, work, focusedId: state.focusedId, windows, focusHistory, events, tech, scenarioId };
}

/** Compact, token-cheap serialisation for an LLM/VLM policy. */
export function observationToPrompt(obs: Observation) {
  const r = (x: Rect) => [Math.round(x.x), Math.round(x.y), Math.round(x.w), Math.round(x.h)];
  return {
    screen: [obs.screen.w, obs.screen.h],
    work: r(obs.work),
    focused: obs.focusedId,
    windows: obs.windows
      .filter((w) => !w.minimized)
      .map((w) => ({
        id: w.id,
        app: w.appId,
        title: w.title,
        role: w.role,
        rect: r(w.rect),
        depth: +w.depth.toFixed(2),
        form: w.form,
        group: w.group,
        visible: +w.visibleFraction.toFixed(2),
        important: w.importance.map((i) => ({ label: i.label, w: i.weight, visible: +i.visibleFraction.toFixed(2) })),
      })),
    recentFocus: obs.focusHistory.slice(-12).map((f) => [f.id, Math.round((obs.t - f.t) / 1000)]),
    recentEvents: obs.events.slice(-10).map((e) => ({ type: e.type, ago: Math.round((obs.t - e.t) / 1000), ...e.data })),
  };
}
