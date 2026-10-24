import React from 'react';
import assert from 'node:assert/strict';
import test from 'node:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {annotationPath, Box, Bracket, clampParams, Encircle, fitBox, flowFieldLines, FrameProvider, Generative, GENERATIVE_SYSTEMS, getGenerativeSystem, Highlight, meshGradientBlobs, StrikeThrough, Underline} from '../src/core/index';

const palette = {ink: '#111111', paper: '#F4F4F1', accent: '#2F5BFF', soft: '#CFE0FF'};
const config = {id: 'Test', width: 320, height: 180, fps: 30, durationInFrames: 100};
const render = (frame: number, children: React.ReactNode) => renderToStaticMarkup(<FrameProvider config={config} frame={frame}>{children}</FrameProvider>);

test('registry ids are unique and every schema entry is a studio number variable', () => {
  const ids = GENERATIVE_SYSTEMS.map(system => system.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(ids, ['flowField', 'particles', 'starfield', 'meshGradient', 'halftone', 'ripples', 'voronoi', 'noiseLines', 'aurora']);
  for (const system of GENERATIVE_SYSTEMS) {
    assert.ok(system.title && system.schema.length >= 3, system.id);
    for (const entry of system.schema) {
      assert.equal(entry.type, 'number');
      assert.ok(entry.min <= entry.default && entry.default <= entry.max && entry.step > 0 && entry.label, `${system.id}.${entry.key}`);
    }
    assert.equal(new Set(system.schema.map(entry => entry.key)).size, system.schema.length);
  }
  assert.equal(getGenerativeSystem('aurora').title, 'Aurora');
  assert.throws(() => getGenerativeSystem('nope'), /Unknown generative system/);
});

test('every system geometry is deterministic for (seed, t), moves with t and differs for another seed', () => {
  for (const system of GENERATIVE_SYSTEMS) {
    const params = clampParams(system);
    const a = JSON.stringify(system.geometry('ident', params, 2.5)), b = JSON.stringify(system.geometry('ident', params, 2.5));
    assert.equal(a, b, system.id);
    assert.notEqual(a, JSON.stringify(system.geometry('other', params, 2.5)), `${system.id} seed`);
    assert.notEqual(a, JSON.stringify(system.geometry('ident', params, 7.5)), `${system.id} time`);
    assert.ok(a.length > 20 && !a.includes('null') && !a.includes('NaN'), system.id);
  }
});

test('params clamp to the schema and fill defaults', () => {
  const system = getGenerativeSystem('meshGradient');
  assert.deepEqual(clampParams(system), {blobs: 4, radius: 0.55, drift: 0.12, speed: 0.05});
  assert.deepEqual(clampParams(system, {blobs: 99, radius: -1, drift: Number.NaN, extra: 3}), {blobs: 5, radius: 0.2, drift: 0.12, speed: 0.05});
  assert.equal(meshGradientBlobs('s', clampParams(system, {blobs: 3}), 0).length, 3);
  const flow = getGenerativeSystem('flowField');
  const early = flowFieldLines('s', clampParams(flow, {grow: 4}), 0.5), late = flowFieldLines('s', clampParams(flow, {grow: 4}), 10);
  assert.equal(early.length, late.length);
  assert.ok(early.every((line, i) => line.length <= late[i]!.length) && early.some((line, i) => line.length < late[i]!.length));
  assert.deepEqual(fitBox('cover', 320, 180), {x: 0, y: -70, width: 320, height: 320});
  assert.deepEqual(fitBox('contain', 320, 180), {x: 70, y: 0, width: 180, height: 180});
  assert.deepEqual(fitBox('fill', 320, 180), {x: 0, y: 0, width: 320, height: 180});
});

test('Generative renders a sized canvas and validates its props', () => {
  assert.equal(render(3, <Generative system="aurora" seed="a" width={320} height={180} palette={palette} />), '<canvas width="320" height="180" style="width:320px;height:180px"></canvas>');
  assert.equal(render(3, <Generative system={getGenerativeSystem('halftone')} seed={1} width={100} height={50} pixelDensity={2} palette={palette} />), '<canvas width="200" height="100" style="width:100px;height:50px"></canvas>');
  assert.throws(() => render(0, <Generative system="nope" seed="a" width={320} height={180} palette={palette} />), /Unknown generative system/);
  assert.throws(() => render(0, <Generative system="aurora" seed="a" width={0} height={180} palette={palette} />), /width/);
});

test('annotation markup is deterministic, progress 0 draws nothing, roughness 0 is straight, seeds change paths', () => {
  const one = render(0, <Highlight progress={0.5} seed="k" color="#ff0">글</Highlight>);
  assert.equal(one, render(0, <Highlight progress={0.5} seed="k" color="#ff0">글</Highlight>));
  assert.ok(one.includes('stroke-dashoffset="0.5"') && one.includes('z-index:-1') && one.includes('stroke-width="85"') && !one.includes('non-scaling-stroke'));
  assert.ok(!render(0, <Underline progress={0}>글</Underline>).includes('<svg'));
  assert.ok(render(0, <Underline progress={0.01} seed={2} roughness={0}>글</Underline>).includes('d="M0 94L25 94L50 94L75 94L100 94"'));
  assert.equal(annotationPath('strike', 5, 0), 'M0 52L25 52L50 52L75 52L100 52');
  assert.equal(annotationPath('box', 5, 0), 'M0 0L100 0L100 100L0 100Z');
  assert.notEqual(annotationPath('underline', 'a', 1), annotationPath('underline', 'b', 1));
  assert.equal(annotationPath('underline', 'a', 1), annotationPath('underline', 'a', 1));
  assert.ok(annotationPath('circle', 'a', 0).startsWith('M0 50C0 22.38 22.38 0 50 0C'));
  assert.notEqual(annotationPath('circle', 'a', 0.8), annotationPath('circle', 'b', 0.8));
  for (const side of ['left', 'right', 'top', 'bottom'] as const) assert.ok(render(0, <Bracket side={side} progress={1} roughness={0}>글</Bracket>).includes(annotationPath(`bracket-${side}`, 1, 0)));
  const box = render(0, <Box progress={1} padding={10} strokeWidth={4}>글</Box>);
  assert.ok(box.includes('left:-10px') && box.includes('vector-effect="non-scaling-stroke"') && box.includes('stroke-width="4"') && box.includes('z-index:1'));
  assert.ok(render(0, <Encircle progress={1}>글</Encircle>).includes('C') && render(0, <StrikeThrough progress={1} roughness={0}>글</StrikeThrough>).includes('L100 52'));
  assert.throws(() => render(0, <Underline progress={2}>글</Underline>), /progress/);
});
