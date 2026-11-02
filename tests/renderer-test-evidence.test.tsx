import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import {existsSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync} from 'node:fs';
import {join} from 'node:path';
import test from 'node:test';
import {preserveRendererMismatchEvidence} from './renderer-test-evidence';

const evidenceRoot = () => join(import.meta.dirname, '..', 'renders', 'tests', `evidence-unit-${randomUUID()}`);
type Pair = {filename: string; before: Buffer; after: Buffer};
// Keep the same strict assertion loop used by the renderer fixture test.
const assertPairs = (pairs: Pair[]) => pairs.forEach(({filename, before, after}) => assert.ok(after.equals(before), `${filename} must be byte-identical on a second render`));

test('matching renderer buffers create no evidence directory or evaluate diagnostic context', () => {
  const root = evidenceRoot();
  const pairs = [{filename: 'hero/0000.png', before: Buffer.from([0, 255]), after: Buffer.from([0, 255])}];
  preserveRendererMismatchEvidence(pairs, root, () => {throw new Error('must not collect context on success');});
  assertPairs(pairs);
  assert.equal(existsSync(root), false);
});

test('renderer mismatch still asserts and retains every pair, hashes and runtime metadata', () => {
  const root = evidenceRoot();
  const pairs = [
    {filename: 'hero/0000.png', before: Buffer.from([0, 255]), after: Buffer.from([0, 255])},
    {filename: 'studio/0000.png', before: Buffer.from([0, 255, 42, 13, 10]), after: Buffer.from([0, 254, 42, 13, 10])},
    {filename: 'studio/0001.png', before: Buffer.from([12, 34]), after: Buffer.from([12, 35])},
  ];
  const context = {blender: 'test-version', fixture: 'tests/fixtures/three-d/3d.json'};
  try {
    const mismatch = () => {
      preserveRendererMismatchEvidence(pairs, root, () => context);
      assertPairs(pairs);
    };
    assert.throws(mismatch, {code: 'ERR_ASSERTION', message: 'studio/0000.png must be byte-identical on a second render'});
    assert.throws(mismatch, {code: 'ERR_ASSERTION'});
    const directories = readdirSync(root);
    assert.equal(directories.length, 2, 'repeated failures do not overwrite evidence');
    for (const name of directories) {
      const directory = join(root, name);
      const metadata = JSON.parse(readFileSync(join(directory, 'metadata.json'), 'utf8'));
      assert.deepEqual(metadata.mismatchedNames, ['studio/0000.png', 'studio/0001.png']);
      assert.equal(metadata.comparisons.length, pairs.length);
      pairs.forEach(({filename, before, after}, index) => {
        const comparison = metadata.comparisons[index];
        assert.equal(comparison.filename, filename);
        for (const [side, buffer] of [['before', before], ['after', after]] as const) {
          assert.deepEqual(readFileSync(join(directory, comparison[side].file)), buffer);
          assert.equal(comparison[side].bytes, buffer.length);
          assert.equal(comparison[side].sha256, createHash('sha256').update(buffer).digest('hex'));
        }
      });
      assert.deepEqual(metadata.context, context);
      assert.equal(metadata.runtime.node, process.version);
      assert.equal(metadata.runtime.platform, process.platform);
      assert.equal(metadata.runtime.arch, process.arch);
      assert.ok(Number.isFinite(Date.parse(metadata.capturedAt)));
    }
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test('evidence write errors do not mask the original strict renderer mismatch', () => {
  const root = evidenceRoot();
  const pairs = [{filename: 'studio/0000.png', before: Buffer.from([0]), after: Buffer.from([1])}];
  try {
    mkdirSync(root, {recursive: true});
    const blocked = join(root, 'not-a-directory');
    writeFileSync(blocked, 'block diagnostic directory creation');
    assert.throws(() => {
      preserveRendererMismatchEvidence(pairs, blocked);
      assertPairs(pairs);
    }, {code: 'ERR_ASSERTION', message: 'studio/0000.png must be byte-identical on a second render'});
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});
