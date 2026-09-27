# Study design (instrument already in `@aquawindow/study`)

## Research questions

- **RQ1 (performance).** Do fluid boundaries reduce window-management time and occlusion-search actions versus overlapping and tiling baselines?
- **RQ2 (agency).** Does a gated agent (`preview` / `auto-with-undo`) reduce effort *without* reducing perceived control versus `fluid` (manual) and `baseline`?
- **RQ3 (memory).** Does the stability budget keep centroid travel and "lost window" incidents comparable to baseline?
- **RQ4 (depth).** Exploratory: does Depth-as-Attention reduce minimize/restore churn in the tutorial and design tasks?

## Conditions (within-subjects)

1. `baseline` — overlapping rectangles, no field, no agent.
2. `tiling` — snap / tile; no fusion.
3. `fluid` — SDF skin, fusion, compression; autonomy = `off`.
4. `fluid-agent` — same as fluid + rule agent; autonomy starts at `preview`.

Latin-square counterbalancing of condition × scenario.

## Scenarios and tasks

See `packages/study/src/tasks/*.json`.

| Scenario | Goal | Critical incident we expect |
| --- | --- | --- |
| Files | Move `CHI-draft.pdf` into `Submission/` while another window covers the folder | Drop-target reveal via compression |
| Papers | Jump from a citation droplet to notes, then resume reading | Rebound of notes pane |
| Meeting | Pin shared screen, keep speaker visible, fuse minutes | Ice + tension |
| Tutorial | Complete 4 steps in the mock editor without the guide covering the target | Adsorb then recede |
| Design | Keep three references visible while painting on the canvas | Peripheral cluster |

## Measures

Logged automatically (`StudyLogger`):

- Task time (start / complete)
- Window-management command counts, by type
- Occlusion search proxy: focus events on fully-occluded windows
- Layout displacement: sum of centroid travel (stability)
- Proposal accept / partial / reject / undo rates

Self-report after each condition:

- NASA-TLX (6 items, 20-point)
- Agency scale (4 items, 7-point): control, predictability, trust, "I could override the system"

## Procedure (pilot-ready)

1. Consent + demographics (5 min)
2. 3-minute chrome tutorial (all conditions off)
3. Four condition blocks × one or two scenarios (≈ 40 min)
4. Debrief (5 min)

Export: researcher console → JSONL + questionnaire JSON.

## Analysis plan (for the paper, not this repo)

Linear mixed models: `measure ~ condition + scenario + (1|participant)`. Pairwise contrasts with Holm correction. Qualitative video coding of fusion/split and override events.
