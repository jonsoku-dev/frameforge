import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
// @ts-expect-error plain ESM without types
import {captionsFromWhisper, findWhisper, modelPath, toSrt} from '../scripts/transcribe.mjs';
import {parseSrt, type Caption} from '../src/packages/captions';

const fixture = JSON.parse(readFileSync('tests/fixtures/transcribe/yuna.json', 'utf8'));

test('whisper tokens become word captions in the engine Caption shape, one page break per segment', () => {
  const captions = captionsFromWhisper(fixture) as Caption[];
  assert.deepEqual(captions.map(word => word.text), [' 하루결은', ' 하루를', ' 한', ' 결로', ' 모읍니다.']);
  for (const word of captions) {
    assert.deepEqual(Object.keys(word).filter(key => key !== 'pageBreakAfter').sort(), ['confidence', 'endMs', 'startMs', 'text', 'timestampMs']);
    assert.ok(word.startMs <= word.endMs && word.timestampMs === (word.startMs + word.endMs) / 2 && word.confidence! > 0 && word.confidence! <= 1);
  }
  assert.deepEqual(captions.map(word => Boolean(word.pageBreakAfter)), [false, false, false, false, true]);
});

test('the SRT reads back through parseSrt with the segment text and times', () => {
  const srt = toSrt(captionsFromWhisper(fixture));
  assert.deepEqual(parseSrt({input: srt}).captions.map(({text, startMs, endMs}) => ({text, startMs, endMs})), [{text: '하루결은 하루를 한 결로 모읍니다.', startMs: 50, endMs: 2000}]);
});

test('missing binary and unknown model fail with an instruction, and --self-check passes', async () => {
  const saved = process.env.WHISPER_CLI;
  process.env.WHISPER_CLI = '/nonexistent/whisper-cli';
  try { assert.throws(() => findWhisper(), /not found\. Install whisper\.cpp .*WHISPER_CLI=/); } finally { if (saved === undefined) delete process.env.WHISPER_CLI; else process.env.WHISPER_CLI = saved; }
  await assert.rejects(modelPath('large'), /Unknown model large; use base or small/);
  const check = spawnSync(process.execPath, ['scripts/transcribe.mjs', '--self-check'], {encoding: 'utf8'});
  assert.equal(check.status, 0, check.stderr); assert.match(check.stdout, /transcribe self-check ok/);
  const usage = spawnSync(process.execPath, ['scripts/transcribe.mjs'], {encoding: 'utf8'});
  assert.equal(usage.status, 2); assert.match(usage.stderr, /usage: node scripts\/transcribe\.mjs <media>/);
});
