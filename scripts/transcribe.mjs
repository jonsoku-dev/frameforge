import {spawnSync} from 'node:child_process';
import {createWriteStream, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename, dirname, extname, join, resolve} from 'node:path';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {fileURLToPath} from 'node:url';

// Speech to captions with whisper.cpp: the media is resampled to 16 kHz mono, whisper-cli writes its full JSON (segments with
// timed tokens), and the tokens become the engine's word Caption[] (text with the space before each word, startMs, endMs,
// timestampMs, confidence) plus an SRT with one cue per whisper segment. The model is fetched once into .cache/whisper/.
const project = fileURLToPath(new URL('../', import.meta.url));
const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
const MODELS = ['base', 'small'];
const LANGUAGES = ['ko', 'en', 'ja', 'auto'];
const modelUrl = model => `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-${model}.bin`;

/** whisper-cli's full JSON (`-ojf`) to word captions: a token that starts with a space opens a word, the rest (particles, punctuation)
 * extend it; special tokens like [_BEG_] are dropped. The last word of each segment carries pageBreakAfter so cues follow the segments. */
export function captionsFromWhisper(json) {
  const captions = [];
  for (const segment of json.transcription ?? []) {
    const words = [];
    for (const token of segment.tokens ?? []) {
      if (/^\[_.*\]$/.test(token.text) || token.text === '') continue;
      const open = words.at(-1);
      if (open && !token.text.startsWith(' ')) { open.text += token.text; open.endMs = token.offsets.to; open.confidence = Math.min(open.confidence, token.p); }
      else words.push({text: token.text, startMs: token.offsets.from, endMs: token.offsets.to, confidence: token.p});
    }
    for (const word of words) captions.push({...word, timestampMs: (word.startMs + word.endMs) / 2, confidence: Math.round(word.confidence * 1000) / 1000});
    if (words.length) captions.at(-1).pageBreakAfter = true;
  }
  return captions;
}

const pad = (value, size) => String(value).padStart(size, '0');
const stamp = ms => { const t = Math.floor(ms); return `${pad(Math.floor(t / 3600000), 2)}:${pad(Math.floor(t / 60000) % 60, 2)}:${pad(Math.floor(t / 1000) % 60, 2)},${pad(t % 1000, 3)}`; };
/** SubRip text, one cue per pageBreakAfter run; the same shape src/packages/captions.ts serializeSrt writes, so parseSrt reads it back. */
export function toSrt(captions) {
  const cues = [[]];
  for (const word of captions) { cues.at(-1).push(word); if (word.pageBreakAfter) cues.push([]); }
  return cues.filter(cue => cue.length).map((cue, index) => `${index + 1}\n${stamp(cue[0].startMs)} --> ${stamp(cue.at(-1).endMs)}\n${cue.map(word => word.text).join('').trimStart()}`).join('\n\n') + '\n';
}

/** WHISPER_CLI, else whisper-cli or whisper-cpp on PATH. */
export function findWhisper() {
  const candidates = process.env.WHISPER_CLI ? [process.env.WHISPER_CLI] : ['whisper-cli', 'whisper-cpp'];
  const found = candidates.find(command => spawnSync(command, ['--help'], {stdio: 'ignore'}).error?.code !== 'ENOENT');
  if (!found) throw new Error(`${candidates.join(' or ')} not found. Install whisper.cpp (macOS: brew install whisper-cpp) or set WHISPER_CLI=/path/to/whisper-cli.`);
  return found;
}

/** The ggml model file, downloaded once into .cache/whisper/ (base is about 148 MB, small about 488 MB). */
export async function modelPath(model) {
  if (!MODELS.includes(model)) throw new Error(`Unknown model ${model}; use ${MODELS.join(' or ')}.`);
  const file = join(project, '.cache', 'whisper', `ggml-${model}.bin`);
  if (existsSync(file)) return file;
  mkdirSync(dirname(file), {recursive: true});
  console.error(`downloading ${modelUrl(model)} to ${file}`);
  const response = await fetch(modelUrl(model));
  if (!response.ok || !response.body) throw new Error(`Model download failed: HTTP ${response.status} for ${modelUrl(model)}`);
  const partial = `${file}.part`;
  await pipeline(Readable.fromWeb(response.body), createWriteStream(partial));
  const expected = Number(response.headers.get('content-length'));
  if (expected && statSync(partial).size !== expected) { rmSync(partial, {force: true}); throw new Error(`Model download incomplete (${statSync(partial, {throwIfNoEntry: false})?.size ?? 0} of ${expected} bytes); run again.`); }
  renameSync(partial, file);
  return file;
}

/** Runs whisper on `media` and returns {captions, language}. */
export async function transcribe(media, {model = 'base', language = 'auto'} = {}) {
  if (!LANGUAGES.includes(language)) throw new Error(`Unknown language ${language}; use ${LANGUAGES.join(', ')}.`);
  if (!existsSync(media)) throw new Error(`no such file: ${media}`);
  const whisper = findWhisper();
  const modelFile = await modelPath(model);
  const scratch = mkdtempSync(join(tmpdir(), 'frameforge-transcribe-'));
  try {
    const wav = join(scratch, 'audio.wav');
    const extracted = spawnSync(ffmpeg, ['-v', 'error', '-y', '-i', media, '-vn', '-ac', '1', '-ar', '16000', '-f', 'wav', wav], {encoding: 'utf8'});
    if (extracted.status !== 0) throw new Error(`ffmpeg could not read ${media}: ${(extracted.stderr || extracted.error?.message || '').trim()}`);
    const ran = spawnSync(whisper, ['-m', modelFile, '-f', wav, '-l', language, '-np', '-ojf', '-of', join(scratch, 'out')], {encoding: 'utf8'});
    if (ran.status !== 0) throw new Error(`${whisper} exited ${ran.status}: ${(ran.stderr || '').trim().split('\n').pop()}`);
    const json = JSON.parse(readFileSync(join(scratch, 'out.json'), 'utf8'));
    return {captions: captionsFromWhisper(json), language: json.result?.language ?? language};
  } finally { rmSync(scratch, {recursive: true, force: true}); }
}

function selfCheck() {
  const fixture = JSON.parse(readFileSync(join(project, 'tests', 'fixtures', 'transcribe', 'yuna.json'), 'utf8'));
  const captions = captionsFromWhisper(fixture);
  const fail = message => { throw new Error(`transcribe self-check failed: ${message}`); };
  if (captions.map(word => word.text).join('|') !== ' 하루결은| 하루를| 한| 결로| 모읍니다.') fail(`words ${JSON.stringify(captions.map(word => word.text))}`);
  if (captions[0].startMs !== 50 || captions[0].endMs !== 380 || captions[0].timestampMs !== 215) fail(`first word timing ${JSON.stringify(captions[0])}`);
  if (captions[0].confidence !== 0.413) fail(`confidence should be the lowest token p, got ${captions[0].confidence}`);
  if (!captions.at(-1).pageBreakAfter || captions.some((word, index) => word.pageBreakAfter && index !== captions.length - 1)) fail('one segment gives one page break, on its last word');
  const srt = toSrt(captions);
  if (srt !== '1\n00:00:00,050 --> 00:00:02,000\n하루결은 하루를 한 결로 모읍니다.\n') fail(`srt\n${srt}`);
  if (captionsFromWhisper({transcription: [{tokens: [{text: '[_BEG_]', offsets: {from: 0, to: 0}, p: 1}]}]}).length !== 0) fail('a segment of special tokens yields no words');
  console.log('transcribe self-check ok');
}

async function main(argv) {
  if (argv.includes('--self-check')) return selfCheck();
  const flag = name => { const at = argv.indexOf(name); return at < 0 ? undefined : argv[at + 1]; };
  const media = argv.find((arg, index) => !arg.startsWith('--') && !/^--(model|language|out)$/.test(argv[index - 1] ?? ''));
  if (!media || argv.includes('--help')) { console.error('usage: node scripts/transcribe.mjs <media> [--model base|small] [--language ko|en|ja|auto] [--out captions.srt] [--json] [--self-check]'); process.exitCode = 2; return; }
  const out = flag('--out') ?? join(dirname(media), `${basename(media, extname(media))}.srt`);
  const {captions, language} = await transcribe(resolve(media), {model: flag('--model') ?? 'base', language: flag('--language') ?? 'auto'});
  writeFileSync(out, toSrt(captions));
  if (argv.includes('--json')) console.log(JSON.stringify(captions, null, 1));
  else console.error(`${out}: ${captions.length} words, language ${language}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
