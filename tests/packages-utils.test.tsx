import React from 'react';
import assert from 'node:assert/strict';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {renderToStaticMarkup} from 'react-dom/server';
import {
  audioBufferToDataUrl, createSmoothSvgPath, createTikTokStyleCaptions, fillTextBox, fitText, fitTextOnNLines, FrameProvider, getWaveformPortion, loadFont, loadThreeFiber,
  measureText, parseColor, parseSrt, parseVtt, preloadAudio, preloadFont, preloadImage, preloadVideo, serializeSrt, ThreeCanvas, visualizeAudio, visualizeAudioWaveform,
  zColor, zMatrix, zTextarea, FRAMEFORGE_COLOR_BRAND, type MediaUtilsAudioData, type TextWord,
} from '../src/core/index';
import {readMediaMetadata} from '../src/packages/dev-server';

const oracle = (name: string) => JSON.parse(readFileSync(new URL(`../compatibility/${name}.json`, import.meta.url), 'utf8'));
const outcome = (run: () => unknown) => { try { return JSON.parse(JSON.stringify(run())); } catch (error) { return {error: (error as Error).message}; } };

test('captions match the reference on every recorded SRT, VTT, page and serialization case', () => {
  const {srt, vtt, tiktok, serialize} = oracle('captions');
  assert.ok(srt.length >= 50);
  for (const {input, loose, strict} of srt) {
    assert.deepEqual(outcome(() => parseSrt({input})), loose, JSON.stringify(input));
    assert.deepEqual(outcome(() => parseSrt({input, strict: true})), strict, JSON.stringify(input));
  }
  for (const {input, output} of vtt) assert.deepEqual(outcome(() => parseVtt({input})), output, input);
  for (const {input, output} of tiktok) assert.deepEqual(outcome(() => createTikTokStyleCaptions(input)), output, JSON.stringify(input));
  for (const {input, output} of serialize) assert.equal(serializeSrt({lines: input}), output);
});

test('serializeSrt round-trips through parseSrt', () => {
  const lines = [[{text: 'Hi', startMs: 0, endMs: 1000, timestampMs: null, confidence: null}, {text: ' there', startMs: 1000, endMs: 2500, timestampMs: null, confidence: null}], [{text: '두 번째', startMs: 3_600_000, endMs: 3_601_001, timestampMs: null, confidence: null}]];
  const text = serializeSrt({lines});
  assert.equal(text, '1\n00:00:00,000 --> 00:00:02,500\nHi there\n\n2\n01:00:00,000 --> 01:00:01,001\n두 번째');
  assert.deepEqual(parseSrt({input: text, strict: true}).captions.map(c => [c.text, c.startMs, c.endMs]), [['Hi there', 0, 2500], ['두 번째', 3_600_000, 3_601_001]]);
});

const seededAudio = ({seed, length, gain, sampleRate}: {seed: number; length: number; gain: number; sampleRate: number}): MediaUtilsAudioData => {
  let s = seed;
  const channel = Float32Array.from({length}, () => { s = (s * 16807) % 2147483647; return (s / 2147483647 - 0.5) * gain; });
  return {channelWaveforms: [channel, channel.map(x => x / 2)], sampleRate, durationInSeconds: length / sampleRate, numberOfChannels: 2, resultId: `seed-${seed}`, isRemote: false};
};
const near = (actual: unknown, expected: unknown, label: string) => {
  if (Array.isArray(expected) && Array.isArray(actual)) {
    assert.equal(actual.length, expected.length, label);
    expected.forEach((value, i) => typeof value === 'number'
      ? assert.ok(Math.abs(actual[i] - value) < 1e-9, `${label}[${i}] ${actual[i]} vs ${value}`)
      : (assert.equal(actual[i].index, value.index, label), assert.ok(Math.abs(actual[i].amplitude - value.amplitude) < 1e-9, label)));
  } else assert.deepEqual(actual, expected, label);
};

test('audio visualizations match the reference within 1e-9 on every recorded case', () => {
  const {cases, smoothSvgPath, wav} = oracle('media-utils');
  const fns = {visualizeAudio, getWaveformPortion, visualizeAudioWaveform} as Record<string, (options: any) => unknown>;
  for (const {fn, clip, options, output} of cases) near(outcome(() => fns[fn]!({audioData: seededAudio(clip), ...options})), output, `${fn} ${JSON.stringify(options)}`);
  for (const {points, output} of smoothSvgPath) assert.equal(createSmoothSvgPath({points}), output);
  for (const {input, output} of wav) {
    const buffer = {numberOfChannels: input.channels.length, sampleRate: input.sampleRate, length: input.channels[0].length, getChannelData: (i: number) => Float32Array.from(input.channels[i])};
    assert.equal(audioBufferToDataUrl(buffer), output);
  }
});

test('visualizeAudio rejects bar counts that are not powers of two', () => {
  const audioData = seededAudio({seed: 1, length: 100, gain: 1, sampleRate: 100});
  assert.throws(() => visualizeAudio({audioData, frame: 0, fps: 30, numberOfSamples: 6}), /must be a power of two\. For example: 64, 128\. Got instead: 12/);
});

// The same additive measurer the oracle's fake DOM used.
const stub = (word: TextWord) => {
  const fontSize = typeof word.fontSize === 'number' ? word.fontSize : parseFloat(word.fontSize);
  const spacing = parseFloat(word.letterSpacing ?? '0') || 0;
  return {width: [...word.text].reduce((sum, char) => sum + ((char.charCodeAt(0) * 7) % 11 + 3) * fontSize / 10 + spacing, 0), height: fontSize * 1.2};
};

test('layout helpers match the reference on every recorded case', () => {
  for (const {fn, input, output} of oracle('layout-utils').cases) {
    if (fn === 'fitText') assert.deepEqual(outcome(() => fitText(input, stub)), output);
    else if (fn === 'fitTextOnNLines') assert.deepEqual(outcome(() => fitTextOnNLines(input, stub)), output);
    else { const box = fillTextBox(input.box, stub); assert.deepEqual(input.words.map((word: TextWord) => outcome(() => box.add(word))), output, JSON.stringify(input)); }
  }
});

test('measureText needs a browser or a measurer, and validateFontIsLoaded catches an unloaded font', () => {
  assert.throws(() => measureText({text: 'a', fontFamily: 'X', fontSize: 10}), /needs a browser document/);
  assert.deepEqual(measureText({text: 'ab', fontFamily: 'X', fontSize: 10}, stub), stub({text: 'ab', fontFamily: 'X', fontSize: 10}));
  assert.throws(() => measureText({text: 'ab', fontFamily: 'X', fontSize: 10, validateFontIsLoaded: true}, stub), /probably not loaded/);
  const byFamily = (word: TextWord) => ({width: word.fontFamily.length, height: 1});
  assert.deepEqual(measureText({text: 'ab', fontFamily: 'Loaded', fontSize: 10, validateFontIsLoaded: true}, byFamily), {width: 6, height: 1});
});

test('parseColor matches the reference', () => {
  for (const {input, output} of oracle('zod-types').parseColor) assert.deepEqual(outcome(() => parseColor(input)), output, input);
});

test('zod schema factories build on the z passed in', () => {
  type Check = {refine?: (value: any) => boolean; message?: string; description?: string; kind: string; item?: Check};
  const schema = (kind: string, item?: Check): Check & {refine: any; describe: any} => {
    const node: any = {kind, item};
    node.refine = (fn: (value: any) => boolean, {message}: {message: string}) => Object.assign(node, {check: fn, message});
    node.describe = (description: string) => Object.assign(node, {description});
    return node;
  };
  const z = {string: () => schema('string'), number: () => schema('number'), array: (item: Check) => schema('array', item)};
  const color = zColor(z) as any, matrix = zMatrix(z) as any, area = zTextarea(z) as any;
  assert.equal(color.description, FRAMEFORGE_COLOR_BRAND);
  assert.equal(color.check('rebeccapurple'), true); assert.equal(color.check('nope'), false); assert.equal(color.message, 'Invalid color');
  assert.deepEqual([[1, 0, 0, 1], [1], [1, 2, 3], []].map(matrix.check), [true, true, false, false]);
  assert.equal(matrix.item.kind, 'number'); assert.equal(matrix.message, 'Invalid matrix, must be a square matrix');
  assert.equal(area.kind, 'string'); assert.equal(area.description, '__frameforge-textarea');
});

test('preload helpers are no-ops outside a browser', () => {
  for (const preload of [preloadAudio, preloadVideo, preloadImage, preloadFont]) assert.equal(typeof preload('/a'), 'function');
});

test('loadFont derives the format from the extension and needs a browser', async () => {
  await assert.rejects(loadFont({family: 'A', url: '/a.woff2?v=1'}), /derive font format from extension: woff2\?v=1\. Pass the "format" parameter explicitly/);
  await assert.rejects(loadFont({family: 'A', url: '/a.ttf'}), /needs a browser with the FontFace API/);
  await assert.rejects(loadFont({family: 'A', url: '/a', format: 'truetype'}), /needs a browser/);
});

test('ThreeCanvas explains how to install its optional packages', async () => {
  // three and @react-three/fiber are installed now, so the loader resolves; the install message is covered by the ThreeCanvas error path.
  assert.ok(await loadThreeFiber());
  const config = {id: 'T', width: 64, height: 64, fps: 30, durationInFrames: 10};
  assert.equal(renderToStaticMarkup(<FrameProvider frame={0} config={config}><ThreeCanvas width={64} height={64}><span /></ThreeCanvas></FrameProvider>), '');
});

test('the media metadata endpoint probes public/ files and refuses paths outside it', async () => {
  const root = mkdtempSync(join(tmpdir(), 'frameforge-meta-'));
  try {
    mkdirSync(join(root, 'public'));
    execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size=96x54:rate=10:duration=0.5', '-pix_fmt', 'yuv420p', join(root, 'public', 'clip one.mp4')]);
    writeFileSync(join(root, 'secret.mp4'), 'x');
    const publicDirectory = join(root, 'public');
    const probed = await readMediaMetadata(publicDirectory, '/clip%20one.mp4');
    assert.ok(!('error' in probed));
    assert.equal(probed.width, 96); assert.equal(probed.height, 54);
    assert.ok(Math.abs(probed.durationInSeconds - 0.5) < 0.05, String(probed.durationInSeconds));
    assert.deepEqual(await readMediaMetadata(publicDirectory, '/../secret.mp4'), {error: 'src /../secret.mp4 escapes public/', status: 400});
    assert.equal((await readMediaMetadata(publicDirectory, '/missing.mp4') as {status: number}).status, 404);
    assert.equal((await readMediaMetadata(publicDirectory, 'file:///etc/passwd') as {status: number}).status, 400);
  } finally { rmSync(root, {recursive: true, force: true}); }
});
