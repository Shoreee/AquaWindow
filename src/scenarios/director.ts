import { AGENT_FILES } from '../apps/data/fs';
import { CHAT_SCRIPT, PEOPLE, SCRIPT } from '../apps/data/meeting';
import { STEPS } from '../apps/data/tutorial';
import { AGENT_LOG, LOG_INTERVAL } from '../apps/Terminal';
import { appState, clock, resetAppState, scenarioSeconds } from '../apps/state';
import { RULES } from '../agent/rules';
import type { LayoutChange, Rect } from '../kernel/types';
import { log } from '../study/logger';
import { agent, bus, kernel, ui, workArea } from '../system';
import { toast } from '../system/ui';
import { BASELINE } from '../techniques/techniques';
import { scenarioById } from './scenarios';

let timers: number[] = [];
let unsubs: (() => void)[] = [];

function cleanup() {
  timers.forEach((t) => clearTimeout(t));
  timers = [];
  unsubs.forEach((u) => u());
  unsubs = [];
}

const at = (sec: number, fn: () => void) => timers.push(window.setTimeout(fn, sec * 1000));

export function scaleRect(r: Rect): Rect {
  const { w, h } = kernel.getState().screen;
  const sx = w / 1440;
  const sy = h / 900;
  const W = workArea();
  const out = { x: Math.round(r.x * sx), y: Math.round(r.y * sy), w: Math.round(r.w * Math.min(sx, 1.25)), h: Math.round(r.h * Math.min(sy, 1.25)) };
  out.w = Math.min(out.w, W.w);
  out.h = Math.min(out.h, W.h);
  out.x = Math.max(W.x, Math.min(out.x, W.x + W.w - out.w));
  out.y = Math.max(W.y, Math.min(out.y, W.y + W.h - out.h));
  return out;
}

export function loadScenario(id: string, strategyId?: string) {
  const sc = scenarioById(id);
  if (!sc) return;
  const st = sc.strategies.find((s) => s.id === strategyId) ?? sc.strategies[0];
  cleanup();
  kernel.closeAll();
  bus.clear();
  agent.reset();
  resetAppState();
  clock.set({ startedAt: performance.now(), paused: false });

  const tech = { ...BASELINE, ...st.tech };
  ui.set({
    scenarioId: sc.id,
    strategyId: st.id,
    tech,
    agentEnabled: st.agent,
    autonomy: st.agent ? (st.autonomy ?? 'preview') : ui.get().autonomy === 'off' ? 'off' : ui.get().autonomy,
    condition: st.agent ? 'fluid-agent' : tech.shape === 'squircle' ? 'fluid' : tech.snap ? 'tiling' : 'baseline',
    taskStartedAt: performance.now(),
    xray: false,
    missionControl: false,
    scenarioCollapsed: false,
  });
  agent.rules.enabled = new Set(st.rules ?? RULES.map((r) => r.id));

  const ids: Record<string, string> = {};
  for (const w of [...sc.windows, ...(st.extraWindows ?? [])]) {
    const { key, ...spec } = w;
    ids[key] = kernel.open({ ...spec, rect: scaleRect(spec.rect), focus: false }, 'scenario');
  }

  const changes: LayoutChange[] = [];
  if (st.setup?.includes('fuse-presenter') && ids.share && ids.tile) {
    const s = kernel.get(ids.share)!.rect;
    changes.push({ windowId: ids.share, group: 'presenter' });
    changes.push({ windowId: ids.tile, group: 'presenter', rect: { x: s.x + s.w - 200, y: s.y + s.h - 40, w: 220, h: 160 }, raise: true });
  }
  if (st.setup?.includes('fuse-refs')) {
    kernel.list().filter((w) => w.appId === 'refimage').forEach((w) => changes.push({ windowId: w.id, group: `refs-${String(w.props.tag)}` }));
  }
  if (st.setup?.includes('refs-depth')) {
    kernel.list().filter((w) => w.appId === 'refimage').forEach((w, i) => changes.push({ windowId: w.id, depth: 0.45 + (i % 3) * 0.1 }));
  }
  if (changes.length) kernel.apply(changes, 'scenario', 'setup');
  if (ids[sc.focusKey]) kernel.focus(ids[sc.focusKey], 'scenario');

  runScript(sc.id, ids);
  log({ src: 'study', type: 'scenario.start', data: { scenario: sc.id, strategy: st.id, tech } });
  agent.start();
}

function goal(text: string, data: Record<string, unknown> = {}) {
  const started = ui.get().taskStartedAt ?? performance.now();
  const secs = +((performance.now() - started) / 1000).toFixed(1);
  log({ src: 'study', type: 'goal', data: { text, secs, ...data } });
  toast(`✓ ${text} · ${secs}s`);
}

function runScript(id: string, ids: Record<string, string>) {
  if (id === 'files') {
    AGENT_LOG.forEach((line, i) =>
      at(1.5 + i * LOG_INTERVAL, () => {
        appState.set({ logLine: i + 1 });
        if (line.file !== undefined) {
          const f = AGENT_FILES[line.file];
          appState.set((s) => ({ agentFilesCreated: Math.max(s.agentFilesCreated, line.file! + 1) }));
          bus.emit({ type: 'agentlog.created', windowId: ids.term, data: { name: f.name, dir: f.dir.replace('Projects/aqua-agent', '.'), line: i } });
        }
      }),
    );
    const reached = new Set<string>();
    unsubs.push(
      bus.on((e) => {
        if (e.type !== 'files.open') return;
        if (e.data?.paperId === '2403.11872' && !reached.has('paper')) {
          reached.add('paper');
          goal('Found the foveated-compositing paper');
        }
        if (e.data?.name === 'utils_v2_final.py' && !reached.has('code')) {
          reached.add('code');
          goal('Found parse_date()');
        }
      }),
    );
  }

  if (id === 'meeting') {
    SCRIPT.forEach((s) =>
      at(s.t, () => {
        bus.emit({ type: 'meeting.speaker', windowId: ids.meet, data: { who: s.speaker } });
        if (s.slide !== undefined) bus.emit({ type: 'meeting.slide', windowId: ids.share, data: { slide: s.slide } });
        if (s.mention) {
          appState.set({ mentionAt: scenarioSeconds() });
          const who = PEOPLE.find((p) => p.id === s.speaker)?.name ?? s.speaker;
          bus.emit({ type: 'meeting.mention', windowId: ids.meet, data: { who, text: s.text } });
        }
      }),
    );
    CHAT_SCRIPT.forEach((c) =>
      at(c.t, () => {
        appState.set((s) => ({ chat: [...s.chat, { from: c.from, text: c.text, t: Date.now() }] }));
        bus.emit({ type: 'chat.message', windowId: ids.chat, data: { from: c.from } });
        toast(`💬 ${c.from}: ${c.text}`);
      }),
    );
    unsubs.push(bus.on((e) => e.type === 'task.done' && e.data?.task === 'answer-mention' && goal('Answered Omar', { latency: e.data?.latency })));
  }

  if (id === 'tutorial') {
    const setTarget = (i: number) => {
      const st = STEPS[i];
      if (!ids.app || !st) return;
      kernel.setImportance(ids.app, [
        { id: 'target', label: 'target', x: st.target.x, y: st.target.y, w: st.target.w, h: st.target.h, weight: 1 },
        { id: 'canvas', label: 'canvas', x: 0.08, y: 0.02, w: 0.66, h: 0.96, weight: 0.5 },
      ]);
      kernel.setProps(ids.app, { targetName: st.target.name });
    };
    setTarget(0);
    unsubs.push(
      bus.on((e) => {
        if (e.type === 'tutorial.step') setTarget(Number(e.data?.index ?? 0));
        if (e.type === 'task.done' && e.data?.task === 'tutorial') goal('Exported the icon');
      }),
    );
  }

  if (id === 'glance') {
    unsubs.push(bus.on((e) => e.type === 'task.done' && e.data?.task === 'cite-numbers' && goal('Cited Table 2')));
    let pages = 0;
    unsubs.push(bus.on((e) => e.type === 'wiki.navigate' && ++pages === 5 && goal('Explored 5 wiki pages')));
  }

  if (id === 'design') {
    unsubs.push(bus.on((e) => e.type === 'design.stroke' && appState.get().strokes === 20 && goal('20 strokes')));
  }
}

export function stopScenario() {
  cleanup();
}
