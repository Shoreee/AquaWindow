/**
 * Interaction techniques are independent, composable switches. Study conditions and
 * scenario strategies are just presets over them, so any comparison is a diff of flags.
 */
export interface Techniques {
  /** Window skin: classic rounded rect vs continuous squircle territory. */
  shape: 'rect' | 'squircle';
  /** RQ1 — how background windows respond when the focused window presses into them. */
  yield: 'none' | 'deform' | 'scale';
  /** Importance-driven compositing (Waldner et al., CHI 2011): important regions cut through occluders. */
  cutout: boolean;
  /** Peeling back windows (Beaudouin-Lafon, UIST 2001): fold a corner to glance underneath. */
  peel: boolean;
  /** RQ3 — depth as a layout dimension: ⌥+scroll push/pull, Space x-ray, depth trails. */
  depth: boolean;
  /** Fused territories: grouped windows share one metaball skin (smooth-union SDF). */
  fusion: boolean;
  /** Edge snapping / tiling. */
  snap: boolean;
  /** Finder resolves opaque names (arXiv ids) to titles and groups by task provenance. */
  semanticFiles: boolean;
  /** Link files ↔ the agent actions / pages that produced them. */
  provenance: boolean;
  /** How wiki/browser links open. */
  wikiTrail: 'tabs' | 'windows' | 'depth';
  /** Meeting / video may collapse into a peripheral capsule. */
  periphery: boolean;
  /** Tutorial video can become a see-through overlay above the target app. */
  ghostOverlay: boolean;
}

export const BASELINE: Techniques = {
  shape: 'rect',
  yield: 'none',
  cutout: false,
  peel: false,
  depth: false,
  fusion: false,
  snap: false,
  semanticFiles: false,
  provenance: false,
  wikiTrail: 'tabs',
  periphery: false,
  ghostOverlay: false,
};

export type ConditionId = 'baseline' | 'tiling' | 'fluid' | 'fluid-agent';

export interface Condition {
  id: ConditionId;
  label: string;
  description: string;
  techniques: Techniques;
  agent: boolean;
}

export const CONDITIONS: Condition[] = [
  { id: 'baseline', label: 'Baseline', description: 'Classic overlapping rectangles', techniques: BASELINE, agent: false },
  { id: 'tiling', label: 'Tiling', description: 'Snap / tile layouts', techniques: { ...BASELINE, snap: true }, agent: false },
  {
    id: 'fluid',
    label: 'Fluid',
    description: 'Soft squircle territories, yielding boundaries, depth, fusion — manual only',
    techniques: {
      ...BASELINE,
      shape: 'squircle',
      yield: 'deform',
      peel: true,
      depth: true,
      fusion: true,
      snap: true,
      wikiTrail: 'depth',
      periphery: true,
    },
    agent: false,
  },
  {
    id: 'fluid-agent',
    label: 'Fluid + Agent',
    description: 'Fluid techniques + layout agent, gated by the autonomy dial',
    techniques: {
      ...BASELINE,
      shape: 'squircle',
      yield: 'deform',
      peel: true,
      depth: true,
      fusion: true,
      snap: true,
      semanticFiles: true,
      provenance: true,
      wikiTrail: 'depth',
      periphery: true,
      ghostOverlay: true,
    },
    agent: true,
  },
];

export type Autonomy = 'off' | 'suggest' | 'preview' | 'auto';

export const AUTONOMY_LEVELS: { id: Autonomy; label: string; hint: string }[] = [
  { id: 'off', label: 'Off', hint: 'Agent observes nothing, proposes nothing' },
  { id: 'suggest', label: 'Suggest', hint: 'A quiet chip; ghosts only on hover' },
  { id: 'preview', label: 'Preview', hint: 'Ghost layout shown in place; you accept / edit / reject' },
  { id: 'auto', label: 'Auto + Undo', hint: 'Agent applies; every change is one ⌘Z away' },
];
