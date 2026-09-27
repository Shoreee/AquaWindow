/** Target regions are normalised to the Sculpt app's content box (matches Sculpt's own layout). */
export interface TutorialStep {
  id: string;
  title: string;
  detail: string;
  start: number;
  end: number;
  target: { x: number; y: number; w: number; h: number; name: string };
  control: string;
}

export const STEPS: TutorialStep[] = [
  { id: 's1', title: 'Pick the Rectangle tool', detail: 'Toolbar on the left — second icon.', start: 0, end: 9, target: { x: 0.004, y: 0.125, w: 0.062, h: 0.085, name: 'the toolbar' }, control: 'tool-rect' },
  { id: 's2', title: 'Drag a square on the canvas', detail: 'Hold Shift for 1:1.', start: 9, end: 19, target: { x: 0.28, y: 0.25, w: 0.3, h: 0.42, name: 'the canvas' }, control: 'canvas' },
  { id: 's3', title: 'Set Corner Smoothing to 60%', detail: 'Properties panel → Corners.', start: 19, end: 30, target: { x: 0.76, y: 0.3, w: 0.24, h: 0.16, name: 'the Properties panel' }, control: 'smoothing' },
  { id: 's4', title: 'Add a gradient fill', detail: 'Properties → Fill → Gradient.', start: 30, end: 40, target: { x: 0.76, y: 0.5, w: 0.24, h: 0.14, name: 'the Fill section' }, control: 'fill' },
  { id: 's5', title: 'Export as PNG', detail: 'Layers panel → Export (bottom).', start: 40, end: 50, target: { x: 0.76, y: 0.84, w: 0.24, h: 0.14, name: 'the Export button' }, control: 'export' },
];
