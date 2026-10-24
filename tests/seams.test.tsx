import React from 'react';
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {FrameProvider, collectMotion} from '../src/core/index';
import {Seam, cutTheCurve, inverseZoom, nudge, rackFocus, waterfallCut, waterfallEntry, zoomThrough} from '../src/packages/seams';
import {checkSeams, inferBoundaries, parseScenes, seamVector, type SeamSample} from '../scripts/seam-check.mjs';

const config = {id: 'Test', width: 1920, height: 1080, fps: 30, durationInFrames: 200};
const values = (fn: (frame: number) => number, from: number, to: number) => Array.from({length: to - from + 1}, (_, i) => fn(from + i));
const steps = (list: number[]) => list.slice(1).map((v, i) => v - list[i]!);
const within = (a: number, b: number, tolerance: number) => Math.abs(a - b) <= tolerance * Math.max(Math.abs(a), Math.abs(b));

test('cutTheCurve: mirrored power-4 eases, monotone, exit last step equals entry first step, cut at the midpoint', () => {
  const at = 100, duration = 24, cut = 112;
  const exit = values(frame => cutTheCurve({frame, at, duration}).exit.value, at, cut);
  const entry = values(frame => cutTheCurve({frame, at, duration}).entry.value, cut, at + duration);
  assert.equal(cutTheCurve({frame: 0, at, duration}).cut, cut);
  assert.equal(exit[0], 0);
  assert.equal(exit.at(-1), -230.4);
  assert.equal(entry[0], 230.4);
  assert.ok(Math.abs(entry.at(-1)!) < 1e-9);
  assert.ok(steps(exit).every(d => d <= 0) && steps(entry).every(d => d <= 0), 'both sides move left the whole way');
  assert.ok(within(steps(exit).at(-1)!, steps(entry)[0]!, 0.1), `exit last step ${steps(exit).at(-1)} vs entry first ${steps(entry)[0]}`);
  const mid = cutTheCurve({frame: cut, at, duration, subject: 'text'});
  assert.equal(mid.exit.filter, 'blur(10px)');
  assert.equal(mid.entry.filter, 'blur(10px)');
  assert.equal(cutTheCurve({frame: cut, at, duration}).exit.filter, 'blur(18px)');
  assert.equal(cutTheCurve({frame: at, at, duration}).exit.filter, 'none');
  assert.equal(cutTheCurve({frame: cut, at, duration, axis: 'y', direction: 1}).exit.transform, 'translateY(129.6px)');
});

test('zoomThrough grows on both sides, inverseZoom shrinks on both sides, and the opacity floor shows the stage at the cut', () => {
  const at = 0, duration = 24;
  const grow = values(frame => zoomThrough({frame, at, duration}).exit.value, 0, 12).concat(values(frame => zoomThrough({frame, at, duration}).entry.value, 12, 24));
  assert.deepEqual([grow[0], grow[12], grow[13], grow.at(-1)], [1, 1.12, 0.88, 1]);
  assert.ok(steps(grow).filter((_, i) => i !== 12).every(d => d >= 0), 'd(scale)/dt stays positive on both sides');
  const shrink = values(frame => inverseZoom({frame, at, duration}).exit.value, 0, 12).concat(values(frame => inverseZoom({frame, at, duration}).entry.value, 12, 24));
  assert.deepEqual([shrink[12], shrink[13]], [0.88, 1.12]);
  assert.ok(steps(shrink).filter((_, i) => i !== 12).every(d => d <= 0));
  assert.equal(zoomThrough({frame: 12, at, duration}).exit.opacity, 0.35);
  assert.equal(zoomThrough({frame: 12, at, duration}).entry.opacity, 0.35);
  assert.equal(zoomThrough({frame: 12, at, duration}).entry.transform, 'scale(0.88)');
  assert.equal(rackFocus({frame: 12, at, duration}).exit.value, -57.6);
});

test('waterfallCut staggers words and keeps the last exit as fast as the first entry; nudge and waterfallEntry are monotone', () => {
  const at = 0, duration = 30, words = 4;
  const word = (frame: number) => waterfallCut({frame, at, duration, words, stagger: 2});
  assert.equal(word(0).length, 4);
  assert.equal(word(0)[3]!.cut, 21);
  const lastExit = values(frame => word(frame)[3]!.exit.value, 0, 15);
  const firstEntry = values(frame => word(frame)[0]!.entry.value, 15, 30);
  assert.ok(within(steps(lastExit).at(-1)!, steps(firstEntry)[0]!, 0.1));
  assert.ok(word(4)[0]!.exit.value < word(4)[3]!.exit.value, 'the first word is ahead of the last');
  assert.throws(() => waterfallCut({frame: 0, at, duration: 10, words: 6, stagger: 2}), /do not fit/);
  const slide = values(frame => nudge({frame, at: 10, duration: 40, from: 0, to: 100}), 10, 50);
  assert.equal(slide[0], 0);
  assert.ok(Math.abs(slide.at(-1)! - 100) < 1e-9);
  assert.ok(steps(slide).every(d => d > 0));
  assert.ok(Math.abs(slide[4]! - 6.06) < 0.1 && Math.abs(slide[30]! - 84.85) < 0.1, `phase marks ${slide[4]} ${slide[30]}`);
  const first = waterfallEntry({frame: 10, at: 0, index: 0});
  const heavy = waterfallEntry({frame: 10, at: 0, index: 2, weight: 2});
  assert.ok(first.progress > heavy.progress, 'later and heavier items lag');
  assert.equal(waterfallEntry({frame: 0, at: 0, index: 0}).y, 129.6);
  assert.equal(waterfallEntry({frame: 100, at: 0, index: 0}).transform, 'translateY(0px)');
});

test('<Seam> markup is deterministic per frame, shows the right side, and its probes pass checkSeams', () => {
  const seam = <Seam at={40} duration={24} id="s" from={<b>A</b>} to={<i>B</i>} />;
  const render = (frame: number) => renderToStaticMarkup(<FrameProvider config={config} frame={frame}>{seam}</FrameProvider>);
  assert.equal(render(45), render(45));
  assert.notEqual(render(45), render(46));
  assert.match(render(51), /translateX\(.*<b>A<\/b>/);
  assert.match(render(52), /translateX\(230\.4px\).*<i>B<\/i>/);
  assert.doesNotMatch(render(52), /<b>A/);
  collectMotion();
  for (let frame = 0; frame < 100; frame++) render(frame);
  const samples = collectMotion() as SeamSample[];
  assert.deepEqual([...new Set(samples.map(s => `${s.key}:${s.family}:${s.axis}`))], ['s-out:camera:x', 's-in:camera:x']);
  const report = checkSeams(samples, [52]);
  assert.deepEqual(report.findings, []);
  assert.deepEqual(report.vectors.map(v => [v.out.axis, v.out.direction, v.in.axis, v.in.direction]), [['x', -1, 'x', -1]]);
  assert.deepEqual(inferBoundaries(samples, 0), [52]);
  // Z reports scale and a zoom that grows on both sides reads as one push.
  const zoom = <Seam at={40} duration={24} technique="zoomThrough" id="z" from={<b>A</b>} to={<i>B</i>} />;
  for (let frame = 30; frame < 80; frame++) renderToStaticMarkup(<FrameProvider config={config} frame={frame}>{zoom}</FrameProvider>);
  const zoomReport = checkSeams(collectMotion() as SeamSample[], [52]);
  assert.deepEqual(zoomReport.findings, []);
  assert.equal(zoomReport.vectors[0]!.out.axis, 'z');
  assert.equal(zoomReport.vectors[0]!.out.direction, 1);
});

const series = (key: string, from: number, list: number[], axis: SeamSample['axis'] = 'x', family = 'camera'): SeamSample[] => list.map((value, i) => ({key, frame: from + i, value, family, axis}));
const exitCurve = (travel: number, len = 12) => Array.from({length: len}, (_, i) => travel * (i / len) ** 4);
const entryCurve = (travel: number, len = 12) => Array.from({length: len}, (_, i) => travel * (1 - i / len) ** 4);
const fixture = (name: string) => JSON.parse(readFileSync(`tests/fixtures/seams/${name}.motion.json`, 'utf8')) as {samples: SeamSample[]};

test('checkSeams: clean passes, mirrored, axis swap, dead beat, speed mismatch and ping-pong are flagged with fixes', () => {
  assert.deepEqual(checkSeams(fixture('clean').samples, [30]).findings, []);
  const mirrored = checkSeams(fixture('mirrored').samples, [30]).findings;
  assert.deepEqual(mirrored.map(f => [f.code, f.severity, f.boundary]), [['seam_mirrored_vector', 'error', 30]]);
  assert.match(mirrored[0]!.fix, /never mirror/);
  const swap = [...series('a-out', 18, exitCurve(-230)), ...series('a-in', 30, entryCurve(130), 'y')];
  assert.deepEqual(checkSeams(swap, [30]).findings.map(f => f.code), ['seam_axis_swap']);
  const dead = [...series('a-out', 18, Array(12).fill(0)), ...series('a-in', 30, Array(12).fill(0))];
  assert.deepEqual(checkSeams(dead, [30]).findings.map(f => f.code), ['seam_dead_beat']);
  const slow = [...series('a-out', 18, exitCurve(-230)), ...series('a-in', 30, entryCurve(40))];
  assert.deepEqual(checkSeams(slow, [30]).findings.map(f => f.code), ['seam_speed_mismatch']);
  const rest = [...series('a-out', 18, exitCurve(-230)), ...series('a-in', 30, Array(12).fill(0))];
  assert.deepEqual(checkSeams(rest, [30]).findings.map(f => [f.code, /at rest/.test(f.fix)]), [['seam_speed_mismatch', true]]);
  const pingpong = [...series('a-out', 18, exitCurve(-230)), ...series('a-in', 30, entryCurve(230)), ...series('b-out', 78, exitCurve(230)), ...series('b-in', 90, entryCurve(-230))];
  const report = checkSeams(pingpong, [30, 90]);
  assert.deepEqual(report.findings.map(f => [f.code, f.boundary]), [['seam_pingpong', 90]]);
  assert.equal(report.current, 'x-');
  // The Z violation: a receding exit answered by a grow-from-small entry.
  const z = [...series('z-out', 18, exitCurve(-0.12).map(v => 1 + v), 'scale'), ...series('z-in', 30, entryCurve(-0.12).map(v => 1 + v), 'scale')];
  assert.deepEqual(checkSeams(z, [30]).findings.map(f => [f.code, /inverseZoom/.test(f.fix)]), [['seam_mirrored_vector', true]]);
  // Camera probes outrank other families; without them every x/y/scale probe counts.
  const noisy = [...series('a-out', 18, exitCurve(-230)), ...series('a-in', 30, entryCurve(230)), ...series('card', 30, entryCurve(900), 'y', 'card')];
  assert.equal(seamVector(noisy, 30, 'in')!.axis, 'x');
  assert.equal(seamVector(noisy.filter(s => s.family !== 'camera'), 30, 'in')!.axis, 'y');
  // No data near the boundary is a warning; a boundary outside the dump range is skipped.
  const sparse = checkSeams(series('a-out', 18, exitCurve(-230)), [30, 150], {from: 0, to: 100});
  assert.deepEqual(sparse.findings.map(f => [f.code, f.severity]), [['seam_no_motion_data', 'warning']]);
  assert.deepEqual(sparse.skipped, [150]);
});

test('parseScenes reads the start of every scene-table row after the first, from a snippet and from the seam-reel brief', () => {
  assert.deepEqual(parseScenes('| Frames | What |\n|---|---|\n| 0-90 | hook |\n| 90–240 | beat |\n| 240-899 | name, still from 840 |\n'), [90, 240]);
  assert.deepEqual(parseScenes(readFileSync('examples/samples/seam-reel/prompt.md', 'utf8')), [90, 240, 390, 540, 690]);
});
