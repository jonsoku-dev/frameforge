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
    assert.match(three, /\[music\]\[vopad\]sidechaincompress=[^[]*release=250[^[]*\[underv\]/);
    assert.match(three, /\[underv\]\[fxpad\]sidechaincompress/);
    assert.match(three, /\[fxkey\]apad\[fxpad\]/, 'the key is padded so the bed outlives the last effect');
    assert.match(three, /\[ducked\]\[voout\]\[fxout\]amix=inputs=3/);
    const two = graph([segment(`${base}/music.wav`, 0, 0, 89), segment(`${base}/voice.wav`, 0, 0, 29)]);
    assert.match(two, /\[underv\]\[voout\]amix=inputs=2/);
    assert.doesNotMatch(graph([segment(`${base}/voice.wav`, 0, 0, 29), segment(`${base}/pop.wav`, 40, 40, 60)]), /sidechaincompress/, 'without music nothing ducks and the voice stays untouched');
  } finally {
    rmSync(folder, {recursive: true, force: true});
  }
});

test('frame-check fails a picture frozen over 1 s outside the final hold, a still end, a blank transition frame run, counts a slow drift as motion, and takes --hold', () => {
  const folder = join('renders', 'tests', 'frame-check');
  mkdirSync(folder, {recursive: true});
  const clip = (name: string, x: string, flat = '') => {
    const file = join(folder, `${name}.mp4`);
    // drawbox evaluates x once; overlay evaluates it every frame. `flat` covers the frame with one orange field while it holds.
    const cover = flat ? `;color=c=0xE5481F:s=1920x1080:r=30:d=4[f];[d][f]overlay=enable='${flat}'` : '';
    const graph = `color=c=0xF4F4F1:s=1920x1080:r=30:d=4[bg];color=c=0x2F5BFF:s=300x900:r=30:d=4[a];color=c=0x111111:s=300x900:r=30:d=4[b];[bg][a]overlay=x='${x}':y=90[c];[c][b]overlay=x='${x}+700':y=90${flat ? '[d]' : ''}${cover}`;
    const made = spawnSync('ffmpeg', ['-v', 'error', '-y', '-filter_complex', graph, '-pix_fmt', 'yuv420p', file], {encoding: 'utf8'});
    assert.equal(made.status, 0, made.stderr);
    return file;
  };
  const check = (file: string, ...flags: string[]) => {
    const run = spawnSync(process.execPath, ['scripts/frame-check.mjs', file, '--json', ...flags], {encoding: 'utf8'});
    return {status: run.status, report: JSON.parse(run.stdout) as {hold: number; stillShare: number; motionShare: number; fails: string[]}};
  };
  try {
    // Moves 400 px/s for 1 s, then holds still for 3 s.
    const stops = clip('stops', 'if(lt(t,1),200+t*400,600)');
    const strict = check(stops);
    assert.equal(strict.report.hold, 30, 'the default hold is the last second');
    assert.equal(strict.status, 1);
    assert.ok(strict.report.fails.some(fail => /^frozen 30-89 /.test(fail)), `frozen from the frame it stopped: ${strict.report.fails.join('; ')}`);
    assert.ok(strict.report.fails.some(fail => /^end hold: motion share 0 /.test(fail)), `the still last 2 s fail: ${strict.report.fails.join('; ')}`);
    const held = check(stops, '--hold', '90');
    assert.equal(held.status, 0, `a declared hold over the still part passes, end hold included: ${held.report.fails.join('; ')}`);
    // Moving all through, but a flat orange frame for 6 frames (2.0-2.2 s) as a cut: a blank transition.
    const blank = check(clip('blank', '200+t*200', 'between(t,2,2.19)'));
    assert.deepEqual(blank.report.fails, ['featureless 60-65 (6f flat or blurred >= 3f)']);
    // 4 px/s: under the per-step threshold on almost every frame, but over half a second the edges move.
    const drifts = check(clip('drifts', '200+t*4'));
    assert.ok(drifts.report.stillShare > 0.8, `per step the drift reads as still (${drifts.report.stillShare})`);
    assert.ok(drifts.report.motionShare > 0.8, `over half a second it moves (${drifts.report.motionShare})`);
    assert.equal(drifts.status, 0, drifts.report.fails.join('; '));
  } finally {
    rmSync(folder, {recursive: true, force: true});
  }
});
