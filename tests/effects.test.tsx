import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {applyCorrection, applyGrain, applyLut, applyVignette, colorCorrectionEffect, correctPixel, grainEffect, lightLeakBlobs, lightLeakEffect, lutEffect, NEUTRAL_CORRECTION, parseCubeLut, sampleLut, srgbToLinear, vignetteAlpha, vignetteEffect, type Pixels} from '../src/core/index';

const pixels = (width: number, height: number, fill: [number, number, number, number]): Pixels => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) data.set(fill, i);
  return {data, width, height};
};
const px = (p: Pixels, x: number, y: number) => [...p.data.slice((y * p.width + x) * 4, (y * p.width + x) * 4 + 4)];

test('neutral colorCorrection is identity on every gray and on sample colours', () => {
  for (let v = 0; v < 256; v++) { const [r, g, b] = correctPixel(v, v, v, NEUTRAL_CORRECTION); assert.ok(Math.abs(r - v) < 0.5 && Math.abs(g - v) < 0.5 && Math.abs(b - v) < 0.5, `gray ${v} -> ${r}`); }
  const colours = [[200, 40, 40, 255], [12, 180, 90, 255], [250, 250, 10, 128], [0, 0, 0, 0]] as [number, number, number, number][];
  for (const colour of colours) assert.deepEqual(px(applyCorrection(pixels(1, 1, colour), {}), 0, 0), colour);
  assert.equal(colorCorrectionEffect({}).effectKey, `${JSON.stringify(NEUTRAL_CORRECTION)}-disabled-false`);
  assert.throws(() => colorCorrectionEffect({exposure: 9}), /exposure must be/);
});

test('exposure +1 doubles linear light; saturation 0 grays; vibrance lifts muted colours more', () => {
  for (const v of [20, 60, 100, 140]) {
    const [r] = correctPixel(v, v, v, {...NEUTRAL_CORRECTION, exposure: 1});
    assert.ok(Math.abs(srgbToLinear(r) / srgbToLinear(v) - 2) < 0.02, `exposure ${v}: ${srgbToLinear(r) / srgbToLinear(v)}`);
  }
  const [r, g, b] = correctPixel(200, 40, 40, {...NEUTRAL_CORRECTION, saturation: 0});
  assert.ok(Math.abs(r - g) < 0.5 && Math.abs(g - b) < 0.5);
  const chroma = (c: number[]) => Math.max(...c) - Math.min(...c);
  const muted = correctPixel(130, 120, 110, {...NEUTRAL_CORRECTION, vibrance: 1}), vivid = correctPixel(240, 30, 30, {...NEUTRAL_CORRECTION, vibrance: 1});
  assert.ok(chroma(muted) / chroma([130, 120, 110]) > chroma(vivid) / chroma([240, 30, 30]));
  assert.ok(correctPixel(128, 128, 128, {...NEUTRAL_CORRECTION, contrast: 1.5})[0] < 129 && correctPixel(200, 200, 200, {...NEUTRAL_CORRECTION, contrast: 1.5})[0] > 200);
});

test('parseCubeLut reads the 2-point fixture and lutEffect with it is identity', () => {
  const lut = parseCubeLut(readFileSync(new URL('./fixtures/effects/identity-2.cube', import.meta.url), 'utf8'));
  assert.equal(lut.title, 'identity-2'); assert.equal(lut.size, 2); assert.equal(lut.data.length, 24);
  assert.deepEqual(sampleLut(lut, 0.25, 0.5, 1), [0.25, 0.5, 1]);
  const before = [[200, 40, 40, 255], [12, 180, 90, 255], [255, 255, 255, 255], [0, 0, 0, 255]] as [number, number, number, number][];
  for (const colour of before) assert.deepEqual(px(applyLut(pixels(1, 1, colour), {lut}), 0, 0), colour);
  const inverted = parseCubeLut('LUT_3D_SIZE 2\n1 1 1\n0 1 1\n1 0 1\n0 0 1\n1 1 0\n0 1 0\n1 0 0\n0 0 0\n');
  assert.deepEqual(px(applyLut(pixels(1, 1, [255, 0, 0, 255]), {lut: inverted}), 0, 0), [0, 255, 255, 255]);
  assert.deepEqual(px(applyLut(pixels(1, 1, [255, 0, 0, 255]), {lut: inverted, intensity: 0}), 0, 0), [255, 0, 0, 255]);
  assert.notEqual(lutEffect({lut}).effectKey, lutEffect({lut: inverted}).effectKey);
  assert.throws(() => parseCubeLut('LUT_3D_SIZE 2\n0 0 0\n'), /expected 8 rows/);
  assert.throws(() => parseCubeLut('0 0 0\n'), /LUT_3D_SIZE/);
  assert.throws(() => lutEffect({lut, intensity: 2}), /intensity/);
});

test('lightLeak is empty at progress 0 and 1, peaks in the middle, and depends on the seed', () => {
  assert.deepEqual(lightLeakBlobs({seed: 'a', progress: 0}), []);
  assert.deepEqual(lightLeakBlobs({seed: 'a', progress: 1}), []);
  const mid = lightLeakBlobs({seed: 'a', progress: 0.5});
  assert.ok(mid.length >= 2 && mid.length <= 4);
  assert.ok(mid.every(blob => blob.alpha > 0 && blob.hue >= 8 && blob.hue <= 48));
  assert.ok(Math.max(...lightLeakBlobs({seed: 'a', progress: 0.1}).map(b => b.alpha)) < Math.max(...mid.map(b => b.alpha)));
  assert.deepEqual(lightLeakBlobs({seed: 'a', progress: 0.5}), mid);
  assert.notDeepEqual(lightLeakBlobs({seed: 'b', progress: 0.5}), mid);
  assert.equal(lightLeakBlobs({seed: 'a', progress: 0.5, hueShift: 100})[0]!.hue, mid[0]!.hue + 100);
  assert.throws(() => lightLeakEffect({seed: 'a', progress: 2}), /progress/);
});

test('vignette darkens corners more than the centre and writes alpha on transparent pixels', () => {
  assert.equal(vignetteAlpha(0, 0, {}), 0);
  assert.ok(vignetteAlpha(1, 1, {amount: 0.8}) > vignetteAlpha(0.5, 0.5, {amount: 0.8}));
  assert.ok(Math.abs(vignetteAlpha(1, 1, {amount: 0.8, softness: 0.5}) - 0.8) < 1e-6);
  const white = applyVignette(pixels(16, 8, [255, 255, 255, 255]), {amount: 0.8});
  assert.ok(px(white, 0, 0)[0]! < px(white, 8, 4)[0]!); assert.equal(px(white, 8, 4)[3], 255);
  const clear = applyVignette(pixels(16, 8, [0, 0, 0, 0]), {amount: 0.8});
  assert.ok(px(clear, 0, 0)[3]! > 100); assert.equal(px(clear, 8, 4)[3], 0);
  assert.throws(() => vignetteEffect({amount: 2}), /amount/);
});

test('grain is deterministic per (seed, frame), differs across frames and seeds, and sizes its cells', () => {
  const a = applyGrain(pixels(32, 32, [128, 128, 128, 255]), {seed: 's', frame: 3, amount: 0.5});
  const b = applyGrain(pixels(32, 32, [128, 128, 128, 255]), {seed: 's', frame: 3, amount: 0.5});
  assert.deepEqual([...a.data], [...b.data]);
  assert.notDeepEqual([...a.data], [...applyGrain(pixels(32, 32, [128, 128, 128, 255]), {seed: 's', frame: 4, amount: 0.5}).data]);
  assert.notDeepEqual([...a.data], [...applyGrain(pixels(32, 32, [128, 128, 128, 255]), {seed: 't', frame: 3, amount: 0.5}).data]);
  const coarse = applyGrain(pixels(8, 8, [128, 128, 128, 255]), {seed: 's', frame: 0, amount: 0.5, size: 4});
  assert.deepEqual(px(coarse, 0, 0), px(coarse, 3, 3)); assert.notDeepEqual(px(coarse, 0, 0), px(coarse, 4, 0));
  assert.ok([...applyGrain(pixels(8, 8, [0, 0, 0, 0]), {seed: 's', frame: 0, amount: 0.5}).data].some((v, i) => i % 4 === 3 && v > 0));
  assert.equal(grainEffect({seed: 's', frame: 3}).effectKey, 's:3:0.2:1-disabled-false');
  assert.throws(() => grainEffect({seed: 's', frame: 3, size: 0}), /size/);
});
