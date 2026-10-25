import React, {forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef} from 'react';
import {continueRender, delayRender, useCurrentFrame, useVideoConfig} from '../core/index';
import {validateCanvasSize} from '../core/effects';
import {positive, random} from '../core/math';

/* One full-frame WebGL2 fragment shader per frame. The picture is a pure function of the uniforms: u_time (seconds from the frame),
 * u_frame, u_resolution, u_seed and the caller's own. The canvas keeps its drawing buffer, so the frame captured after the layout
 * effect is the frame drawn for it. */

/** A number is a float, a 2–4 array a vec, a `#rgb`/`#rrggbb` string a vec3 colour in 0..1. */
export type ShaderUniform = number | readonly number[] | string;
export type ShaderPalette = {ink: string; paper: string; accent: string; soft: string};
export type ShaderProps = {
  /** GLSL ES 3.00 fragment source. Without its own `#version` line it gets the prelude: the built-in uniforms, every user uniform the
   * source does not declare itself, `out vec4 fragColor` and the helpers in `SHADER_LIB`. */
  frag: string; width: number; height: number;
  uniforms?: Record<string, ShaderUniform>;
  /** Sets `u_ink`, `u_paper`, `u_accent`, `u_soft` (vec3). */ palette?: ShaderPalette;
  seed?: string | number; pixelDensity?: number; style?: React.CSSProperties; className?: string;
};

/** Hex colour to 0..1 rgb. */
export function hexToVec3(color: string): [number, number, number] {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim())?.[1];
  if (!hex) throw new Error(`<Shader> colour uniforms take #rgb or #rrggbb, got "${color}"`);
  const full = hex.length === 3 ? [...hex].map(d => d + d).join('') : hex;
  return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16) / 255) as [number, number, number];
}

/** A uniform's GLSL type and its float values. */
export function uniformValue(name: string, value: ShaderUniform): {type: 'float' | 'vec2' | 'vec3' | 'vec4'; values: number[]} {
  const values = typeof value === 'string' ? hexToVec3(value) : typeof value === 'number' ? [value] : [...value];
  if (values.length < 1 || values.length > 4 || values.some(v => !Number.isFinite(v))) throw new Error(`<Shader> uniform ${name} must be a finite number, 2-4 numbers or a hex colour`);
  return {type: (['float', 'vec2', 'vec3', 'vec4'] as const)[values.length - 1]!, values};
}

/** Helpers every prelude carries: an integer hash (no sin-based hash, which differs between GPUs), value noise and fbm, all seeded by u_seed. */
export const SHADER_LIB = `
uint ff_hashu(uint x) { x ^= x >> 16; x *= 0x7feb352dU; x ^= x >> 15; x *= 0x846ca68bU; x ^= x >> 16; return x; }
float hash(vec2 cell) { uvec2 q = uvec2(ivec2(floor(cell)) + ivec2(1 << 20)); return float(ff_hashu(q.x ^ ff_hashu(q.y ^ ff_hashu(uint(u_seed * 65535.0))))) / 4294967295.0; }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int k = 0; k < 5; k++) { v += a * vnoise(p); p = p * 2.03 + vec2(17.1, 9.3); a *= 0.5; } return v; }
/** Centred coordinates: the short side spans -0.5..0.5. */
vec2 centred() { return (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y); }
`;

const BUILT_IN = ['u_time', 'u_frame', 'u_seed', 'u_resolution'];
/** The source the GPU compiles, and how many lines precede the caller's first line. */
export function shaderSource(frag: string, uniforms: Record<string, ShaderUniform>): {source: string; offset: number} {
  if (/^\s*#version/.test(frag)) return {source: frag, offset: 0};
  const declared = (name: string) => new RegExp(`uniform\\s+\\w+\\s+${name}\\s*;`).test(frag);
  const own = Object.entries(uniforms).filter(([name]) => !BUILT_IN.includes(name) && !declared(name)).map(([name, value]) => `uniform ${uniformValue(name, value).type} ${name};`);
  const head = ['#version 300 es', 'precision highp float;', 'precision highp int;', 'uniform float u_time;', 'uniform float u_frame;', 'uniform float u_seed;', 'uniform vec2 u_resolution;', ...own, 'out vec4 fragColor;', SHADER_LIB].join('\n');
  return {source: `${head}\n${frag}`, offset: head.split('\n').length};
}

const VERTEX = '#version 300 es\nvoid main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }';
type Program = {gl: WebGL2RenderingContext; program: WebGLProgram; key: string};

function compile(gl: WebGL2RenderingContext, frag: string, uniforms: Record<string, ShaderUniform>): WebGLProgram {
  const {source, offset} = shaderSource(frag, uniforms);
  const stage = (type: number, text: string, label: string, shift: number) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, text); gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
    // Line numbers point into the caller's own source, not the prelude.
    const log = (gl.getShaderInfoLog(shader) ?? '').replace(/(ERROR: \d+:)(\d+)/g, (_, head: string, line: string) => `${head}${Number(line) - shift}`).trim();
    throw new Error(`<Shader> ${label} shader failed to compile: ${log}`);
  };
  const program = gl.createProgram()!;
  gl.attachShader(program, stage(gl.VERTEX_SHADER, VERTEX, 'vertex', 0));
  gl.attachShader(program, stage(gl.FRAGMENT_SHADER, source, 'fragment', offset));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`<Shader> program failed to link: ${gl.getProgramInfoLog(program)}`);
  return program;
}

/** The numeric seed every shader sees as u_seed, in 0..1. */
export const shaderSeed = (seed: string | number) => random(`shader:${seed}`);

/** A canvas drawn by one fragment shader for the current frame; same frame, seed and uniforms, same pixels. */
export const Shader = forwardRef<HTMLCanvasElement, ShaderProps>(function Shader({frag, width, height, uniforms = {}, palette, seed = 0, pixelDensity = 1, style, className}, ref) {
  validateCanvasSize(width, height, 'Shader'); positive(pixelDensity, 'Shader pixelDensity');
  const frame = useCurrentFrame(), {fps} = useVideoConfig();
  const canvas = useRef<HTMLCanvasElement>(null), state = useRef<Program | null>(null), hold = useRef<number | null>(null);
  useImperativeHandle(ref, () => canvas.current!, []);
  // The first frame waits until the context exists and has drawn once.
  if (state.current === null && hold.current === null && typeof document !== 'undefined') hold.current = delayRender('<Shader> context');
  const all: Record<string, ShaderUniform> = {...(palette ? {u_ink: palette.ink, u_paper: palette.paper, u_accent: palette.accent, u_soft: palette.soft} : {}), ...uniforms};
  useLayoutEffect(() => {
    const release = () => { if (hold.current !== null) { continueRender(hold.current); hold.current = null; } };
    try {
      const key = `${frag}\u0000${Object.keys(all).sort().map(name => `${name}:${uniformValue(name, all[name]!).type}`).join(',')}`;
      if (state.current?.key !== key) {
        const gl = state.current?.gl ?? canvas.current!.getContext('webgl2', {preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false});
        if (!gl) throw new Error('<Shader> needs WebGL2, and this browser gave no webgl2 context');
        if (state.current) gl.deleteProgram(state.current.program);
        state.current = {gl, program: compile(gl, frag, all), key};
      }
      const {gl, program} = state.current;
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.useProgram(program);
      const set = (name: string, values: number[]) => {
        const at = gl.getUniformLocation(program, name);
        if (at === null) return;  // declared but unused: the compiler dropped it
        if (values.length === 1) gl.uniform1fv(at, values); else if (values.length === 2) gl.uniform2fv(at, values); else if (values.length === 3) gl.uniform3fv(at, values); else gl.uniform4fv(at, values);
      };
      set('u_time', [frame / fps]); set('u_frame', [frame]); set('u_seed', [shaderSeed(seed)]); set('u_resolution', [gl.drawingBufferWidth, gl.drawingBufferHeight]);
      for (const [name, value] of Object.entries(all)) set(name, uniformValue(name, value).values);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.finish();
    } finally { release(); }
  });
  // Chrome keeps about 16 live WebGL contexts; a shader shot that unmounts gives its context back so the next one never goes black.
  useEffect(() => () => { state.current?.gl.getExtension('WEBGL_lose_context')?.loseContext(); state.current = null; if (hold.current !== null) continueRender(hold.current); }, []);
  return <canvas ref={canvas} width={Math.round(width * pixelDensity)} height={Math.round(height * pixelDensity)} className={className} style={{width, height, ...style}} />;
});

/* ---------- presets: pure functions of u_time and u_seed; colours from the palette uniforms ---------- */
const PALETTE_UNIFORMS = 'uniform vec3 u_ink; uniform vec3 u_paper; uniform vec3 u_accent; uniform vec3 u_soft;\n';

/** Shared by the hero presets: 3D value noise and fbm on the integer hash, a 2D rotation, and a twinkling star field. */
const HERO_LIB = `
float hash3(vec3 c) { c = floor(c); return hash(vec2(c.x + c.z * 157.0, c.y - c.z * 113.0)); }
float vnoise3(vec3 p) { vec3 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), u.x), mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), u.x), u.y),
             mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), u.x), mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), u.x), u.y), u.z); }
float fbm3(vec3 p) { float v = 0.0, a = 0.5; for (int k = 0; k < 5; k++) { v += a * vnoise3(p); p = p * 2.03 + vec3(17.1, 9.3, 4.7); a *= 0.5; } return v; }
float worley3(vec3 p) { vec3 i = floor(p), f = fract(p); float d = 2.0;
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec3 g = vec3(x, y, z), c = i + g;
    d = min(d, length(g + vec3(hash3(c), hash3(c + 19.7), hash3(c + 41.3)) - f)); }
  return d; }
mat2 rot2(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float stars(vec2 frag) { vec2 c = floor(frag / 4.0); float h = hash(c + 40.0); vec2 o = vec2(hash(c + 17.0), hash(c + 31.0));
  return step(0.988, h) * smoothstep(0.4, 0.0, length(fract(frag / 4.0) - o)) * (0.55 + 0.45 * sin(u_time * 2.5 + h * 400.0)); }
`;

/** Image-like texture made in code. Each takes the palette (`palette` prop) and the named extra uniforms, all optional. */
export const shaders = {
  /** A macro eye: radial fibres in accent and soft round a breathing pupil, a dark limbal ring and one wet highlight. Extra: u_dilate 0..1. */
  iris: PALETTE_UNIFORMS + `uniform float u_dilate;
void main() {
  vec2 p = centred() * 1.15; float r = length(p); vec2 dir = p / max(r, 1e-4);
  float pupil = 0.11 + 0.05 * u_dilate + 0.012 * sin(u_time * 1.3);
  float spin = u_time * 0.04; vec2 twist = vec2(cos(spin) * dir.x - sin(spin) * dir.y, sin(spin) * dir.x + cos(spin) * dir.y);
  float fib = fbm(twist * 26.0 + vec2(r * 3.0)) * 0.7 + 0.3 * vnoise(twist * 90.0);
  vec3 iris = mix(u_accent * 0.55, mix(u_accent, u_soft, fib), smoothstep(pupil, 0.42, r) * 0.6 + fib * 0.6);
  iris *= 0.55 + 0.45 * smoothstep(pupil, pupil + 0.08, r);
  iris = mix(iris, u_ink, smoothstep(0.36, 0.44, r));
  vec3 sclera = mix(u_paper * 0.92, u_soft, 0.25 + 0.2 * fbm(p * 6.0)) * (1.0 - 0.6 * smoothstep(0.45, 0.9, r));
  vec3 color = r < 0.44 ? iris : sclera;
  color = mix(color, u_ink * 0.6, 1.0 - smoothstep(pupil - 0.006, pupil + 0.006, r));
  color += u_paper * 0.85 * smoothstep(0.07, 0.0, length(p - vec2(-0.12, 0.13)));
  fragColor = vec4(color, 1.0);
}`,
  /** A warped camera tunnel flying forward: banded walls of fbm texture, the far end fading to ink. Extra: u_speed (default 1). */
  tunnel: PALETTE_UNIFORMS + `uniform float u_speed;
void main() {
  vec2 p = centred(); float speed = u_speed > 0.0 ? u_speed : 1.0;
  p += 0.08 * vec2(sin(u_time * 0.7), cos(u_time * 0.5));
  float r = length(p); vec2 dir = p / max(r, 1e-4);
  float z = 0.35 / max(r, 1e-3) + u_time * speed;
  float bend = 0.4 * sin(z * 0.6 + u_time * 0.8);
  vec2 wall = vec2(dir.x * cos(bend) - dir.y * sin(bend), dir.x * sin(bend) + dir.y * cos(bend)) * 3.0;
  float tex = fbm(wall + vec2(z * 1.6, 0.0));
  float bands = smoothstep(0.45, 0.5, fract(z * 0.5)) * 0.35;
  vec3 color = mix(u_ink, mix(u_accent, u_soft, tex), clamp(tex * 1.2 + bands, 0.0, 1.0));
  color = mix(u_ink, color, smoothstep(0.02, 0.35, r)) + u_paper * 0.25 * smoothstep(0.12, 0.0, r);
  fragColor = vec4(color, 1.0);
}`,
  /** Flowing marbling: domain-warped fbm with thin paper veins. Extra: u_flow (default 1). */
  liquid: PALETTE_UNIFORMS + `uniform float u_flow;
void main() {
  vec2 p = centred() * 2.4; float t = u_time * (u_flow > 0.0 ? u_flow : 1.0);
  vec2 q = vec2(fbm(p + vec2(0.0, t * 0.12)), fbm(p + vec2(5.2, 1.3) - t * 0.1));
  float f = fbm(p + 3.5 * q + vec2(t * 0.15, -t * 0.07));
  vec3 color = mix(u_ink, u_accent, smoothstep(0.25, 0.7, f));
  color = mix(color, u_soft, smoothstep(0.55, 0.9, length(q) * f));
  color = mix(color, u_paper, smoothstep(0.86, 0.98, sin(f * 26.0) * 0.5 + 0.5) * 0.6);
  fragColor = vec4(color, 1.0);
}`,
  /** Film-grain halftone: dots sized by a slow noise field on paper, with per-frame grain. Extra: u_cell (dot pitch in px, default 10). */
  grainField: PALETTE_UNIFORMS + `uniform float u_cell;
void main() {
  float cell = u_cell > 0.0 ? u_cell : 10.0;
  vec2 grid = floor(gl_FragCoord.xy / cell), local = fract(gl_FragCoord.xy / cell) - 0.5;
  vec2 at = (grid + 0.5) * cell / min(u_resolution.x, u_resolution.y);
  float tone = fbm(at * 3.0 + vec2(u_time * 0.08, -u_time * 0.05));
  float inked = 1.0 - smoothstep(tone * 0.62 - 0.04, tone * 0.62, length(local));
  vec3 color = mix(u_paper, mix(u_ink, u_accent, smoothstep(0.4, 0.75, tone)), inked);
  color += (hash(gl_FragCoord.xy + vec2(u_frame * 7.0, u_frame * 3.0)) - 0.5) * 0.09;
  fragColor = vec4(color, 1.0);
}`,
  /** A soft mesh gradient: four palette points drifting on seeded ellipses, blended by inverse distance, with fine grain against banding. */
  gradientMesh: PALETTE_UNIFORMS + `
void main() {
  vec2 p = centred(); vec3 colors[4] = vec3[4](u_accent, u_soft, u_paper, mix(u_ink, u_accent, 0.4));
  vec3 sum = vec3(0.0); float total = 0.0;
  for (int i = 0; i < 4; i++) {
    float fi = float(i), phase = hash(vec2(fi, 3.0)) * 6.2832;
    vec2 c = vec2(hash(vec2(fi, 1.0)) - 0.5, hash(vec2(fi, 2.0)) - 0.5) * 0.9 + 0.22 * vec2(sin(u_time * 0.21 + phase), cos(u_time * 0.17 + phase * 1.3));
    float w = 1.0 / pow(length(p - c) + 0.08, 2.4);
    sum += colors[i] * w; total += w;
  }
  fragColor = vec4(sum / total + (hash(gl_FragCoord.xy + u_frame) - 0.5) * 0.02, 1.0);
}`,
  /** Light-speed streaks: seeded slices racing out of the centre, heads bright, over ink with a core glow. Extra: u_speed (default 1). */
  streaks: PALETTE_UNIFORMS + `uniform float u_speed;
void main() {
  vec2 p = centred(); float r = length(p), a = atan(p.y, p.x) / 6.2832 + 0.5;
  float speed = u_speed > 0.0 ? u_speed : 1.0; vec3 color = u_ink;
  for (int layer = 0; layer < 3; layer++) {
    float slices = 90.0 + 70.0 * float(layer), slice = floor(a * slices), fl = float(layer);
    float lane = abs(fract(a * slices) - 0.5) * 2.0;
    float z = fract(hash(vec2(slice, fl)) + u_time * speed * (0.35 + 0.5 * hash(vec2(slice, fl + 9.0))));
    float head = z * z * 1.2, len = 0.05 + 0.25 * z;
    float on = smoothstep(head - len, head, r) * (1.0 - smoothstep(head, head + 0.01, r)) * (1.0 - smoothstep(0.2, 0.9, lane));
    color += mix(u_accent, u_paper, smoothstep(head - len * 0.3, head, r)) * on * (0.5 + 0.5 * z) * step(0.35, hash(vec2(slice, fl + 4.0)));
  }
  color += u_soft * 0.5 * smoothstep(0.25, 0.0, r);
  fragColor = vec4(color, 1.0);
}`,
  /** An isometric cube field: seeded column heights that jump on every beat in a wave from the centre. Extra: u_beat (seconds per beat, default 0.5), u_cells (columns across the short side, default 10). */
  cubeField: PALETTE_UNIFORMS + `uniform float u_beat; uniform float u_cells;
float columnHeight(vec2 cell) {
  float beat = u_beat > 0.0 ? u_beat : 0.5;
  float phase = fract((u_time - length(cell) * 0.04) / beat);
  return 0.4 + 1.6 * hash(cell) + 1.2 * exp(-phase * 6.0) * hash(cell + vec2(31.0, 7.0));
}
void main() {
  float s = 1.0 / (u_cells > 0.0 ? u_cells : 10.0);
  vec2 p = centred() + vec2(u_time * 0.02, u_time * 0.01);
  float d0 = -2.0 * p.y / s;
  vec3 color = u_ink * 0.8;
  for (int k = 9; k >= -2; k--) {
    // Exactly one column of the row d covers p.x: the one at floor(x / s) or the next, whichever has d's parity.
    float d = floor(d0) + float(k), hit = 0.0, m = floor(p.x / s);
    if (mod(m + d, 2.0) != 0.0) m += 1.0;
    {
      vec2 cell = vec2((d + m) * 0.5, (d - m) * 0.5);
      float h = columnHeight(cell);
      vec2 rel = p - vec2(m * s, -d * s * 0.5 + h * s);
      float dx = rel.x / s, dy = rel.y / s;
      if (abs(dx) + abs(dy) * 2.0 <= 1.0) { color = mix(u_soft, u_paper, 0.4 + 0.3 * hash(cell)); hit = 1.0; }
      else if (abs(dx) <= 1.0 && dy < -0.5 * (1.0 - abs(dx)) && dy > -0.5 * (1.0 - abs(dx)) - h) { color = dx < 0.0 ? u_accent : mix(u_accent, u_ink, 0.45); hit = 1.0; }
      if (hit > 0.0) {
        float edge = min(abs(abs(dx) + abs(dy) * 2.0 - 1.0), abs(dx));
        color = mix(u_ink, color, smoothstep(0.0, 0.05, edge));
      }
    }
    if (hit > 0.0) break;
  }
  fragColor = vec4(color, 1.0);
}`,
  /** A lit planet: oceans with a sun glint, seeded continents and ice caps, drifting clouds, a day/night terminator with a warm
   * twilight band, city lights on the night side (u_accent, or warm white) and an atmosphere rim and halo, over a star field.
   * Extra: u_spin (radians per second, default 0.12), u_light (vec3 towards the sun, default upper left front), u_zoom (radius as
   * a share of the short side, default 0.36), u_center (vec2 offset in short-side units), u_tilt (extra axial tilt, radians). */
  planet: PALETTE_UNIFORMS + HERO_LIB + `uniform float u_spin; uniform vec3 u_light; uniform float u_zoom; uniform vec2 u_center; uniform float u_tilt;
void main() {
  vec2 p = centred(); float R = u_zoom > 0.0 ? u_zoom : 0.36; vec2 q = (p - u_center) / R; float r = length(q);
  vec3 L = length(u_light) > 0.0 ? normalize(u_light) : normalize(vec3(-0.75, 0.35, 0.55));
  vec3 city = length(u_accent) > 0.0 ? u_accent : vec3(1.0, 0.72, 0.38);
  vec3 atm = vec3(0.32, 0.58, 1.0);
  vec3 color = u_ink * 0.5 + vec3(stars(gl_FragCoord.xy));
  float lit = smoothstep(-0.6, 0.7, dot(q / max(r, 1e-4), normalize(L.xy + 1e-4)) + L.z * 0.4);
  if (r < 1.0) {
    vec3 n = vec3(q, sqrt(1.0 - r * r)), s = n;
    s.xy = rot2(0.41 + u_tilt) * s.xy; s.xz = rot2(u_time * (u_spin != 0.0 ? u_spin : 0.12)) * s.xz;
    float land = fbm3(s * 2.3 + 11.0) + 0.18 * (fbm3(s * 13.0) - 0.5), coast = smoothstep(0.5, 0.515, land), lat = abs(s.y);
    vec3 ocean = mix(vec3(0.01, 0.04, 0.13), vec3(0.02, 0.14, 0.32), fbm3(s * 7.0));
    vec3 ground = mix(vec3(0.12, 0.24, 0.08), vec3(0.46, 0.37, 0.2), clamp(smoothstep(0.54, 0.7, land) + 0.35 * fbm3(s * 11.0) - 0.1, 0.0, 1.0));
    vec3 albedo = mix(ocean, ground, coast);
    albedo = mix(albedo, vec3(0.9, 0.93, 0.97), smoothstep(0.84, 0.9, lat + 0.06 * fbm3(s * 8.0)));
    vec3 sc = s; sc.xz = rot2(u_time * 0.025) * sc.xz;
    float cloud = smoothstep(0.5, 0.78, 0.7 * fbm3(sc * 3.1 + vec3(0.0, u_time * 0.01, 0.0)) + 0.35 * fbm3(sc * 10.0));
    float ndl = dot(n, L), day = smoothstep(-0.1, 0.2, ndl);
    vec3 c = albedo * (max(ndl, 0.0) * 1.7 + 0.015);
    c += (1.0 - coast) * pow(max(dot(n, normalize(L + vec3(0.0, 0.0, 1.0))), 0.0), 70.0) * vec3(1.0, 0.92, 0.8) * day;
    c = mix(c, vec3(1.0) * (max(ndl, 0.0) * 1.35 + 0.01), cloud * 0.9);
    c += vec3(1.0, 0.45, 0.2) * 0.07 * exp(-pow((ndl - 0.03) / 0.07, 2.0)) * (0.3 + cloud);
    float lights = coast * (1.0 - cloud) * smoothstep(0.42, 0.68, fbm3(s * 9.0)) * smoothstep(0.35, 0.8, vnoise3(s * 200.0)) * 1.6 * (1.0 - smoothstep(0.75, 0.85, lat));
    c += city * lights * (1.0 - day) * 1.6;
    c += atm * pow(1.0 - n.z, 2.6) * smoothstep(-0.35, 0.45, ndl) * 1.1;
    color = mix(color, c, smoothstep(1.0, 1.0 - 1.5 * fwidth(r), r));
  }
  color += atm * exp(-max(r - 1.0, 0.0) / 0.045) * lit * 0.85 * step(1.0, r);
  fragColor = vec4(1.0 - exp(-color * 1.25), 1.0);
}`,
  /** A star: boiling granulation and slow sunspots on a limb-darkened disc, a streamered corona and an anamorphic flare. Colours
   * from paper (hot), soft (mid) and accent (cool limb), or a realistic sun without a palette. Extra: u_zoom (radius, default 0.26),
   * u_center (vec2), u_flare (streak strength, default 1). */
  sun: PALETTE_UNIFORMS + HERO_LIB + `uniform float u_zoom; uniform vec2 u_center; uniform float u_flare;
void main() {
  vec2 p = centred(); float R = u_zoom > 0.0 ? u_zoom : 0.26; vec2 q = (p - u_center) / R; float r = length(q);
  vec3 hot = length(u_paper) > 0.0 ? u_paper : vec3(1.0, 0.96, 0.86), mid = length(u_soft) > 0.0 ? u_soft : vec3(1.0, 0.6, 0.16), cool = length(u_accent) > 0.0 ? u_accent : vec3(0.85, 0.2, 0.03);
  vec3 color = u_ink * 0.4 + 0.5 * vec3(stars(gl_FragCoord.xy));
  float d = max(r - 1.0, 0.0); vec2 dir = q / max(r, 1e-4);
  float streamer = fbm(dir * 5.0 + vec2(u_time * 0.04, -u_time * 0.03)) + 0.4 * fbm(dir * 17.0 - u_time * 0.05);
  color += mid * exp(-d / (0.08 + 0.5 * streamer * streamer)) * 0.9 + hot * exp(-d / 0.03) * 0.7 + cool * exp(-d / 0.9) * 0.25;
  if (r < 1.0) {
    vec3 n = vec3(q, sqrt(1.0 - r * r)), s = n; s.xz = rot2(u_time * 0.04) * s.xz;
    float gran = 0.35 * fbm3(s * 8.0 + vec3(0.0, 0.0, u_time * 0.1)) + 0.65 * (1.0 - smoothstep(0.1, 0.95, worley3(s * 42.0 + vec3(0.0, u_time * 0.35, 0.0))));
    float spot = smoothstep(0.7, 0.78, fbm3(s * 3.2 + 4.0));
    float limb = pow(n.z, 0.5);
    vec3 c = mix(cool, mid, limb); c = mix(c, hot, pow(limb, 2.5) * 0.85);
    c *= (0.55 + 0.9 * gran) * (1.0 - 0.8 * spot) * (0.4 + 0.8 * limb);
    color = mix(color, c * 1.5, smoothstep(1.0, 1.0 - 1.5 * fwidth(r), r));
  }
  float flare = u_flare > 0.0 ? u_flare : 1.0; vec2 f = p - u_center;
  color += mix(hot, mid, 0.4) * flare * (exp(-abs(f.y) / 0.0035) * exp(-abs(f.x) / 0.7) * 0.9 + exp(-abs(f.x) / 0.002) * exp(-abs(f.y) / 0.25) * 0.25);
  for (int k = 1; k <= 3; k++) { vec2 g = -u_center * (0.4 * float(k)); color += mid * flare * 0.05 * smoothstep(0.025 * float(k + 1), 0.02 * float(k + 1), length(p - g)); }
  fragColor = vec4(1.0 - exp(-color * 1.1), 1.0);
}`,
  /** A raymarched hero object. u_shape 0 a bust (cranium, face, nose, brow, eye sockets, lips, ears, neck, shoulders), 1 a (2,3)
   * torus knot, 2 a breathing blob. u_style 0 glossy (soft body, accent rim, paper specular), 1 scanline (horizontal contour slices
   * lit by the form, an accent glow inside), 2 wireframe (contour and meridian lines). u_mix 0..1 sweeps the style into glossy from
   * the top down with a bright seam. u_orbit is the camera angle round the vertical axis (radians, drive it from the frame); u_zoom
   * (default 1), u_slices (lines per unit, default 15). Needs a palette. */
  sliced: PALETTE_UNIFORMS + HERO_LIB + `uniform float u_shape; uniform float u_style; uniform float u_mix; uniform float u_orbit; uniform float u_zoom; uniform float u_slices;
float sdEll(vec3 p, vec3 r) { float k0 = length(p / r), k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / k1; }
float smin(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
float smax(float a, float b, float k) { return -smin(-a, -b, k); }
float bust(vec3 p) {
  vec3 m = vec3(abs(p.x), p.yz);
  float d = sdEll(p - vec3(0.0, 0.32, -0.08), vec3(0.55, 0.6, 0.66));
  d = smin(d, sdEll(p - vec3(0.0, -0.08, 0.08), vec3(0.46, 0.5, 0.5)), 0.18);
  d = smin(d, sdEll(m - vec3(0.25, -0.3, 0.16), vec3(0.2, 0.2, 0.25)), 0.12);
  d = smin(d, sdEll(p - vec3(0.0, -0.48, 0.28), vec3(0.2, 0.14, 0.18)), 0.14);
  d = smin(d, sdEll(p - vec3(0.0, 0.2, 0.49), vec3(0.33, 0.07, 0.13)), 0.08);
  d = smax(d, -sdEll(m - vec3(0.17, 0.09, 0.61), vec3(0.1, 0.055, 0.08)), 0.08);
  vec3 np = p - vec3(0.0, -0.05, 0.55); np.yz = rot2(0.5) * np.yz;
  d = smin(d, sdEll(np, vec3(0.06, 0.16, 0.085)), 0.05);
  d = smin(d, sdEll(p - vec3(0.0, -0.31, 0.49), vec3(0.11, 0.03, 0.05)), 0.05);
  d = smin(d, sdEll(m - vec3(0.55, 0.02, -0.04), vec3(0.05, 0.14, 0.09)), 0.05);
  d = smin(d, sdEll(p - vec3(0.0, -0.7, -0.1), vec3(0.29, 0.4, 0.3)), 0.14);
  return smin(d, sdEll(p - vec3(0.0, -1.5, -0.06), vec3(1.15, 0.62, 0.55)), 0.32);
}
float knot(vec3 p) {
  p = p * 1.3; p.xy = rot2(u_time * 0.3) * p.xy; float r = length(p.xy), a = atan(p.y, p.x), best = 1e9;
  for (int k = 0; k < 2; k++) { vec2 q = rot2((a + 6.2832 * float(k)) * 1.5) * vec2(r - 0.72, p.z); q.x -= 0.3; best = min(best, length(q) - 0.13); }
  return best * 0.6 / 1.3;
}
float blob(vec3 p) { vec3 w = p + 0.25 * sin(p.yzx * 2.3 + u_time * vec3(0.7, 0.9, 1.1)); return (length(p) - 0.8 + 0.14 * sin(3.1 * w.x) * sin(2.7 * w.y + u_time) * sin(3.3 * w.z) + 0.05 * sin(7.0 * w.y - u_time * 1.5)) * 0.6; }
float scene(vec3 p) { float s = floor(u_shape + 0.5); return s < 0.5 ? bust(p) : s < 1.5 ? knot(p) : blob(p); }
vec3 normalAt(vec3 p) { vec2 e = vec2(0.0015, -0.0015);
  return normalize(e.xyy * scene(p + e.xyy) + e.yyx * scene(p + e.yyx) + e.yxy * scene(p + e.yxy) + e.xxx * scene(p + e.xxx)); }
void main() {
  vec2 p = centred(); bool head = floor(u_shape + 0.5) < 0.5;
  vec3 target = head ? vec3(0.0, -0.3, 0.0) : vec3(0.0);
  vec3 ro = target + vec3(sin(u_orbit) * 4.4, head ? 0.35 : 0.0, cos(u_orbit) * 4.4);
  vec3 fw = normalize(target - ro), right = normalize(cross(fw, vec3(0.0, 1.0, 0.0))), up = cross(right, fw);
  vec3 rd = normalize(p.x * right + p.y * up + 1.6 * (u_zoom > 0.0 ? u_zoom : 1.0) * fw);
  float style = floor(u_style + 0.5), N = u_slices > 0.0 ? u_slices : 15.0;
  vec3 bg = u_ink + u_accent * 0.1 * exp(-length(p) / 0.35) + u_soft * 0.04 * exp(-length(p) / 0.8);
  if (style > 0.5 && style < 1.5) { float y = gl_FragCoord.y / u_resolution.y * 70.0; bg += u_soft * 0.05 * smoothstep(0.3, 0.0, abs(fract(y) - 0.5)); }
  vec3 color = bg;
  // Bounding sphere first: most of the frame never marches.
  vec3 oc = ro - target; float b = dot(oc, rd), disc = b * b - dot(oc, oc) + 2.4 * 2.4;
  float t = disc > 0.0 ? max(0.0, -b - sqrt(disc)) : 1e9, hit = 0.0, glowAcc = 0.0;
  for (int i = 0; i < 110 && t < 9.0; i++) {
    float d = scene(ro + rd * t);
    glowAcc += exp(-d * 18.0) * 0.012;
    if (d < 0.0008 * t) { hit = 1.0; break; }
    t += d;
  }
  if (hit > 0.0) {
    vec3 pos = ro + rd * t, n = normalAt(pos), v = -rd;
    vec3 key = normalize(-0.55 * right + 0.7 * up - 0.6 * fw), rim = normalize(0.8 * right + 0.25 * up + 0.9 * fw);
    float diff = max(dot(n, key), 0.0), fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
    float ao = clamp(0.5 + 0.5 * scene(pos + n * 0.12) / 0.12, 0.0, 1.0);
    vec3 glossy = u_soft * (0.08 + 0.85 * diff) * ao + u_accent * (fres * 1.3 + 0.7 * pow(max(dot(n, rim), 0.0), 2.0))
      + u_paper * pow(max(dot(reflect(-key, n), v), 0.0), 60.0) * 1.1 + mix(u_ink, u_soft, reflect(rd, n).y * 0.5 + 0.5) * 0.12;
    vec3 styled = glossy;
    if (style > 0.5 && style < 1.5) {
      float y = pos.y * N, w = fwidth(y), f = abs(fract(y) - 0.5);
      float line = 1.0 - smoothstep(0.15 - w, 0.15 + w, f);
      vec3 ink = mix(u_paper, u_soft, 0.3) * (0.35 + 1.1 * diff + 1.4 * fres);
      vec3 gap = u_accent * 0.6 * pow(max(dot(n, v), 0.0), 3.0) * ao + u_soft * 0.06 + u_ink * 0.5;
      styled = mix(gap, ink, line);
    } else if (style > 1.5) {
      float y = pos.y * N, ang = atan(pos.x - target.x, pos.z - target.z) / 3.1416 * N * 0.9;
      float ly = 0.5 - abs(fract(y) - 0.5), la = 0.5 - abs(fract(ang) - 0.5);
      float line = max(1.0 - smoothstep(0.025, 0.025 + 1.5 * fwidth(y), ly), 1.0 - smoothstep(0.025, 0.025 + 1.5 * fwidth(ang), la));
      styled = mix(u_ink * 0.6 + u_soft * 0.08 * fres, mix(u_accent, u_paper, 0.35) * (0.5 + 0.7 * diff + fres), line) + u_accent * fres * 0.5;
    }
    float edge = mix(1.25, -2.0, clamp(u_mix, 0.0, 1.0)), g = smoothstep(edge - 0.04, edge + 0.04, pos.y);
    color = mix(styled, glossy, style > 0.5 ? g : 1.0);
    color += u_paper * exp(-abs(pos.y - edge) / 0.012) * step(0.001, u_mix) * step(u_mix, 0.999) * 1.2;
  }
  color += u_accent * glowAcc * (1.0 - hit) * 0.6;
  fragColor = vec4(1.0 - exp(-color * 1.15), 1.0);
}`,
  /** Light orbits round a sphere: tilted rings in soft and paper, a light head racing on each with an accent trail, the back halves
   * passing behind a shaded sphere with an accent rim and halo, over a star field. Extra: u_rings (1..8, default 5), u_speed (default 1),
   * u_zoom (default 1). Needs a palette. */
  orbits: PALETTE_UNIFORMS + HERO_LIB + `uniform float u_rings; uniform float u_speed; uniform float u_zoom;
void main() {
  vec2 p = centred() / (u_zoom > 0.0 ? u_zoom : 1.0); float R = 0.17, r = length(p);
  float count = u_rings > 0.0 ? u_rings : 6.0, speed = u_speed > 0.0 ? u_speed : 1.0;
  vec3 color = u_ink * 0.7 + 0.6 * vec3(stars(gl_FragCoord.xy)) + u_accent * 0.08 * exp(-r / 0.4), back = vec3(0.0), front = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    float fi = float(i); if (fi >= count) break;
    float rad = 0.26 + 0.085 * fi + 0.03 * hash(vec2(fi, 1.0)), cy = cos(1.15 + 0.25 * hash(vec2(fi, 2.0)));
    float phi = (hash(vec2(fi, 3.0)) - 0.5) * 1.1 + 0.04 * sin(u_time * 0.3 + fi);
    vec2 e = rot2(-phi) * p; e.y /= cy; float th = atan(e.y, e.x);
    float d = abs(length(e) - rad) * mix(cy, 1.0, abs(cos(th)));
    float dirn = mod(fi, 2.0) < 1.0 ? 1.0 : -1.0, head = hash(vec2(fi, 5.0)) * 6.2832 + u_time * speed * (0.5 + 0.5 * hash(vec2(fi, 4.0))) * dirn;
    float trail = exp(-mod((head - th) * dirn, 6.2832) * 0.9);
    vec3 ring = mix(u_soft, u_paper, hash(vec2(fi, 6.0)));
    vec3 c = ring * (exp(-d / 0.0025) * 0.45 + exp(-d / 0.012) * 0.1) + mix(u_accent, u_paper, trail * trail) * trail * (exp(-d / 0.003) * 2.2 + exp(-d / 0.022) * 0.6);
    if (sin(th) > 0.0) back += c; else front += c;
    vec2 hp = rot2(phi) * (vec2(cos(head), sin(head) * cy) * rad);
    vec3 dot_ = u_paper * exp(-length(p - hp) / 0.006) * 1.5 + u_accent * exp(-length(p - hp) / 0.035) * 0.5;
    if (sin(head) > 0.0) back += dot_; else front += dot_;
  }
  float mask = smoothstep(R, R - 1.5 * fwidth(r), r);
  vec3 sphere = u_ink * 0.4;
  if (r < R) {
    vec3 n = vec3(p / R, sqrt(max(0.0, 1.0 - r * r / (R * R)))), L = normalize(vec3(-0.5, 0.6, 0.6)), s = n; s.xz = rot2(u_time * 0.2) * s.xz;
    sphere = mix(u_ink, u_soft, 0.35 + 0.3 * fbm3(s * 5.0)) * (0.08 + 0.8 * max(dot(n, L), 0.0)) + u_accent * pow(1.0 - n.z, 2.5) * 1.3
      + u_paper * pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 40.0) * 0.7;
  }
  color = mix(color + back, sphere, mask) + front + u_accent * exp(-max(r - R, 0.0) / 0.04) * 0.45 * (1.0 - mask);
  fragColor = vec4(1.0 - exp(-color * 1.3), 1.0);
}`,
} as const;
export type ShaderPreset = keyof typeof shaders;
