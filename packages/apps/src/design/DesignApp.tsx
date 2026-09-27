import { useState } from 'react';

const REFS = [
  { id: 'r1', name: 'Glass caustics', color: 'linear-gradient(135deg,#9be7ff,#5b8def)' },
  { id: 'r2', name: 'Paper grain', color: 'linear-gradient(135deg,#f6e7d8,#c9a227)' },
  { id: 'r3', name: 'Ink wash', color: 'linear-gradient(135deg,#1d1e2c,#6c7a89)' },
];

export function MoodboardApp() {
  const [peek, setPeek] = useState<string | null>(null);
  return (
    <div className="aw-app aw-mood">
      <h3>References</h3>
      <div className="aw-mood-grid">
        {REFS.map((r) => (
          <button
            key={r.id}
            className={`aw-swatch ${peek === r.id ? 'peek' : ''}`}
            style={{ background: r.color }}
            onMouseEnter={() => setPeek(r.id)}
            onMouseLeave={() => setPeek(null)}
          >
            {r.name}
          </button>
        ))}
      </div>
      <p className="aw-hint">Hover to peek — the cluster should stay at the periphery of the canvas.</p>
    </div>
  );
}

export function DesignCanvasApp() {
  const [marks, setMarks] = useState<{ x: number; y: number }[]>([]);
  return (
    <div className="aw-app aw-design-canvas">
      <div
        className="aw-paint"
        onClick={(e) => {
          const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
          setMarks((m) => [...m, { x: e.clientX - r.left, y: e.clientY - r.top }]);
        }}
      >
        {marks.map((m, i) => (
          <i key={i} style={{ left: m.x, top: m.y }} />
        ))}
        <p className="aw-ghost-label">Click to place a stroke</p>
      </div>
    </div>
  );
}
