import { useEffect, useState } from 'react';
import { useShell } from '../hooks/useShell.js';
import { launchScenario, setMenu, toggleConsole } from '../runtime.js';

const MENUS = [
  {
    id: 'aqua',
    label: 'AquaWindow',
    items: [
      { label: 'About AquaWindow', action: () => toggleConsole() },
      { label: 'Researcher Console (` )', action: () => toggleConsole() },
    ],
  },
  {
    id: 'scenario',
    label: 'Scenarios',
    items: [
      { label: 'File management', action: () => launchScenario('files') },
      { label: 'Paper reading', action: () => launchScenario('papers') },
      { label: 'Tencent Meeting', action: () => launchScenario('meeting') },
      { label: 'Software learning', action: () => launchScenario('tutorial') },
      { label: 'Design reference', action: () => launchScenario('design') },
    ],
  },
  {
    id: 'study',
    label: 'Study',
    items: [{ label: 'Toggle console', action: () => toggleConsole() }],
  },
];

export function MenuBar() {
  const shell = useShell();
  const [clock, setClock] = useState('');

  useEffect(() => {
    const tick = () =>
      setClock(new Date().toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' }));
    tick();
    const id = window.setInterval(tick, 15_000);
    return () => window.clearInterval(id);
  }, []);

  const open = MENUS.find((m) => m.id === shell.menu);

  return (
    <>
      <header className="aw-menubar">
        <nav>
          <span className="apple">A</span>
          {MENUS.map((m) => (
            <button
              key={m.id}
              className={shell.menu === m.id ? 'open' : ''}
              onClick={() => setMenu(shell.menu === m.id ? null : m.id)}
            >
              {m.label}
            </button>
          ))}
        </nav>
        <div className="clock">
          {clock} · {shell.condition}
        </div>
      </header>
      {open && (
        <div className="aw-menu" style={{ left: open.id === 'aqua' ? 36 : open.id === 'scenario' ? 140 : 230 }}>
          {open.items.map((item) => (
            <button
              key={item.label}
              onClick={() => {
                item.action();
                setMenu(null);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
