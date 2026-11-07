import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import test from 'node:test';
// @ts-expect-error the checker is plain ESM without declarations
import {checkNarration, guessLanguage, units} from '../scripts/narration-check.mjs';

const timing = () => ({slug: 'probe', totalMs: 1000, lines: [{id: 'one', text: 'hello', startMs: 0, endMs: 1000, estimated: true}]});
const codes = (options: Record<string, unknown>) => checkNarration({timing: timing(), language: 'en', ...options}).map((x: {code: string}) => x.code);

test('language detection remains stable across repeated and mixed calls', () => {
  assert.deepEqual(Array.from({length: 4}, () => guessLanguage('한')), ['ko', 'ko', 'ko', 'ko']);
  assert.deepEqual(Array.from({length: 4}, () => guessLanguage('日')), ['ja', 'ja', 'ja', 'ja']);
  for (let i = 0; i < 3; i++) {
    assert.equal(guessLanguage('한'), 'ko');
    assert.equal(guessLanguage('日'), 'ja');
    assert.equal(guessLanguage('hello'), 'en');
    assert.equal(units('한국어', 'ko'), 3);
  }
});

test('invalid timing and numeric options cannot produce a clean report', () => {
  for (const broken of [
    {...timing(), lines: [{...timing().lines[0], startMs: 'bad'}]},
    {...timing(), lines: [{...timing().lines[0], endMs: NaN}]},
    {...timing(), totalMs: 500},
    {...timing(), lines: [{...timing().lines[0], id: ''}]},
    {...timing(), lines: [{...timing().lines[0], text: ' '}]},
    {...timing(), lines: [{...timing().lines[0], estimated: 'false'}]},
    {...timing(), lines: []},
    {...timing(), lines: null},
  ]) assert.ok(codes({timing: broken}).includes('timing_invalid'));
  for (const options of [{fps: 0}, {fps: Infinity}, {fps: NaN}, {fps: 1e308}, {scenes: [NaN]}, {scenes: [1e20]}, {durationInFrames: 1e20}, {rates: {en: 0}}, {language: 'xx'}]) {
    assert.ok(codes(options).includes('options_invalid'));
  }
  assert.ok(codes({timing: {...timing(), totalMs: 1e308}}).includes('options_invalid'));
});

test('CLI reports invalid timing and fps in JSON with a failing exit status', t => {
  const folder = mkdtempSync(join(tmpdir(), 'ff-narration-validation-'));
  t.after(() => rmSync(folder, {recursive: true, force: true}));
  const run = (...args: string[]) => spawnSync(process.execPath, [resolve('scripts/narration-check.mjs'), folder, '--json', ...args], {encoding: 'utf8'});
  const broken = timing(); broken.lines[0]!.startMs = -1;
  writeFileSync(join(folder, 'narration.timing.json'), JSON.stringify(broken));
  const invalidTiming = run();
  assert.equal(invalidTiming.status, 1, invalidTiming.stderr);
  assert.equal(JSON.parse(invalidTiming.stdout).findings[0].code, 'timing_invalid');
  writeFileSync(join(folder, 'narration.timing.json'), JSON.stringify(timing()));
  for (const args of [['--fps', '0'], ['--fps', 'not-a-number'], ['--fps', '1e308'], ['--fps'], ['--rate-ko', '0'], ['--scenes', '1,,2'], ['--prompt']]) {
    const result = run(...args);
    assert.equal(result.status, 1, result.stderr);
    assert.equal(JSON.parse(result.stdout).findings[0].code, 'options_invalid');
  }
});
