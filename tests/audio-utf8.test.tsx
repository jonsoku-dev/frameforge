import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import test from 'node:test';

const source = resolve(import.meta.dirname, '..');
const setup = () => {
  const root = mkdtempSync(join(tmpdir(), 'frameforge-audio-utf8-'));
  const assets = join(root, 'scripts/assets'), film = join(root, 'examples/probe');
  mkdirSync(assets, {recursive: true}); mkdirSync(film, {recursive: true});
  for (const name of ['score.py', 'voice.py', 'sfx.py', 'audio_guard.py']) cpSync(join(source, 'scripts/assets', name), join(assets, name));
  const env: NodeJS.ProcessEnv = {...process.env, LC_ALL: 'C', PYTHONUTF8: '0', PYTHONCOERCECLOCALE: '0', PYTHONIOENCODING: 'ascii'};
  delete env.FRAMEFORGE_PROJECT;
  const run = (args: string[], extra: NodeJS.ProcessEnv = {}) => spawnSync('python3', args, {cwd: root, env: {...env, ...extra}, encoding: 'utf8', timeout: 30000});
  return {root, assets, film, run};
};

test('narration output and self-check preserve Korean and Japanese with a non-UTF-8 locale', {timeout: 60000}, t => {
  const x = setup(); t.after(() => rmSync(x.root, {recursive: true, force: true}));
  const spec = {slug: 'probe', language: 'ko', voice: {provider: 'silent', name: '음성🎬'}, lines: [{id: 'line', text: '안녕하세요 日本語'}]};
  const file = join(x.film, 'narration.json'); writeFileSync(file, JSON.stringify(spec));
  const generated = x.run([join(x.assets, 'voice.py'), file, '--out', join(x.root, 'output')]);
  assert.equal(generated.status, 0, generated.stderr);
  assert.equal(JSON.parse(generated.stdout).voice, spec.voice.name);
  const timing = JSON.parse(readFileSync(join(x.film, 'narration.timing.json'), 'utf8'));
  assert.equal(timing.lines[0].text, spec.lines[0]!.text);
  const check = x.run([join(x.assets, 'voice.py'), '--self-check']);
  assert.equal(check.status, 0, check.stderr);
});

test('score reads and writes Unicode effect metadata independently of the locale', {timeout: 60000}, t => {
  const x = setup(); t.after(() => rmSync(x.root, {recursive: true, force: true}));
  const output = join(x.root, 'public/audio/generated/probe'); mkdirSync(output, {recursive: true});
  writeFileSync(join(output, 'sfx.json'), JSON.stringify({old: {intent: '이전 효과음'}}));
  const spec = JSON.parse(readFileSync(join(source, 'examples/samples/cafe-morning/audio.json'), 'utf8'));
  spec.slug = 'probe'; spec.sfx = [{name: 'tap', intent: '부드러운 효과음', source: 'synth', preset: 'pop'}];
  const file = join(x.film, 'audio.json'); writeFileSync(file, JSON.stringify(spec));
  const result = x.run([join(x.assets, 'score.py'), file]);
  assert.equal(result.status, 0, result.stderr);
  const manifest = JSON.parse(readFileSync(join(output, 'sfx.json'), 'utf8'));
  assert.equal(manifest.tap.intent, '부드러운 효과음');
});

test('legacy locale-encoded score metadata is migrated to UTF-8', {timeout: 60000}, t => {
  const x = setup(); t.after(() => rmSync(x.root, {recursive: true, force: true}));
  const locale = {LC_ALL: 'en_US.ISO8859-1'};
  const probe = x.run(['-c', 'import locale; print(locale.getencoding())'], locale);
  if (probe.status !== 0 || !/8859[-_]?1/i.test(probe.stdout)) return t.skip('legacy Latin-1 locale unavailable');
  const output = join(x.root, 'public/audio/generated/probe'); mkdirSync(output, {recursive: true});
  writeFileSync(join(output, 'sfx.json'), Buffer.from(JSON.stringify({old: {intent: 'café'}}), 'latin1'));
  const spec = JSON.parse(readFileSync(join(source, 'examples/samples/cafe-morning/audio.json'), 'utf8'));
  spec.slug = 'probe'; spec.sfx = [{name: 'tap', intent: 'café', source: 'synth', preset: 'pop'}];
  const file = join(x.film, 'audio.json'); writeFileSync(file, JSON.stringify(spec));
  const result = x.run([join(x.assets, 'score.py'), file], locale);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(readFileSync(join(output, 'sfx.json'), 'utf8')).tap.intent, 'café');
});

test('effect credits preserve Unicode attribution independently of the locale', t => {
  const x = setup(); t.after(() => rmSync(x.root, {recursive: true, force: true}));
  const output = join(x.root, 'credits'); mkdirSync(output);
  const code = String.raw`import sys; sys.path.insert(0, sys.argv[1]); import sfx; sfx.write_credits(sys.argv[2], {'tap': {'provider': 'library', 'source': {'license': 'by', 'attribution': '\uc81c\uc791\uc790', 'landing': 'https://example.com'}}})`;
  const result = x.run(['-c', code, x.assets, output]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(readFileSync(join(output, 'CREDITS.md'), 'utf8'), /제작자/);
});
