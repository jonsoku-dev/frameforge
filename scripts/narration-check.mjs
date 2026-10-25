#!/usr/bin/env node
// Checks a film's narration.timing.json against its composition: npm run narration-check -- examples/samples/<slug> [--scenes 0,120,300 | --prompt prompt.md] [--fps 30] [--rate-ko 8] [--rate-en 4] [--rate-ja 7] [--json]
import {existsSync, readFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export const RATES = {ko: 8, en: 4, ja: 7};
const UNIT = {ko: 'syllables', en: 'words', ja: 'characters'};
const SYLLABLE = /[가-힣]/g;  // the same class voice.py estimates with
const KANA_KANJI = /[぀-ヿ一-鿿]/g;

export const units = (text, language) => language === 'ko' ? (text.match(SYLLABLE) ?? []).length : language === 'ja' ? (text.match(KANA_KANJI) ?? []).length : text.split(/\s+/).filter(Boolean).length;
export const guessLanguage = text => SYLLABLE.test(text) ? 'ko' : KANA_KANJI.test(text) ? 'ja' : 'en';

/** Every fault as {code, message, fix, line?, scene?}. `scenes` are absolute start frames; `durationInFrames` null skips that check. */
export function checkNarration({timing, language, durationInFrames = null, fps = 30, scenes = [], rates = RATES, voiceExists = true}) {
  const findings = [];
  const frame = ms => Math.round(ms * fps / 1000);
  const lines = timing.lines.map(line => ({...line, startFrame: frame(line.startMs), endFrame: frame(line.endMs)}));
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i], next = lines[i + 1];
    if (line.endMs <= line.startMs) findings.push({code: 'line_empty', line: line.id, message: `'${line.id}' ends at or before it starts (${line.startMs}–${line.endMs} ms)`, fix: 'Give the line text and rerun npm run voice.'});
    if (next && next.startMs < line.endMs) findings.push({code: 'line_overlap', line: next.id, message: `'${next.id}' starts at ${next.startMs} ms while '${line.id}' speaks until ${line.endMs} ms`, fix: 'Lines are spoken one after another: rerun npm run voice so the timing comes from the measured audio, or raise gapMs.'});
    const seconds = (line.endMs - line.startMs) / 1000, count = units(line.text, language), limit = rates[language];
    if (seconds > 0 && count / seconds > limit) findings.push({code: 'line_too_fast', line: line.id, message: `'${line.id}' speaks ${count} ${UNIT[language]} in ${seconds.toFixed(2)} s (${(count / seconds).toFixed(1)}/s, limit ${limit}/s)`, fix: 'Split the line in two or lower the spec rate below 1, then rerun npm run voice.'});
    if (durationInFrames !== null && line.endFrame > durationInFrames) findings.push({code: 'line_past_end', line: line.id, message: `'${line.id}' ends at frame ${line.endFrame} but the composition has ${durationInFrames} frames`, fix: `Set durationInFrames to at least ${line.endFrame + fps} in entry.tsx and index.tsx (the final hold is 1 s), or cut the line.`});
    if (line.embed && next?.embed) findings.push({code: 'embed_adjacent', line: next.id, message: `'${line.id}' and '${next.id}' both promote a word (${line.embed}, ${next.embed})`, fix: 'Keep embeds at least one line apart: remove embed from one of them.'});
    for (const scene of scenes) if (scene > line.startFrame && scene < line.endFrame) findings.push({code: 'scene_inside_line', scene, line: line.id, message: `a scene starts at frame ${scene} while '${line.id}' speaks (frames ${line.startFrame}–${line.endFrame})`, fix: `Start the scene at frame ${line.startFrame} (useNarration().at('${line.id}')) or at the next line, and hold the picture while a line is speaking.`});
  }
  if (!voiceExists && lines.some(line => !line.estimated)) findings.push({code: 'voice_missing', message: `public/audio/generated/${timing.slug}/voice.wav is missing while the timing is measured`, fix: `Run npm run voice -- examples/samples/${timing.slug}/narration.json before rendering.`});
  return findings;
}

/** Scene starts from a prompt.md scene table: the first integer cell of each body row (a range like 120–240 gives 120). */
export function scenesFromPrompt(markdown) {
  const scenes = [];
  for (const row of markdown.split(/\r?\n/)) {
    if (!row.trim().startsWith('|') || /^\|[\s:|-]+\|$/.test(row.trim())) continue;
    const cell = row.split('|').slice(1, -1).map(c => c.trim()).find(c => /^\d+(\s*[–-]\s*\d+)?$/.test(c));
    if (cell) scenes.push(parseInt(cell));
  }
  return scenes;
}

function main(argv) {
  const flag = name => { const i = argv.indexOf(name); return i === -1 ? null : argv[i + 1]; };
  const folder = argv.find((arg, i) => !arg.startsWith('--') && !/^--(scenes|prompt|fps|rate-\w+)$/.test(argv[i - 1] ?? ''));
  if (!folder || !existsSync(folder)) { console.error('usage: npm run narration-check -- examples/samples/<slug> [--scenes a,b,c | --prompt prompt.md] [--fps 30] [--rate-ko 8] [--json]'); process.exit(2); }
  const root = dirname(dirname(fileURLToPath(import.meta.url)));
  const timingPath = join(folder, 'narration.timing.json');
  if (!existsSync(timingPath)) { console.error(`FAIL timing_missing: ${timingPath} does not exist\n  fix: write narration.json and run npm run voice -- ${join(folder, 'narration.json')}`); process.exit(1); }
  const timing = JSON.parse(readFileSync(timingPath, 'utf8'));
  const specPath = join(folder, 'narration.json');
  const language = existsSync(specPath) ? JSON.parse(readFileSync(specPath, 'utf8')).language : guessLanguage(timing.lines.map(line => line.text).join(' '));
  const entry = join(folder, 'entry.tsx');
  const duration = existsSync(entry) ? /durationInFrames=\{(\d+)\}/.exec(readFileSync(entry, 'utf8')) : null;
  const prompt = flag('--prompt');
  const scenes = flag('--scenes') ? flag('--scenes').split(',').map(Number) : prompt ? scenesFromPrompt(readFileSync(resolve(folder, prompt), 'utf8')) : [];
  const rates = {...RATES};
  for (const language of Object.keys(RATES)) if (flag(`--rate-${language}`)) rates[language] = Number(flag(`--rate-${language}`));
  const findings = checkNarration({timing, language, durationInFrames: duration ? Number(duration[1]) : null, fps: Number(flag('--fps') ?? 30), scenes, rates, voiceExists: existsSync(join(root, 'public', 'audio', 'generated', timing.slug, 'voice.wav'))});
  if (argv.includes('--json')) console.log(JSON.stringify({ok: findings.length === 0, language, lines: timing.lines.length, totalMs: timing.totalMs, scenes, findings}, null, 1));
  else {
    for (const f of findings) console.log(`FAIL ${f.code}: ${f.message}\n  fix: ${f.fix}`);
    console.log(findings.length ? `FAIL: ${findings.length} finding(s) in ${timingPath}` : `PASS: ${timing.lines.length} lines, ${timing.totalMs} ms, ${scenes.length} scene starts checked`);
  }
  process.exit(findings.length ? 1 : 0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
