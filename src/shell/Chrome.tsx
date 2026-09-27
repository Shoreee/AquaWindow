import { useEffect, useRef, useState } from 'react';
import { agentStore } from '../agent/controller';
import { APPS, appName } from '../apps/registry';
import { AppIcon } from '../apps/icons';
import { defaultImportance } from '../apps/importance';
import type { WindowState } from '../kernel/types';
import { loadScenario } from '../scenarios/director';
import { SCENARIOS, scenarioById } from '../scenarios/scenarios';
import { exportJsonl } from '../study/logger';
import { useStore } from '../system/createStore';
import { setCondition, setTech } from '../system/ui';
import { CONDITIONS, type Techniques } from '../techniques/techniques';
import { AutonomyDial } from './ProposalLayer';
import { agent, kernel, ui, undo, useKernelState, useWindows, workArea } from './hooks';

export function openApp(appId: string) {
  const def = APPS[appId];
  const existing = kernel
    .list()
    .filter((w) => w.appId === appId)
    .sort((a, b) => b.lastFocusedAt - a.lastFocusedAt)[0];
  if (existing) {
    if (existing.minimized) kernel.restore(existing.id);
    else if (existing.depth > 0.05) kernel.apply([{ windowId: existing.id, depth: 0, focus: true }], 'user', 'depth:pull');
    else kernel.focus(existing.id);
    return existing.id;
  }
  const W = workArea();
  const n = kernel.list().length;
  const w = Math.min(def.size.w, W.w);
  const h = Math.min(def.size.h, W.h);
  return kernel.open({
    appId,
    title: def.name,
    rect: { x: W.x + (W.w - w) / 2 + ((n * 26) % 180) - 90, y: W.y + (W.h - h) / 2 + ((n * 20) % 120) - 60, w, h },
    role: def.role,
    props: def.defaultProps,
    importance: defaultImportance(appId),
  });
}

// ── Menu bar ──────────────────────────────────────────────────────────────────
type MenuItem = { label: string; action?: () => void; checked?: boolean; sep?: boolean; hint?: string };

function Menu({ label, items, bold }: { label: React.ReactNode; items: MenuItem[]; bold?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);
  return (
    <div className="mb-menu" ref={ref}>
      <button className={`mb-item ${bold ? 'bold' : ''} ${open ? 'open' : ''}`} onClick={() => setOpen((o) => !o)}>
        {label}
      </button>
      {open && (
        <div className="mb-drop">
          {items.map((it, i) =>
            it.sep ? (
              <div key={i} className="mb-sep" />
            ) : (
              <button
                key={i}
                className="mb-row"
                onClick={() => {
                  it.action?.();
                  setOpen(false);
                }}
              >
                <span className="mb-check">{it.checked ? '✓' : ''}</span>
                {it.label}
                {it.hint && <span className="mb-hint">{it.hint}</span>}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(id);
  }, []);
  return <span className="mb-clock">{now.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>;
}

const TECH_TOGGLES: { key: keyof Techniques; label: string; on: Partial<Techniques>; off: Partial<Techniques> }[] = [
  { key: 'shape', label: 'Fluid squircle skin', on: { shape: 'squircle' }, off: { shape: 'rect' } },
  { key: 'yield', label: 'Yield by deforming', on: { yield: 'deform' }, off: { yield: 'none' } },
  { key: 'cutout', label: 'Importance cut-out (CHI ’11)', on: { cutout: true }, off: { cutout: false } },
  { key: 'peel', label: 'Peel back (UIST ’01)', on: { peel: true }, off: { peel: false } },
  { key: 'depth', label: 'Depth (⌥-scroll, Space x-ray)', on: { depth: true }, off: { depth: false } },
  { key: 'fusion', label: 'Fusion groups', on: { fusion: true }, off: { fusion: false } },
  { key: 'periphery', label: 'Peripheral capsules', on: { periphery: true }, off: { periphery: false } },
  { key: 'snap', label: 'Edge snapping', on: { snap: true }, off: { snap: false } },
  { key: 'semanticFiles', label: 'Semantic file lens', on: { semanticFiles: true }, off: { semanticFiles: false } },
  { key: 'provenance', label: 'File provenance', on: { provenance: true }, off: { provenance: false } },
  { key: 'ghostOverlay', label: 'Ghost overlay', on: { ghostOverlay: true }, off: { ghostOverlay: false } },
];

const isOn = (t: Techniques, k: keyof Techniques) => (k === 'shape' ? t.shape === 'squircle' : k === 'yield' ? t.yield === 'deform' : !!t[k]);

export function MenuBar() {
  const focusedId = useKernelState((s) => s.focusedId);
  const focusedApp = useKernelState((s) => (s.focusedId ? s.windows[s.focusedId]?.appId : null));
  const tech = useStore(ui, (s) => s.tech);
  const autonomy = useStore(ui, (s) => s.autonomy);
  const agentOn = useStore(ui, (s) => s.agentEnabled);
  const pending = useStore(agentStore, (s) => s.pending.length);
  const scenario = useStore(ui, (s) => scenarioById(s.scenarioId));
  const strategyId = useStore(ui, (s) => s.strategyId);

  return (
    <div className="menubar">
      <Menu
        label={<span className="mb-logo" />}
        items={[
          { label: 'About AquaWindow', action: () => openApp('guide') },
          { label: 'Layout Lab', action: () => openApp('lab') },
          { sep: true, label: '' },
          { label: 'Reset desktop', action: () => boot() },
        ]}
      />
      <Menu label={focusedApp ? appName(focusedApp) : 'Finder'} bold items={[{ label: `About ${focusedApp ? appName(focusedApp) : 'Finder'}` }, { label: 'Quit', action: () => focusedId && kernel.close(focusedId) }]} />
      <Menu
        label="Window"
        items={[
          { label: 'Minimize', hint: '⌘M', action: () => focusedId && kernel.minimize(focusedId) },
          { label: 'Zoom', action: () => focusedId && kernel.toggleMaximize(focusedId, workArea()) },
          { label: 'Tile left', action: () => focusedId && kernel.setRect(focusedId, { ...workArea(), w: workArea().w / 2 - 4 }) },
          { label: 'Tile right', action: () => focusedId && kernel.setRect(focusedId, { ...workArea(), x: workArea().x + workArea().w / 2 + 4, w: workArea().w / 2 - 4 }) },
          { sep: true, label: '' },
          { label: 'Bring all to the glass (depth 0)', action: () => kernel.apply(kernel.list().map((w) => ({ windowId: w.id, depth: 0, form: 'normal' as const })), 'user', 'depth:all') },
          { label: 'Mission Control', hint: 'F3', action: () => ui.set({ missionControl: true }) },
          { label: 'Undo layout change', hint: '⌘Z', action: () => undo() },
        ]}
      />
      <Menu label="Techniques" items={TECH_TOGGLES.map((t) => ({ label: t.label, checked: isOn(tech, t.key), action: () => setTech(isOn(tech, t.key) ? t.off : t.on) }))} />
      <Menu
        label="Scenario"
        items={SCENARIOS.flatMap((s) => [
          { label: `${s.n}. ${s.title}`, checked: scenario?.id === s.id, action: () => loadScenario(s.id) },
          ...s.strategies.map((st) => ({ label: `     ${st.id} · ${st.label}`, checked: scenario?.id === s.id && strategyId === st.id, action: () => loadScenario(s.id, st.id) })),
        ])}
      />
      <Menu
        label="Study"
        items={[
          { label: 'Researcher console', hint: '`', action: () => ui.set({ consoleOpen: true }) },
          { label: 'Scenario card', checked: ui.get().scenarioPanel, action: () => ui.set((s) => ({ scenarioPanel: !s.scenarioPanel })) },
          { label: 'Export log (JSONL)', action: exportJsonl },
          { sep: true, label: '' },
          ...CONDITIONS.map((c) => ({ label: `Condition: ${c.label}`, checked: ui.get().condition === c.id, action: () => setCondition(c.id) })),
        ]}
      />
      <div className="mb-spacer" />
      {scenario && (
        <span className="mb-scn">
          S{scenario.n}·{strategyId}
        </span>
      )}
      <button className={`mb-agent ${agentOn && autonomy !== 'off' ? 'on' : ''} ${pending ? 'pending' : ''}`} onClick={() => ui.set((s) => ({ controlCenter: !s.controlCenter }))} title="Agent autonomy">
        <span className="drop-dot" />
        {agentOn ? (autonomy === 'auto' ? 'Auto+Undo' : autonomy[0].toUpperCase() + autonomy.slice(1)) : 'Agent off'}
        {pending > 0 && <b>{pending}</b>}
      </button>
      <button className="mb-cc" onClick={() => ui.set((s) => ({ controlCenter: !s.controlCenter }))} title="Control Center">
        ◉
      </button>
      <Clock />
    </div>
  );
}

// ── Control Center ────────────────────────────────────────────────────────────
export function ControlCenter() {
  const open = useStore(ui, (s) => s.controlCenter);
  const tech = useStore(ui, (s) => s.tech);
  const cond = useStore(ui, (s) => s.condition);
  const agentOn = useStore(ui, (s) => s.agentEnabled);
  const policy = useStore(agentStore, (s) => s.policyId);
  if (!open) return null;
  return (
    <div className="cc" onPointerDown={(e) => e.stopPropagation()}>
      <div className="cc-sec">
        <div className="cc-h">Layout agent</div>
        <label className="cc-switch">
          <input type="checkbox" checked={agentOn} onChange={(e) => ui.set({ agentEnabled: e.target.checked })} />
          Agent enabled
          <select value={policy} onChange={(e) => agentStore.set({ policyId: e.target.value as 'rules' })}>
            <option value="rules">Rules</option>
            <option value="hybrid" disabled={!agent.llm.available}>
              Rules + LLM
            </option>
            <option value="llm" disabled={!agent.llm.available}>
              LLM / VLM
            </option>
          </select>
        </label>
        <AutonomyDial />
      </div>
      <div className="cc-sec">
        <div className="cc-h">Condition preset</div>
        <div className="seg">
          {CONDITIONS.map((c) => (
            <button key={c.id} className={cond === c.id ? 'on' : ''} onClick={() => setCondition(c.id)} title={c.description}>
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <div className="cc-sec">
        <div className="cc-h">Techniques</div>
        <div className="cc-grid">
          {TECH_TOGGLES.map((t) => (
            <button key={t.key} className={`cc-tile ${isOn(tech, t.key) ? 'on' : ''}`} onClick={() => setTech(isOn(tech, t.key) ? t.off : t.on)}>
              {t.label}
            </button>
          ))}
          <button className={`cc-tile ${tech.yield === 'scale' ? 'on' : ''}`} onClick={() => setTech({ yield: tech.yield === 'scale' ? 'none' : 'scale' })}>
            Yield by scaling (RQ1 control)
          </button>
          <div className="cc-tile sel">
            Wiki links
            <select value={tech.wikiTrail} onChange={(e) => setTech({ wikiTrail: e.target.value as Techniques['wikiTrail'] })}>
              <option value="tabs">tabs</option>
              <option value="windows">windows</option>
              <option value="depth">depth trail</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Dock ──────────────────────────────────────────────────────────────────────
export function Dock() {
  const wins = useWindows();
  const [mx, setMx] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const apps = Object.values(APPS).filter((a) => a.dock);
  const minimized = wins.filter((w) => w.minimized);
  const scaleFor = (el: HTMLElement | null) => {
    if (mx === null || !el) return 1;
    const r = el.getBoundingClientRect();
    const d = Math.abs(mx - (r.left + r.width / 2));
    return 1 + Math.max(0, 1 - d / 150) * 0.55;
  };
  return (
    <div className="dock-wrap">
      <div className="dock" ref={ref} onMouseMove={(e) => setMx(e.clientX)} onMouseLeave={() => setMx(null)}>
        {apps.map((a) => (
          <DockIcon key={a.id} label={a.name} running={wins.some((w) => w.appId === a.id)} scaleFor={scaleFor} onClick={() => openApp(a.id)}>
            <AppIcon appId={a.id} size={48} />
          </DockIcon>
        ))}
        {minimized.length > 0 && <div className="dock-sep" />}
        {minimized.map((w) => (
          <DockIcon key={w.id} label={w.title} running={false} scaleFor={scaleFor} onClick={() => kernel.restore(w.id)}>
            <div className="dock-min">
              <AppIcon appId={w.appId} size={26} />
              <span>{w.title.slice(0, 10)}</span>
            </div>
          </DockIcon>
        ))}
        <div className="dock-sep" />
        <DockIcon label="Mission Control (F3)" running={false} scaleFor={scaleFor} onClick={() => ui.set({ missionControl: true })}>
          <div className="dock-mc">
            <i />
            <i />
            <i />
            <i />
          </div>
        </DockIcon>
      </div>
    </div>
  );
}

function DockIcon({ children, label, running, onClick, scaleFor }: { children: React.ReactNode; label: string; running: boolean; onClick: () => void; scaleFor: (el: HTMLElement | null) => number }) {
  const ref = useRef<HTMLButtonElement>(null);
  const s = scaleFor(ref.current);
  return (
    <button ref={ref} className="dock-i" onClick={onClick} style={{ width: 52 * s, height: 52 * s }}>
      <span className="dock-tip">{label}</span>
      <span className="dock-img" style={{ transform: `scale(${s})` }}>
        {children}
      </span>
      {running && <span className="dock-dot" />}
    </button>
  );
}

// ── Mission Control / switcher / toasts ──────────────────────────────────────
export function MissionControl() {
  const open = useStore(ui, (s) => s.missionControl);
  const wins = useWindows();
  if (!open) return null;
  const W = workArea();
  const n = wins.length;
  const cols = Math.ceil(Math.sqrt(n * 1.4));
  const rows = Math.ceil(n / cols);
  const cw = W.w / cols;
  const ch = (W.h - 40) / Math.max(1, rows);
  return (
    <div className="mc-overlay" onClick={() => ui.set({ missionControl: false })}>
      {wins.map((w, i) => {
        const s = Math.min((cw - 40) / w.rect.w, (ch - 50) / w.rect.h, 0.6);
        const x = W.x + (i % cols) * cw + (cw - w.rect.w * s) / 2;
        const y = W.y + 40 + Math.floor(i / cols) * ch + (ch - w.rect.h * s) / 2;
        return (
          <button
            key={w.id}
            className={`mc-card ${w.minimized ? 'min' : ''}`}
            style={{ left: x, top: y, width: w.rect.w * s, height: w.rect.h * s }}
            onClick={(e) => {
              e.stopPropagation();
              kernel.apply([{ windowId: w.id, depth: 0, minimized: false, focus: true }], 'user', 'mission-control');
              ui.set({ missionControl: false });
            }}
          >
            <AppIcon appId={w.appId} size={Math.max(24, 60 * s)} />
            <span>{w.title}</span>
            {w.depth > 0.05 && <em>depth {w.depth.toFixed(2)}</em>}
          </button>
        );
      })}
    </div>
  );
}

export function Switcher() {
  const sw = useStore(ui, (s) => s.switcher);
  const wins = useWindows();
  if (!sw.open) return null;
  const list = recencyList(wins);
  return (
    <div className="switcher">
      {list.map((w, i) => (
        <div key={w.id} className={`sw-i ${i === sw.index % list.length ? 'on' : ''}`}>
          <AppIcon appId={w.appId} size={56} />
          <span>{w.title}</span>
        </div>
      ))}
    </div>
  );
}

export const recencyList = (wins: WindowState[]) => [...wins].sort((a, b) => b.lastFocusedAt - a.lastFocusedAt);

export function Toasts() {
  const toasts = useStore(ui, (s) => s.toasts);
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          {t.text}
          {t.undo && (
            <button
              onClick={() => {
                undo();
                ui.set((s) => ({ toasts: s.toasts.filter((x) => x.id !== t.id) }));
              }}
            >
              Undo
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ── boot ──────────────────────────────────────────────────────────────────────
export function boot() {
  kernel.closeAll();
  ui.set({ scenarioId: null, strategyId: null });
  const id = openApp('guide');
  const W = workArea();
  kernel.setRect(id, { x: W.x + (W.w - 780) / 2, y: W.y + 20, w: 780, h: Math.min(640, W.h - 40) }, 'system');
  agent.start();
}
