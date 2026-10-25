import React from 'react';
import assert from 'node:assert/strict';
import test from 'node:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {spawnSync} from 'node:child_process';
import {existsSync, readdirSync, readFileSync, rmSync} from 'node:fs';
import {join} from 'node:path';
import {inflateSync} from 'node:zlib';
import {FrameProvider, ImageSequence, StudioLights, Turntable, sequenceFile, sequenceIndex} from '../src/core/index';

const root = join(import.meta.dirname, '..');
const config = {id: 'ThreeD', width: 320, height: 180, fps: 30, durationInFrames: 300};
const render = (frame: number, children: React.ReactNode) => renderToStaticMarkup(<FrameProvider config={config} frame={frame}>{children}</FrameProvider>);
/** Runs `body` as the renderer's page would see it (`?render` in the URL). */
function whileRendering<T>(body: () => T): T {
  const global = globalThis as {location?: unknown};
  global.location = {search: '?render=1'};
  try { return body(); } finally { delete global.location; }
}
const python = (...args: string[]) => spawnSync('python3', args, {cwd: root, encoding: 'utf8'});

test('sequenceIndex converts fps, clamps or loops, offsets, and sequenceFile pads', () => {
  assert.equal(sequenceIndex(10, 30, 30, 150), 10);
  assert.equal(sequenceIndex(10, 30, 15, 150), 5);
  assert.equal(sequenceIndex(10, 30, 60, 150), 20);
  assert.equal(sequenceIndex(500, 30, 30, 150), 149);
  assert.equal(sequenceIndex(500, 30, 30, 150, true), 50);
  assert.equal(sequenceIndex(-5, 30, 30, 150), 0);
  assert.equal(sequenceIndex(3, 30, 30, 150, false, 100), 103);
  assert.equal(sequenceIndex(3, 30, 30, 10, true, 9), 2);
  assert.equal(sequenceIndex(3, 30, 30, 0), 0);
  assert.equal(sequenceFile('/assets/generated/x/3d/hero/', 7), '/assets/generated/x/3d/hero/0007.png');
  assert.equal(sequenceFile('/seq', 12, 2), '/seq/12.png');
});

test('ImageSequence markup is a function of the frame and needs frames when rendering', () => {
  const at = (frame: number) => whileRendering(() => render(frame, <ImageSequence src="/assets/generated/x/3d/hero" frames={150} fps={15} fit="cover" />));
  assert.match(at(0), /<img[^>]*src="\/assets\/generated\/x\/3d\/hero\/0000\.png"/);
  assert.match(at(31), /src="\/assets\/generated\/x\/3d\/hero\/0015\.png"/);
  assert.match(at(31), /object-fit:cover/);
  assert.match(at(2000), /0149\.png/);
  assert.equal(at(31), at(31));
  assert.throws(() => whileRendering(() => render(0, <ImageSequence src="/assets/generated/x/3d/hero" />)), /needs frames=\{n\} when rendering/);
  // In the studio the manifest fills frames in; before it arrives nothing is drawn and nothing throws.
  assert.equal(render(0, <ImageSequence src="/assets/generated/x/3d/hero" />), '');
});

test('Turntable turns with the frame and StudioLights is a fixed rig', () => {
  const turn = (frame: number) => render(frame, <Turntable speed={0.5}><span /></Turntable>);
  assert.match(turn(0), /<group rotation="0,0,0"><span><\/span><\/group>/);
  assert.match(turn(15), /rotation="0,1\.570796\d+,0"/);
  assert.equal(turn(15), turn(15));
  // Inspected as elements: react-dom/server would warn about fiber's camelCase tags.
  const fragment = StudioLights({intensity: 2}) as React.ReactElement<{children: React.ReactNode}>;
  const rig = React.Children.toArray(fragment.props.children) as React.ReactElement<{intensity: number; position?: number[]}>[];
  assert.deepEqual(rig.map(light => light.type), ['ambientLight', 'directionalLight', 'directionalLight', 'directionalLight']);
  assert.equal(rig[0].props.intensity, 0.7);
  assert.deepEqual(rig[1].props.position, [-3.5, 4.5, 5]);
});

test('blender.py and models.py pass their self-checks', () => {
  for (const script of ['blender', 'models']) {
    const run = python(`scripts/assets/${script}.py`, '--self-check');
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, new RegExp(`${script} self-check ok`));
  }
});

/** First pixel of an 8-bit RGB/RGBA PNG: the first byte after the first row's filter byte is never filtered against anything. */
function firstPixel(path: string): number[] {
  const png = readFileSync(path);
  let offset = 8, idat = Buffer.alloc(0), channels = 0;
  while (offset < png.length) {
    const length = png.readUInt32BE(offset), type = png.toString('ascii', offset + 4, offset + 8), body = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') channels = body[9] === 6 ? 4 : 3;
    if (type === 'IDAT') idat = Buffer.concat([idat, body]);
    offset += 12 + length;
  }
  return [...inflateSync(idat).subarray(1, 1 + channels)];
}

test('blender.py renders the fixture deterministically with the colours as written', t => {
  const folder = join(root, 'public/assets/generated/three-d-fixture/3d');
  rmSync(folder, {recursive: true, force: true});
  const first = python('scripts/assets/blender.py', 'tests/fixtures/three-d/3d.json');
  if (first.status !== 0 && /Blender not found/.test(first.stderr)) return t.skip('Blender is not installed; set BLENDER_PATH or install it to run this test');
  try {
    assert.equal(first.status, 0, first.stderr);
    const hero = join(folder, 'hero');
    assert.deepEqual(readdirSync(hero).sort(), ['0000.png', '0001.png', 'manifest.json']);
    assert.deepEqual(readdirSync(join(folder, 'scripted')).sort(), ['0000.png', 'manifest.json']);
    assert.deepEqual(readdirSync(join(folder, 'builtin')).sort(), ['0000.png', '0001.png', '0002.png', 'manifest.json']);
    // Bloom adds light only round bright pixels; in this 96x54 thumbnail its halo reaches the corner by at most one level.
    firstPixel(join(folder, 'builtin', '0000.png')).forEach((value, i) => assert.ok(Math.abs(value - [0x0b, 0x0d, 0x14][i]) <= 1, `bloom keeps the background hex: ${value}`));
    const manifest = JSON.parse(readFileSync(join(hero, 'manifest.json'), 'utf8'));
    assert.equal(manifest.frames, 2);
    assert.equal(manifest.fps, 30);
    assert.equal(manifest.width, 320);
    assert.equal(manifest.height, 180);
    assert.match(manifest.specHash, /^[0-9a-f]{16}$/);
    assert.match(manifest.blender, /^\d+\.\d+/);
    assert.ok(manifest.seconds > 0);
    assert.deepEqual(firstPixel(join(hero, '0000.png')), [0x2f, 0x5b, 0xff], 'the background hex must come out as written (Standard view transform)');
    assert.equal(firstPixel(join(folder, 'scripted', '0000.png')).length, 4, 'a transparent background renders RGBA');
    const names = ['hero/0000.png', 'hero/0001.png', 'scripted/0000.png', 'builtin/0000.png', 'builtin/0001.png', 'builtin/0002.png'];
    const before = names.map(name => readFileSync(join(folder, name)));
    assert.notDeepEqual(before[3], before[5], 'the builtin shot sweeps from scan lines to gloss while the camera moves');
    assert.notDeepEqual(before[0], before[1], 'the turntable moves between frames');
    const skip = python('scripts/assets/blender.py', 'tests/fixtures/three-d/3d.json');
    assert.equal(skip.status, 0, skip.stderr);
    assert.match(skip.stdout, /"skipped": true/);
    const again = python('scripts/assets/blender.py', 'tests/fixtures/three-d/3d.json', '--force');
    assert.equal(again.status, 0, again.stderr);
    assert.doesNotMatch(again.stdout, /skipped/);
    names.forEach((name, index) => assert.ok(readFileSync(join(folder, name)).equals(before[index]), `${name} must be byte-identical on a second render`));
    const partial = python('scripts/assets/blender.py', 'tests/fixtures/three-d/3d.json', '--shot', 'hero', '--frames', '1', '--force');
    assert.equal(partial.status, 0, partial.stderr);
    assert.ok(readFileSync(join(hero, '0001.png')).equals(before[1]), 'a frame rendered alone equals the same frame of the full run');
    const sweep = python('scripts/assets/blender.py', 'tests/fixtures/three-d/3d.json', '--shot', 'builtin', '--frames', '1', '--force');
    assert.equal(sweep.status, 0, sweep.stderr);
    assert.ok(readFileSync(join(folder, 'builtin', '0001.png')).equals(before[4]), 'the sweep level and camera are pure functions of the frame');
    assert.equal(existsSync(join(hero, '0000.png')), true);
  } finally {
    rmSync(join(root, 'public/assets/generated/three-d-fixture'), {recursive: true, force: true});
  }
});
