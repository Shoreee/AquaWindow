/**
 * Peeling back windows (after Beaudouin-Lafon, UIST 2001).
 * Dragging a corner C to point P folds the window along the perpendicular bisector of CP.
 * The corner side is removed from the window (revealing what is beneath) and reflected
 * across the fold to form the flap (the window's back side).
 */
type Pt = [number, number];

function clipHalfPlane(poly: Pt[], m: Pt, n: Pt, keepPositive: boolean): Pt[] {
  const side = (p: Pt) => ((p[0] - m[0]) * n[0] + (p[1] - m[1]) * n[1]) * (keepPositive ? 1 : -1);
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const sa = side(a);
    const sb = side(b);
    if (sa >= 0) out.push(a);
    if (sa * sb < 0) {
      const t = sa / (sa - sb);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

export interface PeelGeometry {
  visible: Pt[];
  flap: Pt[];
  fold: [Pt, Pt] | null;
  amount: number;
}

export function peelGeometry(w: number, h: number, corner: Pt, p: Pt): PeelGeometry | null {
  const dx = p[0] - corner[0];
  const dy = p[1] - corner[1];
  const len = Math.hypot(dx, dy);
  if (len < 4) return null;
  const n: Pt = [dx / len, dy / len];
  const m: Pt = [(corner[0] + p[0]) / 2, (corner[1] + p[1]) / 2];
  const rect: Pt[] = [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ];
  const visible = clipHalfPlane(rect, m, n, true);
  const cut = clipHalfPlane(rect, m, n, false);
  const reflect = (q: Pt): Pt => {
    const d = (q[0] - m[0]) * n[0] + (q[1] - m[1]) * n[1];
    return [q[0] - 2 * d * n[0], q[1] - 2 * d * n[1]];
  };
  const flap = cut.map(reflect);
  const onFold = visible.filter((q) => Math.abs((q[0] - m[0]) * n[0] + (q[1] - m[1]) * n[1]) < 0.5);
  return { visible, flap, fold: onFold.length >= 2 ? [onFold[0], onFold[1]] : null, amount: len / Math.hypot(w, h) };
}

export const polyCss = (pts: Pt[]) => `polygon(${pts.map((q) => `${q[0].toFixed(1)}px ${q[1].toFixed(1)}px`).join(',')})`;
export const polySvg = (pts: Pt[]) => pts.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(' ');

/** Keep the reflected fold vertices; soften only the free edges of its backside. */
export function liquidFlapPath(points:Pt[],fold:[Pt,Pt]|null,time:number,amplitude=1.5){
 if(!points.length)return '';
 const f=fold,foldLength=f?Math.hypot(f[1][0]-f[0][0],f[1][1]-f[0][1]):1;
 const onFold=(p:Pt)=>!!f&&Math.abs((p[0]-f[0][0])*(f[1][1]-f[0][1])-(p[1]-f[0][1])*(f[1][0]-f[0][0]))/foldLength<.6;
 let path=`M${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}`;
 for(let i=0;i<points.length;i++){
  const a=points[i],b=points[(i+1)%points.length],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.max(1,Math.hypot(dx,dy));
  const strength=onFold(a)&&onFold(b)?0:Math.min(amplitude,length*.025);
  for(let j=1;j<=12;j++){
   const t=j/12,wave=Math.sin(Math.PI*t)*Math.sin(time*4.4+t*Math.PI*2+i)*strength;
   path+=` L${(a[0]+dx*t-dy/length*wave).toFixed(2)} ${(a[1]+dy*t+dx/length*wave).toFixed(2)}`;
  }
 }
 return path+' Z';
}
