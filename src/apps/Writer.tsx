import { useRef } from 'react';
import type { WindowState } from '../kernel/types';
import { bus } from '../system';

const DOCS: Record<string, { title: string; html: string; goal?: string[] }> = {
  draft: {
    title: 'CHI ’27 draft — Negotiable Boundaries',
    goal: ['41.2', '57.9'],
    html: `<h2>2 Related Work</h2>
<p>Overlapping windows remain the dominant desktop metaphor because they preserve spatial memory, yet they make occlusion the user's problem. Peeling back windows made occlusion temporary; importance-driven compositing let important regions shine through unimportant parts of occluders.</p>
<p class="todo">Most relevant, <i>Foveated Compositing</i> [Aalto et al.] reports that glance tasks took <mark>[TODO: X s]</mark> with foveated compositing versus <mark>[TODO: Y s]</mark> with overlapping windows (their Table 2). We build on this but let boundaries deform continuously, and let an agent negotiate them.</p>
<p>Optimisation-based adaptive UIs produce layouts that are optimal on paper and alien in practice; mixed-initiative principles suggest instead that the system should propose, preview and yield.</p>
<h2>3 Concept</h2>
<p>We treat each window as a <b>fluid territory</b> whose boundary is the medium of negotiation…</p>`,
  },
  notes: {
    title: 'Lab meeting notes',
    html: `<h2>Lab meeting · Q3 study plan</h2>
<ul><li>Pilot done (6 people)</li><li></li></ul>
<h3>Action items</h3>
<ul><li>Review Kai's depth-trail PR</li><li></li></ul>`,
  },
};

export default function Writer({ win }: { win: WindowState }) {
  const doc = DOCS[String(win.props.docId ?? 'draft')] ?? DOCS.draft;
  const done = useRef(false);
  return (
    <div className="writer">
      <div className="writer-tools">
        <span className="wt-b">B</span>
        <span className="wt-i">I</span>
        <span className="wt-u">U</span>
        <span className="sep" />
        <span>Body ▾</span>
        <span>Charter 13 ▾</span>
        <span className="grow" />
        <span className="wc">autosaved</span>
      </div>
      <div className="writer-page">
        <div className="writer-title">{doc.title}</div>
        <div
          className="writer-body"
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          dangerouslySetInnerHTML={{ __html: doc.html }}
          onInput={(e) => {
            const text = (e.target as HTMLElement).innerText;
            if (doc.goal && !done.current && doc.goal.every((g) => text.includes(g))) {
              done.current = true;
              bus.emit({ type: 'task.done', windowId: win.id, data: { task: 'cite-numbers' } });
            }
          }}
        />
      </div>
    </div>
  );
}
