import {existsSync} from 'node:fs';
import {mkdir, mkdtemp, rm, link, readFile, writeFile} from 'node:fs/promises';
import {setTimeout as sleep} from 'node:timers/promises';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {dirname, resolve, join, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn, spawnSync} from 'node:child_process';
import {writeArtifacts} from './artifacts.mjs';
import {atempoChain, remoteCachePath} from './video-frames.mjs';

const project = fileURLToPath(new URL('../', import.meta.url));
const ffmpegPath = () => process.env.FFMPEG_PATH || 'ffmpeg';
// PNG is sRGB; without an explicit bt709 matrix and tags, 1080p players guess and saturated greens drift.
const videoCodec = count => ['-frames:v', String(count), '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv', '-c:v', 'libx264', '-crf', '18', '-preset', 'slow', '-x264-params', 'colorprim=bt709:transfer=bt709:colormatrix=bt709:range=tv', '-movflags', '+faststart'];
/** Each clip is seeked, trimmed, delayed to its first mounted frame (minus `offset`, the first output frame), and summed without normalization. */
function encodeArgs(video, encode, fps, count, segments, output, offset = 0) {
  if (!segments.length) return ['-n', ...video, ...encode, output];
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
  // Music (clips mounted at frame 0) ducks 4-6 dB under the effects stem so each effect reads as an event, not a splice.
  const music = segments.map((segment, index) => segment.clip.startFrame === 0 ? index : -1).filter(index => index >= 0);
  const effects = segments.map((_, index) => index).filter(index => !music.includes(index));
  const label = list => list.map(index => `[a${index}]`).join('');
  const sum = (list, out) => list.length === 1 ? `${label(list)}acopy[${out}]` : `${label(list)}amix=inputs=${list.length}:normalize=0:dropout_transition=0[${out}]`;
  const mix = music.length && effects.length
    ? `${chains.join(';')};${sum(music, 'music')};${sum(effects, 'fx')};[fx]asplit[key][fxout];[music][key]sidechaincompress=threshold=0.02:ratio=4:attack=5:release=180:level_sc=1[ducked];[ducked][fxout]amix=inputs=2:normalize=0:dropout_transition=0,apad[mix]`
    : `${chains.join(';')};${label(segments.map((_, index) => index))}amix=inputs=${segments.length}:normalize=0:dropout_transition=0,apad[mix]`;
  return ['-n', ...video, ...inputs, '-filter_complex', mix, '-map', '0:v', '-map', '[mix]', ...encode, '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-t', (count / fps).toFixed(6), output];
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

/** Renders `list` in order into `sink(index, png, sameAsPrevious)`; with `collect`, also gathers audio segments and writes artifacts. */
async function renderList(page, {id, selected, inputProps, list, collect, outDir, scratch, sink, onFrame}) {
  // A clip that unmounts and remounts under the same key becomes a new segment.
  const segments = [], openSegments = new Map();
  // One black frame-sized PNG, made on the first Experimental.Null frame. Opaque RGB like Chrome's captures: an RGBA frame in the sequence makes ffmpeg misread the others.
  let blank = null, frameSize = null, previous = null, identical = 0;
  for (const [index, frame] of list.entries()) {
    const hints = await renderFrame(page, id, frame, inputProps);
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
      await run(ffmpegPath(), ['-n', '-f', 'lavfi', '-i', `color=c=black:s=${selected.width}x${selected.height},format=rgb24`, '-frames:v', '1', file]);
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
/** An ffmpeg encoding PNGs from stdin (image2pipe) into a video-only MP4 with the standard codec settings. */
function pipeEncoder(fps, count, output) {
  const child = spawn(ffmpegPath(), ['-n', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-', ...videoCodec(count), output], {stdio: ['pipe', 'ignore', 'pipe']});
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
 * `pipe` streams PNGs to ffmpeg instead of writing them; `checkIdempotent` first renders frames from, mid and to twice and compares the bytes. */
export async function renderMedia({serveUrl, composition, outputLocation, inputProps = {}, codec = 'h264', frames, frameRange, concurrency = 1, pipe = false, checkIdempotent = false, onProgress}) {
  if (codec !== 'h264') throw new Error('Frameforge 0.1 supports codec=h264 only.');
  if (frames && (!frames.length || frames.some(frame => !Number.isInteger(frame) || frame < 0))) throw new Error('frames must be a non-empty list of non-negative integers.');
  if (frames && frameRange) throw new Error('frames and frameRange cannot be combined.');
  if (frameRange && !(Array.isArray(frameRange) && frameRange.length === 2 && frameRange.every(Number.isInteger) && 0 <= frameRange[0] && frameRange[0] <= frameRange[1])) throw new Error('frameRange must be [from, to] with 0 <= from <= to integers.');
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error('concurrency must be a positive integer.');
  if (!outputLocation) throw new Error('outputLocation is required.');
  if (existsSync(resolve(outputLocation))) throw new Error(`Output already exists: ${outputLocation}`);
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
    if (!frames && (selected.width % 2 || selected.height % 2)) throw new Error('H.264 output requires even width and height.');
    const [from, to] = frameRange ?? [0, selected.durationInFrames - 1];
    if (to >= selected.durationInFrames) throw new Error(`frameRange ends at ${to} but ${id} has ${selected.durationInFrames} frames.`);
    const wanted = frames ?? Array.from({length: to - from + 1}, (_, index) => from + index);
    const metrics = {width: selected.width, height: selected.height, deviceScaleFactor: 1, mobile: false};
    if (checkIdempotent) {
      // Its own page, so the out-of-order frames leave no motion or artifact state in the render.
      const page = await open('profile-idempotent');
      await page.send('Emulation.setDeviceMetricsOverride', metrics);
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
    const renderChunk = async (chunk, page, attempt) => {
      await page.send('Emulation.setDeviceMetricsOverride', metrics);
      const scratch = join(directory, `chunk-${chunk.index}${attempt ? `-retry${attempt}` : ''}`);
      await mkdir(scratch);
      const list = frames ?? wanted.slice(chunk.start - from, chunk.end - from + 1);
      const video = join(scratch, 'video.mp4');
      const encoder = pipe && !frames ? pipeEncoder(selected.fps, list.length, video) : null;
      if (encoder) encoders.push(encoder);
      const result = await renderList(page, {id, selected, inputProps, list, collect: !frames, outDir: dirname(resolve(outputLocation)), scratch, sink: encoder?.sink ?? diskSink(scratch), onFrame});
      if (encoder) await encoder.finish();
      else if (chunked) await run(ffmpegPath(), ['-n', '-framerate', String(selected.fps), '-i', join(scratch, '%08d.png'), ...videoCodec(list.length), video]);
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
      // Motion dump for scripts/seam-check.mjs: every probe sample of the whole sequence, written next to the output.
      await mkdir(dirname(resolve(outputLocation)), {recursive: true});
      await writeFile(`${resolve(outputLocation)}.motion.json`, JSON.stringify({composition: id, fps: selected.fps, from, to, samples: await lead.evaluate('window.__FRAMEFORGE__.motion()') ?? [], sounds: derived}));
      if (derived.length) console.log(JSON.stringify({motionSounds: derived.map(clip => ({frame: clip.startFrame, role: clip.role, intensity: Math.round(clip.intensity * 100) / 100, pan: clip.pan, file: clip.src.split('/').pop()}))}));
    }
    await mkdir(dirname(resolve(outputLocation)), {recursive: true});
    const staging = await mkdtemp(join(dirname(resolve(outputLocation)), '.frameforge-'));
    try {
      const staged = join(staging, frames ? 'sheet.png' : 'encoded.mp4');
      const count = wanted.length, fps = selected.fps;
      if (frames) {
        const columns = Math.min(4, frames.length);
        await run(ffmpegPath(), ['-n', '-i', join(results[0].scratch, '%08d.png'), '-vf', `scale=480:-1,tile=${columns}x${Math.ceil(frames.length / columns)}:padding=4:color=white`, '-frames:v', '1', staged]);
      } else if (!chunked) {
        await run(ffmpegPath(), encodeArgs(['-framerate', String(fps), '-i', join(results[0].scratch, '%08d.png')], videoCodec(count), fps, count, segments, staged, from));
      } else {
        // Chunks share codec settings, so the concat demuxer joins them without re-encoding; audio is mixed once over the whole range.
        const listFile = join(directory, 'chunks.txt');
        await writeFile(listFile, results.map(item => `file '${item.video}'\n`).join(''));
        const video = results.length === 1 ? ['-i', results[0].video] : ['-f', 'concat', '-safe', '0', '-i', listFile];
        await run(ffmpegPath(), encodeArgs(video, ['-c:v', 'copy', '-movflags', '+faststart'], fps, count, segments, staged, from));
      }
      // A same-filesystem hard link publishes a complete file atomically and refuses overwrite.
      await link(staged, resolve(outputLocation));
    } finally { await rm(staging, {recursive: true, force: true}); }
    const identicalFrames = results.reduce((sum, item) => sum + item.identical, 0);
    return {outputLocation: resolve(outputLocation), composition: selected, frames: wanted.length, chunks: chunks.length, identicalFrames, identicalShare: Math.round(identicalFrames / wanted.length * 1000) / 1000, ...(checkIdempotent ? {idempotent: true} : {})};
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
    if (['--frames', '--concurrency', '--frame-range'].includes(arg)) options[arg] = process.argv[++index];
    else if (arg === '--pipe' || arg === '--check-idempotent') options[arg] = true;
    else positional.push(arg);
  }
  const frames = options['--frames']?.split(',').map(Number);
  const [entry = 'examples/samples/index.tsx', id = 'KitLaunch', output = 'renders/kit-launch.mp4', propsJson = '{}'] = positional;
  if (entry === '--help') {
    console.log('npm run render -- [entry.tsx] [composition-id] [output.mp4] [input-props-json] [--frames 30,120,240] [--frame-range 0-299] [--concurrency 3] [--pipe] [--check-idempotent]\nRequires local Chrome and FFmpeg. calculateMetadata runs before encoding. <Audio> and <Video> sound from public/ or a downloaded https:// URL is mixed into the MP4 (volume, trim, playbackRate via atempo, pan for motion sounds); Video frames come from ffmpeg extraction. --frames writes a PNG contact sheet of those frames instead of a video. --frame-range renders an inclusive range; --concurrency N splits it across N Chromes (chunks of at least 2 s); --pipe streams frames to ffmpeg instead of writing PNGs; --check-idempotent fails with frame_not_idempotent when the first, middle or last frame renders differently twice. FRAMEFORGE_PORT changes the Vite port (default 4318).');
    return;
  }
  const inputProps = JSON.parse(propsJson);
  if (!inputProps || typeof inputProps !== 'object' || Array.isArray(inputProps)) throw new Error('input-props-json must be a JSON object.');
  const frameRange = options['--frame-range']?.split('-').map(Number);
  const concurrency = options['--concurrency'] === undefined ? 1 : Number(options['--concurrency']);
  process.env.VIDEO_ENTRY = resolve(process.cwd(), entry);
  // Generated audio is not committed; build this composition's score first so the mix never misses a file.
  const spec = [join(dirname(process.env.VIDEO_ENTRY), 'audio.json')].find(existsSync);
  if (spec && spawnSync('python3', [join(project, 'scripts', 'assets', 'score.py'), spec], {cwd: project, stdio: 'inherit'}).status !== 0) throw new Error(`Audio generation failed for ${spec}`);
  const art = join(dirname(process.env.VIDEO_ENTRY), 'assets.json');
  if (existsSync(art) && spawnSync('python3', [join(project, 'scripts', 'assets', 'art.py'), art], {cwd: project, stdio: 'inherit'}).status !== 0) throw new Error(`Asset resolution failed for ${art}`);
  const {createServer} = await import('vite');
  const port = Number(process.env.FRAMEFORGE_PORT) || 4318;
  // Each render port keeps its own dependency cache so two renders (or a render and the studio) never re-optimize into one folder.
  const server = await createServer({root: project, configFile: join(project, 'vite.config.ts'), cacheDir: join(project, 'node_modules', `.vite-render-${port}`), server: {host: '127.0.0.1', port, strictPort: true, hmr: false}});
  const began = performance.now();
  try {
    await server.listen();
    const result = await renderMedia({serveUrl: `http://127.0.0.1:${port}`, composition: id, outputLocation: output, inputProps, frames, frameRange, concurrency, pipe: !!options['--pipe'], checkIdempotent: !!options['--check-idempotent'], onProgress: ({renderedFrames, totalFrames}) => {
      if (renderedFrames % 30 === 0 || renderedFrames === totalFrames) console.log(`${renderedFrames}/${totalFrames} frames`);
    }});
    console.log(JSON.stringify({...result, seconds: (performance.now() - began) / 1000}, null, 2));
  } finally { await server.close(); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => {console.error(error.message); process.exitCode = 1;});
