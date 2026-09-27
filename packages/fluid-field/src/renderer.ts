import { FIELD_FRAG } from './shaders/field.frag.glsl.js';
import { FIELD_VERT } from './shaders/field.vert.glsl.js';
import type { FieldWindow } from './sdf.js';

const MAX = 16;

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Failed to create shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(info ?? 'shader compile failed');
  }
  return shader;
}

export class FieldRenderer {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private buffer: WebGLBuffer;
  private uResolution: WebGLUniformLocation | null;
  private uTime: WebGLUniformLocation | null;
  private uCount: WebGLUniformLocation | null;
  private uRects: WebGLUniformLocation | null;
  private uMeta: WebGLUniformLocation | null;
  private uEnabled: WebGLUniformLocation | null;
  private start = performance.now();

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl', { premultipliedAlpha: false, alpha: true });
    if (!gl) throw new Error('WebGL not available');
    this.gl = gl;
    const vs = compile(gl, gl.VERTEX_SHADER, FIELD_VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FIELD_FRAG);
    const program = gl.createProgram();
    if (!program) throw new Error('Failed to create program');
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) ?? 'link failed');
    }
    this.program = program;
    const buffer = gl.createBuffer();
    if (!buffer) throw new Error('Failed to create buffer');
    this.buffer = buffer;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    this.uResolution = gl.getUniformLocation(program, 'u_resolution');
    this.uTime = gl.getUniformLocation(program, 'u_time');
    this.uCount = gl.getUniformLocation(program, 'u_count');
    this.uRects = gl.getUniformLocation(program, 'u_rects[0]');
    this.uMeta = gl.getUniformLocation(program, 'u_meta[0]');
    this.uEnabled = gl.getUniformLocation(program, 'u_enabled');
  }

  draw(windows: FieldWindow[], enabled: boolean, width: number, height: number): void {
    const gl = this.gl;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const canvas = gl.canvas as HTMLCanvasElement;
    const w = Math.max(1, Math.floor(width * dpr));
    const h = Math.max(1, Math.floor(height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.program);

    const rects = new Float32Array(MAX * 4);
    const meta = new Float32Array(MAX * 4);
    const list = windows.slice(0, MAX);
    const groups = new Map<string, number>();
    let g = 1;
    list.forEach((win, i) => {
      rects[i * 4] = win.rect.x * dpr;
      rects[i * 4 + 1] = win.rect.y * dpr;
      rects[i * 4 + 2] = win.rect.width * dpr;
      rects[i * 4 + 3] = win.rect.height * dpr;
      let gi = 0;
      if (win.groupId) {
        if (!groups.has(win.groupId)) groups.set(win.groupId, g++);
        gi = groups.get(win.groupId)!;
      }
      meta[i * 4] = gi;
      meta[i * 4 + 1] = win.pinned ? 1 : 0;
      meta[i * 4 + 2] = win.pressure;
      meta[i * 4 + 3] = win.depth;
    });

    gl.uniform2f(this.uResolution, w, h);
    gl.uniform1f(this.uTime, (performance.now() - this.start) / 1000);
    gl.uniform1i(this.uCount, list.length);
    gl.uniform4fv(this.uRects, rects);
    gl.uniform4fv(this.uMeta, meta);
    gl.uniform1f(this.uEnabled, enabled ? 1 : 0);

    const loc = gl.getAttribLocation(this.program, 'a_position');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteBuffer(this.buffer);
    gl.deleteProgram(this.program);
  }
}
