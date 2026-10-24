import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

// Silence in a media file: a loudnorm pass measures the input's gating threshold, which then serves silencedetect as the noise
// floor, so quiet room tone under a voice or a music tail is not counted as sound. Prints leading and trailing silence and every
// silent segment with the frames to trim at --fps.
const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
const ffprobe = process.env.FFPROBE_PATH || ffmpeg.replace(/ffmpeg$/, 'ffprobe');

/** The JSON block loudnorm prints on stderr. */
export function parseLoudnorm(stderr) {
  const start = stderr.lastIndexOf('{'), end = stderr.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('loudnorm printed no JSON block.');
  const stats = JSON.parse(stderr.slice(start, end + 1));
  return {inputThresh: Number(stats.input_thresh), inputI: Number(stats.input_i), inputTp: Number(stats.input_tp)};
}

/** silencedetect lines to [{start, end, duration}]; a silence still open at the end has end and duration null. */
export function parseSilences(stderr) {
  const silences = [];
  for (const line of stderr.split('\n')) {
    const start = /silence_start:\s*(-?[\d.]+)/.exec(line);
    const end = /silence_end:\s*(-?[\d.]+)\s*\|\s*silence_duration:\s*([\d.]+)/.exec(line);
    if (start) silences.push({start: Number(start[1]), end: null, duration: null});
    else if (end && silences.length && silences.at(-1).end === null) Object.assign(silences.at(-1), {end: Number(end[1]), duration: Number(end[2])});
  }
  return silences;
}

const round = value => Math.round(value * 1000) / 1000;
// silencedetect places an edge a few ms off the cut (the level crosses the floor after the attack, before the tail); 10 ms of slack keeps such edges on their frame.
const ceilFrame = (seconds, fps) => Math.max(0, Math.ceil((seconds - 0.01) * fps)), floorFrame = (seconds, fps) => Math.floor((seconds + 0.01) * fps);

/** Leading and trailing silence, every segment with its frame span, and the trim that keeps only the sounding part. */
export function silenceReport(silences, duration, fps) {
  const closed = silences.map(item => ({start: item.start, end: item.end ?? duration, duration: round((item.end ?? duration) - item.start)}));
  const leading = closed.find(item => item.start <= 0.01);
  const trailing = closed.find(item => item.end >= duration - 0.01);
  const segments = closed.map(item => ({...item, start: round(item.start), end: round(item.end), frames: {from: ceilFrame(item.start, fps), to: Math.max(ceilFrame(item.start, fps), floorFrame(item.end, fps) - 1)}}));
  const startFrame = leading ? ceilFrame(leading.end, fps) : 0;
  const endFrame = (trailing && trailing !== leading ? floorFrame(trailing.start, fps) : floorFrame(duration, fps)) - 1;
  return {
    duration: round(duration), fps,
    leading: {seconds: round(leading ? leading.end : 0), frames: startFrame},
    trailing: {seconds: round(trailing && trailing !== leading ? duration - trailing.start : 0), frames: trailing && trailing !== leading ? ceilFrame(duration - trailing.start, fps) : 0},
    segments,
    trim: {startFrame, endFrame, frames: Math.max(0, endFrame - startFrame + 1)},
  };
}

function ffmpegStderr(args) {
  const result = spawnSync(ffmpeg, ['-hide_banner', '-nostats', ...args, '-f', 'null', '-'], {encoding: 'utf8'});
  if (result.status !== 0) throw new Error(`ffmpeg exited ${result.status}: ${result.stderr.trim().split('\n').pop()}`);
  return result.stderr;
}

/** Runs both passes on `file`; `min` is the shortest silence in seconds. */
export function detectSilence(file, {min = 0.5, fps = 30} = {}) {
  const duration = Number(spawnSync(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], {encoding: 'utf8'}).stdout);
  if (!(duration > 0)) throw new Error(`ffprobe found no duration in ${file}`);
  const {inputThresh, inputI, inputTp} = parseLoudnorm(ffmpegStderr(['-i', file, '-af', 'loudnorm=print_format=json']));
  // The gating threshold sits about 10 LU under the integrated loudness; a file that is all silence reports -inf, so fall back to -60 dB.
  const noiseFloorDb = Number.isFinite(inputThresh) ? round(inputThresh) : -60;
  const silences = parseSilences(ffmpegStderr(['-i', file, '-af', `silencedetect=n=${noiseFloorDb}dB:d=${min}`]));
  return {file, loudness: {integrated: inputI, truePeak: inputTp}, noiseFloorDb, min, ...silenceReport(silences, duration, fps)};
}

function main(argv) {
  const flag = (name, fallback) => { const at = argv.indexOf(name); return at < 0 ? fallback : Number(argv[at + 1]); };
  const file = argv.find((arg, index) => !arg.startsWith('--') && !/^--(min|fps)$/.test(argv[index - 1] ?? ''));
  if (!file || argv.includes('--help')) { console.error('usage: node scripts/silence-detect.mjs <media> [--min 0.5] [--fps 30] [--json]'); return 2; }
  if (!existsSync(file)) { console.error(`no such file: ${file}`); return 2; }
  const report = detectSilence(resolve(file), {min: flag('--min', 0.5), fps: flag('--fps', 30)});
  if (argv.includes('--json')) { console.log(JSON.stringify(report, null, 1)); return 0; }
  console.log(`${report.file} ${report.duration} s, noise floor ${report.noiseFloorDb} dB (integrated ${report.loudness.integrated} LUFS, true peak ${report.loudness.truePeak} dBTP)`);
  console.log(`  leading silence ${report.leading.seconds} s (start at frame ${report.leading.frames})`);
  console.log(`  trailing silence ${report.trailing.seconds} s (end at frame ${report.trim.endFrame})`);
  console.log(`  segments >= ${report.min} s: ${report.segments.length ? report.segments.map(item => `${item.start}-${item.end} s (frames ${item.frames.from}-${item.frames.to})`).join(', ') : 'none'}`);
  console.log(`  trim: --frame-range ${report.trim.startFrame}-${report.trim.endFrame} (${report.trim.frames} frames at ${report.fps} fps)`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
