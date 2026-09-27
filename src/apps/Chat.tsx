import { useState } from 'react';
import type { WindowState } from '../kernel/types';
import { useStore } from '../system/createStore';
import { appState } from './state';

const THREADS = ['Kai', 'Mom', '#meeting-lab'];

export default function Chat({ peripheral }: { win: WindowState; peripheral?: boolean }) {
  const chat = useStore(appState, (s) => s.chat);
  const [thread, setThread] = useState('Kai');
  const [draft, setDraft] = useState('');
  const msgs = chat.filter((m) => m.from === thread || (m.mine && m.to === thread));
  if (peripheral) {
    const last = chat[chat.length - 1];
    return <div className="chat-peri">{last ? `${last.from}: ${last.text}` : 'No messages'}</div>;
  }
  return (
    <div className="chat">
      <aside className="chat-side">
        {THREADS.map((t) => {
          const last = [...chat].reverse().find((m) => m.from === t);
          const unread = chat.filter((m) => m.from === t && !m.mine).length;
          return (
            <button key={t} className={`chat-th ${t === thread ? 'on' : ''}`} onClick={() => setThread(t)}>
              <span className="chat-av">{t[0] === '#' ? '#' : t[0]}</span>
              <span className="chat-th-main">
                <b>{t}</b>
                <small>{last?.text ?? ' '}</small>
              </span>
              {unread > 0 && t !== thread && <span className="badge">{unread}</span>}
            </button>
          );
        })}
      </aside>
      <section className="chat-main">
        <div className="chat-head">{thread}</div>
        <div className="chat-msgs">
          {msgs.map((m, i) => (
            <div key={i} className={`bubble ${m.mine ? 'mine' : ''}`}>
              {m.text}
            </div>
          ))}
          {msgs.length === 0 && <div className="empty">No messages yet</div>}
        </div>
        <form
          className="chat-input"
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.trim()) return;
            appState.set((s) => ({ chat: [...s.chat, { from: 'You', to: thread, text: draft, mine: true, t: Date.now() }] }));
            setDraft('');
          }}
        >
          <input placeholder="iMessage" value={draft} onChange={(e) => setDraft(e.target.value)} />
        </form>
      </section>
    </div>
  );
}
