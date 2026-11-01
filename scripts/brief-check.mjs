#!/usr/bin/env node
// Checks a film's brief.md (the intent ledger written before the concept): npm run brief-check -- examples/samples/<slug> [--json]
import {existsSync, readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export const KINDS = ['must', 'forbid', 'taste', 'implied'];

/** The body under `## <name>` up to the next `## ` heading, HTML comments removed; null when the heading is absent. */
export function section(markdown, name) {
  const lines = markdown.replace(/<!--[\s\S]*?-->/g, '').split(/\r?\n/);
  const start = lines.findIndex(line => line.trim().toLowerCase() === `## ${name}`.toLowerCase());
  if (start < 0) return null;
  const end = lines.findIndex((line, i) => i > start && /^##\s/.test(line));
  return lines.slice(start + 1, end < 0 ? undefined : end).join('\n').trim();
}

/** The verbatim request: the section text without blockquote markers or code fences. */
export const requestText = body => body.split('\n').filter(line => !/^\s*```/.test(line)).map(line => line.replace(/^\s*>\s?/, '')).join('\n').trim();

/** Ledger rows as {clause, kind, means, verify} from the first markdown table in the section (header and separator skipped). */
export function ledgerRows(body) {
  const rows = body.split('\n').map(line => line.trim()).filter(line => line.startsWith('|') && !/^\|[\s:|-]+\|$/.test(line));
  return rows.slice(1).map(row => {
    const [clause = '', kind = '', means = '', verify = ''] = row.replace(/^\||\|$/g, '').split('|').map(cell => cell.trim());
    return {clause: clause.replace(/^["“”'`]+|["“”'`]+$/g, ''), kind: kind.toLowerCase(), means, verify};
  });
}

export const words = text => text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
/** Sentences end at . ! ? or 。 followed by whitespace or the end, so "Opus 5.5" stays whole. */
export const sentences = text => text.split(/(?<=[.!?。！？])\s+|\n+/).map(s => s.trim()).filter(s => words(s).length);

const empty = cell => !cell || /^(todo|tbd|n\/a)\b|^[-—]+$/i.test(cell);

// Only interpret ranges with a duration unit at the end. A unit on the first
// endpoint is optional (10–15s, 10s–15s); "between ... and ..." is explicit.
const SECOND_UNIT = '(?:(?:seconds?|secs?|s)(?![\\p{L}])|초)';
const VALUE = '(\\d+(?:\\.\\d+)?)';
const durationRange = new RegExp(`(?<![\\d.\\-–—~～])(?:\\bbetween\\s+${VALUE}\\s+and\\s+${VALUE}|${VALUE}(?:\\s*${SECOND_UNIT})?\\s*(?:[-–—~～]|\\bto\\b|에서|부터)\\s*${VALUE})[\\s-]*${SECOND_UNIT}`, 'iu');
const durationValue = new RegExp(`${VALUE}[\\s-]*${SECOND_UNIT}`, 'iu');
const durationChoice = new RegExp(`${VALUE}\\s*(?:or|또는|혹은|/)\\s*${VALUE}[\\s-]*${SECOND_UNIT}`, 'iu');
// Do not silently treat the seconds component of a mixed minute/second
// expression as the complete film duration.
const minuteValue = /\d+(?:\.\d+)?\s*(?:(?:minutes?|mins?|m)(?![\p{L}])|분)/iu;

/** Numbers a must clause states, compared with the registered composition {durationInFrames, fps, width, height}. */
export function numberFindings(clause, composition) {
  const out = [];
  const {durationInFrames, fps, width, height} = composition;
  const range = durationRange.exec(clause);
  const seconds = durationValue.exec(clause);
  if (range && durationInFrames && fps) {
    const lo = Number(range[1] ?? range[3]), hi = Number(range[2] ?? range[4]);
    const actual = durationInFrames / fps;
    if (!(Number.isFinite(lo) && Number.isFinite(hi) && lo > 0 && lo <= hi))
      out.push({code: 'duration_range_invalid', message: `"${clause}" has an invalid duration range ${range[0]}`, fix: 'State an ordered, positive duration range in seconds.'});
    else if (minuteValue.test(clause) || durationValue.test(clause.slice(0, range.index)) || durationValue.test(clause.slice(range.index + range[0].length)))
      out.push({code: 'duration_ambiguous', message: `"${clause}" contains a duration range and another duration`, fix: 'Separate the total duration from other timing requirements into unambiguous ledger clauses and verify each in context.'});
    else if (actual < lo || actual > hi)
      out.push({code: 'duration_mismatch', message: `"${clause}" says ${lo}–${hi} s but the composition runs ${durationInFrames}/${fps} = ${actual.toFixed(2)} s`, fix: `Set durationInFrames to a whole-frame duration between ${lo} and ${hi} seconds in entry.tsx and the films index.`});
  } else if (seconds && durationInFrames && fps && (minuteValue.test(clause) || durationChoice.test(clause) || [...clause.matchAll(new RegExp(durationValue.source, 'giu'))].length > 1))
    out.push({code: 'duration_ambiguous', message: `"${clause}" contains multiple durations without an explicit range`, fix: 'Separate the total duration from other timing requirements into unambiguous ledger clauses and verify each in context.'});
  else if (seconds && durationInFrames && fps && Math.abs(durationInFrames / fps - Number(seconds[1])) >= 0.5)
    out.push({code: 'duration_mismatch', message: `"${clause}" says ${seconds[1]} s but the composition runs ${durationInFrames}/${fps} = ${(durationInFrames / fps).toFixed(2)} s`, fix: `Set durationInFrames to ${Math.round(Number(seconds[1]) * fps)} in entry.tsx and the films index.`});
  const size = /(\d{3,4})\s*[x×]\s*(\d{3,4})/.exec(clause);
  if (size && width && (Number(size[1]) !== width || Number(size[2]) !== height))
    out.push({code: 'size_mismatch', message: `"${clause}" says ${size[1]}x${size[2]} but the composition is ${width}x${height}`, fix: 'Match width and height in entry.tsx and the films index.'});
  const rate = /(\d+)\s*fps/i.exec(clause);
  if (rate && fps && Number(rate[1]) !== fps)
    out.push({code: 'fps_mismatch', message: `"${clause}" says ${rate[1]} fps but the composition runs at ${fps}`, fix: 'Match fps in entry.tsx and the films index (and scale durationInFrames).'});
  return out;
}

/** Every fault as {code, message, fix}. `composition` comes from entry.tsx; missing values skip the number checks. */
export function checkBrief(markdown, composition = {}) {
  const findings = [];
  const request = requestText(section(markdown, 'Request') ?? '');
  if (!words(request).length) findings.push({code: 'request_empty', message: '## Request is missing or empty', fix: "Paste the user's request verbatim under ## Request."});
  const ledger = section(markdown, 'Intent ledger');
  const rows = ledger === null ? [] : ledgerRows(ledger);
  if (!rows.length) findings.push({code: 'ledger_empty', message: '## Intent ledger has no rows', fix: 'One row per clause of the request: | clause | kind | means | verify |.'});
  for (const name of ['Engine translation', 'Gaps']) if (!words(section(markdown, name) ?? '').length) findings.push({code: 'section_missing', message: `## ${name} is missing or empty`, fix: name === 'Gaps' ? 'Write "None." when nothing is missing.' : 'Write the optimized brief in engine vocabulary.'});
  for (const row of rows) {
    if (!KINDS.includes(row.kind)) findings.push({code: 'row_kind', message: `"${row.clause}" has kind "${row.kind}"`, fix: `Kind is one of ${KINDS.join(', ')}.`});
    if (empty(row.means)) findings.push({code: 'row_no_means', message: `"${row.clause}" has no engine means`, fix: 'Name the preset, block, seam, audio field or format value that satisfies it.'});
    if (empty(row.verify)) findings.push({code: 'row_no_verify', message: `"${row.clause}" has no verification`, fix: 'Name the scene id or frame range, or the check that proves it.'});
    if (row.kind === 'must') findings.push(...numberFindings(row.clause, composition));
  }
  const clauses = rows.filter(row => row.kind !== 'implied').map(row => words(row.clause)).filter(w => w.length);
  for (const sentence of sentences(request)) {
    const own = words(sentence), joined = ` ${own.join(' ')} `;
    if (clauses.some(clause => ` ${clause.join(' ')} `.includes(joined))) continue;
    const set = new Set(own), covered = new Set();
    for (const clause of clauses) if (clause.every(word => set.has(word))) clause.forEach(word => covered.add(word));
    const missing = [...new Set(own.filter(word => !covered.has(word)))];
    if (missing.length) findings.push({code: 'request_uncovered', message: `no ledger clause covers "${sentence}" (missing: ${missing.join(', ')})`, fix: 'Add a row quoting the uncovered part exactly, or split the sentence across rows.'});
  }
  return findings;
}

/** durationInFrames, fps, width and height of the first <Composition> in entry.tsx. */
export function compositionOf(entry) {
  const value = name => { const m = new RegExp(`${name}=\\{(\\d+)\\}`).exec(entry); return m ? Number(m[1]) : undefined; };
  return {durationInFrames: value('durationInFrames'), fps: value('fps'), width: value('width'), height: value('height')};
}

function main(argv) {
  const folder = argv.find(arg => !arg.startsWith('--'));
  if (!folder || !existsSync(folder)) { console.error('usage: npm run brief-check -- examples/samples/<slug> [--json]'); process.exit(2); }
  const file = join(folder, 'brief.md');
  // predates the brief step: in-repo samples and films copied from a project template made before it
  if (!existsSync(file)) { console.log(`SKIP: ${file} 없음 (브리프 단계 이전 작품; 새 작품은 examples/samples/_template/brief.md를 복사)`); process.exit(0); }
  const entry = join(folder, 'entry.tsx');
  const composition = existsSync(entry) ? compositionOf(readFileSync(entry, 'utf8')) : {};
  const findings = checkBrief(readFileSync(file, 'utf8'), composition);
  if (argv.includes('--json')) console.log(JSON.stringify({ok: findings.length === 0, composition, findings}, null, 1));
  else {
    for (const f of findings) console.log(`FAIL ${f.code}: ${f.message}\n  fix: ${f.fix}`);
    console.log(findings.length ? `FAIL: ${findings.length} finding(s) in ${file}` : `PASS: ${file}`);
  }
  process.exit(findings.length ? 1 : 0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
