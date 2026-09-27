import { useMemo, useState } from 'react';

interface FileNode {
  name: string;
  kind: 'folder' | 'file';
  tag?: string;
  children?: FileNode[];
}

const TREE: FileNode = {
  name: 'Macintosh HD',
  kind: 'folder',
  children: [
    {
      name: 'Desktop',
      kind: 'folder',
      children: [
        { name: 'CHI-draft.pdf', kind: 'file', tag: 'target' },
        { name: 'Screenshot 2026-09-12.png', kind: 'file' },
        { name: 'notes.txt', kind: 'file' },
      ],
    },
    {
      name: 'Documents',
      kind: 'folder',
      children: [
        {
          name: 'Submission',
          kind: 'folder',
          tag: 'drop',
          children: [{ name: 'checklist.md', kind: 'file' }],
        },
        { name: 'Archive', kind: 'folder', children: [] },
      ],
    },
  ],
};

export function FinderApp({ variant }: { windowId: string; variant?: 'desktop' | 'submission' }) {
  const initial = variant === 'submission' ? ['Macintosh HD', 'Documents', 'Submission'] : ['Macintosh HD', 'Desktop'];
  const [path, setPath] = useState<string[]>(initial);
  const [selected, setSelected] = useState<string | null>(null);
  const [inbox, setInbox] = useState<string[]>([]);

  const node = useMemo(() => walk(TREE, path), [path]);
  const items = [...(node?.children ?? []), ...inbox.map((name) => ({ name, kind: 'file' as const }))];

  function enter(item: FileNode) {
    if (item.kind === 'folder') {
      setPath((p) => [...p, item.name]);
      setSelected(null);
    } else {
      setSelected(item.name);
    }
  }

  function dropTarget() {
    if (path.includes('Submission') && !inbox.includes('CHI-draft.pdf')) {
      setInbox((x) => [...x, 'CHI-draft.pdf']);
    }
  }

  return (
    <div className="aw-app aw-finder">
      <aside>
        <p className="aw-sidebar-title">Favorites</p>
        {['Desktop', 'Documents', 'Submission'].map((name) => (
          <button
            key={name}
            className={path.includes(name) ? 'active' : ''}
            onClick={() => {
              if (name === 'Desktop') setPath(['Macintosh HD', 'Desktop']);
              if (name === 'Documents') setPath(['Macintosh HD', 'Documents']);
              if (name === 'Submission') setPath(['Macintosh HD', 'Documents', 'Submission']);
            }}
          >
            {name === 'Desktop' ? '🖥' : name === 'Submission' ? '📬' : '📁'} {name}
          </button>
        ))}
      </aside>
      <section
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          dropTarget();
        }}
      >
        <header className="aw-finder-path">
          {path.map((p, i) => (
            <button key={p} onClick={() => setPath(path.slice(0, i + 1))}>
              {p}
              {i < path.length - 1 ? ' › ' : ''}
            </button>
          ))}
        </header>
        <div className="aw-icon-grid">
          {items.map((item) => (
            <button
              key={item.name}
              draggable={item.name === 'CHI-draft.pdf'}
              onDragStart={(e) => e.dataTransfer.setData('text/plain', item.name)}
              className={`aw-icon ${selected === item.name ? 'selected' : ''} ${item.tag === 'drop' ? 'drop-target' : ''}`}
              onDoubleClick={() => enter(item)}
              onClick={() => setSelected(item.name)}
            >
              <span className="glyph">{item.kind === 'folder' ? '📁' : item.name.endsWith('.pdf') ? '📄' : '📝'}</span>
              <span>{item.name}</span>
            </button>
          ))}
        </div>
        {path.includes('Submission') && (
          <p className="aw-hint">Drop CHI-draft.pdf here — the fluid field should part covering windows.</p>
        )}
      </section>
    </div>
  );
}

function walk(root: FileNode, path: string[]): FileNode | undefined {
  let node: FileNode | undefined = root;
  for (const name of path.slice(1)) {
    node = node?.children?.find((c) => c.name === name);
  }
  return path[0] === root.name ? node : root;
}
