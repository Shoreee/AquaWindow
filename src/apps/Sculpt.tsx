import { useEffect, useRef, useState } from 'react';
import type { WindowState } from '../kernel/types';
import { useStore } from '../system/createStore';
import { bus, ui } from '../system';
import { STEPS } from './data/tutorial';
import { appState } from './state';

function complete(control: string, winId: string) {
  const s = appState.get();
  if (s.tutorialDone.includes(control)) return;
  appState.set({ tutorialDone: [...s.tutorialDone, control] });
  bus.emit({ type: 'tutorial.done', windowId: winId, data: { control } });
  if (control === 'export') bus.emit({ type: 'task.done', windowId: winId, data: { task: 'tutorial' } });
}

const TOOLS = ['select', 'rect', 'ellipse', 'pen', 'text'];

export default function Sculpt({ win }: { win: WindowState }) {
  const stepIdx = useStore(appState, (s) => s.tutorialStep);
  const done = useStore(appState, (s) => s.tutorialDone);
  const agentOn = useStore(ui, (s) => s.agentEnabled && s.autonomy !== 'off');
  const [tool, setTool] = useState('select');
  const [shape, setShape] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [smooth, setSmooth] = useState(10);
  const [fill, setFill] = useState<'solid' | 'gradient'>('solid');
  const drag = useRef<{ x: number; y: number } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const [hintBox, setHintBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const step = STEPS[stepIdx];

  useEffect(() => {
    const host = root.current;
    const el = host?.querySelector(`[data-control="${step?.control}"]`);
    if (!host || !el) return;
    const measure = () => {
      const a = host.getBoundingClientRect();
      const b = el.getBoundingClientRect();
      setHintBox({ x: b.left - a.left, y: b.top - a.top, w: b.width, h: b.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    return () => ro.disconnect();
  }, [step?.control]);

  const onCanvasDown = (e: React.PointerEvent) => {
    if (tool !== 'rect') return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    drag.current = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onCanvasMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    let w = Math.abs(x - drag.current.x);
    let h = Math.abs(y - drag.current.y);
    if (e.shiftKey) {
      const s = Math.max(w * r.width, h * r.height);
      w = s / r.width;
      h = s / r.height;
    }
    setShape({ x: Math.min(x, drag.current.x), y: Math.min(y, drag.current.y), w, h });
  };
  const onCanvasUp = () => {
    if (drag.current && shape && shape.w > 0.03) complete('canvas', win.id);
    drag.current = null;
  };

  const radius = `${(smooth / 100) * 38}%`;
  return (
    <div className="sculpt" ref={root}>
      <div className="sc-tools">
        {TOOLS.map((t) => (
          <button
            key={t}
            data-control={t === 'rect' ? 'tool-rect' : undefined}
            className={`sc-tool ${tool === t ? 'on' : ''}`}
            onClick={() => {
              setTool(t);
              if (t === 'rect') complete('tool-rect', win.id);
            }}
            title={t}
          >
            {t === 'select' ? '↖' : t === 'rect' ? '▢' : t === 'ellipse' ? '◯' : t === 'pen' ? '✎' : 'T'}
          </button>
        ))}
      </div>
      <div className="sc-canvas" data-control="canvas" onPointerDown={onCanvasDown} onPointerMove={onCanvasMove} onPointerUp={onCanvasUp} style={{ cursor: tool === 'rect' ? 'crosshair' : 'default' }}>
        <div className="sc-artboard">
          <span>Icon · 1024</span>
        </div>
        {shape && (
          <div
            className="sc-shape"
            style={{
              left: `${shape.x * 100}%`,
              top: `${shape.y * 100}%`,
              width: `${shape.w * 100}%`,
              height: `${shape.h * 100}%`,
              borderRadius: radius,
              background: fill === 'gradient' ? 'linear-gradient(135deg,#ff9de6,#8a4dff)' : '#8aa4ff',
            }}
          />
        )}
      </div>
      <div className="sc-props">
        <section className="sc-sec" style={{ top: '2%', height: '26%' }}>
          <h4>Rectangle</h4>
          <div className="sc-row">
            <label>W</label>
            <span>{shape ? Math.round(shape.w * 900) : '—'}</span>
            <label>H</label>
            <span>{shape ? Math.round(shape.h * 700) : '—'}</span>
          </div>
        </section>
        <section className="sc-sec" data-control="smoothing" style={{ top: '30%', height: '16%' }}>
          <h4>Corners</h4>
          <div className="sc-row">
            <label>Smoothing</label>
            <input
              type="range"
              min={0}
              max={100}
              value={smooth}
              onChange={(e) => {
                const v = Number(e.target.value);
                setSmooth(v);
                if (v >= 55 && v <= 70) complete('smoothing', win.id);
              }}
            />
            <span>{smooth}%</span>
          </div>
        </section>
        <section className="sc-sec" style={{ top: '50%', height: '14%' }}>
          <h4>Fill</h4>
          <div className="sc-row">
            <button className={fill === 'solid' ? 'on' : ''} onClick={() => setFill('solid')}>Solid</button>
            <button
              data-control="fill"
              className={fill === 'gradient' ? 'on' : ''}
              onClick={() => {
                setFill('gradient');
                complete('fill', win.id);
              }}
            >
              Gradient
            </button>
          </div>
        </section>
        <section className="sc-sec" style={{ top: '66%', height: '16%' }}>
          <h4>Layers</h4>
          <div className="sc-layer">▢ Rectangle 1</div>
          <div className="sc-layer dim">▭ Artboard</div>
        </section>
        <section className="sc-sec" style={{ top: '84%', height: '14%' }}>
          <button className="sc-export" data-control="export" onClick={() => complete('export', win.id)}>
            Export PNG…
          </button>
        </section>
      </div>
      {agentOn && step && hintBox && !done.includes(step.control) && (
        <div className="sc-hint" style={{ left: hintBox.x - 4, top: hintBox.y - 4, width: hintBox.w + 8, height: hintBox.h + 8 }}>
          <span>{step.title}</span>
        </div>
      )}
      <div className="sc-progress">
        {STEPS.map((s) => (
          <span key={s.id} className={done.includes(s.control) ? 'done' : ''} />
        ))}
      </div>
    </div>
  );
}
