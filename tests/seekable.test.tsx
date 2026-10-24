import React from 'react';
import assert from 'node:assert/strict';
import test from 'node:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {lintEntry} from '../scripts/lint.mjs';
import {applySeek, FrameProvider, Seekable, seekableFrame, seekTarget, type SeekableAdapter} from '../src/core/index';

const config = {id: 'Test', width: 320, height: 180, fps: 30, durationInFrames: 90};

test('seekableFrame maps frames to ms, holds at both ends, and wraps when looping', () => {
  assert.equal(seekableFrame(15, 30, 1000), 500);
  assert.equal(seekableFrame(45, 30, 1000), 1000);
  assert.equal(seekableFrame(-3, 30, 1000), 0);
  assert.equal(seekableFrame(45, 30, 1000, true), 500);
  assert.equal(seekableFrame(30, 30, 1000, true), 0);
  assert.equal(seekableFrame(-15, 30, 1000, true), 500);
  assert.equal(seekableFrame(10, 30, 0), 0, 'an empty animation stays at 0');
});

test('an adapter is seeked to a continuous frame in [0, duration]; an animation gets currentTime from its end time', () => {
  const seen: number[] = [];
  const adapter: SeekableAdapter = {duration: 40, seek: frame => seen.push(frame)};
  for (const frame of [0, 12.5, 40, 55]) applySeek(adapter, frame, 30);
  applySeek(adapter, 55, 30, true);
  assert.deepEqual(seen, [0, 12.5, 40, 40, 15]);
  const animation = {currentTime: null as number | null, paused: 0, pause() { this.paused++; }, effect: {getComputedTiming: () => ({endTime: 2000})}};
  assert.equal(seekTarget(animation as unknown as Animation, 30, 30), 1000);
  applySeek(animation as unknown as Animation, 90, 30);
  assert.deepEqual([animation.currentTime, animation.paused], [2000, 1], 'held at the end and paused');
  assert.equal(seekTarget({effect: null} as unknown as Animation, 30, 30), 0);
});

test('<Seekable> server markup is the same div at every frame and never calls animate', () => {
  let calls = 0;
  const markup = (frame: number) => renderToStaticMarkup(<FrameProvider config={config} frame={frame}><Seekable animate={() => { calls++; return {duration: 1, seek: () => {}}; }} style={{width: 10}}><span>a</span></Seekable></FrameProvider>);
  assert.equal(markup(0), '<div style="width:10px"><span>a</span></div>');
  assert.equal(markup(45), markup(0));
  assert.equal(calls, 0);
});

test('lint passes a <Seekable> scene and still flags raw CSS animation', () => {
  const report = lintEntry('tests/fixtures/seekable/entry.tsx');
  assert.deepEqual(report.files, ['tests/fixtures/seekable/entry.tsx', 'tests/fixtures/seekable/Scene.tsx']);
  assert.deepEqual(report.findings, []);
  const dirty = lintEntry('tests/fixtures/lint/dirty/entry.tsx').findings.filter((finding: {code: string}) => finding.code === 'css_time_animation');
  assert.ok(dirty.length >= 3);
});
