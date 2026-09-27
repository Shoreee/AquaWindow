import { memo, useEffect, useRef, useState, type PointerEvent as RPE } from 'react';
import { APPS } from '../apps/registry';
import { AppIcon } from '../apps/icons';
import { overlapArea } from '../kernel/geometry';
import type { Rect, WindowState } from '../kernel/types';
import { log } from '../study/logger';
import { kernel, ui, workArea } from '../system';
import { MENUBAR } from '../system/kernel';
import { depthStyle } from '../techniques/depth';
import { peelGeometry, polyCss, polySvg } from '../techniques/peel';
import type { Techniques } from '../techniques/techniques';
import { rerankTrail, scrubTrail } from '../techniques/trail';
import { capsuleRectFor, type WindowVisual } from '../techniques/visuals';

type Pt = [number, number];

interface Props {
  win: WindowState;
  visual: WindowVisual;
  focused: boolean;
  tech: Techniques;
  xray: boolean;
  active: boolean;
  alert: boolean;
}

const Content = memo(
  function Content({ win, peripheral }: { win: WindowState; peripheral: boolean }) {
    const App = APPS[win.appId]?.Component;
    return App ? <App win={win} peripheral={peripheral} /> : <div className="empty">Unknown app {win.appId}</div>;
  },
  (a, b) => a.win.id === b.win.id && a.win.props === b.win.props && a.win.group === b.win.group && a.win.title === b.win.title && a.peripheral === b.peripheral,
);

const EDGES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const;

function snapTarget(x: number, y: number): Rect | null {
  const W = workArea();
  const { w } = kernel.getState().screen;
  if (x < 6) return { x: W.x, y: W.y, w: W.w / 2 - 4, h: W.h };
  if (x > w - 6) return { x: W.x + W.w / 2 + 4, y: W.y, w: W.w / 2 - 4, h: W.h };
  if (y < MENUBAR + 2) return W;
  return null;
}

function nearestPartner(win: WindowState): WindowState | null {
  let best: WindowState | null = null;
  let bestD = Infinity;
  for (const o of kernel.list()) {
    if (o.id === win.id || o.minimized || o.form !== 'normal' || o.depth > 0.05) continue;
    const gx = Math.max(0, Math.max(o.rect.x - (win.rect.x + win.rect.w), win.rect.x - (o.rect.x + o.rect.w)));
    const gy = Math.max(0, Math.max(o.rect.y - (win.rect.y + win.rect.h), win.rect.y - (o.rect.y + o.rect.h)));
    const d = Math.hypot(gx, gy) - overlapArea(o.rect, win.rect) / 1000;
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  return best;
}

function WindowImpl({ win, visual, focused, tech, xray, active, alert }: Props) {
  const def = APPS[win.appId];
  const capsule = win.form === 'capsule';
  const rect = capsule ? capsuleRectFor(win, kernel.getState().screen) : win.rect;
  const [peel, setPeel] = useState<{ corner: Pt; p: Pt; pinned: boolean } | null>(null);
  const peelAnim = useRef(0);
  const peelRef = useRef(peel);
  peelRef.current = peel;
  const ghost = !!win.props.ghost;

  useEffect(() => () => cancelAnimationFrame(peelAnim.current), []);

  // ── focus / depth pull ────────────────────────────────────────────────────
  const onPointerDownCapture = (e: RPE) => {
    if (e.button !== 0) return;
    if (win.depth > 0.05 && !e.altKey) {
      if (win.group?.startsWith('trail')) rerankTrail(kernel, win.group, win.id, 'trail:pull');
      else {
        kernel.apply([{ windowId: win.id, depth: 0, focus: true }], 'user', 'depth:pull');
        log({ src: 'technique', type: 'depth', windowId: win.id, data: { op: 'pull-click' } });
      }
      return;
    }
    kernel.focus(win.id);
  };

  // ── move (group-aware) ────────────────────────────────────────────────────
  const startMove = (e: RPE) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button,input')) return;
    e.preventDefault();
    const sx = e.clientX;
    const sy = e.clientY;
    let members = [win];
    if (tech.fusion && win.group && !capsule) {
      if (e.shiftKey) {
        kernel.setGroup(win.id, undefined);
        log({ src: 'technique', type: 'fusion', windowId: win.id, data: { op: 'detach' } });
      } else members = kernel.list().filter((w) => w.group === win.group && w.form === 'normal' && !w.minimized);
    }
    const starts = members.map((m) => ({ id: m.id, r: { ...m.rect } }));
    const cap0 = { ...rect };
    kernel.beginGesture('move');
    ui.set({ activeId: win.id });
    let snap: Rect | null = null;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - sx;
      const dy = ev.clientY - sy;
      if (capsule) {
        kernel.setCapsuleRect(win.id, { ...cap0, x: cap0.x + dx, y: Math.max(MENUBAR, cap0.y + dy) });
        return;
      }
      for (const s of starts) kernel.setRect(s.id, { ...s.r, x: s.r.x + dx, y: Math.max(MENUBAR, s.r.y + dy) });
      if (tech.snap && members.length === 1) {
        snap = snapTarget(ev.clientX, ev.clientY);
        ui.set({ snapPreview: snap });
      }
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (snap) kernel.setRect(win.id, snap, 'user', 'snap');
      kernel.endGesture();
      ui.set({ activeId: null, snapPreview: null });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // ── resize ────────────────────────────────────────────────────────────────
  const startResize = (edge: (typeof EDGES)[number]) => (e: RPE) => {
    e.stopPropagation();
    e.preventDefault();
    kernel.focus(win.id);
    const sx = e.clientX;
    const sy = e.clientY;
    const r0 = { ...win.rect };
    const minW = win.appId === 'refimage' || win.appId === 'tile' ? 120 : 260;
    const minH = win.appId === 'refimage' || win.appId === 'tile' ? 90 : 170;
    kernel.beginGesture('resize');
    ui.set({ activeId: win.id });
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - sx;
      const dy = ev.clientY - sy;
      const r = { ...r0 };
      if (edge.includes('e')) r.w = Math.max(minW, r0.w + dx);
      if (edge.includes('s')) r.h = Math.max(minH, r0.h + dy);
      if (edge.includes('w')) {
        r.w = Math.max(minW, r0.w - dx);
        r.x = r0.x + r0.w - r.w;
      }
      if (edge.includes('n')) {
        r.h = Math.max(minH, r0.h - dy);
        r.y = Math.max(MENUBAR, r0.y + r0.h - r.h);
      }
      kernel.setRect(win.id, r, 'user', 'resize');
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      kernel.endGesture();
      ui.set({ activeId: null });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // ── peel ─────────────────────────────────────────────────────────────────
  const localPt = (cx: number, cy: number): Pt => {
    const s = visual.depthT.s;
    return [(cx - visual.vis.x) / s, (cy - visual.vis.y) / s];
  };
  const startPeel = (corner: Pt) => (e: RPE) => {
    e.stopPropagation();
    e.preventDefault();
    cancelAnimationFrame(peelAnim.current);
    kernel.focus(win.id);
    log({ src: 'technique', type: 'peel', windowId: win.id });
    setPeel({ corner, p: localPt(e.clientX, e.clientY), pinned: false });
    const move = (ev: PointerEvent) => setPeel((pp) => (pp ? { ...pp, p: localPt(ev.clientX, ev.clientY) } : pp));
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (ev.shiftKey) setPeel((pp) => (pp ? { ...pp, pinned: true } : pp));
      else springBack();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const springBack = () => {
    const start = peelRef.current;
    if (!start) return;
    const t0 = performance.now();
    const from = start.p;
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / 280);
      const k = 1 - Math.pow(1 - t, 3);
      if (t >= 1) return setPeel(null);
      setPeel({ ...start, pinned: false, p: [from[0] + (start.corner[0] - from[0]) * k, from[1] + (start.corner[1] - from[1]) * k] });
      peelAnim.current = requestAnimationFrame(step);
    };
    peelAnim.current = requestAnimationFrame(step);
  };
  const onAltCorner = (e: RPE) => {
    if (!tech.peel || !e.altKey || capsule) return;
    const [lx, ly] = localPt(e.clientX, e.clientY);
    const corners: Pt[] = [
      [0, 0],
      [win.rect.w, 0],
      [win.rect.w, win.rect.h],
      [0, win.rect.h],
    ];
    const c = corners.find((q) => Math.hypot(q[0] - lx, q[1] - ly) < 110);
    if (c) startPeel(c)(e);
  };

  const pg = peel ? peelGeometry(win.rect.w, win.rect.h, peel.corner, peel.p) : null;

  // ── wheel depth ───────────────────────────────────────────────────────────
  const onWheel = (e: React.WheelEvent) => {
    if (!tech.depth || !e.altKey) return;
    const dir = (e.deltaY || e.deltaX) > 0 ? 1 : -1;
    if (win.group?.startsWith('trail')) {
      scrubTrail(kernel, win.group, dir as 1 | -1);
    } else {
      kernel.setDepth(win.id, win.depth + dir * 0.08);
    }
    log({ src: 'technique', type: 'depth', windowId: win.id, data: { op: 'wheel', dir } });
  };

  // ── styles ────────────────────────────────────────────────────────────────
  const { s, dx, dy } = visual.depthT;
  const ds = depthStyle(win.depth, xray);
  const clip = pg ? polyCss(pg.visible) : visual.clipPath;
  const outerStyle: React.CSSProperties = {
    left: rect.x,
    top: rect.y,
    width: rect.w,
    height: rect.h,
    zIndex: visual.zIndex,
    transform: `translate(${dx}px, ${dy}px) scale(${s})`,
    opacity: ghost ? 0.42 : ds.opacity,
    filter: ds.filter,
    ['--r' as string]: `${visual.radius}px`,
  };
  const shellStyle: React.CSSProperties = visual.yieldScale
    ? { transform: `translate(${visual.yieldScale.dx}px, ${visual.yieldScale.dy}px) scale(${visual.yieldScale.s})`, transformOrigin: '0 0' }
    : {};
  const bodyStyle: React.CSSProperties = {
    clipPath: clip,
    WebkitMaskImage: visual.maskImage,
    maskImage: visual.maskImage,
    maskSize: '100% 100%',
    WebkitMaskSize: '100% 100%',
    maskMode: visual.maskImage ? 'luminance' : undefined,
  };

  const cls = [
    'aw-win',
    focused ? 'focused' : '',
    active ? 'active' : '',
    clip ? 'clipped' : '',
    capsule ? 'capsule' : '',
    tech.shape === 'squircle' ? 'fluid' : '',
    win.depth > 0.05 ? 'deep' : '',
    ghost ? 'ghost' : '',
    visual.dented ? 'dented' : '',
    def?.bare ? 'bare' : '',
    alert ? 'alert' : '',
    win.group && tech.fusion ? 'grouped' : '',
  ].join(' ');

  if (capsule) {
    return (
      <div className={cls} style={outerStyle} data-win={win.id} onPointerDownCapture={onPointerDownCapture} onWheel={onWheel}>
        <div className="aw-shell">
          <div className="aw-body" onPointerDown={startMove}>
            <div className="cap-head">
              <AppIcon appId={win.appId} size={16} />
              <span className="cap-title">{win.title}</span>
              <button className="tb-btn" title="Expand" onClick={() => kernel.setForm(win.id, 'normal')}>
                ⤢
              </button>
            </div>
            <div className="cap-content">
              <Content win={win} peripheral />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cls} style={outerStyle} data-win={win.id} onPointerDownCapture={onPointerDownCapture} onPointerDown={onAltCorner} onWheel={onWheel}>
      <div className="aw-shell" style={shellStyle}>
        <div className="aw-body" style={bodyStyle}>
          <div className="aw-title" onPointerDown={startMove} onDoubleClick={() => kernel.toggleMaximize(win.id, workArea())}>
            <div className="lights">
              <button className="l close" onClick={() => kernel.close(win.id)} />
              <button className="l min" onClick={() => kernel.minimize(win.id)} />
              <button className="l max" onClick={() => kernel.toggleMaximize(win.id, workArea())} />
            </div>
            <div className="aw-title-text">
              <AppIcon appId={win.appId} size={14} />
              {win.title}
            </div>
            <div className="tb-right">
              {tech.fusion && (
                <button
                  className={`tb-btn ${win.group ? 'on' : ''}`}
                  title={win.group ? 'Unfuse from group' : 'Fuse with nearest window'}
                  onClick={() => {
                    if (win.group) kernel.setGroup(win.id, undefined);
                    else {
                      const p = nearestPartner(win);
                      if (!p) return;
                      const g = p.group ?? `fuse-${p.id}`;
                      kernel.apply([{ windowId: p.id, group: g }, { windowId: win.id, group: g }], 'user', 'fuse');
                    }
                    log({ src: 'technique', type: 'fusion', windowId: win.id, data: { op: win.group ? 'unfuse' : 'fuse' } });
                  }}
                >
                  ⧉
                </button>
              )}
              {tech.periphery && def?.peripheral && (
                <button
                  className="tb-btn"
                  title="Collapse to peripheral capsule"
                  onClick={() => {
                    const W = workArea();
                    const n = kernel.list().filter((w) => w.form === 'capsule').length;
                    kernel.setForm(win.id, 'capsule', 'user', win.capsuleRect ?? { x: W.x + W.w - 300, y: W.y + 4 + n * 184, w: 292, h: 172 });
                  }}
                >
                  ◐
                </button>
              )}
              {tech.depth && (
                <button
                  className="tb-btn"
                  title="Push back in depth (⌥+scroll)"
                  onClick={() => {
                    kernel.setDepth(win.id, win.depth + 0.35);
                    log({ src: 'technique', type: 'depth', windowId: win.id, data: { op: 'push' } });
                  }}
                >
                  ⇣
                </button>
              )}
            </div>
          </div>
          <div className="aw-content">
            <Content win={win} peripheral={false} />
          </div>
        </div>
      </div>

      {visual.holes.map((h, i) => (
        <div
          key={i}
          className="cut-rim"
          style={{ left: h.rect.x, top: h.rect.y, width: h.rect.w, height: h.rect.h }}
          title="Click to bring this window forward"
          onPointerDown={(e) => {
            e.stopPropagation();
            kernel.focus(h.ownerId);
          }}
        >
          {h.label && <span>{h.label}</span>}
        </div>
      ))}

      {pg && (
        <svg className="peel-flap" width={win.rect.w} height={win.rect.h} onPointerDown={(e) => { if (peel?.pinned) { e.stopPropagation(); springBack(); } }}>
          <defs>
            <linearGradient id={`pf-${win.id}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#f4f6fb" />
              <stop offset="1" stopColor="#c9d0de" />
            </linearGradient>
          </defs>
          <polygon points={polySvg(pg.flap)} fill={`url(#pf-${win.id})`} stroke="rgba(0,0,0,.12)" style={{ pointerEvents: peel?.pinned ? 'auto' : 'none', cursor: 'pointer' }} />
          {pg.fold && <line x1={pg.fold[0][0]} y1={pg.fold[0][1]} x2={pg.fold[1][0]} y2={pg.fold[1][1]} stroke="rgba(255,255,255,.9)" strokeWidth="1.5" />}
        </svg>
      )}

      {tech.peel && !pg && (
        <>
          <div className="dog-ear br" onPointerDown={startPeel([win.rect.w, win.rect.h])} title="Peel back" />
          <div className="dog-ear bl" onPointerDown={startPeel([0, win.rect.h])} title="Peel back" />
        </>
      )}

      {!pg && EDGES.map((e) => <div key={e} className={`rz rz-${e}`} onPointerDown={startResize(e)} />)}
    </div>
  );
}

export const Window = memo(WindowImpl);
