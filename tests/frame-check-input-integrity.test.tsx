import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';

const engine = resolve(import.meta.dirname, '..');

test('frame-check validates its time inputs and rejects a partially decoded video', {timeout: 60000}, () => {
  const dir = mkdtempSync(join(tmpdir(), 'frameforge-frame-input-'));
  const moving = join(dir, 'moving.mp4');
  const still = join(dir, 'still.mp4');
  const shortStill = join(dir, 'short-still.mp4');
  const oneFrame = join(dir, 'one-frame.mp4');
  const justOverSecond = join(dir, 'thirty-one-frames.mp4');
  const twoFrames30 = join(dir, 'two-frames-30fps.mp4');
  const twoFrames60 = join(dir, 'two-frames-60fps.mp4');
  const threeFrames60 = join(dir, 'three-frames-60fps.mp4');
  const sixtyTwoFrames60 = join(dir, 'sixty-two-frames-60fps.mp4');
  const slowMoving = join(dir, 'slow-moving.mp4');
  const slowStill = join(dir, 'slow-still.mp4');
  const oneFpsMoving = join(dir, 'one-fps-moving.mp4');
  const damaged = join(dir, 'damaged.mp4');
  const matroska = join(dir, 'moving.mkv');
  const damagedMatroska = join(dir, 'damaged.mkv');
  const encode = (filter: string, seconds: string, out: string) => {
    const result = spawnSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', filter, '-t', seconds, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-y', out], {encoding: 'utf8'});
    assert.equal(result.status, 0, result.stderr);
  };
  const check = (file: string, ...args: string[]) => spawnSync(process.execPath, [join(engine, 'scripts/frame-check.mjs'), file, ...args, '--json'], {cwd: engine, encoding: 'utf8'});
  const report = (stdout: string) => JSON.parse(stdout) as {frames: number; fps: number; hold: number; motionShare: number; endMotionShare: number; endChecked: boolean; pass: boolean; fails: string[]};
  try {
    encode('testsrc2=size=320x180:rate=30', '6', moving);
    encode('color=c=black:s=320x180:r=30', '5', still);
    encode('color=c=black:s=320x180:r=30', '0.5', shortStill);
    encode('color=c=black:s=320x180:r=30', '0.033333333', oneFrame);
    encode('color=c=black:s=320x180:r=30', '1.033333333', justOverSecond);
    encode('color=c=black:s=320x180:r=30', '0.066666667', twoFrames30);
    encode('color=c=black:s=320x180:r=60', '0.033333333', twoFrames60);
    encode('color=c=black:s=320x180:r=60', '0.05', threeFrames60);
    encode('color=c=black:s=320x180:r=60', '1.033333333', sixtyTwoFrames60);
    encode('testsrc2=size=320x180:rate=1/10', '20', slowMoving);
    encode('color=c=black:s=320x180:r=1/10', '20', slowStill);
    encode('testsrc2=size=320x180:rate=1', '5', oneFpsMoving);

    for (const file of [slowMoving, slowStill]) {
      const slow = check(file);
      assert.notEqual(slow.status, 0, 'under 1 fps cannot support a reliable two-second end-motion check');
      assert.match(slow.stderr, /fps.*at least 1/i);
      assert.doesNotMatch(slow.stdout, /"pass"\s*:\s*true/);
      const overridden = check(file, '--fps', '30');
      assert.notEqual(overridden.status, 0, 'a higher analysis fps cannot make a sub-1 fps source reliable');
      assert.match(overridden.stderr, /fps.*at least 1/i);
    }
    const oneFps = check(oneFpsMoving);
    assert.equal(oneFps.status, 0, oneFps.stderr);
    assert.equal(report(oneFps.stdout).frames, 5);
    assert.equal(report(oneFps.stdout).fps, 1);
    assert.equal(report(oneFps.stdout).endChecked, true);
    assert.ok(report(oneFps.stdout).endMotionShare > 0, 'the 1 fps boundary still measures end motion');
    assert.ok(!report(oneFps.stdout).fails.some(item => item.startsWith('end hold:')));

    const normal = check(moving);
    assert.equal(normal.status, 0, normal.stderr);
    assert.equal(report(normal.stdout).frames, 180);
    assert.equal(report(normal.stdout).fps, 30);
    assert.equal(report(normal.stdout).hold, 30);
    assert.equal(report(normal.stdout).pass, true);
    const fractionalFps = check(moving, '--fps', '29.97');
    assert.equal(fractionalFps.status, 0, fractionalFps.stderr);
    assert.equal(report(fractionalFps.stdout).fps, 29.97);

    const stationary = check(still);
    assert.notEqual(stationary.status, 0, 'a black still must not pass as a normal film');
    assert.equal(report(stationary.stdout).frames, 150);
    assert.equal(report(stationary.stdout).pass, false);

    // A valid declared reading hold remains supported and is excluded only
    // from the body checks; it does not erase the remaining 60-frame body.
    const declared = check(still, '--hold', '90');
    assert.equal(report(declared.stdout).hold, 90);
    assert.equal(report(declared.stdout).pass, false);
    assert.ok(report(declared.stdout).fails.some(item => /empty|frozen|featureless/.test(item)));

    // The default one-second hold cannot consume the whole shorter film.
    const short = check(shortStill);
    assert.equal(report(short.stdout).frames, 15);
    assert.equal(report(short.stdout).hold, 0);
    assert.equal(report(short.stdout).pass, false);
    assert.ok(report(short.stdout).motionShare < 0.2, 'the static short film was actually measured');
    const oneFramePastHold = check(justOverSecond);
    assert.equal(report(oneFramePastHold.stdout).frames, 31);
    assert.equal(report(oneFramePastHold.stdout).hold, 0, 'default 30-frame hold would leave only one body frame');
    assert.equal(report(oneFramePastHold.stdout).pass, false);
    assert.ok(report(oneFramePastHold.stdout).motionShare < 0.2);

    // Two body frames are the minimum needed for an actual frame comparison.
    const twoBodyFrames = check(still, '--hold', '148');
    assert.equal(report(twoBodyFrames.stdout).frames, 150);
    assert.equal(report(twoBodyFrames.stdout).hold, 148);
    assert.ok(Number.isFinite(report(twoBodyFrames.stdout).motionShare));
    const singleFrame = check(oneFrame);
    assert.notEqual(singleFrame.status, 0, 'a single-frame video cannot support motion comparison');
    assert.match(singleFrame.stderr, /frame|motion/i);
    assert.doesNotMatch(singleFrame.stdout, /"pass"\s*:\s*true/);

    // The per-step comparison is one frame at 30 fps and two at 60 fps.
    // Initial frames without a predecessor cannot count as motion evidence.
    const two30 = check(twoFrames30, '--hold', '0');
    assert.equal(report(two30.stdout).frames, 2);
    assert.equal(report(two30.stdout).motionShare, 0);
    const two60 = check(twoFrames60, '--hold', '0');
    assert.notEqual(two60.status, 0, 'two frames at 60 fps lack a two-frame predecessor');
    assert.match(two60.stderr, /frame|motion/i);
    assert.doesNotMatch(two60.stdout, /"pass"\s*:\s*true/);
    const three60 = check(threeFrames60, '--hold', '0');
    assert.equal(report(three60.stdout).frames, 3);
    assert.equal(report(three60.stdout).motionShare, 0);
    const held60 = check(threeFrames60, '--hold', '1');
    assert.notEqual(held60.status, 0, 'a hold must not leave only two frames at 60 fps');
    assert.match(held60.stderr, /hold/i);
    assert.doesNotMatch(held60.stdout, /"pass"\s*:\s*true/);
    const defaultHold60 = check(sixtyTwoFrames60);
    assert.equal(report(defaultHold60.stdout).frames, 62);
    assert.equal(report(defaultHold60.stdout).hold, 0, 'the default 60-frame hold would leave too few frames');
    assert.equal(report(defaultHold60.stdout).motionShare, 0);

    for (const fps of ['0', '0.1', '0.999', '-1', 'NaN', 'Infinity', 'nope', '', '   ']) {
      const invalid = check(moving, '--fps', fps);
      assert.notEqual(invalid.status, 0, `accepted invalid fps ${JSON.stringify(fps)}`);
      assert.match(invalid.stderr, /fps/i);
      assert.doesNotMatch(invalid.stdout, /"pass"\s*:\s*true/);
    }
    // A hold equal to the decoded length also leaves no measurable body.
    for (const hold of ['-1', '1.5', 'NaN', 'Infinity', 'nope', '', '   ', '149', '150', '151', '9999']) {
      const invalid = check(still, '--hold', hold);
      assert.notEqual(invalid.status, 0, `accepted invalid hold ${JSON.stringify(hold)}`);
      assert.match(invalid.stderr, /hold/i);
      assert.doesNotMatch(invalid.stdout, /"pass"\s*:\s*true/);
    }
    for (const flag of ['--fps', '--hold']) {
      const missing = check(moving, flag);
      assert.notEqual(missing.status, 0, `accepted ${flag} without a value`);
      assert.match(missing.stderr, new RegExp(flag.slice(2)));
      assert.doesNotMatch(missing.stdout, /"pass"\s*:\s*true/);
    }

    // faststart puts the index first: the truncated file is probeable and
    // decodes a nonempty prefix, but must never pass as a complete video.
    const bytes = readFileSync(moving);
    writeFileSync(damaged, bytes.subarray(0, Math.floor(bytes.length * 0.72)));
    const probe = spawnSync('ffprobe', ['-v', 'quiet', '-select_streams', 'v:0', '-count_frames', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', damaged], {encoding: 'utf8'});
    const decoded = Number(probe.stdout.trim());
    assert.ok(decoded > 0 && decoded < 180, `fixture must retain only a prefix: ${probe.stdout} ${probe.stderr}`);
    const broken = check(damaged);
    assert.notEqual(broken.status, 0, 'a partially decoded file cannot pass');
    assert.doesNotMatch(broken.stdout, /"pass"\s*:\s*true/);
    assert.match(broken.stderr, /decode|ffmpeg|partial|invalid|error/i);

    // Some demuxers report truncation at error log level yet exit zero even
    // with -xerror. Do not mistake a decoded prefix for a complete film.
    const remux = spawnSync('ffmpeg', ['-v', 'error', '-i', moving, '-c', 'copy', '-y', matroska], {encoding: 'utf8'});
    assert.equal(remux.status, 0, remux.stderr);
    const validMkv = check(matroska);
    assert.equal(validMkv.status, 0, validMkv.stderr);
    assert.equal(report(validMkv.stdout).frames, 180);
    assert.equal(report(validMkv.stdout).pass, true);
    const mkvBytes = readFileSync(matroska);
    writeFileSync(damagedMatroska, mkvBytes.subarray(0, Math.floor(mkvBytes.length * 0.72)));
    const diagnostic = spawnSync('ffmpeg', ['-v', 'error', '-xerror', '-i', damagedMatroska, '-f', 'null', '-'], {encoding: 'utf8'});
    assert.equal(diagnostic.status, 0, `fixture must reproduce a successful exit: ${diagnostic.stderr}`);
    assert.match(diagnostic.stderr, /file ended prematurely/i);
    const mkvProbe = spawnSync('ffprobe', ['-v', 'quiet', '-select_streams', 'v:0', '-count_frames', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', damagedMatroska], {encoding: 'utf8'});
    const mkvDecoded = Number(mkvProbe.stdout.trim());
    assert.ok(mkvDecoded > 0 && mkvDecoded < 180, `fixture must retain only a prefix: ${mkvProbe.stdout} ${mkvProbe.stderr}`);
    const brokenMkv = check(damagedMatroska);
    assert.notEqual(brokenMkv.status, 0, 'a demuxer error cannot pass even when ffmpeg exits zero');
    assert.doesNotMatch(brokenMkv.stdout, /"pass"\s*:\s*true/);
    assert.match(brokenMkv.stderr, /decode|ffmpeg|partial|premature|error/i);
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});
