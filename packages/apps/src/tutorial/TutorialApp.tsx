import { useState } from 'react';

const STEPS = [
  { title: 'New layer', hint: 'Click + Layer in the Layers panel.', target: 'layer' },
  { title: 'Pick brush', hint: 'Choose Brush in the toolbar.', target: 'brush' },
  { title: 'Set color', hint: 'Open the swatch and pick teal.', target: 'color' },
  { title: 'Export', hint: 'File → Export PNG.', target: 'export' },
];

export function TutorialGuideApp({ onStep }: { windowId: string; onStep?: (index: number) => void }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step]!;

  return (
    <div className="aw-app aw-guide">
      <p className="aw-kicker">AquaDraw 101</p>
      <h2>
        Step {step + 1} / {STEPS.length}: {current.title}
      </h2>
      <p>{current.hint}</p>
      <p className="aw-hint">When you act in the editor, this window should shrink into a droplet and recede.</p>
      <footer>
        <button disabled={step === 0} onClick={() => { setStep(step - 1); onStep?.(step - 1); }}>
          Back
        </button>
        <button
          disabled={step === STEPS.length - 1}
          onClick={() => {
            setStep(step + 1);
            onStep?.(step + 1);
          }}
        >
          Next
        </button>
      </footer>
    </div>
  );
}

export function EditorApp() {
  const [layers, setLayers] = useState(['Background']);
  const [tool, setTool] = useState<'move' | 'brush'>('move');
  const [color, setColor] = useState('#48c5d4');
  const [strokes, setStrokes] = useState<{ x: number; y: number; color: string }[]>([]);
  const [exported, setExported] = useState(false);

  return (
    <div className="aw-app aw-editor">
      <div className="aw-editor-bar">
        <button className={tool === 'move' ? 'active' : ''} onClick={() => setTool('move')}>
          Move
        </button>
        <button className={tool === 'brush' ? 'active' : ''} data-target="brush" onClick={() => setTool('brush')}>
          Brush
        </button>
        <input
          data-target="color"
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          aria-label="Color"
        />
        <button data-target="export" onClick={() => setExported(true)}>
          Export PNG
        </button>
        {exported && <span className="aw-pill">exported</span>}
      </div>
      <div className="aw-editor-body">
        <div
          className="aw-canvas-sim"
          onClick={(e) => {
            if (tool !== 'brush') return;
            const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
            setStrokes((s) => [...s, { x: e.clientX - r.left, y: e.clientY - r.top, color }]);
          }}
        >
          {strokes.map((s, i) => (
            <i key={i} style={{ left: s.x, top: s.y, background: s.color }} />
          ))}
        </div>
        <aside>
          <header>
            Layers
            <button data-target="layer" onClick={() => setLayers((l) => [...l, `Layer ${l.length}`])}>
              + Layer
            </button>
          </header>
          <ul>
            {layers.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
