import React from 'react';
import assert from 'node:assert/strict';
import {compareDigest, type MarkupDigest} from '../oracle-digest';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {FrameProvider, Sequence, useCurrentFrame, useVideoConfig} from '../../src/core/index';
import {CameraMotionBlur, MotionBlur, Trail} from '../../src/packages/motion-blur';

type Case = {kind: 'Trail' | 'CameraMotionBlur'; props: Record<string, unknown>; frame: number; from: number; digest?: MarkupDigest; error?: string};
const oracle = JSON.parse(readFileSync(new URL('../../compatibility/motion-blur.json', import.meta.url), 'utf8')) as {cases: Case[]};
const AF = 'position:absolute;top:0;left:0;right:0;bottom:0;width:100%;height:100%;display:flex;flex-direction:column';
const config = {id: 'Blur', width: 100, height: 100, fps: 30, durationInFrames: 30};
const Probe = () => <i>{`${useCurrentFrame()}/${useVideoConfig().durationInFrames}`}</i>;
const live = (value: unknown) => value === 'NaN' ? NaN : value === 'Infinity' ? Infinity : value;
const render = (frame: number, node: React.ReactNode, from = 0) => renderToStaticMarkup(<FrameProvider config={config} frame={frame}><Sequence from={from} layout="none">{node}</Sequence></FrameProvider>).split(AF).join('AF');

test('motion-blur oracle: markup and the frame each layer sees match exactly', () => {
  assert.ok(oracle.cases.length > 1000);
  for (const c of oracle.cases) {
    const Component = (c.kind === 'Trail' ? Trail : CameraMotionBlur) as React.FC<Record<string, unknown>>;
    const props = Object.fromEntries(Object.entries(c.props).map(([k, v]) => [k, live(v)]));
    const run = () => render(c.frame, <Component {...props}><Probe /></Component>, c.from);
    const name = `${c.kind} ${JSON.stringify(c.props)} frame ${c.frame} from ${c.from}`;
    if (c.error !== undefined) assert.throws(run, (e: Error) => e.message === c.error, name);
    else assert.equal(compareDigest(run() as string, c.digest!, 0), null, name);
  }
});

test('MotionBlur is Trail with the old blurOpacity name', () => {
  assert.equal(render(10, <MotionBlur layers={3} lagInFrames={0.5} blurOpacity={0.8}><Probe /></MotionBlur>), render(10, <Trail layers={3} lagInFrames={0.5} trailOpacity={0.8}><Probe /></Trail>));
});

test('layer frames clamp to the enclosing Sequence', () => {
  assert.equal(render(28, <Trail layers={1} lagInFrames={-5} trailOpacity={1}><Probe /></Trail>, 4), '<div style="AF"><div style="AF;opacity:0"><i>25/26</i></div><i>24/26</i></div>');
});
