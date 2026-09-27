# Related work map

This document positions AquaWindow against four literatures: classical window management, deformable / implicit interfaces, adaptive layout (including recent LLM/VLM systems), and mixed-initiative control.

## 1. Classical window management

| Work | Venue | What it did | What AquaWindow is not |
| --- | --- | --- | --- |
| Bly & Rosenberg, *A comparison of tiled and overlapping windows* | CHI 1986 | Empirical tiled vs overlapping | No fluid boundary; no agent |
| Kandogan & Shneiderman, *Elastic Windows* | CHI 1997 / AVI 1996 | Hierarchical space-filling tiling, group operations | Rigid tiles; no negotiation medium |
| Bell & Feiner, *Dynamic Space Management* | UIST 2000 | Empty-space rectangles, overlap avoidance | Axis-aligned rectangles only |
| Beaudouin-Lafon, *Novel interaction techniques for overlapping windows* | UIST 2001 | Peeling / folding windows | Metaphor is paper, not fluid territory |
| Dragicevic, *Fold-and-Drop* | UIST 2004 | Folding as a drag affordance | Transient fold, not persistent layout language |
| Agarawala & Balakrishnan, *BumpTop* | CHI 2006 | Physics desktop, piling | Physics of rigid bodies, not negotiable skins |
| Robertson et al., *Data Mountain*; Robertson et al., *Task Gallery* | UIST / CHI | Spatial memory in 3D | 3D placement of rigid rectangles |
| Waldner et al., *Display-adaptive window management* | ITS 2011 | Windows on irregular surfaces | Surface is irregular; window remains a rectangle |

**Takeaway.** Forty years of window research optimized *placement of rectangles*. AquaWindow treats the *boundary* as a first-class, continuously deformable object.

## 2. Deformable and implicit interfaces

| Work | Why it is the closest neighbor | Distinction |
| --- | --- | --- |
| *Dynamic Decals* (implicit deformers + constraint minimization) | Soft collision, aesthetic deformation of UI units | Designed for projected tabletop widgets, not desktop windows; no agent; no human–agent territory |
| Metaball / implicit-surface design tools | Smooth fusion language (smooth-min) | Ornament / CAD, not window management |
| Apple *Liquid Glass* (2025) | Visual fusion / refraction aesthetic | Material, not layout semantics. Fusion does not mean grouping, and users cannot negotiate |

AquaWindow reuses the *math* of implicit surfaces (superellipse SDF + polynomial smooth-min) but attaches *interaction semantics*: fusion = grouping, compression = anti-occlusion, ice = user-owned territory.

## 3. Adaptive / optimized layout and agents

| Work | Venue | Domain | Agent role | Window shape |
| --- | --- | --- | --- | --- |
| SUPPLE (Gajos et al.) | UIST / CHI | Adaptive widgets | Automatic generation | Widget trees |
| Todi et al., MBRL adaptive UI | CHI 2021 | Adaptive menus / layouts | RL | Rigid |
| SemanticAdapt | UIST 2021 | XR | Semantic associations + optimization | Rigid panels |
| AUIT | CHI 2022 | XR | Authorable optimization | Rigid |
| Niyazov et al., user-driven constraints | CHI 2023 | XR | User authors constraints | Rigid |
| SituationAdapt | UIST 2024 | Mobile MR | VLM rates placements | Rigid overlays |
| AutoOptimization | CHI 2026 | MR/VR | Multi-agent VLM parameterizes MOO | Rigid UIs |
| DuoZone | TVCG 2026 | XR windows | LLM + cost model; user authors zones | Rigid XR windows |

**Gap.** Recent AI layout work (1) lives almost entirely in XR, (2) still places *rigid* rectangles, (3) typically *commits* a layout rather than negotiating a continuous boundary. PC desktop — where knowledge work still happens — is under-served.

## 4. Control, predictability, mixed initiative

- Horvitz, *Principles of mixed-initiative user interfaces* (CHI 1999)
- Gajos et al., predictability of adaptive interfaces (CHI 2008)
- Findlater et al., ephemeral adaptation (CHI 2009)
- Amershi et al., *Guidelines for Human-AI Interaction* (CHI 2019)
- Shneiderman, Human-Centered AI — high automation *and* high control
- Scott, Carpendale, Inkpen, *Territoriality in collaborative tabletop workspaces* (CSCW 2004) — source of the ice / water metaphor

AquaWindow operationalizes these as: **autonomy dial**, **liquid ghost proposals**, **pin-as-ice**, **stability budget**, and **full undo timeline**.

## 5. Suggested CHI keywords (old topic, new terms)

Old keywords that reviewers will expect: window management, tiled vs overlapping, space management, adaptive UI, mixed-initiative.

**New keywords we propose to own:**

- Negotiable Boundaries
- Fluid Territories
- Rigid Core / Soft Skin
- Fusion-as-Grouping
- Compression-over-Occlusion
- Human–Agent Territoriality
- Proposal-as-Liquid-Ghost
- Stability Budget
- Depth-as-Attention
