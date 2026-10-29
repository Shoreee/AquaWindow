const smooth = (x: number) => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
};

export const HANDOFF_DURATION = 2.55;

/** A short donated packet detaches in flight, then crawls one complete perimeter. Reversible on release. */
export function extractionAt(ageSeconds: number) {
  const head = smooth((ageSeconds - 0.07) / 0.74);
  const crawl = smooth((ageSeconds - 0.81) / 1.3);
  const tail = smooth((ageSeconds - .50) / .70);
  const beat = Math.pow(Math.sin(crawl * Math.PI * 4), 8) * (1 - smooth((ageSeconds - 2.05) / .25));
  const drain = Math.sin(smooth(ageSeconds / 0.5) * Math.PI * 0.8) *
    (1 - smooth((ageSeconds - 0.81) / 0.65)) + beat * 0.3;
  return {
    lift: smooth(ageSeconds / 0.1),
    head,
    tail: Math.min(head, tail),
    drain,
    arrived: smooth((ageSeconds - 0.81) / 0.16),
    crawl,
    bound: smooth((ageSeconds - 2.0) / .45),
    beat,
    sever: smooth((ageSeconds - .16) / .20),
  };
}

/** One second of depth flight, then .8 seconds of continuous surface crawl. */
export const SELECTION_CONTACT = 1.0;
export const SELECTION_CRAWL = .8;
export const SELECTION_DURATION = 2.1;
export const WITHDRAW_DURATION = .85;
export function withdrawalAt(age:number){
  const head=smooth(age/.60),tail=smooth((age-.25)/.60);
  return {head,tail:Math.min(head,tail),opacity:smooth(age/.06)*(1-smooth((age-.65)/.20))};
}
export function selectionAt(age: number) {
  const head=smooth((age-.03)/(SELECTION_CONTACT-.03));
  const closure=smooth((age-SELECTION_CONTACT)/.22);
  const tail=Math.max(0,head-.24)*(1-closure)+closure;
  return {head,tail:Math.min(head,tail),lift:smooth(age/.08),
    arrived:smooth((age-SELECTION_CONTACT)/.12),crawl:smooth((age-SELECTION_CONTACT)/SELECTION_CRAWL),
    bound:smooth((age-SELECTION_CONTACT-SELECTION_CRAWL+.05)/.25),sever:smooth((age-.12)/.18),
    drain:Math.sin(smooth(age/.45)*Math.PI)*Math.exp(-Math.max(0,age-.45)*3.),beat:0};
}

export function activationAt(ageMs: number) {
  return smooth(ageMs / 850);
}
export function approachAngle(current: number, target: number, amount: number) {
  const delta = ((target - current + 1.5) % 1) - 0.5;
  return (current + delta * amount + 1) % 1;
}

/** Normalize deformation by time, so high-refresh displays retain the same recoil. */
export function deformationImpulse(deltaPixels: number, dtSeconds: number) {
  return Math.min(1.6, Math.max(0, deltaPixels) / Math.max(0.001, dtSeconds) * 0.0035);
}

/** Clockwise distance parameter on a rounded window. Shared by contact picking and the shader. */
export function perimeterPoint(width: number, height: number, fraction: number) {
  const r = Math.min(22, width / 2, height / 2);
  const horizontal = width - 2 * r, vertical = height - 2 * r, arc = Math.PI * r / 2;
  let distance = ((fraction % 1) + 1) % 1 * (2 * horizontal + 2 * vertical + 4 * arc);
  const line = (length: number) => {
    if (distance <= length) return true;
    distance -= length;
    return false;
  };
  if (line(horizontal)) return { x: r + distance, y: 0, nx: 0, ny: -1 };
  const corner = (cx: number, cy: number, angle: number) => {
    const theta = angle + distance / r;
    return { x: cx + Math.cos(theta) * r, y: cy + Math.sin(theta) * r, nx: Math.cos(theta), ny: Math.sin(theta) };
  };
  if (line(arc)) return corner(width - r, r, -Math.PI / 2);
  if (line(vertical)) return { x: width, y: r + distance, nx: 1, ny: 0 };
  if (line(arc)) return corner(width - r, height - r, 0);
  if (line(horizontal)) return { x: width - r - distance, y: height, nx: 0, ny: 1 };
  if (line(arc)) return corner(r, height - r, Math.PI / 2);
  if (line(vertical)) return { x: 0, y: height - r - distance, nx: -1, ny: 0 };
  return corner(r, r, Math.PI);
}

export function nearestPerimeter(width: number, height: number, x: number, y: number) {
  let best = 0, bestDistance = Infinity, step = 1 / 64;
  const check = (fraction: number) => {
    const p = perimeterPoint(width, height, fraction);
    const distance = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (distance < bestDistance) { bestDistance = distance; best = fraction; }
  };
  for (let i = 0; i < 64; i++) check(i / 64);
  for (let pass = 0; pass < 3; pass++) {
    const centre = best;
    for (let i = -4; i <= 4; i++) check(centre + i * step / 4);
    step /= 4;
  }
  return ((best % 1) + 1) % 1;
}
