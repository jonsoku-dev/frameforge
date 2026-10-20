// The one write path for process.json (docs/studio/spec.md 3.2, 3.7). The studio server imports append(); agents use the CLI.
import {closeSync, existsSync, openSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync} from 'node:fs';
import {basename, dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const KINDS = ['author', 'review', 'fix', 'render', 'check', 'capture', 'request'];
const ARTIFACT_KINDS = ['sheet', 'mp4', 'still', 'review', 'log'];

/** A folder means <folder>/process.json; a path ending in .json is used as is (e.g. a standalone <name>.process.json). */
export const processPath = target => target.endsWith('.json') ? target : join(target, 'process.json');

export function validateRun(run, ids = new Set()) {
  const fail = message => { throw new Error(`run ${run?.id ?? '?'}: ${message}`); };
  if (!run || typeof run !== 'object' || Array.isArray(run)) fail('must be an object');
  if (typeof run.id !== 'string' || !/^r\d{2,}$/.test(run.id) || ids.has(run.id)) fail('id must be a unique r<NN>');
  if (typeof run.at !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?(Z|[+-]\d\d:\d\d)$/.test(run.at)) fail('at must be ISO 8601 with a time zone');
  if (typeof run.actor !== 'string' || !run.actor) fail('actor must be a non-empty string');
  if (!KINDS.includes(run.kind)) fail(`kind must be one of ${KINDS.join(', ')}`);
  if (typeof run.summary !== 'string' || !run.summary || run.summary.length > 300) fail('summary must be 1-300 characters');
  if (run.prompt !== undefined && (typeof run.prompt !== 'object' || (typeof run.prompt.path !== 'string' && typeof run.prompt.text !== 'string'))) fail('prompt needs path or text');
  if (!Array.isArray(run.artifacts)) fail('artifacts must be an array');
  for (const a of run.artifacts) {
    if (!ARTIFACT_KINDS.includes(a?.kind) || typeof a.path !== 'string') fail(`artifact needs kind (${ARTIFACT_KINDS.join(', ')}) and path`);
    if (a.frames !== undefined && !(Array.isArray(a.frames) && a.frames.every(Number.isInteger))) fail('artifact frames must be integers');
  }
  if (run.frame !== undefined && !Number.isInteger(run.frame)) fail('frame must be an integer');
  for (const key of ['changes', 'resolves']) if (run[key] !== undefined && !(Array.isArray(run[key]) && run[key].every(s => typeof s === 'string'))) fail(`${key} must be an array of strings`);
  // from is optional: some review findings (a font fallback, number formatting) name no frame range.
  if (run.findings !== undefined && !(Array.isArray(run.findings) && run.findings.every(f => typeof f?.id === 'string' && typeof f.text === 'string' && [f.from, f.to].every(v => v === undefined || Number.isInteger(v))))) fail('findings must be {id, from?, to?, text}');
  if (run.metrics !== undefined && (typeof run.metrics !== 'object' || Array.isArray(run.metrics))) fail('metrics must be an object');
  const has = kind => run.artifacts.some(a => a.kind === kind);
  if (run.kind === 'render' && !has('mp4') && !has('sheet')) fail('render needs an mp4 or sheet artifact');
  if (run.kind === 'check' && typeof run.metrics?.of !== 'string') fail('check needs metrics.of');
  if (run.kind === 'capture' && !has('still')) fail('capture needs a still artifact');
  // frame stays optional on request: the composer offers 프레임 없음 (spec 4.4) although the 3.2 table lists it.
  if (run.kind === 'request' && typeof run.prompt?.text !== 'string') fail('request needs prompt.text');
  return run;
}

export function validate(doc) {
  if (!doc || typeof doc !== 'object' || typeof doc.brief !== 'string') throw new Error('process.json needs a brief path');
  if (doc.audio !== undefined && typeof doc.audio !== 'string') throw new Error('audio must be a path');
  if (!Array.isArray(doc.runs)) throw new Error('runs must be an array');
  const ids = new Set();
  for (const run of doc.runs) ids.add(validateRun(run, ids).id);
  return doc;
}

function read(file) {
  if (existsSync(file)) return validate(JSON.parse(readFileSync(file, 'utf8')));
  const audio = file.endsWith('/process.json') && existsSync(join(dirname(file), 'audio.json')) ? 'audio.json' : undefined;
  return {brief: 'prompt.md', ...(audio ? {audio} : {}), runs: []};
}

function write(file, doc) {
  const tmp = join(dirname(file), `.${basename(file)}.${process.pid}.${Date.now()}.tmp`);
  writeFileSync(tmp, JSON.stringify(doc, null, 2) + '\n');
  renameSync(tmp, file);
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function withLock(file, task) {
  const lock = `${file}.lock`;
  for (const started = Date.now(); ;) {
    try { closeSync(openSync(lock, 'wx')); break; } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      try { if (Date.now() - statSync(lock).mtimeMs > 10_000) { unlinkSync(lock); continue; } } catch { continue; }
      if (Date.now() - started > 2000) throw new Error(`${lock} is held by another writer`);
      await sleep(50);
    }
  }
  try { return task(); } finally { unlinkSync(lock); }
}

/** Local time with its offset, e.g. 2026-10-20T14:22:33+09:00. */
export function localIso(date = new Date()) {
  const offset = -date.getTimezoneOffset();
  const pad = n => String(Math.floor(Math.abs(n))).padStart(2, '0');
  const local = new Date(date.getTime() + offset * 60_000).toISOString().slice(0, 19);
  return `${local}${offset >= 0 ? '+' : '-'}${pad(offset / 60)}:${pad(offset % 60)}`;
}

/** Appends one run under the lock and returns it with its new id. Missing at, artifacts, and finding ids are filled. */
export function append(target, input) {
  const file = processPath(target);
  return withLock(file, () => {
    const doc = read(file);
    const next = doc.runs.reduce((max, r) => Math.max(max, Number(r.id.slice(1))), 0) + 1;
    const id = `r${String(next).padStart(2, '0')}`;
    const run = {id, at: localIso(), ...input, artifacts: input.artifacts ?? []};
    run.id = id;
    if (run.findings) run.findings = run.findings.map((f, i) => ({id: `${id}-${i + 1}`, ...f}));
    validateRun(run, new Set(doc.runs.map(r => r.id)));
    doc.runs.push(run);
    write(file, doc);
    return run;
  });
}

/** Creates the file if it is missing; an existing file is only validated. */
export function init(target, fields = {}) {
  const file = processPath(target);
  return withLock(file, () => {
    if (existsSync(file)) return validate(JSON.parse(readFileSync(file, 'utf8')));
    const {runs, ...head} = read(file);
    const doc = {...head, ...fields, runs};
    write(file, validate(doc));
    return doc;
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [command, target, json] = process.argv.slice(2);
  const usage = 'usage: node scripts/process.mjs init <folder> | append <folder> <json-run> | validate <folder>';
  try {
    if (!target) throw new Error(usage);
    if (command === 'init') console.log(JSON.stringify(await init(target)));
    else if (command === 'append') console.log(JSON.stringify(await append(target, JSON.parse(json ?? ''))));
    else if (command === 'validate') console.log(`${processPath(target)}: ok, ${validate(JSON.parse(readFileSync(processPath(target), 'utf8'))).runs.length} runs`);
    else throw new Error(usage);
  } catch (error) {
    console.error(`${processPath(target ?? '.')}: ${error.message}`);
    process.exit(1);
  }
}
