import { PAPERS } from './papers';

export interface FsEntry {
  name: string;
  dir: string;
  kind: 'pdf' | 'image' | 'code' | 'doc' | 'archive' | 'folder' | 'log' | 'app';
  size: string;
  modified: string;
  /** Minutes ago — for sorting. */
  age: number;
  paperId?: string;
  provenance?: {
    source: string;
    context: string;
    task?: string;
  };
  agent?: { session: string; logLine: number; duplicateOf?: string; note: string };
}

const downloads: FsEntry[] = [
  ...PAPERS.map((p, i) => ({
    name: p.file,
    dir: 'Downloads',
    kind: 'pdf' as const,
    size: `${(1.2 + ((i * 7) % 11) / 3).toFixed(1)} MB`,
    modified: ['Today 09:12', 'Yesterday 21:40', 'Tue 16:03', 'Tue 15:58', 'Mon 11:20', 'Sun 22:05', 'Sat 10:31', 'Fri 18:44', 'Thu 09:02'][i] ?? 'Last week',
    age: [60, 900, 3000, 3005, 5600, 7200, 9000, 11000, 13000][i] ?? 20000,
    paperId: p.id,
    provenance: {
      source: 'arxiv.org',
      context: [
        'Google Scholar → “importance compositing window”',
        'Linked from “Soft UI” blog post',
        'Cited in Novak draft review',
        'Twitter/X thread on agent UIs',
        'Related-work sweep (depth)',
        'Shared by Lin in #meeting-lab',
        'Semantic Scholar → “metaball grouping”',
        'Course reading list · HCI 7',
        'Designer friend’s newsletter',
      ][i],
      task: ['Writing §2 Related Work', 'Writing §3 Concept', 'Writing §2 Related Work', 'Agent study design', 'Writing §3 Concept', 'Lab meeting prep', 'Writing §3 Concept', 'Tutorial scenario', 'Design scenario'][i],
    },
  })),
  { name: '2406.03321 (1).pdf', dir: 'Downloads', kind: 'pdf', size: '2.2 MB', modified: 'Today 09:13', age: 59, paperId: '2403.11872', provenance: { source: 'arxiv.org', context: 'Duplicate download of 2403.11872 (same hash)', task: 'Writing §2 Related Work' } },
  { name: 'Screenshot 2026-09-20 at 10.14.33.png', dir: 'Downloads', kind: 'image', size: '812 KB', modified: 'Sun 10:14', age: 7400 },
  { name: 'IMG_4021.HEIC', dir: 'Downloads', kind: 'image', size: '3.1 MB', modified: 'Sat 19:02', age: 8600 },
  { name: 'slides_final_FINAL(2).key', dir: 'Downloads', kind: 'doc', size: '18 MB', modified: 'Fri 17:30', age: 11100, provenance: { source: 'Mail', context: 'From Lin — “latest deck”', task: 'Lab meeting prep' } },
  { name: 'setup-v3.1.2.dmg', dir: 'Downloads', kind: 'app', size: '96 MB', modified: 'Thu 13:00', age: 12500 },
  { name: 'dataset_pilot.zip', dir: 'Downloads', kind: 'archive', size: '41 MB', modified: 'Wed 20:11', age: 14000, provenance: { source: 'drive.google.com', context: 'Pilot study logs', task: 'Agent study design' } },
];

export const AGENT_SESSION = 'claude-code · session 17';

const project: FsEntry[] = [
  { name: 'src', dir: 'Projects/aqua-agent', kind: 'folder', size: '—', modified: 'Today 10:02', age: 30 },
  { name: 'tests', dir: 'Projects/aqua-agent', kind: 'folder', size: '—', modified: 'Today 10:02', age: 30 },
  { name: 'README.md', dir: 'Projects/aqua-agent', kind: 'doc', size: '4 KB', modified: 'Mon 09:00', age: 6000 },
  { name: 'utils.py', dir: 'Projects/aqua-agent/src', kind: 'code', size: '6 KB', modified: 'Mon 09:00', age: 6000 },
  { name: 'app.py', dir: 'Projects/aqua-agent/src', kind: 'code', size: '11 KB', modified: 'Today 09:58', age: 34 },
];

/** Files the coding agent will create while the terminal log streams (scenario 1). */
export const AGENT_FILES: FsEntry[] = [
  { name: 'utils_v2.py', dir: 'Projects/aqua-agent/src', kind: 'code', size: '7 KB', modified: 'Today 10:03', age: 4, agent: { session: AGENT_SESSION, logLine: 3, duplicateOf: 'src/utils.py', note: 'Refactor attempt 1 (abandoned)' } },
  { name: 'tmp_debug_3.log', dir: 'Projects/aqua-agent', kind: 'log', size: '220 KB', modified: 'Today 10:03', age: 4, agent: { session: AGENT_SESSION, logLine: 5, note: 'Debug output, not referenced anywhere' } },
  { name: 'utils_v2_final.py', dir: 'Projects/aqua-agent/src/helpers', kind: 'code', size: '8 KB', modified: 'Today 10:04', age: 3, agent: { session: AGENT_SESSION, logLine: 8, duplicateOf: 'src/utils.py', note: 'Contains parse_date() — the helper you asked for' } },
  { name: 'fix_imports_backup.sh', dir: 'Projects/aqua-agent/scripts', kind: 'code', size: '1 KB', modified: 'Today 10:04', age: 3, agent: { session: AGENT_SESSION, logLine: 10, note: 'One-off script; already executed' } },
  { name: 'test_utils_copy.py', dir: 'Projects/aqua-agent/tests', kind: 'code', size: '3 KB', modified: 'Today 10:05', age: 2, agent: { session: AGENT_SESSION, logLine: 12, duplicateOf: 'tests/test_utils.py', note: 'Copy of tests with one assertion changed' } },
  { name: 'Button.old.tsx', dir: 'Projects/aqua-agent/web/components', kind: 'code', size: '2 KB', modified: 'Today 10:05', age: 2, agent: { session: AGENT_SESSION, logLine: 13, note: 'Backup before edit' } },
  { name: 'run-17.json', dir: 'Projects/aqua-agent/.cache/agent', kind: 'log', size: '64 KB', modified: 'Today 10:06', age: 1, agent: { session: AGENT_SESSION, logLine: 15, note: 'Agent scratchpad' } },
  { name: 'ARCHITECTURE_NEW.md', dir: 'Projects/aqua-agent/docs', kind: 'doc', size: '9 KB', modified: 'Today 10:06', age: 1, agent: { session: AGENT_SESSION, logLine: 17, duplicateOf: 'docs/ARCHITECTURE.md', note: 'Rewritten doc, unreviewed' } },
];

export const FS: FsEntry[] = [...downloads, ...project];

export const FOLDERS = ['Recents', 'Downloads', 'Desktop', 'Documents', 'Projects/aqua-agent'];

export const CODE: Record<string, string> = {
  'utils_v2_final.py': `from datetime import datetime\n\n# NOTE(agent): consolidated helpers from utils.py + utils_v2.py\n\ndef parse_date(s: str) -> datetime:\n    """Parse ISO or 'DD/MM/YYYY' strings."""\n    for fmt in ("%Y-%m-%d", "%d/%m/%Y"):\n        try:\n            return datetime.strptime(s, fmt)\n        except ValueError:\n            continue\n    raise ValueError(f"unrecognised date: {s}")\n\n\ndef slugify(s: str) -> str:\n    return "-".join(s.lower().split())\n`,
  'utils_v2.py': `# NOTE(agent): first refactor attempt — superseded by helpers/utils_v2_final.py\n\ndef parse(s):\n    ...\n`,
  'utils.py': `def slugify(s):\n    return "-".join(s.lower().split())\n`,
  'app.py': `from src.helpers.utils_v2_final import parse_date\n\n\ndef main():\n    print(parse_date("2026-09-27"))\n`,
};
