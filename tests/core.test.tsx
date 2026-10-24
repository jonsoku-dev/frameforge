import React from 'react';
import assert from 'node:assert/strict';
import test from 'node:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {AbsoluteFill, absoluteFillSchema, assertValidInterpolateEasingOption, assertValidInterpolatePosterizeOption, collectFrameHints, Config, CurrentScaleContext, Experimental, Folder, FolderContext, getStaticFiles, Html5Audio, Html5Video, IFrame, interpolateColors, MediaPlaybackError, prefetch, setStaticFiles, useBufferState, useCurrentScale, useIsInsideNonPremountFreeze, usePixelDensity, Video, VERSION, watchStaticFile} from '../src/core/index';
import {Audio, collectAudio, Composition, Still, cancelRender, continueRender, delayRender, getFrameforgeEnvironment, measureSpring, whenRenderReady, Easing, FrameProvider, Freeze, Loop, RegistryContext, Sequence, Series, getInputProps, getRegisteredRoot, googleFont, googleFontHref, interpolate, random, registerRoot, resolveCompositionMetadata, setInputProps, spring, springTrack, staticFile, useCurrentFrame, useVideoConfig, type CompositionDefinition} from '../src/core/index';
const config = {id: 'Test', width: 320, height: 180, fps: 30, durationInFrames: 100};
const Probe = () => <span>{useCurrentFrame()}:{useVideoConfig().durationInFrames}</span>;
const render = (frame: number, children: React.ReactNode) => renderToStaticMarkup(<FrameProvider config={config} frame={frame}>{children}</FrameProvider>);
test('Sequence half-open visibility and local frame', () => {
  const scene = <Sequence from={10} durationInFrames={5} layout="none"><Probe /></Sequence>;
  assert.equal(render(9, scene), ''); assert.equal(render(10, scene), '<span>0:5</span>');
  assert.equal(render(14, scene), '<span>4:5</span>'); assert.equal(render(15, scene), '');
});
test('Nested offsets, negative start, and parent duration clipping', () => {
  const scene = <Sequence from={10} durationInFrames={8} layout="none"><Sequence from={-3} durationInFrames={20} layout="none"><Probe /></Sequence></Sequence>;
  assert.equal(render(10, scene), '<span>3:11</span>');
  assert.equal(render(17, scene), '<span>10:11</span>'); assert.equal(render(18, scene), '');
  assert.equal(render(99, <Sequence from={90} layout="none"><Probe /></Sequence>), '<span>9:10</span>');
});
test('Series offsets overlap and shift subsequent entries', () => {
  const scene = <Series><Series.Sequence durationInFrames={10} layout="none"><b>A</b></Series.Sequence><Series.Sequence durationInFrames={5} offset={-2} layout="none"><Probe /></Series.Sequence><Series.Sequence durationInFrames={3} layout="none"><i>C</i></Series.Sequence></Series>;
  assert.equal(render(8, scene), '<b>A</b><span>0:5</span>');
  assert.equal(render(13, scene), '<i>C</i>'); assert.equal(render(16, scene), '');
  assert.throws(() => render(0, <Series><div /></Series>), /only accepts/);
});
test('Loop resets local frame; Freeze substitutes its frame', () => {
  const loop = <Loop durationInFrames={4} times={2} layout="none"><Probe /></Loop>;
  assert.equal(render(4, loop), '<span>0:4</span>'); assert.equal(render(8, loop), '');
  assert.equal(render(30, <Freeze frame={2}><Probe /></Freeze>), '<span>2:100</span>');
  assert.equal(render(30, <Freeze frame={2} active={false}><Probe /></Freeze>), '<span>30:100</span>');
});
test('Composition discovery and input props are host-owned', () => {
  const Root = () => <Composition id="Test" component={Probe} width={320} height={180} fps={30} durationInFrames={100} />;
  registerRoot(Root); assert.equal(getRegisteredRoot(), Root);
  const compositions: CompositionDefinition[] = [];
  renderToStaticMarkup(<RegistryContext.Provider value={c => compositions.push(c)}><Root /></RegistryContext.Provider>);
  assert.equal(compositions.length, 1); assert.equal(compositions[0].component, Probe);
  setInputProps({title: 'A'}); const props = getInputProps(); props.title = 'B';
  assert.equal(getInputProps().title, 'A');
});
test('interpolate piecewise easing and extrapolation modes', () => {
  assert.equal(interpolate(15, [0, 10, 20], [0, 100, 0]), 50);
  assert.equal(interpolate(5, [0, 10], [0, 100], {easing: Easing.quad}), 25);
  assert.equal(interpolate(-1, [0, 10], [0, 100]), -10);
  assert.equal(interpolate(12, [0, 10], [0, 100], {extrapolateRight: 'clamp'}), 100);
  assert.equal(interpolate(-1, [0, 10], [0, 100], {extrapolateLeft: 'identity'}), -1);
  assert.throws(() => interpolate(1, [0, 0], [0, 1]), /strictly increasing/);
  assert.throws(() => interpolate(NaN, [0, 1], [0, 1]), /finite/);
  assert.throws(() => interpolate(1, [0, 1], [0]), /equal lengths/);
  assert.ok(Math.abs(Easing.bezier(0, 0, 1, 1)(0.4) - 0.4) < 1e-8);
});
test('exponential easing keeps its nonzero initial value', () => {
  assert.equal(Easing.exp(0), 0.0009765625);
});
test('springTrack: holds from before the first key, settles on each target, and blends a change made mid-motion', () => {
  const fps = 60, config = {damping: 20};
  const keys = [{at: 10, to: 100}, {at: 200, to: 40}];
  assert.equal(springTrack({frame: 0, fps, from: 5, keys, config}), 5);
  assert.ok(Math.abs(springTrack({frame: 190, fps, from: 5, keys, config}) - 100) < 0.5);
  assert.ok(Math.abs(springTrack({frame: 600, fps, from: 5, keys, config}) - 40) < 1e-3);
  // A retarget 3 frames into the first move: no jump at the retarget frame.
  const early = [{at: 10, to: 100}, {at: 13, to: 40}];
  const step = (f: number) => springTrack({frame: f, fps, from: 0, keys: early, config}) - springTrack({frame: f - 1, fps, from: 0, keys: early, config});
  assert.ok(Math.abs(step(13)) < 2 * Math.abs(step(12)) + 1e-9, `step at retarget ${step(13)} vs before ${step(12)}`);
  assert.equal(springTrack({frame: 77.5, fps, from: 0, keys: early, config}), springTrack({frame: 77.5, fps, from: 0, keys: early, config}));
});

test('spring handles damping inputs and validates options', () => {
  for (const damping of [0, 10, 20, 40]) {
    assert.equal(spring({frame: 0, fps: 30, config: {damping}}), 0);
    for (const frame of [1, 30, 30000]) assert.ok(Number.isFinite(spring({frame, fps: 30, config: {damping}})));
    if (damping > 0) assert.ok(Math.abs(spring({frame: 3000, fps: 30, config: {damping}}) - 1) < 1e-6);
  }
  assert.ok(Math.abs(spring({frame: 15, fps: 30, config: {mass: 1, stiffness: 100, damping: 30}}) - 0.9595723180054873) < 1e-12);
  assert.equal(spring({frame: 4, fps: 30, delay: 5, from: 10, to: 20}), 10);
  assert.throws(() => spring({frame: 0, fps: 0}), /positive/);
  assert.throws(() => spring({frame: 0, fps: 30, config: {mass: -1}}), /positive/);
});
test('random is seed-stable, typed and bounded; staticFile encodes assets', () => {
  assert.equal(random('a'), random('a')); assert.notEqual(random('a'), random('b'));
  assert.notEqual(random(1), random('1'));
  for (let i = 0; i < 100; i++) assert.ok(random(i) >= 0 && random(i) < 1);
  assert.equal(staticFile('/images/my image.png'), '/images/my%20image.png');
  assert.throws(() => staticFile('../secret'), /traversal/);
});
test('calculateMetadata overrides duration and replaces props', async () => {
  const Cap = () => null;
  const found: CompositionDefinition[] = [];
  const Root = () => <Composition id="Cap" component={Cap} width={640} height={360} fps={30} durationInFrames={10} defaultProps={{script:'a'}} calculateMetadata={({props, isRendering}) => {
    if (!isRendering) throw new Error('expected the render flag');
    return {durationInFrames: String(props.script).length * 15, width: 1000, height: 500, defaultCodec: 'h264'};
  }} />;
  renderToStaticMarkup(<RegistryContext.Provider value={definition => found.push(definition)}><Root /></RegistryContext.Provider>);
  const resolved = await resolveCompositionMetadata({definition: found[0], input: {script: 'abcd'}, abortSignal: new AbortController().signal, isRendering: true});
  assert.equal(resolved.durationInFrames, 60);
  assert.equal(resolved.width, 1000);
  assert.equal(resolved.height, 500);
  assert.deepEqual(resolved.props, {script: 'abcd'});
  assert.equal(resolved.defaultProps?.script, 'a');
  const kept = await resolveCompositionMetadata({definition: found[0], input: {script: 'ab', extra: 1}, abortSignal: new AbortController().signal, isRendering: true});
  assert.equal(kept.durationInFrames, 30);
  assert.equal(kept.props.extra, 1);
  const replaced = await resolveCompositionMetadata({
    definition: {...found[0], calculateMetadata: () => ({props: {only: true}})},
    input: {script: 'keep-me'}, abortSignal: new AbortController().signal, isRendering: true,
  });
  assert.deepEqual(replaced.props, {only: true});
  const merged = await resolveCompositionMetadata({definition: {...config, component: Cap, defaultProps: {a: 1, b: 2}}, input: {b: 3}, abortSignal: new AbortController().signal, isRendering: false});
  assert.deepEqual(merged.props, {a: 1, b: 3});
  assert.equal(merged.durationInFrames, 100);
});
test('calculateMetadata rejects bad results and aborted work', async () => {
  const definition: CompositionDefinition = {...config, component: Probe, calculateMetadata: () => ({durationInFrames: 1.5})};
  await assert.rejects(() => resolveCompositionMetadata({definition, input: {}, abortSignal: new AbortController().signal, isRendering: false}), /must be an integer/);
  await assert.rejects(() => resolveCompositionMetadata({definition: {...definition, calculateMetadata: () => JSON.parse('{"id":"other"}')}, input: {}, abortSignal: new AbortController().signal, isRendering: false}), /unsupported field id/);
  await assert.rejects(() => resolveCompositionMetadata({definition: {...definition, calculateMetadata: () => JSON.parse('{"props":[]}')}, input: {}, abortSignal: new AbortController().signal, isRendering: false}), /not an object/);
  let called = false;
  await assert.rejects(() => resolveCompositionMetadata({
    definition: {...definition, calculateMetadata: () => { called = true; return {}; }},
    input: {}, abortSignal: AbortSignal.abort(), isRendering: false,
  }), /aborted/);
  assert.equal(called, false);
  const controller = new AbortController();
  let release = () => {};
  const pending = resolveCompositionMetadata({
    definition: {...definition, calculateMetadata: () => new Promise(resolve => { release = () => resolve({durationInFrames: 40}); })},
    input: {}, abortSignal: controller.signal, isRendering: false,
  });
  controller.abort();
  release();
  await assert.rejects(pending, /aborted/);
});
test('googleFont can name any family and refuses a URL', () => {
  assert.equal(googleFontHref('IBM Plex Sans KR', {weights: [700, 400]}), 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;700&display=swap');
  assert.equal(googleFontHref('Anybody', {weights: [800], italic: true, display: 'block'}), 'https://fonts.googleapis.com/css2?family=Anybody:ital,wght@0,800;1,800&display=block');
  assert.equal(googleFont('Anybody', {weights: [800]}), '"Anybody", sans-serif');
  assert.equal(googleFont('IBM Plex Mono', {fallback: 'monospace'}), '"IBM Plex Mono", monospace');
  assert.throws(() => googleFontHref('Roboto</style>'), /family/);
  assert.throws(() => googleFontHref('A', {weights: [0]}), /weight/);
});
test('bad timeline inputs and unsupported features fail clearly', () => {
  assert.throws(() => render(0, <Sequence durationInFrames={0}><Probe /></Sequence>), /positive/);
  assert.throws(() => render(0, <Audio src="test.wav" />), /starting with "\/"/);
  assert.throws(() => renderToStaticMarkup(<Probe />), /FrameProvider/);
});
test('random matches recorded oracle values', () => {
  assert.equal(random('a'), 0.5655837582889944); assert.equal(random('hello'), 0.41293257870711386);
  assert.equal(random(''), 0.26642920868471265); assert.equal(random(0), 0.26642920868471265);
  assert.equal(random(42), 0.6042497616726905); assert.equal(random(1000000), 0.625738090602681);
  assert.ok(random(null) >= 0 && random(null) < 1);
  assert.throws(() => random(undefined as any), /must be a number or a string/);
});
test('spring durationInFrames, reverse, and measureSpring match recorded values', () => {
  const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);
  near(spring({frame: 5, fps: 30}), 0.6958917272121958); near(spring({frame: 28, fps: 30}), 0.9968464194727024);
  near(spring({frame: 5, fps: 30, durationInFrames: 30}), 0.6394621089438035);
  near(spring({frame: 30, fps: 30, durationInFrames: 30}), 0.9968464194727024); near(spring({frame: 31, fps: 30, durationInFrames: 30}), 1);
  for (const [frame, value] of [[0, 0.9968464194727024], [20, 1.0649395616400006], [28, 0], [40, 0]]) near(spring({frame, fps: 30, reverse: true}), value);
  near(spring({frame: 0, fps: 30, delay: 5, reverse: true}), 1.00430481900363); near(spring({frame: 4, fps: 30, delay: 5, reverse: true}), 0.999944838377306);
  assert.equal(measureSpring({fps: 30}), 28); assert.equal(measureSpring({fps: 30, threshold: 0.001}), 39);
  assert.equal(measureSpring({fps: 30, threshold: 0.05}), 16); assert.equal(measureSpring({fps: 30, config: {damping: 200}}), 23);
  assert.equal(measureSpring({fps: 30, config: {mass: 2, stiffness: 50, damping: 5}}), 123);
  assert.equal(measureSpring({fps: 30, config: {overshootClamping: true}}), 28); assert.equal(measureSpring({fps: 60}), 56);
  assert.throws(() => measureSpring({fps: 30, config: {damping: 0}}), /did not settle/);
});
test('Sequence playbackRate, trimBefore, freeze, and mount hints', () => {
  const at = (frame: number, scene: React.ReactNode, duration = 120) => renderToStaticMarkup(<FrameProvider config={{...config, durationInFrames: duration}} frame={frame}>{scene}</FrameProvider>);
  const nested = <Sequence from={30} durationInFrames={40} playbackRate={2} layout="none"><Sequence from={10} durationInFrames={20} playbackRate={0.5} trimBefore={3} layout="none"><Probe /></Sequence></Sequence>;
  assert.equal(at(34, nested), ''); assert.equal(at(35, nested), '<span>3:18</span>');
  assert.equal(at(44, nested), '<span>12:18</span>'); assert.equal(at(50, nested), '');
  const slow = <Sequence from={10} durationInFrames={20} playbackRate={0.5} trimBefore={4} layout="none"><Probe /></Sequence>;
  assert.equal(at(11, slow, 100), '<span>4.5:24</span>'); assert.notEqual(at(49, slow, 100), ''); assert.equal(at(50, slow, 100), '');
  assert.equal(at(5, <Sequence playbackRate={2} durationInFrames={20} layout="none"><Probe /></Sequence>, 100), '<span>10:20</span>');
  const frozen = <Sequence from={10} durationInFrames={5} freeze={3} layout="none"><Probe /></Sequence>;
  assert.equal(at(12, frozen), '<span>3:5</span>'); assert.equal(at(15, frozen), '');
  assert.equal(at(12, <Sequence from={10} freeze={null} layout="none"><Probe /></Sequence>), '<span>2:110</span>');
  assert.equal(at(12, <Sequence from={10} premountFor={5} postmountFor={5} layout="none"><Probe /></Sequence>), '<span>2:110</span>');
  for (const playbackRate of [0, -1, Infinity, NaN]) assert.throws(() => at(0, <Sequence playbackRate={playbackRate}><Probe /></Sequence>), /playbackRate/);
  assert.throws(() => at(0, <Sequence trimBefore={-1}><Probe /></Sequence>), /trimBefore/);
});
test('delayRender gates whenRenderReady until continued, cancelled, or timed out', async () => {
  const handle = delayRender('Fetching data');
  let ready = false; const pendingReady = whenRenderReady().then(() => { ready = true; });
  await new Promise(resolve => setTimeout(resolve, 30)); assert.equal(ready, false);
  continueRender(handle); continueRender(9999); await pendingReady; assert.equal(ready, true);
  const timed = delayRender('Slow thing', {timeoutInMilliseconds: 20});
  await assert.rejects(whenRenderReady(), /delayRender\(\) "Slow thing" was called but not cleared after 20ms/);
  continueRender(timed);
  assert.throws(() => cancelRender(new Error('stop')), /stop/);
  await assert.rejects(whenRenderReady(), /stop/);
});
test('Still registers one frame at 1 fps; environment reports Node as studio', () => {
  const found: CompositionDefinition[] = [];
  renderToStaticMarkup(<RegistryContext.Provider value={c => found.push(c)}><Still id="Poster" component={Probe} width={100} height={50} /></RegistryContext.Provider>);
  assert.equal(found[0].fps, 1); assert.equal(found[0].durationInFrames, 1);
  assert.equal(getFrameforgeEnvironment().isRendering, false); assert.equal(getFrameforgeEnvironment().isStudio, true);
});
test('Audio reports its absolute start frame and rejects unsupported options', () => {
  collectAudio();
  renderToStaticMarkup(<FrameProvider config={{...config, durationInFrames: 300}} frame={250}><Sequence from={240}><Audio src="/audio/a.wav" volume={0.8} /></Sequence></FrameProvider>);
  assert.deepEqual(collectAudio(), [{key: '/audio/a.wav:240:0', src: '/audio/a.wav', volume: 0.8, trimBefore: 0, startFrame: 240}]);
  assert.deepEqual(collectAudio(), []);
  render(50, <Sequence from={10}><Sequence from={20} trimBefore={5}><Audio src="/b.wav" trimBefore={15} trimAfter={90} /></Sequence></Sequence>);
  assert.deepEqual(collectAudio().map(({startFrame, trimBefore, trimAfter}) => ({startFrame, trimBefore, trimAfter})), [{startFrame: 25, trimBefore: 15, trimAfter: 90}]);
  render(40, <Sequence from={30} playbackRate={2}><Sequence from={10} playbackRate={0.5} trimBefore={3}><Audio src="/c.wav" /></Sequence></Sequence>);
  assert.equal(collectAudio()[0].startFrame, 32);
  render(99, <Audio src="/b.wav" trimAfter={99} />);
  assert.deepEqual(collectAudio(), []);
  for (const volume of [-0.1, 1.5, NaN]) assert.throws(() => render(0, <Audio src="/a.wav" volume={volume} />), /volume/);
  for (const extra of [{loop: true}, {playbackRate: 2}, {muted: true}, {volume: () => 1}]) assert.throws(() => render(0, <Audio src="/a.wav" {...(extra as any)} />), /unsupported in FrameForge/);
  assert.throws(() => render(0, <Sequence playbackRate={2}><Audio src="/a.wav" /></Sequence>), /playbackRate other than 1 is unsupported/);
  assert.throws(() => render(0, <Freeze frame={3}><Audio src="/a.wav" /></Freeze>), /Freeze is unsupported/);
  assert.throws(() => render(0, <Audio src="a.wav" />), /starting with/);
});
test('interpolateColors matches recorded values, clamps, and rejects bad colors', () => {
  assert.equal(interpolateColors(0.5, [0, 1], ['#000', '#fff']), 'rgba(128, 128, 128, 1)');
  assert.equal(interpolateColors(0.3, [0, 1], ['#ff000080', 'rgba(0,0,255,0.2)']), 'rgba(179, 0, 77, 0.411)');
  assert.equal(interpolateColors(0.5, [0, 1], ['red', 'hsla(120,100%,50%,0.5)']), 'rgba(128, 128, 0, 0.751)');
  assert.equal(interpolateColors(0, [0], ['oklch(0.7 0.2 30 / 50%)']), 'rgba(255, 97, 77, 0.502)');
  assert.equal(interpolateColors(0, [0], ['lab(30 60 -80)']), 'rgba(66, 30, 200, 1)');
  assert.equal(interpolateColors(-1, [0, 1], ['red', 'blue']), 'rgba(255, 0, 0, 1)');
  assert.equal(interpolateColors(2, [0, 1], ['red', 'blue']), 'rgba(0, 0, 255, 1)');
  assert.equal(interpolateColors(4, [0, 10], ['red', 'blue'], {posterize: 3}), 'rgba(179, 0, 77, 1)');
  assert.equal(interpolateColors(1.6, [0, 1, 2], ['red', 'blue', 'lime'], {easing: [Easing.quad, Easing.cubic]}), 'rgba(0, 55, 200, 1)');
  for (const bad of ['notacolor', 'RED', ' red', 'constructor', 'rgb(10 20 30)', '#abcde']) assert.throws(() => interpolateColors(0.5, [0, 1], [bad, 'red']), /invalid color/);
  assert.throws(() => interpolateColors(0.5, [1, 0], ['red', 'blue']), /strictly increasing/);
  assert.throws(() => interpolateColors(0.5, [0, 1], ['red']), /equal lengths/);
});
test('interpolate posterize and per-segment easing share the exported validators', () => {
  assert.equal(interpolate(4, [0, 10], [0, 100], {posterize: 3}), 30);
  assert.equal(interpolate(15, [0, 10, 20], [0, 100, 0], {easing: [Easing.quad, Easing.cubic]}), 87.5);
  assert.throws(() => interpolate(5, [0, 10, 20], [0, 100, 0], {easing: [Easing.quad]}), /2 entries/);
  assertValidInterpolateEasingOption(undefined, 2); assertValidInterpolateEasingOption(Easing.quad, 2); assertValidInterpolateEasingOption([], 1);
  assert.throws(() => assertValidInterpolateEasingOption(['x'] as any, 2), /easing\[0\] must be a function/);
  assertValidInterpolatePosterizeOption(undefined); assertValidInterpolatePosterizeOption(0.5);
  for (const bad of [0, -1, NaN, Infinity, '3']) assert.throws(() => assertValidInterpolatePosterizeOption(bad as any), /positive finite/);
});
test('VERSION, Config, aliases, MediaPlaybackError, and absoluteFillSchema', () => {
  assert.equal(VERSION, JSON.parse(readFileSync('package.json', 'utf8')).version);
  assert.deepEqual(Config, {}); assert.ok(Object.isFrozen(Config));
  assert.equal(Html5Audio, Audio); assert.equal(Html5Video, Video);
  const error = new MediaPlaybackError({message: 'cannot play', src: '/a.mp4'});
  assert.ok(error instanceof Error); assert.equal(error.name, 'MediaPlaybackError'); assert.equal(error.src, '/a.mp4');
  assert.equal(absoluteFillSchema.position, 'absolute');
  assert.match(renderToStaticMarkup(<AbsoluteFill style={{display: 'block'}} />), /position:absolute;.*display:block;flex-direction:column/);
});
test('FolderContext carries the folder and parent names', () => {
  const Names = () => { const {folderName, parentName} = React.useContext(FolderContext); return <i>{String(folderName)}/{String(parentName)}</i>; };
  assert.equal(renderToStaticMarkup(<Names />), '<i>null/null</i>');
  assert.equal(renderToStaticMarkup(<Folder name="a"><Folder name="b"><Names /></Folder></Folder>), '<i>b/a</i>');
});
test('IFrame renders an iframe without forwarding delayRender options', () => {
  const html = renderToStaticMarkup(<IFrame src="/page.html" title="t" delayRenderTimeoutInMilliseconds={5000} delayRenderRetries={1} />);
  assert.equal(html, '<iframe src="/page.html" title="t"></iframe>');
});
test('Experimental.Null and Clipper report frame hints; useIsPlayer is false', () => {
  collectFrameHints();
  render(0, <Experimental.Null />);
  assert.deepEqual(collectFrameHints(), {skip: true, clip: null});
  assert.deepEqual(collectFrameHints(), {skip: false, clip: null});
  render(0, <Experimental.Clipper x={10} y={20} width={100} height={50} />);
  assert.deepEqual(collectFrameHints(), {skip: false, clip: {x: 10, y: 20, width: 100, height: 50}});
  assert.throws(() => render(0, <Experimental.Clipper x={0} y={0} width={0} height={5} />), /positive/);
  assert.equal(Experimental.useIsPlayer(), false);
});
test('Series.Sequence playbackRate speeds its children and shortens its slot', () => {
  const scene = <Series><Series.Sequence durationInFrames={10} playbackRate={2} layout="none"><Probe /></Series.Sequence><Series.Sequence durationInFrames={5} layout="none"><i>B</i></Series.Sequence></Series>;
  assert.equal(render(0, scene), '<span>0:10</span>'); assert.equal(render(4, scene), '<span>8:10</span>');
  assert.equal(render(5, scene), '<i>B</i>'); assert.equal(render(10, scene), '');
  const nested = <Sequence from={30} durationInFrames={40} playbackRate={2} layout="none"><Series><Series.Sequence durationInFrames={20} playbackRate={0.5} layout="none"><Probe /></Series.Sequence></Series></Sequence>;
  assert.equal(render(35, nested), '<span>5:20</span>');
  assert.throws(() => render(0, <Series><Series.Sequence durationInFrames={5} playbackRate={2}><Probe /></Series.Sequence></Series>), /whole number/);
});
test('useIsInsideNonPremountFreeze is true only under a freeze', () => {
  const Flag = () => <b>{String(useIsInsideNonPremountFreeze())}</b>;
  assert.equal(render(3, <Flag />), '<b>false</b>');
  assert.equal(render(3, <Freeze frame={1}><Flag /></Freeze>), '<b>true</b>');
  assert.equal(render(3, <Sequence freeze={1} layout="none"><Flag /></Sequence>), '<b>true</b>');
  assert.equal(render(3, <Freeze frame={1} active={false}><Flag /></Freeze>), '<b>false</b>');
});
test('useCurrentScale and usePixelDensity read the stage and refuse to run outside a composition by default', () => {
  const Scale = () => <b>{useCurrentScale()}</b>;
  assert.equal(render(0, <Scale />), '<b>1</b>');
  assert.equal(render(0, <CurrentScaleContext.Provider value={0.5}><Scale /></CurrentScaleContext.Provider>), '<b>0.5</b>');
  assert.throws(() => renderToStaticMarkup(<Scale />), /inside a composition/);
  const Loose = ({flag}: {flag: string}) => <b>{useCurrentScale({[flag]: true})}:{usePixelDensity({[flag]: true})}</b>;
  for (const flag of ['dontThrowIfOutsideOfFrameforge']) assert.equal(renderToStaticMarkup(<CurrentScaleContext.Provider value={0.5}><Loose flag={flag} /></CurrentScaleContext.Provider>), '<b>1:1</b>');
  const Density = () => <b>{usePixelDensity()}</b>;
  assert.equal(render(0, <Density />), '<b>1</b>');
});
test('useBufferState is a no-op outside the studio', () => {
  let handle: {unblock: () => void} | null = null;
  const Block = () => { handle = useBufferState().delayPlayback(); return null; };
  render(0, <Block />);
  handle!.unblock(); handle!.unblock();
});
test('getStaticFiles returns the host-loaded listing as copies', () => {
  assert.deepEqual(getStaticFiles(), []);
  setStaticFiles([{name: 'a b.png', src: '/a%20b.png', sizeInBytes: 3, lastModified: 1}]);
  const files = getStaticFiles(); files[0]!.name = 'changed';
  assert.equal(getStaticFiles()[0]!.name, 'a b.png');
  setStaticFiles([]);
});
test('watchStaticFile polls every 2 s in the studio and reports changes and removal', async (t) => {
  assert.doesNotThrow(() => watchStaticFile('x.png', () => {}).cancel()); // no window: nothing to poll
  const listings = [[{name: 'x.png', src: '/x.png', sizeInBytes: 1, lastModified: 1}], [{name: 'x.png', src: '/x.png', sizeInBytes: 1, lastModified: 1}], [{name: 'x.png', src: '/x.png', sizeInBytes: 2, lastModified: 5}], []];
  setStaticFiles(listings.shift()!);
  t.mock.timers.enable({apis: ['setInterval']});
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => ({json: async () => listings.shift()}) as unknown as Response);
  (globalThis as any).window = {};
  try {
    const seen: unknown[] = [];
    const watcher = watchStaticFile('x.png', file => seen.push(file && file.sizeInBytes));
    for (let i = 0; i < 3; i++) { t.mock.timers.tick(2000); await new Promise(resolve => setImmediate(resolve)); }
    assert.deepEqual(seen, [2, null]);
    watcher.cancel(); t.mock.timers.tick(2000);
    assert.equal(fetchMock.mock.callCount(), 3);
  } finally { delete (globalThis as any).window; setStaticFiles([]); }
});
test('prefetch downloads to a blob or data URL and frees it', async () => {
  const progress: number[] = [];
  const blob = prefetch('data:text/plain;base64,aGVsbG8=', {onProgress: ({loadedBytes}) => progress.push(loadedBytes)});
  const url = await blob.waitUntilDone();
  assert.match(url, /^blob:/); assert.equal(progress.at(-1), 5);
  blob.free();
  assert.equal(await prefetch('data:text/plain;base64,aGVsbG8=', {method: 'base64', contentType: 'text/x-test'}).waitUntilDone(), 'data:text/x-test;base64,aGVsbG8=');
});
