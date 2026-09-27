// Paragraphs use [[id|label]] for links between pages.
export interface WikiPage {
  id: string;
  title: string;
  lead: string;
  body: string[];
  hue: number;
}

export const WIKI: WikiPage[] = [
  {
    id: 'window-management',
    title: 'Window management',
    lead: 'How a graphical system arranges, overlaps and switches between application windows.',
    body: [
      'Early systems tiled windows; overlapping windows won because they preserve [[spatial-memory|spatial memory]] and let users size things freely. The cost is occlusion: important content hides behind whatever is on top.',
      'Research alternatives include [[focus-context|focus + context]] displays, [[peeling|peeling back windows]], importance-driven compositing and [[depth-cues|2.5D depth]].',
      'Recent work frames layout as a [[mixed-initiative|mixed-initiative]] problem between user and system.',
    ],
    hue: 210,
  },
  {
    id: 'superellipse',
    title: 'Superellipse',
    lead: 'A closed curve |x/a|ⁿ + |y/b|ⁿ = 1, also called a Lamé curve.',
    body: [
      'For n = 2 it is an ellipse; as n grows it approaches a rectangle. Values around 4–5 give the “squircle” used for continuous corners in modern UI.',
      'Because the curve is an implicit function, it composes naturally with a [[sdf|signed distance field]] and can be blended into [[metaballs|metaballs]].',
      'Gabriel Lamé studied the family in 1818; Piet Hein popularised it in design in the 1950s.',
    ],
    hue: 190,
  },
  {
    id: 'sdf',
    title: 'Signed distance function',
    lead: 'A function giving, for each point, its distance to a shape’s boundary — negative inside.',
    body: [
      'SDFs make boolean operations cheap: union is min(a, b), intersection is max(a, b). A [[smooth-min|smooth minimum]] blends shapes with a soft neck, the basis of fluid-looking UI.',
      'Rendering an SDF needs only a threshold per pixel, which is why it runs comfortably in a fragment shader.',
      'See also [[superellipse|superellipse]] and [[marching-squares|marching squares]].',
    ],
    hue: 260,
  },
  {
    id: 'smooth-min',
    title: 'Smooth minimum',
    lead: 'A differentiable approximation of min(a, b) with a blend radius k.',
    body: [
      'Polynomial smin: h = max(k − |a − b|, 0) / k; result = min(a, b) − h²k / 4. As k → 0 it becomes a hard min.',
      'In an interface k behaves like surface tension: larger k makes neighbouring [[metaballs|blobs]] fuse earlier.',
    ],
    hue: 280,
  },
  {
    id: 'metaballs',
    title: 'Metaballs',
    lead: 'Implicit surfaces that merge smoothly when close — introduced by Jim Blinn (1982).',
    body: [
      'Each ball contributes a field; the surface is an iso-contour of the sum. Nearby balls fuse, distant ones separate.',
      'As a UI cue, fusion communicates grouping through Gestalt [[gestalt|connectedness]] without extra chrome.',
    ],
    hue: 320,
  },
  {
    id: 'marching-squares',
    title: 'Marching squares',
    lead: 'An algorithm that extracts contour lines from a sampled 2D scalar field.',
    body: ['Each grid cell is classified by which corners are inside the iso-value; 16 cases map to line segments. It is the 2D sibling of marching cubes and a CPU fallback for rendering [[sdf|SDF]] shapes.'],
    hue: 30,
  },
  {
    id: 'focus-context',
    title: 'Focus + context',
    lead: 'Show the item of interest in detail while keeping its surroundings visible at lower fidelity.',
    body: [
      'Fisheye views, bifocal displays and peripheral shrinking of windows are focus + context techniques. They rely on [[peripheral-vision|peripheral vision]] for awareness.',
      'A risk is distortion: continuous deformation must stay legible and predictable, which is why [[spatial-memory|spatial stability]] matters.',
    ],
    hue: 150,
  },
  {
    id: 'peripheral-vision',
    title: 'Peripheral vision',
    lead: 'Vision outside the fovea: poor at detail, excellent at motion and change.',
    body: ['Interfaces can offload awareness to the periphery — a moving speaker ring, a colour pulse — and reserve the fovea for the primary task. See [[focus-context|focus + context]] and [[attention|attention]].'],
    hue: 120,
  },
  {
    id: 'attention',
    title: 'Attention',
    lead: 'The selective allocation of limited cognitive resources.',
    body: ['Interruptions are costly when they force a task switch; brief glances are cheap when information is already in view. Mixed-initiative systems should weigh the value of interrupting against its cost — see [[mixed-initiative|mixed-initiative]].'],
    hue: 90,
  },
  {
    id: 'mixed-initiative',
    title: 'Mixed-initiative interaction',
    lead: 'Humans and automated agents both contribute to a task, each taking the lead where it is strongest.',
    body: [
      'Horvitz (CHI 1999) proposed principles: consider uncertainty about user goals, weigh the cost of action versus inaction, allow efficient invocation and termination, and learn from user feedback.',
      'For window layout, that means proposals with previews, partial acceptance, cheap undo and an agent that becomes quieter when rejected. See [[spatial-memory|spatial memory]].',
    ],
    hue: 40,
  },
  {
    id: 'spatial-memory',
    title: 'Spatial memory',
    lead: 'Remembering where things are — a major reason people prefer overlapping windows.',
    body: ['Layout algorithms that move windows far from where the user put them break spatial memory, even if the result is “optimal”. Stable, minimal-displacement changes are easier to accept. See [[window-management|window management]].'],
    hue: 0,
  },
  {
    id: 'gestalt',
    title: 'Gestalt principles',
    lead: 'Proximity, similarity, closure, continuity and connectedness shape perceived grouping.',
    body: ['Uniform connectedness — elements joined by a shared region — is among the strongest grouping cues, stronger than proximity. Fused [[metaballs|metaball]] windows exploit it.'],
    hue: 350,
  },
  {
    id: 'peeling',
    title: 'Peeling back windows',
    lead: 'Folding a window’s corner to glance underneath, snapping back on release (Beaudouin-Lafon, UIST 2001).',
    body: ['Peeling makes occlusion temporary and reversible — a glance without changing layout. It pairs well with drag-and-drop through the fold. See [[window-management|window management]].'],
    hue: 200,
  },
  {
    id: 'depth-cues',
    title: 'Depth cues',
    lead: 'Size, blur, contrast, occlusion and parallax signal distance.',
    body: ['A 2.5D desktop can recede windows along z instead of minimising them, keeping them visible and in place. Hold Space to see through front layers. Related: [[focus-context|focus + context]].'],
    hue: 230,
  },
];

export const wikiById = (id: string) => WIKI.find((p) => p.id === id) ?? WIKI[0];
