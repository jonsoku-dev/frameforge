import React from 'react';
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {compareDigest, digestMarkup, type MarkupDigest} from './oracle-digest';
import {renderToStaticMarkup} from 'react-dom/server';
import {Easing, FrameProvider, useCurrentFrame, useVideoConfig} from '../src/core/index';
import {createPlayback, Player, Thumbnail, type PlayerEventTypes} from '../src/packages/player';
import {clockWipe, fade, flip, iris, linearTiming, none, slide, springTiming, TransitionSeries, useTransitionProgress, wipe, type TransitionPresentationComponentProps, type TransitionTiming} from '../src/packages/transitions';

type TimingSpec = {linear?: {durationInFrames: number; easing?: string}; spring?: Parameters<typeof springTiming>[0]; fixed?: [number, number]};
type Item = ['seq', number, Record<string, unknown>?] | ['tr', TimingSpec, [string, Record<string, unknown>]?] | ['overlay', number, number?] | ['div'];
type Scene = {width?: number; height?: number; fps?: number; durationInFrames: number; series?: Record<string, unknown>; items: Item[]};
const oracle = JSON.parse(readFileSync(new URL('../compatibility/transitions.json', import.meta.url), 'utf8')) as {
  cases: {name: string; scene: Scene; frame: number; digest?: MarkupDigest; error?: string}[];
  timings: {name: string; timing: TimingSpec; fps: number; frame: number; durationInFrames: number; progress: number}[];
};

const EASING: Record<string, (x: number) => number> = {quad: Easing.quad, cubic: Easing.cubic, inOutCubic: Easing.inOut(Easing.cubic), bezier: Easing.bezier(0.5, 0, 0.5, 1)};
const Spy = ({presentationProgress, presentationDirection, presentationDurationInFrames, passedProps, bothEnteringAndExiting, children}: TransitionPresentationComponentProps<Record<string, unknown>>) =>
  <p data-props={JSON.stringify({presentationProgress, presentationDirection, presentationDurationInFrames, passedProps, bothEnteringAndExiting})}>{children}</p>;
const Probe = ({n}: {n: number}) => { const t = useTransitionProgress(); return <s>{`${n}:${useCurrentFrame()}/${useVideoConfig().durationInFrames}:${t.entering},${t.exiting},${t.isInTransitionSeries}`}</s>; };
const PRESENTATIONS: Record<string, (props: any) => {component: any; props: any}> = {fade, slide, wipe, flip, clockWipe, iris, none, spy: props => ({component: Spy, props})};
const timing = (spec: TimingSpec): TransitionTiming => spec.linear ? linearTiming({...spec.linear, easing: spec.linear.easing ? EASING[spec.linear.easing] : undefined})
  : spec.spring ? springTiming(spec.spring) : {getDurationInFrames: () => spec.fixed![0], getProgress: () => spec.fixed![1]};
const build = (scene: Scene) => <TransitionSeries {...scene.series}>{scene.items.map((item, i) =>
  item[0] === 'seq' ? <TransitionSeries.Sequence key={i} durationInFrames={item[1]} {...item[2]}><Probe n={i} /></TransitionSeries.Sequence>
  : item[0] === 'tr' ? <TransitionSeries.Transition key={i} timing={timing(item[1])} presentation={item[2] && PRESENTATIONS[item[2][0]]!(item[2][1])} />
  : item[0] === 'overlay' ? <TransitionSeries.Overlay key={i} durationInFrames={item[1]} offset={item[2]}><u>overlay</u></TransitionSeries.Overlay>
  : <div key={i} />)}</TransitionSeries>;
const render = (scene: Scene, frame: number) => renderToStaticMarkup(<FrameProvider frame={frame} config={{id: 'T', width: scene.width ?? 320, height: scene.height ?? 180, fps: scene.fps ?? 30, durationInFrames: scene.durationInFrames}}>{build(scene)}</FrameProvider>);

test('oracle: TransitionSeries markup matches the reference frame by frame', () => {
  const failures: string[] = [];
  for (const c of oracle.cases) {
    if (!c.digest) {
      assert.throws(() => render(c.scene, c.frame), Error, c.name);
      continue;
    }
    let problem: string | null;
    try { problem = compareDigest(render(c.scene, c.frame).replace(/ class="([^"]*)"( style="[^"]*")/g, '$2 class="$1"'), c.digest); } catch (error) { problem = `threw ${(error as Error).message}`; }
    if (problem) failures.push(`${c.name}: ${problem}`);
  }
  assert.ok(oracle.cases.length >= 100, 'at least 100 recorded cases');
  assert.deepEqual(failures, []);
});

test('oracle: linearTiming and springTiming durations and progress', () => {
  for (const c of oracle.timings) {
    const t = timing(c.timing);
    assert.ok(Math.abs(t.getDurationInFrames({fps: c.fps}) - c.durationInFrames) <= 1e-6, `${c.name} duration`);
    assert.ok(Math.abs(t.getProgress({frame: c.frame, fps: c.fps}) - c.progress) <= 1e-6, `${c.name} progress ${t.getProgress({frame: c.frame, fps: c.fps})} vs ${c.progress}`);
  }
});

test('a transition shortens the series by its duration', () => {
  const scene: Scene = {durationInFrames: 200, items: [['seq', 40], ['tr', {linear: {durationInFrames: 30}}], ['seq', 60], ['tr', {linear: {durationInFrames: 45}}], ['seq', 90]]};
  assert.match(render(scene, 114), /4:89\/90/);
  assert.doesNotMatch(render(scene, 115), /<s>/, '40 + 60 + 90 - 30 - 45 = 115 frames');
  assert.equal(springTiming({config: {damping: 200}}).getDurationInFrames({fps: 30}), 23);
});

test('compareDigest rejects a changed number and a changed structure', () => {
  const ref = digestMarkup('<a style="opacity:0.5000000001">');
  assert.equal(compareDigest('<a style="opacity:0.5">', ref), null);
  assert.ok(compareDigest('<a style="opacity:0.51">', ref));
  assert.ok(compareDigest('<b style="opacity:0.5">', ref));
});

/** Stands in for the browser frame clock: each step advances time and runs the frames requested so far. */
function fakeFrameClock() {
  let now = 1000, id = 0;
  const queue = new Map<number, FrameRequestCallback>();
  const saved = {request: globalThis.requestAnimationFrame, cancel: globalThis.cancelAnimationFrame, now: performance.now};
  globalThis.requestAnimationFrame = callback => { queue.set(++id, callback); return id; };
  globalThis.cancelAnimationFrame = handle => { queue.delete(handle); };
  performance.now = () => now;
  return {
    step(ms: number) { now += ms; const due = [...queue.values()]; queue.clear(); for (const callback of due) callback(now); },
    pending: () => queue.size,
    restore() { globalThis.requestAnimationFrame = saved.request; globalThis.cancelAnimationFrame = saved.cancel; performance.now = saved.now; },
  };
}
const record = (playback: ReturnType<typeof createPlayback>, names: PlayerEventTypes[]) => {
  const log: string[] = [];
  for (const name of names) playback.addEventListener(name, ({detail}) => log.push(`${name}${'frame' in detail ? `:${detail.frame}` : ''}`));
  return log;
};

test('player: playback follows the clock, not the number of animation frames', () => {
  const clock = fakeFrameClock();
  try {
    const playback = createPlayback({durationInFrames: 30, fps: 30, loop: false, playbackRate: 1, moveToBeginningWhenEnded: true});
    const log = record(playback, ['play', 'pause', 'ended', 'seeked', 'timeupdate']);
    playback.play();
    assert.equal(playback.isPlaying(), true);
    clock.step(100);
    assert.equal(playback.getCurrentFrame(), 3, '100 ms at 30 fps');
    clock.step(400);
    assert.equal(playback.getCurrentFrame(), 15, 'a long gap between frames skips ahead');
    playback.pause();
    clock.step(1000);
    assert.equal(playback.getCurrentFrame(), 15);
    assert.equal(clock.pending(), 0, 'pausing cancels the frame request');
    playback.seekTo(28);
    playback.play();
    clock.step(100);
    assert.equal(playback.isPlaying(), false);
    assert.equal(playback.getCurrentFrame(), 0, 'moveToBeginningWhenEnded returns to the start');
    assert.deepEqual(log, ['play', 'timeupdate:3', 'timeupdate:15', 'pause', 'seeked:28', 'play', 'pause', 'ended']);
  } finally { clock.restore(); }
});

test('player: loop wraps, rate scales and reverses, timeupdate is throttled', () => {
  const clock = fakeFrameClock();
  try {
    const playback = createPlayback({durationInFrames: 10, fps: 10, loop: true, playbackRate: 1, moveToBeginningWhenEnded: true, initialFrame: 8});
    const log = record(playback, ['timeupdate', 'ended']);
    let updates = 0;
    playback.addEventListener('frameupdate', () => updates++);
    playback.play();
    clock.step(300);
    assert.equal(playback.getCurrentFrame(), 1, '8 + 3 wraps to 1');
    clock.step(100); clock.step(100);
    assert.equal(updates, 3, 'frameupdate fires on every new frame');
    assert.deepEqual(log, ['timeupdate:1'], 'at most one timeupdate per 250 ms');
    playback.update({durationInFrames: 10, fps: 10, loop: true, playbackRate: -2, moveToBeginningWhenEnded: true});
    clock.step(100);
    assert.equal(playback.getCurrentFrame(), 1, 'a rate change continues from the current frame');
    playback.pauseAndReturnToPlayStart();
    assert.equal(playback.getCurrentFrame(), 8);
    assert.equal(playback.isPlaying(), false);
  } finally { clock.restore(); }
});

test('player: volume and mute events, validation', () => {
  const playback = createPlayback({durationInFrames: 10, fps: 30, loop: false, playbackRate: 1, moveToBeginningWhenEnded: true});
  const log = record(playback, ['volumechange', 'mutechange'] as PlayerEventTypes[]);
  playback.addEventListener('volumechange', ({detail}) => log.push(`volume ${detail.volume}`));
  playback.mute(); playback.mute(); playback.unmute(); playback.setVolume(0.25);
  assert.deepEqual(log, ['mutechange', 'mutechange', 'volumechange', 'volume 0.25']);
  assert.equal(playback.getVolume(), 0.25);
  assert.throws(() => playback.setVolume(2), /between 0 and 1/);
  playback.seekTo(99);
  assert.equal(playback.getCurrentFrame(), 9, 'seeking clamps to the last frame');
});

test('player and thumbnail render the component at their frame with input props', () => {
  const Scene = ({title}: {title: string}) => <b>{title}:{useCurrentFrame()}/{useVideoConfig().durationInFrames}</b>;
  const player = renderToStaticMarkup(<Player component={Scene} inputProps={{title: 'hi'}} durationInFrames={60} fps={30} compositionWidth={320} compositionHeight={180} initialFrame={12} controls style={{width: 160}} />);
  assert.match(player, /<b>hi:12\/60<\/b>/);
  assert.match(player, /width:160px;aspect-ratio:320 \/ 180/);
  assert.match(player, /aria-label="Play"/);
  assert.match(player, /aria-label="Seek"/);
  assert.match(renderToStaticMarkup(<Thumbnail component={Scene} inputProps={{title: 't'}} frameToDisplay={30} durationInFrames={60} fps={30} compositionWidth={320} compositionHeight={180} />), /<b>t:30\/60<\/b>/);
  assert.throws(() => renderToStaticMarkup(<Player durationInFrames={60} fps={30} compositionWidth={320} compositionHeight={180} />), /exactly one of component/);
  assert.throws(() => renderToStaticMarkup(<Player component={Scene} durationInFrames={60} fps={30} compositionWidth={320} compositionHeight={180} playbackRate={0} />), /playbackRate/);
});
