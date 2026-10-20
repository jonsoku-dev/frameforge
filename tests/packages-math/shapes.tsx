import React from 'react';
import assert from 'node:assert/strict';
import {compareDigest, type MarkupDigest} from '../oracle-digest';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import * as S from '../../src/packages/shapes';
type Case = {name: string; op: string; args: unknown[]; reference: unknown; compare?: 'instructions'};
const oracle = JSON.parse(readFileSync(new URL('../../compatibility/shapes.json', import.meta.url), 'utf8')) as {cases: Case[]};
const run = (c: Case): unknown => {
  if (c.op === 'markup') return renderToStaticMarkup(React.createElement((S as unknown as Record<string, React.FC<any>>)[c.args[0] as string]!, c.args[1] as object));
  return (S as unknown as Record<string, (arg: unknown) => unknown>)[c.op]!(c.args[0]);
};
// Polygon and star paths are moved to the origin by their bounding box, whose cubic extrema differ from the reference in the last
// bits; rounded triangle edges differ by an ulp in a few control points. Those compare numerically, everything else exactly.
const LOOSE = new Set(['makePolygon', 'makeStar', 'makeTriangle']);
const tolerant = (c: Case) => LOOSE.has(c.op) || (c.op === 'markup' && LOOSE.has(`make${c.args[0] as string}`));
const TOKEN = /-?\d+(?:\.\d+)?(?:e[-+]?\d+)?|[^\d\s]+|\s+/gi;
function close(a: unknown, b: unknown, tol: number): boolean {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
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
      if (ref && typeof ref === 'object' && 'error' in ref) { assert.throws(() => run(c), c.name); continue; }
      if (c.op === 'markup') {
        const problem = compareDigest(run(c) as string, (c.reference as {digest: MarkupDigest}).digest, tolerant(c) ? 1e-6 : 0);
        assert.equal(problem, null, c.name);
        continue;
      }
      const value = run(c);
      const mine = value === undefined ? null : JSON.parse(JSON.stringify(value));
      // Flat-cubic chains: the reference's bounding box overshoots the shape there, so only the geometry is compared.
      const pick = (v: any) => (c.compare === 'instructions' ? {instructions: v.instructions, transformOrigin: v.transformOrigin} : v);
      if (tolerant(c)) assert.ok(close(pick(mine), pick(c.reference), 1e-9), `${c.name}\n  got ${JSON.stringify(mine).slice(0, 300)}\n  want ${JSON.stringify(c.reference).slice(0, 300)}`);
      else assert.deepEqual(pick(mine), pick(c.reference), c.name);
    }
  });
}
test('components forward unknown props and children to the path and keep timeline props off the DOM', () => {
  const markup = renderToStaticMarkup(<S.Rect width={10} height={5} from={3} durationInFrames={4} name="r" effects={[]} data-k="v"><title>t</title></S.Rect>);
  assert.equal(markup, '<svg width="10" height="5" viewBox="0 0 10 5" xmlns="http://www.w3.org/2000/svg" style="overflow:visible"><path transform-origin="5 2.5" d="M 0 0 L 10 0 L 10 5 L 0 5 L 0 0 Z" style="transform-box:fill-box" data-k="v"><title>t</title></path></svg>');
});
test('invalid directions throw instead of drawing a fallback shape', () => {
  assert.throws(() => S.makeArrow({direction: 'diag' as S.MakeArrowProps['direction']}), /direction/);
  assert.throws(() => S.makeTriangle({length: 1, direction: 'diag' as S.MakeTriangleProps['direction']}), /direction/);
  assert.throws(() => S.makeCallout({pointerDirection: 'diag' as S.MakeCalloutProps['pointerDirection']}), /direction/);
});
