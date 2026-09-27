export const FIELD_FRAG = /* glsl */ `
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform int u_count;
uniform vec4 u_rects[16];
uniform vec4 u_meta[16]; // x: group, y: pinned, z: pressure, w: depth
uniform float u_enabled;

varying vec2 v_uv;

float sdSuper(vec2 p, vec2 c, vec2 r, float n) {
  vec2 d = abs(p - c) / max(r, vec2(0.0001));
  return pow(d.x, n) + pow(d.y, n) - 1.0;
}

float smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

void main() {
  vec2 p = v_uv * u_resolution;
  float field = 8.0;
  float pressure = 0.0;
  float ice = 0.0;
  float groupMix = 0.0;

  for (int i = 0; i < 16; i++) {
    if (i >= u_count) break;
    vec4 r = u_rects[i];
    vec4 m = u_meta[i];
    vec2 c = r.xy + r.zw * 0.5;
    vec2 rad = r.zw * 0.5 + vec2(14.0);
    float d = sdSuper(p, c, rad, 4.0);
    if (m.x > 0.5) {
      field = smin(field, d, 0.45);
      groupMix += 1.0 - smoothstep(0.0, 0.4, d);
    } else {
      field = min(field, d);
    }
    float inside = 1.0 - smoothstep(0.0, 0.15, d);
    pressure += inside * m.z;
    ice += inside * m.y;
  }

  if (u_enabled < 0.5) {
    gl_FragColor = vec4(0.0);
    return;
  }

  float rim = smoothstep(0.08, 0.0, field) - smoothstep(0.0, -0.08, field);
  float body = 1.0 - smoothstep(0.0, 0.12, field);
  vec3 aqua = vec3(0.45, 0.82, 0.95);
  vec3 iceCol = vec3(0.85, 0.93, 1.0);
  vec3 heat = vec3(1.0, 0.45, 0.35);
  vec3 col = mix(aqua, iceCol, clamp(ice, 0.0, 1.0));
  col = mix(col, heat, clamp(pressure * 0.55, 0.0, 0.7));
  float glow = rim * 0.85 + body * 0.18;
  float pulse = 0.5 + 0.5 * sin(u_time * 2.2 + field * 6.0);
  float alpha = glow * (0.55 + 0.2 * pulse);
  gl_FragColor = vec4(col, alpha);
}
`;
