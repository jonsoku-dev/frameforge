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
} as const;
export type ShaderPreset = keyof typeof shaders;
