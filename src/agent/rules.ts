import { area, intersect, overlapArea } from '../kernel/geometry';
import type { LayoutChange, Rect } from '../kernel/types';
import { placeAvoiding } from './optimizer';
import type { Observation, Policy, PreferenceMemory, ProposalDraft, WindowSummary } from './types';

/**
 * Rule-based layout agent. Each rule reads *behaviour* (focus rhythm, app events) and
 * *semantics* (roles, importance regions) — not just geometry — and proposes a change
 * with a human-readable rationale. Rules are the transparent baseline an LLM/VLM policy
 * later replaces behind the same Policy interface.
 */
export interface Rule {
  id: string;
  label: string;
  technique: string;
  run(obs: Observation, mem: PreferenceMemory): ProposalDraft | null;
}

const vis = (o: Observation) => o.windows.filter((w) => !w.minimized);
const byId = (o: Observation, id: string | null | undefined) => o.windows.find((w) => w.id === id);
const sec = (ms: number) => Math.round(ms / 1000);

// ── 1. Glance dock ────────────────────────────────────────────────────────────
const glanceDock: Rule = {
  id: 'glance-dock',
  label: 'Glance → fused side pane',
  technique: 'fusion + periphery',
  run(o) {
    const hist = o.focusHistory.filter((f) => o.t - f.t < 60000);
    if (hist.length < 5) return null;
    // Look for A B A B A rhythm with short B visits.
    const last = hist.slice(-7);
    const ids = [...new Set(last.map((f) => f.id))];
    if (ids.length !== 2) return null;
    const a = byId(o, o.focusedId);
    if (!a) return null;
    const bId = ids.find((i) => i !== a.id);
    const b = byId(o, bId);
    if (!b || b.minimized || (a.group && a.group === b.group)) return null;
    if (a.role !== 'primary' && b.role !== 'reference') return null;
    let visitsB = 0;
    let shortB = 0;
    for (let i = 0; i < last.length; i++) {
      if (last[i].id !== b.id) continue;
      visitsB++;
      const next = last[i + 1];
      if (next && next.t - last[i].t < 9000) shortB++;
    }
    if (visitsB < 2 || shortB < 2) return null;
    const bw = Math.round(Math.min(Math.max(a.rect.w * 0.42, 340), 520));
    const bh = Math.round(Math.min(a.rect.h, Math.max(300, (b.rect.h / b.rect.w) * bw * 1.1)));
    const changes: LayoutChange[] = [];
    let aRect = { ...a.rect };
    let bRect: Rect;
    if (aRect.x + aRect.w + 14 + bw <= o.work.x + o.work.w) {
      bRect = { x: aRect.x + aRect.w + 14, y: aRect.y, w: bw, h: bh };
    } else if (aRect.x - 14 - bw >= o.work.x) {
      bRect = { x: aRect.x - 14 - bw, y: aRect.y, w: bw, h: bh };
    } else {
      const needed = aRect.x + aRect.w + 14 + bw - (o.work.x + o.work.w);
      const shift = Math.min(needed, aRect.x - o.work.x);
      aRect = { ...aRect, x: aRect.x - shift, w: Math.max(520, aRect.w - (needed - shift)) };
      bRect = { x: aRect.x + aRect.w + 14, y: aRect.y, w: o.work.x + o.work.w - (aRect.x + aRect.w + 14), h: bh };
      changes.push({ windowId: a.id, rect: aRect });
    }
    const group = `glance-${a.id}`;
    changes.push({ windowId: b.id, rect: bRect, group, depth: 0, form: 'normal', raise: true });
    changes.push({ windowId: a.id, group, focus: true, ...(changes[0]?.windowId === a.id ? { rect: aRect } : {}) });
    return {
      ruleId: this.id,
      title: `Dock “${b.title}” beside your ${a.title}`,
      rationale: `You returned to “${b.title}” ${visitsB}× in the last ${sec(o.t - last[0].t)} s, each time for only a few seconds. That rhythm reads as glancing, not task switching — so keep it in view as a fused side pane instead of stacking it behind.`,
      evidence: [`${visitsB} short visits`, `role(${b.title}) = ${b.role}`, `primary stays focused`],
      confidence: 0.62 + Math.min(0.25, (shortB - 2) * 0.08),
      technique: this.technique,
      changes: dedupe(changes),
      labels: { [b.id]: 'glance pane', [a.id]: 'keeps focus' },
    };
  },
};

function dedupe(changes: LayoutChange[]): LayoutChange[] {
  const m = new Map<string, LayoutChange>();
  for (const c of changes) m.set(c.windowId, { ...(m.get(c.windowId) ?? { windowId: c.windowId }), ...c });
  return [...m.values()];
}

// ── 2. Awareness periphery ────────────────────────────────────────────────────
const awarenessPeriphery: Rule = {
  id: 'awareness-periphery',
  label: 'Buried meeting → peripheral capsule',
  technique: 'periphery (Scalable Fabric-like)',
  run(o, mem) {
    const m = vis(o).find((w) => w.role === 'awareness' && w.appId === 'meeting' && w.form === 'normal' && !w.focused);
    const key = 'buriedSince';
    const scratch = (mem.scratch[this.id] ??= {}) as Record<string, number>;
    // "Buried" means the live meeting is no longer a reliable glance: partly covered
    // while the user works in another window. A fully visible meeting needs no help.
    if (!m || m.visibleFraction > 0.72) {
      delete scratch[key];
      return null;
    }
    scratch[key] ??= o.t;
    const buried = o.t - scratch[key];
    if (buried < 2800) return null;
    const share = vis(o).find((w) => w.appId === 'share' && w.form === 'normal');
    const focused = byId(o, o.focusedId);
    const shareBlocks = !!share && !!focused && overlapArea(share.vis, focused.rect) > 0.12 * area(focused.rect);
    const cap = { x: o.work.x + o.work.w - 300, y: o.work.y + 4, w: 292, h: 172 };
    const changes: LayoutChange[] = [{ windowId: m.id, form: 'capsule', capsuleRect: cap, raise: true }];
    if (share && (share.visibleFraction < 0.55 || shareBlocks)) changes.push({ windowId: share.id, form: 'capsule', capsuleRect: { ...cap, y: cap.y + cap.h + 12 }, raise: true });
    return {
      ruleId: this.id,
      title: 'Keep the meeting in your periphery',
      rationale: `The meeting has been ${Math.round((1 - m.visibleFraction) * 100)}% covered for ${sec(buried)} s while it is still live. A capsule keeps the speaker, the current slide and captions glanceable in the corner; it expands back when you are addressed.`,
      evidence: [`visible ${Math.round(m.visibleFraction * 100)}%`, 'meeting live', `focus on “${byId(o, o.focusedId)?.title ?? '—'}”`],
      confidence: 0.7,
      technique: this.technique,
      changes,
      labels: { [m.id]: 'meeting capsule', ...(share ? { [share.id]: 'slide capsule' } : {}) },
    };
  },
};

// ── 3. Mention recall ─────────────────────────────────────────────────────────
const mentionRecall: Rule = {
  id: 'mention-recall',
  label: 'You were mentioned → bring meeting forward',
  technique: 'periphery → focus',
  run(o) {
    const ev = [...o.events].reverse().find((e) => e.type === 'meeting.mention' && o.t - e.t < 7000);
    if (!ev) return null;
    const m = vis(o).find((w) => w.appId === 'meeting');
    if (!m || (m.form === 'normal' && m.visibleFraction > 0.7 && m.depth < 0.05)) return null;
    const changes: LayoutChange[] = [{ windowId: m.id, form: 'normal', depth: 0, focus: true, raise: true }];
    const share = vis(o).find((w) => w.appId === 'share');
    if (share && share.form === 'capsule') changes.push({ windowId: share.id, form: 'normal', depth: 0, raise: true });
    return {
      ruleId: this.id,
      title: `${String(ev.data?.who ?? 'Someone')} addressed you`,
      rationale: `“${String(ev.data?.text ?? '')}” — the meeting needs your attention now. Bring it back to the glass; your other work stays exactly where it is.`,
      evidence: ['name mentioned in captions', m.form === 'capsule' ? 'meeting is a capsule' : `meeting ${Math.round(m.visibleFraction * 100)}% visible`],
      confidence: 0.92,
      technique: this.technique,
      changes,
      labels: { [m.id]: 'back to focus' },
    };
  },
};

// ── 4. Tutorial avoid target ──────────────────────────────────────────────────
/**
 * Dock the tutorial beside the app, on the side opposite the control the step needs,
 * shrinking the app just enough to keep the video readable (never a sliver).
 */
function dockVideo(app: Rect, video: Rect, target: Rect, work: Rect): { video: Rect; app?: Rect } | null {
  const vw = Math.min(520, Math.max(460, video.w));
  const vh = Math.min(400, Math.max(320, video.h));
  const gap = 16;
  const need = vw + gap;
  const onRight = target.x + target.w / 2 > app.x + app.w * 0.55;
  const side = (which: 'left' | 'right') => {
    let ax = app.x;
    let aw = app.w;
    if (which === 'right') {
      const free = work.x + work.w - (app.x + app.w);
      if (free < need) {
        const shrink = need - free;
        if (app.w - shrink < 700) return null;
        aw = app.w - shrink;
      }
    } else {
      const free = app.x - work.x;
      if (free < need) {
        const shrink = need - free;
        if (app.w - shrink < 700) return null;
        ax = app.x + shrink;
        aw = app.w - shrink;
      }
    }
    const vx = which === 'right' ? ax + aw + gap : ax - gap - vw;
    const vy = Math.max(work.y, Math.min(video.y, work.y + work.h - vh));
    const v: Rect = { x: Math.round(vx), y: Math.round(vy), w: vw, h: Math.min(vh, work.h - 8) };
    if (v.x < work.x - 2 || v.x + v.w > work.x + work.w + 2) return null;
    if (overlapArea(v, target) > 0) return null;
    const moved = Math.abs(ax - app.x) > 2 || Math.abs(aw - app.w) > 2;
    return { video: v, app: moved ? { x: Math.round(ax), y: app.y, w: Math.round(aw), h: app.h } : undefined };
  };
  return (onRight ? side('left') : side('right')) ?? side(onRight ? 'right' : 'left');
}

const tutorialAvoid: Rule = {
  id: 'tutorial-avoid',
  label: 'Tutorial covers the control you need',
  technique: 'importance-aware placement',
  run(o) {
    const tut = vis(o).find((w) => w.appId === 'tutorial' && w.form === 'normal');
    const app = vis(o).find((w) => w.appId === 'sculpt');
    if (!tut || !app) return null;
    const target = app.importance.find((r) => r.id === 'target');
    if (!target) return null;
    const pad = { x: target.rect.x - 12, y: target.rect.y - 12, w: target.rect.w + 24, h: target.rect.h + 24 };
    const covers = overlapArea(pad, tut.vis) > 24;
    const cramped = tut.rect.w < 420 || tut.rect.h < 280;
    // Clicking into the app raises it and buries the video. A buried tutorial cannot be followed.
    const buried = tut.visibleFraction < 0.7;
    if (!covers && !cramped && !buried) return null;
    const dock = dockVideo(app.rect, tut.rect, target.rect, o.work);
    if (!dock) return null;
    if (!dock.app && Math.hypot(dock.video.x - tut.rect.x, dock.video.y - tut.rect.y) < 20) return null;
    const step = String(o.events.filter((e) => e.type === 'tutorial.step').pop()?.data?.title ?? 'this step');
    const where = String(app.props.targetName ?? 'the app');
    const changes: LayoutChange[] = [{ windowId: tut.id, rect: dock.video, raise: true }];
    if (dock.app) changes.push({ windowId: app.id, rect: dock.app });
    return {
      ruleId: this.id + ':' + Math.round(target.rect.x) + ':' + Math.round(target.rect.y),
      title: `Keep the video readable, off ${where}`,
      rationale: `“${step}” happens in ${where}. The video stays a watchable size and moves to the side opposite that control${dock.app ? ', and Sculpt makes just enough room' : ''}.`,
      evidence: [`target visible ${Math.round(target.visibleFraction * 100)}%`, `video ${dock.video.w}×${dock.video.h}`],
      confidence: 0.84,
      technique: this.technique,
      changes,
      labels: { [tut.id]: 'readable, off the control', ...(dock.app ? { [app.id]: 'makes room' } : {}) },
    };
  },
};

// ── 5. Reference margins (design) ─────────────────────────────────────────────
const referenceMargins: Rule = {
  id: 'reference-margins',
  label: 'References cover the canvas',
  technique: 'fusion board + semantic clustering',
  run(o) {
    const canvas = vis(o).find((w) => w.appId === 'canvas' && w.form === 'normal');
    if (!canvas) return null;
    const refs = vis(o).filter((w) => w.appId === 'refimage' && w.depth < 0.05);
    if (refs.length < 3) return null;
    const drawing = canvas.importance.find((r) => r.weight >= 0.8)?.rect ?? canvas.rect;
    const covering = refs.filter((r) => overlapArea(r.vis, drawing) > 0.08 * area(r.vis));
    if (covering.length < 2) return null;
    return { ...boardLayout(o, canvas, refs), ruleId: this.id, technique: this.technique };
  },
};

export function boardLayout(o: Observation, canvas: WindowSummary, refs: WindowSummary[]): ProposalDraft {
  const W = o.work;
  const colW = 230;
  const gap = 10;
  const canvasRect: Rect = {
    x: W.x + colW + 22,
    y: canvas.rect.y,
    w: Math.min(canvas.rect.w, W.w - 2 * (colW + 22)),
    h: Math.min(canvas.rect.h, W.h - (canvas.rect.y - W.y)),
  };
  // Cluster by tag, then deal clusters into the left and right columns (keeping tags together).
  const tags = new Map<string, WindowSummary[]>();
  refs.forEach((r) => {
    const t = String(r.props.tag ?? 'misc');
    tags.set(t, [...(tags.get(t) ?? []), r]);
  });
  const clusters = [...tags.entries()].sort((a, b) => b[1].length - a[1].length);
  const cols: { x: number; y: number; items: string[] }[] = [
    { x: W.x, y: W.y, items: [] },
    { x: canvasRect.x + canvasRect.w + 22, y: W.y, items: [] },
  ];
  const changes: LayoutChange[] = [];
  const labels: Record<string, string> = {};
  for (const [tag, members] of clusters) {
    const col = cols[0].y <= cols[1].y ? cols[0] : cols[1];
    for (const m of members) {
      const aspect = m.rect.h / m.rect.w;
      const h = Math.round(Math.min(220, colW * aspect));
      const rect = { x: col.x, y: col.y, w: colW, h: Math.max(110, h) };
      if (rect.y + rect.h > W.y + W.h) {
        // overflow: tuck behind the column in depth rather than shrinking further
        changes.push({ windowId: m.id, rect: { ...rect, y: W.y + W.h - rect.h }, depth: 0.45, group: `refs-${tag}` });
      } else {
        changes.push({ windowId: m.id, rect, depth: 0, group: `refs-${tag}`, raise: true });
        col.y += rect.h + gap;
      }
      labels[m.id] = tag;
    }
    col.y += 12;
  }
  changes.push({ windowId: canvas.id, rect: canvasRect, focus: true });
  labels[canvas.id] = 'canvas stays central';
  return {
    ruleId: 'reference-margins',
    title: 'Pin references into margin boards',
    rationale: `${refs.length} references float over the drawing area. Clustering them by what they are for (${clusters.map((c) => c[0]).join(', ')}) into two fused boards keeps them one glance away without covering strokes — the canvas keeps its size and stays central.`,
    evidence: [`${refs.length} refs`, `${clusters.length} clusters`, 'canvas centre preserved'],
    confidence: 0.74,
    technique: 'fusion board',
    changes,
    labels,
  };
}

// ── 6. Depth trail condense (wiki) ────────────────────────────────────────────
const trailCondense: Rule = {
  id: 'trail-condense',
  label: 'Too many exploration pages',
  technique: 'depth trail',
  run(o) {
    const pages = vis(o).filter((w) => w.appId === 'browser' && w.depth < 0.05 && w.form === 'normal');
    if (pages.length < 5) return null;
    const sorted = [...pages].sort((a, b) => b.lastFocusedAt - a.lastFocusedAt);
    const keep = sorted.slice(0, 2);
    const recede = sorted.slice(2);
    const anchor = keep[0].rect;
    const changes: LayoutChange[] = recede.map((w, i) => ({
      windowId: w.id,
      depth: Math.min(0.85, 0.3 + i * 0.12),
      rect: { x: anchor.x - 30 - i * 18, y: anchor.y - 8 - i * 10, w: anchor.w, h: anchor.h },
      group: 'trail',
    }));
    keep.forEach((w) => changes.push({ windowId: w.id, depth: 0, group: 'trail' }));
    changes.push({ windowId: keep[0].id, focus: true });
    return {
      ruleId: this.id,
      title: `Recede ${recede.length} older pages into a depth trail`,
      rationale: `You have ${pages.length} pages from one exploration on the glass. The two you used most recently stay in front; the older path recedes behind them in depth, in the order you visited it — ⌥+scroll over the stack to walk back, hold Space to see through.`,
      evidence: [`${pages.length} pages at depth 0`, 'same exploration chain'],
      confidence: 0.68,
      technique: this.technique,
      changes,
      labels: Object.fromEntries(recede.map((w, i) => [w.id, `depth ${i + 1}`])),
    };
  },
};

// ── 7. Semantic file lens ─────────────────────────────────────────────────────
const semanticLens: Rule = {
  id: 'semantic-lens',
  label: 'Filename search keeps missing',
  technique: 'semantic lens',
  run(o) {
    if (o.tech.semanticFiles) return null;
    const ev = [...o.events].reverse().find((e) => e.type === 'files.search' && o.t - e.t < 8000);
    if (!ev) return null;
    const nameHits = Number(ev.data?.nameHits ?? 0);
    const semHits = Number(ev.data?.semanticHits ?? 0);
    if (nameHits > 0 || semHits === 0) return null;
    return {
      ruleId: this.id,
      title: 'Search by what files are, not what they are called',
      rationale: `No filename matches “${String(ev.data?.query)}”, but ${semHits} downloaded file${semHits > 1 ? 's' : ''} do by title/abstract. arXiv downloads are named by id (e.g. 2403.11872.pdf), so names carry no meaning. Turn on the semantic lens and provenance (where and why each file arrived).`,
      evidence: [`0 name hits`, `${semHits} semantic hits`],
      confidence: 0.84,
      technique: this.technique,
      changes: [],
      techniques: { semanticFiles: true, provenance: true },
    };
  },
};

// ── 8. Agent footprint review ─────────────────────────────────────────────────
const agentFootprint: Rule = {
  id: 'agent-footprint',
  label: 'Coding agent scattered files',
  technique: 'provenance + fusion',
  run(o) {
    const created = o.events.filter((e) => e.type === 'agentlog.created');
    if (created.length < 6) return null;
    if (vis(o).some((w) => w.appId === 'finder' && w.props.view === 'footprint')) return null;
    const term = vis(o).find((w) => w.appId === 'terminal');
    if (!term) return null;
    const dirs = new Set(created.map((e) => String(e.data?.dir)));
    const w = 520;
    const rect = term.rect.x + term.rect.w + 14 + w <= o.work.x + o.work.w
      ? { x: term.rect.x + term.rect.w + 14, y: term.rect.y, w, h: Math.max(380, term.rect.h) }
      : { x: Math.max(o.work.x, term.rect.x - w - 14), y: term.rect.y, w, h: Math.max(380, term.rect.h) };
    return {
      ruleId: this.id,
      title: 'Review what the coding agent left behind',
      rationale: `The agent session created ${created.length} files across ${dirs.size} folders (${[...dirs].slice(0, 3).join(', ')}…), several of them near-duplicates (“_v2”, “_final”, “tmp_”). A footprint view lists only agent-made files, linked to the log line that made them, so you can keep, move or quarantine them in one place.`,
      evidence: [`${created.length} files`, `${dirs.size} folders`, 'names look like drafts'],
      confidence: 0.77,
      technique: this.technique,
      changes: [{ windowId: term.id, group: 'footprint' }],
      open: [
        {
          appId: 'finder',
          title: 'Agent Footprint',
          rect,
          role: 'tool',
          group: 'footprint',
          props: { path: 'Projects/aqua-agent', view: 'footprint' },
        },
      ],
      labels: { [term.id]: 'linked to log' },
    };
  },
};

// ── 9. Speaker ↔ shared content fusion (meeting) ─────────────────────────────
const speakerFuse: Rule = {
  id: 'speaker-fuse',
  label: 'Presenter ↔ shared screen',
  technique: 'fusion',
  run(o) {
    if (!o.tech.fusion) return null;
    const share = vis(o).find((w) => w.appId === 'share' && w.form === 'normal');
    const tile = vis(o).find((w) => w.appId === 'tile' && w.form === 'normal');
    if (!share || !tile || (share.group && share.group === tile.group)) return null;
    const presenter = String(share.props.presenter ?? '');
    if (tile.props.person !== presenter) return null;
    const rect = { x: share.rect.x + share.rect.w - 190, y: share.rect.y + share.rect.h - 60, w: 220, h: 150 };
    const clamp = { ...rect, x: Math.min(rect.x, o.work.x + o.work.w - rect.w), y: Math.min(rect.y, o.work.y + o.work.h - rect.h) };
    return {
      ruleId: this.id,
      title: `Attach ${presenter} to their slides`,
      rationale: `${presenter} is presenting the shared screen, but their video sits in a separate window ${Math.round(Math.hypot(tile.rect.x - share.rect.x, tile.rect.y - share.rect.y))} px away. Fusing the tile to the slide's corner keeps face and content in one glance, and they move together.`,
      evidence: ['presenter = tile person', 'windows not grouped'],
      confidence: 0.66,
      technique: this.technique,
      changes: [
        { windowId: tile.id, rect: clamp, group: 'presenter', raise: true },
        { windowId: share.id, group: 'presenter' },
      ],
      labels: { [tile.id]: 'fused to slides' },
    };
  },
};

// ── 10. Uncover important region (generic) ────────────────────────────────────
const uncoverImportant: Rule = {
  id: 'uncover-important',
  label: 'Recently-used content is hidden',
  technique: 'minimal displacement',
  run(o) {
    const f = byId(o, o.focusedId);
    if (!f || f.form !== 'normal') return null;
    for (const w of vis(o)) {
      if (w.id === f.id || w.form !== 'normal' || w.depth > 0.05 || w.role === 'system') continue;
      if (o.t - w.lastFocusedAt > 25000 || o.t - w.lastFocusedAt < 1500) continue;
      if (w.group && w.group === f.group) continue;
      const reg = w.importance.find((r) => r.weight >= 0.8 && r.visibleFraction < 0.4);
      if (!reg || !intersect(reg.rect, f.rect)) continue;
      const place = placeAvoiding({ ...w.rect }, o.work, [{ x: f.rect.x - 12, y: f.rect.y - 12, w: f.rect.w + 24, h: f.rect.h + 24 }], [], [1, 0.85, 0.7]);
      if (!place) continue;
      return {
        ruleId: this.id + ':' + w.id,
        title: `Uncover “${reg.label ?? 'important content'}” in ${w.title}`,
        rationale: `You were using ${w.title} ${sec(o.t - w.lastFocusedAt)} s ago and its ${reg.label ?? 'key region'} is now ${Math.round((1 - reg.visibleFraction) * 100)}% hidden under “${f.title}”. Nudge it to the nearest free spot.`,
        evidence: [`region hidden ${Math.round((1 - reg.visibleFraction) * 100)}%`],
        confidence: 0.55,
        technique: this.technique,
        changes: [{ windowId: w.id, rect: place }],
        labels: { [w.id]: reg.label ?? 'uncovered' },
      };
    }
    return null;
  },
};

export const RULES: Rule[] = [
  mentionRecall,
  semanticLens,
  agentFootprint,
  tutorialAvoid,
  glanceDock,
  awarenessPeriphery,
  speakerFuse,
  referenceMargins,
  trailCondense,
  uncoverImportant,
];

export class RulePolicy implements Policy {
  id = 'rules';
  label = 'Rule agent (transparent baseline)';
  enabled = new Set(RULES.map((r) => r.id));
  propose(obs: Observation, mem: PreferenceMemory): ProposalDraft[] {
    const out: ProposalDraft[] = [];
    for (const r of RULES) {
      if (!this.enabled.has(r.id)) continue;
      try {
        const d = r.run(obs, mem);
        if (d) out.push(d);
      } catch (e) {
        console.warn('rule failed', r.id, e);
      }
    }
    return out;
  }
}
