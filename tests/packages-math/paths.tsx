import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import * as P from '../../src/packages/paths';
import type {WarpPathFn} from '../../src/packages/paths';
type Case = {name: string; op: string; args: unknown[]; reference: unknown};
const oracle = JSON.parse(readFileSync(new URL('../../compatibility/paths.json', import.meta.url), 'utf8')) as {cases: Case[]};
// Function-valued arguments travel through the JSON as names; these match the generator's definitions.
const WARP: Record<string, WarpPathFn> = {identity: p => p, sine: ({x, y}) => ({x: x + Math.sin(y / 4) * 5, y}), scaleX2: ({x, y}) => ({x: x * 2, y}), shear: ({x, y}) => ({x, y: y + x / 10}), swap: ({x, y}) => ({x: y, y: x})};
const EASE: Record<string, (x: number) => number> = {linear: x => x, quad: x => x * x, cubic: x => x * x * x, half: () => 0.5, sqrt: x => Math.sqrt(Math.abs(x))};
const live = (v: unknown): unknown => typeof v === 'string' && v.startsWith('warp:') ? WARP[v.slice(5)] : typeof v === 'string' && v.startsWith('ease:') ? EASE[v.slice(5)] : Array.isArray(v) ? v.map(live) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, live(x)])) : v;
const OPS: Record<string, (...args: any[]) => unknown> = {
  parsePath: P.parsePath, serialize: s => P.serializeInstructions(P.parsePath(s)), serializeRaw: P.serializeInstructions, normalizePath: P.normalizePath, reduce: s => P.reduceInstructions(P.parsePath(s)),
  getLength: P.getLength, getPointAtLength: P.getPointAtLength, getTangentAtLength: P.getTangentAtLength, getInstructionIndexAtLength: P.getInstructionIndexAtLength,
  pointAtFraction: (s, f) => P.getPointAtLength(s, P.getLength(s) * f), tangentAtFraction: (s, f) => P.getTangentAtLength(s, P.getLength(s) * f), indexAtFraction: (s, f) => P.getInstructionIndexAtLength(s, P.getLength(s) * f), cutAtFraction: (s, f) => P.cutPath(s, P.getLength(s) * f),
  getBoundingBox: P.getBoundingBox, getSubpaths: P.getSubpaths, translatePath: P.translatePath, scalePath: P.scalePath, reversePath: P.reversePath, resetPath: P.resetPath, centerPath: P.centerPath, cutPath: P.cutPath, evolvePath: P.evolvePath, extendViewBox: P.extendViewBox,
  interpolatePath: P.interpolatePath, interpolatePaths: P.interpolatePaths, warpPath: P.warpPath, debugPath: P.debugPath,
};
// Bounding-box extrema of cubics differ from the reference in the last bits, so the four functions built on them compare numerically.
const TOLERANT = new Set(['getBoundingBox', 'scalePath', 'resetPath', 'centerPath']);
const TOKEN = /-?\d+(?:\.\d+)?(?:e[-+]?\d+)?|[^\d\s]+|\s+/gi;
function close(a: unknown, b: unknown, tol: number): boolean {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
  if (typeof a === 'number' && Number.isNaN(a) && b === null) return true;
  if (typeof a === 'string' && typeof b === 'string') {
    if (a === b) return true;
    const ta = a.match(TOKEN) ?? [], tb = b.match(TOKEN) ?? [];
    return ta.length === tb.length && ta.every((t, i) => { const na = Number(t), nb = Number(tb[i]); return Number.isNaN(na) || Number.isNaN(nb) ? t === tb[i] : close(na, nb, tol); });
  }
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => close(v, b[i], tol));
  if (a && b && typeof a === 'object' && typeof b === 'object') { const keys = new Set([...Object.keys(a), ...Object.keys(b)]); return [...keys].every(k => close((a as any)[k], (b as any)[k], tol)); }
  return a === b;
}
const byOp = new Map<string, Case[]>();
for (const c of oracle.cases) byOp.set(c.op, [...(byOp.get(c.op) ?? []), c]);
for (const [op, cases] of byOp) {
  test(`${op} matches the reference on ${cases.length} oracle cases`, () => {
    for (const c of cases) {
      const ref = c.reference as {error?: string} | null;
      if (ref && typeof ref === 'object' && 'error' in ref) { assert.throws(() => OPS[op]!(...(live(c.args) as unknown[])), c.name); continue; }
      const value = OPS[op]!(...(live(c.args) as unknown[]));
      const mine = value === undefined ? null : JSON.parse(JSON.stringify(value));
      if (TOLERANT.has(op)) assert.ok(close(mine, c.reference, 1e-9), `${c.name}\n  got ${JSON.stringify(mine)}\n  want ${JSON.stringify(c.reference)}`);
      else assert.deepEqual(mine, c.reference, c.name);
    }
  });
}
test('values JSON cannot carry: NaN tangents, infinite boxes, unit warp threshold', () => {
  const t = P.getTangentAtLength('M 0 0 L 0 0', 0);
  assert.ok(Number.isNaN(t!.x) && Number.isNaN(t!.y));
  assert.equal(P.getBoundingBox('Z').x1, Infinity);
  assert.equal(P.warpPath('M 0 0 L 2 0', p => p, {interpolationThreshold: 1}), 'M 0 0 L 1 0 L 2 0');
  assert.equal(P.interpolatePaths(NaN, [0, 1], ['M 0 0', 'M 1 1']), 'M NaN NaN');
});
test('type surface: instruction unions and option types stay assignable', () => {
  const instructions: P.Instruction[] = [{type: 'm', dx: 1, dy: 2}, {type: 'a', rx: 1, ry: 1, xAxisRotation: 0, largeArcFlag: false, sweepFlag: true, dx: 3, dy: 4}, {type: 'Z'}];
  const reduced: P.ReducedInstruction[] = P.reduceInstructions(instructions);
  const box: P.BoundingBox = P.getBoundingBox(P.serializeInstructions(reduced));
  const target: P.CenterPathTarget = {x: 0, y: 0};
  const options: P.InterpolatePathsOptions = {extrapolateLeft: 'wrap', easing: [x => x]};
  assert.equal(typeof box.viewBox, 'string'); assert.equal(P.centerPath('M 1 1 L 3 3', target), 'M -1 -1 L 1 1');
  assert.equal(P.interpolatePaths(-0.5, [0, 1], ['M 0 0', 'M 2 2'], options), 'M 1 1');
});
