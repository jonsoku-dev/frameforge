import React from 'react';
import assert from 'node:assert/strict';
import test from 'node:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtempSync, readdirSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {hexToVec3, shaders, shaderSource, uniformValue} from '../src/packages/shader';
import {ChromaticShift, chromaticOffsets, Extrude, extrudeShadow, Glow, glowFilter, Scanlines, VhsGlitch, vhsGlitch} from '../src/packages/post';
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
  assert.ok(render(0, <Underline progress={0.01} seed={2} roughness={0}>글</Underline>).includes('d="M0 100L25 100L50 100L75 100L100 100"'));
  const under = render(0, <Underline progress={1} padding={8}>글</Underline>);
  assert.ok(under.includes('top:calc(0% - 0px)') && under.includes('height:calc(100% + 8px)'), under);
  const circled = render(0, <Encircle progress={1} padding={4}>글</Encircle>);
  assert.ok(circled.includes('left:calc(-20.7% - 4px)') && circled.includes('width:calc(141.4% + 8px)'), circled);
  assert.equal(annotationPath('strike', 5, 0), 'M0 52L25 52L50 52L75 52L100 52');
  assert.equal(annotationPath('box', 5, 0), 'M0 0L100 0L100 100L0 100Z');
  assert.notEqual(annotationPath('underline', 'a', 1), annotationPath('underline', 'b', 1));
  assert.equal(annotationPath('underline', 'a', 1), annotationPath('underline', 'a', 1));
  assert.ok(annotationPath('circle', 'a', 0).startsWith('M0 50C0 22.38 22.38 0 50 0C'));
  assert.notEqual(annotationPath('circle', 'a', 0.8), annotationPath('circle', 'b', 0.8));
  for (const side of ['left', 'right', 'top', 'bottom'] as const) assert.ok(render(0, <Bracket side={side} progress={1} roughness={0}>글</Bracket>).includes(annotationPath(`bracket-${side}`, 1, 0)));
  const box = render(0, <Box progress={1} padding={10} strokeWidth={4}>글</Box>);
  assert.ok(box.includes('left:calc(0% - 10px)') && box.includes('vector-effect="non-scaling-stroke"') && box.includes('stroke-width="4"') && box.includes('z-index:1'));
  assert.ok(render(0, <Encircle progress={1}>글</Encircle>).includes('C') && render(0, <StrikeThrough progress={1} roughness={0}>글</StrikeThrough>).includes('L100 52'));
  assert.throws(() => render(0, <Underline progress={2}>글</Underline>), /progress/);
});

test('aurora lower edges sit below the upper edges and are not straight lines', () => {
  const system = getGenerativeSystem('aurora');
  for (const band of system.geometry('ident', clampParams(system), 2) as {edge: number[]; bottom: number[]}[]) {
    assert.ok(band.bottom.every((y, s) => y > band.edge[s]!));
    assert.ok(Math.max(...band.bottom) - Math.min(...band.bottom) > 0.02);
  }
});

test('Shader uniforms: numbers, vec arrays and hex colours get their GLSL types, and the prelude declares only what the source does not', () => {
  assert.deepEqual(uniformValue('a', 2), {type: 'float', values: [2]});
  assert.deepEqual(uniformValue('a', [1, 2, 3, 4]).type, 'vec4');
  assert.deepEqual(hexToVec3('#ff0000'), [1, 0, 0]);
  assert.deepEqual(uniformValue('c', '#fff').values, [1, 1, 1]);
  assert.throws(() => uniformValue('c', 'red'), /#rgb or #rrggbb/);
  assert.throws(() => uniformValue('v', [1, 2, 3, 4, 5]), /2-4 numbers/);
  const {source, offset} = shaderSource('uniform float u_beat;\nvoid main() { fragColor = vec4(u_glow); }', {u_beat: 1, u_glow: [1, 0, 0, 1]});
  assert.match(source, /^#version 300 es/);
  assert.equal(source.match(/uniform float u_beat;/g)?.length, 1, 'a uniform the source declares is not declared twice');
  assert.match(source, /uniform vec4 u_glow;/);
  assert.equal(source.split('\n')[offset], 'uniform float u_beat;', 'offset counts the prelude lines');
  assert.deepEqual(shaderSource('#version 300 es\nvoid main() {}', {u_x: 1}), {source: '#version 300 es\nvoid main() {}', offset: 0});
  assert.deepEqual(Object.keys(shaders), ['iris', 'tunnel', 'liquid', 'grainField', 'gradientMesh', 'streaks', 'cubeField']);
});

test('real renders: every Shader preset compiles in headless Chrome, two renders of 30 frames (presets, then the DOM post effects) are byte-identical, and a compile error fails the frame by name', {timeout: 240000}, () => {
  const out = mkdtempSync(join(tmpdir(), 'ff-shader-'));
  const env = {...process.env, FRAMEFORGE_PORT: '4411'};
  const render = (id: string, target: string, ...args: string[]) => spawnSync(process.execPath, ['scripts/render.mjs', 'tests/fixtures/shader/entry.tsx', id, target, ...args], {encoding: 'utf8', env});
  try {
    for (const id of ['ShaderPresets', 'PostEffects']) {
      const digests = ['a', 'b'].map(name => {
        const folder = join(out, `${id}-${name}`);
        const result = render(id, folder + '/', '--frame-range', '0-29');
        assert.equal(result.status, 0, result.stderr);
        assert.ok(!result.stdout.includes('{"audit"'), `${id} audits clean: ${result.stdout}`);
        const files = readdirSync(folder).filter(file => file.endsWith('.png')).sort();
        assert.equal(files.length, 30);
        return files.map(file => createHash('sha256').update(readFileSync(join(folder, file))).digest('hex'));
      });
      assert.deepEqual(digests[0], digests[1], `${id}: same frame, same pixels`);
      assert.equal(new Set(digests[0]).size, 30, `${id}: every frame differs, time moves every effect`);
    }
    const broken = render('ShaderBroken', join(out, 'broken.png'), '--frames', '0');
    assert.notEqual(broken.status, 0);
    assert.match(broken.stderr + broken.stdout, /<Shader> fragment shader failed to compile: ERROR: 0:1: 'undefinedThing'/);
  } finally { rmSync(out, {recursive: true, force: true}); }
});

test('post effects wrap their children once and are pure functions of their props and frame', () => {
  const markup = (node: React.ReactElement) => renderToStaticMarkup(node);
  assert.equal(glowFilter(10, 0, '#fff'), 'none');
  assert.equal(glowFilter(10, 1, '#ff0000').match(/drop-shadow/g)?.length, 3);
  assert.match(glowFilter(10, 0.5, '#ff0000'), /^drop-shadow\(0 0 10px color-mix\(in srgb, #ff0000 50%, transparent\)\) drop-shadow\(0 0 25px/);
  assert.deepEqual(chromaticOffsets(4, 90), {red: [0, 4], blue: [0, -4]});
  assert.match(extrudeShadow(3, '#111', 0), /^1px 0px 0 #111, 2px 0px 0 #111, 3px 0px 0 #111, 4\.8px 0px 2\.4px/);
  assert.equal(extrudeShadow(0, '#111'), 'none');
  const word = <span>WORD</span>;
  for (const node of [<Glow>{word}</Glow>, <ChromaticShift>{word}</ChromaticShift>, <Scanlines frame={3}>{word}</Scanlines>, <VhsGlitch seed="s" frame={3}>{word}</VhsGlitch>, <Extrude>{word}</Extrude>])
    assert.equal(markup(node).match(/WORD/g)?.length, 1, 'the text appears once, so the audit reads it once');
  assert.equal(markup(<VhsGlitch seed="s" frame={7}>{word}</VhsGlitch>), markup(<VhsGlitch seed="s" frame={7}>{word}</VhsGlitch>));
  const runs = Array.from({length: 60}, (_, frame) => vhsGlitch('s', frame, 1));
  assert.ok(runs.some(r => r.burst) && runs.some(r => !r.burst), 'bursts come and go');
  assert.ok(runs.every(r => r.strength > 0), 'a residual wobble stays between bursts');
  assert.deepEqual(vhsGlitch('s', 4, 1).burst, vhsGlitch('s', 5, 1).burst, 'a burst lasts its three-frame run');
  assert.match(markup(<Scanlines frame={2} density={4} roll={1}>{word}</Scanlines>), /background-position-y:2px/);
});
