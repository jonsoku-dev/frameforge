import {assertValidInterpolateEasingOption, assertValidInterpolatePosterizeOption, type EasingFunction} from '../core/math';
type Pt = {x: number; y: number};
export type Part = {start: Pt; end: Pt; length: number; getPointAtLength(pos: number): Pt; getTangentAtLength(pos: number): Pt};
export type BoundingBox = {x1: number; y1: number; x2: number; y2: number; viewBox: string; width: number; height: number};
type MInstruction = {type: 'M'; x: number; y: number};
type LInstruction = {type: 'L'; x: number; y: number};
type CInstruction = {type: 'C'; cp1x: number; cp1y: number; cp2x: number; cp2y: number; x: number; y: number};
type QInstruction = {type: 'Q'; cpx: number; cpy: number; x: number; y: number};
type ZInstruction = {type: 'Z'};
export type ReducedInstruction = MInstruction | LInstruction | CInstruction | ZInstruction;
export type AbsoluteInstruction = ReducedInstruction | QInstruction
  | {type: 'A'; rx: number; ry: number; xAxisRotation: number; largeArcFlag: boolean; sweepFlag: boolean; x: number; y: number}
  | {type: 'S'; cpx: number; cpy: number; x: number; y: number} | {type: 'T'; x: number; y: number} | {type: 'H'; x: number} | {type: 'V'; y: number};
export type Instruction = AbsoluteInstruction
  | {type: 'm'; dx: number; dy: number} | {type: 'l'; dx: number; dy: number} | {type: 'h'; dx: number} | {type: 'v'; dy: number}
  | {type: 'c'; cp1dx: number; cp1dy: number; cp2dx: number; cp2dy: number; dx: number; dy: number} | {type: 's'; cpdx: number; cpdy: number; dx: number; dy: number}
  | {type: 'q'; cpdx: number; cpdy: number; dx: number; dy: number} | {type: 't'; dx: number; dy: number}
  | {type: 'a'; rx: number; ry: number; xAxisRotation: number; largeArcFlag: boolean; sweepFlag: boolean; dx: number; dy: number} | {type: 'z'};
export type WarpPathFn = (point: Pt) => Pt;
export type CenterPathTarget = {x: number; y: number};
export type InterpolatePathsOptions = {easing?: EasingFunction | readonly EasingFunction[]; posterize?: number; extrapolateLeft?: 'extend' | 'clamp' | 'wrap'; extrapolateRight?: 'extend' | 'clamp' | 'wrap'};

// Parsing: command letters delimit chunks; anything that is not a number inside a chunk is skipped, arc flags are single characters.
const ARITY: Record<string, number> = {M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0};
function tokens(command: string, chunk: string): number[] {
  const NUMBER = /[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/g, out: number[] = [];
  if (command.toUpperCase() !== 'A') { for (const m of chunk.matchAll(NUMBER)) out.push(Number(m[0])); return out; }
  let pos = 0;
  while (pos < chunk.length) {
    if (out.length % 7 === 3 || out.length % 7 === 4) {
      while (pos < chunk.length && /[\s,]/.test(chunk[pos]!)) pos++;
      if (pos >= chunk.length) break;
      const flag = chunk[pos++];
      if (flag !== '0' && flag !== '1') throw new Error(`Malformed path data: ${command} has an invalid value at "${chunk.slice(pos - 1)}"`);
      out.push(Number(flag));
    } else {
      NUMBER.lastIndex = pos;
      const m = NUMBER.exec(chunk);
      if (!m) break;
      out.push(Number(m[0])); pos = NUMBER.lastIndex;
    }
  }
  return out;
}
const build = (type: string, n: number[]): Instruction => {
  const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0, g = 0] = n;
  switch (type) {
    case 'M': return {type, x: a, y: b}; case 'm': return {type, dx: a, dy: b}; case 'L': return {type, x: a, y: b}; case 'l': return {type, dx: a, dy: b};
    case 'H': return {type, x: a}; case 'h': return {type, dx: a}; case 'V': return {type, y: a}; case 'v': return {type, dy: a};
    case 'C': return {type, cp1x: a, cp1y: b, cp2x: c, cp2y: d, x: e, y: f}; case 'c': return {type, cp1dx: a, cp1dy: b, cp2dx: c, cp2dy: d, dx: e, dy: f};
    case 'S': return {type, cpx: a, cpy: b, x: c, y: d}; case 's': return {type, cpdx: a, cpdy: b, dx: c, dy: d};
    case 'Q': return {type, cpx: a, cpy: b, x: c, y: d}; case 'q': return {type, cpdx: a, cpdy: b, dx: c, dy: d};
    case 'T': return {type, x: a, y: b}; case 't': return {type, dx: a, dy: b};
    case 'A': return {type, rx: a, ry: b, xAxisRotation: c, largeArcFlag: d === 1, sweepFlag: e === 1, x: f, y: g};
    case 'a': return {type, rx: a, ry: b, xAxisRotation: c, largeArcFlag: d === 1, sweepFlag: e === 1, dx: f, dy: g};
    default: return {type: 'Z'};
  }
};
export function parsePath(path: string): Instruction[] {
  if (!path) throw new Error('No path provided');
  const parts = path.split(/([MmLlHhVvCcSsQqTtAaZz])/);
  if (parts.length < 2) throw new Error(`No path elements found in string ${path}`);
  const out: Instruction[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    const command = parts[i]!, arity = ARITY[command.toUpperCase()]!, numbers = tokens(command, parts[i + 1]!);
    if (arity === 0) { if (numbers.length) throw new Error(`Malformed path data: ${command} was expected to have a multiple of 0 numbers`); out.push({type: 'Z'}); continue; }
    if (!numbers.length) throw new Error(`Malformed path data: ${command} was expected to have numbers afterwards`);
    if (numbers.length % arity) throw new Error(`Malformed path data: ${command} was expected to have a multiple of ${arity} numbers, but got ${numbers.length}`);
    for (let k = 0; k < numbers.length; k += arity) {
      const type = k > 0 && command === 'M' ? 'L' : k > 0 && command === 'm' ? 'l' : command;
      out.push(build(type, numbers.slice(k, k + arity)));
    }
  }
  return out;
}
const flag = (b: boolean) => (b ? 1 : 0);
export function serializeInstructions(path: readonly Instruction[]): string {
  return path.map(i => {
    switch (i.type) {
      case 'M': case 'L': case 'T': return `${i.type} ${i.x} ${i.y}`; case 'm': case 'l': case 't': return `${i.type} ${i.dx} ${i.dy}`;
      case 'H': return `H ${i.x}`; case 'h': return `h ${i.dx}`; case 'V': return `V ${i.y}`; case 'v': return `v ${i.dy}`;
      case 'C': return `C ${i.cp1x} ${i.cp1y} ${i.cp2x} ${i.cp2y} ${i.x} ${i.y}`; case 'c': return `c ${i.cp1dx} ${i.cp1dy} ${i.cp2dx} ${i.cp2dy} ${i.dx} ${i.dy}`;
      case 'S': case 'Q': return `${i.type} ${i.cpx} ${i.cpy} ${i.x} ${i.y}`; case 's': case 'q': return `${i.type} ${i.cpdx} ${i.cpdy} ${i.dx} ${i.dy}`;
      case 'A': return `A ${i.rx} ${i.ry} ${i.xAxisRotation} ${flag(i.largeArcFlag)} ${flag(i.sweepFlag)} ${i.x} ${i.y}`;
      case 'a': return `a ${i.rx} ${i.ry} ${i.xAxisRotation} ${flag(i.largeArcFlag)} ${flag(i.sweepFlag)} ${i.dx} ${i.dy}`;
      default: return 'Z';
    }
  }).join(' ');
}

// Walking: each instruction made absolute, with the pen position after it.
type Step = {abs: AbsoluteInstruction; x: number; y: number};
function walk(instructions: readonly Instruction[]): Step[] {
  let x = 0, y = 0, sx = 0, sy = 0;
  return instructions.map(i => {
    let abs: AbsoluteInstruction;
    switch (i.type) {
      case 'm': abs = {type: 'M', x: x + i.dx, y: y + i.dy}; break; case 'l': abs = {type: 'L', x: x + i.dx, y: y + i.dy}; break;
      case 'h': abs = {type: 'H', x: x + i.dx}; break; case 'v': abs = {type: 'V', y: y + i.dy}; break;
      case 'c': abs = {type: 'C', cp1x: x + i.cp1dx, cp1y: y + i.cp1dy, cp2x: x + i.cp2dx, cp2y: y + i.cp2dy, x: x + i.dx, y: y + i.dy}; break;
      case 's': abs = {type: 'S', cpx: x + i.cpdx, cpy: y + i.cpdy, x: x + i.dx, y: y + i.dy}; break; case 'q': abs = {type: 'Q', cpx: x + i.cpdx, cpy: y + i.cpdy, x: x + i.dx, y: y + i.dy}; break;
      case 't': abs = {type: 'T', x: x + i.dx, y: y + i.dy}; break;
      case 'a': abs = {type: 'A', rx: i.rx, ry: i.ry, xAxisRotation: i.xAxisRotation, largeArcFlag: i.largeArcFlag, sweepFlag: i.sweepFlag, x: x + i.dx, y: y + i.dy}; break;
      case 'z': abs = {type: 'Z'}; break; default: abs = i;
    }
    if (abs.type === 'Z') { x = sx; y = sy; } else if (abs.type === 'H') x = abs.x; else if (abs.type === 'V') y = abs.y; else { x = abs.x; y = abs.y; if (abs.type === 'M') { sx = x; sy = y; } }
    return {abs, x, y};
  });
}
export const normalizePath = (path: string): string => serializeInstructions(walk(parsePath(path)).map(s => s.abs));

// Arc to cubic: SVG implementation notes F.6.5 center parameterization, one cubic per quarter turn.
const TAU = Math.PI * 2;
const angleBetween = (ux: number, uy: number, vx: number, vy: number) => {
  const sign = ux * vy - uy * vx < 0 ? -1 : 1;
  return sign * Math.acos(Math.max(-1, Math.min(1, ux * vx + uy * vy)));
};
function arcToCubic(x1: number, y1: number, rx: number, ry: number, phi: number, large: boolean, sweep: boolean, x2: number, y2: number): CInstruction[] {
  const sinPhi = Math.sin(phi * TAU / 360), cosPhi = Math.cos(phi * TAU / 360);
  const x1p = cosPhi * (x1 - x2) / 2 + sinPhi * (y1 - y2) / 2, y1p = -sinPhi * (x1 - x2) / 2 + cosPhi * (y1 - y2) / 2;
  if ((x1p === 0 && y1p === 0) || rx === 0 || ry === 0) return [];
  rx = Math.abs(rx); ry = Math.abs(ry);
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) { rx *= Math.sqrt(lambda); ry *= Math.sqrt(lambda); }
  const rxSq = rx * rx, rySq = ry * ry, x1pSq = x1p * x1p, y1pSq = y1p * y1p;
  let radicant = rxSq * rySq - rxSq * y1pSq - rySq * x1pSq;
  if (radicant < 0) radicant = 0;
  radicant /= rxSq * y1pSq + rySq * x1pSq;
  radicant = Math.sqrt(radicant) * (large === sweep ? -1 : 1);
  const cxp = radicant * rx / ry * y1p, cyp = radicant * -ry / rx * x1p;
  const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2, cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;
  const v1x = (x1p - cxp) / rx, v1y = (y1p - cyp) / ry, v2x = (-x1p - cxp) / rx, v2y = (-y1p - cyp) / ry;
  let theta = angleBetween(1, 0, v1x, v1y), delta = angleBetween(v1x, v1y, v2x, v2y);
  if (!sweep && delta > 0) delta -= TAU;
  if (sweep && delta < 0) delta += TAU;
  const segments = Math.max(Math.ceil(Math.abs(delta) / (TAU / 4)), 1);
  delta /= segments;
  const out: CInstruction[] = [];
  for (let i = 0; i < segments; i++) {
    const alpha = 4 / 3 * Math.tan(delta / 4);
    const ax = Math.cos(theta), ay = Math.sin(theta), bx = Math.cos(theta + delta), by = Math.sin(theta + delta);
    const unit = [ax - ay * alpha, ay + ax * alpha, bx + by * alpha, by - bx * alpha, bx, by];
    const p: number[] = [];
    for (let k = 0; k < 6; k += 2) { const x = unit[k]! * rx, y = unit[k + 1]! * ry; p.push(cosPhi * x - sinPhi * y + cx, sinPhi * x + cosPhi * y + cy); }
    out.push({type: 'C', cp1x: p[0]!, cp1y: p[1]!, cp2x: p[2]!, cp2y: p[3]!, x: p[4]!, y: p[5]!});
    theta += delta;
  }
  return out;
}
const quadToCubic = (x0: number, y0: number, q: QInstruction): CInstruction =>
  ({type: 'C', cp1x: x0 + 2 / 3 * (q.cpx - x0), cp1y: y0 + 2 / 3 * (q.cpy - y0), cp2x: q.x + 2 / 3 * (q.cpx - q.x), cp2y: q.y + 2 / 3 * (q.cpy - q.y), x: q.x, y: q.y});
function reduceAbsolute(instructions: readonly AbsoluteInstruction[]): ReducedInstruction[] {
  let x = 0, y = 0, sx = 0, sy = 0, cpx = 0, cpy = 0, prev = '';
  const out: ReducedInstruction[] = [];
  for (const i of instructions) {
    let nx = x, ny = y;
    switch (i.type) {
      case 'M': out.push(i); nx = sx = i.x; ny = sy = i.y; break;
      case 'L': out.push(i); nx = i.x; ny = i.y; break;
      case 'H': out.push({type: 'L', x: i.x, y}); nx = i.x; break;
      case 'V': out.push({type: 'L', x, y: i.y}); ny = i.y; break;
      case 'Z': out.push(i); nx = sx; ny = sy; break;
      case 'C': out.push(i); cpx = i.cp2x; cpy = i.cp2y; nx = i.x; ny = i.y; break;
      case 'S': {
        const c1x = prev === 'C' || prev === 'S' ? 2 * x - cpx : x, c1y = prev === 'C' || prev === 'S' ? 2 * y - cpy : y;
        out.push({type: 'C', cp1x: c1x, cp1y: c1y, cp2x: i.cpx, cp2y: i.cpy, x: i.x, y: i.y}); cpx = i.cpx; cpy = i.cpy; nx = i.x; ny = i.y; break;
      }
      case 'Q': out.push(quadToCubic(x, y, i)); cpx = i.cpx; cpy = i.cpy; nx = i.x; ny = i.y; break;
      case 'T': {
        const q: QInstruction = {type: 'Q', cpx: prev === 'Q' || prev === 'T' ? 2 * x - cpx : x, cpy: prev === 'Q' || prev === 'T' ? 2 * y - cpy : y, x: i.x, y: i.y};
        out.push(quadToCubic(x, y, q)); cpx = q.cpx; cpy = q.cpy; nx = i.x; ny = i.y; break;
      }
      case 'A': {
        const curves = arcToCubic(x, y, i.rx, i.ry, i.xAxisRotation, i.largeArcFlag, i.sweepFlag, i.x, i.y);
        if (curves.length) out.push(...curves); else out.push({type: 'L', x: i.x, y: i.y});
        nx = i.x; ny = i.y; break;
      }
    }
    prev = i.type; x = nx; y = ny;
  }
  return out;
}
export const reduceInstructions = (instruction: readonly Instruction[]): ReducedInstruction[] => reduceAbsolute(walk(instruction).map(s => s.abs));
const reducePath = (d: string) => reduceInstructions(parsePath(d));

// Bounding box of reduced instructions, using the exact extrema of each cubic.
function cubicExtrema(p0: number, p1: number, p2: number, p3: number): number[] {
  const a = 3 * (-p0 + 3 * p1 - 3 * p2 + p3), b = 6 * (p0 - 2 * p1 + p2), c = 3 * (p1 - p0);
  const roots = a === 0 ? (b === 0 ? [] : [-c / b]) : (() => { const disc = b * b - 4 * a * c; if (disc < 0) return []; const q = -0.5 * (b + Math.sign(b || 1) * Math.sqrt(disc)); return q === 0 ? [0] : [q / a, c / q]; })();
  return roots.filter(t => t > 0 && t < 1).map(t => (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t * t * p2 + t ** 3 * p3);
}
function boundingBoxOf(instructions: readonly ReducedInstruction[]): BoundingBox {
  const xs: number[] = [], ys: number[] = [];
  let x = 0, y = 0, sx = 0, sy = 0;
  for (const i of instructions) {
    if (i.type === 'Z') { x = sx; y = sy; continue; }
    if (i.type === 'C') { xs.push(...cubicExtrema(x, i.cp1x, i.cp2x, i.x)); ys.push(...cubicExtrema(y, i.cp1y, i.cp2y, i.y)); }
    xs.push(i.x); ys.push(i.y); x = i.x; y = i.y;
    if (i.type === 'M') { sx = x; sy = y; }
  }
  const x1 = Math.min(...xs), y1 = Math.min(...ys), x2 = Math.max(...xs), y2 = Math.max(...ys);
  return {x1, y1, x2, y2, viewBox: `${x1} ${y1} ${x2 - x1} ${y2 - y1}`, width: x2 - x1, height: y2 - y1};
}
// The reference's bounding box ignores a T that does not follow a Q or T.
export function getBoundingBox(d: string): BoundingBox {
  const abs = walk(parsePath(d)).map(s => s.abs);
  return boundingBoxOf(reduceAbsolute(abs.filter((i, k) => i.type !== 'T' || abs[k - 1]?.type === 'Q' || abs[k - 1]?.type === 'T')));
}

const translateSegments = <T extends Instruction>(segments: readonly T[], x: number, y: number): T[] => segments.map((i: Instruction): Instruction => {
  switch (i.type) {
    case 'M': case 'L': case 'T': case 'A': case 'S': case 'Q': return {...i, x: i.x + x, y: i.y + y, ...(i.type === 'S' || i.type === 'Q' ? {cpx: i.cpx + x, cpy: i.cpy + y} : {})};
    case 'C': return {...i, cp1x: i.cp1x + x, cp1y: i.cp1y + y, cp2x: i.cp2x + x, cp2y: i.cp2y + y, x: i.x + x, y: i.y + y};
    case 'H': return {...i, x: i.x + x}; case 'V': return {...i, y: i.y + y}; default: return i;
  }
}) as T[];
export const translatePath = (path: string, x: number, y: number): string => serializeInstructions(translateSegments(parsePath(path), x, y));
export function resetPath(d: string): string { const {x1, y1} = getBoundingBox(d); return translatePath(d, -x1, -y1); }
export function centerPath(d: string, target: CenterPathTarget = {x: 0, y: 0}): string {
  const {x1, y1, width, height} = getBoundingBox(d);
  return translatePath(d, target.x - (x1 + width / 2), target.y - (y1 + height / 2));
}
export function scalePath(d: string, scaleX: number, scaleY: number): string {
  const {x1, y1} = getBoundingBox(d);
  const scaled = translateSegments(reducePath(d), -x1, -y1).map(i => {
    if (i.type === 'C') return {...i, cp1x: i.cp1x * scaleX, cp1y: i.cp1y * scaleY, cp2x: i.cp2x * scaleX, cp2y: i.cp2y * scaleY, x: i.x * scaleX, y: i.y * scaleY};
    return i.type === 'Z' ? i : {...i, x: i.x * scaleX, y: i.y * scaleY};
  });
  return serializeInstructions(translateSegments(scaled, x1, y1));
}
export function getSubpaths(path: string): string[] {
  const out: Instruction[][] = [];
  let x = 0, y = 0, sx = 0, sy = 0;
  for (const i of parsePath(path)) {
    const [px, py] = [x, y];
    if (i.type === 'M' || i.type === 'm') { x = i.type === 'M' ? i.x : x + i.dx; y = i.type === 'M' ? i.y : y + i.dy; sx = x; sy = y; out.push([{type: 'M', x, y}]); continue; }
    const step = walk([{type: 'M', x: px, y: py}, i])[1]!;
    if (i.type === 'Z' || i.type === 'z') { x = sx; y = sy; } else { x = step.x; y = step.y; }
    out[out.length - 1]?.push(i.type === 'z' ? {type: 'Z'} : i);
  }
  return out.map(serializeInstructions);
}
export function extendViewBox(currentViewBox: string, scale: number): string {
  const parts = currentViewBox.trim().split(/\s+/).map(Number);
  if (parts.length !== 4 || parts.some(n => !Number.isFinite(n))) throw new Error(`currentViewBox must be 4 valid numbers, but got "${currentViewBox}"`);
  const [x, y, w, h] = parts as [number, number, number, number];
  const nw = w * scale, nh = h * scale;
  return `${x - (nw - w) / 2} ${y - (nh - h) / 2} ${nw} ${nh}`;
}
export function reversePath(path: string): string {
  const subpaths: ReducedInstruction[][] = [];
  for (const i of reducePath(path)) { if (i.type === 'M') subpaths.push([i]); else subpaths[subpaths.length - 1]?.push(i); }
  return subpaths.map(sub => {
    const closed = sub[sub.length - 1]!.type === 'Z';
    const body = sub.filter((i): i is MInstruction | LInstruction | CInstruction => i.type !== 'Z');
    const last = body[body.length - 1]!;
    let out = `M ${last.x} ${last.y}`;
    for (let k = body.length - 1; k > 0; k--) {
      const i = body[k]!, prev = body[k - 1]!;
      out += i.type === 'C' ? ` C ${i.cp2x} ${i.cp2y} ${i.cp1x} ${i.cp1y} ${prev.x} ${prev.y}` : ` L ${prev.x} ${prev.y}`;
    }
    return closed ? `${out}Z` : out;
  }).join(' ');
}
export function debugPath(d: string): {d: string; color: string}[] {
  const steps = walk(parsePath(d));
  const out: {d: string; color: string}[] = [];
  steps.forEach(({abs, x, y}, index) => {
    if (abs.type === 'Z' || abs.type === 'H' || abs.type === 'V') return;
    const color = index === steps.length - 1 ? 'red' : abs.type === 'M' ? 'blue' : 'green';
    out.push({d: `M ${x - 5} ${y - 5} L ${x + 5} ${y - 5} L ${x + 5} ${y + 5} L ${x - 5} ${y + 5} Z`, color});
  });
  return out;
}

// Length machinery: one segment function per instruction, matching the reference's sampling and search.
type Segment = {length: number; pointAt(len: number): Pt; tangentAt(len: number): Pt} | null;
// 20-point Gauss-Legendre nodes and weights (computed at 45 digits, correctly rounded). Pair order and the binomial
// derivative form below reproduce the reference's floating-point sums bit for bit.
const GL_X = [-0.07652652113349734, 0.07652652113349734, -0.22778585114164507, 0.22778585114164507, -0.37370608871541955, 0.37370608871541955, -0.5108670019508271, 0.5108670019508271, -0.636053680726515, 0.636053680726515, -0.7463319064601508, 0.7463319064601508, -0.8391169718222188, 0.8391169718222188, -0.912234428251326, 0.912234428251326, -0.9639719272779138, 0.9639719272779138, -0.9931285991850949, 0.9931285991850949];
const GL_W = [0.15275338713072584, 0.15275338713072584, 0.14917298647260374, 0.14917298647260374, 0.14209610931838204, 0.14209610931838204, 0.13168863844917664, 0.13168863844917664, 0.11819453196151841, 0.11819453196151841, 0.10193011981724044, 0.10193011981724044, 0.08327674157670475, 0.08327674157670475, 0.06267204833410907, 0.06267204833410907, 0.04060142980038694, 0.04060142980038694, 0.017614007139152118, 0.017614007139152118];
const BINOMIAL = [[1], [1, 1], [1, 2, 1], [1, 3, 3, 1]];
const bernstein = (p: number[], t: number) => { const n = p.length - 1; let v = 0; for (let k = 0; k <= n; k++) v += BINOMIAL[n]![k]! * Math.pow(1 - t, n - k) * Math.pow(t, k) * p[k]!; return v; };
const bezierPoint = (p: number[], t: number) => p.length === 4
  ? (1 - t) * (1 - t) * (1 - t) * p[0]! + 3 * (1 - t) * (1 - t) * t * p[1]! + 3 * (1 - t) * t * t * p[2]! + t * t * t * p[3]!
  : (1 - t) * (1 - t) * p[0]! + 2 * (1 - t) * t * p[1]! + t * t * p[2]!;
const bezierDerivative = (p: number[], t: number) => bernstein(p.slice(1).map((v, k) => (p.length - 1) * (v - p[k]!)), t);
function cubicLength(xs: number[], ys: number[], t: number): number {
  const z = t / 2;
  let sum = 0;
  for (let i = 0; i < 20; i++) { const ct = z * GL_X[i]! + z, dx = bezierDerivative(xs, ct), dy = bezierDerivative(ys, ct); sum += GL_W[i]! * Math.sqrt(dx * dx + dy * dy); }
  return z * sum;
}
function quadraticLength(xs: number[], ys: number[], t: number): number {
  const ax = xs[0]! - 2 * xs[1]! + xs[2]!, ay = ys[0]! - 2 * ys[1]! + ys[2]!, bx = 2 * xs[1]! - 2 * xs[0]!, by = 2 * ys[1]! - 2 * ys[0]!;
  const A = 4 * (ax * ax + ay * ay), B = 4 * (ax * bx + ay * by), C = bx * bx + by * by;
  if (A === 0) return t * Math.sqrt((xs[2]! - xs[0]!) ** 2 + (ys[2]! - ys[0]!) ** 2);
  const b = B / (2 * A), c = C / A, u = t + b, k = c - b * b;
  const uuk = u * u + k > 0 ? Math.sqrt(u * u + k) : 0, bbk = b * b + k > 0 ? Math.sqrt(b * b + k) : 0;
  const term = b === 0 && k === 0 ? 0 : (u + uuk) / (b + bbk) === 0 || !Number.isFinite((u + uuk) / (b + bbk)) ? 0 : k * Math.log(Math.abs((u + uuk) / (b + bbk)));
  return (Math.sqrt(A) / 2) * (u * uuk - b * bbk + term);
}
// Length to parameter: step search that stops at 0.1% error, like the reference.
function t2length(length: number, total: number, func: (t: number) => number): number {
  let error = 1, t = length / total, step = (length - func(t)) / total, n = 0;
  while (error > 0.001) {
    const up = Math.abs(length - func(t + step)) / total;
    if (up < error) { error = up; t += step; }
    else {
      const down = Math.abs(length - func(t - step)) / total;
      if (down < error) { error = down; t -= step; } else step /= 2;
    }
    if (++n > 500) break;
  }
  return t;
}
function bezierSegment(xs: number[], ys: number[]): Segment {
  const lengthAt = (t: number) => (xs.length === 4 ? cubicLength(xs, ys, t) : quadraticLength(xs, ys, t));
  const length = lengthAt(1);
  const tOf = (len: number) => (len <= 0 ? 0 : len >= length ? 1 : t2length(len, length, lengthAt));
  return {length, pointAt: len => { const t = tOf(len); return {x: bezierPoint(xs, t), y: bezierPoint(ys, t)}; },
    tangentAt: len => { const t = tOf(len), dx = bezierDerivative(xs, t), dy = bezierDerivative(ys, t), m = Math.sqrt(dx * dx + dy * dy); return {x: dx / m, y: dy / m}; }};
}
function linearSegment(x0: number, y0: number, x1: number, y1: number): Segment {
  const length = Math.sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0));
  return {length, pointAt: len => { const f = len / length; return length === 0 ? {x: x0, y: y0} : {x: x0 + (x1 - x0) * f, y: y0 + (y1 - y0) * f}; },
    tangentAt: () => ({x: (x1 - x0) / length, y: (y1 - y0) / length})};
}
function arcPoint(x0: number, y0: number, rx: number, ry: number, rotation: number, large: boolean, sweep: boolean, x1: number, y1: number, t: number): Pt {
  rx = Math.abs(rx); ry = Math.abs(ry);
  if ((x0 === x1 && y0 === y1) || rx === 0 || ry === 0) return {x: x0, y: y0};
  const phi = (((rotation % 360) + 360) % 360) * Math.PI / 180, cosPhi = Math.cos(phi), sinPhi = Math.sin(phi);
  const dx = (x0 - x1) / 2, dy = (y0 - y1) / 2;
  const tx = cosPhi * dx + sinPhi * dy, ty = -sinPhi * dx + cosPhi * dy;
  const sq = (v: number) => Math.pow(v, 2);
  const radiiCheck = sq(tx) / sq(rx) + sq(ty) / sq(ry);
  if (radiiCheck > 1) { rx *= Math.sqrt(radiiCheck); ry *= Math.sqrt(radiiCheck); }
  const num = sq(rx) * sq(ry) - sq(rx) * sq(ty) - sq(ry) * sq(tx), den = sq(rx) * sq(ty) + sq(ry) * sq(tx);
  let radicand = num / den;
  if (radicand < 0) radicand = 0;
  const coef = (large !== sweep ? 1 : -1) * Math.sqrt(radicand);
  const tcx = coef * ((rx * ty) / ry), tcy = coef * (-(ry * tx) / rx);
  const cx = cosPhi * tcx - sinPhi * tcy + (x0 + x1) / 2, cy = sinPhi * tcx + cosPhi * tcy + (y0 + y1) / 2;
  const svx = (tx - tcx) / rx, svy = (ty - tcy) / ry, evx = (-tx - tcx) / rx, evy = (-ty - tcy) / ry;
  const normalized = (ux: number, uy: number, vx: number, vy: number) => { const p = ux * vx + uy * vy, n = Math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy)); return (ux * vy - uy * vx < 0 ? -1 : 1) * Math.acos(Math.max(-1, Math.min(1, p / n))); };
  const start = normalized(1, 0, svx, svy);
  let sweepAngle = normalized(svx, svy, evx, evy);
  if (!sweep && sweepAngle > 0) sweepAngle -= TAU; else if (sweep && sweepAngle < 0) sweepAngle += TAU;
  const angle = start + sweepAngle * t, ex = rx * Math.cos(angle), ey = ry * Math.sin(angle);
  return {x: cosPhi * ex - sinPhi * ey + cx, y: sinPhi * ex + cosPhi * ey + cy};
}
function arcSegment(x0: number, y0: number, a: Extract<AbsoluteInstruction, {type: 'A'}>): Segment {
  const at = (t: number) => arcPoint(x0, y0, a.rx, a.ry, a.xAxisRotation, a.largeArcFlag, a.sweepFlag, a.x, a.y, t);
  let length = 0, prev = at(0);
  for (let i = 1; i <= 300; i++) { const cur = at(i * (1 / 300)); length += Math.sqrt((cur.x - prev.x) ** 2 + (cur.y - prev.y) ** 2); prev = cur; }
  const pointAt = (len: number) => at(Math.max(0, Math.min(length, len)) / length);
  return {length, pointAt, tangentAt: len => {
    const dist = 0.05, p1 = pointAt(len), l = Math.max(0, Math.min(length, len)), forward = l < length - dist;
    const p2 = pointAt(forward ? l + dist : l - dist), dx = p2.x - p1.x, dy = p2.y - p1.y, m = Math.sqrt(dx * dx + dy * dy);
    return forward ? {x: -dx / m, y: -dy / m} : {x: dx / m, y: dy / m};
  }};
}
type Constructed = {initial: Pt; segments: Segment[]; partial: number[]; total: number};
function construct(instructions: readonly AbsoluteInstruction[]): Constructed {
  let x = 0, y = 0, sx = 0, sy = 0, cpx = 0, cpy = 0, prev = '', total = 0;
  const segments: Segment[] = [], partial: number[] = [];
  const initial: Pt = instructions[0]?.type === 'M' ? {x: instructions[0].x, y: instructions[0].y} : {x: 0, y: 0};
  for (const i of instructions) {
    let seg: Segment = null, nx = x, ny = y;
    switch (i.type) {
      case 'M': nx = sx = i.x; ny = sy = i.y; break;
      case 'L': seg = linearSegment(x, y, i.x, i.y); nx = i.x; ny = i.y; break;
      case 'H': seg = linearSegment(x, y, i.x, y); nx = i.x; break;
      case 'V': seg = linearSegment(x, y, x, i.y); ny = i.y; break;
      case 'Z': seg = linearSegment(x, y, sx, sy); nx = sx; ny = sy; break;
      case 'C': seg = bezierSegment([x, i.cp1x, i.cp2x, i.x], [y, i.cp1y, i.cp2y, i.y]); cpx = i.cp2x; cpy = i.cp2y; nx = i.x; ny = i.y; break;
      case 'S': { const c1x = prev === 'C' || prev === 'S' ? 2 * x - cpx : x, c1y = prev === 'C' || prev === 'S' ? 2 * y - cpy : y; seg = bezierSegment([x, c1x, i.cpx, i.x], [y, c1y, i.cpy, i.y]); cpx = i.cpx; cpy = i.cpy; nx = i.x; ny = i.y; break; }
      case 'Q': seg = bezierSegment([x, i.cpx, i.x], [y, i.cpy, i.y]); cpx = i.cpx; cpy = i.cpy; nx = i.x; ny = i.y; break;
      case 'T': { const qx = prev === 'Q' || prev === 'T' ? 2 * x - cpx : x, qy = prev === 'Q' || prev === 'T' ? 2 * y - cpy : y; seg = bezierSegment([x, qx, i.x], [y, qy, i.y]); cpx = qx; cpy = qy; nx = i.x; ny = i.y; break; }
      case 'A': seg = arcSegment(x, y, i); nx = i.x; ny = i.y; break;
    }
    total += seg?.length ?? 0; partial.push(total); segments.push(seg); prev = i.type; x = nx; y = ny;
  }
  return {initial, segments, partial, total};
}
const constructPath = (path: string) => construct(walk(parsePath(path)).map(s => s.abs));
// Finds the segment holding a length; at a shared boundary the earlier segment wins, like the reference.
function partAt({partial}: Constructed, length: number): {i: number; fraction: number} {
  let i = partial.length - 1;
  while (partial[i]! >= length && i > 0) i--;
  i++;
  return {i, fraction: length - (partial[i - 1] ?? 0)};
}
export const getLength = (path: string): number => constructPath(path).total;
function sample(path: string, length: number, pick: (seg: Segment, fraction: number, c: Constructed) => Pt): Pt | null {
  const c = constructPath(path);
  if (length < 0) throw new Error('Length less than 0 was passed');
  if (length > c.total) return null;
  const {i, fraction} = partAt(c, length);
  return pick(c.segments[i] ?? null, fraction, c);
}
export const getPointAtLength = (path: string, length: number): Pt | null => sample(path, length, (seg, f, c) => (seg ? seg.pointAt(f) : c.initial));
export const getTangentAtLength = (path: string, length: number): Pt | null => sample(path, length, (seg, f) => (seg ? seg.tangentAt(f) : {x: 0, y: 0}));
export function getInstructionIndexAtLength(path: string, length: number): {index: number; lengthIntoInstruction: number} {
  const c = constructPath(path);
  if (length < 0) throw new Error('Length less than 0 was passed');
  if (length > c.total) throw new Error(`A length of ${length} was passed to getInstructionIndexAtLength() but the total length of the path is only ${c.total}`);
  const {i, fraction} = partAt(c, length);
  return {index: i - 1, lengthIntoInstruction: fraction};
}
// de Casteljau split of [x,y] points at t; left is the prefix curve.
function decasteljau(points: number[][], t: number, mix: Lerp = (a, b) => lerp(a, b, t)): {left: number[][]; right: number[][]} {
  const left: number[][] = [], right: number[][] = [];
  let level = points;
  while (level.length) {
    left.push(level[0]!); right.unshift(level[level.length - 1]!);
    const next: number[][] = [];
    for (let i = 0; i < level.length - 1; i++) next.push([mix(level[i]![0]!, level[i + 1]![0]!), mix(level[i]![1]!, level[i + 1]![1]!)]);
    level = next;
  }
  return {left, right};
}
const pointsToInstruction = (p: number[][]): ReducedInstruction => p.length === 4
  ? {type: 'C', cp1x: p[1]![0]!, cp1y: p[1]![1]!, cp2x: p[2]![0]!, cp2y: p[2]![1]!, x: p[3]![0]!, y: p[3]![1]!}
  : {type: 'L', x: p[p.length - 1]![0]!, y: p[p.length - 1]![1]!};
export function cutPath(d: string, length: number): string {
  const reduced = reducePath(d), {segments, partial} = construct(reduced);
  const out: ReducedInstruction[] = [];
  let x = 0, y = 0, sx = 0, sy = 0;
  for (let k = 0; k < reduced.length; k++) {
    const i = reduced[k]!, seg = segments[k], remaining = length - (partial[k - 1] ?? 0);
    if (k > 0 && remaining <= 0) break;
    if (i.type === 'M') { out.push(i); x = sx = i.x; y = sy = i.y; continue; }
    const segLength = seg?.length ?? 0;
    if (remaining < segLength && seg) {
      if (i.type === 'L') out.push({type: 'L', ...seg.pointAt(remaining)});
      else if (i.type === 'C') { const t = remaining / segLength; out.push(pointsToInstruction(decasteljau([[x, y], [i.cp1x, i.cp1y], [i.cp2x, i.cp2y], [i.x, i.y]], t, (a, b) => a + (b - a) * t).left)); }
      else out.push(i);
      break;
    }
    out.push(i);
    if (i.type !== 'Z') { x = i.x; y = i.y; } else { x = sx; y = sy; }
  }
  return serializeInstructions(out);
}
export function evolvePath(progress: number, path: string): {strokeDasharray: string; strokeDashoffset: number} {
  const length = getLength(path) * (progress === 0 ? 1.5 : 1);
  return {strokeDasharray: `${length} ${length}`, strokeDashoffset: length - length * progress};
}

// Interpolation: both paths reduced, the shorter one extended by de Casteljau splits, then field-wise lerp.
const endOf = (i: ReducedInstruction, prev: Pt): Pt => (i.type === 'Z' ? prev : {x: i.x, y: i.y});
function splitCurveAsPoints(points: number[][], count: number): number[][][] {
  const out: number[][][] = [];
  let remaining = points;
  const inc = 1 / count;
  for (let i = 0; i < count - 1; i++) { const split = decasteljau(remaining, inc / (1 - inc * i)); out.push(split.left); remaining = split.right; }
  out.push(remaining);
  return out;
}
function splitSegment(start: ReducedInstruction, startPoint: Pt, end: ReducedInstruction, count: number): ReducedInstruction[] {
  if (end.type === 'L' || end.type === 'C') {
    const points = end.type === 'C' ? [[startPoint.x, startPoint.y], [end.cp1x, end.cp1y], [end.cp2x, end.cp2y], [end.x, end.y]] : [[startPoint.x, startPoint.y], [end.x, end.y]];
    return splitCurveAsPoints(points, count).map(pointsToInstruction);
  }
  const copy: ReducedInstruction = start.type === 'M' ? {type: 'L', x: start.x, y: start.y} : start;
  return [...Array.from({length: count - 1}, () => copy), end];
}
function extend(toExtend: ReducedInstruction[], reference: ReducedInstruction[]): ReducedInstruction[] {
  const ratio = (toExtend.length - 1) / (reference.length - 1);
  const counts: number[] = [];
  for (let i = 0; i < reference.length - 1; i++) { const idx = Math.floor(ratio * i); counts[idx] = (counts[idx] ?? 0) + 1; }
  const out: ReducedInstruction[] = [toExtend[0]!];
  let point: Pt = endOf(toExtend[0]!, {x: 0, y: 0});
  for (let i = 0; i < counts.length; i++) {
    const count = counts[i]!;
    if (i === toExtend.length - 1) { const last = toExtend[i]!; out.push(...Array.from({length: count}, () => (last.type === 'M' ? {type: 'L', x: last.x, y: last.y} as ReducedInstruction : last))); }
    else { out.push(...splitSegment(toExtend[i]!, point, toExtend[i + 1]!, count)); point = endOf(toExtend[i + 1]!, point); }
  }
  return out;
}
const lerp = (a: number, b: number, t: number) => (1 - t) * a + t * b;
type Lerp = (a: number, b: number) => number;
function prepare(a: ReducedInstruction[], b: ReducedInstruction[]): {a: ReducedInstruction[]; b: ReducedInstruction[]; addZ: boolean} {
  const isZ = (list: ReducedInstruction[]) => list.length > 0 && list[list.length - 1]!.type === 'Z';
  const addZ = isZ(a) && isZ(b);
  if (isZ(a)) a = a.slice(0, -1);
  if (isZ(b)) b = b.slice(0, -1);
  if (a.length < b.length) a = extend(a, b); else if (b.length < a.length) b = extend(b, a);
  return {a, b, addZ};
}
// interpolatePath lerps as (1-t)a + tb; interpolatePaths as a + (b-a)t. The reference's outputs differ in the last bit between the two.
function lerpInstructions(a: ReducedInstruction, b: ReducedInstruction, t: number, mix: Lerp = (p, q) => lerp(p, q, t)): ReducedInstruction {
  if (a.type === 'Z' || b.type === 'Z') return {type: 'Z'};
  if (a.type === 'C' && b.type === 'C') return {type: 'C', cp1x: mix(a.cp1x, b.cp1x), cp1y: mix(a.cp1y, b.cp1y), cp2x: mix(a.cp2x, b.cp2x), cp2y: mix(a.cp2y, b.cp2y), x: mix(a.x, b.x), y: mix(a.y, b.y)};
  return {type: b.type as 'M' | 'L', x: mix(a.x, (b as MInstruction).x), y: mix(a.y, (b as MInstruction).y)};
}
const asCubic = (i: ReducedInstruction, current: Pt): ReducedInstruction => (i.type === 'L' ? {type: 'C', cp1x: current.x, cp1y: current.y, cp2x: i.x, cp2y: i.y, x: i.x, y: i.y} : i);
export function interpolatePath(value: number, firstPath: string, secondPath: string): string {
  if (value === 0) return firstPath;
  if (value === 1) return secondPath;
  const {a, b, addZ} = prepare(reducePath(firstPath), reducePath(secondPath));
  let current: Pt = {x: 0, y: 0};
  const out = a.map((ai, k) => {
    const bi = b[k]!;
    if ((ai.type === 'M') !== (bi.type === 'M')) throw new Error('mismatch');
    if (ai.type === 'Z' && bi.type !== 'Z') throw new Error('unexpected');
    const converted = bi.type === 'C' ? asCubic(ai, current) : bi.type === 'L' && ai.type === 'C' ? {type: 'L' as const, x: ai.x, y: ai.y} : ai;
    current = endOf(ai, current);
    return lerpInstructions(converted, bi, value);
  });
  return serializeInstructions(addZ ? [...out, {type: 'Z'}] : out);
}
const precise = (n: number) => (Number.isInteger(n) ? n : Number(n.toPrecision(15)));
function interpolateKeyframes(t: number, first: string, second: string): string {
  if (t === 0) return first;
  if (t === 1) return second;
  const {a, b, addZ} = prepare(reducePath(first), reducePath(second));
  let ca: Pt = {x: 0, y: 0}, cb: Pt = {x: 0, y: 0};
  const out = a.map((ai, k) => {
    const bi = b[k]!;
    if ((ai.type === 'M') !== (bi.type === 'M') || (ai.type === 'Z') !== (bi.type === 'Z')) throw new Error('Cannot interpolate SVG paths with different subpath structures');
    const cubic = ai.type === 'C' || bi.type === 'C';
    const result = lerpInstructions(cubic ? asCubic(ai, ca) : ai, cubic ? asCubic(bi, cb) : bi, t, (p, q) => p + (q - p) * t);
    ca = endOf(ai, ca); cb = endOf(bi, cb);
    if (result.type === 'C') return {...result, cp1x: precise(result.cp1x), cp1y: precise(result.cp1y), cp2x: precise(result.cp2x), cp2y: precise(result.cp2y), x: precise(result.x), y: precise(result.y)};
    return result.type === 'Z' ? result : {...result, x: precise(result.x), y: precise(result.y)};
  });
  return serializeInstructions(addZ ? [...out, {type: 'Z'}] : out);
}
export function interpolatePaths(input: number, inputRange: readonly number[], outputRange: readonly string[], options: InterpolatePathsOptions = {}): string {
  if (typeof input !== 'number') throw new Error('Cannot interpolate an input which is not a number');
  if (!Array.isArray(inputRange) || inputRange.length < 1) throw new Error('inputRange must have at least 1 element');
  if (!Array.isArray(outputRange)) throw new Error('outputRange must be an array of SVG path strings');
  if (inputRange.length !== outputRange.length) throw new Error(`inputRange (${inputRange.length}) and outputRange (${outputRange.length}) must have the same length`);
  if (inputRange.some(v => !Number.isFinite(v))) throw new Error(`inputRange must contain only finite numbers, but got ${JSON.stringify(inputRange)}`);
  inputRange.forEach((v, i) => { if (i > 0 && v <= inputRange[i - 1]!) throw new Error(`inputRange must be strictly monotonically increasing but got ${JSON.stringify(inputRange)}`); });
  for (const mode of [options.extrapolateLeft ?? 'extend', options.extrapolateRight ?? 'extend']) if (!['extend', 'clamp', 'wrap'].includes(mode)) throw new Error('extrapolate must be "extend", "clamp", or "wrap" for interpolatePaths()');
  if (options.easing !== undefined) assertValidInterpolateEasingOption(options.easing, inputRange.length);
  if (options.posterize !== undefined) assertValidInterpolatePosterizeOption(options.posterize);
  if (inputRange.length === 1) return outputRange[0]!;
  if (options.posterize !== undefined) input = Math.floor(input / options.posterize) * options.posterize;
  const last = inputRange.length - 1, left = options.extrapolateLeft ?? 'extend', right = options.extrapolateRight ?? 'extend';
  if (left === 'clamp' && input < inputRange[0]!) input = inputRange[0]!;
  if (right === 'clamp' && input > inputRange[last]!) input = inputRange[last]!;
  let segment = 0;
  while (segment < last - 1 && input > inputRange[segment + 1]!) segment++;
  let progress = (input - inputRange[segment]!) / (inputRange[segment + 1]! - inputRange[segment]!);
  if ((left === 'wrap' && input < inputRange[0]!) || (right === 'wrap' && input > inputRange[last]!)) progress -= Math.floor(progress);
  const easing = typeof options.easing === 'function' ? options.easing : options.easing?.[segment] ?? ((x: number) => x);
  return interpolateKeyframes(easing(progress), outputRange[segment]!, outputRange[segment + 1]!);
}

// Warping: segments split in half until shorter than the threshold, then every point remapped.
function splitUntil(start: Pt, i: LInstruction | CInstruction, threshold: number, out: ReducedInstruction[]): void {
  if (Math.sqrt((i.x - start.x) ** 2 + (i.y - start.y) ** 2) <= threshold) { out.push(i); return; }
  const points = i.type === 'C' ? [[start.x, start.y], [i.cp1x, i.cp1y], [i.cp2x, i.cp2y], [i.x, i.y]] : [[start.x, start.y], [i.x, i.y]];
  const {left, right} = decasteljau(points, 0.5, (a, b) => a + (b - a) * 0.5);
  const mid = pointsToInstruction(left) as LInstruction | CInstruction;
  splitUntil(start, mid, threshold, out);
  splitUntil({x: mid.x, y: mid.y}, pointsToInstruction(right) as LInstruction | CInstruction, threshold, out);
}
export function warpPath(path: string, transformer: WarpPathFn, options?: {interpolationThreshold?: number} | null): string {
  const reduced = reducePath(path);
  const threshold = options?.interpolationThreshold ?? (() => { const b = boundingBoxOf(reduced); return Math.max(b.width, b.height) * 0.01; })();
  const split: ReducedInstruction[] = [];
  let current: Pt = {x: 0, y: 0}, start: Pt = {x: 0, y: 0};
  for (const i of reduced) {
    if (i.type === 'M') { split.push(i); current = start = {x: i.x, y: i.y}; }
    else if (i.type === 'Z') { splitUntil(current, {type: 'L', ...start}, threshold, split); split.push(i); current = start; }
    else { splitUntil(current, i, threshold, split); current = {x: i.x, y: i.y}; }
  }
  return serializeInstructions(split.map(i => {
    if (i.type === 'Z') return i;
    if (i.type === 'C') { const a = transformer({x: i.cp1x, y: i.cp1y}), b = transformer({x: i.cp2x, y: i.cp2y}), e = transformer({x: i.x, y: i.y}); return {type: 'C', cp1x: a.x, cp1y: a.y, cp2x: b.x, cp2y: b.y, x: e.x, y: e.y}; }
    return {type: i.type, ...transformer({x: i.x, y: i.y})};
  }));
}
