export interface ScaleItem {
  id: string;
  label: string;
  min: number;
  max: number;
  lowAnchor: string;
  highAnchor: string;
}

export const NASA_TLX: ScaleItem[] = [
  { id: 'mental', label: 'Mental Demand', min: 1, max: 20, lowAnchor: 'Low', highAnchor: 'High' },
  { id: 'physical', label: 'Physical Demand', min: 1, max: 20, lowAnchor: 'Low', highAnchor: 'High' },
  { id: 'temporal', label: 'Temporal Demand', min: 1, max: 20, lowAnchor: 'Low', highAnchor: 'High' },
  { id: 'performance', label: 'Performance', min: 1, max: 20, lowAnchor: 'Good', highAnchor: 'Poor' },
  { id: 'effort', label: 'Effort', min: 1, max: 20, lowAnchor: 'Low', highAnchor: 'High' },
  { id: 'frustration', label: 'Frustration', min: 1, max: 20, lowAnchor: 'Low', highAnchor: 'High' },
];

export const AGENCY_SCALE: ScaleItem[] = [
  { id: 'control', label: 'I felt in control of the layout.', min: 1, max: 7, lowAnchor: 'Strongly disagree', highAnchor: 'Strongly agree' },
  { id: 'predictable', label: 'The system behaved predictably.', min: 1, max: 7, lowAnchor: 'Strongly disagree', highAnchor: 'Strongly agree' },
  { id: 'trust', label: 'I trusted the agent’s suggestions.', min: 1, max: 7, lowAnchor: 'Strongly disagree', highAnchor: 'Strongly agree' },
  { id: 'override', label: 'I could easily override the system.', min: 1, max: 7, lowAnchor: 'Strongly disagree', highAnchor: 'Strongly agree' },
];

export interface QuestionnaireResponse {
  condition: string;
  scenarioId: string | null;
  nasaTlx: Record<string, number>;
  agency: Record<string, number>;
  completedAt: number;
}
