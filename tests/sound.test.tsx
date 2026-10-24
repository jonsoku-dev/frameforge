import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {deriveSoundEvents, mapSoundEvents, type MotionSample} from '../src/core/sound';

const series = (key: string, values: number[], family: MotionSample['family'] = 'card', axis: MotionSample['axis'] = 'y', from = 0): MotionSample[] =>
  values.map((value, i) => ({key, frame: from + i, value, family, axis}));
const spring = (frames: number, overshoot = 0.15) => Array.from({length: frames}, (_, i) => {
  const t = i / 12;
  return i >= frames - 6 ? 100 : 100 * (1 - Math.exp(-t) * Math.cos(2.2 * t)) * (1 + overshoot * Math.exp(-t));
});

test('a spring that overshoots lands where it first reaches its target, with a move at the start', () => {
  const values = [0, 0, 0, ...spring(40)];
  const events = deriveSoundEvents(series('card', values));
  const move = events.find(event => event.role === 'move');
  const land = events.find(event => event.role === 'land');
  assert.ok(move && land);
  assert.equal(move.frame, values.findIndex((value, i) => i > 0 && Math.abs(value - values[i - 1]!) > 0.4) - 1);
  const firstCross = values.findIndex((value, i) => i > 3 && value >= 100 - 100 * 0.004);
  assert.equal(land.frame, firstCross);
  assert.ok(land.intensity > 0.3 && land.intensity <= 1);
});

test('a linear slide on x pans in its direction and a still series makes no event', () => {
  const slide = series('panel', [-800, -800, ...Array.from({length: 20}, (_, i) => -800 + (i + 1) * 40), 0, 0, 0, 0], 'card', 'x');
  const [move] = deriveSoundEvents(slide).filter(event => event.role === 'move');
  assert.equal(move?.pan, 0.6);
  assert.equal(deriveSoundEvents(series('still', Array(30).fill(5))).length, 0);
});

test('a wipe makes one move and no land; a reveal makes one appear at the halfway crossing; text keeps one land only', () => {
  const wipe = deriveSoundEvents(series('wipe', Array.from({length: 20}, (_, i) => Math.min(1, i / 10)), 'wipe', 'progress'));
  assert.deepEqual(wipe.map(event => event.role), ['move']);
  const reveal = deriveSoundEvents(series('card', Array.from({length: 20}, (_, i) => Math.min(1, i / 10)), 'card', 'progress'));
  assert.deepEqual(reveal.map(event => [event.role, event.frame]), [['appear', 6]]);
  const text = deriveSoundEvents(series('line', [0, 0, 20, 60, 100, 100, 100, 100, 100, 80, 40, 0, 0, 0, 0], 'text'));
  assert.deepEqual(text.map(event => event.role), ['land']);
});

test('mapping honours roles, families, quiet frames and the density policy', () => {
  const events = deriveSoundEvents([
    ...series('a', [0, 0, ...spring(30)]),
    ...series('b', [0, 0, ...spring(30)], 'shape', 'y', 300),
    ...series('c', [0, 0, ...spring(30)], 'card', 'y', 310),
    ...series('d', [0, 0, ...spring(30)], 'card', 'y', 340),
    ...series('e', [0, 0, ...spring(30)], 'card', 'y', 370),
    ...series('f', [0, 0, ...spring(30)], 'card', 'y', 400),
  ]);
  const clips = mapSoundEvents(events, [{src: '/audio/generated/x/pop.wav', role: 'land', volume: 0.6, families: ['card'], quiet: [20]}], 30);
  assert.ok(clips.every(clip => clip.src.endsWith('pop.wav') && clip.role === 'land'));
  assert.ok(!clips.some(clip => Math.abs(clip.startFrame - 20) <= 15), 'quiet frame respected');
  assert.ok(!clips.some(clip => clip.key.includes(':b')), 'shape family not mapped');
  for (let i = 1; i < clips.length; i++) assert.ok(clips[i]!.startFrame - clips[i - 1]!.startFrame >= 15, 'half a second apart');
  const gesture = mapSoundEvents(deriveSoundEvents(series('n', [-1200, -1200, ...Array.from({length: 10}, (_, i) => -1200 + (i + 1) * 120), 0, 0, 0, 0], 'card', 'x')), [{src: '/w.wav', role: 'move', volume: 0.6}, {src: '/p.wav', role: 'land', volume: 0.6}], 30);
  assert.deepEqual(gesture.map(clip => clip.role), ['move', 'land'], 'a slide keeps its own start and landing');
  for (const clip of clips) assert.ok(clips.filter(other => other.startFrame >= clip.startFrame && other.startFrame < clip.startFrame + 120).length <= 3, 'three per four seconds');
  assert.ok(clips.every(clip => clip.volume > 0.3 && clip.volume <= 0.6));
  // Eight equal landings 15 frames apart keep the first three, not the last three.
  const dense = mapSoundEvents(Array.from({length: 8}, (_, i) => ({key: `d${i}`, frame: 100 + i * 15, role: 'land' as const, intensity: 0.5, pan: 0, family: 'card' as const, frames: 1})), [{src: '/p.wav', role: 'land', volume: 0.6}], 30);
  assert.deepEqual(dense.map(clip => clip.startFrame), [100, 115, 130]);
});

test('score.py self-check: a 90 bpm score of 18.667 s renders whole and every hit stands over the second before it', {timeout: 120000}, () => {
  const result = spawnSync('python3', ['scripts/assets/score.py', '--self-check'], {encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /18\.667 s at 90 bpm: hits accent/);
  assert.match(result.stdout, /score self-check ok/);
});
