import type { WindowState } from '../kernel/types';
import { useStore } from '../system/createStore';
import { bus } from '../system';
import { PEOPLE, SCRIPT, SLIDES } from './data/meeting';
import { appState, useScenarioTime } from './state';

export function meetingNow(t: number) {
  let line = SCRIPT[0];
  let slide = 0;
  for (const s of SCRIPT) {
    if (s.t <= t) {
      line = s;
      if (s.slide !== undefined) slide = s.slide;
    }
  }
  const speaking = t - line.t < 5.5;
  return { line, slide, speaking };
}

function Avatar({ id, size = 56, talking }: { id: string; size?: number; talking?: boolean }) {
  const p = PEOPLE.find((x) => x.id === id) ?? PEOPLE[0];
  return (
    <div className={`avatar ${talking ? 'talking' : ''}`} style={{ width: size, height: size, ['--h' as string]: p.hue }}>
      <span>{p.name[0]}</span>
    </div>
  );
}

export function Slide({ index, compact }: { index: number; compact?: boolean }) {
  const s = SLIDES[index] ?? SLIDES[0];
  return (
    <div className={`slide ${compact ? 'compact' : ''}`}>
      <div className="slide-n">
        {index + 1}/{SLIDES.length}
      </div>
      <h2>{s.title}</h2>
      {!compact && (
        <ul>
          {s.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}
      <div className="slide-art" />
    </div>
  );
}

export default function Meeting({ win, peripheral }: { win: WindowState; peripheral?: boolean }) {
  const t = useScenarioTime(4);
  const { line, slide, speaking } = meetingNow(t);
  const mentionAt = useStore(appState, (s) => s.mentionAt);
  const answered = useStore(appState, (s) => s.answered);
  const mentioned = mentionAt !== null && !answered;
  const who = PEOPLE.find((p) => p.id === line.speaker)!;

  const answer = () => {
    appState.set({ answered: true });
    bus.emit({ type: 'task.done', windowId: win.id, data: { task: 'answer-mention', latency: mentionAt ? +(t - mentionAt).toFixed(1) : null } });
  };

  if (peripheral) {
    return (
      <div className={`mt-peri ${mentioned ? 'alert' : ''}`}>
        <Avatar id={line.speaker} size={40} talking={speaking} />
        <div className="mt-peri-main">
          <div className="mt-peri-who">
            {who.name} <span>· slide {slide + 1}</span>
          </div>
          <div className="mt-peri-cap">{line.text}</div>
        </div>
        {mentioned && (
          <button className="mt-answer" onClick={answer}>
            Unmute & answer
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="meeting">
      <div className="mt-stage">
        <div className="mt-speaker">
          <Avatar id={line.speaker} size={96} talking={speaking} />
          <div className="mt-name">{who.name}</div>
        </div>
        <div className="mt-strip">
          {PEOPLE.map((p) => (
            <div key={p.id} className={`mt-tile ${p.id === line.speaker ? 'on' : ''}`}>
              <Avatar id={p.id} size={30} talking={p.id === line.speaker && speaking} />
              <span>{p.name}</span>
            </div>
          ))}
        </div>
      </div>
      <div className={`mt-captions ${line.mention ? 'mention' : ''}`}>
        <b>{who.name}:</b> {line.text}
      </div>
      {mentioned && (
        <div className="mt-banner">
          Omar asked you a question
          <button onClick={answer}>Unmute & answer</button>
        </div>
      )}
      <div className="mt-controls">
        <button className="mc">🎙︎</button>
        <button className="mc">📷</button>
        <button className="mc">⤴︎</button>
        <button className="mc">✋</button>
        <button className="mc leave">Leave</button>
      </div>
    </div>
  );
}

export function Share({ win, peripheral }: { win: WindowState; peripheral?: boolean }) {
  const t = useScenarioTime(2);
  const { slide } = meetingNow(t);
  return (
    <div className={`share ${peripheral ? 'peri' : ''}`}>
      {!peripheral && <div className="share-bar">{String(win.props.presenter ?? 'Lin')} is sharing · Keynote</div>}
      <Slide index={slide} compact={peripheral} />
    </div>
  );
}

export function Tile({ win }: { win: WindowState }) {
  const t = useScenarioTime(4);
  const { line, speaking } = meetingNow(t);
  const id = String(win.props.person ?? 'Lin').toLowerCase();
  return (
    <div className="tile">
      <Avatar id={id} size={74} talking={line.speaker === id && speaking} />
      <div className="tile-name">{String(win.props.person ?? 'Lin')}</div>
    </div>
  );
}
