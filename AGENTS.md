# Product design

- Follow Occam's razor: show only text and controls needed to understand or complete the current action.
- Remove decorative labels, repeated task numbers/headings, redundant instructions, and unsolicited time estimates. Use descriptive task names instead of numbered labels where possible.
- Keep one restrained visual language: pearl white, mist grey, subtle glass edges, consistent spacing, and motion that explains the user's action.
- The normal desktop exposes manual mechanisms. Experimental restrictions and task panels belong to the Experiment app and exist only while it is open.
- Manual window movement keeps the white pointer; only explicit Agent activation morphs the pointer into the core.

- Preserve real corner peeling: keep the geometric fold and reflected backside. Show no permanent corner button. Hovering the inner corner creates a small directional fold and wave; the outer border exclusively resizes. Scale the preview and pinned fold with the actual window dimensions. Add subtle liquid/glass waves to the lifted surface and fold without bright flashing stripes; never replace it with a retreating border or a hole.
- Keep the entire top edge empty; AquaWindow identity and Agent controls belong inside the bottom-right Settings panel. System utilities belong at the bottom right; experimental controls belong inside the Experiment app.
- Experiments start from a scenario hub and proceed one question at a time, showing only the current question. Use 题目/下一题, never 关卡. Keep interaction selection available during a question in both scenarios.
- Research objective: identify which interaction technique suits each task stage across PC contexts. The current study explains why techniques fit task conditions; Agent/system validation is later. Do not impose participant/time limits or a 2×2 effectiveness study.

- Do not automatically deform or yield overlapping windows. Keep deliberate manual resize and the real corner fold. Prefer recognizable complete OpenHarmony app icons over abstract monochrome glyphs on colored tiles.

- Taskbar applications use icons only, with accessible names and optional native tooltips. The fusion seam is an exclusive zipper gesture: start at an endpoint, keep window rectangles fixed while opening, and separate only after completion. Avoid progress jumps, large waves, or dragging the group by accident near the seam.

- Shift+S selects a region to preserve; Alt+S selects an explicit hole. Expose both in the title-bar context menu. Screenshot uses Ctrl+Shift+S. Never cut through overlapping windows from default app importance or automatically yield their outlines.

- Agent architecture follows docs/agent/workspace-architecture.md. Task-Driven Workspace Model is persistent local memory and bounded request context, avoiding repeated full-workspace transmission. Background only precomputes; preserve explicit triggering/confirmation. Do not invent empirical rewards or new techniques; leave uncertain capabilities pending confirmation. This round operates existing simulated-desktop windows only, with no generated content views.

- Fusion previews and closed seams must not clip, dent, or retreat window outlines, including staggered seam endpoints. Keep feedback in the optical rim; only an explicitly opened zipper may separate the seam edges.

- Agent must never generate local fallback plans. Maintain background model precomputation; reuse validated LLM results only for compatible task/content and minor geometry changes, otherwise request an update against the real prior model conversation. Send reference ID + delta, preserve server/direct-route context, and wait up to 10 seconds from explicit activation without inventing a result. On timeout display Error and ignore late results. Layout tolerance is an engineering parameter, not an experimental conclusion.
- Fusion uses a subtle single seam stroke, no white bloom or zipper heads. Pulling to the far endpoint separates immediately while the pointer remains down.

- Agent observes actual app content and availability; do not infer the task merely from app names or fabricate unreadable page/image contents. Existing native fusion, real corner peel and user-marked region operations share manual geometry and state. Never force technique diversity; identical evidence may justify identical suggestions. Relative layout specifications must preserve readable dimensions. Engineering diagnostics distinguish raw, rejected, presented and adopted results and are not research observations or reward weights.
