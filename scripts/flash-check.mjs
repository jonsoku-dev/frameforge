import {execFileSync, spawn} from 'node:child_process';

// Approximates the Ofcom flashing guidance (not a Harding FPA certification): a transition is a luminance change of at
// least 10% of full scale over at least 25% of the picture; a flash is a pair of opposing transitions; more than three
// flashes within any one second fails.
const [file, fpsArg] = process.argv.slice(2);
if (!file) { console.error('usage: node scripts/flash-check.mjs <video> [fps]  (fps defaults to the video\'s own rate)'); process.exit(2); }
const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
const probeRate = () => { const [n, d = '1'] = execFileSync(process.env.FFPROBE_PATH || ffmpegPath.replace(/ffmpeg$/, 'ffprobe'), ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate', '-of', 'csv=p=0', file]).toString().trim().split('/'); return Number(n) / Number(d); };
const fps = Number(fpsArg ?? probeRate()) || 30;
const width = 480, height = 270, size = width * height;
const ffmpeg = spawn(ffmpegPath, ['-v', 'error', '-i', file, '-vf', `scale=${width}:${height},format=gray`, '-f', 'rawvideo', '-'], {stdio: ['ignore', 'pipe', 'inherit']});
const chunks = [];
for await (const chunk of ffmpeg.stdout) chunks.push(chunk);
const raw = Buffer.concat(chunks);
const frames = Math.floor(raw.length / size);
const transitions = [];
let previous = null;
for (let index = 0; index < frames; index++) {
  const frame = raw.subarray(index * size, (index + 1) * size);
  if (previous) {
    let changed = 0, delta = 0;
    for (let pixel = 0; pixel < size; pixel++) {
      const d = frame[pixel] - previous[pixel];
      if (Math.abs(d) >= 26) { changed++; delta += d; }
    }
    if (changed / size >= 0.25) transitions.push({frame: index, area: Math.round(changed / size * 100) / 100, direction: delta > 0 ? 'up' : 'down'});
  }
  previous = frame;
}
// A change that spreads over consecutive frames in one direction (a wipe or a slide) is one transition, not many.
const merged = transitions.filter((t, i) => i === 0 || t.direction !== transitions[i - 1].direction || t.frame - transitions[i - 1].frame > 2 * Math.max(1, Math.round(fps / 30)));
let worst = {frame: 0, transitions: 0};
for (const start of merged) {
  const count = merged.filter(t => t.frame >= start.frame && t.frame < start.frame + fps).length;
  if (count > worst.transitions) worst = {frame: start.frame, transitions: count};
}
const flashes = Math.floor(worst.transitions / 2);
const report = {file, frames, fps, transitions, mergedTransitions: merged.length, worstSecondStartFrame: worst.frame, worstSecondTransitions: worst.transitions, worstSecondFlashes: flashes, pass: flashes <= 3};
console.log(JSON.stringify(report, null, 1));
if (!report.pass) process.exitCode = 1;
