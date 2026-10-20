import React from 'react';
import assert from 'node:assert/strict';
import test from 'node:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {AnimatedImage, animatedFrameIndex, applyColorMatrix, Artifact, collectArtifacts, collectAudio, collectVideos, createEffect, cropClipPath, fitRect, Freeze, FrameProvider, getHtmlInCanvasUnsupportedMessage, Html5Video, HTML_IN_CANVAS_UNSUPPORTED_MESSAGE, HtmlInCanvas, Interactive, isHtmlInCanvasSupported, OffthreadVideo, runEffectChain, Sequence, Solid, Track, useCurrentFrame, useVideoConfig, Video, videoFrameUrl, videoSeekTime, videoSourceFrame, type EffectDefinition} from '../src/core/index';
import {writeArtifacts} from '../scripts/artifacts.mjs';
import {extractVideoFrames, videoFrameTime} from '../scripts/video-frames.mjs';

const config = {id: 'Media', width: 320, height: 180, fps: 30, durationInFrames: 100};
const render = (frame: number, children: React.ReactNode) => renderToStaticMarkup(<FrameProvider config={config} frame={frame}>{children}</FrameProvider>);
const Probe = () => <span>{useCurrentFrame()}:{useVideoConfig().width}</span>;
/** Runs `body` as the renderer's page would see it (`?render` in the URL). */
function whileRendering<T>(body: () => T): T {
  const global = globalThis as {location?: unknown};
  global.location = {search: '?render=1'};
  try { return body(); } finally { delete global.location; }
}

test('animatedFrameIndex picks the frame covering the time for each loop behavior', () => {
  const durations = [100_000, 50_000, 150_000]; // µs; total 300 ms
  assert.equal(animatedFrameIndex(0, durations), 0);
  assert.equal(animatedFrameIndex(99_999, durations), 0);
  assert.equal(animatedFrameIndex(100_000, durations), 1);
  assert.equal(animatedFrameIndex(160_000, durations), 2);
  assert.equal(animatedFrameIndex(300_000, durations), 0);
  assert.equal(animatedFrameIndex(410_000, durations), 1);
  assert.equal(animatedFrameIndex(410_000, durations, 'pause-after-finish'), 2);
  assert.equal(animatedFrameIndex(299_999, durations, 'clear-after-finish'), 2);
  assert.equal(animatedFrameIndex(300_000, durations, 'clear-after-finish'), null);
  assert.equal(animatedFrameIndex(5, [0, 0]), 0);
  assert.throws(() => animatedFrameIndex(0, durations, 'bounce' as never), /loopBehavior/);
  // The rendered GIF check: a 10 fps GIF in a 30 fps composition shows GIF frame 1 at composition frame 3.
  assert.equal(animatedFrameIndex(3 / 30 * 1e6, Array(10).fill(100_000)), 1);
});

test('AnimatedImage and Solid render canvases sized from props or the composition', () => {
  assert.match(render(0, <AnimatedImage src="/a.gif" />), /<canvas width="320" height="180"/);
  assert.match(render(0, <AnimatedImage src="/a.gif" width={40} height={20} data-x="1" />), /data-x="1" width="40" height="20"/);
  assert.throws(() => render(0, <AnimatedImage src="/a.gif" loopBehavior={'x' as never} />), /loopBehavior/);
  assert.throws(() => render(0, <AnimatedImage src="/a.gif" playbackRate={0} />), /positive/);
  assert.match(render(0, <Solid width={10} height={5} pixelDensity={2} cropLeft={0.5} />), /<canvas width="20" height="10" style="width:10px;height:5px;clip-path:inset\(0% 0% 0% 50%\)"/);
  assert.throws(() => render(0, <Solid width={0} height={5} />), /positive/);
  assert.throws(() => cropClipPath({cropTop: 2}), /between 0 and 1/);
});

test('fitRect places fill, contain and cover', () => {
  assert.deepEqual(fitRect('fill', 100, 50, 200, 200), {x: 0, y: 0, width: 200, height: 200});
  assert.deepEqual(fitRect('contain', 100, 50, 200, 200), {x: 0, y: 50, width: 200, height: 100});
  assert.deepEqual(fitRect('cover', 100, 50, 200, 200), {x: -100, y: 0, width: 400, height: 200});
  assert.throws(() => fitRect('stretch' as never, 1, 1, 1, 1), /fit/);
});

test('applyColorMatrix applies a 4x5 matrix with clamping', () => {
  const gray = [0.3, 0.59, 0.11, 0, 0, 0.3, 0.59, 0.11, 0, 0, 0.3, 0.59, 0.11, 0, 0, 0, 0, 0, 1, 0];
  assert.deepEqual([...applyColorMatrix(new Uint8ClampedArray([200, 40, 40, 255]), gray)], [88, 88, 88, 255]);
  const identity = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
  assert.deepEqual([...applyColorMatrix(new Uint8ClampedArray([1, 2, 3, 4, 5, 6, 7, 8]), identity)], [1, 2, 3, 4, 5, 6, 7, 8]);
  const brighten = identity.map((value, index) => index === 4 ? 0.5 : value);
  assert.deepEqual([...applyColorMatrix(new Uint8ClampedArray([200, 0, 0, 255]), brighten)], [255, 0, 0, 255]);
  assert.throws(() => applyColorMatrix(new Uint8ClampedArray(4), [1, 2]), /20 finite/);
});

test('createEffect builds descriptors and runEffectChain applies enabled 2D effects in order', () => {
  const log: string[] = [];
  const definition = (type: string, backend: '2d' | 'webgl2' = '2d'): EffectDefinition<{amount: number}, string> => ({
    type, label: type, documentationLink: null, backend, calculateKey: ({amount}) => String(amount),
    setup: () => `${type}-state`, cleanup: state => log.push(`cleanup ${state}`),
    validateParams: params => { if (!(params?.amount >= 0)) throw new Error(`${type} amount`); },
    apply: ({source, target, state, params, width}) => log.push(`${type} ${(source as unknown as {name: string}).name}->${(target as unknown as {name: string}).name} ${state} ${params.amount} ${width}`),
  });
  const first = createEffect(definition('first')), second = createEffect(definition('second'));
  const descriptor = first({amount: 2});
  assert.equal(descriptor.effectKey, '2-disabled-false'); assert.equal(descriptor.memoized, false); assert.deepEqual(descriptor.params, {amount: 2});
  assert.throws(() => first({amount: -1}), /first amount/);
  assert.throws(() => createEffect({...definition('x'), apply: undefined as never}), /apply must be a function/);
  let made = 0;
  const canvas = () => ({name: `c${++made}`}) as unknown as HTMLCanvasElement;
  const source = {name: 'source'} as unknown as HTMLCanvasElement;
  const output = runEffectChain(source, [first({amount: 1}), second({amount: 3, disabled: true}), second({amount: 4})], 8, 4, canvas);
  assert.equal((output as unknown as {name: string}).name, 'c2');
  assert.deepEqual(log, ['first source->c1 first-state 1 8', 'cleanup first-state', 'second c1->c2 second-state 4 8', 'cleanup second-state']);
  assert.equal(runEffectChain(source, [], 8, 4, canvas), source);
  assert.throws(() => runEffectChain(source, [createEffect(definition('gl', 'webgl2'))({amount: 1})], 8, 4, canvas), /2D canvas effects only/);
});

test('Video in the studio is a muted <video> plus an Audio clip, with validated props', () => {
  collectAudio();
  assert.equal(render(4, <Video src="/clip.mp4" trimBefore={10} volume={0.5} className="v" />), '<video src="/clip.mp4" muted="" playsInline="" preload="auto" class="v"></video>');
  assert.deepEqual(collectAudio(), [{key: '/clip.mp4:0:10', src: '/clip.mp4', volume: 0.5, trimBefore: 10, startFrame: 0}]);
  render(0, <Video src="/clip.mp4" muted />); render(0, <Freeze frame={2}><Video src="/clip.mp4" /></Freeze>);
  assert.deepEqual(collectAudio(), []);
  assert.equal(render(5, <Video src="/clip.mp4" trimBefore={2} trimAfter={7} />), '');
  for (const [props, message] of [[{playbackRate: 5}, /playbackRate/], [{src: 'clip.mp4'}, /starting with "\/"/], [{volume: 2}, /between 0 and 1/], [{trimBefore: 5, trimAfter: 5}, /greater than trimBefore/], [{loop: true}, /loop is unsupported/]] as const) {
    assert.throws(() => render(0, <Video src="/clip.mp4" {...(props as object)} />), message);
  }
  assert.throws(() => render(0, <Sequence playbackRate={2}><Video src="/clip.mp4" /></Sequence>), /Sequence playbackRate/);
  assert.equal(OffthreadVideo, Video); assert.equal(Html5Video, Video);
  assert.equal(collectVideos().length, 0, 'the studio never fills the render registry');
});

test('Video while rendering registers its clip and waits for the extracted frame', () => {
  collectVideos(); collectAudio();
  const markup = whileRendering(() => render(25, <Sequence from={10} layout="none"><Video src="/clip.mp4" trimBefore={20} muted /></Sequence>));
  assert.equal(markup, '', 'the <Img> appears only after the frame server answered');
  assert.deepEqual(collectVideos(), [{key: '/clip.mp4:10:20', src: '/clip.mp4', startFrame: 10, trimBefore: 20, playbackRate: 1, volume: 1, muted: true}]);
  assert.deepEqual(collectVideos(), []);
  assert.equal(videoSourceFrame(20, 15), 35);
  assert.equal(videoFrameUrl('/a b.mp4', 35, 29.97), '/__frameforge/video-frame?src=%2Fa%20b.mp4&frame=35&fps=29.97');
  assert.equal(videoFrameTime(35, 30), 35 / 30);
  // Chrome keeps currentTime to whole microseconds, so the studio aims just inside frame 29 rather than at 0.966666.
  assert.ok(videoSeekTime(29, 30) > 29 / 30 && videoSeekTime(29, 30) < 30 / 30 && Math.floor(videoSeekTime(29, 30) * 1e6) / 1e6 > 29 / 30);
});

test('extractVideoFrames returns the picture covering each frame time, past the end included', {skip: !String(spawnSync('ffmpeg', ['-hide_banner', '-filters']).stdout ?? '').includes('drawtext')}, async () => {
  const folder = mkdtempSync(join(tmpdir(), 'frameforge-video-'));
  try {
    const file = join(folder, 'clip.mp4');
    // 24 fps source with the frame number drawn in; at 30 fps, frame k shows source frame floor(k * 24 / 30).
    assert.equal(spawnSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size=64x36:rate=24:duration=1', '-vf', "drawtext=text='%{n}':fontsize=20:fontcolor=white", '-pix_fmt', 'yuv420p', file]).status, 0);
    const raw = (path: string, select?: number) => spawnSync('ffmpeg', ['-v', 'error', '-i', path, ...(select === undefined ? [] : ['-vf', `select=eq(n\\,${select})`, '-frames:v', '1']), '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']).stdout;
    await extractVideoFrames({file, fps: 30, frames: [1, 6, 13, 40], outDir: join(folder, 'batch')});
    await extractVideoFrames({file, fps: 30, frames: [6], outDir: join(folder, 'single')});
    // With a sound track, the last two frames of a same-rate file once came out as one repeated picture when the muxer re-timed them.
    const same = join(folder, 'same.mp4');
    assert.equal(spawnSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size=64x36:rate=30:duration=2', '-f', 'lavfi', '-i', 'sine=duration=2', '-vf', "drawtext=text='%{n}':fontsize=20:fontcolor=white", '-pix_fmt', 'yuv420p', '-shortest', same]).status, 0);
    await extractVideoFrames({file: same, fps: 30, frames: [58, 59], outDir: join(folder, 'tail')});
    for (const frame of [58, 59]) assert.ok(raw(join(folder, 'tail', `${frame}.png`)).equals(raw(same, frame)), `tail frame ${frame}`);
    for (const frame of [1, 6, 13]) assert.ok(raw(join(folder, 'batch', `${frame}.png`)).equals(raw(file, Math.floor(frame * 24 / 30))), `frame ${frame}`);
    assert.ok(raw(join(folder, 'single', '6.png')).equals(raw(file, 4)));
    assert.ok(raw(join(folder, 'batch', '40.png')).equals(raw(file, 23)), 'past the end holds the last picture');
  } finally { rmSync(folder, {recursive: true, force: true}); }
});

test('Artifact validates, registers only while rendering, and writeArtifacts refuses duplicates', async () => {
  collectArtifacts();
  assert.equal(render(0, <Artifact filename="a.txt" content="hi" />), '');
  assert.deepEqual(collectArtifacts(), []);
  whileRendering(() => render(0, <><Artifact filename="dir/a.txt" content="hi" /><Artifact filename="b.bin" content={new Uint8Array([0, 1, 255])} /></>));
  const entries = collectArtifacts();
  assert.deepEqual(entries, [{filename: 'dir/a.txt', encoding: 'utf8', content: 'hi'}, {filename: 'b.bin', encoding: 'base64', content: 'AAH/'}]);
  for (const filename of ['../x', '/abs', 'a b', 'a//b', '']) assert.throws(() => render(0, <Artifact filename={filename} content="x" />), /must be a relative path/);
  assert.throws(() => render(0, <Artifact filename="t.jpeg" content={Artifact.Thumbnail} />), /Thumbnail is unsupported/);
  assert.throws(() => render(0, <Artifact filename="t.txt" content={5 as never} />), /string or Uint8Array/);
  const folder = mkdtempSync(join(tmpdir(), 'frameforge-artifacts-'));
  try {
    await writeArtifacts(entries, folder);
    assert.equal(readFileSync(join(folder, 'dir/a.txt'), 'utf8'), 'hi');
    assert.deepEqual([...readFileSync(join(folder, 'b.bin'))], [0, 1, 255]);
    await assert.rejects(() => writeArtifacts([entries[0]!], folder), /unique per render/);
    await assert.rejects(() => writeArtifacts([{filename: '../escape.txt', encoding: 'utf8', content: ''}], folder), /inside the output folder/);
    assert.ok(!existsSync(join(folder, '..', 'escape.txt')));
  } finally { rmSync(folder, {recursive: true, force: true}); }
});

test('Track and Interactive apply timing props without adding DOM', () => {
  assert.equal(render(3, <Track name="Scenes"><Probe /></Track>), '<span>3:320</span>');
  assert.equal(render(13, <Track from={10} width={100}><Probe /></Track>), '<span>3:100</span>');
  assert.equal(render(3, <Track hidden><Probe /></Track>), '');
  assert.equal(render(3, <Interactive.Div className="x" style={{opacity: 0.5}}>hi</Interactive.Div>), '<div class="x" style="opacity:0.5">hi</div>');
  assert.equal(render(3, <Interactive.H1 from={5}>hi</Interactive.H1>), '');
  assert.equal(render(6, <Interactive.Span from={5} cropRight={0.25} name="n">hi</Interactive.Span>), '<span style="clip-path:inset(0% 25% 0% 0%)">hi</span>');
  assert.equal(render(6, <Interactive.Svg><Interactive.Rect width={2} height={2} hidden /></Interactive.Svg>), '<svg></svg>');
  const Label = ({text, style}: {text: string; style?: React.CSSProperties}) => <b style={style}>{text}</b>;
  const Timed = Interactive.create({Component: Label});
  assert.equal(render(2, <Timed text="t" durationInFrames={2} />), '');
  assert.equal(render(1, <Timed text="t" durationInFrames={2} />), '<b>t</b>');
  assert.equal(Interactive.withSchema, Interactive.create);
});

test('HtmlInCanvas reports the documented message where the browser lacks drawElementImage', () => {
  assert.equal(isHtmlInCanvasSupported(), false); assert.equal(HtmlInCanvas.isSupported(), false);
  assert.throws(() => render(0, <HtmlInCanvas width={10} height={10}><p>hi</p></HtmlInCanvas>), {message: getHtmlInCanvasUnsupportedMessage()});
});

test('createEffect descriptors and HTML-in-canvas messages match the recorded oracle', () => {
  const oracle = JSON.parse(readFileSync(new URL('../compatibility/core-media.json', import.meta.url), 'utf8')) as {
    effects: {params: {amount: number; disabled?: boolean}; output?: {effectKey: string; params: unknown; memoized: boolean}; error?: string}[];
    htmlInCanvas: {constant: string; supportedWithoutDocument: boolean; messageWithoutDocument: string};
  };
  const factory = createEffect<{amount: number}, null>({type: 'probe', label: 'Probe', documentationLink: null, backend: '2d', calculateKey: params => `k${params.amount}`, setup: () => null, apply: () => {}, cleanup: () => {}, validateParams: params => { if (!(params.amount >= 0)) throw new Error('amount'); }});
  for (const {params, output, error} of oracle.effects) {
    if (error) { assert.throws(() => factory(params), {message: error}); continue; }
    const descriptor = factory(params);
    assert.deepEqual({effectKey: descriptor.effectKey, params: descriptor.params, memoized: descriptor.memoized}, output);
  }
  assert.equal(HTML_IN_CANVAS_UNSUPPORTED_MESSAGE, oracle.htmlInCanvas.constant);
  assert.equal(isHtmlInCanvasSupported(), oracle.htmlInCanvas.supportedWithoutDocument);
  assert.equal(getHtmlInCanvasUnsupportedMessage(), oracle.htmlInCanvas.messageWithoutDocument);
});
