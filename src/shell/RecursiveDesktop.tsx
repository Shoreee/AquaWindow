import { useEffect, useMemo, useRef, useState, type PointerEvent as RPE } from 'react';
import { AppIcon } from '../apps/icons';
import { APPS } from '../apps/registry';
import type { KernelState, WindowState } from '../kernel/types';

interface Props { state: KernelState; initialOrder: string[]; onClose: () => void }
type Place = { x: number; y: number; w: number; h: number };
const PORTAL = 0.42;
const DEPTH = 7;
const START: Place[] = [
  { x: 0, y: 0, w: 1, h: 1 },
  { x: .39, y: 0, w: .61, h: .66 },
  { x: .35, y: .45, w: .65, h: .55 },
];

export function RecursiveDesktop({ state, initialOrder, onClose }: Props) {
  const [zoom, setZoom] = useState(0);
  const [places, setPlaces] = useState(START);
  const [focused, setFocused] = useState<string | null>(null);
  const camera = useRef<HTMLDivElement>(null);
  const wins = useMemo(
    () => initialOrder.map(id => state.windows[id]).filter((w): w is WindowState => !!w && !w.minimized).slice(-3),
    [initialOrder, state],
  );
  const phase = ((zoom % 1) + 1) % 1;
  const scale = Math.pow(1 / PORTAL, phase);

  useEffect(() => {
    const wheel = (e: WheelEvent) => {
      if (!(e.shiftKey && (e.ctrlKey || e.metaKey || e.altKey))) return;
      e.preventDefault();
      e.stopPropagation();
      setZoom(z => z + (e.deltaY > 0 ? -1 : 1) * Math.min(.18, Math.abs(e.deltaY) / 560));
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'r')) {
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && ['+', '=', '-', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        setZoom(z => z + (e.key === '-' || e.key === 'ArrowDown' ? -.2 : .2));
      }
    };
    window.addEventListener('wheel', wheel, { passive: false, capture: true });
    window.addEventListener('keydown', key, true);
    return () => {
      window.removeEventListener('wheel', wheel, true);
      window.removeEventListener('keydown', key, true);
    };
  }, [onClose]);

  const startWindowDrag = (e: RPE, index: number, depth: number) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button,input,a')) return;
    e.preventDefault();
    e.stopPropagation();
    const screen = camera.current?.getBoundingClientRect();
    if (!screen) return;
    const start = { ...places[index] };
    const sx = e.clientX, sy = e.clientY;
    const sceneScale = scale * Math.pow(PORTAL, depth);
    const move = (ev: PointerEvent) => setPlaces(before => before.map((p, i) => i === index ? {
      ...p,
      x: Math.max(-.75, Math.min(.95, start.x + (ev.clientX - sx) / (screen.width * sceneScale))),
      y: Math.max(-.75, Math.min(.95, start.y + (ev.clientY - sy) / (screen.height * sceneScale))),
    } : p));
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  };

  const startDragZoom = (e: RPE<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    const sy = e.clientY, start = zoom;
    const move = (ev: PointerEvent) => setZoom(start + (sy - ev.clientY) / 360);
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  };

  const scene = (depth: number): React.ReactNode => {
    const unit = Math.pow(PORTAL, depth);
    return <div className="recursive-scene">
      {wins.map((win, index) => {
        const p = places[index], App = APPS[win.appId]?.Component;
        return <div
          className={`recursive-tile recursive-window ${focused === win.id ? 'recursive-focused' : ''}`}
          key={win.id}
          style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, width: `${p.w * 100}%`, height: `${p.h * 100}%`, zIndex: index + 1 }}
          onPointerDown={() => setFocused(win.id)}
        >
          <div className="recursive-window-inner" style={{ width: `${100 / unit}%`, height: `${100 / unit}%`, transform: `scale(${unit})` }}>
            <div className="recursive-window-bar" onPointerDown={e => startWindowDrag(e, index, depth)}>
              <AppIcon appId={win.appId} size={16} /><span>{win.title}</span>
            </div>
            <div className="recursive-app-content">{App ? <App win={win} /> : win.title}</div>
          </div>
        </div>;
      })}
      <div className="recursive-tile recursive-portal" style={{ zIndex: wins.length + 1 }}>
        {depth < DEPTH ? scene(depth + 1) : <div className="recursive-limit">∞</div>}
      </div>
    </div>;
  };

  return <div className="recursive-desktop">
    <div className="recursive-camera" ref={camera}>
      <div className="recursive-stage" style={{ transform: `translate(${(1 - scale) * 50}%, ${(1 - scale) * 50}%) scale(${scale})` }}>{scene(0)}</div>
    </div>
    <div className="recursive-toolbar" onPointerDown={startDragZoom}>
      <span>递归桌面 <b>∞</b></span>
      <span>拖标题栏移动窗口 · 拖动此栏上下缩放</span>
      <button className="recursive-zoom-button" onClick={() => setZoom(z => z - .2)} aria-label="缩小">−</button>
      <button className="recursive-zoom-button" onClick={() => setZoom(z => z + .2)} aria-label="放大">+</button>
      <button onClick={onClose}>退出 <kbd>Esc</kbd></button>
    </div>
  </div>;
}
