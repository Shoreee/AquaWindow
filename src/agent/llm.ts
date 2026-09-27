import type { LayoutChange } from '../kernel/types';
import { observationToPrompt } from './observe';
import type { Observation, Policy, PreferenceMemory, ProposalDraft } from './types';

/**
 * LLM / VLM policy adapter — the hand-over point for later work.
 *
 * It speaks the same Policy protocol as the rule agent. Point VITE_AGENT_ENDPOINT at any
 * HTTP service that accepts { system, observation, preferences } and returns
 * { proposals: ProposalDraft[] }. A VLM backend can additionally request a screenshot of the
 * desktop (captured client-side) — the observation already carries semantic geometry, so the
 * image is for content the apps cannot describe.
 *
 * Every returned proposal is validated: unknown windows are dropped, rects are clamped, and
 * nothing is ever applied without passing through the same autonomy gate as rules.
 */
export const SYSTEM_PROMPT = `You are the layout agent of AquaWindow, a research desktop.
You never move windows directly. You propose at most ONE layout change per call as JSON:
{ "proposals": [ { "ruleId": string, "title": string, "rationale": string, "evidence": string[],
  "confidence": 0..1, "technique": string,
  "changes": [ { "windowId": string, "rect"?: {x,y,w,h}, "depth"?: 0..1, "form"?: "normal"|"capsule",
                 "group"?: string|null, "focus"?: boolean } ] } ] }
Principles (mixed-initiative, Horvitz 1999; Amershi et al. 2019):
- Prefer the smallest change that resolves the user's current friction; never move the focused window unless asked.
- Preserve spatial memory: keep windows near where the user put them; keep left/right order.
- Keep aspect ratios; never create slivers narrower than 240 px.
- Use depth (recede) or capsule (periphery) before minimising — keep things glanceable.
- Fuse (group) windows only when they are semantically one unit (speaker+slides, paper+notes).
- Explain in one or two sentences grounded in observed behaviour, not in geometry alone.
- If recent proposals of a ruleId were rejected, do not repeat them.
Return {"proposals": []} when nothing is worth interrupting for.`;

export class LlmPolicy implements Policy {
  id = 'llm';
  label = 'LLM / VLM policy (remote)';
  endpoint = (import.meta.env.VITE_AGENT_ENDPOINT as string | undefined) ?? '';
  private inflight = false;
  private lastCall = 0;
  minIntervalMs = 6000;

  get available() {
    return !!this.endpoint;
  }

  async propose(obs: Observation, mem: PreferenceMemory): Promise<ProposalDraft[]> {
    if (!this.endpoint || this.inflight || obs.t - this.lastCall < this.minIntervalMs) return [];
    this.inflight = true;
    this.lastCall = obs.t;
    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          system: SYSTEM_PROMPT,
          observation: observationToPrompt(obs),
          preferences: Object.fromEntries(Object.entries(mem.rules).map(([k, v]) => [k, { accepts: v.accepts, rejects: v.rejects }])),
        }),
      });
      if (!res.ok) return [];
      const json = (await res.json()) as { proposals?: ProposalDraft[] };
      return (json.proposals ?? []).map((p) => validate(p, obs)).filter((p): p is ProposalDraft => !!p);
    } catch {
      return [];
    } finally {
      this.inflight = false;
    }
  }
}

function validate(p: ProposalDraft, obs: Observation): ProposalDraft | null {
  if (!p || !Array.isArray(p.changes)) return null;
  const ids = new Set(obs.windows.map((w) => w.id));
  const W = obs.work;
  const changes: LayoutChange[] = p.changes
    .filter((c) => ids.has(c.windowId))
    .map((c) => ({
      ...c,
      rect: c.rect
        ? {
            x: Math.max(W.x, Math.min(c.rect.x, W.x + W.w - 240)),
            y: Math.max(W.y, Math.min(c.rect.y, W.y + W.h - 160)),
            w: Math.max(240, Math.min(c.rect.w, W.w)),
            h: Math.max(160, Math.min(c.rect.h, W.h)),
          }
        : undefined,
      depth: c.depth === undefined ? undefined : Math.max(0, Math.min(1, c.depth)),
    }));
  if (!changes.length) return null;
  return {
    ruleId: `llm:${p.ruleId ?? 'free'}`,
    title: String(p.title ?? 'Layout suggestion'),
    rationale: String(p.rationale ?? ''),
    evidence: Array.isArray(p.evidence) ? p.evidence.map(String).slice(0, 4) : [],
    confidence: Math.max(0, Math.min(1, Number(p.confidence ?? 0.5))),
    technique: String(p.technique ?? 'llm'),
    changes,
  };
}
