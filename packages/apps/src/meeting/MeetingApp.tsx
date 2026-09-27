import { useEffect, useState } from 'react';

const PEOPLE = [
  { id: 'li', name: 'Li Wei', color: '#5b8def' },
  { id: 'ana', name: 'Ana Costa', color: '#e07a5f' },
  { id: 'jun', name: 'Jun Park', color: '#81b29a' },
  { id: 'sam', name: 'Sam Okoye', color: '#f2cc8f' },
];

export function MeetingApp() {
  const [speaker, setSpeaker] = useState(0);
  const [sharing, setSharing] = useState(true);

  useEffect(() => {
    const id = window.setInterval(() => setSpeaker((s) => (s + 1) % PEOPLE.length), 6000);
    return () => window.clearInterval(id);
  }, []);

  const current = PEOPLE[speaker]!;

  return (
    <div className="aw-app aw-meeting">
      <div className="aw-meet-toolbar">
        <span className="dot live" /> CHI writing sync · 4
        <button onClick={() => setSharing((s) => !s)}>{sharing ? 'Stop share' : 'Share screen'}</button>
      </div>
      <div className="aw-meet-body">
        {sharing ? (
          <div className="aw-share-canvas">
            <p className="aw-kicker">Shared · slides</p>
            <h2>Fluid Territories — study protocol</h2>
            <ul>
              <li>Conditions: baseline / tiling / fluid / fluid-agent</li>
              <li>Pin this canvas (ice) so the agent cannot shove it</li>
              <li>Speaker tile should dock, not cover</li>
            </ul>
          </div>
        ) : (
          <div className="aw-grid-people">
            {PEOPLE.map((p) => (
              <PersonTile key={p.id} name={p.name} color={p.color} speaking={p.id === current.id} />
            ))}
          </div>
        )}
        <div className="aw-speaker-rail">
          <PersonTile name={current.name} color={current.color} speaking />
          <p className="aw-hint">Tension: speaker is pulled toward the share without covering it.</p>
        </div>
      </div>
    </div>
  );
}

function PersonTile({ name, color, speaking }: { name: string; color: string; speaking?: boolean }) {
  return (
    <div className={`aw-person ${speaking ? 'speaking' : ''}`} style={{ background: color }}>
      <span>{name.split(' ').map((p) => p[0]).join('')}</span>
      <small>{name}</small>
    </div>
  );
}

export function ChatApp() {
  return (
    <div className="aw-app aw-chat">
      <h3>Meeting chat</h3>
      <div className="aw-chat-line">
        <b>Ana</b> pin the slide please
      </div>
      <div className="aw-chat-line">
        <b>Jun</b> I’ll fuse minutes to the share
      </div>
      <input placeholder="Message…" />
    </div>
  );
}

export function MinutesApp() {
  return (
    <div className="aw-app aw-minutes">
      <h3>Minutes</h3>
      <ul>
        <li>Decide autonomy default: preview</li>
        <li>Ice the shared canvas during talk</li>
        <li>Log centroid travel as stability</li>
      </ul>
    </div>
  );
}

export function SpeakerApp() {
  return (
    <div className="aw-app aw-speaker">
      <div className="aw-person speaking" style={{ background: '#e07a5f', height: '100%' }}>
        <span>AC</span>
        <small>Ana Costa · speaking</small>
      </div>
    </div>
  );
}
