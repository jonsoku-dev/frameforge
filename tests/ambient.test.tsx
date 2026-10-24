import React from 'react';
import assert from 'node:assert/strict';
import test from 'node:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {Stream, breathe, drift, streamPath} from '../src/core/index';

const points = (d: string) => d.slice(1, -1).split('L').map(pair => pair.split(' ').map(Number) as [number, number]);

test('drift and breathe are pure in the frame, stay inside their amplitude and never stop on every axis at once', () => {
  assert.equal(drift(37, {x: 8, y: 6, scale: 0.02}), drift(37, {x: 8, y: 6, scale: 0.02}));
  assert.equal(drift(0, {x: 8, y: 6}), 'translate(0px, 6px) scale(1)');
  for (let f = 0; f < 240; f++) {
    const [x, y, s] = drift(f, {x: 8, y: 6, scale: 0.02}).match(/-?[\d.]+/g)!.map(Number);
    assert.ok(Math.abs(x!) <= 8 && Math.abs(y!) <= 6 && Math.abs(s! - 1) <= 0.02 + 1e-9, `frame ${f} inside the amplitude`);
    assert.notEqual(drift(f, {x: 8, y: 6}), drift(f + 15, {x: 8, y: 6}), `frame ${f} differs from half a second later`);
  }
  assert.equal(breathe(15, 60, 0.05), 1.05);
  assert.ok(Math.abs(breathe(45, 60, 0.05) - 0.95) < 1e-12);
  assert.throws(() => drift(0, {period: 0}), /period/);
});

test('streamPath extends with progress, reaches the target, thins toward it, and draws nothing at 0', () => {
  const base = {from: [100, 100] as [number, number], to: [400, 600] as [number, number], width: 20};
  assert.equal(streamPath({...base, progress: 0}), '');
  assert.equal(streamPath({...base, progress: [0.6, 0.4]}), '', 'a tail past the head draws nothing');
  assert.equal(streamPath({...base, progress: 0.5, frame: 9, wobble: 4}), streamPath({...base, progress: 0.5, frame: 9, wobble: 4}), 'deterministic');
  const full = points(streamPath({...base, progress: 1}));
  const n = full.length / 2, head = [(full[n - 1]![0] + full[n]![0]) / 2, (full[n - 1]![1] + full[n]![1]) / 2];
  assert.deepEqual(head.map(Math.round), [400, 600], 'the head lands on the target');
  const widthAt = (i: number) => Math.hypot(full[i]![0] - full[full.length - 1 - i]![0], full[i]![1] - full[full.length - 1 - i]![1]);
  assert.ok(Math.abs(widthAt(0) - 20) < 0.01 && Math.abs(widthAt(n - 1) - 8) < 0.01, `full width at the source, 40 % at the target (${widthAt(0)}, ${widthAt(n - 1)})`);
  const half = points(streamPath({...base, progress: 0.5}));
  assert.ok(Math.max(...half.map(([, y]) => y)) < 600 * 0.6, 'half progress stops part way down');
  const falling = points(streamPath({...base, progress: [0.5, 1]}));
  assert.ok(Math.min(...falling.map(([, y]) => y)) > 200, 'a detached tail has left the source');
  const drop = points(streamPath({from: [50, 0], to: [50, 300], progress: 1, width: 10}));
  assert.ok(drop.every(([x]) => Number.isFinite(x) && Math.abs(x - 50) <= 5), 'a straight drop stays on its line');
  assert.ok(renderToStaticMarkup(<Stream {...base} progress={1} color="#2F5BFF" />).includes('fill="#2F5BFF"'));
  assert.equal(renderToStaticMarkup(<Stream {...base} progress={0} />), '');
});
