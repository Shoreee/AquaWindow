import { store } from '../runtime.js';
import { useShell } from '../hooks/useShell.js';

export function Timeline() {
  useShell();
  const entries = [...store.history.entries].slice(-8).reverse();

  return (
    <aside className="aw-timeline">
      <strong>Timeline</strong>
      <div style={{ display: 'flex', gap: 6, margin: '6px 0' }}>
        <button disabled={!store.history.canUndo} onClick={() => store.undo()}>
          Undo
        </button>
        <button disabled={!store.history.canRedo} onClick={() => store.redo()}>
          Redo
        </button>
      </div>
      <ol>
        {entries.map((e) => (
          <li key={e.id}>
            {e.source} · {e.command.type}
          </li>
        ))}
      </ol>
    </aside>
  );
}
