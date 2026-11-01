import assert from 'node:assert/strict';
import test from 'node:test';
import {deriveSoundEvents, type MotionSample} from '../src/core/sound';

test('long motion and reveal series retain their events without overflowing the argument limit', () => {
  const count = 200_001;
  const samples = (axis: MotionSample['axis'], value: (frame: number) => number): MotionSample[] =>
    Array.from({length: count}, (_, frame) => ({key: 'long', frame, value: value(frame), family: 'shape', axis}));

  const reveal = deriveSoundEvents(samples('progress', frame => frame / (count - 1)));
  assert.deepEqual(reveal.map(({role, frame}) => [role, frame]), [['appear', 100_001]]);

  const motion = deriveSoundEvents(samples('x', frame => Math.min(1, Math.max(0, (frame - 100_000) / 10))));
  assert.deepEqual(motion.map(({role, frame}) => [role, frame]), [['move', 100_000], ['land', 100_010]]);
  assert.ok(motion.every(event => event.pan === 0.6));
});

test('a reveal crossing an offset midpoint waits until it passes halfway', () => {
  const values = [-3, -2, -1, 0, 1, 2, 3];
  const samples: MotionSample[] = values.map((value, frame) => ({key: 'reveal', frame, value, family: 'shape', axis: 'progress'}));
  assert.deepEqual(deriveSoundEvents(samples).map(({role, frame}) => [role, frame]), [['appear', 4]]);
});
