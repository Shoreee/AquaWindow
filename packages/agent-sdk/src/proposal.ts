import type { WindowCommand } from '@aquawindow/wm-kernel';
import type { LayoutProposal } from './types.js';

export function createProposal(
  policyId: string,
  rationale: string,
  commands: WindowCommand[],
  confidence = 0.7,
): LayoutProposal {
  const affected = new Set<string>();
  collectIds(commands, affected);
  return {
    id: makeId(),
    createdAt: Date.now(),
    policyId,
    rationale,
    confidence,
    commands,
    affectedIds: [...affected],
  };
}

function collectIds(commands: WindowCommand[], into: Set<string>): void {
  for (const c of commands) {
    if (c.type === 'batch') collectIds(c.commands, into);
    else if (c.type === 'fuse') c.ids.forEach((id) => into.add(id));
    else if (c.type === 'open') {
      if (c.window.id) into.add(c.window.id);
    } else if ('id' in c) into.add(c.id);
  }
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `p-${Math.random().toString(36).slice(2, 10)}`;
}
