import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chmodSync, copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {basename, join, resolve} from 'node:path';
import test from 'node:test';

const engine = resolve(import.meta.dirname, '..');
const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
const ffprobe = process.env.FFPROBE_PATH || 'ffprobe';

// Nonperiodic, different left/right channels make frame shifts or channel
// swaps observable; PCM keeps the full-to-partial comparison meaningful.
function writeCue(path: string, rate = 48_000): void {
  const frames = rate * 3, bytes = Buffer.alloc(44 + frames * 4);
  bytes.write('RIFF', 0); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(2, 22);
  bytes.writeUInt32LE(rate, 24); bytes.writeUInt32LE(rate * 4, 28); bytes.writeUInt16LE(4, 32); bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36); bytes.writeUInt32LE(frames * 4, 40);
  let seed = 24031;
  for (let frame = 0; frame < frames; frame++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const left = frame % 9973 === 0 ? 30000 : Math.round(((seed >>> 16) - 32768) * 0.35);
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const right = frame % 10007 === 0 ? -27000 : Math.round(((seed >>> 16) - 32768) * 0.23);
    bytes.writeInt16LE(left, 44 + frame * 4); bytes.writeInt16LE(right, 46 + frame * 4);
  }
  writeFileSync(path, bytes);
}

type Command = {status: number | null; stdout: Buffer; stderr: string};
async function run(program: string, args: string[], env: NodeJS.ProcessEnv, timeout = 90_000): Promise<Command> {
  return await new Promise((done, fail) => {
    const child = spawn(program, args, {cwd: engine, env, stdio: ['ignore', 'pipe', 'pipe']});
    const out: Buffer[] = [], err: Buffer[] = [];
    const timer = setTimeout(() => { child.kill('SIGKILL'); }, timeout);
    child.stdout.on('data', chunk => out.push(Buffer.from(chunk)));
    child.stderr.on('data', chunk => err.push(Buffer.from(chunk)));
    child.once('error', error => { clearTimeout(timer); fail(error); });
    child.once('close', status => { clearTimeout(timer); done({status, stdout: Buffer.concat(out), stderr: Buffer.concat(err).toString('utf8')}); });
  });
}

test('explicit full-mix snapshot preserves an earlier audio tail without rendering outside the requested range', {
  timeout: 240_000,
  skip: process.platform === 'win32' ? 'snapshot containment and the media sentinel require POSIX openat and a shell wrapper' : false,
}, async () => {
  const scratch = mkdtempSync(join(tmpdir(), 'frameforge-snapshot-render-'));
  const project = join(scratch, 'project');
  const publicRoot = join(engine, 'public');
  const assets = mkdtempSync(join(publicRoot, 'snapshot-sentinel-'));
  const assetUrl = `/${basename(assets)}`;
  const sentinelVideo = join(assets, 'outside.mp4');
  const inRangeVideo = join(assets, 'inside.mp4');
  const cue = join(assets, 'cue.wav');
  const ffmpegLog = join(scratch, 'ffmpeg.log');
  const wrapper = join(scratch, 'ffmpeg-wrapper');
  let requests = 0;
  const server = createServer((_req, res) => { requests++; res.writeHead(204); res.end(); });
  await new Promise<void>((done, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', done); });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const port = String(28000 + process.pid % 10000);
  const env = {...process.env, FRAMEFORGE_PROJECT: project, FRAMEFORGE_PORT: port};
  const ok = async (program: string, args: string[], options: NodeJS.ProcessEnv = env): Promise<Buffer> => {
    const result = await run(program, args, options);
    assert.equal(result.status, 0, `${program}: ${result.stderr}`);
    return result.stdout;
  };
  try {
    mkdirSync(project);
    mkdirSync(join(project, 'public'));
    mkdirSync(join(project, 'snapshots'));
    writeFileSync(join(project, 'frameforge.json'), JSON.stringify({engine, films: 'films'}));
    symlinkSync(join(engine, 'node_modules'), join(project, 'node_modules'), 'dir');
    writeCue(cue);
    await ok(ffmpeg, ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=yellow:s=160x90:r=30', '-t', '1', '-pix_fmt', 'yuv420p', sentinelVideo]);
    await ok(ffmpeg, ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=orange:s=160x90:r=30', '-t', '3', '-pix_fmt', 'yuv420p', inRangeVideo]);
    writeFileSync(wrapper, '#!/bin/sh\nprintf "%s\\n" "$@" >> "$FRAMEFORGE_TEST_FFMPEG_LOG"\nexec "$FRAMEFORGE_TEST_REAL_FFMPEG" "$@"\n');
    chmodSync(wrapper, 0o755);
    const entry = join(project, 'entry.tsx');
    writeFileSync(entry, `
import {AbsoluteFill, Audio, Composition, Sequence, Video, registerRoot, useCurrentFrame} from 'frameforge';
function Film({sentinel = false}) {
  const frame = useCurrentFrame();
  if (sentinel && (frame < 31 || frame > 46)) {
    void fetch('http://127.0.0.1:${address.port}/outside?frame=' + frame, {mode: 'no-cors'}).catch(() => {});
    return <Video src="${assetUrl}/outside.mp4" muted />;
  }
  return <AbsoluteFill style={{background: frame % 2 ? '#1144bb' : '#16812b'}}>
    <Sequence from={10} durationInFrames={80}><Audio src="${assetUrl}/cue.wav" volume={0.8}/></Sequence>
    {sentinel && <Video src="${assetUrl}/inside.mp4" muted style={{position: 'absolute', right: 0, bottom: 0, width: 32, height: 18}} />}
  </AbsoluteFill>;
}
registerRoot(() => <Composition id="SnapshotFilm" component={Film} durationInFrames={90} fps={30} width={160} height={90}/>);
`);
    const render = async (output: string, props: string, flags: string[], overrides: NodeJS.ProcessEnv = {}): Promise<Command> =>
      await run(process.execPath, [join(engine, 'scripts/render.mjs'), entry, 'SnapshotFilm', output, props, ...flags], {...env, ...overrides});
    const full = join(project, 'full.mov');
    const baseline = await render(full, '{}', ['--audio-codec', 'pcm']);
    assert.equal(baseline.status, 0, baseline.stderr);
    const snapshot = join(project, 'snapshots', 'full.wav');
    await ok(ffmpeg, ['-v', 'error', '-i', full, '-map', '0:a:0', '-c:a', 'pcm_s16le', '-ar', '48000', '-ac', '2', snapshot]);
    const sha256 = createHash('sha256').update(readFileSync(snapshot)).digest('hex');
    const manifest = {version: 1, composition: 'SnapshotFilm', fps: 30, durationInFrames: 90, sha256};
    const manifestFile = join(project, 'snapshots', 'full.json');
    writeFileSync(manifestFile, JSON.stringify(manifest));
    // These invalid specs would fail or generate assets if snapshot mode invoked
    // the ordinary audio, voice, or art preflight.
    for (const name of ['audio.json', 'narration.json', 'assets.json']) writeFileSync(join(project, name), 'not JSON');

    writeFileSync(ffmpegLog, '');
    const partial = join(project, 'partial.mov');
    const flags = ['--frame-range', '31-46', '--audio-snapshot', 'snapshots/full.wav', '--audio-snapshot-manifest', 'snapshots/full.json', '--audio-codec', 'pcm'];
    const result = await render(partial, '{"sentinel":true}', flags, {FFMPEG_PATH: wrapper, FRAMEFORGE_TEST_FFMPEG_LOG: ffmpegLog, FRAMEFORGE_TEST_REAL_FFMPEG: ffmpeg});
    assert.equal(result.status, 0, result.stderr);
    assert.equal(requests, 0, 'out-of-range user fetch must not execute');
    assert.ok(!readFileSync(ffmpegLog, 'utf8').includes(sentinelVideo), 'out-of-range video must not be decoded');
    assert.ok(readFileSync(ffmpegLog, 'utf8').includes(inRangeVideo), 'the in-range video is still decoded');
    const videoCount = await ok(ffprobe, ['-v', 'error', '-select_streams', 'v:0', '-count_frames', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', partial]);
    assert.equal(Number(videoCount.toString().trim()), 16);
    const rgb = await ok(ffmpeg, ['-v', 'error', '-i', partial, '-an', '-vf', 'scale=1:1', '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-']);
    assert.equal(rgb.length, 16 * 3);
    assert.ok(rgb[2]! > rgb[0]! && rgb[2]! > rgb[1]!, 'frame 31 is the in-range blue visual');
    assert.ok(rgb[46]! > rgb[45]! && rgb[46]! > rgb[47]!, 'frame 46 is the in-range green visual');

    const raw = async (file: string, seek?: string): Promise<Buffer> => await ok(ffmpeg, ['-v', 'error', ...(seek ? ['-ss', seek] : []), '-i', file, '-t', (16 / 30).toFixed(6), '-vn', '-f', 'f32le', '-ac', '2', '-ar', '48000', '-']);
    const expected = await raw(snapshot, (31 / 30).toFixed(9));
    const actual = await raw(partial);
    const expectedBytes = 16 * 1600 * 2 * 4;
    assert.equal(expected.length, expectedBytes, 'the reference is exactly 16 frames of stereo PCM');
    assert.equal(actual.length, expectedBytes, 'the output has the complete requested audio interval');
    const streams = JSON.parse((await ok(ffprobe, ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=sample_rate,channels', '-of', 'json', partial])).toString()) as {streams: {sample_rate: string; channels: number}[]};
    assert.equal(Number(streams.streams[0]?.sample_rate), 48_000);
    assert.equal(streams.streams[0]?.channels, 2);
    const sampleFrames = expected.length / 8;
    let power = 0, startPower = 0, endPower = 0, actualStartPower = 0, actualEndPower = 0;
    for (let frame = 0; frame < sampleFrames; frame++) for (let channel = 0; channel < 2; channel++) {
      const x = expected.readFloatLE((frame * 2 + channel) * 4);
      const y = actual.readFloatLE((frame * 2 + channel) * 4);
      power += x * x;
      if (frame < 100) { startPower += x * x; actualStartPower += y * y; }
      if (frame >= sampleFrames - 100) { endPower += x * x; actualEndPower += y * y; }
    }
    assert.ok(Math.sqrt(power / (sampleFrames * 2)) > 0.005 && startPower > 0.001 && endPower > 0.001, 'the earlier cue spans both reference boundaries');
    assert.ok(actualStartPower > 0.001 && actualEndPower > 0.001, 'the actual output retains sound at both boundaries');
    const errors = [-1, 0, 1].map(shift => {
      const sums = [0, 0, 0], counts = [0, 0, 0];
      for (let frame = 0; frame < sampleFrames; frame++) {
        const target = frame + shift;
        if (target < 0 || target >= sampleFrames) continue;
        for (let channel = 0; channel < 2; channel++) {
          const x = expected.readFloatLE((frame * 2 + channel) * 4), y = actual.readFloatLE((target * 2 + channel) * 4);
          const error = (x - y) ** 2;
          sums[0]! += error; counts[0]!++;
          if (frame < 100) { sums[1]! += error; counts[1]!++; }
          if (frame >= sampleFrames - 100) { sums[2]! += error; counts[2]!++; }
        }
      }
      return sums.map((sum, index) => Math.sqrt(sum / counts[index]!));
    });
    assert.ok(errors.some(error => error.every(value => value < 0.001)), `stereo PCM mismatch (whole/start/end RMS at shifts -1, 0, +1): ${JSON.stringify(errors)}`);

    const piped = join(project, 'partial-pipe.mov');
    const pipeResult = await render(piped, '{"sentinel":true}', [...flags, '--pipe'], {FFMPEG_PATH: wrapper, FRAMEFORGE_TEST_FFMPEG_LOG: ffmpegLog, FRAMEFORGE_TEST_REAL_FFMPEG: ffmpeg});
    assert.equal(pipeResult.status, 0, `snapshot --pipe: ${pipeResult.stderr}`);
    const pipeFrames = await ok(ffprobe, ['-v', 'error', '-select_streams', 'v:0', '-count_frames', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', piped]);
    assert.equal(Number(pipeFrames.toString().trim()), 16);
    assert.deepEqual(await raw(piped), actual, 'pipe output preserves the same complete PCM interval');
    assert.equal(requests, 0, 'pipe rendering must not evaluate the out-of-range fetch');
    assert.ok(!readFileSync(ffmpegLog, 'utf8').includes(sentinelVideo), 'pipe rendering must not decode the out-of-range video');

    const output = result.stdout.toString('utf8');
    const resultStart = output.lastIndexOf('\n{\n');
    assert.ok(resultStart >= 0, 'render returns a structured result');
    const info = JSON.parse(output.slice(resultStart)) as {audioSnapshot?: {source?: string; sha256?: string; composition?: string; fps?: number; durationInFrames?: number; from?: number; to?: number; semanticMatch?: string}};
    assert.equal(info.audioSnapshot?.sha256, sha256, 'result identifies the selected snapshot bytes');
    assert.equal(info.audioSnapshot?.source, 'snapshots/full.wav');
    assert.equal(info.audioSnapshot?.composition, 'SnapshotFilm');
    assert.equal(info.audioSnapshot?.fps, 30);
    assert.equal(info.audioSnapshot?.durationInFrames, 90);
    assert.equal(info.audioSnapshot?.from, 31);
    assert.equal(info.audioSnapshot?.to, 46);
    assert.equal(info.audioSnapshot?.semanticMatch, 'NOT_VERIFIED');
    const sidecar = JSON.parse(readFileSync(`${partial}.motion.json`, 'utf8')) as {composition: string; fps: number; from: number; to: number; audioSnapshot?: {source: string; sha256: string; from: number; to: number; semanticMatch: string}};
    assert.equal(sidecar.composition, 'SnapshotFilm');
    assert.equal(sidecar.fps, 30);
    assert.deepEqual([sidecar.from, sidecar.to], [31, 46]);
    assert.deepEqual(sidecar.audioSnapshot, {source: 'snapshots/full.wav', sha256, from: 31, to: 46, semanticMatch: 'NOT_VERIFIED'});

    const snapshots = join(project, 'snapshots');
    // Keep ffprobe's observed duration exactly three seconds while ending a
    // declared PCM data chunk with an incomplete sample. Probe accepts it;
    // decoding the final interval must report the corrupted packet.
    const truncated = join(snapshots, 'truncated.wav');
    writeCue(truncated);
    const valid = readFileSync(truncated);
    valid.writeUInt32LE(valid.readUInt32LE(4) + 4, 4);
    valid.writeUInt32LE(valid.readUInt32LE(40) + 4, 40);
    const broken = Buffer.concat([valid, Buffer.from([0])]);
    writeFileSync(truncated, broken);
    const truncatedSha = createHash('sha256').update(broken).digest('hex');
    writeFileSync(join(snapshots, 'truncated.json'), JSON.stringify({...manifest, sha256: truncatedSha}));
    const probed = await ok(ffprobe, ['-v', 'error', '-f', 'wav', '-show_entries', 'format=duration', '-of', 'csv=p=0', truncated]);
    assert.equal(Number(probed.toString().trim()), 3, 'probe alone accepts the truncated WAV duration');
    const badOutput = join(project, 'truncated.mov');
    const corruptResult = await render(badOutput, '{}', ['--frame-range', '80-89', '--audio-snapshot', 'snapshots/truncated.wav', '--audio-snapshot-manifest', 'snapshots/truncated.json', '--audio-codec', 'pcm']);
    assert.notEqual(corruptResult.status, 0, 'ffmpeg must reject the damaged final PCM packet');
    assert.match(corruptResult.stderr, /corrupt|invalid|error/i);
    assert.ok(!existsSync(badOutput), 'a damaged snapshot must not publish a video');
    assert.ok(!readdirSync(project).some(name => name.startsWith('.frameforge-')), 'failed mux removes its staging directory');

    const diagnosticWrapper = join(scratch, 'ffmpeg-diagnostic');
    writeFileSync(diagnosticWrapper, '#!/bin/sh\ncase " $* " in *" /dev/fd/3 "*) printf "synthetic decoder error\\n" >&2; exit 0;; esac\nexec "$FRAMEFORGE_TEST_REAL_FFMPEG" "$@"\n');
    chmodSync(diagnosticWrapper, 0o755);
    const diagnosticOutput = join(project, 'diagnostic.mov');
    const diagnostic = await render(diagnosticOutput, '{}', flags, {FFMPEG_PATH: diagnosticWrapper, FRAMEFORGE_TEST_REAL_FFMPEG: ffmpeg});
    assert.notEqual(diagnostic.status, 0, 'a successful exit with an error diagnostic must fail');
    assert.match(diagnostic.stderr, /synthetic decoder error/);
    assert.ok(!existsSync(diagnosticOutput), 'a diagnostic must not publish a video');
    assert.ok(!readdirSync(project).some(name => name.startsWith('.frameforge-')), 'diagnostic failure removes its staging directory');
    const damaged = join(snapshots, 'damaged.wav');
    writeFileSync(damaged, 'not a WAV file');
    const damagedSha = createHash('sha256').update(readFileSync(damaged)).digest('hex');
    for (const [name, value] of [
      ['hash', {...manifest, sha256: '0'.repeat(64)}],
      ['composition', {...manifest, composition: 'WrongFilm'}],
      ['fps', {...manifest, fps: 24}],
      ['duration', {...manifest, durationInFrames: 80}],
      ['damaged', {...manifest, sha256: damagedSha}],
    ] as const) writeFileSync(join(snapshots, `${name}.json`), JSON.stringify(value));
    writeFileSync(join(snapshots, 'invalid.json'), '{');
    const outside = join(scratch, 'outside.wav');
    const outsideManifest = join(scratch, 'outside.json');
    copyFileSync(snapshot, outside);
    copyFileSync(manifestFile, outsideManifest);
    symlinkSync(outside, join(snapshots, 'link.wav'));
    symlinkSync(outsideManifest, join(snapshots, 'link.json'));
    const attempts: {name: string; flags: string[]; suffix?: string}[] = [
      {name: 'missing-manifest', flags: ['--frame-range', '30-45', '--audio-snapshot', 'snapshots/full.wav']},
      {name: 'missing-wav', flags: ['--frame-range', '30-45', '--audio-snapshot', 'snapshots/missing.wav', '--audio-snapshot-manifest', 'snapshots/full.json']},
      {name: 'absolute-outside', flags: ['--frame-range', '30-45', '--audio-snapshot', outside, '--audio-snapshot-manifest', 'snapshots/full.json']},
      {name: 'traversal', flags: ['--frame-range', '30-45', '--audio-snapshot', '../outside.wav', '--audio-snapshot-manifest', 'snapshots/full.json']},
      {name: 'wav-symlink', flags: ['--frame-range', '30-45', '--audio-snapshot', 'snapshots/link.wav', '--audio-snapshot-manifest', 'snapshots/full.json']},
      {name: 'manifest-symlink', flags: ['--frame-range', '30-45', '--audio-snapshot', 'snapshots/full.wav', '--audio-snapshot-manifest', 'snapshots/link.json']},
      {name: 'invalid-json', flags: ['--frame-range', '30-45', '--audio-snapshot', 'snapshots/full.wav', '--audio-snapshot-manifest', 'snapshots/invalid.json']},
      {name: 'bad-hash', flags: ['--frame-range', '30-45', '--audio-snapshot', 'snapshots/full.wav', '--audio-snapshot-manifest', 'snapshots/hash.json']},
      {name: 'bad-composition', flags: ['--frame-range', '30-45', '--audio-snapshot', 'snapshots/full.wav', '--audio-snapshot-manifest', 'snapshots/composition.json']},
      {name: 'bad-fps', flags: ['--frame-range', '30-45', '--audio-snapshot', 'snapshots/full.wav', '--audio-snapshot-manifest', 'snapshots/fps.json']},
      {name: 'bad-duration', flags: ['--frame-range', '30-45', '--audio-snapshot', 'snapshots/full.wav', '--audio-snapshot-manifest', 'snapshots/duration.json']},
      {name: 'bad-wav', flags: ['--frame-range', '30-45', '--audio-snapshot', 'snapshots/damaged.wav', '--audio-snapshot-manifest', 'snapshots/damaged.json']},
      {name: 'muted', flags: [...flags, '--muted']},
      {name: 'no-audio', flags: ['--frame-range', '30-45', '--audio-snapshot', 'snapshots/full.wav', '--audio-snapshot-manifest', 'snapshots/full.json', '--audio-codec', 'none']},
      {name: 'gif', suffix: '.gif', flags: ['--frame-range', '30-45', '--audio-snapshot', 'snapshots/full.wav', '--audio-snapshot-manifest', 'snapshots/full.json']},
      {name: 'png-sequence', suffix: '/', flags: ['--frame-range', '30-45', '--audio-snapshot', 'snapshots/full.wav', '--audio-snapshot-manifest', 'snapshots/full.json']},
      {name: 'contact-sheet', suffix: '.png', flags: ['--frames', '30,45', '--audio-snapshot', 'snapshots/full.wav', '--audio-snapshot-manifest', 'snapshots/full.json']},
      {name: 'full-range', flags: ['--frame-range', '0-89', '--audio-snapshot', 'snapshots/full.wav', '--audio-snapshot-manifest', 'snapshots/full.json']},
      {name: 'no-range', flags: ['--audio-snapshot', 'snapshots/full.wav', '--audio-snapshot-manifest', 'snapshots/full.json']},
    ];
    for (const attempt of attempts) {
      const out = join(project, `invalid-${attempt.name}`) + (attempt.suffix ?? '.mov');
      const failed = await render(out, '{"sentinel":true}', attempt.flags, {FFMPEG_PATH: wrapper, FRAMEFORGE_TEST_FFMPEG_LOG: ffmpegLog, FRAMEFORGE_TEST_REAL_FFMPEG: ffmpeg});
      assert.notEqual(failed.status, 0, `${attempt.name} must not fall back to ordinary rendering`);
      assert.ok(!existsSync(out), `${attempt.name} must not publish a video`);
      assert.equal(requests, 0, `${attempt.name} must not trigger out-of-range network access`);
      assert.ok(!readFileSync(ffmpegLog, 'utf8').includes(sentinelVideo), `${attempt.name} must not decode the out-of-range file`);
    }
  } finally {
    await new Promise<void>(done => server.close(() => done()));
    rmSync(assets, {recursive: true, force: true});
    rmSync(scratch, {recursive: true, force: true});
  }
});

test('44.1 kHz snapshot trims a fractional 29.97 fps start and resamples to 48 kHz', {
  timeout: 180_000,
  skip: process.platform === 'win32' ? 'snapshot containment requires POSIX openat' : false,
}, async () => {
  const scratch = mkdtempSync(join(tmpdir(), 'frameforge-snapshot-fraction-'));
  const project = join(scratch, 'project');
  const assets = mkdtempSync(join(engine, 'public', 'snapshot-fraction-'));
  const assetUrl = `/${basename(assets)}`;
  const env = {...process.env, FRAMEFORGE_PROJECT: project, FRAMEFORGE_PORT: String(38000 + process.pid % 10000)};
  const ok = async (program: string, args: string[]): Promise<Buffer> => {
    const result = await run(program, args, env);
    assert.equal(result.status, 0, `${program}: ${result.stderr}`);
    return result.stdout;
  };
  try {
    mkdirSync(project);
    mkdirSync(join(project, 'public'));
    mkdirSync(join(project, 'snapshots'));
    writeFileSync(join(project, 'frameforge.json'), JSON.stringify({engine, films: 'films'}));
    symlinkSync(join(engine, 'node_modules'), join(project, 'node_modules'), 'dir');
    writeCue(join(assets, 'cue.wav'), 44_100);
    const entry = join(project, 'entry.tsx');
    writeFileSync(entry, `
import {AbsoluteFill, Audio, Composition, Sequence, registerRoot, useCurrentFrame} from 'frameforge';
function Film() {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{background: frame % 2 ? '#1144bb' : '#16812b'}}>
    <Sequence from={10} durationInFrames={80}><Audio src="${assetUrl}/cue.wav" volume={0.8}/></Sequence>
  </AbsoluteFill>;
}
registerRoot(() => <Composition id="FractionFilm" component={Film} durationInFrames={90} fps={29.97} width={160} height={90}/>);
`);
    const renderInfo = (output: Buffer): {audioContext?: unknown} => {
      const text = output.toString('utf8');
      const start = text.lastIndexOf('\n{\n');
      assert.ok(start >= 0, 'render returns a structured result');
      return JSON.parse(text.slice(start)) as {audioContext?: unknown};
    };
    const full = join(project, 'full.mov');
    const fullInfo = renderInfo(await ok(process.execPath, [join(engine, 'scripts/render.mjs'), entry, 'FractionFilm', full, '{}', '--audio-codec', 'pcm']));
    assert.equal(fullInfo.audioContext, undefined);
    assert.equal(JSON.parse(readFileSync(`${full}.motion.json`, 'utf8')).audioContext, undefined);
    const snapshot = join(project, 'snapshots', 'full.wav');
    await ok(ffmpeg, ['-v', 'error', '-i', full, '-map', '0:a:0', '-c:a', 'pcm_s16le', '-ar', '44100', '-ac', '2', snapshot]);
    const sha256 = createHash('sha256').update(readFileSync(snapshot)).digest('hex');
    writeFileSync(join(project, 'snapshots', 'full.json'), JSON.stringify({version: 1, composition: 'FractionFilm', fps: 29.97, durationInFrames: 90, sha256}));
    const snapshotStreams = JSON.parse((await ok(ffprobe, ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=sample_rate,channels', '-of', 'json', snapshot])).toString()) as {streams: {sample_rate: string; channels: number}[]};
    assert.deepEqual(snapshotStreams.streams[0], {sample_rate: '44100', channels: 2});
    const partial = join(project, 'partial.mov');
    const snapshotInfo = renderInfo(await ok(process.execPath, [join(engine, 'scripts/render.mjs'), entry, 'FractionFilm', partial, '{}', '--frame-range', '31-46', '--audio-snapshot', 'snapshots/full.wav', '--audio-snapshot-manifest', 'snapshots/full.json', '--audio-codec', 'pcm']));
    assert.equal(snapshotInfo.audioContext, undefined);
    assert.equal(JSON.parse(readFileSync(`${partial}.motion.json`, 'utf8')).audioContext, undefined);
    const regular = join(project, 'regular-partial.mov');
    const regularInfo = renderInfo(await ok(process.execPath, [join(engine, 'scripts/render.mjs'), entry, 'FractionFilm', regular, '{}', '--frame-range', '31-46', '--audio-codec', 'pcm']));
    const expectedContext = {status: 'NOT_VERIFIED', reason: 'Partial render does not analyze frames outside the selected range.'};
    assert.deepEqual(regularInfo.audioContext, expectedContext);
    assert.deepEqual(JSON.parse(readFileSync(`${regular}.motion.json`, 'utf8')).audioContext, expectedContext);
    const streams = JSON.parse((await ok(ffprobe, ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=sample_rate,channels', '-of', 'json', partial])).toString()) as {streams: {sample_rate: string; channels: number}[]};
    assert.deepEqual(streams.streams[0], {sample_rate: '48000', channels: 2});
    const samples = await ok(ffmpeg, ['-v', 'error', '-i', partial, '-vn', '-f', 'f32le', '-ac', '2', '-ar', '48000', '-']);
    // This duration is 25625.6256 output samples. A whole-sample container
    // must round by <1 sample; it may not truncate any larger interval.
    const desiredSamples = 16 * 48_000 / 29.97;
    const actualFrames = samples.length / 8;
    assert.ok(Number.isInteger(actualFrames) && Math.abs(actualFrames - desiredSamples) < 1, `duration: expected ${desiredSamples} samples, got ${actualFrames}`);
    // Choose the nearest input sample to 31/29.97 seconds independently of
    // ffmpeg's seek, then resample the complete tail. Input quantization is at
    // most half a 44.1 kHz sample; allow one 48 kHz sample for seeking and
    // resampler rounding. The distinct nonperiodic channels expose swaps and
    // even small shifts; inspect both ends as well as the complete interval.
    const first = Math.round(31 * 44_100 / 29.97);
    const reference = await ok(ffmpeg, ['-v', 'error', '-i', snapshot, '-af', `atrim=start_sample=${first},asetpts=PTS-STARTPTS,aresample=48000`, '-f', 'f32le', '-ac', '2', '-ar', '48000', '-']);
    assert.ok(reference.length >= samples.length + 16);
    const errors = [-1, 0, 1].map(shift => {
      const sums = [0, 0, 0], counts = [0, 0, 0];
      for (let frame = 1; frame < actualFrames - 1; frame++) for (let channel = 0; channel < 2; channel++) {
        const x = reference.readFloatLE(((frame + shift) * 2 + channel) * 4);
        const y = samples.readFloatLE((frame * 2 + channel) * 4);
        const error = (x - y) ** 2;
        sums[0]! += error; counts[0]!++;
        if (frame < 101) { sums[1]! += error; counts[1]!++; }
        if (frame >= actualFrames - 101) { sums[2]! += error; counts[2]!++; }
      }
      return sums.map((sum, i) => Math.sqrt(sum / counts[i]!));
    });
    assert.ok(errors.some(error => error.every(value => value < 0.001)), `stereo PCM mismatch (whole/start/end RMS at shifts -1, 0, +1): ${JSON.stringify(errors)}`);
  } finally {
    rmSync(assets, {recursive: true, force: true});
    rmSync(scratch, {recursive: true, force: true});
  }
});
