import { useEffect, useRef, useState } from 'react';
import type { WindowState } from '../kernel/types';
import { useStore } from '../system/createStore';
import { bus, kernel, ui } from '../system';
import { AGENT_FILES, CODE } from './data/fs';
import { appState } from './state';
import { openNear } from './open';

/** The agent log. Lines with a file index are the moments the coding agent created a file. */
export const AGENT_LOG: { text: string; file?: number; kind?: 'user' | 'agent' | 'tool' | 'ok' }[] = [
  { text: '> add a date-parsing helper and use it in app.py', kind: 'user' },
  { text: '● Reading src/utils.py, src/app.py', kind: 'agent' },
  { text: '● I will refactor utils into a v2 module first.', kind: 'agent' },
  { text: '  Write(src/utils_v2.py)', file: 0, kind: 'tool' },
  { text: '  Bash(python -m pytest -q)  → 2 failed', kind: 'tool' },
  { text: '  Write(tmp_debug_3.log)', file: 1, kind: 'tool' },
  { text: '● Import cycle. Moving helpers into a subpackage.', kind: 'agent' },
  { text: '  Bash(mkdir -p src/helpers)', kind: 'tool' },
  { text: '  Write(src/helpers/utils_v2_final.py)  +parse_date()', file: 2, kind: 'tool' },
  { text: '  Edit(src/app.py)  import from helpers', kind: 'tool' },
  { text: '  Write(scripts/fix_imports_backup.sh)', file: 3, kind: 'tool' },
  { text: '  Bash(sh scripts/fix_imports_backup.sh)', kind: 'tool' },
  { text: '  Write(tests/test_utils_copy.py)', file: 4, kind: 'tool' },
  { text: '  Write(web/components/Button.old.tsx)  backup', file: 5, kind: 'tool' },
  { text: '  Bash(python -m pytest -q)  → 14 passed', kind: 'ok' },
  { text: '  Write(.cache/agent/run-17.json)', file: 6, kind: 'tool' },
  { text: '● Updating docs to reflect the new layout.', kind: 'agent' },
  { text: '  Write(docs/ARCHITECTURE_NEW.md)', file: 7, kind: 'tool' },
  { text: '✓ Done. parse_date() is available and app.py uses it.', kind: 'ok' },
];

export const LOG_INTERVAL = 1.1;

export default function Terminal({ win }: { win: WindowState }) {
  const created = useStore(appState, (s) => s.agentFilesCreated);
  const provenance = useStore(ui, (s) => s.tech.provenance);
  const [hoverLine, setHoverLine] = useState<number | null>(null);
  const lines = useStore(appState, (s) => s.logLine);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [lines]);
  useEffect(
    () =>
      bus.on((e) => {
        if (e.type === 'files.hover') setHoverLine((e.data?.logLine as number) ?? null);
      }),
    [],
  );

  return (
    <div className="terminal">
      <div className="term-head">~/Projects/aqua-agent — claude-code · session 17 · {created} files written</div>
      <div className="term-body">
        {AGENT_LOG.slice(0, lines).map((l, i) => {
          const f = l.file !== undefined ? AGENT_FILES[l.file] : null;
          return (
            <div
              key={i}
              className={`tl ${l.kind ?? ''} ${f && provenance ? 'linked' : ''} ${hoverLine === i ? 'hl' : ''}`}
              onClick={() => {
                if (!f || !provenance) return;
                openNear(win, { appId: 'finder', title: f.dir.split('/').pop()!, props: { path: f.dir, selected: f.name }, role: 'tool', size: { w: 640, h: 420 } });
              }}
            >
              {l.text}
              {f && provenance && <span className="tl-reveal">reveal ↗</span>}
            </div>
          );
        })}
        <div ref={endRef} className="caret">▍</div>
      </div>
    </div>
  );
}

export function Code({ win }: { win: WindowState }) {
  const file = String(win.props.file ?? '');
  const src = CODE[file] ?? `# ${file}\n# (${String(win.props.dir ?? '')})\n# generated content not shown in this mock\n`;
  const hl = (line: string) =>
    line
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/(#.*)$/, '<i>$1</i>')
      .replace(/\b(def|from|import|return|for|in|try|except|raise|continue)\b/g, '<b>$1</b>')
      .replace(/("[^"]*")/g, '<u>$1</u>');
  return (
    <div className="code">
      <div className="code-head">
        {String(win.props.dir ?? '')}/{file}
        <button className="chip" onClick={() => kernel.close(win.id)}>close</button>
      </div>
      <pre>
        {src.split('\n').map((l, i) => (
          <div key={i}>
            <span className="ln">{i + 1}</span>
            <span dangerouslySetInnerHTML={{ __html: hl(l) || ' ' }} />
          </div>
        ))}
      </pre>
    </div>
  );
}
