import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {chmodSync, closeSync, constants, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync, statSync, symlinkSync, truncateSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import test from 'node:test';

const helper = resolve(import.meta.dirname, '../scripts/audio-snapshot.py');
const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const posixOnly = process.platform === 'win32' ? 'snapshot staging requires POSIX openat and no-follow support' : false;

test('snapshot staging pins the requested project files and validates their manifest', {skip: posixOnly}, () => {
  const suite = mkdtempSync(join(tmpdir(), 'frameforge-snapshot-path-'));
  const root = join(suite, 'project'), scratch = join(suite, 'scratch');
  mkdirSync(root); mkdirSync(scratch, {mode: 0o700}); mkdirSync(join(root, 'audio'));
  const bytes = Buffer.from('project-local WAV bytes');
  const manifest = {version: 1, composition: 'Example', fps: 30, durationInFrames: 120, sha256: sha256(bytes)};
  const wav = join(root, 'audio', 'full.wav'), json = join(root, 'audio', 'manifest.json');
  writeFileSync(wav, bytes); writeFileSync(json, JSON.stringify(manifest));
  const run = (...args: string[]) => spawnSync('python3', [helper, ...args], {encoding: 'utf8', timeout: 10000});
  const stage = (snapshot = 'audio/full.wav', input = 'audio/manifest.json', dir = scratch) => run('stage', root, snapshot, input, dir);
  try {
    const prepared = run('prepare', root, 'audio/full.wav', 'Example', '30', '120');
    assert.equal(prepared.status, 0, prepared.stderr);
    assert.deepEqual(JSON.parse(prepared.stdout), manifest, 'prepare describes the selected bytes only');
    const written = run('prepare', root, 'audio/full.wav', 'Example', '30', '120', '--output', 'audio/prepared.json');
    assert.equal(written.status, 0, written.stderr);
    assert.deepEqual(JSON.parse(written.stdout), manifest);
    assert.deepEqual(JSON.parse(readFileSync(join(root, 'audio', 'prepared.json'), 'utf8')), manifest);
    assert.equal(statSync(join(root, 'audio', 'prepared.json')).mode & 0o077, 0, 'manifest must not be accessible by group or others');
    const existing = readFileSync(json);
    assert.notEqual(run('prepare', root, 'audio/full.wav', 'Example', '30', '120', '--output', 'audio/manifest.json').status, 0);
    assert.deepEqual(readFileSync(json), existing, 'an existing manifest is never replaced');
    const valid = stage();
    assert.equal(valid.status, 0, valid.stderr);
    const stagedInfo = statSync(join(scratch, 'snapshot.wav'), {bigint: true});
    assert.deepEqual(JSON.parse(valid.stdout), {snapshot: join(scratch, 'snapshot.wav'), snapshotDev: String(stagedInfo.dev), snapshotIno: String(stagedInfo.ino), sha256: manifest.sha256, composition: 'Example', fps: 30, durationInFrames: 120});
    assert.deepEqual(readFileSync(join(scratch, 'snapshot.wav')), bytes);

    const collision = stage();
    assert.notEqual(collision.status, 0, 'a staged file is never overwritten');
    assert.deepEqual(readFileSync(join(scratch, 'snapshot.wav')), bytes);
    rmSync(join(scratch, 'snapshot.wav'));

    const outside = join(suite, 'outside.wav');
    writeFileSync(outside, 'outside sentinel');
    symlinkSync(outside, join(root, 'outside-link.wav'));
    symlinkSync(suite, join(root, 'escape-dir'));
    symlinkSync(wav, join(root, 'inside-link.wav'));
    symlinkSync(json, join(root, 'manifest-link.json'));
    mkdirSync(join(root, 'directory.wav'));
    for (const output of ['../outside.json', join(suite, 'outside.json'), 'escape-dir/outside.json', 'manifest-link.json', 'https://example.invalid/out.json']) {
      assert.notEqual(run('prepare', root, 'audio/full.wav', 'Example', '30', '120', '--output', output).status, 0, `accepted output ${output}`);
    }
    assert.equal(existsSync(join(suite, 'outside.json')), false, 'an escaped output is not created');
    for (const [snapshot, input] of [
      ['', 'audio/manifest.json'], [outside, 'audio/manifest.json'], ['../outside.wav', 'audio/manifest.json'],
      ['audio/../audio/full.wav', 'audio/manifest.json'], ['https://example.invalid/full.wav', 'audio/manifest.json'],
      ['outside-link.wav', 'audio/manifest.json'], ['inside-link.wav', 'audio/manifest.json'],
      ['escape-dir/outside.wav', 'audio/manifest.json'], ['audio/full.wav', 'manifest-link.json'],
      ['directory.wav', 'audio/manifest.json'],
    ]) {
      const invalid = stage(snapshot, input);
      assert.notEqual(invalid.status, 0, `accepted ${snapshot}, ${input}`);
      assert.equal(existsSync(join(scratch, 'snapshot.wav')), false, 'failure cannot leave a staged output');
    }

    const fifo = join(root, 'pipe.wav');
    const made = spawnSync('mkfifo', [fifo], {encoding: 'utf8'});
    assert.equal(made.status, 0, made.stderr);
    assert.notEqual(stage('pipe.wav').status, 0, 'a FIFO must not be read or block');

    for (const invalidManifest of [
      {...manifest, sha256: '0'.repeat(64)}, {...manifest, fps: 0}, {...manifest, fps: '30'},
      {...manifest, durationInFrames: 1.5}, {...manifest, version: 2}, {...manifest, extra: true},
    ]) {
      writeFileSync(json, JSON.stringify(invalidManifest));
      assert.notEqual(stage().status, 0, `accepted ${JSON.stringify(invalidManifest)}`);
      assert.equal(existsSync(join(scratch, 'snapshot.wav')), false);
    }
    writeFileSync(json, '{"version":1,"version":1,"composition":"Example","fps":30,"durationInFrames":120,"sha256":"' + manifest.sha256 + '"}');
    assert.notEqual(stage().status, 0, 'duplicate fields must not be ambiguous');
    writeFileSync(json, Buffer.alloc(1024 * 1024 + 1, 32));
    assert.notEqual(stage().status, 0, 'oversized manifest must be rejected');
    writeFileSync(json, JSON.stringify(manifest));
    chmodSync(scratch, 0o755);
    assert.notEqual(stage().status, 0, 'staging directory must be private');
    chmodSync(scratch, 0o700);
    assert.notEqual(run('prepare', root, 'audio/full.wav', 'Example', 'NaN', '120').status, 0);
    assert.notEqual(run('prepare', root, 'audio/full.wav', 'Example', '30', '0').status, 0);
    const huge = join(root, 'huge.wav');
    writeFileSync(huge, ''); truncateSync(huge, 512 * 1024 * 1024 + 1);
    const largePrepare = run('prepare', root, 'huge.wav', 'Example', '30', '120', '--output', 'audio/huge.json');
    assert.notEqual(largePrepare.status, 0);
    assert.match(largePrepare.stderr, /512 MiB/);
    assert.equal(existsSync(join(root, 'audio', 'huge.json')), false);
    const largeStage = stage('huge.wav');
    assert.notEqual(largeStage.status, 0);
    assert.match(largeStage.stderr, /512 MiB/);
    assert.equal(existsSync(join(scratch, 'snapshot.wav')), false);
  } finally {
    rmSync(suite, {recursive: true, force: true});
  }
});

test('a snapshot growing beyond the limit while being copied is rejected and cleaned up', {skip: posixOnly}, () => {
  const suite = mkdtempSync(join(tmpdir(), 'frameforge-snapshot-growth-'));
  const root = join(suite, 'project'), scratch = join(suite, 'scratch');
  mkdirSync(root); mkdirSync(scratch, {mode: 0o700});
  const bytes = Buffer.from('12345678');
  writeFileSync(join(root, 'full.wav'), bytes);
  writeFileSync(join(root, 'manifest.json'), JSON.stringify({version: 1, composition: 'Example', fps: 30, durationInFrames: 120, sha256: sha256(bytes)}));
  const script = `
import importlib.util, os, sys
spec=importlib.util.spec_from_file_location('audio_snapshot', sys.argv[1])
module=importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
module.MAX_SNAPSHOT=8
copy=module.digest_copy
def grow(fd, output=None):
    with open(os.path.join(sys.argv[2], 'full.wav'), 'ab') as source:
        source.write(b'9')
    return copy(fd, output)
module.digest_copy=grow
try:
    module.inspect(sys.argv[2], 'full.wav', manifest='manifest.json', scratch=sys.argv[3])
    raise AssertionError('growing snapshot was accepted')
except ValueError as error:
    assert 'exceeds' in str(error), str(error)
`;
  try {
    const result = spawnSync('python3', ['-c', script, helper, root, scratch], {encoding: 'utf8', timeout: 10000});
    assert.equal(result.status, 0, result.stderr);
    assert.equal(existsSync(join(scratch, 'snapshot.wav')), false);
  } finally {
    rmSync(suite, {recursive: true, force: true});
  }
});

test('a snapshot or manifest replaced during copying is rejected instead of publishing a staged file', {skip: posixOnly}, () => {
  const suite = mkdtempSync(join(tmpdir(), 'frameforge-snapshot-race-'));
  const root = join(suite, 'project'), scratch = join(suite, 'scratch');
  mkdirSync(root); mkdirSync(scratch, {mode: 0o700});
  const bytes = Buffer.from('original'), original = join(root, 'full.wav'), replacement = join(root, 'replacement.wav');
  writeFileSync(original, bytes); writeFileSync(replacement, 'replacement');
  writeFileSync(join(root, 'manifest.json'), JSON.stringify({version: 1, composition: 'Example', fps: 30, durationInFrames: 120, sha256: sha256(bytes)}));
  const script = `
import importlib.util, os, sys
spec=importlib.util.spec_from_file_location('audio_snapshot', sys.argv[1])
module=importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
copy=module.digest_copy
def replace(fd, output=None):
    digest=copy(fd, output)
    os.replace(sys.argv[4], sys.argv[5])
    return digest
module.digest_copy=replace
try:
    module.inspect(sys.argv[2], 'full.wav', manifest='manifest.json', scratch=sys.argv[3])
    raise AssertionError('replaced snapshot was accepted')
except ValueError as error:
    assert 'changed' in str(error), str(error)
`;
  try {
    const result = spawnSync('python3', ['-c', script, helper, root, scratch, replacement, original], {encoding: 'utf8', timeout: 10000});
    assert.equal(result.status, 0, result.stderr);
    assert.equal(existsSync(join(scratch, 'snapshot.wav')), false);
    writeFileSync(original, bytes);
    const replacementManifest = join(root, 'replacement-manifest.json');
    writeFileSync(replacementManifest, JSON.stringify({version: 1, composition: 'Example', fps: 30, durationInFrames: 120, sha256: sha256(bytes)}));
    const replacedManifest = spawnSync('python3', ['-c', script, helper, root, scratch, replacementManifest, join(root, 'manifest.json')], {encoding: 'utf8', timeout: 10000});
    assert.equal(replacedManifest.status, 0, replacedManifest.stderr);
    assert.equal(existsSync(join(scratch, 'snapshot.wav')), false);
  } finally {
    rmSync(suite, {recursive: true, force: true});
  }
});


test('scratch cleanup never recursively removes a replacement directory', {skip: posixOnly}, () => {
  const suite = mkdtempSync(join(tmpdir(), 'frameforge-scratch-replace-'));
  const scratch = join(suite, 'scratch'), moved = join(suite, 'moved'), injections = join(suite, 'injections');
  mkdirSync(scratch); mkdirSync(injections);
  writeFileSync(join(scratch, 'snapshot.wav'), 'owned snapshot');
  const info = statSync(join(scratch, 'snapshot.wav'), {bigint: true});
  const fd = openSync(scratch, constants.O_RDONLY | constants.O_DIRECTORY);
  try {
    // Replace the pathname after its identity stat but before rmdir. The new
    // directory has unrelated data that recursive cleanup would destroy.
    writeFileSync(join(injections, 'sitecustomize.py'), `import os
original = os.stat
def replace(path, *args, **kwargs):
    result = original(path, *args, **kwargs)
    if path == os.environ.get('TEST_SCRATCH_PATH'):
        os.rename(path, os.environ['TEST_SCRATCH_MOVED'])
        os.mkdir(path)
        with open(os.path.join(path, 'sentinel'), 'w') as f: f.write('preserve')
    return result
os.stat = replace
`);
    const result = spawnSync('python3', [helper, 'cleanup', scratch, String(info.dev), String(info.ino)], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe', fd], env: {...process.env, PYTHONPATH: injections, TEST_SCRATCH_PATH: scratch, TEST_SCRATCH_MOVED: moved}});
    assert.notEqual(result.status, 0, 'nonempty replacement directory cannot be removed');
    assert.equal(readFileSync(join(scratch, 'sentinel'), 'utf8'), 'preserve');
    assert.equal(existsSync(join(moved, 'snapshot.wav')), false, 'only the pinned snapshot file is unlinked');
  } finally {
    closeSync(fd);
    rmSync(suite, {recursive: true, force: true});
  }
});
