# Concept: Negotiable Boundaries / Fluid Territories

## One-sentence claim

In an agent-populated desktop, the window *border* should be a continuously negotiable medium — fluid enough to fuse, compress, and recede, but regular enough (superellipse, not freeform blob) that users keep a spatial model and remain in control.

## Why "fluid" and not "fully organic"

Reviewers will attack irregularity: unreadable text, lost Fitts targets, broken spatial memory. AquaWindow therefore commits to **controlled fluidity**:

- Each window is a **superellipse** (Lamé curve) SDF, not a metaball cloud.
- Content lives in a **rigid rectangular core**. The skin deforms; glyphs do not.
- Fusion uses a *bounded* polynomial smooth-min so two windows become a peanut / pool, not an amoeba.
- Compression is a spring, not a morph: neighbors lose width/height first, then (only past a pressure threshold) may overlap.

## Primitives

### Rigid Core, Soft Skin

```
┌─────────────────────────────┐  ← soft skin (SDF field, WebGL)
│  ┌───────────────────────┐  │
│  │   readable DOM core   │  │  ← clip-path follows skin but
│  │   (never warped)      │  │     content transform is identity
│  └───────────────────────┘  │
└─────────────────────────────┘
```

This is the readability defense.

### Fusion as Grouping

Windows that share `semanticTags` and come within a fusion radius blend via `smin`. The fused set gets a `groupId`. Dragging one member moves the pool. Pulling beyond a split distance tears the group — a water-drop metaphor users already know.

### Compression over Occlusion

When A grows into B:

1. Compute contact pressure from SDF overlap.
2. If B is not pinned, shrink B along the contact axis (respecting `minSize`).
3. Visualize residual pressure on the field layer.
4. Only if pressure exceeds `overlapThreshold` may A occlude B.

Occlusion is no longer the *default* of the overlapping paradigm; it is a last resort.

### Human–Agent Territoriality

Borrowed from Scott et al. (CSCW 2004) tabletop territories:

| State | Visual | Who may move it |
| --- | --- | --- |
| Ice (`pinned`) | Crystalline rim, no fusion | User only |
| Water (default) | Soft skin | User + agent proposals |
| Ghost | Translucent liquid preview | Not yet real |

The agent is forbidden from proposing commands against ice.

### Proposal as Liquid Ghost

Agents never mutate the store. They emit a `LayoutProposal` (a list of kernel commands + rationale + confidence). The shell renders it as a liquid ghost. The user may:

- **Accept all**
- **Accept some** (drag a ghost into reality; discard the rest)
- **Reject**
- **Undo** later via the timeline (including auto-applied proposals)

This is feedforward (Horvitz) made spatial.

### Stability Budget

Agent-induced centroid travel (sum of Euclidean moves, plus area change) is capped per time window. This is both a *hard constraint* inside `RulePolicy` and a *dependent measure* in the study. It protects spatial memory (cf. Data Mountain).

### Depth as Attention (xyz, phase 1 = 2.5D)

`z` in the kernel is stacking order (who receives clicks).
`depth` is *attention*: 0 = working set, 1 = periphery, 2 = archived-but-visible.

Receding a window scales it toward the vanishing point, desaturates, and blurs — it is *not* minimized and *not* occluded. Parallax peek (pointer-driven) lets the user glance without committing a raise. A future 3D camera mode is a study *probe condition*, not the default.

## Mixed-initiative contract

```
user action ──► kernel command ──► event bus
                                      │
                                      ▼
                                 Observation
                                      │
                                      ▼
                         Policy (rules now, VLM later)
                                      │
                                      ▼
                              LayoutProposal
                                      │
                          ┌───────────┴────────────┐
                          ▼                        ▼
                     GhostLayer              auto-with-undo
                          │                        │
                     user decision                 │
                          └──────────► kernel ◄────┘
```

Autonomy dial: `off | suggest | preview | auto-with-undo`.
Default for studies is `preview` — the conservative mixed-initiative setting.

## What the five scenarios stress

| Scenario | Pain | Primitive exercised |
| --- | --- | --- |
| Files | Drop target hidden | Compression + fusion-as-transport-pool |
| Papers | Citation + notes steal space | Droplet peek + compress/rebound |
| Meeting | Speaker vs shared canvas vs notes | Tension links + ice on shared region |
| Tutorial | Instruction occludes the tool | Adsorption + recede-to-depth |
| Design | Reference wall vs canvas | Peripheral clusters + peek |
