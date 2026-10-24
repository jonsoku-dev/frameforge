import {existsSync, constants} from 'node:fs';
import {mkdir, mkdtemp, rm, link, copyFile, readFile, writeFile} from 'node:fs/promises';
import {setTimeout as sleep} from 'node:timers/promises';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {basename, dirname, resolve, join, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn, spawnSync} from 'node:child_process';
import {writeArtifacts} from './artifacts.mjs';
import {atempoChain, remoteCachePath} from './video-frames.mjs';

const project = fileURLToPath(new URL('../', import.meta.url));
const ffmpegPath = () => process.env.FFMPEG_PATH || 'ffmpeg';
// PNG is sRGB; without an explicit bt709 matrix and tags, 1080p players guess and saturated greens drift.
const bt709 = pix => `scale=out_color_matrix=bt709:out_range=tv,format=${pix},setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv`;
/** Output containers by extension: their default codec and audio codec, and the muxer flags added to every encode and concat. */
const CONTAINERS = {
  mp4: {codec: 'h264', audio: 'aac', mux: ['-movflags', '+faststart']},
  webm: {codec: 'vp9', audio: 'opus', mux: []},
  mov: {codec: 'prores', audio: 'pcm', mux: ['-movflags', '+faststart']},
  gif: {codec: 'gif', audio: 'none', mux: []},
  png: {codec: 'png', audio: 'none', mux: []},
};
/** Pixel formats per codec as [opaque, with alpha]; null means the codec cannot carry alpha. `chunked`: segments concat with -c copy. */
const CODECS = {
  h264: {pix: ['yuv420p', null], crf: 18, containers: ['mp4', 'mov'], chunked: true},
  vp9: {pix: ['yuv420p', 'yuva420p'], crf: 32, containers: ['webm'], chunked: true},
  prores: {pix: ['yuv444p10le', 'yuva444p10le'], crf: null, containers: ['mov'], chunked: true},
  gif: {pix: ['pal8', 'pal8'], crf: null, containers: ['gif'], chunked: false},
  png: {pix: ['rgb24', 'rgba'], crf: null, containers: ['png'], chunked: false},
};
export const AUDIO = {aac: ['-c:a', 'aac', '-b:a', '192k'], opus: ['-c:a', 'libopus', '-b:a', '160k'], pcm: ['-c:a', 'pcm_s16le'], none: []};
/** The output format for an output path: container from its extension (a trailing `/` or `%0Nd` is a PNG sequence), codec and audio by
 * container unless overridden, the pixel format by codec and `transparent`. Throws for combinations ffmpeg cannot write. */
export function outputFormat(output, {codec, audioCodec, transparent = false, crf, gifFps} = {}) {
  const sequence = output.endsWith('/') || /%0\d+d/.test(basename(output));
  const name = basename(output), dot = name.lastIndexOf('.');
  const container = sequence ? 'png' : dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
  const spec = CONTAINERS[container];
  if (!spec) throw new Error(`Unknown output ${output}; use .mp4, .webm, .mov, .gif or a PNG sequence (a folder/ or frames/%05d.png).`);
  if (container === 'png' && !sequence) throw new Error('A .png output needs --frames (contact sheet) or a sequence pattern (a folder/ or %05d.png).');
  const chosen = CODECS[codec ?? spec.codec];
  if (!chosen) throw new Error(`Unknown codec ${codec}; use ${Object.keys(CODECS).join(', ')}.`);
  if (!chosen.containers.includes(container)) throw new Error(`${codec} does not go into .${container}; use .${chosen.containers.join(' or .')}.`);
  const pixFmt = chosen.pix[transparent ? 1 : 0];
  if (!pixFmt) throw new Error(`${codec ?? spec.codec} cannot carry alpha; render --transparent to .webm, .mov, .gif or a PNG sequence.`);
  const audio = spec.audio === 'none' ? 'none' : audioCodec ?? spec.audio;
  if (!AUDIO[audio]) throw new Error(`Unknown audio codec ${audio}; use aac, opus, pcm or none.`);
  if (gifFps !== undefined && !(gifFps > 0)) throw new Error('--gif-fps must be a positive number.');
  return {container, codec: codec ?? spec.codec, pixFmt, audio, sequence, transparent, crf: crf ?? chosen.crf, gifFps, mux: spec.mux, chunked: chosen.chunked};
}
/** ffmpeg video arguments for a format; `size` (the scaled output size) adds a resample so every frame lands at that size. */
export function videoArgs({codec, pixFmt, crf, gifFps, transparent}, count, size) {
  const vf = pix => `${size ? `scale=${size.width}:${size.height},` : ''}${bt709(pix)}`;
  const tags = ['-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709'];
  switch (codec) {
    case 'h264': return ['-frames:v', String(count), '-vf', vf('yuv420p'), '-c:v', 'libx264', '-crf', String(crf), '-preset', 'slow', '-x264-params', 'colorprim=bt709:transfer=bt709:colormatrix=bt709:range=tv'];
    case 'vp9': return ['-frames:v', String(count), '-vf', vf(pixFmt), '-c:v', 'libvpx-vp9', '-pix_fmt', pixFmt, '-b:v', '0', '-crf', String(crf), '-row-mt', '1', ...(transparent ? ['-auto-alt-ref', '0'] : []), ...tags];
    case 'prores': return ['-frames:v', String(count), '-vf', vf(pixFmt), '-c:v', 'prores_ks', '-profile:v', '4', '-pix_fmt', pixFmt, '-vendor', 'apl0', ...tags];
    // Two passes over the frames in one command: the palette from the whole sequence, then the mapping.
    case 'gif': return ['-filter_complex', `[0:v]${gifFps ? `fps=${gifFps},` : ''}split[a][b];[a]palettegen=reserve_transparent=${transparent ? 1 : 0}[p];[b][p]paletteuse=dither=bayer:bayer_scale=3${transparent ? ':alpha_threshold=128' : ''}`, '-loop', '0'];
    default: throw new Error(`${codec} is written as files, not encoded.`);
  }
}
/** Each clip is seeked, trimmed, delayed to its first mounted frame (minus `offset`, the first output frame), and summed without normalization. */
export function encodeArgs(video, encode, fps, count, segments, output, offset = 0, audio = AUDIO.aac) {
  if (!segments.length || !audio.length) return ['-n', ...video, ...encode, output];
  const publicDirectory = join(project, 'public');
  const inputs = [], chains = [];
  for (const [index, {clip, first, last}] of segments.entries()) {
    // A clip from an https:// Video was downloaded once into .cache/remote by the frame server; everything else lives under public/.
    const remote = /^https:\/\//i.test(clip.src);
    const file = remote ? remoteCachePath(project, clip.src) : resolve(publicDirectory, '.' + decodeURIComponent(clip.src));
    if ((!remote && !file.startsWith(publicDirectory + sep)) || !existsSync(file)) throw new Error(`Audio src must name a file under public/ or a downloaded https:// URL: ${clip.src}`);
    const seconds = frame => (frame / fps).toFixed(6);
    const rate = clip.playbackRate ?? 1;
    inputs.push('-ss', seconds(clip.trimBefore + (first - clip.startFrame) * rate), '-t', seconds((last - first + 1) * rate), '-i', file);
    const delay = Math.round((first - offset) / fps * 1000);
    // Derived motion sounds carry a pan (-1..1); constant-power so a centred sound keeps its level.
    const pan = segments[index].pan ? `,pan=stereo|c0=${(Math.cos((segments[index].pan + 1) * Math.PI / 4) * Math.SQRT2).toFixed(4)}*c0|c1=${(Math.sin((segments[index].pan + 1) * Math.PI / 4) * Math.SQRT2).toFixed(4)}*c1` : '';
    chains.push(`[${index + 1}:a]${atempoChain(rate)}volume=${clip.volume}${pan},adelay=${delay}|${delay}[a${index}]`);
  }
  // Three stems: voice (the narration file), music (other clips mounted at frame 0) and effects. Music ducks under voice
  // (slow release, so speech sits on top of the bed) and under the effects stem so each effect reads as an event, not a splice.
  const voice = segments.map((segment, index) => /\/voice\.wav$/i.test(segment.clip.src) ? index : -1).filter(index => index >= 0);
  const music = segments.map((segment, index) => segment.clip.startFrame === 0 && !voice.includes(index) ? index : -1).filter(index => index >= 0);
  const effects = segments.map((_, index) => index).filter(index => !music.includes(index) && !voice.includes(index));
  const label = list => list.map(index => `[a${index}]`).join('');
  const sum = (list, out) => list.length === 1 ? `${label(list)}acopy[${out}]` : `${label(list)}amix=inputs=${list.length}:normalize=0:dropout_transition=0[${out}]`;
  const duck = (bed, key, out, release) => `[${key}]asplit[${key}key][${key}out];[${bed}][${key}key]sidechaincompress=threshold=0.02:ratio=4:attack=5:release=${release}:level_sc=1[${out}]`;
  const stems = [];
  let bed = null;
  if (music.length) { stems.push(sum(music, 'music')); bed = 'music'; }
  if (voice.length) { stems.push(sum(voice, 'vo')); if (bed) { stems.push(duck(bed, 'vo', 'underv', 250)); bed = 'underv'; } }
  if (effects.length) { stems.push(sum(effects, 'fx')); if (bed) { stems.push(duck(bed, 'fx', 'ducked', 180)); bed = 'ducked'; } }
  const outs = [bed, voice.length ? (bed && bed !== 'vo' ? 'voout' : null) : null, effects.length ? (bed && bed !== 'fx' ? 'fxout' : null) : null].filter(Boolean);
  const mix = outs.length > 1
    ? `${chains.join(';')};${stems.join(';')};${outs.map(out => `[${out}]`).join('')}amix=inputs=${outs.length}:normalize=0:dropout_transition=0,apad[mix]`
    : `${chains.join(';')};${label(segments.map((_, index) => index))}amix=inputs=${segments.length}:normalize=0:dropout_transition=0,apad[mix]`;
  return ['-n', ...video, ...inputs, '-filter_complex', mix, '-map', '0:v', '-map', '[mix]', ...encode, ...audio, '-ar', '48000', '-ac', '2', '-t', (count / fps).toFixed(6), output];
}
/** Sound effects stacked closer than half a second, or more than three inside any four seconds, read as splices rather than
 * events. `starts` are the first frames of every clip that is not the root music (startFrame 0). Returns the fault or null. */
export function sfxFault(starts, fps) {
  const sorted = [...starts].sort((x, y) => x - y);  // two effects on one frame are the worst splice, so no dedupe
  for (let i = 1; i < sorted.length; i++) if (sorted[i] - sorted[i - 1] < fps / 2) return `Sound effects ${((sorted[i] - sorted[i - 1]) / fps).toFixed(2)} s apart at ${(sorted[i - 1] / fps).toFixed(2)} s; keep them 0.5 s or more apart`;
  for (let i = 0; i + 3 < sorted.length; i++) if (sorted[i + 3] - sorted[i] < fps * 4) return `Four sound effects within 4 s from ${(sorted[i] / fps).toFixed(2)} s; at most three per 4 s`;
  return null;
}
/** Contiguous chunks of the inclusive range [from, to], at most `concurrency`, none shorter than 2 s; sizes differ by at most one frame. */
export function splitFrames(from, to, concurrency, fps) {
  const count = to - from + 1;
  const n = Math.max(1, Math.min(concurrency, Math.floor(count / (2 * fps))));
  const chunks = [];
  for (let index = 0, start = from; index < n; index++) {
    const size = Math.floor(count / n) + (index < count % n ? 1 : 0);
    chunks.push({index, start, end: start + size - 1});
    start += size;
  }
  return chunks;
}
/** Joins per-chunk audio segment lists (in chunk order): a segment that resumes the previous frame of the same key extends it. */
export function mergeSegments(lists) {
  const merged = [], latest = new Map();
  for (const segment of lists.flat()) {
    const previous = latest.get(segment.clip.key);
    if (previous && previous.last === segment.first - 1) previous.last = segment.last;
    else { const copy = {...segment}; merged.push(copy); latest.set(segment.clip.key, copy); }
  }
  return merged;
}
const run = (command, args) => new Promise((resolveRun, reject) => {
  const child = spawn(command, args, {stdio: ['ignore', 'ignore', 'pipe']});
  let stderr = '';
  child.stderr.on('data', (part) => { stderr = (stderr + part).slice(-8000); });
  child.on('error', reject);
  child.on('exit', (code) => code === 0 ? resolveRun() : reject(new Error(`${command} exited ${code}: ${stderr}`)));
});

/** One headless Chrome with its own profile, connected over DevTools, navigated to the render page and configured with `inputProps`. */
async function openPage(chrome, url, inputProps, profile) {
  // shortcut: window starts at 1920x1080 because the composition size is only known after configure; the device-metrics override sets the real size.
  const browser = spawn(chrome, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--window-size=1920,1080', '--hide-scrollbars', '--force-device-scale-factor=1', '--disable-background-networking', '--no-first-run', '--enable-blink-features=CanvasDrawElement', 'about:blank'], {stdio: 'ignore'});
  browser.on('error', () => {});
  let socket;
  const close = async () => {
    socket?.close();
    if (browser.exitCode === null && browser.signalCode === null) {
      const exited = new Promise(done => browser.once('exit', done));
      browser.kill('SIGTERM');
      if (await Promise.race([exited.then(() => true), sleep(2000)]) !== true) { browser.kill('SIGKILL'); await exited; }
    }
  };
  try {
    let port;
    for (const deadline = Date.now() + 10000; !port; await sleep(50)) {
      if (Date.now() > deadline) throw new Error('Chrome did not write DevToolsActivePort within 10 s.');
      port = await readFile(join(profile, 'DevToolsActivePort'), 'utf8').then(text => text.includes('\n') && text.split('\n')[0], () => undefined);
    }
    const target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(item => item.type === 'page');
    if (!target) throw new Error('Chrome exposed no page target.');
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((open, fail) => { socket.onopen = open; socket.onerror = () => fail(new Error('Could not connect to Chrome DevTools.')); });
    let nextId = 0;
    const pending = new Map(), listeners = {}, pageErrors = [];
    socket.onmessage = ({data}) => {
      const message = JSON.parse(data);
      if (!message.id) return listeners[message.method]?.(message.params);
      const call = pending.get(message.id); if (!call) return; pending.delete(message.id);
      message.error ? call.reject(new Error(`${call.method}: ${message.error.message}`)) : call.resolve(message.result);
    };
    socket.onclose = () => { for (const call of pending.values()) call.reject(new Error('Chrome DevTools connection closed.')); pending.clear(); };
    // A page reload mid-call (e.g. Vite HMR) can leave a call unanswered; fail instead of hanging. 120 s exceeds settle()'s three 30 s waits.
    const send = (method, params = {}) => new Promise((resolveSend, reject) => {
      const id = ++nextId;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out after 120 s.`)); }, 120000);
      pending.set(id, {method, resolve: value => { clearTimeout(timer); resolveSend(value); }, reject: error => { clearTimeout(timer); reject(error); }});
      socket.send(JSON.stringify({id, method, params}));
    });
    listeners['Runtime.exceptionThrown'] = ({exceptionDetails}) => pageErrors.push(exceptionDetails.exception?.description || exceptionDetails.text);
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Page.addScriptToEvaluateOnNewDocument', {source: `window.__FRAMEFORGE_INPUT__ = ${JSON.stringify(inputProps)};`});
    const loaded = new Promise(done => { listeners['Page.loadEventFired'] = done; });
    const navigation = await send('Page.navigate', {url: url.href});
    if (navigation.errorText) throw new Error(`Navigation failed: ${navigation.errorText}`);
    await loaded;
    for (const deadline = Date.now() + 30000; !(await send('Runtime.evaluate', {expression: '!!(window.__FRAMEFORGE__ || window.__FRAMEFORGE_ERROR__)', returnByValue: true})).result.value; await sleep(50)) {
      if (Date.now() > deadline) throw new Error('Timed out after 30 s waiting for window.__FRAMEFORGE__.');
    }
    const configured = await send('Runtime.evaluate', {expression: `(async (props) => {
      if (!window.__FRAMEFORGE__) return {error: window.__FRAMEFORGE_ERROR__, compositions: null};
      const compositions = await window.__FRAMEFORGE__.configure(props);
      return {error: window.__FRAMEFORGE_ERROR__, compositions};
    })(${JSON.stringify(inputProps)})`, awaitPromise: true, returnByValue: true});
    if (configured.exceptionDetails) throw new Error(configured.exceptionDetails.exception?.description || configured.exceptionDetails.text);
    const registry = configured.result.value;
    if (registry.error) throw new Error(registry.error);
    const evaluate = async expression => (await send('Runtime.evaluate', {expression, returnByValue: true})).result?.value;
    return {send, evaluate, pageErrors, registry, close};
  } catch (error) { await close(); throw error; }
}

/** Renders one frame and returns its capture hints; page errors fail the frame. */
async function renderFrame(page, id, frame, inputProps) {
  const rendered = await page.send('Runtime.evaluate', {expression: `window.__FRAMEFORGE__.renderFrame(${JSON.stringify(id)}, ${frame}, ${JSON.stringify(inputProps)})`, awaitPromise: true, returnByValue: true});
  if (rendered.exceptionDetails) page.pageErrors.push(rendered.exceptionDetails.exception?.description || rendered.exceptionDetails.text);
  if (page.pageErrors.length) throw new Error(`Composition error: ${page.pageErrors.join('; ')}`);
  return rendered.result?.value ?? {skip: false, clip: null};
}
// shortcut: clipped frames are not composited back onto a full frame, so every frame of one render must share the clip size; composite them if partial clipping is needed
const capture = async (page, hints) => Buffer.from((await page.send('Page.captureScreenshot', {format: 'png', ...(hints.clip ? {clip: {...hints.clip, scale: 1}} : {})})).data, 'base64');

/** Renders `list` in order into `sink(index, png, sameAsPrevious)`; with `collect`, also gathers audio segments and writes artifacts.
 * Layout findings go into `audit` (a Map keyed by code and text) with the first frame and the number of frames they were seen. */
async function renderList(page, {id, selected, inputProps, list, collect, outDir, scratch, sink, onFrame, audit, size, transparent}) {
  // A clip that unmounts and remounts under the same key becomes a new segment.
  const segments = [], openSegments = new Map();
  // One frame-sized PNG, made on the first Experimental.Null frame, in the same pixel layout as Chrome's captures (opaque RGB, or RGBA when transparent): a mixed sequence makes ffmpeg misread the others.
  let blank = null, frameSize = null, previous = null, identical = 0;
  for (const [index, frame] of list.entries()) {
    const hints = await renderFrame(page, id, frame, inputProps);
    for (const finding of await page.evaluate('window.__FRAMEFORGE__.audit()') ?? []) {
      const key = `${finding.code ?? 'clipped_text'}:${finding.text}`;
      const seen = audit.get(key);
      seen ? seen.frames++ : audit.set(key, {frame, frames: 1, ...finding});
    }
    if (collect) for (const clip of await page.evaluate('window.__FRAMEFORGE__.audio()')) {
      const open = openSegments.get(clip.key);
      if (open && open.last === frame - 1) open.last = frame;
      else { const segment = {clip, first: frame, last: frame}; segments.push(segment); openSegments.set(clip.key, segment); }
    }
    if (collect) await writeArtifacts(await page.evaluate('window.__FRAMEFORGE__.artifacts()'), outDir);
    // ffmpeg rescales or drops frames whose size differs from the first, so a mixed sequence fails here instead of encoding garbage.
    const size = hints.clip && !hints.skip ? `${hints.clip.width}x${hints.clip.height}` : `${selected.width}x${selected.height}`;
    if ((frameSize ??= size) !== size) throw new Error(`Composition error: frame ${frame} captures ${size} but earlier frames are ${frameSize}; Experimental.Clipper must clip every rendered frame to one size.`);
    if (hints.skip && !blank) {
      const file = join(scratch, 'blank.png');
      await run(ffmpegPath(), ['-n', '-f', 'lavfi', '-i', `color=c=${transparent ? 'black@0' : 'black'}:s=${size.width}x${size.height},format=${transparent ? 'rgba' : 'rgb24'}`, '-frames:v', '1', file]);
      blank = await readFile(file);
    }
    const png = hints.skip ? blank : await capture(page, hints);
    // Static stretches capture the same bytes; the sink stores them once (a hard link on disk).
    const hash = createHash('sha1').update(png).digest('hex');
    if (hash === previous) identical++;
    await sink(index, png, hash === previous);
    previous = hash;
    onFrame();
  }
  return {segments, frameSize, identical};
}
const diskSink = directory => (index, png, same) => {
  const file = join(directory, `${String(index).padStart(8, '0')}.png`);
  return same ? link(join(directory, `${String(index - 1).padStart(8, '0')}.png`), file) : writeFile(file, png);
};
/** An ffmpeg encoding PNGs from stdin (image2pipe) into a video-only file with the given video arguments. */
function pipeEncoder(fps, encode, output) {
  const child = spawn(ffmpegPath(), ['-n', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-', ...encode, output], {stdio: ['pipe', 'ignore', 'pipe']});
  let stderr = '';
  child.stderr.on('data', part => { stderr = (stderr + part).slice(-8000); });
  child.stdin.on('error', () => {});  // EPIPE surfaces as the exit code below
  const done = new Promise((resolveDone, reject) => {
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolveDone() : reject(new Error(`ffmpeg exited ${code}: ${stderr}`)));
  });
  done.catch(() => {});
  const sink = async (_, png) => { if (!child.stdin.write(png)) await Promise.race([once(child.stdin, 'drain'), done]); };
  return {sink, finish: () => { child.stdin.end(); return done; }, kill: () => child.kill('SIGKILL')};
}

/** Original local renderer. Public option names mirror a small documented subset. */
/** With `frames`, renders only those frames and tiles them into one PNG contact sheet instead of encoding a video.
 * `frameRange` [from, to] renders that inclusive range; `concurrency` splits it across that many Chromes (chunks of at least 2 s);
 * `pipe` streams PNGs to ffmpeg instead of writing them; `checkIdempotent` first renders frames from, mid and to twice and compares the bytes.
 * The container follows the output extension (see outputFormat); `codec`, `audioCodec`, `crf`, `gifFps` override its defaults; `transparent`
 * captures over a clear page and encodes alpha; `scale` multiplies the output size (device scale factor); `strictAudit` fails on any layout finding. */
export async function renderMedia({serveUrl, composition, outputLocation, inputProps = {}, codec, audioCodec, crf, gifFps, transparent = false, scale = 1, strictAudit = false, frames, frameRange, concurrency = 1, pipe = false, checkIdempotent = false, onProgress}) {
  if (frames && (!frames.length || frames.some(frame => !Number.isInteger(frame) || frame < 0))) throw new Error('frames must be a non-empty list of non-negative integers.');
  if (frames && frameRange) throw new Error('frames and frameRange cannot be combined.');
  if (frameRange && !(Array.isArray(frameRange) && frameRange.length === 2 && frameRange.every(Number.isInteger) && 0 <= frameRange[0] && frameRange[0] <= frameRange[1])) throw new Error('frameRange must be [from, to] with 0 <= from <= to integers.');
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error('concurrency must be a positive integer.');
  if (!(scale > 0)) throw new Error('scale must be a positive number.');
  if (!outputLocation) throw new Error('outputLocation is required.');
  const format = frames ? null : outputFormat(outputLocation, {codec, audioCodec, transparent, crf, gifFps});
  if (format && !format.chunked && (concurrency > 1 || pipe)) { console.warn(`${format.container} output renders in one chunk; --concurrency and --pipe are ignored`); concurrency = 1; pipe = false; }
  // A sequence writes <folder>/<frame>.png (or the given %0Nd pattern) and refuses to overwrite the first frame.
  const sequencePattern = format?.sequence ? (outputLocation.endsWith('/') ? join(outputLocation, '%05d.png') : outputLocation) : null;
  const sequenceFile = frame => sequencePattern.replace(/%0(\d+)d/, (_, width) => String(frame).padStart(Number(width), '0'));
  if (existsSync(resolve(sequencePattern ? sequenceFile(frameRange?.[0] ?? 0) : outputLocation))) throw new Error(`Output already exists: ${sequencePattern ? sequenceFile(frameRange?.[0] ?? 0) : outputLocation}`);
  const url = new URL(serveUrl);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error('The local renderer accepts loopback serveUrl only.');
  const chrome = process.env.CHROME_PATH || [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
  ].find(existsSync);
  if (!chrome) throw new Error('Set CHROME_PATH to your installed Chrome/Chromium executable.');
  url.searchParams.set('render', '1');
  const directory = await mkdtemp(join(tmpdir(), 'frameforge-'));
  const pages = [], encoders = [];
  const open = async name => { const page = await openPage(chrome, url, inputProps, join(directory, name)); pages.push(page); return page; };
  try {
    const lead = await open('profile-0');
    const id = typeof composition === 'string' ? composition : composition?.id;
    const selected = lead.registry.compositions.find(item => item.id === id);
    if (!selected) throw new Error(`Unknown composition ${id}. Available: ${lead.registry.compositions.map(item => item.id).join(', ')}`);
    const size = {width: selected.width * scale, height: selected.height * scale};
    if (!Number.isInteger(size.width) || !Number.isInteger(size.height)) throw new Error(`scale ${scale} makes a fractional output size ${size.width}x${size.height}.`);
    if (format && ['yuv420p', 'yuva420p'].includes(format.pixFmt) && (size.width % 2 || size.height % 2)) throw new Error(`${format.codec} output requires even width and height (got ${size.width}x${size.height}).`);
    const [from, to] = frameRange ?? [0, selected.durationInFrames - 1];
    if (to >= selected.durationInFrames) throw new Error(`frameRange ends at ${to} but ${id} has ${selected.durationInFrames} frames.`);
    const wanted = frames ?? Array.from({length: to - from + 1}, (_, index) => from + index);
    const metrics = {width: selected.width, height: selected.height, deviceScaleFactor: scale, mobile: false};
    // The studio stylesheet paints the render page white; a transparent render clears that and Chrome's own default so captures keep alpha.
    const prepare = async page => {
      await page.send('Emulation.setDeviceMetricsOverride', metrics);
      if (!transparent) return;
      await page.send('Emulation.setDefaultBackgroundColorOverride', {color: {r: 0, g: 0, b: 0, a: 0}});
      await page.evaluate("document.documentElement.style.background = 'transparent'; document.body.style.background = 'transparent';");
    };
    const audit = new Map();
    if (checkIdempotent) {
      // Its own page, so the out-of-order frames leave no motion or artifact state in the render.
      const page = await open('profile-idempotent');
      await prepare(page);
      const probe = [...new Set([wanted[0], wanted[Math.floor(wanted.length / 2)], wanted.at(-1)])];
      const shots = [];
      for (const pass of [0, 1]) for (const frame of probe) {
        const hints = await renderFrame(page, id, frame, inputProps);
        const png = hints.skip ? Buffer.alloc(0) : await capture(page, hints);
        if (pass === 0) shots.push(png);
        else if (!png.equals(shots[probe.indexOf(frame)])) throw new Error(`frame_not_idempotent: frame ${frame} captured different pixels on a second render; derive every value from useCurrentFrame() and random(seed).`);
      }
      await page.close();
    }
    const chunks = frames ? [{index: 0, start: 0, end: 0}] : splitFrames(from, to, concurrency, selected.fps);
    const pagesFor = [lead, ...await Promise.all(chunks.slice(1).map(({index}) => open(`profile-${index}`)))];
    const chunked = !frames && (chunks.length > 1 || pipe);
    let rendered = 0;
    const onFrame = () => { rendered++; onProgress?.({renderedFrames: rendered, totalFrames: wanted.length, progress: rendered / wanted.length}); };
    // The first failing chunk closes every page so the others stop at their next call instead of finishing their range.
    let failure;
    const outDir = sequencePattern ? dirname(resolve(sequencePattern)) : dirname(resolve(outputLocation));
    const encode = count => [...videoArgs(format, count, scale !== 1 ? size : undefined), ...format.mux];
    const renderChunk = async (chunk, page, attempt) => {
      await prepare(page);
      const scratch = join(directory, `chunk-${chunk.index}${attempt ? `-retry${attempt}` : ''}`);
      await mkdir(scratch);
      const list = frames ?? wanted.slice(chunk.start - from, chunk.end - from + 1);
      const video = join(scratch, `video.${format?.container}`);
      const encoder = pipe && !frames ? pipeEncoder(selected.fps, encode(list.length), video) : null;
      if (encoder) encoders.push(encoder);
      const result = await renderList(page, {id, selected, inputProps, list, collect: !frames, outDir, scratch, sink: encoder?.sink ?? diskSink(scratch), onFrame, audit, size, transparent});
      if (encoder) await encoder.finish();
      else if (chunked) await run(ffmpegPath(), ['-n', '-framerate', String(selected.fps), '-i', join(scratch, '%08d.png'), ...encode(list.length), video]);
      return {...result, scratch, video};
    };
    const settled = await Promise.allSettled(chunks.map(async chunk => {
      try {
        return await renderChunk(chunk, pagesFor[chunk.index], 0);
      } catch (error) {
        // A composition error repeats on any page; a crashed or stalled Chrome does not, so that chunk gets one fresh browser.
        if (failure || /^Composition error/.test(String(error?.message ?? error)) || chunk.index === 0) throw error;
        console.warn(`chunk ${chunk.index} failed (${String(error?.message ?? error).split('\n')[0]}); retrying once`);
        const page = await open(`profile-${chunk.index}-retry`);
        return await renderChunk(chunk, page, 1);
      }
    }).map(work => work.catch(async error => { failure ??= error; await Promise.all(pages.map(page => page.close())); throw error; })));
    if (failure) throw failure;
    const results = settled.map(item => item.value);
    const sizes = new Set(results.map(item => item.frameSize));
    if (sizes.size > 1) throw new Error(`Composition error: chunks capture different sizes (${[...sizes].join(', ')}); Experimental.Clipper must clip every rendered frame to one size.`);
    const segments = mergeSegments(results.map(item => item.segments));
    const dense = frames ? null : sfxFault(segments.filter(({clip}) => clip.startFrame > 0).map(({first}) => first), selected.fps);
    if (dense) throw new Error(`Composition error: ${dense}`);
    // Sounds the engine derived from motion: each plays its whole file, panned, and yields to any authored effect within half a second.
    if (!frames) {
      // Motion sounds come from the whole frame sequence on one page, so the first page walks the other chunks' frames without capturing.
      for (const frame of wanted.slice(chunks[0].end - from + 1)) await renderFrame(lead, id, frame, inputProps);
      const derived = await lead.evaluate(`window.__FRAMEFORGE__.soundClips(${selected.fps})`) ?? [];
      const authored = segments.filter(({clip}) => clip.startFrame > 0).map(({first}) => first);
      const lengths = new Map();
      for (const clip of derived) {
        if (authored.some(first => Math.abs(first - clip.startFrame) < selected.fps / 2)) continue;
        const file = resolve(join(project, 'public'), '.' + decodeURIComponent(clip.src));
        if (!existsSync(file)) throw new Error(`MotionSound src must name a file under public/: ${clip.src}`);
        if (!lengths.has(file)) lengths.set(file, Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], {encoding: 'utf8'}).stdout) || 1);
        const last = Math.min(to, clip.startFrame + Math.ceil(lengths.get(file) * selected.fps) - 1);
        if (last < clip.startFrame) continue;
        segments.push({clip: {key: clip.key, src: clip.src, volume: clip.volume, trimBefore: 0, startFrame: clip.startFrame}, first: clip.startFrame, last, pan: clip.pan});
      }
      // Motion dump for scripts/seam-check.mjs: every probe sample of the whole sequence, written next to the output (inside a sequence folder).
      await mkdir(outDir, {recursive: true});
      await writeFile(sequencePattern ? join(outDir, 'motion.json') : `${resolve(outputLocation)}.motion.json`, JSON.stringify({composition: id, fps: selected.fps, from, to, samples: await lead.evaluate('window.__FRAMEFORGE__.motion()') ?? [], sounds: derived}));
      if (derived.length) console.log(JSON.stringify({motionSounds: derived.map(clip => ({frame: clip.startFrame, role: clip.role, intensity: Math.round(clip.intensity * 100) / 100, pan: clip.pan, file: clip.src.split('/').pop()}))}));
    }
    // A finding seen for under a quarter second of a video is motion (a word sliding in, a crossfade), not a layout fault; a sheet reports every frame.
    const persist = frames ? 1 : Math.min(wanted.length, Math.ceil(selected.fps / 4));
    const findings = [...audit.values()].filter(item => item.frames >= persist);
    if (findings.length) console.log(JSON.stringify({audit: findings}));
    if (findings.length && strictAudit) throw new Error(`Layout audit: ${findings.length} finding(s); first: ${findings[0].message ?? findings[0].text}`);
    await mkdir(outDir, {recursive: true});
    const staging = await mkdtemp(join(outDir, '.frameforge-'));
    try {
      const staged = join(staging, frames ? 'sheet.png' : `encoded.${format.container}`);
      const count = wanted.length, fps = selected.fps;
      const mixed = format?.audio === 'none' ? [] : segments;
      if (frames) {
        const columns = Math.min(4, frames.length);
        await run(ffmpegPath(), ['-n', '-i', join(results[0].scratch, '%08d.png'), '-vf', `scale=480:-1,tile=${columns}x${Math.ceil(frames.length / columns)}:padding=4:color=white`, '-frames:v', '1', staged]);
      } else if (sequencePattern) {
        // shortcut: the scratch PNGs are copied as captured (scale applies, nothing is re-encoded); the staging folder is unused.
        for (const [index, frame] of wanted.entries()) await copyFile(join(results[0].scratch, `${String(index).padStart(8, '0')}.png`), resolve(sequenceFile(frame)), constants.COPYFILE_EXCL);
      } else if (!chunked) {
        await run(ffmpegPath(), encodeArgs(['-framerate', String(fps), '-i', join(results[0].scratch, '%08d.png')], encode(count), fps, count, mixed, staged, from, AUDIO[format.audio]));
      } else {
        // Chunks share codec settings, so the concat demuxer joins them without re-encoding; audio is mixed once over the whole range.
        const listFile = join(directory, 'chunks.txt');
        await writeFile(listFile, results.map(item => `file '${item.video}'\n`).join(''));
        const video = results.length === 1 ? ['-i', results[0].video] : ['-f', 'concat', '-safe', '0', '-i', listFile];
        await run(ffmpegPath(), encodeArgs(video, ['-c:v', 'copy', ...format.mux], fps, count, mixed, staged, from, AUDIO[format.audio]));
      }
      // A same-filesystem hard link publishes a complete file atomically and refuses overwrite.
      if (!sequencePattern) await link(staged, resolve(outputLocation));
    } finally { await rm(staging, {recursive: true, force: true}); }
    const identicalFrames = results.reduce((sum, item) => sum + item.identical, 0);
    return {outputLocation: resolve(sequencePattern ?? outputLocation), composition: selected, frames: wanted.length, chunks: chunks.length, identicalFrames, identicalShare: Math.round(identicalFrames / wanted.length * 1000) / 1000, ...(format ? {format: {container: format.container, codec: format.codec, pixFmt: format.pixFmt, audio: format.audio, width: size.width, height: size.height}} : {}), auditFindings: findings.length, ...(checkIdempotent ? {idempotent: true} : {})};
  } finally {
    for (const encoder of encoders) encoder.kill();
    await Promise.all(pages.map(page => page.close()));
    await rm(directory, {recursive: true, force: true});
  }
}

async function main() {
  const options = {}, positional = [];
  for (let index = 2; index < process.argv.length; index++) {
    const arg = process.argv[index];
    if (['--frames', '--concurrency', '--frame-range', '--codec', '--audio-codec', '--crf', '--scale', '--gif-fps'].includes(arg)) options[arg] = process.argv[++index];
    else if (['--pipe', '--check-idempotent', '--transparent', '--muted', '--strict-audit'].includes(arg)) options[arg] = true;
    else positional.push(arg);
  }
  const frames = options['--frames']?.split(',').map(Number);
  const [entry = 'examples/samples/index.tsx', id = 'KitLaunch', output = 'renders/kit-launch.mp4', propsJson = '{}'] = positional;
  if (entry === '--help') {
    console.log(`npm run render -- [entry.tsx] [composition-id] [output] [input-props-json] [--frames 30,120,240] [--frame-range 0-299] [--concurrency 3] [--pipe] [--check-idempotent]
                 [--codec h264|vp9|prores|gif|png] [--audio-codec aac|opus|pcm|none] [--muted] [--crf N] [--transparent] [--scale S] [--gif-fps N] [--strict-audit]
Requires local Chrome and FFmpeg. calculateMetadata runs before encoding. <Audio> and <Video> sound from public/ or a downloaded https:// URL is mixed in (volume, trim, playbackRate via atempo, pan for motion sounds); Video frames come from ffmpeg extraction.
Output format by extension: .mp4 h264 + aac (default), .webm vp9 (libvpx-vp9, -b:v 0 -crf 32) + opus, .mov prores_ks 4444 + pcm_s16le, .gif (palettegen/paletteuse, --gif-fps caps the rate, no sound), a PNG sequence when the output ends with / or holds %05d (numbered by frame, nothing encoded). --codec overrides the codec, --audio-codec the sound codec (--muted skips the mix), --crf the quality.
--transparent renders over a clear page and keeps alpha (webm yuva420p, mov yuva444p10le, gif palette, png rgba; an error for h264). --scale S multiplies the output size (device scale factor; width and height must stay integers, even for h264 and vp9).
--frames writes a PNG contact sheet of those frames instead of a video. --frame-range renders an inclusive range; --concurrency N splits it across N Chromes (chunks of at least 2 s; gif and PNG sequences render in one chunk); --pipe streams frames to ffmpeg instead of writing PNGs; --check-idempotent fails with frame_not_idempotent when the first, middle or last frame renders differently twice.
Every render prints {"audit": [...]} once with the layout findings (text outside the 5% safe area, overlapping text, low contrast, small labels) seen for a quarter second or more; --strict-audit turns them into a failure. A video render also writes <output>.motion.json for seam-check. FRAMEFORGE_PORT changes the Vite port (default 4318).`);
    return;
  }
  const inputProps = JSON.parse(propsJson);
  if (!inputProps || typeof inputProps !== 'object' || Array.isArray(inputProps)) throw new Error('input-props-json must be a JSON object.');
  const frameRange = options['--frame-range']?.split('-').map(Number);
  const concurrency = options['--concurrency'] === undefined ? 1 : Number(options['--concurrency']);
  const numberOr = (name, fallback) => options[name] === undefined ? fallback : Number(options[name]);
  process.env.VIDEO_ENTRY = resolve(process.cwd(), entry);
  // Generated audio is not committed; build this composition's score first so the mix never misses a file.
  const spec = [join(dirname(process.env.VIDEO_ENTRY), 'audio.json')].find(existsSync);
  if (spec && spawnSync('python3', [join(project, 'scripts', 'assets', 'score.py'), spec], {cwd: project, stdio: 'inherit'}).status !== 0) throw new Error(`Audio generation failed for ${spec}`);
  const narration = [join(dirname(process.env.VIDEO_ENTRY), 'narration.json')].find(existsSync);
  if (narration && spawnSync('python3', [join(project, 'scripts', 'assets', 'voice.py'), narration], {cwd: project, stdio: 'inherit'}).status !== 0) throw new Error(`Voice generation failed for ${narration}`);
  const art = join(dirname(process.env.VIDEO_ENTRY), 'assets.json');
  if (existsSync(art) && spawnSync('python3', [join(project, 'scripts', 'assets', 'art.py'), art], {cwd: project, stdio: 'inherit'}).status !== 0) throw new Error(`Asset resolution failed for ${art}`);
  const {createServer} = await import('vite');
  const port = Number(process.env.FRAMEFORGE_PORT) || 4318;
  // Each render port keeps its own dependency cache so two renders (or a render and the studio) never re-optimize into one folder.
  const server = await createServer({root: project, configFile: join(project, 'vite.config.ts'), cacheDir: join(project, 'node_modules', `.vite-render-${port}`), server: {host: '127.0.0.1', port, strictPort: true, hmr: false}});
  const began = performance.now();
  try {
    await server.listen();
    const result = await renderMedia({serveUrl: `http://127.0.0.1:${port}`, composition: id, outputLocation: output, inputProps, frames, frameRange, concurrency, pipe: !!options['--pipe'], checkIdempotent: !!options['--check-idempotent'],
      codec: options['--codec'], audioCodec: options['--muted'] ? 'none' : options['--audio-codec'], crf: numberOr('--crf', undefined), gifFps: numberOr('--gif-fps', undefined), scale: numberOr('--scale', 1), transparent: !!options['--transparent'], strictAudit: !!options['--strict-audit'], onProgress: ({renderedFrames, totalFrames}) => {
      if (renderedFrames % 30 === 0 || renderedFrames === totalFrames) console.log(`${renderedFrames}/${totalFrames} frames`);
    }});
    console.log(JSON.stringify({...result, seconds: (performance.now() - began) / 1000}, null, 2));
  } finally { await server.close(); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => {console.error(error.message); process.exitCode = 1;});
