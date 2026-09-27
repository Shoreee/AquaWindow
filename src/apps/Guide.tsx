import type { WindowState } from '../kernel/types';
import { loadScenario } from '../scenarios/director';
import { SCENARIOS } from '../scenarios/scenarios';

export default function Guide(_: { win: WindowState }) {
  return (
    <div className="guide">
      <header className="guide-hero">
        <div className="guide-drop" />
        <div>
          <h1>AquaWindow</h1>
          <p className="guide-sub">
            Negotiable Boundaries — a pseudo-OS for studying <b>agent-negotiated, fluid window layout</b>.
          </p>
        </div>
      </header>
      <section className="guide-pos">
        <p>
          Desktop windows are rigid rectangles in a flat stack: occlusion is the user’s problem, and the only automatic help is “tile” or “minimise”. AquaWindow treats each window as a <b>territory</b> whose boundary can
          deform, fuse and recede in depth — and treats that boundary as the place where the user and a layout agent <b>negotiate</b>. The agent never moves windows by itself: it proposes, previews and yields, under an
          autonomy level the user controls.
        </p>
        <div className="rq-grid">
          <div>
            <b>RQ1 · Shape</b>
            <span>Does continuous boundary change (yield / dent / fuse) beat uniform scaling for keeping several windows usable?</span>
          </div>
          <div>
            <b>RQ2 · Agent</b>
            <span>What does an agent add over rules and optimisers? Behavioural &amp; semantic priors that turn “mathematically optimal” into “acceptable”.</span>
          </div>
          <div>
            <b>RQ3 · Depth</b>
            <span>Can z become an interaction dimension — recede, x-ray, trails — instead of only stacking order?</span>
          </div>
        </div>
      </section>
      <section>
        <h3>Five scenarios</h3>
        <div className="guide-scn">
          {SCENARIOS.map((s) => (
            <button key={s.id} className="scn-card" onClick={() => loadScenario(s.id)}>
              <span className="scn-n">{s.n}</span>
              <span className="scn-main">
                <b>{s.title}</b>
                <small>{s.zh}</small>
                <em>{s.strategies.length} competing designs · {s.rq.join(' ')}</em>
              </span>
            </button>
          ))}
        </div>
      </section>
      <section className="guide-keys">
        <h3>Controls</h3>
        <div className="keys">
          <span><kbd>⌥</kbd>+scroll on a window — push back / pull forward in depth</span>
          <span><kbd>Space</kbd> (hold) — x-ray through front layers</span>
          <span>Corner dog-ear, or <kbd>⌥</kbd>+drag a corner — peel back; <kbd>Shift</kbd> on release pins</span>
          <span><kbd>Shift</kbd>+drag — move a window out of its fused group</span>
          <span><kbd>⌥</kbd><kbd>Tab</kbd> — switcher · <kbd>F3</kbd> — Mission Control</span>
          <span><kbd>⌘/Ctrl</kbd><kbd>Z</kbd> — undo layout · <kbd>`</kbd> — researcher console</span>
        </div>
      </section>
    </div>
  );
}
