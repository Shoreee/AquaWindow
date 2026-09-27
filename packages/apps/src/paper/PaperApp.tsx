import { useState } from 'react';

const CITATIONS: Record<string, { title: string; note: string }> = {
  '12': {
    title: 'Kandogan & Shneiderman, Elastic Windows, CHI 1997',
    note: 'Hierarchical tiled groups. Rigid borders. No agent.',
  },
  '18': {
    title: 'Scott, Carpendale & Inkpen, Territoriality, CSCW 2004',
    note: 'Personal / group / storage territories on tabletops.',
  },
  '24': {
    title: 'Horvitz, Mixed-Initiative User Interfaces, CHI 1999',
    note: 'Value of perfect information; feedforward before commit.',
  },
};

export function PaperApp() {
  const [cite, setCite] = useState<string | null>(null);
  const ref = cite ? CITATIONS[cite] : null;

  return (
    <div className="aw-app aw-paper">
      <article>
        <p className="aw-kicker">CHI ’27 · Systems</p>
        <h1>Negotiable Boundaries: Fluid Territories for Agent-Era Window Management</h1>
        <p className="aw-authors">Anonymous for review</p>
        <h2>Abstract</h2>
        <p>
          Overlapping windows have served knowledge work for four decades, but an agent that
          rearranges rectangles without warning destroys spatial memory. We propose treating the
          window <em>boundary itself</em> as a continuously negotiable medium — fluid enough to fuse
          and compress, regular enough (superellipse, not freeform) that users keep a model of
          space.
        </p>
        <h2>1 Introduction</h2>
        <p>
          Classic window managers force a binary: overlap and hide, or tile and surrender placement.
          Elastic Windows
          <button className="aw-cite" onClick={() => setCite('12')}>
            [12]
          </button>{' '}
          improved group operations but kept rigid tiles. Mixed-initiative principles
          <button className="aw-cite" onClick={() => setCite('24')}>
            [24]
          </button>{' '}
          ask for feedforward. Tabletop territoriality
          <button className="aw-cite" onClick={() => setCite('18')}>
            [18]
          </button>{' '}
          suggests users will defend “ice” they own.
        </p>
        <h2>2 Related work</h2>
        <p>
          Recent XR systems (SemanticAdapt, AUIT, SituationAdapt, DuoZone, AutoOptimization) still
          place rigid panels. PC desktops — where writing, coding, and design still happen — remain
          under-served.
        </p>
      </article>
      {ref && (
        <aside className="aw-droplet">
          <header>
            Citation droplet
            <button onClick={() => setCite(null)}>close</button>
          </header>
          <strong>{ref.title}</strong>
          <p>{ref.note}</p>
        </aside>
      )}
    </div>
  );
}

export function NotesApp() {
  const [text, setText] = useState('— Elastic Windows = rigid tiles\n— Need feedforward ghosts\n');
  return (
    <div className="aw-app aw-notes">
      <h3>Reading notes</h3>
      <textarea value={text} onChange={(e) => setText(e.target.value)} />
    </div>
  );
}

export function TranslateApp() {
  return (
    <div className="aw-app aw-translate">
      <h3>Translate · EN → ZH</h3>
      <p className="aw-muted">We propose treating the window boundary itself as a continuously negotiable medium.</p>
      <p>我们主张把窗口边界本身当作一种可连续协商的介质。</p>
    </div>
  );
}
