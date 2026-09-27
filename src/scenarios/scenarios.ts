import { defaultImportance } from '../apps/importance';
import type { Scenario, ScenarioWindow } from './types';

const W = (w: ScenarioWindow): ScenarioWindow => ({ importance: defaultImportance(w.appId), ...w });

const refs: ScenarioWindow[] = [
  { tag: 'palette', x: 180, y: 90, w: 250, h: 180, seed: 3 },
  { tag: 'form', x: 980, y: 60, w: 280, h: 200, seed: 7 },
  { tag: 'texture', x: 1040, y: 420, w: 240, h: 170, seed: 11 },
  { tag: 'light', x: 300, y: 520, w: 260, h: 180, seed: 5 },
  { tag: 'palette', x: 760, y: 560, w: 230, h: 160, seed: 21 },
  { tag: 'form', x: 120, y: 330, w: 220, h: 200, seed: 13 },
  { tag: 'light', x: 1180, y: 250, w: 220, h: 150, seed: 17 },
  { tag: 'texture', x: 560, y: 90, w: 210, h: 150, seed: 29 },
  { tag: 'palette', x: 1120, y: 610, w: 210, h: 150, seed: 37 },
].map((r, i) =>
  W({
    key: `ref${i}`,
    appId: 'refimage',
    title: `ref_${r.tag}_${String(i + 1).padStart(2, '0')}.jpg`,
    rect: { x: r.x, y: r.y, w: r.w, h: r.h },
    role: 'reference',
    props: { tag: r.tag, seed: r.seed },
  }),
);

export const SCENARIOS: Scenario[] = [
  // ── 1 ─────────────────────────────────────────────────────────────────────
  {
    id: 'files',
    n: 1,
    title: 'Where did that file go?',
    zh: '文件管理：arXiv 编号无从查找；coding agent 留下的“垃圾”散落各处',
    task: 'You downloaded the paper about foveated window compositing last week and need its Table 2. Meanwhile a coding agent has been refactoring your project and you need to find where it put parse_date() — and what else it left behind.',
    goal: 'Open the foveated-compositing paper, open the file containing parse_date(), and triage the agent’s leftovers.',
    whyHard: 'Downloads are named by arXiv id (2403.11872.pdf), so names carry no meaning. The agent wrote 8 files across 6 folders with names like utils_v2_final.py. Two Finder windows and a terminal overlap.',
    occlusion: 'Terminal (front) covers the lower-right of Downloads and most of the project Finder behind it.',
    focusKey: 'term',
    windows: [
      W({ key: 'dl', appId: 'finder', title: 'Downloads', rect: { x: 70, y: 56, w: 780, h: 480 }, role: 'primary', props: { path: 'Downloads' } }),
      W({ key: 'proj', appId: 'finder', title: 'aqua-agent', rect: { x: 170, y: 360, w: 640, h: 420 }, role: 'reference', props: { path: 'Projects/aqua-agent' } }),
      W({ key: 'term', appId: 'terminal', title: 'Terminal — claude-code', rect: { x: 560, y: 250, w: 680, h: 440 }, role: 'tool' }),
    ],
    strategies: [
      { id: 'A', label: 'Baseline Finder', lineage: 'macOS Finder', description: 'Names, dates and sizes only. Search matches filenames.', tech: {}, agent: false, tryThis: ['Search “foveated” in Downloads.', 'Hunt for parse_date() by opening folders.'] },
      { id: 'B', label: 'Semantic lens', lineage: 'Semantic file systems; provenance-aware desktops', description: 'Opaque ids resolved to titles; search covers title/abstract; each file shows the context it arrived in (which page, which task).', tech: { semanticFiles: true, provenance: true }, agent: false, tryThis: ['Search “foveated” again.', 'Toggle “Group by task”.'] },
      { id: 'C', label: 'Provenance + fusion', lineage: 'Ours — territory fusion of cause and effect', description: 'Log lines ↔ files are linked; hovering a file lights the log line that wrote it; agent files open in a footprint view fused to the terminal.', tech: { shape: 'squircle', fusion: true, provenance: true, semanticFiles: true, yield: 'deform' }, agent: false, tryThis: ['Click a “Write(…)” line → reveal.', 'Open Agent footprint in the sidebar and quarantine the duplicates.'] },
      { id: 'D', label: 'Agent-assisted', lineage: 'Mixed-initiative (Horvitz ’99)', description: 'The agent notices failed filename searches and the agent’s file spray, and proposes the lens and a fused footprint review — you accept, partially accept or reject.', tech: { shape: 'squircle', fusion: true, yield: 'deform' }, agent: true, autonomy: 'preview', tryThis: ['Search “foveated” with the lens off — wait for the proposal.', 'Let the log run; accept the footprint review.'] },
    ],
    doneEvent: 'files.open',
    rq: ['RQ2'],
  },
  // ── 2 ─────────────────────────────────────────────────────────────────────
  {
    id: 'glance',
    n: 2,
    title: 'Glance while writing',
    zh: '写作/阅读时短暂查看后台资料；wiki 越学越多、页面越开越多',
    task: 'Finish the TODO in your Related Work paragraph with the two numbers from Table 2 of the paper behind your draft. Then read up on superellipses, SDFs and smooth-min for §3 in the wiki.',
    goal: 'Type both numbers (41.2 and 57.9) into the draft; explore ≥ 5 wiki pages without losing your way.',
    whyHard: 'The table you need sits exactly under the paragraph you are writing. Each glance costs a switch and your caret context. Wiki exploration multiplies pages.',
    occlusion: 'Draft (front, focused) covers the paper’s Figure and Table; the wiki is half under the draft’s right edge.',
    focusKey: 'draft',
    windows: [
      W({ key: 'paper', appId: 'preview', title: '2403.11872.pdf', rect: { x: 110, y: 70, w: 600, h: 720 }, role: 'reference', props: { paperId: '2403.11872' } }),
      W({ key: 'wiki', appId: 'browser', title: 'Window management', rect: { x: 860, y: 110, w: 540, h: 620 }, role: 'reference', props: { pageId: 'window-management' } }),
      W({ key: 'draft', appId: 'writer', title: 'Draft — Negotiable Boundaries', rect: { x: 250, y: 52, w: 780, h: 740 }, role: 'primary', props: { docId: 'draft' } }),
    ],
    strategies: [
      { id: 'A', label: 'Overlap + tabs', lineage: 'Classic desktop', description: 'Click to switch; links open as tabs.', tech: { wikiTrail: 'tabs' }, agent: false, tryThis: ['Click the paper, read, click back, type.'] },
      { id: 'B', label: 'Peel back', lineage: 'Beaudouin-Lafon, UIST 2001', description: 'Grab the draft’s corner dog-ear (or ⌥-drag any corner) to fold it back and read beneath; release to spring back, hold Shift to pin the fold.', tech: { peel: true, wikiTrail: 'windows' }, agent: false, tryThis: ['Drag the bottom-left dog-ear of the draft toward the upper right.'] },
      { id: 'C', label: 'Importance cut-out', lineage: 'Waldner et al., CHI 2011', description: 'Important regions of occluded windows (the table, the figure) show through unimportant parts of the occluder. The paragraph you are writing is never cut.', tech: { cutout: true }, agent: false, tryThis: ['Just look: the table shows through the draft’s margin.', 'Move the draft — the cut follows.'] },
      { id: 'D', label: 'Fluid yield + depth trail', lineage: 'Ours — negotiable boundaries', description: 'Focused windows press into others, which yield by denting (not scaling) so their content keeps scale. Wiki links open in front while the path recedes in depth.', tech: { shape: 'squircle', yield: 'deform', depth: true, fusion: true, peel: true, wikiTrail: 'depth' }, agent: false, tryThis: ['Drag the draft slightly left/right and watch the paper yield.', 'Follow 5 wiki links; ⌥+scroll over the stack; hold Space.'] },
      { id: 'E', label: 'Scale instead of deform', lineage: 'RQ1 control — shrink-to-fit', description: 'Same as D, but occluded windows shrink uniformly into free space instead of changing shape.', tech: { shape: 'squircle', yield: 'scale', depth: true, wikiTrail: 'depth' }, agent: false, tryThis: ['Compare legibility of the table with D.'] },
      { id: 'F', label: 'Agent glance dock', lineage: 'Ours — behaviour-aware agent', description: 'After a few short glances the agent proposes docking the paper as a fused side pane; after many wiki pages it proposes receding the trail.', tech: { shape: 'squircle', yield: 'deform', depth: true, fusion: true, peel: true, wikiTrail: 'windows' }, agent: true, autonomy: 'preview', tryThis: ['Click paper → draft → paper → draft → paper quickly.', 'Open 5+ wiki pages.'] },
    ],
    doneEvent: 'task.done',
    rq: ['RQ1', 'RQ2', 'RQ3'],
  },
  // ── 3 ─────────────────────────────────────────────────────────────────────
  {
    id: 'meeting',
    n: 3,
    title: 'Meeting + something else',
    zh: '会议：发言人窗口与共享内容挂钩；开会时做别的事但保持对会议的感知',
    task: 'You are in a lab meeting. Lin presents slides; her camera tile floats separately. You take notes and reply to Kai. At some point Omar will ask you a question.',
    goal: 'Keep notes, answer Kai, and answer Omar quickly when addressed (Unmute & answer).',
    whyHard: 'Face and slides are split across windows. Working on notes buries the meeting; messages compete for attention; a direct question is easy to miss.',
    occlusion: 'Notes (front) cover most of the meeting and a third of the slides; Messages overlaps the notes.',
    focusKey: 'notes',
    windows: [
      W({ key: 'meet', appId: 'meeting', title: 'Lab meeting — Q3 study', rect: { x: 60, y: 50, w: 600, h: 420 }, role: 'awareness' }),
      W({ key: 'share', appId: 'share', title: 'Lin’s screen', rect: { x: 690, y: 50, w: 700, h: 440 }, role: 'awareness', props: { presenter: 'Lin' } }),
      W({ key: 'tile', appId: 'tile', title: 'Lin', rect: { x: 1170, y: 560, w: 220, h: 170 }, role: 'awareness', props: { person: 'Lin' } }),
      W({ key: 'chat', appId: 'chat', title: 'Messages', rect: { x: 820, y: 330, w: 460, h: 400 }, role: 'scratch' }),
      W({ key: 'notes', appId: 'writer', title: 'Meeting notes', rect: { x: 150, y: 90, w: 780, h: 620 }, role: 'primary', props: { docId: 'notes' } }),
    ],
    strategies: [
      { id: 'A', label: 'Separate windows', lineage: 'Zoom/Teams default', description: 'Move and stack as usual.', tech: {}, agent: false, tryThis: ['Try to keep an eye on the slides while writing.'] },
      { id: 'B', label: 'Fusion', lineage: 'Ours — Gestalt connectedness via smooth-union SDF', description: 'Presenter tile and her slides share one fused territory and move together (Shift-drag detaches).', tech: { shape: 'squircle', fusion: true, yield: 'deform' }, agent: false, setup: ['fuse-presenter'], tryThis: ['Drag the slides — the presenter follows.'] },
      { id: 'C', label: 'Periphery capsule', lineage: 'Scalable Fabric (Robertson et al. 2004), peripheral awareness', description: 'Collapse the meeting (◐ in its title bar) into a live capsule: speaker, caption ticker, slide number, answer button.', tech: { shape: 'squircle', periphery: true, fusion: true, yield: 'deform' }, agent: false, setup: ['fuse-presenter'], tryThis: ['Click ◐ on the meeting and on the slides.'] },
      { id: 'D', label: 'Depth', lineage: 'Task Gallery (Robertson et al. 2000), 2.5D desktops', description: 'Push the meeting back in depth (⌥+scroll or ⇣): it stays visible, blurred, behind your notes. Hold Space to see through.', tech: { shape: 'squircle', depth: true, fusion: true, yield: 'deform' }, agent: false, tryThis: ['⌥+scroll down over the meeting and slides.', 'Hold Space when the captions change.'] },
      { id: 'E', label: 'Agent-mediated awareness', lineage: 'Ours — attention-aware agent', description: 'The agent capsules a buried meeting, fuses presenter to slides, and brings the meeting forward when you are addressed.', tech: { shape: 'squircle', periphery: true, fusion: true, depth: true, yield: 'deform' }, agent: true, autonomy: 'preview', tryThis: ['Just work in your notes. Try Auto+Undo on the dial.'] },
    ],
    doneEvent: 'task.done',
    rq: ['RQ2', 'RQ3'],
  },
  // ── 4 ─────────────────────────────────────────────────────────────────────
  {
    id: 'tutorial',
    n: 4,
    title: 'Follow a video tutorial',
    zh: '一边看教程一边操作软件；跟着操作时还需要多开窗口',
    task: 'Follow the video to make a squircle app icon in Sculpt (5 steps).',
    goal: 'Complete all five steps and export the PNG.',
    whyHard: 'The video needs to be big enough to read, but every step happens in a different part of the app — and the video covers the Properties panel.',
    occlusion: 'Video (front) covers Sculpt’s Properties, Fill and Export regions.',
    focusKey: 'video',
    windows: [
      W({ key: 'app', appId: 'sculpt', title: 'Sculpt — Icon.sculpt', rect: { x: 60, y: 44, w: 1120, h: 740 }, role: 'primary', props: { targetName: 'the toolbar' } }),
      W({ key: 'video', appId: 'tutorial', title: 'Tutorial — Squircle icons in 5 steps', rect: { x: 800, y: 330, w: 580, h: 420 }, role: 'reference' }),
    ],
    strategies: [
      { id: 'A', label: 'Manual arrange', lineage: 'Classic desktop', description: 'Move and resize the video yourself.', tech: {}, agent: false, tryThis: ['Do all 5 steps.'] },
      { id: 'B', label: 'Ghost overlay', lineage: 'Transparent overlays / free-space transparency (Ishak & Feiner 2004)', description: 'Turn the video into a see-through overlay: clicks pass through to the app.', tech: { ghostOverlay: true, peel: true }, agent: false, tryThis: ['Press “ghost” in the video controls.'] },
      { id: 'C', label: 'Fluid yield', lineage: 'Ours — negotiable boundaries', description: 'Whichever window you work in presses the other: the video dents around the app’s active region when you click into Sculpt.', tech: { shape: 'squircle', yield: 'deform', peel: true, depth: true }, agent: false, tryThis: ['Click into Sculpt, then into the video.'] },
      { id: 'D', label: 'Step-aware agent', lineage: 'Ours — task-model agent', description: 'The agent knows which control each step needs and moves the video off it (minimal displacement), while Sculpt highlights the target.', tech: { shape: 'squircle', yield: 'deform', ghostOverlay: true }, agent: true, autonomy: 'preview', tryThis: ['Follow the steps; accept or reject moves. Try Auto+Undo.'] },
    ],
    doneEvent: 'task.done',
    rq: ['RQ1', 'RQ2'],
  },
  // ── 5 ─────────────────────────────────────────────────────────────────────
  {
    id: 'design',
    n: 5,
    title: 'Design with references',
    zh: '设计创作时频繁查看多个视觉参考（类 PureRef）',
    task: 'Paint a poster while consulting nine references (palette, form, texture, light).',
    goal: 'Make 20+ strokes while keeping references within a glance.',
    whyHard: 'References are small, many and constantly consulted; scattered on top of the canvas they cover strokes, behind it they vanish.',
    occlusion: 'Nine reference windows overlap the canvas edges from all sides.',
    focusKey: 'canvas',
    windows: [W({ key: 'canvas', appId: 'canvas', title: 'Poster — Moss & Light', rect: { x: 260, y: 56, w: 900, h: 720 }, role: 'primary' }), ...refs],
    strategies: [
      { id: 'A', label: 'Floating windows', lineage: 'Classic desktop', description: 'Each reference is its own window.', tech: {}, agent: false, tryThis: ['Paint; move references out of the way.'] },
      { id: 'B', label: 'Fused boards', lineage: 'PureRef; Gestalt connectedness', description: 'References with the same purpose fuse into one board (drag moves the board, Shift-drag detaches, ⧉ fuses with the nearest window).', tech: { shape: 'squircle', fusion: true, yield: 'deform', snap: true }, agent: false, setup: ['fuse-refs'], tryThis: ['Drag a board by any of its images.', 'Shift-drag one image out; ⧉ in its title bar re-fuses it.'] },
      { id: 'C', label: 'Depth layer', lineage: '2.5D desktops', description: 'References recede behind the canvas; hold Space to see through the canvas, ⌥+scroll pulls one forward.', tech: { shape: 'squircle', depth: true, yield: 'deform' }, agent: false, setup: ['refs-depth'], tryThis: ['Hold Space while painting.', '⌥+scroll over a ref.'] },
      { id: 'D', label: 'Agent vs optimiser', lineage: 'Ours — RQ2 (SUPPLE-style optimisation vs. agent priors)', description: 'The agent proposes semantic margin boards. Layout Lab shows what a pure optimiser would do with the same windows.', tech: { shape: 'squircle', fusion: true, depth: true, yield: 'deform' }, agent: true, autonomy: 'preview', extraWindows: [], tryThis: ['Accept the margin boards.', 'Open Layout Lab (Dock) and compare.'] },
    ],
    doneEvent: 'design.stroke',
    rq: ['RQ1', 'RQ2', 'RQ3'],
  },
];

export const scenarioById = (id: string | null) => SCENARIOS.find((s) => s.id === id) ?? null;
