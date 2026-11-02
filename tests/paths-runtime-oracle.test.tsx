import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {pathMathFingerprint, pathOracleReference, pathOracleSupplement} from './packages-math/paths-runtime-oracle';
import type {PathOracleCase, PathOracleRuntime} from './packages-math/paths-runtime-oracle';

const historicalBytes = readFileSync(new URL('../compatibility/paths.json', import.meta.url));
const historical = JSON.parse(historicalBytes.toString('utf8')) as {cases: PathOracleCase[]};
const observedRuntime = pathOracleSupplement.runtime;
const observedCases = pathOracleSupplement.cases.map(s => historical.cases.find(c => c.name === s.name)!);

test('paths runtime supplement preserves the original oracle and covers exactly three observed cases', () => {
  assert.equal(createHash('sha256').update(historicalBytes).digest('hex'), pathOracleSupplement.historicalFixtureSha256);
  assert.equal(pathOracleSupplement.cases.length, 3);
  assert.equal(new Set(pathOracleSupplement.cases.map(c => c.name)).size, 3);
  assert.deepEqual(pathOracleSupplement.cases.map(c => c.op), ['indexAtFraction', 'indexAtFraction', 'warpPath']);
  for (const [i, c] of observedCases.entries()) {
    assert.ok(c);
    const supplement = pathOracleSupplement.cases[i]!;
    assert.deepEqual(c.reference, supplement.historicalReference);
    assert.notDeepEqual(c.reference, supplement.reference);
    assert.deepEqual(pathOracleReference(c, {...observedRuntime}), supplement.reference);
  }
});

test('paths supplemental selection rejects every mismatched runtime field, including math fingerprint', () => {
  for (const field of Object.keys(observedRuntime) as Array<keyof PathOracleRuntime>) {
    const mismatch = {...observedRuntime, [field]: `${observedRuntime[field]}-unverified`};
    for (const c of observedCases) assert.strictEqual(pathOracleReference(c, mismatch), c.reference, field);
  }
});

test('paths supplemental selection cannot change unrelated cases or modified case inputs', () => {
  const selected = new Set(observedCases.map(c => c.name));
  for (const c of historical.cases) {
    if (!selected.has(c.name)) assert.strictEqual(pathOracleReference(c, observedRuntime), c.reference, c.name);
  }
  for (const c of observedCases) {
    for (const changed of [{...c, name: c.name + '!'}, {...c, op: c.op + '!'}, {...c, args: [...c.args, 1]}, {...c, reference: {unexpected: 1}}]) {
      assert.strictEqual(pathOracleReference(changed, observedRuntime), changed.reference);
    }
  }
});

test('paths math fingerprint detects transcendental-result changes', () => {
  const baseline = pathMathFingerprint(), sin = Math.sin;
  try {
    Math.sin = x => x === 53.125 / 4 ? sin(x) + Number.EPSILON : sin(x);
    assert.notEqual(pathMathFingerprint(), baseline);
  } finally {
    Math.sin = sin;
  }
  assert.equal(pathMathFingerprint(), baseline);
});
