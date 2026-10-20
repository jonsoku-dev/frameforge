import {copyFile, mkdir, mkdtemp, readdir, rename, rm} from 'node:fs/promises';
import {createWriteStream, existsSync} from 'node:fs';
import {dirname, extname, join} from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';

const ffmpeg = () => process.env.FFMPEG_PATH || 'ffmpeg';
const run = args => new Promise((resolveRun, reject) => {
  const child = spawn(ffmpeg(), args, {stdio: ['ignore', 'ignore', 'pipe']});
  let stderr = '';
  child.stderr.on('data', part => { stderr = (stderr + part).slice(-4000); });
  child.on('error', reject);
  child.on('exit', code => code === 0 ? resolveRun() : reject(new Error(`ffmpeg exited ${code}: ${stderr}`)));
});

/** Source time in seconds of composition-rate frame `frame`; a source frame shows while its interval covers this time. */
export const videoFrameTime = (frame, fps) => frame / fps;

/**
 * Writes `<outDir>/<frame>.png` for every requested frame, where frame N is the picture on screen at N / fps seconds
 * of the file. Frames past the end repeat the last picture, like a finished video holding its final frame.
 */
export async function extractVideoFrames({file, fps, frames, outDir}) {
  if (!(fps > 0)) throw new Error('extractVideoFrames needs a positive fps');
  if (!frames.length || frames.some(frame => !Number.isInteger(frame) || frame < 0)) throw new Error('extractVideoFrames needs non-negative integer frames');
  await mkdir(outDir, {recursive: true});
  const staging = await mkdtemp(join(outDir, '.extract-'));
  try {
    const first = Math.min(...frames), count = Math.max(...frames) - first + 1;
    // Seek up to one second early so the picture covering the first wanted time survives the accurate seek, then drop the lead.
    // Input seek restarts timestamps at the seek point; start_time=0 pins output frame k to source time (first - lead + k) / fps,
    // and round=up places each source picture in the first output slot at or after its own timestamp (the slot it covers).
    const lead = Math.min(first, Math.ceil(fps));
    // passthrough keeps the muxer from re-timing frames; without it the last kept frame can be replaced by a duplicate.
    // The seek rounds up to the microsecond: a seek a hair early would push every picture one slot late under round=up.
    const seek = Math.ceil(videoFrameTime(first - lead, fps) * 1e6) / 1e6;
    await run(['-v', 'error', '-ss', seek.toFixed(6), '-i', file, '-an', '-vf', `fps=fps=${fps}:round=up:start_time=0,trim=start_frame=${lead}`, '-fps_mode', 'passthrough', '-frames:v', String(count), '-start_number', String(first), join(staging, '%d.png')]);
    let written = (await readdir(staging)).filter(name => name.endsWith('.png')).map(name => Number(name.slice(0, -4)));
    if (!written.length) {
      // The whole range lies past the end: take the file's final picture.
      await run(['-v', 'error', '-sseof', '-1', '-i', file, '-an', '-update', '1', join(staging, `${first}.png`)]);
      written = [first];
    }
    const last = Math.max(...written);
    // Copy then rename, so a concurrent reader never sees a half-written PNG.
    for (const frame of frames) {
      const staged = join(staging, `out-${frame}`);
      await copyFile(join(staging, `${Math.min(frame, last)}.png`), staged);
      await rename(staged, join(outDir, `${frame}.png`));
    }
  } finally { await rm(staging, {recursive: true, force: true}); }
}

/** Where the dev server keeps a downloaded https file: `<root>/.cache/remote/<sha256 of the URL><ext>`. Refuses every other scheme. */
export function remoteCachePath(root, url) {
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error(`Remote media src is not a URL: ${url}`); }
  if (parsed.protocol !== 'https:') throw new Error(`Remote media src must be an https:// URL: ${url}`);
  const ext = extname(parsed.pathname).toLowerCase();
  return join(root, '.cache', 'remote', createHash('sha256').update(parsed.href).digest('hex') + (/^\.[a-z0-9]{1,5}$/.test(ext) ? ext : '.bin'));
}
const downloads = new Map();
/** Downloads an https `url` once into its cache path (concurrent callers share one download) and resolves to that path. */
export function downloadRemote(root, url) {
  const file = remoteCachePath(root, url);
  if (existsSync(file)) return Promise.resolve(file);
  if (!downloads.has(file)) downloads.set(file, (async () => {
    const response = await fetch(url);
    if (!response.ok || !response.body) throw new Error(`Downloading ${url} failed with HTTP ${response.status}`);
    if (!response.url.startsWith('https:')) throw new Error(`Downloading ${url} redirected off https to ${response.url}`);
    await mkdir(dirname(file), {recursive: true});
    // A partial file under the final name would be served as complete, so write aside and rename.
    const partial = `${file}.${process.pid}.part`;
    try { await pipeline(Readable.fromWeb(response.body), createWriteStream(partial)); await rename(partial, file); }
    catch (error) { await rm(partial, {force: true}); throw error; }
    return file;
  })().finally(() => downloads.delete(file)));
  return downloads.get(file);
}
/** ffmpeg `atempo` stages whose product is `rate`, each inside 0.5..2 (older ffmpeg builds reject factors outside it), each
 * followed by a comma so it prefixes a filter chain; '' at rate 1. */
export function atempoChain(rate) {
  if (!(rate >= 0.25 && rate <= 4)) throw new Error(`atempoChain needs a rate from 0.25 to 4, got ${rate}`);
  const stages = [];
  for (; rate > 2; rate /= 2) stages.push(2);
  for (; rate < 0.5; rate /= 0.5) stages.push(0.5);
  if (rate !== 1) stages.push(rate);
  return stages.map(stage => `atempo=${stage},`).join('');
}
