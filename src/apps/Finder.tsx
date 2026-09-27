import { useEffect, useMemo, useRef, useState } from 'react';
import type { WindowState } from '../kernel/types';
import { useStore } from '../system/createStore';
import { bus, kernel, ui } from '../system';
import { AGENT_FILES, FOLDERS, FS, type FsEntry } from './data/fs';
import { paperById } from './data/papers';
import { appState } from './state';
import { openNear } from './open';

const KIND_ICON: Record<FsEntry['kind'], string> = {
  pdf: '📄',
  image: '🖼',
  code: '⌨︎',
  doc: '📝',
  archive: '🗜',
  folder: '📁',
  log: '🧾',
  app: '💿',
};

function haystack(e: FsEntry) {
  const p = e.paperId ? paperById(e.paperId) : null;
  return [p?.title, p?.abstract, p?.keywords.join(' '), e.provenance?.context, e.provenance?.task, e.agent?.note].filter(Boolean).join(' ').toLowerCase();
}

export default function Finder({ win }: { win: WindowState }) {
  const tech = useStore(ui, (s) => s.tech);
  const created = useStore(appState, (s) => s.agentFilesCreated);
  const quarantined = useStore(appState, (s) => s.quarantined);
  const kept = useStore(appState, (s) => s.kept);
  const path = String(win.props.path ?? 'Downloads');
  const footprint = win.props.view === 'footprint';
  const selected = win.props.selected as string | undefined;
  const [q, setQ] = useState('');
  const [groupByTask, setGroupByTask] = useState(false);
  const searchTimer = useRef<number | null>(null);

  const agentMade = AGENT_FILES.slice(0, created);
  const entries = useMemo(() => {
    const all = [...FS, ...agentMade].filter((e) => !quarantined.includes(e.name));
    if (footprint) return agentMade;
    if (path === 'Recents') return [...all].filter((e) => e.kind !== 'folder').sort((a, b) => a.age - b.age).slice(0, 14);
    if (q) return all.filter((e) => e.dir === path || e.dir.startsWith(path + '/'));
    const inDir = all.filter((e) => e.dir === path);
    const childDirs = new Set(
      all
        .map((e) => e.dir)
        .filter((d) => d.startsWith(path + '/'))
        .map((d) => d.slice(path.length + 1).split('/')[0]),
    );
    const implicit: FsEntry[] = [...childDirs]
      .filter((n) => !inDir.some((e) => e.kind === 'folder' && e.name === n))
      .map((n) => ({ name: n, dir: path, kind: 'folder', size: '—', modified: 'Today', age: 0 }));
    return [...inDir, ...implicit].sort((a, b) => (a.kind === 'folder' ? 0 : 1) - (b.kind === 'folder' ? 0 : 1));
  }, [path, footprint, agentMade, quarantined, q]);

  const nameMatch = (e: FsEntry) => e.name.toLowerCase().includes(q.toLowerCase());
  const semMatch = (e: FsEntry) => haystack(e).includes(q.toLowerCase());
  const shown = q ? entries.filter((e) => nameMatch(e) || (tech.semanticFiles && semMatch(e))) : entries;

  useEffect(() => {
    if (!q || q.length < 3) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => {
      bus.emit({
        type: 'files.search',
        windowId: win.id,
        data: { query: q, nameHits: entries.filter(nameMatch).length, semanticHits: entries.filter(semMatch).length, path },
      });
    }, 700);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, path]);

  const openEntry = (e: FsEntry) => {
    bus.emit({ type: 'files.open', windowId: win.id, data: { name: e.name, paperId: e.paperId } });
    if (e.kind === 'folder') {
      kernel.setProps(win.id, { path: `${e.dir}/${e.name}` });
      kernel.setTitle(win.id, e.name);
      return;
    }
    if (e.kind === 'pdf' && e.paperId) {
      openNear(win, { appId: 'preview', title: e.name, props: { paperId: e.paperId }, role: 'reference', size: { w: 620, h: 700 } });
    } else if (e.kind === 'code' || e.kind === 'log' || e.kind === 'doc') {
      openNear(win, { appId: 'code', title: e.name, props: { file: e.name, dir: e.dir }, role: 'reference', size: { w: 560, h: 440 } });
    }
  };

  const groups = useMemo(() => {
    if (!groupByTask || !tech.provenance) return [{ label: '', items: shown }];
    const m = new Map<string, FsEntry[]>();
    shown.forEach((e) => {
      const k = e.agent ? `Made by ${e.agent.session}` : e.provenance?.task ?? 'No known task';
      m.set(k, [...(m.get(k) ?? []), e]);
    });
    return [...m.entries()].map(([label, items]) => ({ label, items }));
  }, [shown, groupByTask, tech.provenance]);

  return (
    <div className="finder">
      <aside className="finder-side">
        <div className="side-h">Favorites</div>
        {FOLDERS.map((f) => (
          <button
            key={f}
            className={`side-i ${!footprint && path === f ? 'on' : ''}`}
            onClick={() => {
              kernel.setProps(win.id, { path: f, view: undefined });
              kernel.setTitle(win.id, f.split('/').pop()!);
            }}
          >
            <span className="side-ic">{f === 'Downloads' ? '⬇︎' : f === 'Recents' ? '🕘' : f.startsWith('Projects') ? '🧪' : '📁'}</span>
            {f.split('/').pop()}
          </button>
        ))}
        {tech.provenance && (
          <>
            <div className="side-h">Provenance</div>
            <button className={`side-i ${footprint ? 'on' : ''}`} onClick={() => kernel.setProps(win.id, { view: 'footprint' })}>
              <span className="side-ic">🤖</span>Agent footprint
              {created > 0 && <span className="badge">{created}</span>}
            </button>
          </>
        )}
      </aside>
      <section className="finder-main">
        <div className="finder-bar">
          <button
            className="nav-btn"
            disabled={footprint ? false : !path.includes('/') || path === 'Projects/aqua-agent'}
            onClick={() => {
              if (footprint) return kernel.setProps(win.id, { view: undefined });
              const parent = path.split('/').slice(0, -1).join('/');
              kernel.setProps(win.id, { path: parent });
              kernel.setTitle(win.id, parent.split('/').pop()!);
            }}
          >
            ‹
          </button>
          <div className="finder-path">{footprint ? 'Agent footprint · claude-code session 17' : path}</div>
          {tech.provenance && !footprint && (
            <button className={`chip ${groupByTask ? 'on' : ''}`} onClick={() => setGroupByTask((g) => !g)}>
              Group by task
            </button>
          )}
          <input className="finder-search" placeholder={tech.semanticFiles ? 'Search names, titles, why…' : 'Search'} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {tech.semanticFiles && !footprint && <div className="lens-note">Semantic lens on — opaque names are resolved to titles, and each file shows where it came from.</div>}
        <div className="finder-head">
          <span>Name</span>
          <span>{footprint ? 'Created by' : tech.provenance ? 'Came from' : 'Date Modified'}</span>
          <span>{footprint ? 'Action' : 'Size'}</span>
        </div>
        <div className="finder-list">
          {groups.map((g) => (
            <div key={g.label || 'all'}>
              {g.label && <div className="finder-group">{g.label}</div>}
              {g.items.map((e) => {
                const paper = e.paperId ? paperById(e.paperId) : null;
                return (
                  <div
                    key={e.dir + e.name}
                    className={`finder-row ${selected === e.name ? 'sel' : ''} ${e.agent ? 'agent' : ''} ${kept.includes(e.name) ? 'kept' : ''}`}
                    onDoubleClick={() => openEntry(e)}
                    onClick={() => kernel.setProps(win.id, { selected: e.name })}
                    onMouseEnter={() => tech.provenance && bus.emit({ type: 'files.hover', windowId: win.id, data: { name: e.name, logLine: e.agent?.logLine } })}
                  >
                    <span className="fname">
                      <span className="ficon">{KIND_ICON[e.kind]}</span>
                      {tech.semanticFiles && paper ? (
                        <span className="fsem">
                          <b>{paper.title}</b>
                          <small>{e.name}</small>
                        </span>
                      ) : (
                        <span className="ftext">
                          {e.name}
                          {footprint && <small>{e.dir.replace('Projects/aqua-agent', '.')}/</small>}
                        </span>
                      )}
                      {e.agent && tech.provenance && <span className="agent-badge">agent</span>}
                      {e.agent?.duplicateOf && tech.provenance && <span className="dup-badge">≈ {e.agent.duplicateOf}</span>}
                    </span>
                    <span className="fmeta">
                      {footprint ? (
                        <>
                          log line {e.agent?.logLine} · <i>{e.agent?.note}</i>
                        </>
                      ) : tech.provenance && (e.provenance || e.agent) ? (
                        e.agent ? <i>{e.agent.note}</i> : <>{e.provenance?.context}</>
                      ) : (
                        e.modified
                      )}
                    </span>
                    <span className="fsize">
                      {footprint ? (
                        <span className="row-actions">
                          <button onClick={(ev) => { ev.stopPropagation(); appState.set((s) => ({ kept: [...s.kept, e.name] })); }}>Keep</button>
                          <button onClick={(ev) => { ev.stopPropagation(); appState.set((s) => ({ quarantined: [...s.quarantined, e.name] })); }}>Quarantine</button>
                          <button onClick={(ev) => { ev.stopPropagation(); openEntry(e); }}>Open</button>
                        </span>
                      ) : (
                        e.size
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
          {shown.length === 0 && <div className="empty">No items{q ? ` matching “${q}”` : ''}</div>}
        </div>
        <div className="finder-status">
          {shown.length} items{footprint && quarantined.length ? ` · ${quarantined.length} quarantined` : ''}
        </div>
      </section>
    </div>
  );
}
