import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
// @ts-expect-error the renderer is plain ESM without types
import {probeMotionSoundDuration} from '../scripts/render.mjs';

const engine = resolve(import.meta.dirname, '..');

test('motion sound duration uses FFPROBE_PATH and rejects probe errors and invalid durations', {skip: process.platform === 'win32' ? 'probe fixtures require a POSIX shell' : false}, () => {
  const dir = mkdtempSync(join(tmpdir(), 'frameforge-probe-'));
  const oldProbe = process.env.FFPROBE_PATH, oldValue = process.env.FRAMEFORGE_TEST_PROBE_VALUE;
  const writeProbe = (name: string, body: string) => {
    const path = join(dir, name);
    writeFileSync(path, `#!/bin/sh\n${body}\n`);
    chmodSync(path, 0o755);
    return path;
  };
  try {
    process.env.FFPROBE_PATH = writeProbe('probe-value', 'printf "%s\\n" "$FRAMEFORGE_TEST_PROBE_VALUE"');
    process.env.FRAMEFORGE_TEST_PROBE_VALUE = '2.5';
    assert.equal(probeMotionSoundDuration('unused.wav'), 2.5);
    for (const value of ['', 'NaN', 'Infinity', '0', '-1', 'not-a-number']) {
      process.env.FRAMEFORGE_TEST_PROBE_VALUE = value;
      assert.throws(() => probeMotionSoundDuration('unused.wav'), /Invalid MotionSound duration/);
    }
    process.env.FFPROBE_PATH = writeProbe('probe-fails', 'printf "probe failed\\n" >&2; exit 7');
    assert.throws(() => probeMotionSoundDuration('unused.wav'), /Could not probe MotionSound duration.*probe failed/);
    process.env.FFPROBE_PATH = writeProbe('probe-diagnostic', 'printf "2.0\\n"; printf "decoder diagnostic\\n" >&2; exit 0');
    assert.throws(() => probeMotionSoundDuration('unused.wav'), /Could not probe MotionSound duration.*decoder diagnostic/);
    process.env.FFPROBE_PATH = join(dir, 'missing-probe');
    assert.throws(() => probeMotionSoundDuration('unused.wav'), /Could not probe MotionSound duration/);
  } finally {
    if (oldProbe === undefined) delete process.env.FFPROBE_PATH; else process.env.FFPROBE_PATH = oldProbe;
    if (oldValue === undefined) delete process.env.FRAMEFORGE_TEST_PROBE_VALUE; else process.env.FRAMEFORGE_TEST_PROBE_VALUE = oldValue;
    rmSync(dir, {recursive: true, force: true});
  }
});

test('motion sound probing rejects real damaged audio even when ffprobe returns a duration', () => {
  const dir = mkdtempSync(join(tmpdir(), 'frameforge-corrupt-audio-'));
  const oldProbe = process.env.FFPROBE_PATH;
  const normal = join(dir, 'normal.wav'), damaged = join(dir, 'damaged.wav');
  const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
  const ffprobe = oldProbe || 'ffprobe';
  try {
    const generated = spawnSync(ffmpeg, ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=2', '-c:a', 'pcm_s16le', normal], {encoding: 'utf8'});
    assert.equal(generated.status, 0, generated.stderr);
    process.env.FFPROBE_PATH = ffprobe;
    assert.ok(Math.abs(probeMotionSoundDuration(normal) - 2) < 0.001, 'valid PCM duration remains supported');

    // Keep the valid RIFF data and duration but corrupt its codec tag to AAC.
    const bytes = readFileSync(normal);
    const fmt = bytes.indexOf(Buffer.from('fmt '));
    assert.ok(fmt >= 0 && bytes.readUInt16LE(fmt + 8) === 1, 'expected PCM WAV format chunk');
    bytes.writeUInt16LE(0x00ff, fmt + 8);
    writeFileSync(damaged, bytes);
    const probe = spawnSync(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', damaged], {encoding: 'utf8'});
    assert.ok(probe.status !== 0 || probe.stderr.length > 0, 'damaged input must produce a probe diagnostic or failure');
    if (probe.status === 0) assert.ok(Number(probe.stdout.trim()) > 0, 'the exit-zero case may still advertise a positive duration');
    const decode = spawnSync(ffmpeg, ['-v', 'error', '-xerror', '-i', damaged, '-f', 'null', '-'], {encoding: 'utf8'});
    assert.notEqual(decode.status, 0, 'the corrupted WAV must not decode successfully');
    assert.throws(() => probeMotionSoundDuration(damaged), /Could not probe MotionSound duration/);
  } finally {
    if (oldProbe === undefined) delete process.env.FFPROBE_PATH; else process.env.FFPROBE_PATH = oldProbe;
    rmSync(dir, {recursive: true, force: true});
  }
});

test('custom probe preserves a motion cue tail beyond one second in a partial render', {timeout: 120000, skip: process.platform === 'win32' ? 'probe fixtures require a POSIX shell and a project symlink' : false}, () => {
  const dir = mkdtempSync(join(tmpdir(), 'frameforge-long-cue-'));
  const sounds = join(dir, 'public');
  const port = String(25000 + process.pid % 10000);
  const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
  const command = (program: string, args: string[], extra: Record<string, string> = {}) => {
    const result = spawnSync(program, args, {cwd: engine, env: {...process.env, FRAMEFORGE_PROJECT: dir, FRAMEFORGE_PORT: port, ...extra}, timeout: 90000, maxBuffer: 8 * 1024 * 1024});
    assert.equal(result.status, 0, `${program}: ${result.stderr?.toString()} ${result.error ?? ''}`);
    return result.stdout;
  };
  try {
  mkdirSync(sounds);
    writeFileSync(join(dir, 'frameforge.json'), JSON.stringify({engine, films: 'films'}));
    symlinkSync(join(engine, 'node_modules'), join(dir, 'node_modules'), 'dir');
    command(ffmpeg, ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=3', '-ac', '2', join(sounds, 'cue.wav')]);
    const entry = join(dir, 'entry.tsx');
    writeFileSync(entry, `
import {AbsoluteFill, Composition, MotionProbe, MotionSound, registerRoot, useCurrentFrame} from 'frameforge';
function Film() {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{background:'#333'}}>
    <MotionProbe id="test" value={Math.max(0,Math.min(1,(f-35)/10))} family="shape" axis="y" />
    <MotionSound src="/cue.wav" role="move" volume={0.8} />
  </AbsoluteFill>;
}
registerRoot(() => <Composition id="LongCue" component={Film} durationInFrames={150} fps={30} width={160} height={90} />);
`);
    const log = join(dir, 'probe-used');
    const wrapper = join(dir, 'probe-wrapper');
    writeFileSync(wrapper, '#!/bin/sh\nprintf "used\\n" >> "$FRAMEFORGE_TEST_PROBE_LOG"\nexec "$FRAMEFORGE_TEST_REAL_PROBE" "$@"\n');
    chmodSync(wrapper, 0o755);
    const out = join(dir, 'partial.mov');
    command(process.execPath, [join(engine, 'scripts/render.mjs'), entry, 'LongCue', out, '--audio-codec', 'pcm', '--frame-range', '30-105'], {FFPROBE_PATH: wrapper, FRAMEFORGE_TEST_PROBE_LOG: log, FRAMEFORGE_TEST_REAL_PROBE: process.env.FFPROBE_PATH || 'ffprobe'});
    assert.ok(existsSync(log), 'the configured FFPROBE_PATH must be invoked');
    const pcm = command(ffmpeg, ['-v', 'error', '-ss', '2', '-i', out, '-t', '0.15', '-f', 'f32le', '-ac', '1', '-ar', '48000', '-']);
    let sum = 0, count = 0;
    for (let i = 0; i + 4 <= pcm.length; i += 4) { sum += pcm.readFloatLE(i) ** 2; count++; }
    assert.ok(count > 0 && Math.sqrt(sum / count) > 0.005, 'cue must remain audible beyond one second');
    const forbiddenProbe = join(dir, 'forbidden-probe'), forbiddenLog = join(dir, 'forbidden-probe-used');
    writeFileSync(forbiddenProbe, '#!/bin/sh\nprintf "called\\n" >> "$FRAMEFORGE_TEST_FORBIDDEN_PROBE_LOG"\nexit 7\n');
    chmodSync(forbiddenProbe, 0o755);
    const silentOutputs = [
      {path: join(dir, 'muted.mp4'), flags: ['--muted'], sequence: false},
      {path: join(dir, 'no-audio.mp4'), flags: ['--audio-codec', 'none'], sequence: false},
      {path: join(dir, 'silent.gif'), flags: [], sequence: false},
      {path: `${join(dir, 'silent-png')}/`, flags: [], sequence: true},
    ];
    for (const {path, flags, sequence} of silentOutputs) {
      command(process.execPath, [join(engine, 'scripts/render.mjs'), entry, 'LongCue', path, '--frame-range', '30-55', ...flags], {FFPROBE_PATH: forbiddenProbe, FRAMEFORGE_TEST_FORBIDDEN_PROBE_LOG: forbiddenLog});
      const sidecar = JSON.parse(readFileSync(sequence ? join(path, 'motion.json') : `${path}.motion.json`, 'utf8')) as {from: number; to: number; samples: {frame: number}[]; sounds: unknown[]};
      assert.equal(sidecar.from, 30);
      assert.equal(sidecar.to, 55);
      assert.ok(sidecar.samples.length && sidecar.samples.every(sample => sample.frame >= 30 && sample.frame <= 55));
      assert.ok(sidecar.sounds.length, 'silent output retains motion evidence');
      if (sequence) {
        assert.ok(existsSync(join(path, '00030.png')) && existsSync(join(path, '00055.png')));
        assert.ok(!existsSync(join(path, '00029.png')) && !existsSync(join(path, '00056.png')));
      } else {
        const ffprobe = process.env.FFPROBE_PATH || 'ffprobe';
        const frames = command(ffprobe, ['-v', 'error', '-select_streams', 'v:0', '-count_frames', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', path]).toString().trim();
        assert.equal(Number(frames), 26, `${path} must retain the requested range`);
        const audio = command(ffprobe, ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=codec_name', '-of', 'csv=p=0', path]).toString().trim();
        assert.equal(audio, '', `${path} must be silent`);
      }
    }
    assert.equal(existsSync(forbiddenLog), false, 'silent outputs must not probe motion audio duration');
    for (const [name, body, message] of [
      ['bad-duration', 'printf "N/A\\n"', /Invalid MotionSound duration/],
      ['probe-error', 'printf "probe failed\\n" >&2; exit 7', /Could not probe MotionSound duration/],
      ['probe-diagnostic', 'printf "2.0\\n"; printf "decoder diagnostic\\n" >&2; exit 0', /Could not probe MotionSound duration.*decoder diagnostic/],
    ] as const) {
      const probe = join(dir, name), failed = join(dir, `${name}.mov`);
      writeFileSync(probe, `#!/bin/sh\n${body}\n`);
      chmodSync(probe, 0o755);
      const result = spawnSync(process.execPath, [join(engine, 'scripts/render.mjs'), entry, 'LongCue', failed, '--audio-codec', 'pcm', '--frame-range', '30-75'], {
        cwd: engine, env: {...process.env, FRAMEFORGE_PROJECT: dir, FRAMEFORGE_PORT: port, FFPROBE_PATH: probe}, encoding: 'utf8', timeout: 90000,
      });
      assert.notEqual(result.status, 0, `${name} unexpectedly succeeded`);
      assert.match(result.stderr, message);
      assert.equal(existsSync(failed), false, 'failed render must not publish a video');
    }
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});
