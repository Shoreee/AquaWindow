import type { LayoutProposal } from '@aquawindow/agent-sdk';
import type { WindowState } from '@aquawindow/wm-kernel';
import { acceptPartial, acceptProposal, rejectProposal } from '../runtime.js';

interface Props {
  proposal: LayoutProposal | null;
  windows: WindowState[];
  autonomy: string;
}

export function GhostLayer({ proposal, windows, autonomy }: Props) {
  if (!proposal || autonomy === 'off' || autonomy === 'auto-with-undo') return null;

  const ghosts = proposal.commands.flatMap((c) => {
    if (c.type !== 'move' && c.type !== 'resize') return [];
    const live = windows.find((w) => w.id === ('id' in c ? c.id : ''));
    if (!live) return [];
    const rect = c.type === 'resize' ? c.rect : { ...live.rect, x: c.x, y: c.y };
    return [{ id: live.id, title: live.title, rect }];
  });

  return (
    <>
      {ghosts.map((g) => (
        <div
          key={g.id}
          className="aw-window ghost"
          style={{ left: g.rect.x, top: g.rect.y, width: g.rect.width, height: g.rect.height, zIndex: 60 }}
        >
          <div className="aw-chrome">
            <div className="aw-title">ghost · {g.title}</div>
          </div>
        </div>
      ))}
      <aside className="aw-ghostbar">
        <strong>Agent proposal</strong>
        <p>{proposal.rationale}</p>
        <small>
          {proposal.policyId} · confidence {(proposal.confidence * 100).toFixed(0)}%
        </small>
        <menu>
          <button onClick={acceptProposal}>Accept all</button>
          <button className="ghost" onClick={() => acceptPartial(proposal.affectedIds.slice(0, 1))}>
            Accept first
          </button>
          <button className="ghost" onClick={rejectProposal}>
            Reject
          </button>
        </menu>
      </aside>
    </>
  );
}
