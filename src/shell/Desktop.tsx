import { useEffect, useMemo } from 'react';
import { appState } from '../apps/state';
import { FieldLayer, type FieldShape } from '../field/FieldLayer';
import { useStore } from '../system/createStore';
import { computeVisuals, stackingOrder } from '../techniques/visuals';
import { ControlCenter, Dock, MenuBar, MissionControl, recencyList, Switcher, Toasts } from './Chrome';
import { agent, kernel, ui, undo, useKernelState } from './hooks';
import { ResearcherConsole, ScenarioPanel } from './Panels';
import { ProposalLayer } from './ProposalLayer';
import { Window } from './Window';

const editable = (el: EventTarget | null) => {
  const e = el as HTMLElement | null;
  return !!e && (e.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.tagName));
};

function useKeyboard() {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !editable(e.target) && ui.get().tech.depth) {
        e.preventDefault();
        if (!ui.get().xray) ui.set({ xray: true });
        return;
      }
      if (e.key === '`' && !editable(e.target)) {
        ui.set((s) => ({ consoleOpen: !s.consoleOpen }));
        return;
      }
      if (e.key === 'F3') {
        e.preventDefault();
        ui.set((s) => ({ missionControl: !s.missionControl }));
        return;
      }
      if (e.key === 'Escape') ui.set({ missionControl: false, controlCenter: false, consoleOpen: false });
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !editable(e.target)) {
        e.preventDefault();
        undo();
        return;
      }
      if (e.altKey && e.key === 'Tab') {
        e.preventDefault();
        const sw = ui.get().switcher;
        ui.set({ switcher: { open: true, index: sw.open ? sw.index + (e.shiftKey ? -1 : 1) : 1 } });
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space' && ui.get().xray) ui.set({ xray: false });
      if (e.key === 'Alt' && ui.get().switcher.open) {
        const list = recencyList(kernel.list());
        const i = ((ui.get().switcher.index % list.length) + list.length) % list.length;
        const w = list[i];
        if (w) kernel.apply([{ windowId: w.id, depth: 0, minimized: false, focus: true }], 'user', 'switcher');
        ui.set({ switcher: { open: false, index: 0 } });
      }
    };
    const blur = () => ui.set({ xray: false });
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    const resize = () => kernel.setScreen(window.innerWidth, window.innerHeight);
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      window.removeEventListener('resize', resize);
    };
  }, []);
}

export function Desktop() {
  useKeyboard();
  const state = useKernelState((s) => s);
  const tech = useStore(ui, (s) => s.tech);
  const activeId = useStore(ui, (s) => s.activeId);
  const xray = useStore(ui, (s) => s.xray);
  const snap = useStore(ui, (s) => s.snapPreview);
  const mention = useStore(appState, (s) => s.mentionAt !== null && !s.answered);

  useEffect(() => {
    agent.start();
    return () => agent.stop();
  }, []);

  const visuals = useMemo(() => computeVisuals({ state, tech, activeId }), [state, tech, activeId]);
  const order = useMemo(() => stackingOrder(state), [state]);

  const shapes = useMemo(() => {
    const groups = new Map<string, number>();
    const out: FieldShape[] = [];
    for (const id of order) {
      const w = state.windows[id];
      const v = visuals[id];
      const alert = mention && w.appId === 'meeting';
      let g = -1;
      if (tech.fusion && w.group) {
        if (!groups.has(w.group)) groups.set(w.group, groups.size % 8);
        g = groups.get(w.group)!;
      }
      if (g < 0 && !alert) continue;
      out.push({ rect: v.vis, radius: Math.min(v.radius * v.depthT.s, v.vis.w / 2, v.vis.h / 2), group: g, pulse: alert ? 1 : 0 });
    }
    return out;
  }, [order, state, visuals, tech.fusion, mention]);

  return (
    <div className={`desktop ${xray ? 'xray' : ''} ${tech.shape === 'squircle' ? 'fluid-mode' : ''}`}>
      <div className="wallpaper">
        <div className="blob b1" />
        <div className="blob b2" />
        <div className="blob b3" />
      </div>
      <FieldLayer shapes={shapes} />
      <div className="windows" onPointerDownCapture={() => !ui.get().scenarioCollapsed && ui.get().scenarioId && ui.set({ scenarioCollapsed: true })}>
        {order.map((id) => {
          const w = state.windows[id];
          return (
            <Window
              key={id}
              win={w}
              visual={visuals[id]}
              focused={state.focusedId === id}
              tech={tech}
              xray={xray}
              active={activeId === id || (!!activeId && !!w.group && state.windows[activeId]?.group === w.group)}
              alert={mention && w.appId === 'meeting'}
            />
          );
        })}
      </div>
      {snap && <div className="snap-preview" style={{ left: snap.x, top: snap.y, width: snap.w, height: snap.h }} />}
      {xray && <div className="xray-hint">X-ray — front layers are see-through · release Space</div>}
      <ProposalLayer />
      <ScenarioPanel />
      <MenuBar />
      <ControlCenter />
      <Dock />
      <Toasts />
      <MissionControl />
      <Switcher />
      <ResearcherConsole />
    </div>
  );
}
