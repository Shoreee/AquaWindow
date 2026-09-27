import { useEffect, useRef, useState } from 'react';
import type { WindowState } from '../kernel/types';
import { bus } from '../system';
import { appState } from './state';

const SWATCHES = ['#1f2a44', '#3d6b5a', '#8fbf8a', '#f2d492', '#f29c6b', '#d9514e', '#f6efe4'];

export function Canvas({ win }: { win: WindowState }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState(SWATCHES[1]);
  const [size, setSize] = useState(10);
  const drawing = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const c = ref.current!;
    const ro = new ResizeObserver(() => {
      const img = c.width ? c.getContext('2d')!.getImageData(0, 0, c.width, c.height) : null;
      c.width = c.clientWidth * devicePixelRatio;
      c.height = c.clientHeight * devicePixelRatio;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#fbf7ef';
      ctx.fillRect(0, 0, c.width, c.height);
      if (img) ctx.putImageData(img, 0, 0);
    });
    ro.observe(c);
    return () => ro.disconnect();
  }, []);

  const pos = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) * devicePixelRatio, y: (e.clientY - r.top) * devicePixelRatio };
  };
  return (
    <div className="dcanvas">
      <div className="dc-bar">
        {SWATCHES.map((s) => (
          <button key={s} className={`sw ${s === color ? 'on' : ''}`} style={{ background: s }} onClick={() => setColor(s)} />
        ))}
        <input type="range" min={2} max={40} value={size} onChange={(e) => setSize(Number(e.target.value))} />
        <span className="grow" />
        <span className="dc-name">Poster — Moss & Light · 72%</span>
      </div>
      <canvas
        ref={ref}
        className="dc-surface"
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          drawing.current = pos(e);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const p = pos(e);
          const ctx = ref.current!.getContext('2d')!;
          ctx.strokeStyle = color;
          ctx.lineWidth = size * devicePixelRatio;
          ctx.lineCap = 'round';
          ctx.globalAlpha = 0.85;
          ctx.beginPath();
          ctx.moveTo(drawing.current.x, drawing.current.y);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          drawing.current = p;
        }}
        onPointerUp={() => {
          drawing.current = null;
          appState.set((s) => ({ strokes: s.strokes + 1 }));
          bus.emit({ type: 'design.stroke', windowId: win.id });
        }}
      />
    </div>
  );
}

function rand(seed: number) {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function RefArt({ seed, tag }: { seed: number; tag: string }) {
  const r = rand(seed);
  const hue = Math.floor(r() * 360);
  if (tag === 'palette') {
    return (
      <svg viewBox="0 0 100 70" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={`pg${seed}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={`hsl(${hue} 45% 70%)`} />
            <stop offset="1" stopColor={`hsl(${hue + 60} 50% 30%)`} />
          </linearGradient>
        </defs>
        <rect width="100" height="70" fill={`url(#pg${seed})`} />
        {[0, 1, 2, 3, 4].map((i) => (
          <rect key={i} x={8 + i * 17} y="50" width="14" height="12" rx="2" fill={`hsl(${hue + i * 22} ${40 + i * 8}% ${30 + i * 10}%)`} stroke="#fff" strokeWidth=".6" />
        ))}
      </svg>
    );
  }
  if (tag === 'form') {
    return (
      <svg viewBox="0 0 100 70" preserveAspectRatio="xMidYMid slice">
        <rect width="100" height="70" fill={`hsl(${hue} 20% 88%)`} />
        {Array.from({ length: 5 }, (_, i) => (
          <rect key={i} x={10 + r() * 60} y={10 + r() * 30} width={10 + r() * 30} height={10 + r() * 30} rx={r() * 14} fill={`hsl(${hue} 15% ${30 + i * 10}%)`} opacity=".85" />
        ))}
        <path d={`M0 60 Q 50 ${30 + r() * 20} 100 58 V70 H0z`} fill={`hsl(${hue} 20% 25%)`} />
      </svg>
    );
  }
  if (tag === 'texture') {
    return (
      <svg viewBox="0 0 100 70" preserveAspectRatio="xMidYMid slice">
        <defs>
          <filter id={`tx${seed}`}>
            <feTurbulence type="fractalNoise" baseFrequency={0.04 + r() * 0.08} numOctaves="4" seed={seed} />
            <feColorMatrix values={`0.3 0 0 0 ${0.2 + r() * 0.2}  0 0.35 0 0 ${0.25 + r() * 0.2}  0 0 0.25 0 ${0.15 + r() * 0.15}  0 0 0 0 1`} />
          </filter>
        </defs>
        <rect width="100" height="70" filter={`url(#tx${seed})`} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 100 70" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id={`lg${seed}`} cx={0.3 + r() * 0.4} cy={0.3 + r() * 0.3} r="0.7">
          <stop offset="0" stopColor={`hsl(${40 + r() * 30} 95% 85%)`} />
          <stop offset="0.4" stopColor={`hsl(${hue} 40% 45%)`} />
          <stop offset="1" stopColor={`hsl(${hue + 30} 50% 12%)`} />
        </radialGradient>
      </defs>
      <rect width="100" height="70" fill={`url(#lg${seed})`} />
    </svg>
  );
}

export function RefImage({ win }: { win: WindowState }) {
  return (
    <div className="refimg">
      <RefArt seed={Number(win.props.seed ?? 1)} tag={String(win.props.tag ?? 'palette')} />
      <span className="ref-tag">{String(win.props.tag)}</span>
    </div>
  );
}
