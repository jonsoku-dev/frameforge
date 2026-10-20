import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {noise2D, noise3D, noise4D} from '../../src/packages/noise';
type Case = {fn: 'noise2D' | 'noise3D' | 'noise4D'; args: [string | number, ...number[]]; value?: number; error?: string};
const oracle: {tolerance: number; cases: Case[]} = JSON.parse(readFileSync(new URL('../../compatibility/noise.json', import.meta.url), 'utf8'));
const fns = {noise2D, noise3D, noise4D} as Record<Case['fn'], (...args: any[]) => number>;
test('noise matches recorded reference outputs', () => {
  assert.ok(oracle.cases.length >= 500);
  for (const c of oracle.cases) {
    const label = `${c.fn}(${JSON.stringify(c.args)})`;
    if (c.error !== undefined) { assert.throws(() => fns[c.fn](...c.args), {message: c.error}, label); continue; }
    const got = fns[c.fn](...c.args);
    assert.ok(Math.abs(got - c.value!) <= oracle.tolerance, `${label}: ${got} vs ${c.value}`);
  }
});
test('noise is deterministic per seed, bounded, and seed-sensitive', () => {
  for (let i = 0; i < 200; i++) {
    const x = i * 0.37 - 20, y = i * -0.11, z = i * 0.05, w = 3 - i * 0.2;
    for (const v of [noise2D('s', x, y), noise3D('s', x, y, z), noise4D('s', x, y, z, w)]) assert.ok(v >= -1 && v <= 1);
    assert.equal(noise3D(9, x, y, z), noise3D(9, x, y, z));
  }
  assert.notEqual(noise2D('a', 0.3, 0.4), noise2D('b', 0.3, 0.4));
});
test('NaN input gives 0 in 2D but NaN in 3D and 4D, like the reference', () => {
  assert.equal(noise2D('s', NaN, 0.3), 0);
  assert.ok(Number.isNaN(noise3D('s', NaN, 0.3, 0.1)));
  assert.ok(Number.isNaN(noise4D('s', NaN, 1, 2, 3)));
});
