import assert from 'node:assert/strict';
import test from 'node:test';
import {canvasFontsReady, rng} from 'frameforge';
// @ts-expect-error the renderer is plain ESM without types
import {noteFinding, persistentFindings} from '../scripts/render.mjs';

test('rng(seed) is a deterministic stream: same seed, same sequence; another seed, another one; values in [0, 1)', () => {
  const take = (seed: string | number) => { const next = rng(seed); return Array.from({length: 1000}, next); };
  const a = take('particles'), b = take('particles'), c = take('particles-2'), n = take(7);
  assert.deepEqual(a, b);
  assert.deepEqual(n, take(7));
  assert.notDeepEqual(a, c);
  assert.ok(a.every(v => v >= 0 && v < 1));
  assert.equal(new Set(a).size, a.length, 'no repeats in a short stream');
  const mean = a.reduce((s, v) => s + v, 0) / a.length;
  assert.ok(Math.abs(mean - 0.5) < 0.05, `mean ${mean}`);
});

test('canvasFontsReady holds the first canvas paint until the Google Fonts settle, then lets every later paint through', async () => {
  const first = canvasFontsReady();
  assert.ok(first instanceof Promise, 'unsettled fonts give a promise to wait on');
  assert.equal(canvasFontsReady(), first, 'every canvas waits on the same settle');
  await first;
  assert.equal(canvasFontsReady(), null);
});

test('audit persistence: a margin slam under 0.3 s per run is motion, a 0.3 s run is a fault; ghost-free counting stays per key', () => {
  const audit = new Map();
  const outside = {code: 'text_outside_safe', text: 'SLAM'}, overlap = {code: 'text_overlap', text: 'A / B'};
  // Two 5-frame slams across the margin at 30 fps: 10 frames in all, but no run reaches 9 (0.3 s).
  for (const f of [10, 11, 12, 13, 14, 40, 41, 42, 43, 44]) noteFinding(audit, outside, f);
  // Parallel chunks note frames out of order; an overlap counts by total frames.
  for (const f of [52, 50, 51, 53, 54, 55, 56, 57, 58]) noteFinding(audit, overlap, f);
  const found = persistentFindings(audit, {fps: 30, total: 120, sheet: false});
  assert.deepEqual(found.map((f: {code: string}) => f.code), ['text_overlap']);
  assert.ok(!('at' in found[0]!), 'the frame list stays internal');
  for (const f of [70, 72, 71, 73, 74, 75, 76, 77, 78]) noteFinding(audit, outside, f);
  assert.deepEqual(persistentFindings(audit, {fps: 30, total: 120, sheet: false}).map((f: {code: string}) => f.code).sort(), ['text_outside_safe', 'text_overlap']);
  // A contact sheet reports every frame it rendered.
  const sheet = new Map();
  noteFinding(sheet, outside, 90);
  assert.equal(persistentFindings(sheet, {fps: 30, total: 3, sheet: true}).length, 1);
});
