import { APP_CATALOG, DOCK_ITEMS } from '@aquawindow/apps';
import { useShell } from '../hooks/useShell.js';
import { openApp } from '../runtime.js';
import { store } from '../runtime.js';

export function Dock() {
  const { windows } = useShell();

  return (
    <nav className="aw-dock" aria-label="Dock">
      {DOCK_ITEMS.map((item) => {
        const app = APP_CATALOG.find((a) => a.id === item.id);
        const related = windows.filter((w) => w.appId === item.id || (app && w.title.startsWith(app.subtitle)));
        const open = windows.some((w) => w.appId === item.id || (app && w.semanticTags.includes(app.scenario)));
        return (
          <button
            key={item.id}
            title={item.label}
            onClick={() => {
              const mini = related.find((w) => w.status === 'minimized');
              if (mini) store.dispatch({ type: 'restore', id: mini.id });
              else openApp(item.id);
            }}
          >
            <span>{app?.icon ?? '◻️'}</span>
            {open && <i className="dot" />}
          </button>
        );
      })}
    </nav>
  );
}
