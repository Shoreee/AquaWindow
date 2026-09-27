import { centroid, distance, type WindowState } from '@aquawindow/wm-kernel';
import { createProposal } from '../proposal.js';
import type { LayoutProposal, Policy, PolicyContext } from '../types.js';

function visible(windows: WindowState[]): WindowState[] {
  return windows.filter((w) => w.status !== 'minimized');
}

function related(a: WindowState, b: WindowState): boolean {
  return a.semanticTags.some((t) => b.semanticTags.includes(t));
}

function unpinned(w: WindowState): boolean {
  return !w.pinned;
}

export class RevealOccludedPolicy implements Policy {
  readonly id = 'reveal-occluded';

  propose(ctx: PolicyContext): LayoutProposal | null {
    const { observation } = ctx;
    const target = observation.occlusion.find((o) => o.visibleRatio < 0.25);
    if (!target) return null;
    const win = observation.windows.find((w) => w.id === target.id);
    if (!win || win.pinned) return null;
    const blockerId = target.occludedBy.at(-1);
    const blocker = observation.windows.find((w) => w.id === blockerId);
    if (!blocker || blocker.pinned) return null;
    const shift = Math.min(220, blocker.rect.width * 0.35);
    return createProposal(
      this.id,
      `Reveal “${win.title}” by sliding the covering window aside.`,
      [{ type: 'move', id: blocker.id, x: blocker.rect.x + shift, y: blocker.rect.y }],
      0.72,
    );
  }
}

export class FuseRelatedPolicy implements Policy {
  readonly id = 'fuse-related';

  propose(ctx: PolicyContext): LayoutProposal | null {
    const wins = visible(ctx.observation.windows);
    for (let i = 0; i < wins.length; i++) {
      for (let j = i + 1; j < wins.length; j++) {
        const a = wins[i]!;
        const b = wins[j]!;
        if (!related(a, b) || (a.groupId && a.groupId === b.groupId)) continue;
        const gap = distance(centroid(a.rect), centroid(b.rect));
        if (gap < 420 && unpinned(a) && unpinned(b)) {
          return createProposal(this.id, `Fuse related windows “${a.title}” and “${b.title}”.`, [
            { type: 'fuse', ids: [a.id, b.id] },
          ]);
        }
      }
    }
    return null;
  }
}

export class RecedeGuidePolicy implements Policy {
  readonly id = 'recede-guide';

  propose(ctx: PolicyContext): LayoutProposal | null {
    const cmd = ctx.observation.lastUserCommand;
    if (!cmd || (cmd.type !== 'focus' && cmd.type !== 'move')) return null;
    const guides = ctx.observation.windows.filter((w) => w.semanticTags.includes('guide') && w.depth === 0);
    if (!guides.length) return null;
    return createProposal(
      this.id,
      'The learner is acting — sink the tutorial to the attention periphery.',
      guides.map((g) => ({ type: 'setDepth', id: g.id, depth: 1 as const })),
      0.64,
    );
  }
}

export class MeetingSpeakerPolicy implements Policy {
  readonly id = 'meeting-speaker';

  propose(ctx: PolicyContext): LayoutProposal | null {
    const speaker = ctx.observation.windows.find((w) => w.semanticTags.includes('speaker') && w.status !== 'minimized');
    const share = ctx.observation.windows.find((w) => w.semanticTags.includes('share') && w.status !== 'minimized');
    if (!speaker || !share) return null;
    const notes = ctx.observation.windows.find((w) => w.semanticTags.includes('minutes'));
    const commands = [];
    if (!share.pinned) {
      commands.push({ type: 'pin' as const, id: share.id, pinned: true });
    }
    const targetX = share.rect.x + share.rect.width - speaker.rect.width - 16;
    const targetY = share.rect.y + 16;
    if (Math.abs(speaker.rect.x - targetX) > 24 || Math.abs(speaker.rect.y - targetY) > 24) {
      commands.push({ type: 'move' as const, id: speaker.id, x: targetX, y: targetY });
    }
    if (notes && !notes.groupId) {
      commands.push({ type: 'fuse' as const, ids: [share.id, notes.id] });
    }
    if (!commands.length) return null;
    return createProposal(this.id, 'Keep the shared canvas icy and dock the speaker + minutes beside it.', commands, 0.7);
  }
}

export class DesignPeripheryPolicy implements Policy {
  readonly id = 'design-periphery';

  propose(ctx: PolicyContext): LayoutProposal | null {
    const canvas = ctx.observation.windows.find((w) => w.semanticTags.includes('canvas') && w.status !== 'minimized');
    if (!canvas) return null;
    const refs = ctx.observation.windows.filter((w) => w.semanticTags.includes('reference') && w.status !== 'minimized');
    if (refs.length < 2) return null;
    const commands = refs.flatMap((r, i) => {
      const x = canvas.rect.x + canvas.rect.width + 12;
      const y = canvas.rect.y + i * 120;
      return [
        { type: 'setDepth' as const, id: r.id, depth: 1 as const },
        { type: 'move' as const, id: r.id, x, y },
      ];
    });
    if (refs[0] && refs[1] && !refs[0].groupId) {
      commands.push({ type: 'fuse', ids: refs.map((r) => r.id) });
    }
    return createProposal(this.id, 'Park references as a peripheral cluster so the canvas stays clear.', commands, 0.68);
  }
}

export class CompositeRulePolicy implements Policy {
  readonly id = 'rules-composite';
  private readonly policies: Policy[];

  constructor(policies: Policy[] = [
    new MeetingSpeakerPolicy(),
    new RecedeGuidePolicy(),
    new DesignPeripheryPolicy(),
    new RevealOccludedPolicy(),
    new FuseRelatedPolicy(),
  ]) {
    this.policies = policies;
  }

  propose(ctx: PolicyContext): LayoutProposal | null {
    if (ctx.observation.autonomy === 'off') return null;
    if (ctx.stabilityUsed >= ctx.stabilityBudget) return null;
    for (const p of this.policies) {
      const proposal = p.propose(ctx);
      if (proposal) return proposal;
    }
    return null;
  }
}
