import {spawn, execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';

// Composition check: blank frames, long static stretches, content huddled in the middle, and frames with no element of headline scale.
// Thresholds were tuned on renders/samples: raw coverage cannot tell a sparse frame with a big headline from one with tiny labels
// (a strong sample can have lower coverage than a weak one), so `thin` (the tallest band of inked rows) carries the scale check.
const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(`--${name}`); return i < 0 ? fallback : Number(args[i + 1]); };
const file = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.match(/^--(fps|hold)$/));
if (!file) { console.error('usage: node scripts/frame-check.mjs <video.mp4> [--fps N] [--hold frames] [--json]\nfps defaults to the video\'s own rate, hold to its last 2 s.'); process.exit(2); }
if (!existsSync(file)) { console.error(`no such file: ${file}`); process.exit(2); }

const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
const ffprobe = process.env.FFPROBE_PATH || ffmpeg.replace(/ffmpeg$/, 'ffprobe');
const [srcW, srcH, rate] = execFileSync(ffprobe, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate', '-of', 'csv=p=0', file]).toString().trim().split(',');
const [num, den = '1'] = rate.split('/');
const fps = flag('fps', Number(num) / Number(den) || 30), hold = flag('hold', Math.round(2 * fps)), json = args.includes('--json');
// Durations were tuned at 30 fps; they are seconds, so they scale with the rate. `step` compares each frame with the one
// 1/30 s earlier, so a 60 fps film moving at the same speed reads as moving, not as half-static.
const sec = s => Math.round(s * fps), step = Math.max(1, Math.round(fps / 30));
const T = {diff: 24, empty: 0.01, still: 0.002, reportStill: sec(1.5), failEmpty: sec(1), failStill: sec(4), huddle: 0.4, failHuddled: 0.25, rowInk: 0.05, band: 0.06, failThin: 0.08};
const width = 480, height = Math.round(Number(srcH) * width / Number(srcW) / 2) * 2, px = width * height, size = px * 3, short = Math.min(width, height);
const proc = spawn(ffmpeg, ['-v', 'error', '-i', file, '-vf', `scale=${width}:${height},format=rgb24`, '-f', 'rawvideo', '-'], {stdio: ['ignore', 'pipe', 'inherit']});
const chunks = [];
for await (const chunk of proc.stdout) chunks.push(chunk);
const raw = Buffer.concat(chunks);
const frames = Math.floor(raw.length / size);
if (!frames) { console.error(`no frames decoded from ${file}`); process.exit(2); }

const stats = [];
const bins = new Uint32Array(4096), rows = new Uint32Array(height);
for (let f = 0; f < frames; f++) {
  const cur = raw.subarray(f * size, (f + 1) * size), prev = f >= step ? raw.subarray((f - step) * size, (f - step + 1) * size) : null;
  bins.fill(0); rows.fill(0);
  for (let i = 0; i < size; i += 3) bins[(cur[i] >> 4) << 8 | (cur[i + 1] >> 4) << 4 | cur[i + 2] >> 4]++;
  let mode = 0;
  for (let b = 1; b < 4096; b++) if (bins[b] > bins[mode]) mode = b;
  const bg = [(mode >> 8) * 16 + 8, ((mode >> 4) & 15) * 16 + 8, (mode & 15) * 16 + 8];
  let ink = 0, moved = 0, x0 = width, x1 = -1, y0 = height, y1 = -1;
  for (let p = 0, i = 0; p < px; p++, i += 3) {
    if (Math.abs(cur[i] - bg[0]) > T.diff || Math.abs(cur[i + 1] - bg[1]) > T.diff || Math.abs(cur[i + 2] - bg[2]) > T.diff) {
      ink++; rows[(p / width) | 0]++;
      const x = p % width, y = (p - x) / width;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    if (prev && (Math.abs(cur[i] - prev[i]) > T.diff || Math.abs(cur[i + 1] - prev[i + 1]) > T.diff || Math.abs(cur[i + 2] - prev[i + 2]) > T.diff)) moved++;
  }
  const inkBox = x1 < 0 ? [0, 0, 0, 0] : [x0 / width, y0 / height, (x1 + 1) / width, (y1 + 1) / height];
  // band: tallest run of rows whose ink spans at least 5% of the width, as a fraction of the short side (a headline is >= 8%).
  let band = 0;
  for (let y = 0, run = 0; y < height; y++) { run = rows[y] >= width * T.rowInk ? run + 1 : 0; if (run > band) band = run; }
  stats.push({coverage: ink / px, change: prev ? moved / px : 1, inkBox, band: band / short});
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
const staticRuns = runs(s => s.change < T.still).filter(r => r.frames > T.reportStill);
const huddledShare = stats.slice(0, body).filter(({inkBox: [a, b, c, d]}) => c - a < T.huddle && d - b < T.huddle).length / Math.max(1, body);
const thin = runs(s => s.band < T.band);
const thinShare = thin.reduce((sum, r) => sum + r.frames, 0) / Math.max(1, body);
const sorted = stats.map(s => s.coverage).sort((a, b) => a - b);
const q = p => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
const r3 = v => Math.round(v * 1000) / 1000;
const coverage = {min: r3(sorted[0]), p10: r3(q(0.1)), median: r3(q(0.5))};
const fails = [
  ...empty.filter(r => r.frames > T.failEmpty).map(r => `empty ${r.from}-${r.to} (${r.frames}f)`),
  ...staticRuns.filter(r => r.frames > T.failStill).map(r => `static ${r.from}-${r.to} (${r.frames}f)`),
  ...(huddledShare >= T.failHuddled ? [`huddled share ${r3(huddledShare)} >= ${T.failHuddled}`] : []),
  ...(thinShare >= T.failThin ? [`thin share ${r3(thinShare)} >= ${T.failThin}`] : []),
];
const report = {file, width: Number(srcW), height: Number(srcH), frames, fps, hold, coverage, emptyRanges: empty, staticRuns, huddledShare: r3(huddledShare), thinRanges: thin, thinShare: r3(thinShare), fails, pass: fails.length === 0};

if (json) console.log(JSON.stringify(report, null, 1));
else {
  const list = rs => rs.length ? rs.map(r => `${r.from}-${r.to}`).join(', ') : 'none';
  console.log(`${file} ${srcW}x${srcH} ${frames}f (hold ${hold})`);
  console.log(`  coverage min ${coverage.min} p10 ${coverage.p10} median ${coverage.median}`);
  console.log(`  empty (<${T.empty}): ${list(empty)}`);
  console.log(`  static (>${T.reportStill}f): ${list(staticRuns)}`);
  console.log(`  huddled share: ${r3(huddledShare)}`);
  console.log(`  thin (no band >= ${T.band * 100}% of short side): share ${r3(thinShare)} in ${list(thin)}`);
  console.log(`  ${report.pass ? 'PASS' : `FAIL: ${fails.join('; ')}`}`);
}
if (!report.pass) process.exitCode = 1;
