import {spawn, execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';

// Composition check: blank frames, frozen stretches, content huddled in the middle, and frames with no element of headline scale.
// Thresholds were tuned on renders/samples: raw coverage cannot tell a sparse frame with a big headline from one with tiny labels
// (a strong sample can have lower coverage than a weak one), so `thin` (the tallest band of inked rows) carries the scale check.
const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(`--${name}`); return i < 0 ? fallback : Number(args[i + 1]); };
const file = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.match(/^--(fps|hold)$/));
if (!file) { console.error('usage: node scripts/frame-check.mjs <video.mp4> [--fps N] [--hold frames] [--json]\nfps defaults to the video\'s own rate, hold (the final still, left out of every measure but the end-hold check) to its last 1 s; an explicit --hold also skips the end-hold check.'); process.exit(2); }
if (!existsSync(file)) { console.error(`no such file: ${file}`); process.exit(2); }

const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
const ffprobe = process.env.FFPROBE_PATH || ffmpeg.replace(/ffmpeg$/, 'ffprobe');
const [srcW, srcH, rate] = execFileSync(ffprobe, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate', '-of', 'csv=p=0', file]).toString().trim().split(',');
const [num, den = '1'] = rate.split('/');
const sourceFps = Number(num) / Number(den);
const fps = flag('fps', sourceFps || 30), json = args.includes('--json');
if ((Number.isFinite(sourceFps) && sourceFps > 0 && sourceFps < 1) || !Number.isFinite(fps) || fps < 1) { console.error('frame-check requires a finite fps of at least 1, including the source video rate.'); process.exit(2); }
// An explicit --hold declares the end still on purpose (a loop point, a held card the brief asks for), so the end-hold check steps aside.
const holdDeclared = args.includes('--hold');
const requestedHold = flag('hold', Math.round(fps));
if ((holdDeclared && !args[args.indexOf('--hold') + 1]?.trim()) || !Number.isSafeInteger(requestedHold) || requestedHold < 0) { console.error('--hold must be a non-negative integer number of frames.'); process.exit(2); }
// Durations were tuned at 30 fps; they are seconds, so they scale with the rate. `step` compares each frame with the one
// 1/30 s earlier, so a 60 fps film moving at the same speed reads as moving, not as half-static.
// `window` compares each frame with the one 0.5 s earlier as well: a drift of a few px/s moves under 0.1 px per step at 480 px wide,
// which no per-step threshold sees, but it moves a pixel or more across half a second.
const sec = s => Math.round(s * fps), step = Math.max(1, Math.round(fps / 30)), window = Math.max(step, sec(0.5));
const T = {diff: 24, empty: 0.01, still: 0.002, reportStill: sec(1.5), failEmpty: sec(1), failFrozen: sec(1), huddle: 0.4, failHuddled: 0.25, rowInk: 0.05, band: 0.06, failThin: 0.08,
  edge: 24, featureless: 0.001, failFeatureless: 3, endWindow: Math.max(1, sec(2)), endMotion: 0.5, endMinFilm: sec(4)};
const width = 480, height = Math.round(Number(srcH) * width / Number(srcW) / 2) * 2, px = width * height, size = px * 3, short = Math.min(width, height);
const proc = spawn(ffmpeg, ['-v', 'error', '-xerror', '-i', file, '-vf', `scale=${width}:${height},format=rgb24`, '-f', 'rawvideo', '-'], {stdio: ['ignore', 'pipe', 'pipe']});
let diagnostics = '';
proc.stderr.on('data', chunk => { if (diagnostics.length < 16384) diagnostics += chunk.toString().slice(0, 16384 - diagnostics.length); });
const completed = new Promise(resolve => {
  let error;
  proc.once('error', failure => { error = failure; });
  proc.once('close', (code, signal) => resolve({code, signal, error}));
});
const chunks = [];
try { for await (const chunk of proc.stdout) chunks.push(chunk); }
catch (error) { console.error(`ffmpeg output failed: ${error.message}`); process.exit(2); }
const decoded = await completed;
if (decoded.error || decoded.code !== 0 || diagnostics.length) {
  console.error(`ffmpeg decoding failed: ${diagnostics.trim() || decoded.error?.message || decoded.signal || `exit ${decoded.code}`}`);
  process.exit(2);
}
const raw = Buffer.concat(chunks);
if (raw.length % size) { console.error('ffmpeg produced an incomplete decoded frame.'); process.exit(2); }
const frames = Math.floor(raw.length / size);
if (!frames) { console.error(`no frames decoded from ${file}`); process.exit(2); }
const minimumFrames = step + 1;
if (frames < minimumFrames) { console.error(`at least ${minimumFrames} decoded frames are required for frame comparison at ${fps} fps (got ${frames}).`); process.exit(2); }
if (holdDeclared && frames - requestedHold < minimumFrames) { console.error(`--hold must leave at least ${minimumFrames} of the ${frames} decoded frames for comparison.`); process.exit(2); }
// A default one-second hold must leave enough frames for a comparison at this rate.
const hold = holdDeclared ? requestedHold : frames - requestedHold >= minimumFrames ? requestedHold : 0;

const stats = [];
const bins = new Uint32Array(4096), rows = new Uint32Array(height);
for (let f = 0; f < frames; f++) {
  const cur = raw.subarray(f * size, (f + 1) * size), prev = f >= step ? raw.subarray((f - step) * size, (f - step + 1) * size) : null;
  const back = f >= step ? raw.subarray(Math.max(0, f - window) * size, (Math.max(0, f - window) + 1) * size) : null;
  bins.fill(0); rows.fill(0);
  for (let i = 0; i < size; i += 3) bins[(cur[i] >> 4) << 8 | (cur[i + 1] >> 4) << 4 | cur[i + 2] >> 4]++;
  let mode = 0;
  for (let b = 1; b < 4096; b++) if (bins[b] > bins[mode]) mode = b;
  const bg = [(mode >> 8) * 16 + 8, ((mode >> 4) & 15) * 16 + 8, (mode & 15) * 16 + 8];
  let ink = 0, moved = 0, drifted = 0, edges = 0, x0 = width, x1 = -1, y0 = height, y1 = -1;
  for (let p = 0, i = 0; p < px; p++, i += 3) {
    // An edge pixel: luminance steps by more than T.edge to its right or lower neighbour. A flat field or a full-frame blur has almost none.
    if ((p + 1) % width && p + width < px) {
      const l = cur[i] + cur[i + 1] + cur[i + 2], r = cur[i + 3] + cur[i + 4] + cur[i + 5], d = cur[i + width * 3] + cur[i + width * 3 + 1] + cur[i + width * 3 + 2];
      if (Math.abs(l - r) > 3 * T.edge || Math.abs(l - d) > 3 * T.edge) edges++;
    }
    if (Math.abs(cur[i] - bg[0]) > T.diff || Math.abs(cur[i + 1] - bg[1]) > T.diff || Math.abs(cur[i + 2] - bg[2]) > T.diff) {
      ink++; rows[(p / width) | 0]++;
      const x = p % width, y = (p - x) / width;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    if (prev && (Math.abs(cur[i] - prev[i]) > T.diff || Math.abs(cur[i + 1] - prev[i + 1]) > T.diff || Math.abs(cur[i + 2] - prev[i + 2]) > T.diff)) moved++;
    if (back && (Math.abs(cur[i] - back[i]) > T.diff || Math.abs(cur[i + 1] - back[i + 1]) > T.diff || Math.abs(cur[i + 2] - back[i + 2]) > T.diff)) drifted++;
  }
  const inkBox = x1 < 0 ? [0, 0, 0, 0] : [x0 / width, y0 / height, (x1 + 1) / width, (y1 + 1) / height];
  // band: tallest run of rows whose ink spans at least 5% of the width, as a fraction of the short side (a headline is >= 8%).
  let band = 0;
  for (let y = 0, run = 0; y < height; y++) { run = rows[y] >= width * T.rowInk ? run + 1 : 0; if (run > band) band = run; }
  stats.push({coverage: ink / px, change: prev ? moved / px : null, drift: back ? drifted / px : null, inkBox, band: band / short, edges: edges / px});
}

const body = Math.max(0, frames - hold);
const runs = test => {
  const out = [];
  for (let f = 0; f < body; f++) if (test(stats[f])) {
    let e = f;
    while (e + 1 < body && test(stats[e + 1])) e++;
    out.push({from: f, to: e, frames: e - f + 1});
    f = e;
  }
  return out;
};
const empty = runs(s => s.coverage < T.empty);
const staticRuns = runs(s => s.change !== null && s.change < T.still).filter(r => r.frames > T.reportStill);
const comparisons = stats.slice(step, body);
const stillShare = comparisons.filter(s => s.change < T.still).length / comparisons.length;
// A frame is frozen when it barely differs from the frame 0.5 s earlier, so a run of them starts half a second before its first frame.
const frozen = runs(s => s.drift !== null && s.drift < T.still).map(r => { const from = Math.max(0, r.from - window); return {from, to: r.to, frames: r.to - from + 1}; });
const motionShare = 1 - comparisons.filter(s => s.drift < T.still).length / comparisons.length;
const huddledShare = stats.slice(0, body).filter(({inkBox: [a, b, c, d]}) => c - a < T.huddle && d - b < T.huddle).length / Math.max(1, body);
const thin = runs(s => s.band < T.band);
const thinShare = thin.reduce((sum, r) => sum + r.frames, 0) / Math.max(1, body);
// Featureless: one flat colour or a blur with no edge anywhere (a blank transition frame). Three in a row inside the film fail.
const featureless = runs(s => s.edges < T.featureless);
// End hold: the share of the final 2 s (the hold included) that still moves against the frame 0.5 s earlier. A lockup keeps moving.
const tail = stats.slice(Math.max(step, frames - T.endWindow));
const endMotion = tail.filter(s => s.drift >= T.still).length / Math.max(1, tail.length);
const endChecked = !holdDeclared && frames >= T.endMinFilm;
const sorted = stats.map(s => s.coverage).sort((a, b) => a - b);
const q = p => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
const r3 = v => Math.round(v * 1000) / 1000;
const coverage = {min: r3(sorted[0]), p10: r3(q(0.1)), median: r3(q(0.5))};
const fails = [
  ...empty.filter(r => r.frames > T.failEmpty).map(r => `empty ${r.from}-${r.to} (${r.frames}f)`),
  ...frozen.filter(r => r.frames > T.failFrozen).map(r => `frozen ${r.from}-${r.to} (${r.frames}f > ${T.failFrozen}f)`),
  ...(huddledShare >= T.failHuddled ? [`huddled share ${r3(huddledShare)} >= ${T.failHuddled}`] : []),
  ...(thinShare >= T.failThin ? [`thin share ${r3(thinShare)} >= ${T.failThin}`] : []),
  ...featureless.filter(r => r.frames >= T.failFeatureless).map(r => `featureless ${r.from}-${r.to} (${r.frames}f flat or blurred >= ${T.failFeatureless}f)`),
  ...(endChecked && endMotion < T.endMotion ? [`end hold: motion share ${r3(endMotion)} < ${T.endMotion} in the last ${T.endWindow}f`] : []),
];
const report = {file, width: Number(srcW), height: Number(srcH), frames, fps, hold, coverage, emptyRanges: empty, staticRuns, stillShare: r3(stillShare), motionShare: r3(motionShare), frozenRuns: frozen, huddledShare: r3(huddledShare), thinRanges: thin, thinShare: r3(thinShare), featurelessRanges: featureless, endMotionShare: r3(endMotion), endChecked, fails, pass: fails.length === 0};

if (json) console.log(JSON.stringify(report, null, 1));
else {
  const list = rs => rs.length ? rs.map(r => `${r.from}-${r.to}`).join(', ') : 'none';
  console.log(`${file} ${srcW}x${srcH} ${frames}f (hold ${hold})`);
  console.log(`  coverage min ${coverage.min} p10 ${coverage.p10} median ${coverage.median}`);
  console.log(`  empty (<${T.empty}): ${list(empty)}`);
  console.log(`  static (>${T.reportStill}f, per step): ${list(staticRuns)}; still share ${r3(stillShare)}`);
  console.log(`  motion share ${r3(motionShare)}; frozen over 0.5 s windows (fail >${T.failFrozen}f): ${list(frozen.filter(r => r.frames > T.failFrozen))}`);
  console.log(`  huddled share: ${r3(huddledShare)}`);
  console.log(`  thin (no band >= ${T.band * 100}% of short side): share ${r3(thinShare)} in ${list(thin)}`);
  console.log(`  featureless (flat or blurred, fail >=${T.failFeatureless}f): ${list(featureless)}`);
  console.log(`  end motion share (last ${T.endWindow}f, fail <${T.endMotion}): ${endChecked ? r3(endMotion) : 'skipped (--hold given or film under 4 s)'}`);
  console.log(`  ${report.pass ? 'PASS' : `FAIL: ${fails.join('; ')}`}`);
}
if (!report.pass) process.exitCode = 1;
