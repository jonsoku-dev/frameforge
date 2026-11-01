import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {checkBrief, compositionOf, numberFindings, sentences} from '../scripts/brief-check.mjs';
import {ENGINE} from '../bin/frameforge.mjs';

const brief = readFileSync('tests/fixtures/brief/brief.md', 'utf8');
const composition = compositionOf(readFileSync('tests/fixtures/brief/entry.tsx', 'utf8'));
const codes = (markdown: string, comp = composition) => checkBrief(markdown, comp).map(f => f.code);
const row = (start: string) => brief.split('\n').find(line => line.startsWith(`| ${start}`))!;

test('brief-check passes the walkthrough brief and keeps "Opus 5.5" inside its sentence', () => {
  assert.deepEqual(composition, {durationInFrames: 600, fps: 60, width: 1920, height: 1080});
  assert.deepEqual(checkBrief(brief, composition), []);
  assert.equal(sentences('shows who are you as Opus 5.5 - be bold. Avoid corners!').length, 2);
});

test('brief-check fails an empty request, an empty ledger and the unfilled template', () => {
  assert.ok(codes(brief.replace(/^> make.*$/m, '')).includes('request_empty'));
  const template = readFileSync(join(ENGINE, 'examples/samples/_template/brief.md'), 'utf8');
  assert.deepEqual(codes(template, {}), ['request_empty', 'ledger_empty', 'section_missing', 'section_missing']);
});

test('brief-check names the clause whose row lacks a means or a verification', () => {
  const clause = row('"that shows');
  const noMeans = checkBrief(brief.replace(clause, '| "that shows who are you as Opus 5.5" | must | TODO | Structure rows |'), composition);
  assert.deepEqual(noMeans.map(f => f.code), ['row_no_means']); assert.match(noMeans[0]!.message, /that shows who are you as Opus 5\.5/);
  const noVerify = checkBrief(brief.replace(clause, '| "that shows who are you as Opus 5.5" | must | Thread loop |  |'), composition);
  assert.deepEqual(noVerify.map(f => f.code), ['row_no_verify']);
  assert.deepEqual(codes(brief.replace('| taste | maximal', '| wish | maximal')), ['row_kind']);
});

test('brief-check fails a request sentence no clause covers and lists the missing words', () => {
  const findings = checkBrief(brief.replace(`${row('"Avoid')}\n`, ''), composition);
  assert.deepEqual(findings.map(f => f.code), ['request_uncovered']);
  assert.match(findings[0]!.message, /"Avoid the frames and texts on the corners which are typical ai made giveaways!"/);
  const partial = checkBrief(brief.replace(`${row('"be as')}\n`, ''), composition);
  assert.match(partial[0]!.message, /\(missing: be, creative, and, possible\)$/);
  assert.ok(!codes(brief.replace(`${row('a name card')}\n`, '')).length, 'implied rows are never needed for coverage');
});

test('brief-check compares seconds, size and fps in must clauses with the composition', () => {
  assert.deepEqual(codes(brief, {...composition, durationInFrames: 1200}), ['duration_mismatch']);
  const sized = brief.replace(row('"make'), `${row('"make')}\n| "1080x1920 at 30 fps" | must | format | entry.tsx |`);
  assert.deepEqual(codes(sized).filter(c => c.endsWith('mismatch')), ['size_mismatch', 'fps_mismatch']);
  assert.ok(!codes(brief.replace('| must | 1920x1080', '| taste | 1920x1080'), {...composition, durationInFrames: 1200}).length, 'only must clauses are compared');
});

test('brief-check compares explicit duration ranges inclusively, not the last endpoint as an exact duration', () => {
  const findings = (clause: string, seconds: number) => numberFindings(clause, {...composition, fps: 30, durationInFrames: seconds * 30}).map(f => f.code);
  for (const clause of ['a 10–15-second video', '10-15 seconds', '10 to 15 sec', 'between 10 and 15 seconds', '10s–15s', '10~15초짜리 영상', '10초에서 15초까지', '10초부터 15초까지']) {
    assert.deepEqual(findings(clause, 12), [], clause);
    assert.deepEqual(findings(clause, 10), [], `${clause}: lower bound`);
    assert.deepEqual(findings(clause, 15), [], `${clause}: upper bound`);
    assert.deepEqual(findings(clause, 9), ['duration_mismatch'], `${clause}: too short`);
    assert.deepEqual(findings(clause, 16), ['duration_mismatch'], `${clause}: too long`);
  }
  assert.deepEqual(findings('15–10 seconds', 12), ['duration_range_invalid']);
  assert.deepEqual(findings('0–10 seconds', 5), ['duration_range_invalid']);
  assert.deepEqual(findings('10–15 seconds and 20 seconds', 12), ['duration_ambiguous']);
  assert.deepEqual(findings('10 or 15 seconds', 15), ['duration_ambiguous']);
  assert.deepEqual(findings('10초 또는 15초', 10), ['duration_ambiguous']);
  assert.deepEqual(findings('10 seconds or 15 seconds', 10), ['duration_ambiguous']);
  assert.deepEqual(findings('1분 10–15초짜리 영상', 12), ['duration_ambiguous']);
  assert.deepEqual(findings('1 minute 10–15 seconds long', 12), ['duration_ambiguous']);
  assert.deepEqual(findings('1분 12초짜리 영상', 12), ['duration_ambiguous']);
  assert.deepEqual(findings('1 min 12 seconds', 12), ['duration_ambiguous']);
  assert.deepEqual(findings('12초짜리 영상', 12), []);
  assert.deepEqual(findings('12초짜리 영상', 14), ['duration_mismatch']);
  assert.deepEqual(findings('10 seconds', 12), ['duration_mismatch'], 'exact durations still fail');
});

test('brief-check CLI accepts an explicit duration range in a must row', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ff-brief-range-'));
  const request = 'Make a 10–15-second vertical film.';
  const rangeBrief = `## Request\n\n${request}\n\n## Intent ledger\n\n| Clause | Kind | Means | Verify |\n| --- | --- | --- | --- |\n| ${request} | must | 360 frames | entry.tsx |\n\n## Engine translation\n\nUse frames.\n\n## Gaps\n\nNone.\n`;
  try {
    writeFileSync(join(dir, 'brief.md'), rangeBrief);
    writeFileSync(join(dir, 'entry.tsx'), '<Composition durationInFrames={360} fps={30} width={1080} height={1920} />');
    const checked = spawnSync(process.execPath, [join(ENGINE, 'scripts/brief-check.mjs'), dir, '--json'], {encoding: 'utf8'});
    assert.equal(checked.status, 0, checked.stdout + checked.stderr);
    assert.deepEqual(JSON.parse(checked.stdout).findings, []);
  } finally { rmSync(dir, {recursive: true, force: true}); }
});

test('frameforge brief-check runs the script and check SKIPs a film without brief.md', () => {
  const pass = spawnSync(process.execPath, [join(ENGINE, 'bin/frameforge.mjs'), 'brief-check', 'tests/fixtures/brief'], {cwd: ENGINE, encoding: 'utf8'});
  assert.equal(pass.status, 0, pass.stdout); assert.match(pass.stdout, /^PASS/m);
  const dir = mkdtempSync(join(tmpdir(), 'ff-brief-'));
  try {
    writeFileSync(join(dir, 'brief.md'), brief.replace(`${row('"Avoid')}\n`, ''));
    const fail = spawnSync(process.execPath, [join(ENGINE, 'scripts/brief-check.mjs'), dir], {encoding: 'utf8'});
    assert.equal(fail.status, 1); assert.match(fail.stdout, /FAIL request_uncovered: no ledger clause covers "Avoid the frames/);
    rmSync(join(dir, 'brief.md'));
    const skip = spawnSync(process.execPath, [join(ENGINE, 'scripts/brief-check.mjs'), dir], {encoding: 'utf8'});
    assert.equal(skip.status, 0); assert.match(skip.stdout, /^SKIP: .*brief\.md 없음/);
  } finally { rmSync(dir, {recursive: true, force: true}); }
});
