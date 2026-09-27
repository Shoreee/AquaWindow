# Reviewer-defense checklist

Use this as a living FAQ when writing the CHI paper. Each item is a likely review comment and the response we are building the system to support.

## R1. "This is just Elastic Windows."

Elastic Windows (CHI 1997) is hierarchical *tiling* with rigid borders and user-issued group operations. AquaWindow is overlapping-first, borders are implicit surfaces, grouping is *fusion*, and an agent proposes under a stability budget. A dedicated baseline condition (`tiling`) exists so the user study can show the difference empirically.

## R2. "This is Dynamic Decals."

Dynamic Decals deform projected *widgets* around physical occluders on a table. No window manager, no agent, no human-owned ice, no undo timeline. We cite it as the closest geometric ancestor and then show a different *social* contract (territoriality + ghosts).

## R3. "Apple already shipped Liquid Glass."

Liquid Glass is a material system (refraction, caustics). Fusion there is optical, not semantic. Users cannot accept/reject a layout ghost, pin a territory, or query a stability budget. We treat it as an aesthetic cousin, not a layout contribution.

## R4. "DuoZone / AutoOptimization / SituationAdapt already do AI window layout."

Those systems are XR, operate on rigid panels, and typically *commit* an optimized pose. AquaWindow is a *PC desktop* (the still-dominant knowledge-work surface), the decision object is the *boundary*, and the default act is a *revocable ghost*. Our related-work table makes the domain/shape/initiative split explicit.

## R5. "Deformed windows will be unreadable."

Rigid Core, Soft Skin. Text and controls live in an unwarped DOM rectangle. The SDF only draws the chrome / field and drives `clip-path`. Readability is a measured covariate (comprehension items in the paper-reading task).

## R6. "Users will lose spatial memory."

Stability budget caps agent motion. Ice freezes user-owned windows. Depth-as-attention keeps windows *on screen* instead of minimizing them away. We log centroid travel and will report it against the overlapping baseline.

## R7. "The agent will over-act; users will feel out of control."

Four-level autonomy dial; default `preview`. Agent cannot touch ice. Ghosts are feedforward. Every auto action is on the undo timeline. Agency / predictability scales (Amershi G2, G6; Gajos 2008) are first-class questionnaires.

## R8. "A fake OS has no ecological validity."

We are not claiming to replace macOS. The contribution is a *research instrument* (like many CHI systems). Five tasks are modeled on real pain (Finder drop-target occlusion, citation-hopping, meeting+notes, software onboarding, moodboard vs canvas). We will recruit knowledge workers and report the limitation honestly.

## R9. "SDF / WebGL will not hold 60 fps with many windows."

The field shader is a single full-screen pass with a hard cap (`MAX_WINDOWS = 16` in the prototype; study tasks stay ≤ 8). CPU solver is O(n²) springs with n ≤ 16. We will report frame time in the paper and fail the condition if it drops below 30 fps.

## R10. "Why not full 3D?"

Full 3D camera desktops (Task Gallery, BumpTop-in-3D) have a long, mixed record: navigation cost vs spatial memory. Phase 1 commits to **2.5D Depth-as-Attention** so we can isolate the boundary contribution. A 3D probe condition can be added later without changing the kernel (`depth` is already a first-class field).

## R11. "Rule agents are not AI; this is not an agent paper."

The scientific object is the *interaction framework*, not a new model. The protocol (`Observation` → `LayoutProposal` → user decision) is model-agnostic; `VLMAdapter` is a stub with a frozen I/O contract so a later paper can swap in a VLM without rewriting the OS. Claiming a VLM contribution now would be premature and would muddy the CHI contribution.

## R12. "Fusion will confuse window identity."

Groups keep per-window identities (separate cores, separate titles). Fusion is a *skin* operation plus a `groupId`. Split is always available. We will code "lost the window" incidents in video.

## Study-facing mitigations already in the instrument

- Four conditions, within-subjects, counterbalanced.
- JSONL event log + replay (so we can compute all measures post-hoc).
- NASA-TLX + agency / predictability items.
- Researcher console to inject tasks without touching participant chrome.
