import {execFileSync} from 'node:child_process';
import {existsSync, mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

// Regression check between two renders: per-frame PSNR (ffmpeg psnr filter, all planes averaged) and the first frame under a threshold.
const args = process.argv.slice(2);
const value = name => { const i = args.indexOf(`--${name}`); return i < 0 ? undefined : args[i + 1]; };
const old = value('against'), threshold = Number(value('threshold') ?? 40);
const fresh = args.find((arg, i) => !arg.startsWith('--') && !/^--(against|threshold)$/.test(args[i - 1] ?? ''));
if (!old || !fresh) { console.error('usage: node scripts/snapshot-diff.mjs --against <old.mp4> <new.mp4> [--threshold 40]'); process.exit(2); }
for (const file of [old, fresh]) if (!existsSync(file)) { console.error(`no such file: ${file}`); process.exit(2); }

const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
const ffprobe = process.env.FFPROBE_PATH || ffmpeg.replace(/ffmpeg$/, 'ffprobe');
const count = file => Number(execFileSync(ffprobe, ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', file]).toString().trim());
const frames = {against: count(old), current: count(fresh)};
const scratch = mkdtempSync(join(tmpdir(), 'frameforge-psnr-'));
let psnr;
try {
  const stats = join(scratch, 'psnr.log');
  // The filter path is parsed by the filter graph, so the temp path must not contain ':' or '\''; tmpdir() does not.
  execFileSync(ffmpeg, ['-v', 'error', '-i', fresh, '-i', old, '-lavfi', `psnr=stats_file=${stats}`, '-f', 'null', '-']);
  // Identical frames print psnr_avg:inf.
  psnr = readFileSync(stats, 'utf8').trim().split('\n').map(line => Number(line.match(/psnr_avg:(\S+)/)[1].replace('inf', 'Infinity')));
} finally { rmSync(scratch, {recursive: true, force: true}); }
const finite = psnr.filter(Number.isFinite).sort((a, b) => a - b);
const round = number => Number.isFinite(number) ? Math.round(number * 100) / 100 : 'inf';
const firstBelow = psnr.findIndex(db => db < threshold);
const report = {
  against: old, current: fresh, frames, compared: psnr.length, threshold,
  psnr: {min: round(finite[0] ?? Infinity), median: round(finite[Math.floor(finite.length / 2)] ?? Infinity), mean: round(finite.length ? finite.reduce((sum, db) => sum + db, 0) / finite.length : Infinity), identicalFrames: psnr.length - finite.length},
  firstFrameBelow: firstBelow < 0 ? null : {frame: firstBelow, psnr: round(psnr[firstBelow])},
  pass: firstBelow < 0 && frames.against === frames.current,
};
console.log(JSON.stringify(report, null, 1));
if (!report.pass) process.exitCode = 1;
