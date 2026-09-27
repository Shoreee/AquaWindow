# AquaWindow

A high-fidelity **pseudo-OS** for researching *agent-assisted fluid window layout* on the PC desktop. It is not an operating system — it is a controllable experimental front-end where windows can move, resize, occlude, fuse, compress, recede in depth, and negotiate space with a decoupled layout agent.

**Research concept:** *Negotiable Boundaries / Fluid Territories* — the window border itself is the medium of continuous human–agent negotiation.

## Architecture

AI and the window manager are strictly decoupled. The kernel never imports React or an LLM. Agents may only submit `LayoutProposal`s; the user accepts, partially accepts, or rejects them.

```
apps/web            composition root + researcher console
packages/ui-shell   macOS-style chrome, field layer, ghosts, autonomy dial
packages/apps       five scenario apps (Finder, papers, meeting, tutorial, design)
packages/study      conditions, JSONL logging, replay, questionnaires
packages/agent-sdk  Observation / Proposal / Policy / VLM stub
packages/fluid-field  superellipse SDF, fusion, pressure solver
packages/wm-kernel  commands, z-order, occlusion, undo timeline
```

## Quick start

```bash
pnpm install
pnpm dev
```

Open http://localhost:5173. Use the Dock to launch apps, the autonomy dial to change agent authority, and `` ` `` (backtick) or the menu **Study → Researcher Console** to open the experimenter panel.

## Experiment conditions

| Condition | Description |
| --- | --- |
| `baseline` | Classic overlapping rectangles |
| `tiling` | Snap / tile layouts |
| `fluid` | Soft-skin SDF boundaries, fusion, compression — manual only |
| `fluid-agent` | Fluid + rule agent, gated by the autonomy dial |

Autonomy levels: `off` → `suggest` → `preview` → `auto-with-undo`.

## Packages

| Package | Role |
| --- | --- |
| `@aquawindow/wm-kernel` | Pure TypeScript window store |
| `@aquawindow/fluid-field` | Geometry + WebGL field |
| `@aquawindow/agent-sdk` | Agent protocol (rules now, VLM later) |
| `@aquawindow/ui-shell` | Desktop chrome |
| `@aquawindow/apps` | Scenario content |
| `@aquawindow/study` | Study instrumentation |
| `@aquawindow/web` | Vite app |

See [docs/research](docs/research) for related work, concept, reviewer defense, and study design.

## License

MIT. Visual language is informed by [playground-macos](https://github.com/Renovamen/playground-macos) (MIT) — see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
