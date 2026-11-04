import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import test from 'node:test';

const engine = resolve(import.meta.dirname, '..');

test('effect names cannot overwrite the narration or music output', {timeout: 30000}, t => {
  const root = mkdtempSync(join(tmpdir(), 'frameforge-reserved-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  const assets = join(root, 'scripts/assets');
  mkdirSync(assets, {recursive: true});
  for (const file of ['score.py', 'sfx.py', 'audio_guard.py']) cpSync(join(engine, 'scripts/assets', file), join(assets, file));
  const film = join(root, 'examples/probe'), output = join(root, 'public/audio/generated/probe');
  mkdirSync(film, {recursive: true});
  mkdirSync(output, {recursive: true});
  const voice = join(output, 'voice.wav');
  writeFileSync(voice, 'narration sentinel');
  const audio = join(film, 'audio.json');
  const spec = JSON.parse(readFileSync(join(engine, 'examples/samples/cafe-morning/audio.json'), 'utf8'));
  spec.slug = 'probe';
  spec.sfx = [{name: 'voice', preset: 'pop'}];
  const env = {...process.env}; delete env.FRAMEFORGE_PROJECT;
  for (const name of ['voice', 'music']) {
    spec.sfx[0]!.name = name;
    writeFileSync(audio, JSON.stringify(spec));
    const result = spawnSync('python3', [join(assets, 'score.py'), audio], {cwd: root, env, encoding: 'utf8'});
    assert.notEqual(result.status, 0, `${name} must be rejected: ${result.stderr}`);
    assert.match(result.stderr, /sfx names must be unique and cannot be "music" or "voice"/);
    assert.equal(readFileSync(voice, 'utf8'), 'narration sentinel');
  }
  spec.sfx[0]!.name = 'bell';
  writeFileSync(audio, JSON.stringify(spec));
  const normal = spawnSync('python3', [join(assets, 'score.py'), audio], {cwd: root, env, encoding: 'utf8'});
  assert.equal(normal.status, 0, normal.stderr);
  assert.equal(readFileSync(join(output, 'bell.wav')).subarray(0, 4).toString(), 'RIFF');
  assert.equal(readFileSync(voice, 'utf8'), 'narration sentinel');
});
