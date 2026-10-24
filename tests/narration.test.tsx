import React from 'react';
import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {renderToStaticMarkup} from 'react-dom/server';
import {FrameProvider, Formula, Subtitles, SubtitleLine, captionsFromTiming, narrationFrames, parseSrt, serializeSrt, useNarration, type NarrationTiming} from '../src/core/index';

const timing: NarrationTiming = {slug: 'fixture', provider: 'silent', voice: 'silent', totalMs: 7000, lines: [
  {id: 'hook', text: '하루에 쓰는 시간을 숫자 하나로', startMs: 500, endMs: 3000, estimated: true, emphasis: ['숫자 하나로'], embed: '숫자'},
  {id: 'body', text: '예시 지수는 집중한 시간의 비율입니다 그리고 더 긴 줄', startMs: 3400, endMs: 7000, estimated: true},
]};
const config = {id: 'x', width: 1920, height: 1080, fps: 30, durationInFrames: 300};
const at = (frame: number, children: React.ReactNode) => renderToStaticMarkup(<FrameProvider config={config} frame={frame}>{children}</FrameProvider>);

test('narrationFrames rounds milliseconds to frames and reports the total', () => {
  const {lines, total} = narrationFrames(timing, 30);
  assert.deepEqual(lines.map(line => [line.startFrame, line.endFrame, line.durationInFrames]), [[15, 90, 75], [102, 210, 108]]);
  assert.equal(total, 210);
  assert.throws(() => narrationFrames(timing, 0), /fps/);
});

test('useNarration names the current line, its progress and the start frame of any line', () => {
  const Probe = () => { const n = useNarration(timing); return <i>{JSON.stringify({id: n.current?.id ?? null, index: n.index, progress: Math.round(n.progress * 100) / 100, body: n.at('body')})}</i>; };
  const read = (frame: number) => JSON.parse(/<i>(.*)<\/i>/.exec(at(frame, <Probe />))![1]!.replace(/&quot;/g, '"'));
  assert.deepEqual(read(0), {id: null, index: -1, progress: 0, body: 102});
  assert.deepEqual(read(15), {id: 'hook', index: 0, progress: 0, body: 102});
  assert.deepEqual(read(52), {id: 'hook', index: 0, progress: 0.49, body: 102});
  assert.deepEqual(read(95), {id: null, index: -1, progress: 0, body: 102});
  const Missing = () => { useNarration(timing).at('nope'); return null; };
  assert.throws(() => at(0, <Missing />), /no line 'nope'/);
});

test('Subtitles shows the line that is speaking, holds it through a short gap, and renders the same markup twice', () => {
  const rail = (frame: number) => at(frame, <Subtitles timing={timing} palette={{ink: '#14213D', paper: '#F3EFE6', accent: '#C4511B'}} />);
  assert.equal(rail(10), '');
  assert.equal(rail(40), rail(40));
  assert.ok(rail(40).includes('하루에') && !rail(40).includes('예시'));
  assert.ok(rail(95).includes('하루에'), 'held through the gap before the next line');
  assert.ok(rail(150).includes('예시') && !rail(150).includes('하루에'));
  assert.equal(rail(215), '', 'the last line leaves with the voice');
  const html = rail(89);
  assert.ok(html.includes('underline #C4511B') && html.includes('rgb(60, 70, 91)'), 'emphasis underlined in the accent on an ink-and-paper plate');
  assert.ok(rail(16).includes('하루에') && !rail(16).includes('하나로') && rail(89).includes('하나로'), 'words join the plate across the line');
  assert.ok(rail(150).split('rgb(60, 70, 91)').length === 2 && rail(150).includes('비율입니다'), 'a long line breaks into two rows on one plate');
  const embed = (frame: number) => at(frame, <Subtitles timing={timing} style="embed" />);
  assert.ok(embed(40).includes('>숫자<') && embed(150) === '' && embed(5) === '');
  assert.ok(at(0, <SubtitleLine line={timing.lines[0]!} reveal={1} />).includes('하나로'));
});

test('captionsFromTiming round-trips through serializeSrt and parseSrt', () => {
  const captions = captionsFromTiming(timing);
  const srt = serializeSrt({lines: captions.map(caption => [caption])});
  assert.ok(srt.startsWith('1\n00:00:00,500 --> 00:00:03,000\n하루에'));
  assert.deepEqual(parseSrt({input: srt, strict: true}).captions.map(c => [c.text, c.startMs, c.endMs]), timing.lines.map(line => [line.text, line.startMs, line.endMs]));
});

test('narration-check passes the clean fixture and names each fault with a fix', () => {
  const run = (folder: string, ...args: string[]) => spawnSync('node', ['scripts/narration-check.mjs', `tests/fixtures/narration/${folder}`, '--json', ...args], {encoding: 'utf8'});
  const clean = run('clean');
  assert.equal(clean.status, 0, clean.stderr);
  assert.deepEqual(JSON.parse(clean.stdout).findings, []);
  for (const [folder, code] of [['overlap', 'line_overlap'], ['too-fast', 'line_too_fast'], ['past-end', 'line_past_end']] as const) {
    const result = run(folder);
    const report = JSON.parse(result.stdout);
    assert.equal(result.status, 1, folder);
    assert.deepEqual(report.findings.map((f: {code: string}) => f.code), [code]);
    assert.ok(report.findings[0].fix.length > 20);
  }
  const scene = JSON.parse(run('clean', '--scenes', '15,40,102').stdout);
  assert.deepEqual(scene.findings.map((f: {code: string; scene: number}) => [f.code, f.scene]), [['scene_inside_line', 40]]);
});

test('voice.py self-check passes', () => {
  const result = spawnSync('python3', ['scripts/assets/voice.py', '--self-check'], {encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /voice self-check ok/);
});

test('Formula renders KaTeX markup, highlights a substring, clips by draw, and reports a parse error', () => {
  const html = at(0, <Formula tex="E=mc^2" highlight={['mc^2']} highlightColor="#C4511B" draw={0.5} />);
  assert.ok(html.includes('class="katex"') && html.includes('ff-hl') && html.includes('.ff-hl{color:#C4511B}'));
  assert.ok(html.includes('inset(-0.2em 50% -0.2em 0)'));
  assert.equal(at(0, <Formula tex="E=mc^2" />), at(0, <Formula tex="E=mc^2" />));
  assert.throws(() => at(0, <Formula tex={'\\frac{1'} />), /Formula could not parse "\\frac\{1": KaTeX parse error/);
});
