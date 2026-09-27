export interface Person {
  id: string;
  name: string;
  hue: number;
  role: string;
}

export const PEOPLE: Person[] = [
  { id: 'lin', name: 'Lin', hue: 200, role: 'Presenter' },
  { id: 'omar', name: 'Omar', hue: 30, role: 'PI' },
  { id: 'sato', name: 'Sato', hue: 140, role: 'Engineer' },
  { id: 'priya', name: 'Priya', hue: 320, role: 'Designer' },
  { id: 'you', name: 'You', hue: 260, role: '' },
];

export const SLIDES = [
  { title: 'Q3 study plan', bullets: ['4 conditions × 5 scenarios', '24 participants, within-subjects', 'Pilot: 6 people, done'] },
  { title: 'Pilot findings', bullets: ['Peeling used for 71% of glances', 'Agent proposals: 58% accepted', 'Auto mode felt “pushy” to 4/6'] },
  { title: 'Metric: strangeness', bullets: ['Displacement + aspect + order swaps', 'Correlates with rejections (r = .62)', 'Optimiser layouts score 3× higher'] },
  { title: 'Depth interactions', bullets: ['⌥-scroll recede / pull', 'Space x-ray peek', 'Trails for exploration'] },
  { title: 'Open questions', bullets: ['When should the agent stay silent?', 'Does fusion help or distract?', 'Budget for VLM latency'] },
];

/** Scripted meeting timeline in seconds from scenario start. */
export const SCRIPT: { t: number; speaker: string; text: string; slide?: number; mention?: boolean }[] = [
  { t: 1, speaker: 'lin', text: 'Okay, sharing my screen — can everyone see the study plan?', slide: 0 },
  { t: 7, speaker: 'omar', text: 'Yes. Go ahead, Lin.' },
  { t: 11, speaker: 'lin', text: 'Four conditions, five scenarios, within-subjects. The pilot is done.' },
  { t: 18, speaker: 'lin', text: 'Here are the pilot findings.', slide: 1 },
  { t: 24, speaker: 'sato', text: 'Seventy-one percent peeling is higher than I expected.' },
  { t: 30, speaker: 'lin', text: 'Auto mode felt pushy for four of six people, so we added the undo toast.' },
  { t: 36, speaker: 'lin', text: 'Next — the strangeness metric.', slide: 2 },
  { t: 43, speaker: 'priya', text: 'The optimiser layouts really do look alien in the videos.' },
  { t: 50, speaker: 'omar', text: 'Before we move on — could you confirm the pilot numbers, since you ran sessions three to six?', mention: true },
  { t: 60, speaker: 'lin', text: 'Depth interactions next.', slide: 3 },
  { t: 68, speaker: 'sato', text: 'X-ray with Space is lovely for the wiki trail.' },
  { t: 76, speaker: 'lin', text: 'And our open questions.', slide: 4 },
  { t: 84, speaker: 'priya', text: 'When should the agent stay silent? That is the big one for me.' },
  { t: 92, speaker: 'omar', text: 'Let us take that offline. Thanks, everyone.' },
];

export const CHAT_SCRIPT: { t: number; from: string; text: string }[] = [
  { t: 14, from: 'Kai', text: 'hey — can you review my PR before 5? it’s the depth-trail one' },
  { t: 33, from: 'Kai', text: 'no rush, just need a 👍 on the API' },
  { t: 70, from: 'Mom', text: 'Call me when you’re free ❤️' },
];
