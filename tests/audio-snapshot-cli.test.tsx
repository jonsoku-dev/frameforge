import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import test from 'node:test';

const engine = resolve(import.meta.dirname, '..');
const posixOnly = process.platform === 'win32' ? 'audio snapshot staging requires POSIX openat and no-follow support' : false;

test('audio-snapshot-prepare creates a project manifest and refuses to overwrite it', {skip: posixOnly, timeout: 30000}, () => {
  const project = mkdtempSync(join(tmpdir(), 'frameforge-snapshot-cli-'));
  const wav = join(project, 'full.wav'), manifest = join(project, 'snapshot.json');
  const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
  try {
    writeFileSync(join(project, 'frameforge.json'), JSON.stringify({engine, films: 'films'}));
    const generated = spawnSync(ffmpeg, ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=1', '-ac', '2', '-c:a', 'pcm_s16le', wav], {encoding: 'utf8'});
    assert.equal(generated.status, 0, generated.stderr);
    const command = () => spawnSync(process.execPath, [join(engine, 'bin/frameforge.mjs'), 'audio-snapshot-prepare', 'full.wav', 'Example', '30', '30', '--output', 'snapshot.json'], {cwd: project, encoding: 'utf8', timeout: 10000});
    const first = command();
    assert.equal(first.status, 0, first.stderr);
    assert.ok(existsSync(manifest));
    const expected = {version: 1, composition: 'Example', fps: 30, durationInFrames: 30, sha256: createHash('sha256').update(readFileSync(wav)).digest('hex')};
    assert.deepEqual(JSON.parse(first.stdout), expected);
    const firstBytes = readFileSync(manifest);
    assert.deepEqual(JSON.parse(firstBytes.toString()), expected);
    const second = command();
    assert.notEqual(second.status, 0, 'an existing manifest must not be overwritten');
    assert.deepEqual(readFileSync(manifest), firstBytes);
  } finally {
    rmSync(project, {recursive: true, force: true});
  }
});


test('interrupted manifest writing leaves no partial final or temporary manifest', {skip: posixOnly, timeout: 30000}, () => {
  const project = mkdtempSync(join(tmpdir(), 'frameforge-manifest-interrupt-'));
  try {
    writeFileSync(join(project, 'frameforge.json'), JSON.stringify({engine, films: 'films'}));
    writeFileSync(join(project, 'full.wav'), 'snapshot bytes');
    const injections = join(project, 'injections');
    mkdirSync(injections);
    writeFileSync(join(injections, 'sitecustomize.py'), `import os, signal
original = os.write
def interrupt(fd, data):
    original(fd, data[:1])
    os.kill(os.getpid(), signal.SIGTERM)
    return len(data)
os.write = interrupt
`);
    const result = spawnSync(process.execPath, [join(engine, 'bin/frameforge.mjs'), 'audio-snapshot-prepare', 'full.wav', 'Example', '30', '30', '--output', 'snapshot.json'], {cwd: project, encoding: 'utf8', timeout: 10000, env: {...process.env, PYTHONPATH: injections}});
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /interrupted/i);
    assert.equal(existsSync(join(project, 'snapshot.json')), false, 'partial data must never be published');
    assert.equal(readdirSync(project).some(name => name.startsWith('.frameforge-manifest-')), false, 'SIGTERM removes the private temporary file');
  } finally {
    rmSync(project, {recursive: true, force: true});
  }
});


test('manifest publication rejects a temporary-file substitution and preserves unowned files', {skip: posixOnly, timeout: 30000}, () => {
  const project = mkdtempSync(join(tmpdir(), 'frameforge-manifest-replace-'));
  try {
    writeFileSync(join(project, 'frameforge.json'), JSON.stringify({engine, films: 'films'}));
    writeFileSync(join(project, 'full.wav'), 'snapshot bytes');
    const injections = join(project, 'injections');
    mkdirSync(injections);
    writeFileSync(join(injections, 'sitecustomize.py'), `import os
original = os.link
def replace(src, dst, *args, **kwargs):
    directory = kwargs['src_dir_fd']
    os.rename(src, 'original.tmp', src_dir_fd=directory, dst_dir_fd=directory)
    fd = os.open(src, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600, dir_fd=directory)
    os.write(fd, b'unowned data')
    os.close(fd)
    return original(src, dst, *args, **kwargs)
os.link = replace
`);
    const result = spawnSync(process.execPath, [join(engine, 'bin/frameforge.mjs'), 'audio-snapshot-prepare', 'full.wav', 'Example', '30', '30', '--output', 'snapshot.json'], {cwd: project, encoding: 'utf8', timeout: 10000, env: {...process.env, PYTHONPATH: injections}});
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /identity changed/i);
    assert.equal(readFileSync(join(project, 'snapshot.json'), 'utf8'), 'unowned data', 'the replacement is reported and never unlinked');
    assert.ok(existsSync(join(project, 'original.tmp')), 'the displaced original is not deleted via an unverified pathname');
  } finally {
    rmSync(project, {recursive: true, force: true});
  }
});
