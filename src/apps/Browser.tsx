import type { ReactNode } from 'react';
import type { WindowState } from '../kernel/types';
import { useStore } from '../system/createStore';
import { bus, kernel, ui } from '../system';
import { openInTrail, rerankTrail } from '../techniques/trail';
import { wikiById } from './data/wiki';
import { defaultImportance } from './importance';

function renderBody(text: string, onLink: (id: string) => void): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\[\[([a-z-]+)\|([^\]]+)\]\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const id = m[1];
    out.push(
      <a key={m.index} href="#" onClick={(e) => { e.preventDefault(); onLink(id); }}>
        {m[2]}
      </a>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function Browser({ win, peripheral }: { win: WindowState; peripheral?: boolean }) {
  const mode = useStore(ui, (s) => s.tech.wikiTrail);
  const tabs = (win.props.tabs as string[] | undefined) ?? [String(win.props.pageId ?? 'window-management')];
  const active = Math.min(Number(win.props.active ?? 0), tabs.length - 1);
  const page = wikiById(tabs[active]);

  const navigate = (id: string) => {
    win = kernel.get(win.id) ?? win;
    const target = wikiById(id);
    bus.emit({ type: 'wiki.navigate', windowId: win.id, data: { from: page.id, to: id, mode } });
    if (mode === 'tabs') {
      kernel.setProps(win.id, { tabs: [...tabs, id], active: tabs.length });
      kernel.setTitle(win.id, target.title);
    } else if (mode === 'windows') {
      kernel.open({
        appId: 'browser',
        title: target.title,
        rect: { ...win.rect, x: win.rect.x + 30, y: win.rect.y + 26 },
        role: win.role,
        props: { pageId: id },
        openedFrom: win.id,
        importance: defaultImportance('browser'),
      });
    } else {
      openInTrail(kernel, win, { title: target.title, props: { pageId: id } });
    }
  };

  const back = () => {
    if (mode === 'tabs' && tabs.length > 1) {
      const nt = tabs.slice(0, active).concat(tabs.slice(active + 1));
      kernel.setProps(win.id, { tabs: nt, active: Math.max(0, active - 1) });
      return;
    }
    const parent = win.openedFrom ? kernel.get(win.openedFrom) : undefined;
    if (!parent) return;
    if (mode === 'depth' && win.group) rerankTrail(kernel, win.group, parent.id, 'trail:back');
    else kernel.focus(parent.id);
  };

  if (peripheral) return <div className="br-peri">{page.title}</div>;

  return (
    <div className="browser" style={{ ['--hue' as string]: page.hue }}>
      <div className="br-tabs">
        {tabs.map((t, i) => (
          <div
            key={i + t}
            className={`br-tab ${i === active ? 'on' : ''}`}
            onClick={() => {
              kernel.setProps(win.id, { active: i });
              kernel.setTitle(win.id, wikiById(t).title);
            }}
          >
            {wikiById(t).title}
          </div>
        ))}
      </div>
      <div className="br-bar">
        <button className="nav-btn" onClick={back}>‹</button>
        <div className="br-url">
          <span className="lock">🔒</span> wiki.aqua/{page.id}
        </div>
        {mode === 'depth' && win.group && <span className="trail-chip" title="⌥+scroll to walk the trail · hold Space to see through">trail</span>}
      </div>
      <article className="br-article">
        <div className="br-hero" />
        <h1>{page.title}</h1>
        <p className="lead">{page.lead}</p>
        {page.body.map((b, i) => (
          <p key={i}>{renderBody(b, navigate)}</p>
        ))}
      </article>
    </div>
  );
}
