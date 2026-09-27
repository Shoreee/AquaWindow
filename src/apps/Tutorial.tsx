import { useEffect, useRef, useState } from 'react';
import type { WindowState } from '../kernel/types';
import { useStore } from '../system/createStore';
import { bus, kernel, ui } from '../system';
import { STEPS } from './data/tutorial';
import { appState } from './state';

const DURATION = STEPS[STEPS.length - 1].end;

export default function Tutorial({ win }: { win: WindowState }) {
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [sync, setSync] = useState(true);
  const done = useStore(appState, (s) => s.tutorialDone);
  const ghostAllowed = useStore(ui, (s) => s.tech.ghostOverlay);
  const last = useRef(performance.now());
  const stepIdx = Math.max(0, STEPS.findIndex((s) => t >= s.start && t < s.end));
  const step = STEPS[stepIdx] ?? STEPS[STEPS.length - 1];
  const waiting = sync && playing && t >= step.end - 0.3 && !done.includes(step.control);

  useEffect(() => {
    let raf = 0;
    const loop = (now: number) => {
      const dt = (now - last.current) / 1000;
      last.current = now;
      setT((cur) => {
        if (!playing) return cur;
        const s = STEPS.find((x) => cur >= x.start && cur < x.end);
        if (sync && s && cur + dt >= s.end - 0.3 && !appState.get().tutorialDone.includes(s.control)) return s.end - 0.3;
        return Math.min(DURATION, cur + dt);
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, sync]);

  useEffect(() => {
    appState.set({ tutorialStep: stepIdx });
    bus.emit({ type: 'tutorial.step', windowId: win.id, data: { index: stepIdx, title: step.title, control: step.control } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx]);

  const cx = step.target.x + step.target.w / 2;
  const cy = step.target.y + step.target.h / 2;
  const p = Math.min(1, (t - step.start) / Math.max(1, step.end - step.start - 2));
  const curX = 0.45 + (cx - 0.45) * p;
  const curY = 0.55 + (cy - 0.55) * p;
  const ghost = !!win.props.ghost;

  return (
    <div className="tutorial">
      <div className="tv-screen">
        <div className="tv-mini">
          <div className="tv-tool" />
          <div className="tv-canvas">{stepIdx >= 2 && <div className="tv-shape" style={{ borderRadius: stepIdx >= 3 ? '32%' : '6%', background: stepIdx >= 4 ? 'linear-gradient(135deg,#ff9de6,#8a4dff)' : '#8aa4ff' }} />}</div>
          <div className="tv-props" />
          <div className="tv-target" style={{ left: `${step.target.x * 100}%`, top: `${step.target.y * 100}%`, width: `${step.target.w * 100}%`, height: `${step.target.h * 100}%` }} />
          <div className="tv-cursor" style={{ left: `${curX * 100}%`, top: `${curY * 100}%` }} />
        </div>
        <div className="tv-caption">
          <b>Step {stepIdx + 1}.</b> {step.title} — <span>{step.detail}</span>
        </div>
        {waiting && <div className="tv-wait">Paused — your turn: {step.title.toLowerCase()} in Sculpt</div>}
      </div>
      <div className="tv-controls">
        <button onClick={() => setPlaying((p) => !p)}>{playing ? '❚❚' : '▶'}</button>
        <div
          className="tv-scrub"
          onPointerDown={(e) => {
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setT(((e.clientX - r.left) / r.width) * DURATION);
          }}
        >
          {STEPS.map((s) => (
            <div key={s.id} className={`tv-chap ${done.includes(s.control) ? 'done' : ''}`} style={{ left: `${(s.start / DURATION) * 100}%`, width: `${((s.end - s.start) / DURATION) * 100}%` }} />
          ))}
          <div className="tv-head" style={{ left: `${(t / DURATION) * 100}%` }} />
        </div>
        <span className="tv-time">
          {Math.floor(t / 60)}:{String(Math.floor(t % 60)).padStart(2, '0')}
        </span>
        <button className={`tv-opt ${sync ? 'on' : ''}`} onClick={() => setSync((s) => !s)} title="Pause at the end of each step until you have done it">
          step-sync
        </button>
        {ghostAllowed && (
          <button className={`tv-opt ${ghost ? 'on' : ''}`} onClick={() => kernel.setProps(win.id, { ghost: !ghost })} title="See-through overlay: clicks pass to the app below">
            ghost
          </button>
        )}
      </div>
    </div>
  );
}
