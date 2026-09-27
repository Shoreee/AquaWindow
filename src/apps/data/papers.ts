// All papers below are fictional stand-ins (mock data) so the demo never misquotes real work.
export interface Paper {
  id: string;
  file: string;
  title: string;
  authors: string;
  venue: string;
  abstract: string;
  keywords: string[];
  figure: 'field' | 'bars' | 'timeline' | 'scatter' | 'stack';
  figureCaption: string;
  table: { caption: string; head: string[]; rows: string[][] };
}

export const PAPERS: Paper[] = [
  {
    id: '2403.11872',
    file: '2403.11872.pdf',
    title: 'Foveated Compositing for Multi-Window Knowledge Work',
    authors: 'M. Aalto, J. Rivera, S. Chen',
    venue: 'arXiv preprint (mock)',
    abstract:
      'We present a compositing window manager that allocates screen fidelity by task importance rather than stacking order. Occluded windows expose their important regions through unimportant areas of occluders. In a 24-participant study, glance tasks were completed 29% faster than with overlapping windows, with no loss in primary-task accuracy.',
    keywords: ['foveated', 'compositing', 'occlusion', 'importance', 'window management'],
    figure: 'bars',
    figureCaption: 'Figure 3. Glance-task completion time by condition (lower is better).',
    table: {
      caption: 'Table 2. Glance task results (N = 24).',
      head: ['Condition', 'Time (s)', 'Errors', 'NASA-TLX'],
      rows: [
        ['Overlapping', '57.9', '1.8', '61'],
        ['Tiling', '49.3', '1.1', '55'],
        ['Foveated', '41.2', '0.9', '43'],
      ],
    },
  },
  {
    id: '2311.04519',
    file: '2311.04519.pdf',
    title: 'Soft Boundaries: Signed-Distance Windows for Continuous Layout',
    authors: 'K. Oduya, L. Brandt',
    venue: 'arXiv preprint (mock)',
    abstract:
      'Window boundaries are modelled as the zero set of a smooth signed-distance field. Blending fields yields fusion and yielding behaviours that preserve content scale while trading territory continuously.',
    keywords: ['sdf', 'superellipse', 'fluid', 'metaball', 'boundary'],
    figure: 'field',
    figureCaption: 'Figure 1. Two windows blended with a smooth minimum (k = 24 px).',
    table: { caption: 'Table 1. Rendering cost.', head: ['Windows', 'ms / frame'], rows: [['4', '0.6'], ['12', '1.4'], ['24', '2.9']] },
  },
  {
    id: '2402.09931',
    file: '2402.09931.pdf',
    title: "Glance, Don't Switch: Micro-Interruptions in Academic Writing",
    authors: 'P. Novak, H. Tanaka',
    venue: 'arXiv preprint (mock)',
    abstract:
      'A diary and logging study of 31 researchers shows that 64% of window switches while writing last under five seconds and return to the same document — they are glances, not task switches.',
    keywords: ['glance', 'writing', 'interruption', 'switching'],
    figure: 'timeline',
    figureCaption: 'Figure 2. Switch durations while writing (log scale).',
    table: { caption: 'Table 1. Switch types.', head: ['Type', 'Share'], rows: [['Glance < 5 s', '64%'], ['Lookup 5–30 s', '23%'], ['Task switch', '13%']] },
  },
  {
    id: '2405.00217',
    file: '2405.00217.pdf',
    title: 'Negotiating Layout with Language-Model Agents',
    authors: 'R. Ilves, A. Moreau, D. Kim',
    venue: 'arXiv preprint (mock)',
    abstract:
      'Layout optimisers find mathematically optimal arrangements people reject as alien. We show that adding behavioural and semantic priors — which a language-model agent can infer from window content — closes most of this acceptability gap.',
    keywords: ['agent', 'llm', 'layout', 'optimisation', 'mixed-initiative'],
    figure: 'scatter',
    figureCaption: 'Figure 4. Optimality vs. acceptance for 180 layouts.',
    table: { caption: 'Table 3. Acceptance rate.', head: ['Solver', 'Accepted'], rows: [['Pure optimiser', '22%'], ['+ priors', '61%'], ['+ agent rationale', '74%']] },
  },
  {
    id: '2309.15530',
    file: '2309.15530.pdf',
    title: 'Depth as a Layout Dimension in 2.5D Desktops',
    authors: 'E. Lindqvist, T. Obi',
    venue: 'arXiv preprint (mock)',
    abstract: 'Receding windows along z instead of minimising them preserves spatial memory: retrieval of receded windows is 1.7× faster than from the Dock.',
    keywords: ['depth', '2.5d', 'z', 'recession', 'spatial memory'],
    figure: 'stack',
    figureCaption: 'Figure 2. Depth stack with parallax cues.',
    table: { caption: 'Table 1. Retrieval time.', head: ['Method', 's'], rows: [['Dock', '3.4'], ['Depth', '2.0']] },
  },
  {
    id: '2401.07765',
    file: '2401.07765.pdf',
    title: 'Peripheral Awareness in Hybrid Meetings',
    authors: 'C. Duarte, F. Weiss',
    venue: 'arXiv preprint (mock)',
    abstract: 'Participants multitask in 58% of remote meetings. A peripheral meeting capsule halved missed direct questions.',
    keywords: ['meeting', 'periphery', 'awareness', 'multitasking'],
    figure: 'bars',
    figureCaption: 'Figure 2. Missed direct questions per hour.',
    table: { caption: 'Table 2.', head: ['Condition', 'Missed'], rows: [['Hidden', '2.4'], ['Capsule', '1.1']] },
  },
  {
    id: '2312.02211',
    file: '2312.02211.pdf',
    title: 'Metaball Grouping for Related Windows',
    authors: 'Y. Sato, B. Clarke',
    venue: 'arXiv preprint (mock)',
    abstract: 'Rendering related windows as one fused blob strengthens perceived grouping (Gestalt connectedness) without extra chrome.',
    keywords: ['metaball', 'grouping', 'gestalt', 'fusion'],
    figure: 'field',
    figureCaption: 'Figure 1. Fused windows.',
    table: { caption: 'Table 1.', head: ['Cue', 'Grouping'], rows: [['Proximity', '0.61'], ['Fusion', '0.88']] },
  },
  {
    id: '2404.18800',
    file: '2404.18800.pdf',
    title: 'Split Attention in Video Tutorial Following',
    authors: 'G. Mensah, I. Petrov',
    venue: 'arXiv preprint (mock)',
    abstract: 'Learners spend 31% of tutorial time rearranging the video and the target application.',
    keywords: ['tutorial', 'video', 'split attention', 'learning'],
    figure: 'timeline',
    figureCaption: 'Figure 3. Rearrangement episodes.',
    table: { caption: 'Table 1.', head: ['Activity', 'Share'], rows: [['Following', '52%'], ['Rearranging', '31%']] },
  },
  {
    id: '2310.11112',
    file: '2310.11112.pdf',
    title: 'Reference Boards in Visual Design Practice',
    authors: 'S. Haddad, M. Rossi',
    venue: 'arXiv preprint (mock)',
    abstract: 'Designers consult references every 40 s on average and keep them spatially grouped by purpose: palette, form, texture, light.',
    keywords: ['reference', 'design', 'moodboard', 'pureref'],
    figure: 'scatter',
    figureCaption: 'Figure 2. Consultation intervals.',
    table: { caption: 'Table 1.', head: ['Purpose', 'Share'], rows: [['Palette', '34%'], ['Form', '29%'], ['Texture', '21%'], ['Light', '16%']] },
  },
];

export const paperById = (id: string) => PAPERS.find((p) => p.id === id) ?? PAPERS[0];
