import { useEffect, useRef } from 'react';
import type { Rect } from '../kernel/types';

/**
 * WebGL2 field layer. Draws, beneath all windows, the smooth-union SDF of every fused
 * group — the liquid "neck" between grouped windows — plus soft territory halos and
 * attention pulses. One full-screen fragment shader; windows are passed as uniforms.
 */
export interface FieldShape {
  rect: Rect;
  radius: number;
  group: number; // 0..7, or -1 for a lone window (halo only)
  pulse: number; // 0..1 attention pulse
}

const MAX = 32;

const VS = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;

const FS = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform float uScale; uniform float uTime; uniform int uN;
uniform vec4 uRect[${MAX}]; uniform vec4 uMeta[${MAX}];
uniform vec3 uColor[8];
out vec4 o;
float sdBox(vec2 p, vec2 c, vec2 h, float r){ vec2 q = abs(p-c)-h+r; return length(max(q,0.))+min(max(q.x,q.y),0.)-r; }
float smin(float a, float b, float k){ float h = max(k-abs(a-b),0.)/k; return min(a,b)-h*h*k*.25; }
void main(){
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uScale;
  float g[8]; float pulse[8]; int cnt[8];
  for(int i=0;i<8;i++){ g[i]=1e5; pulse[i]=0.; cnt[i]=0; }
  float halo = 1e5; float haloPulse = 0.;
  for(int i=0;i<${MAX};i++){
    if(i>=uN) break;
    vec4 r = uRect[i]; vec4 m = uMeta[i];
    float d = sdBox(px, r.xy + r.zw*.5, r.zw*.5, m.x);
    int gi = int(m.y);
    if(gi >= 0){ g[gi] = smin(g[gi], d, 64.); pulse[gi] = max(pulse[gi], m.z); cnt[gi]++; }
    else if(m.z > 0.){ halo = min(halo, d); haloPulse = max(haloPulse, m.z); }
  }
  vec4 acc = vec4(0.);
  for(int i=0;i<8;i++){
    if(cnt[i] < 2 && pulse[i] <= 0.) continue;
    float d = g[i] + sin(px.x*.035 + uTime*1.6)*1.2 + cos(px.y*.03 - uTime*1.2)*1.2;
    float inset = smoothstep(4., -10., d);
    float rim = exp(-abs(d + 3.)/7.) * .55;
    float glow = exp(-max(d,0.)/26.) * (.26 + pulse[i]*.5*(.6+.4*sin(uTime*6.)));
    vec3 c = uColor[i];
    float a = clamp(inset*.5 + rim + glow, 0., .88);
    acc = vec4(mix(acc.rgb, c + rim*.35, a), max(acc.a, a));
  }
  if(haloPulse > 0.){
    float glow = exp(-max(halo,0.)/30.) * haloPulse * (.55+.45*sin(uTime*6.));
    acc = vec4(mix(acc.rgb, vec3(1.,.36,.42), glow), max(acc.a, glow));
  }
  o = vec4(acc.rgb*acc.a, acc.a);
}`;

export const GROUP_COLORS: [number, number, number][] = [
  [0.36, 0.62, 1.0],
  [0.62, 0.42, 1.0],
  [0.2, 0.8, 0.7],
  [1.0, 0.62, 0.3],
  [1.0, 0.45, 0.75],
  [0.55, 0.85, 0.35],
  [0.95, 0.8, 0.3],
  [0.45, 0.75, 0.95],
];

export function FieldLayer({ shapes }: { shapes: FieldShape[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const shapesRef = useRef(shapes);
  shapesRef.current = shapes;

  useEffect(() => {
    const canvas = ref.current!;
    const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) return;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = (n: string) => gl.getUniformLocation(prog, n);
    const uRes = u('uRes');
    const uScale = u('uScale');
    const uTime = u('uTime');
    const uN = u('uN');
    const uRect = u('uRect');
    const uMeta = u('uMeta');
    gl.uniform3fv(u('uColor'), new Float32Array(GROUP_COLORS.flat()));
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    let raf = 0;
    const scale = 0.5;
    const t0 = performance.now();
    const frame = () => {
      const w = Math.floor(window.innerWidth * scale);
      const h = Math.floor(window.innerHeight * scale);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      const s = shapesRef.current.slice(0, MAX);
      if (s.length) {
        const rects = new Float32Array(MAX * 4);
        const meta = new Float32Array(MAX * 4);
        s.forEach((x, i) => {
          rects.set([x.rect.x, x.rect.y, x.rect.w, x.rect.h], i * 4);
          meta.set([x.radius, x.group, x.pulse, 0], i * 4);
        });
        gl.uniform2f(uRes, w, h);
        gl.uniform1f(uScale, scale);
        gl.uniform1f(uTime, (performance.now() - t0) / 1000);
        gl.uniform1i(uN, s.length);
        gl.uniform4fv(uRect, rects);
        gl.uniform4fv(uMeta, meta);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={ref} className="aw-field" />;
}
