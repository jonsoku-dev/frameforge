import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {existsSync, mkdtempSync, readdirSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
// @ts-expect-error the renderer is plain ESM without types
import {AUDIO, encodeArgs, outputFormat, videoArgs} from '../scripts/render.mjs';
// @ts-expect-error plain ESM without types
import {parseLoudnorm, parseSilences, silenceReport} from '../scripts/silence-detect.mjs';
import {checkTable, ENGINE, summarize} from '../bin/frameforge.mjs';
import {barPhaseSeconds, beatGrid, beatsFromSpec, loadBeats} from '../src/packages/beats';
import {contrastRatio, insideSafeArea, over, parseCssColor, rectsOverlap, type Rgba} from '../src/studio/audit';
import kitSpec from '../examples/samples/kit-launch/audio.json';

const close = (actual: number, expected: number, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);
const PORT = process.env.FRAMEFORGE_PORT ?? '4327';

test('the container follows the output extension and the codec sets the pixel format, with alpha only where it fits', () => {
  assert.deepEqual(pick(outputFormat('a.mp4')), ['mp4', 'h264', 'yuv420p', 'aac', false]);
  assert.deepEqual(pick(outputFormat('a.webm')), ['webm', 'vp9', 'yuv420p', 'opus', false]);
  assert.deepEqual(pick(outputFormat('a.mov')), ['mov', 'prores', 'yuv444p10le', 'pcm', false]);
  assert.deepEqual(pick(outputFormat('a.gif')), ['gif', 'gif', 'pal8', 'none', false]);
  assert.deepEqual(pick(outputFormat('renders/frames/')), ['png', 'png', 'rgb24', 'none', true]);
  assert.deepEqual(pick(outputFormat('renders/frames/%05d.png', {transparent: true})), ['png', 'png', 'rgba', 'none', true]);
  assert.deepEqual(pick(outputFormat('a.webm', {transparent: true})), ['webm', 'vp9', 'yuva420p', 'opus', false]);
  assert.deepEqual(pick(outputFormat('a.mov', {transparent: true, audioCodec: 'none'})), ['mov', 'prores', 'yuva444p10le', 'none', false]);
  assert.equal(outputFormat('a.mov', {codec: 'h264'}).codec, 'h264');
  assert.equal(outputFormat('a.webm', {crf: 20}).crf, 20);
  assert.equal(outputFormat('a.mp4').chunked, true);
  assert.equal(outputFormat('a.gif').chunked, false);
  assert.deepEqual(pick(outputFormat('live/a.m3u8')), ['m3u8', 'h264', 'yuv420p', 'aac', false]);
  assert.equal(outputFormat('a.m3u8').chunked, false, 'one playlist, so one chunk like gif');
  assert.deepEqual(outputFormat('a.m3u8').mux, ['-force_key_frames', 'expr:gte(t,n_forced*4)', '-f', 'hls', '-hls_time', '4', '-hls_playlist_type', 'vod']);
  assert.throws(() => outputFormat('a.m3u8', {transparent: true}), /cannot carry alpha/);
  assert.throws(() => outputFormat('a.m3u8', {codec: 'vp9'}), /does not go into \.m3u8/);
  assert.throws(() => outputFormat('a.mp4', {transparent: true}), /cannot carry alpha/);
  assert.throws(() => outputFormat('a.mp4', {codec: 'prores'}), /does not go into \.mp4/);
  assert.throws(() => outputFormat('a.png'), /needs --frames/);
  assert.throws(() => outputFormat('a.mkv'), /Unknown output/);
  assert.throws(() => outputFormat('a.webm', {audioCodec: 'mp3'}), /Unknown audio codec/);
});
const pick = (format: {container: string; codec: string; pixFmt: string; audio: string; sequence: boolean}) => [format.container, format.codec, format.pixFmt, format.audio, format.sequence];

test('ffmpeg video arguments per codec: h264 unchanged, vp9 and prores carry alpha pixel formats, gif runs palettegen then paletteuse', () => {
  const h264 = videoArgs(outputFormat('a.mp4'), 30).join(' ');
  assert.equal(h264, '-frames:v 30 -vf scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv -c:v libx264 -crf 18 -preset slow -x264-params colorprim=bt709:transfer=bt709:colormatrix=bt709:range=tv');
  const vp9 = videoArgs(outputFormat('a.webm', {transparent: true}), 30).join(' ');
  assert.match(vp9, /format=yuva420p.* -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 32 -row-mt 1 -auto-alt-ref 0 -color_primaries bt709/);
  assert.doesNotMatch(videoArgs(outputFormat('a.webm'), 30).join(' '), /auto-alt-ref|yuva/);
  const prores = videoArgs(outputFormat('a.mov', {transparent: true}), 30).join(' ');
  assert.match(prores, /format=yuva444p10le.* -c:v prores_ks -profile:v 4 -pix_fmt yuva444p10le/);
  assert.match(videoArgs(outputFormat('a.mov'), 30).join(' '), /-pix_fmt yuv444p10le/);
  const gif = videoArgs(outputFormat('a.gif', {transparent: true, gifFps: 12}), 30);
  assert.deepEqual(gif, ['-filter_complex', '[0:v]fps=12,split[a][b];[a]palettegen=reserve_transparent=1[p];[b][p]paletteuse=dither=bayer:bayer_scale=3:alpha_threshold=128', '-loop', '0']);
  assert.match(videoArgs(outputFormat('a.gif'), 30)[1]!, /^\[0:v\]split.*reserve_transparent=0/);
  assert.deepEqual(videoArgs(outputFormat('a.mp4'), 10, {width: 3840, height: 2160}).slice(2, 4), ['-vf', 'scale=3840:2160,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv']);
  assert.throws(() => videoArgs(outputFormat('frames/'), 10), /written as files/);
  assert.deepEqual(encodeArgs(['-i', 'in'], ['-c:v', 'x'], 30, 30, [], 'out', 0, AUDIO.pcm), ['-n', '-i', 'in', '-c:v', 'x', 'out']);
  assert.deepEqual(AUDIO, {aac: ['-c:a', 'aac', '-b:a', '192k'], opus: ['-c:a', 'libopus', '-b:a', '160k'], pcm: ['-c:a', 'pcm_s16le'], none: []});
});

test('beatGrid: 120 bpm at 30 fps is 15 frames per beat, bars of four, a linear pulse, bar lines in a range', () => {
  const grid = beatGrid({bpm: 120, fps: 30});
  assert.equal(grid.framesPerBeat, 15);
  assert.equal(grid.beatAt(37), 30); assert.equal(grid.nextBeat(37), 45); assert.equal(grid.beatIndex(37), 2);
  assert.equal(grid.barAt(37), 0); assert.equal(grid.barAt(60), 1); assert.equal(grid.beatIndex(-1), -1);
  close(grid.phase(37), 7 / 15); assert.equal(grid.phase(45), 0);
  assert.equal(grid.pulse(30, 10), 1); close(grid.pulse(35, 10), 0.5); assert.equal(grid.pulse(44, 10), 0);
  assert.ok(grid.onBeat(45) && grid.onBeat(44, 1) && !grid.onBeat(43, 1));
  assert.deepEqual(grid.bars(0, 150), [0, 60, 120]);
  assert.deepEqual(beatGrid({bpm: 120, fps: 30, offsetFrames: 5}).bars(0, 150), [5, 65, 125]);
  assert.deepEqual(beatGrid({bpm: 120, fps: 30, beatsPerBar: 3}).bars(1, 100), [45, 90]);
  close(beatGrid({bpm: 110, fps: 30}).framesPerBeat, 1800 / 110);
  assert.throws(() => beatGrid({bpm: 0, fps: 30}), /bpm > 0/);
});

test('beatsFromSpec puts bar lines where the score does: the phase nearest the hits and section starts, or offsetMs when given', () => {
  // The documented case: hits at 2.5 s and 12.5 s at 120 bpm put the bar lines at 0.5 s.
  assert.equal(barPhaseSeconds({bpm: 120, hits: [2.5, 12.5], sections: [{from: 0}, {from: 5}]}), 0.5);
  assert.deepEqual(beatsFromSpec({bpm: 120, hits: [2.5, {at: 12.5}], sections: [{from: 0}, {from: 5}]}, 30).bars(0, 120), [15, 75]);
  assert.equal(barPhaseSeconds(kitSpec), 0, 'kit-launch hits at 3 s and 14 s are closer to the bars at 0 than to those at 1 s');
  assert.deepEqual(beatsFromSpec(kitSpec, 30).bars(0, 180), [0, 60, 120, 180]);
  assert.deepEqual(beatsFromSpec({bpm: 120, offsetMs: 500}, 30).bars(0, 120), [15, 75]);
  assert.equal(beatsFromSpec({bpm: 60}, 30).framesPerBeat, 30);
});

test('loadBeats keeps irregular detected beats and extends them by the average interval', () => {
  const grid = loadBeats({bpm: 120, offsetMs: 0, beats: [0, 500, 1000, 1600, 2000]}, 30);
  assert.equal(grid.beatAt(40), 30); assert.equal(grid.nextBeat(40), 48); close(grid.phase(40), 10 / 18);
  assert.equal(grid.beatIndex(50), 3); assert.equal(grid.beatIndex(48), 3); assert.equal(grid.barAt(48), 0);
  assert.deepEqual(grid.bars(0, 70), [0, 60]);
  assert.equal(grid.nextBeat(60), 75, 'past the last beat the mean interval (15 frames) continues');
  assert.equal(grid.beatAt(-5), -15); assert.equal(grid.framesPerBeat, 15);
  assert.ok(grid.onBeat(48) && !grid.onBeat(45, 1));
  assert.deepEqual(loadBeats({bpm: 120, offsetMs: 250}, 30).bars(0, 100), [7.5, 67.5], 'without a list, a regular grid from bpm and offsetMs');
});

test('audit helpers: WCAG contrast of known pairs, colour parsing, overlap area, safe area', () => {
  const white: Rgba = [255, 255, 255, 1], black: Rgba = [0, 0, 0, 1];
  assert.equal(contrastRatio(white, black), 21);
  assert.equal(contrastRatio(black, white), 21);
  close(contrastRatio([119, 119, 119, 1], white), 4.48, 0.01);
  close(contrastRatio([255, 255, 255, 1], [15, 23, 42, 1]), 17.85, 0.05);
  close(contrastRatio([136, 136, 136, 1], [153, 153, 153, 1]), 1.24, 0.01);
  assert.deepEqual(parseCssColor('#0F172A'), [15, 23, 42, 1]);
  assert.deepEqual(parseCssColor('#fff8'), [255, 255, 255, 136 / 255]);
  assert.deepEqual(parseCssColor('rgba(15, 23, 42, 0.5)'), [15, 23, 42, 0.5]);
  assert.deepEqual(parseCssColor('rgb(255 255 255 / 50%)'), [255, 255, 255, 0.5]);
  assert.deepEqual(parseCssColor('rgb(0, 0, 0)'), [0, 0, 0, 1]);
  assert.deepEqual(parseCssColor('transparent'), [0, 0, 0, 0]);
  assert.equal(parseCssColor('oklch(0.5 0.1 200)'), null);
  assert.deepEqual(over([0, 0, 0, 0.5], white), [128, 128, 128, 1]);
  assert.equal(rectsOverlap({x: 0, y: 0, width: 10, height: 10}, {x: 5, y: 5, width: 10, height: 10}), 25);
  assert.equal(rectsOverlap({x: 0, y: 0, width: 10, height: 10}, {x: 10, y: 0, width: 10, height: 10}), 0);
  const viewport = {width: 1920, height: 1080};
  assert.ok(insideSafeArea({x: 96, y: 54, width: 100, height: 50}, viewport, 0.05));
  assert.ok(!insideSafeArea({x: 95, y: 54, width: 100, height: 50}, viewport, 0.05));
  assert.ok(!insideSafeArea({x: 1700, y: 54, width: 125, height: 50}, viewport, 0.05));
  assert.ok(!insideSafeArea({x: 96, y: 1000, width: 100, height: 27}, viewport, 0.05));
});

test('silence-detect parses loudnorm JSON and silencedetect lines into leading, trailing and trim frames', () => {
  const loudnorm = '[Parsed_loudnorm_0 @ 0x1] \n{\n\t"input_i" : "-22.38",\n\t"input_tp" : "-18.06",\n\t"input_lra" : "0.00",\n\t"input_thresh" : "-32.57",\n\t"output_i" : "-24.00",\n\t"target_offset" : "0.00"\n}\n';
  assert.deepEqual(parseLoudnorm(loudnorm), {inputThresh: -32.57, inputI: -22.38, inputTp: -18.06});
  const silencedetect = '[silencedetect @ 0x1] silence_start: 0\n[silencedetect @ 0x1] silence_end: 1.000091 | silence_duration: 1.000091\nframe=1\n[silencedetect @ 0x1] silence_start: 2.999932\n[silencedetect @ 0x1] silence_end: 4 | silence_duration: 1.000068\n[silencedetect @ 0x1] silence_start: 5.5\n';
  const silences = parseSilences(silencedetect);
  assert.deepEqual(silences, [{start: 0, end: 1.000091, duration: 1.000091}, {start: 2.999932, end: 4, duration: 1.000068}, {start: 5.5, end: null, duration: null}]);
  const report = silenceReport(silences.slice(0, 2), 4, 30);
  assert.deepEqual(report.leading, {seconds: 1, frames: 30});
  assert.deepEqual(report.trailing, {seconds: 1, frames: 30});
  assert.deepEqual(report.trim, {startFrame: 30, endFrame: 89, frames: 60});
  assert.deepEqual(report.segments.map((item: {frames: unknown}) => item.frames), [{from: 0, to: 29}, {from: 90, to: 119}]);
  const open = silenceReport([{start: 5.5, end: null, duration: null}], 6, 30);
  assert.deepEqual(open.trailing, {seconds: 0.5, frames: 15});
  assert.deepEqual(open.trim, {startFrame: 0, endFrame: 164, frames: 165});
  assert.deepEqual(silenceReport([], 2, 30).trim, {startFrame: 0, endFrame: 59, frames: 60});
});

test('beats.py --self-check recovers synthesised click tracks', () => {
  const result = spawnSync('python3', [join(ENGINE, 'scripts/assets/beats.py'), '--self-check'], {encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /beats self-check ok/);
});

test('check summaries: frame-check FAIL line or header, flash-check worst second, first line otherwise; the table aligns', () => {
  assert.equal(summarize('frame-check', 'a.mp4 1920x1080 30f (hold 60)\n  coverage min 0.1\n  PASS\n', ''), 'a.mp4 1920x1080 30f (hold 60)');
  assert.equal(summarize('frame-check', 'a.mp4 1920x1080 30f\n  FAIL: empty 0-40 (41f)\n', ''), 'FAIL: empty 0-40 (41f)');
  assert.equal(summarize('flash-check', JSON.stringify({worstSecondFlashes: 1, mergedTransitions: 3}), ''), 'worst second 1 flashes (limit 3), 3 transitions');
  assert.equal(summarize('seam-check', '', 'boom\nmore'), 'boom');
  assert.equal(checkTable([{check: 'frame-check', status: 'PASS', detail: 'ok'}, {check: 'seam-check', status: 'SKIP', detail: 'x 없음'}]), 'frame-check  PASS  ok\nseam-check   SKIP  x 없음');
});

test('real renders: a transparent webm of the translucent fixture carries alpha and the layout audit, and frameforge check tabulates a kit-launch clip', {timeout: 240000}, () => {
  const out = mkdtempSync(join(tmpdir(), 'ff-outputs-'));
  const env = {...process.env, FRAMEFORGE_PORT: PORT};
  try {
    const webm = join(out, 'alpha.webm');
    const alpha = spawnSync(process.execPath, [join(ENGINE, 'scripts/render.mjs'), 'tests/fixtures/tooling/entry.tsx', 'Translucent', webm, '--frame-range', '0-9', '--transparent'], {cwd: ENGINE, encoding: 'utf8', env});
    assert.equal(alpha.status, 0, alpha.stderr);
    const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,width,height:stream_tags=alpha_mode', '-of', 'default=noprint_wrappers=1', webm], {encoding: 'utf8'}).stdout;
    assert.match(probe, /codec_name=vp9/); assert.match(probe, /width=640/); assert.match(probe, /TAG:alpha_mode=1/);
    assert.ok(existsSync(`${webm}.motion.json`));
    const audit = JSON.parse(alpha.stdout.split('\n').find(line => line.startsWith('{"audit"'))!).audit as {code: string; text: string}[];
    assert.deepEqual(audit.map(item => `${item.code}:${item.text}`).sort(), ['contrast_low:흐린 글자', 'text_outside_safe:가장자리', 'text_overlap:겹침 / 겹침 둘', 'text_too_small:예시 데이터']);
    const strict = spawnSync(process.execPath, [join(ENGINE, 'scripts/render.mjs'), 'tests/fixtures/tooling/entry.tsx', 'Translucent', join(out, 'strict.mov'), '--frame-range', '0-1', '--transparent', '--strict-audit'], {cwd: ENGINE, encoding: 'utf8', env});
    assert.equal(strict.status, 1); assert.match(strict.stderr, /Layout audit: 4 finding/);

    const mp4 = join(out, 'kit.mp4');
    const render = spawnSync(process.execPath, [join(ENGINE, 'scripts/render.mjs'), 'examples/samples/kit-launch/entry.tsx', 'KitLaunch', mp4, '--frame-range', '0-29'], {cwd: ENGINE, encoding: 'utf8', env});
    assert.equal(render.status, 0, render.stderr);
    assert.ok(!render.stdout.includes('{"audit"'), `kit-launch should audit clean: ${render.stdout}`);
    const check = spawnSync(process.execPath, [join(ENGINE, 'bin/frameforge.mjs'), 'check', mp4, '--film', 'kit-launch', '--json'], {cwd: ENGINE, encoding: 'utf8', env});
    const rows = JSON.parse(check.stdout) as {check: string; status: string; detail: string}[];
    assert.deepEqual(rows.map(row => row.check), ['frame-check', 'flash-check', 'seam-check', 'narration-check']);
    assert.equal(rows[0]!.status, 'PASS'); assert.equal(rows[1]!.status, 'PASS');
    assert.ok(['PASS', 'FAIL', 'SKIP'].includes(rows[2]!.status), 'seam-check runs when another workstream has landed its script, else SKIPs');
    assert.equal(rows[3]!.status, 'SKIP'); assert.match(rows[3]!.detail, /^(narration\.timing\.json|scripts\/narration-check\.mjs) 없음$/, 'kit-launch has no narration timing');
    assert.equal(check.status, rows.some(row => row.status === 'FAIL') ? 1 : 0);
    const table = spawnSync(process.execPath, [join(ENGINE, 'bin/frameforge.mjs'), 'check', mp4], {cwd: ENGINE, encoding: 'utf8', env}).stdout;
    assert.match(table, /^frame-check {6}PASS {2}/m); assert.match(table, /^narration-check {2}SKIP {2}--film 없음|^narration-check {2}SKIP {2}scripts/m);
    assert.equal(readFileSync(`${mp4}.motion.json`, 'utf8').slice(0, 1), '{');
  } finally { rmSync(out, {recursive: true, force: true}); }
});

test('real HLS render: a 30-frame kit-launch playlist of h264 + aac with its one segment published beside it by bare name', {timeout: 240000}, () => {
  const out = mkdtempSync(join(tmpdir(), 'ff-hls-'));
  try {
    const playlist = join(out, 'kit.m3u8');
    const render = spawnSync(process.execPath, [join(ENGINE, 'scripts/render.mjs'), 'examples/samples/kit-launch/entry.tsx', 'KitLaunch', playlist, '--frame-range', '0-29'], {cwd: ENGINE, encoding: 'utf8', env: {...process.env, FRAMEFORGE_PORT: PORT}});
    assert.equal(render.status, 0, render.stderr);
    const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name', '-of', 'csv=p=0', playlist], {encoding: 'utf8'}).stdout.split('\n').filter(Boolean);
    assert.deepEqual([...new Set(probe)].sort(), ['aac', 'h264']);
    const text = readFileSync(playlist, 'utf8');
    assert.match(text, /#EXT-X-PLAYLIST-TYPE:VOD/); assert.match(text, /#EXT-X-ENDLIST/);
    assert.deepEqual(text.split('\n').filter(line => line.endsWith('.ts')), ['kit_000.ts']);
    assert.deepEqual(readdirSync(out).sort(), ['kit.m3u8', 'kit.m3u8.motion.json', 'kit_000.ts']);
  } finally { rmSync(out, {recursive: true, force: true}); }
});
