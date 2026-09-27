import { useState } from 'react';
import type { WindowState } from '../kernel/types';
import { metrics, solveLayout, type LayoutItem, type LayoutMetrics } from '../agent/optimizer';
import { regionToScreen } from '../kernel/geometry';
import type { Rect } from '../kernel/types';
import { agent, kernel, workArea } from '../system';

const EXCLUDE = new Set(['lab', 'guide']);
const ROLE_COLOR: Record<string, string> = { primary: '#3a7bff', reference: '#2bb3a0', awareness: '#8a4dff', tool: '#ff8a3d', scratch: '#999', system: '#999' };

interface Result {
  items: LayoutItem[];
  titles: string[];
  roles: string[];
  cur: Rect[];
  math: Rect[];
  human: Rect[];
  m: { cur: LayoutMetrics; math: LayoutMetrics; human: LayoutMetrics };
}

function run(): Result | null {
  const s = kernel.getState();
  const wins = s.order.map((id) => s.windows[id]).filter((w) => w && !w.minimized && w.form === 'normal' && w.depth < 0.05 && !EXCLUDE.has(w.appId));
  if (wins.length < 2) return null;
  const lastUsed = [...wins].sort((a, b) => b.lastFocusedAt - a.lastFocusedAt)[0];
  const primary = wins.find((w) => w.role === 'primary') ?? lastUsed;
  const items: LayoutItem[] = wins.map((w) => ({
    id: w.id,
    rect: w.rect,
    role: w.role,
    important: w.importance.filter((r) => r.weight >= 0.8).map((r) => regionToScreen(w.rect, r)),
    fixed: w.id === lastUsed.id,
    partner: w.role === 'reference' ? primary.id : undefined,
  }));
  const W = workArea();
  const math = solveLayout(items, W, { mode: 'math', seed: 3 });
  const human = solveLayout(items, W, { mode: 'human', seed: 3 });
  return {
    items,
    titles: wins.map((w) => w.title),
    roles: wins.map((w) => w.role),
    cur: items.map((i) => i.rect),
    math,
    human,
    m: { cur: metrics(items, items.map((i) => i.rect), W), math: metrics(items, math, W), human: metrics(items, human, W) },
  };
}

function Mini({ rects, roles, titles, label }: { rects: Rect[]; roles: string[]; titles: string[]; label: string }) {
  const W = workArea();
  return (
    <div className="lab-mini">
      <div className="lab-mini-l">{label}</div>
      <svg viewBox={`${W.x} ${W.y} ${W.w} ${W.h}`} preserveAspectRatio="xMidYMid meet">
        <rect x={W.x} y={W.y} width={W.w} height={W.h} fill="#0b1020" opacity=".06" rx="18" />
        {rects.map((r, i) => (
          <g key={i}>
            <rect x={r.x} y={r.y} width={r.w} height={r.h} rx="16" fill={ROLE_COLOR[roles[i]] ?? '#888'} fillOpacity=".22" stroke={ROLE_COLOR[roles[i]] ?? '#888'} strokeWidth="4" />
            <text x={r.x + 14} y={r.y + 36} fontSize="26" fill="#223" opacity=".8">
              {titles[i].slice(0, 16)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

const ROWS: [keyof LayoutMetrics, string, (v: number) => string, 'lo' | 'hi'][] = [
  ['overlap', 'Overlap', (v) => `${Math.round(v * 100)}%`, 'lo'],
  ['coverage', 'Screen used', (v) => `${Math.round(v * 100)}%`, 'hi'],
  ['importantHidden', 'Important hidden', (v) => `${Math.round(v * 100)}%`, 'lo'],
  ['displacement', 'Mean displacement', (v) => `${Math.round(v)} px`, 'lo'],
  ['aspect', 'Aspect distortion', (v) => v.toFixed(2), 'lo'],
  ['orderViolations', 'Order swaps', (v) => String(v), 'lo'],
  ['minSide', 'Smallest side', (v) => `${Math.round(v)} px`, 'hi'],
  ['strangeness', 'Strangeness', (v) => v.toFixed(2), 'lo'],
];

export default function LayoutLab(_: { win: WindowState }) {
  const [res, setRes] = useState<Result | null>(null);
  const propose = (which: 'math' | 'human') => {
    if (!res) return;
    agent.consider(
      {
        ruleId: `lab-${which}`,
        title: which === 'math' ? 'Mathematically optimal layout' : 'Agent layout (optimiser + human priors)',
        rationale:
          which === 'math'
            ? 'Minimises overlap and maximises screen use — nothing else. Notice where windows travel and what shapes they take.'
            : 'Same solver, plus priors: keep what you just used fixed, keep windows near where you put them, keep aspect ratios and left/right order, keep references next to what they support, never cover important regions.',
        evidence: [
          `strangeness ${res.m[which].strangeness.toFixed(2)}`,
          `overlap ${Math.round(res.m[which].overlap * 100)}%`,
          `displacement ${Math.round(res.m[which].displacement)} px`,
        ],
        confidence: which === 'math' ? 0.5 : 0.8,
        technique: which === 'math' ? 'optimiser' : 'optimiser + priors',
        changes: res.items.map((it, i) => ({ windowId: it.id, rect: res[which][i] })),
        labels: Object.fromEntries(res.items.map((it, i) => [it.id, res.titles[i]])),
      },
      'user-request',
    );
  };
  return (
    <div className="lab">
      <div className="lab-head">
        <div>
          <b>Layout Lab</b> — why “optimal” is not “acceptable” (RQ2)
        </div>
        <button className="btn primary" onClick={() => setRes(run())}>
          Analyse current desktop
        </button>
      </div>
      {!res && <div className="empty">Arrange a few windows, then analyse. The lab solves the same layout twice: a pure multi-objective optimiser and the agent's prior-regularised version.</div>}
      {res && (
        <>
          <div className="lab-minis">
            <Mini rects={res.cur} roles={res.roles} titles={res.titles} label="Now" />
            <Mini rects={res.math} roles={res.roles} titles={res.titles} label="Math-optimal" />
            <Mini rects={res.human} roles={res.roles} titles={res.titles} label="Agent (human priors)" />
          </div>
          <table className="lab-table">
            <thead>
              <tr>
                <th />
                <th>Now</th>
                <th>Math-optimal</th>
                <th>Agent</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([k, label, f, better]) => {
                const vals = [res.m.cur[k], res.m.math[k], res.m.human[k]];
                const best = better === 'lo' ? Math.min(vals[1], vals[2]) : Math.max(vals[1], vals[2]);
                return (
                  <tr key={k}>
                    <td>{label}</td>
                    {vals.map((v, i) => (
                      <td key={i} className={i > 0 && v === best ? 'best' : ''}>
                        {f(v)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="lab-actions">
            <button className="btn" onClick={() => propose('math')}>Preview math-optimal on desktop</button>
            <button className="btn primary" onClick={() => propose('human')}>Preview agent layout</button>
          </div>
          <p className="lab-note">
            Strangeness = displacement + aspect change + order swaps + slivers. It is the cost a person pays to re-find their windows — invisible to an optimiser that only sees geometry, visible to an agent that
            knows which window is the draft and which is the reference.
          </p>
        </>
      )}
    </div>
  );
}
