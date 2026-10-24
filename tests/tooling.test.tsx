import assert from 'node:assert/strict';
import test from 'node:test';
import {lintEntry, stripComments} from '../scripts/lint.mjs';
// @ts-expect-error render.mjs has no declaration file (tests/studio.test.tsx imports it the same way)
import {encodeArgs as untypedEncode, mergeSegments as untypedMerge, splitFrames as untypedSplit} from '../scripts/render.mjs';
import {mkdirSync, rmSync} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

type Chunk = {index: number; start: number; end: number};
type Segment = {clip: {key: string; startFrame: number}; first: number; last: number};
const splitFrames: (from: number, to: number, concurrency: number, fps: number) => Chunk[] = untypedSplit;
const mergeSegments: (lists: Segment[][]) => Segment[] = untypedMerge;
const encodeArgs: (video: string[], encode: string[], fps: number, count: number, segments: unknown[], output: string) => string[] = untypedEncode;

test('lint finds every nondeterminism in the dirty fixture graph with codes and lines', () => {
  const report = lintEntry('tests/fixtures/lint/dirty/entry.tsx');
  assert.deepEqual(report.files, ['tests/fixtures/lint/dirty/entry.tsx', 'tests/fixtures/lint/dirty/Scene.tsx', 'tests/fixtures/lint/dirty/scene.css']);
  const seen = report.findings.map(({file, line, code, severity}) => `${file.split('/').pop()}:${line} ${code} ${severity}`).sort();
  assert.deepEqual(seen, [
    'Scene.tsx:14 wall_clock error', 'Scene.tsx:14 wall_clock error', 'Scene.tsx:14 wall_clock error',
    'Scene.tsx:15 wall_clock error', 'Scene.tsx:15 wall_clock error', 'Scene.tsx:15 wall_clock warning',
    'Scene.tsx:16 css_time_animation error',
    'Scene.tsx:8 effect_driven_state warning', 'Scene.tsx:8 unseeded_random error',
    'scene.css:3 css_time_animation error', 'scene.css:4 css_time_animation error',
  ]);
  assert.ok(report.findings.every(finding => finding.message && finding.fixHint));
});

test('lint passes the clean fixture: comments, URLs in strings, transition none and seeded random', () => {
  const report = lintEntry('tests/fixtures/lint/clean/entry.tsx');
  assert.equal(report.files.length, 2);
  assert.deepEqual(report.findings, []);
  assert.equal(stripComments("a // b\n'//' /* c\nd */ e"), "a     \n'//'     \n     e");
});

test('chunks are contiguous, cover the range, and never shorter than 2 s', () => {
  assert.deepEqual(splitFrames(0, 599, 3, 30), [{index: 0, start: 0, end: 199}, {index: 1, start: 200, end: 399}, {index: 2, start: 400, end: 599}]);
  assert.deepEqual(splitFrames(0, 89, 4, 30), [{index: 0, start: 0, end: 89}]);
  assert.deepEqual(splitFrames(10, 129, 8, 30), [{index: 0, start: 10, end: 69}, {index: 1, start: 70, end: 129}]);
  for (const [count, concurrency, fps] of [[601, 10, 30], [1000, 7, 24], [61, 2, 30], [5000, 16, 60]]) {
    const chunks = splitFrames(0, count - 1, concurrency, fps);
    assert.ok(chunks.length <= concurrency);
    assert.equal(chunks[0].start, 0); assert.equal(chunks.at(-1)!.end, count - 1);
    for (const [index, chunk] of chunks.entries()) {
      assert.ok(chunk.end - chunk.start + 1 >= Math.min(count, 2 * fps), `${count}/${concurrency}: chunk ${index} too short`);
      if (index) assert.equal(chunk.start, chunks[index - 1].end + 1);
    }
  }
});

test('audio segments split at a chunk boundary merge back by key; a real gap stays two segments', () => {
  const music = {key: 'music', startFrame: 0}, pop = {key: 'pop', startFrame: 150};
  const merged = mergeSegments([
    [{clip: music, first: 0, last: 199}, {clip: pop, first: 150, last: 160}],
    [{clip: music, first: 200, last: 399}, {clip: pop, first: 250, last: 260}],
    [{clip: music, first: 400, last: 599}],
  ]);
  assert.deepEqual(merged.map(({clip, first, last}) => [clip.key, first, last]), [['music', 0, 599], ['pop', 150, 160], ['pop', 250, 260]]);
});

test('a narration file forms its own stem: music ducks under the voice and under the effects, and all three are mixed', () => {
  const folder = join(process.cwd(), 'public/audio/generated/_voice-stem-test');
  mkdirSync(folder, {recursive: true});
  for (const name of ['music', 'voice', 'pop']) spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', '-ac', '2', '-ar', '48000', join(folder, `${name}.wav`)]);
  try {
    const segment = (src: string, startFrame: number, first: number, last: number) => ({clip: {key: src, src, volume: 1, trimBefore: 0, startFrame}, first, last});
    const base = '/audio/generated/_voice-stem-test';
    const graph = (segments: ReturnType<typeof segment>[]) => { const args = encodeArgs(['-i', 'v'], ['-c:v', 'x'], 30, 90, segments, 'out.mp4'); return String(args[args.indexOf('-filter_complex') + 1]); };
    const three = graph([segment(`${base}/music.wav`, 0, 0, 89), segment(`${base}/voice.wav`, 0, 0, 29), segment(`${base}/pop.wav`, 40, 40, 60)]);
    assert.match(three, /\[music\]\[vokey\]sidechaincompress=[^[]*release=250[^[]*\[underv\]/);
    assert.match(three, /\[underv\]\[fxkey\]sidechaincompress/);
    assert.match(three, /\[ducked\]\[voout\]\[fxout\]amix=inputs=3/);
    const two = graph([segment(`${base}/music.wav`, 0, 0, 89), segment(`${base}/voice.wav`, 0, 0, 29)]);
    assert.match(two, /\[underv\]\[voout\]amix=inputs=2/);
    assert.doesNotMatch(graph([segment(`${base}/voice.wav`, 0, 0, 29), segment(`${base}/pop.wav`, 40, 40, 60)]), /sidechaincompress/, 'without music nothing ducks and the voice stays untouched');
  } finally {
    rmSync(folder, {recursive: true, force: true});
  }
});
