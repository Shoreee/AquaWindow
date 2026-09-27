import { useEffect, useState } from 'react';
import { agentStore } from '../agent/controller';
import type { LayoutProposal } from '../agent/types';
import { center } from '../kernel/geometry';
import type { Rect } from '../kernel/types';
import { useStore } from '../system/createStore';
import { agent, kernel, ui, useKernelState } from './hooks';
import { visualRect } from '../techniques/depth';
import { capsuleRectFor } from '../techniques/visuals';
import { AUTONOMY_LEVELS } from '../techniques/techniques';

function targetRect(p: LayoutProposal, id: string): { from: Rect; to: Rect } | null {
  const st = kernel.getState();
  const w = st.windows[id];
  const c = p.changes.find((x) => x.windowId === id);
  if (!w || !c) return null;
  const screen = st.screen;
  const fromBase = w.form === 'capsule' ? capsuleRectFor(w, screen) : w.rect;
  const form = c.form ?? w.form;
  const toBase = form === 'capsule' ? (c.capsuleRect ?? capsuleRectFor(w, screen)) : (c.rect ?? w.rect);
  const from = visualRect({ rect: fromBase, depth: w.depth }, screen);
  const to = visualRect({ rect: toBase, depth: c.depth ?? w.depth }, screen);
  return { from, to };
}

function Ghosts({ p }: { p: LayoutProposal }) {
  useKernelState((s) => s.rev);
  const items = p.changes.map((c) => ({ c, t: targetRect(p, c.windowId) })).filter((x) => x.t);
  return (
    <svg className="ghosts">
      <defs>
        <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill="#fff" />
        </marker>
      </defs>
      {items.map(({ c, t }) => {
        const from = t!.from;
        const to = t!.to;
        const a = center(from);
        const b = center(to);
        const moved = Math.hypot(a.x - b.x, a.y - b.y) > 8 || Math.abs(from.w - to.w) > 8;
        const label = p.labels?.[c.windowId] ?? kernel.get(c.windowId)?.title;
        return (
          <g key={c.windowId}>
            <rect className="ghost-r" x={to.x} y={to.y} width={to.w} height={to.h} rx={Math.min(30, to.w / 4)} />
            {moved && <line className="ghost-l" x1={a.x} y1={a.y} x2={b.x} y2={b.y} markerEnd="url(#arr)" />}
            {label && (
              <foreignObject x={to.x + 12} y={to.y + 10} width={Math.max(120, to.w - 24)} height="28">
                <div className="ghost-label">{label}</div>
              </foreignObject>
            )}
          </g>
        );
      })}
      {p.open?.map((o, i) => (
        <g key={`o${i}`}>
          <rect className="ghost-r new" x={o.rect.x} y={o.rect.y} width={o.rect.w} height={o.rect.h} rx="30" />
          <foreignObject x={o.rect.x + 12} y={o.rect.y + 10} width={o.rect.w - 24} height="28">
            <div className="ghost-label">+ {o.title}</div>
          </foreignObject>
        </g>
      ))}
    </svg>
  );
}

function Card({ p, compact }: { p: LayoutProposal; compact: boolean }) {
  const [open, setOpen] = useState(!compact);
  const opts = [
    ...p.changes.map((c) => ({ id: c.windowId, label: p.labels?.[c.windowId] ? `${kernel.get(c.windowId)?.title ?? c.windowId} → ${p.labels[c.windowId]}` : kernel.get(c.windowId)?.title ?? c.windowId })),
    ...(p.open?.length ? [{ id: '__open__', label: `Open ${p.open.map((o) => o.title).join(', ')}` }] : []),
    ...(p.techniques ? [{ id: '__tech__', label: `Turn on ${Object.keys(p.techniques).join(' + ')}` }] : []),
  ];
  const [sel, setSel] = useState(() => new Set(opts.map((o) => o.id)));
  useEffect(() => setOpen(!compact), [compact]);
  if (!open)
    return (
      <button className="prop-chip" onMouseEnter={() => agentStore.set({ hoverId: p.id })} onMouseLeave={() => agentStore.set({ hoverId: null })} onClick={() => setOpen(true)}>
        <span className="drop-dot" /> {p.title}
      </button>
    );
  return (
    <div className="prop-card" onMouseEnter={() => agentStore.set({ hoverId: p.id })} onMouseLeave={() => agentStore.set({ hoverId: null })}>
      <div className="prop-top">
        <span className="drop-dot" />
        <span className="prop-src">
          {p.source === 'user-request' ? 'Layout Lab' : p.source === 'llm' ? 'LLM agent' : 'Layout agent'} · {p.technique}
        </span>
        <span className="conf" title="confidence (lowered by your past rejections)">
          <i style={{ width: `${Math.round(p.confidence * 100)}%` }} />
        </span>
      </div>
      <div className="prop-title">{p.title}</div>
      <div className="prop-why">{p.rationale}</div>
      <div className="prop-ev">
        {p.evidence.map((e) => (
          <span key={e}>{e}</span>
        ))}
      </div>
      {opts.length > 1 && (
        <div className="prop-opts">
          {opts.map((o) => (
            <label key={o.id}>
              <input
                type="checkbox"
                checked={sel.has(o.id)}
                onChange={() =>
                  setSel((s) => {
                    const n = new Set(s);
                    if (n.has(o.id)) n.delete(o.id);
                    else n.add(o.id);
                    return n;
                  })
                }
              />
              {o.label}
            </label>
          ))}
        </div>
      )}
      <div className="prop-actions">
        <button className="btn" onClick={() => agent.reject(p.id)}>
          Not now
        </button>
        <button className="btn primary" disabled={sel.size === 0} onClick={() => agent.accept(p.id, sel.size === opts.length ? undefined : [...sel])}>
          {sel.size === opts.length ? 'Apply' : `Apply ${sel.size} of ${opts.length}`}
        </button>
      </div>
    </div>
  );
}

export function ProposalLayer() {
  const pending = useStore(agentStore, (s) => s.pending);
  const hover = useStore(agentStore, (s) => s.hoverId);
  const autonomy = useStore(ui, (s) => s.autonomy);
  const compact = autonomy === 'suggest';
  const showGhost = (p: LayoutProposal) => hover === p.id || (autonomy === 'preview' && p === pending[pending.length - 1]) || p.source === 'user-request';
  return (
    <>
      {pending.filter(showGhost).map((p) => (
        <Ghosts key={p.id} p={p} />
      ))}
      <div className="prop-stack">
        {pending.map((p) => (
          <Card key={p.id} p={p} compact={compact && p.source !== 'user-request'} />
        ))}
      </div>
    </>
  );
}

export function AutonomyDial() {
  const autonomy = useStore(ui, (s) => s.autonomy);
  const enabled = useStore(ui, (s) => s.agentEnabled);
  const idx = AUTONOMY_LEVELS.findIndex((a) => a.id === autonomy);
  return (
    <div className={`dial ${enabled ? '' : 'disabled'}`}>
      <div className="dial-track">
        <div className="dial-fill" style={{ width: `${(idx / (AUTONOMY_LEVELS.length - 1)) * 100}%` }} />
        {AUTONOMY_LEVELS.map((a, i) => (
          <button
            key={a.id}
            className={`dial-stop ${i <= idx ? 'on' : ''}`}
            style={{ left: `${(i / (AUTONOMY_LEVELS.length - 1)) * 100}%` }}
            title={a.hint}
            onClick={() => {
              ui.set({ autonomy: a.id, agentEnabled: a.id === 'off' ? enabled : true });
              agent.schedule(200);
            }}
          />
        ))}
      </div>
      <div className="dial-labels">
        {AUTONOMY_LEVELS.map((a) => (
          <span key={a.id} className={a.id === autonomy ? 'on' : ''}>
            {a.label}
          </span>
        ))}
      </div>
      <div className="dial-hint">{AUTONOMY_LEVELS[idx]?.hint}</div>
    </div>
  );
}
