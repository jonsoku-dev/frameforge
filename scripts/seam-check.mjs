#!/usr/bin/env node
/** Seam check: reads the `<output>.motion.json` a render writes and tells whether the eye's momentum survives each cut.
 * For every scene boundary it measures the outgoing vector (last `window` frames before the cut) and the incoming vector
 * (first `window` frames from the cut) from the motion probes, in frame fractions per frame (x/width, y/height, scale as is),
 * and compares axis, direction and speed. Pure functions, exported for tests; the CLI is at the bottom. */
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

/** Rest: mean |Δ| per frame below this is "not moving" (0.0015 of the frame ≈ 3 px/frame at 1920). */
export const REST = 0.0015;
/** Speed ratio in/out accepted as matched; a perfect mirror reads about 1.4 because the exit's final step (into the cut frame) is never sampled, so the exit reads slower. Only checked when both sides move. */
export const RATIO = [0.5, 2];
const SEAM_AXIS = {x: 'x', y: 'y', scale: 'z'};

const unit = (axis, size) => axis === 'x' ? size.width : axis === 'y' ? size.height : 1;

/** The dominant motion on one side of a boundary, or null when no probe sampled that window.
 * side 'out' reads frames [boundary - window, boundary - 1], 'in' reads [boundary, boundary + window - 1].
 * Camera-family probes win when any exist (a <Seam> reports them; `camera: true`); otherwise every x/y/scale probe counts.
 * Axis = largest summed |Δ| across probes, direction = sign of the summed Δ on that axis, speed = mean |Δ| per frame on it. */
export function seamVector(samples, boundary, side, window = 12, size = {width: 1920, height: 1080}) {
  const lo = side === 'out' ? boundary - window : boundary;
  const hi = side === 'out' ? boundary - 1 : boundary + window - 1;
  const inWindow = samples.filter(s => s.frame >= lo && s.frame <= hi && s.axis in SEAM_AXIS);
  const camera = inWindow.filter(s => s.family === 'camera');
  const pool = camera.length ? camera : inWindow;
  if (!pool.length) return null;
  const byKey = new Map();
  for (const s of pool) (byKey.get(s.key) ?? byKey.set(s.key, []).get(s.key)).push(s);
  const sums = {};
  for (const [, series] of byKey) {
    series.sort((a, b) => a.frame - b.frame);
    const axis = series[0].axis;
    const sum = sums[axis] ??= {abs: 0, signed: 0, steps: 0};
    let steps = 0;
    for (let i = 1; i < series.length; i++) {
      const d = (series[i].value - series[i - 1].value) / unit(axis, size);
      sum.abs += Math.abs(d);
      sum.signed += d;
      steps++;
    }
    sum.steps = Math.max(sum.steps, steps);
  }
  const keys = [...byKey.keys()], isCamera = camera.length > 0;
  const [axis, sum] = Object.entries(sums).sort((a, b) => b[1].abs - a[1].abs)[0];
  if (!(sum.abs > 0) || !sum.steps) return {axis: null, direction: 0, speed: 0, keys, camera: isCamera};
  return {axis: SEAM_AXIS[axis], direction: Math.sign(sum.signed) || 0, speed: sum.abs / sum.steps, keys, camera: isCamera};
}

const fmt = v => v ? `${v.axis ?? '-'}${v.direction > 0 ? '+' : v.direction < 0 ? '-' : '0'} @ ${(v.speed * 1000).toFixed(1)}‰/f` : 'no data';
const name = v => v.axis === 'z' ? (v.direction > 0 ? 'push (growing)' : 'pull (shrinking)') : `${v.axis}${v.direction > 0 ? '+' : '-'}`;

/** Findings for every boundary. Options: {window, width, height, from, to, fps}. `fps` (default 30) scales the default window
 * (12 frames at 30 fps, 0.4 s) and the rest threshold, so a 60 fps film is judged on the same seconds and pixels per second. Boundaries whose windows fall outside [from, to]
 * are skipped (listed in `skipped`), so a partial render checks only the seams it contains. A boundary is measured (errors
 * possible) only when both sides carry camera-family samples, which <Seam> reports; a plain wipe or a film without seams
 * gets `seam_unmeasured` warnings with whatever other probes showed, never a failure. */
export function checkSeams(samples, boundaries, options = {}) {
  const perThirtieth = (options.fps ?? 30) / 30;
  const window = options.window ?? Math.round(12 * perThirtieth);
  const size = {width: options.width ?? 1920, height: options.height ?? 1080};
  const from = options.from ?? -Infinity, to = options.to ?? Infinity;
  const findings = [], vectors = [], skipped = [];
  const push = (boundary, code, message, fix, out, inc, severity = 'error') => findings.push({code, severity, boundary, message, fix, out, in: inc});
  for (const boundary of [...boundaries].sort((a, b) => a - b)) {
    if (boundary - window < from || boundary + window - 1 > to) { skipped.push(boundary); continue; }
    const out = seamVector(samples, boundary, 'out', window, size);
    const inc = seamVector(samples, boundary, 'in', window, size);
    if (!out || !inc) {
      push(boundary, 'seam_no_motion_data', `No probe samples ${!out ? 'before' : 'after'} the cut at frame ${boundary}.`, `Report the camera motion of both scenes with <Seam> or <MotionProbe family="camera" axis="x|y|scale">, or fix --scenes/--prompt so the boundary sits on the real cut.`, out, inc, 'warning');
      continue;
    }
    if (!out.camera || !inc.camera) { push(boundary, 'seam_unmeasured', `No camera probe ${!out.camera && !inc.camera ? 'on either side of' : !out.camera ? 'before' : 'after'} the cut at frame ${boundary}; other probes read out ${fmt(out)}, in ${fmt(inc)}.`, `Join the scenes with <Seam> (or report each side's wrapper with <MotionProbe family="camera">) so the seam can be measured.`, out, inc, 'warning'); continue; }
    vectors.push({boundary, out, in: inc});
    const outRest = out.speed * perThirtieth < REST, inRest = inc.speed * perThirtieth < REST;
    if (outRest || inRest) { push(boundary, 'seam_dead_beat', `${outRest && inRest ? 'Both sides are' : outRest ? 'The outgoing side is' : 'The incoming side is'} at rest around frame ${boundary} (out ${fmt(out)}, in ${fmt(inc)}).`, `Land the cut mid-motion: exit with an ease-in (power 4) over ${window} frames, enter with the mirrored ease-out, and put the cut at the midpoint (cutTheCurve/zoomThrough/inverseZoom do this).`, out, inc); continue; }
    if (out.axis !== inc.axis) { push(boundary, 'seam_axis_swap', `Exit moves on ${out.axis}, entry on ${inc.axis} at frame ${boundary}.`, `Keep one axis across the cut: give the incoming scene the outgoing scene's axis (${out.axis}), or cut both to the film's current.`, out, inc); continue; }
    if (out.direction !== inc.direction) { push(boundary, 'seam_mirrored_vector', `Exit is ${name(out)}, entry is ${name(inc)} at frame ${boundary}: the entry answers the exit instead of continuing it.`, out.axis === 'z' ? `Match the scale sign: a receding exit (shrinking) needs an entry that also shrinks from large to 1 (inverseZoom); a growing exit needs an entry growing from small (zoomThrough).` : `Keep the sign: an exit to the left needs an entry arriving from the right and still moving left; never mirror the vector.`, out, inc); continue; }
    const ratio = inc.speed / out.speed;
    if (ratio < RATIO[0] || ratio > RATIO[1]) push(boundary, 'seam_speed_mismatch', `Entry speed is ${ratio.toFixed(2)}× exit speed at frame ${boundary} (out ${fmt(out)}, in ${fmt(inc)}).`, `Match the eases: exit ease-in power 4 and entry ease-out power 4 over the same distance and duration, so the entry's first speed equals the exit's last.`, out, inc);
  }
  // Consecutive seams on one axis must not reverse: the eye reads ping-pong as an error.
  for (let i = 1; i < vectors.length; i++) {
    const prev = vectors[i - 1].out, cur = vectors[i].out;
    if (prev.axis && prev.axis === cur.axis && prev.direction && cur.direction && prev.direction !== cur.direction) push(vectors[i].boundary, 'seam_pingpong', `Seam at frame ${vectors[i].boundary} runs ${name(cur)} right after a seam running ${name(prev)}.`, `Keep the film's current (one dominant direction); a turn needs a visible cause or a chapter boundary, never two seams in a row.`, cur, prev);
  }
  const current = mode(vectors.map(v => v.out).filter(v => v.axis).map(v => `${v.axis}${v.direction > 0 ? '+' : '-'}`));
  return {boundaries: vectors.map(v => v.boundary), skipped, current, vectors, findings};
}

const mode = list => list.length ? [...list.reduce((m, k) => m.set(k, (m.get(k) ?? 0) + 1), new Map())].sort((a, b) => b[1] - a[1])[0][0] : null;

/** Scene boundaries from a prompt.md: a `Cuts:` line when present, otherwise the scene table: the first `a-b` range in every table row names that scene's frames, and
 * every row start after the first is a cut. Fold the final still into the last scene's row; a separate hold row would be
 * a boundary where nothing moves. */
export function parseScenes(markdown) {
  // A continuous film's rows are state changes, not cuts: a `Cuts: none` or `Cuts: 120, 300` line names the real cuts.
  const declared = /^\s*(?:[-*]\s*)?Cuts:\s*(.*)$/im.exec(markdown);
  // An unfilled template line (`Cuts: TODO ...`) is not a declaration: fall back to the table.
  if (declared && !/TODO/.test(declared[1])) return (declared[1].match(/\d+/g) ?? []).map(Number);
  const starts = [];
  for (const line of markdown.split('\n')) {
    if (!line.trimStart().startsWith('|')) continue;
    const m = /(\d+)\s*[-–~]\s*(\d+)/.exec(line);
    if (m) starts.push(Number(m[1]));
  }
  return starts.slice(1);
}

/** Fallback boundaries: frames where the set of active probe keys changes most (a cut swaps one scene's probes for the next's, so at least two keys change). */
export function inferBoundaries(samples, from) {
  const keys = new Map();
  for (const s of samples) (keys.get(s.frame) ?? keys.set(s.frame, new Set()).get(s.frame)).add(s.key);
  const frames = [...keys.keys()].sort((a, b) => a - b);
  const scores = [];
  for (let i = 1; i < frames.length; i++) {
    const a = keys.get(frames[i - 1]), b = keys.get(frames[i]);
    const score = [...a].filter(k => !b.has(k)).length + [...b].filter(k => !a.has(k)).length;
    if (score > 0 && frames[i] !== from) scores.push([frames[i], score]);
  }
  const max = Math.max(0, ...scores.map(([, s]) => s));
  const out = [];
  for (const [frame, score] of scores.filter(([, s]) => s >= Math.max(2, max / 2))) {
    const last = out[out.length - 1];
    if (last && frame - last[0] <= 10) { if (score > last[1]) out[out.length - 1] = [frame, score]; }
    else out.push([frame, score]);
  }
  return out.map(([frame]) => frame);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const flag = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
  const file = args.find(a => !a.startsWith('--') && !args[args.indexOf(a) - 1]?.startsWith('--'));
  if (!file || args.includes('--help')) {
    console.log('node scripts/seam-check.mjs <render.mp4.motion.json> [--scenes 90,210,330 | --prompt examples/samples/<slug>/prompt.md] [--window frames, default 0.4 s] [--width 1920] [--height 1080] [--json]\nBoundaries are cut frames: --scenes lists them, --prompt reads the start of every scene-table row after the first, otherwise they are inferred from where the probe set changes. Exit 1 on errors.');
    process.exit(0);
  }
  const dump = JSON.parse(readFileSync(file, 'utf8'));
  const samples = dump.samples ?? [];
  const boundaries = flag('--scenes') ? flag('--scenes').split(',').map(Number) : flag('--prompt') ? parseScenes(readFileSync(flag('--prompt'), 'utf8')) : inferBoundaries(samples, dump.from ?? 0);
  const window = flag('--window') ? Number(flag('--window')) : undefined;
  const report = checkSeams(samples, boundaries, {...(window ? {window} : {}), fps: dump.fps ?? 30, width: Number(flag('--width') ?? 1920), height: Number(flag('--height') ?? 1080), from: dump.from ?? 0, to: dump.to ?? Infinity});
  const errors = report.findings.filter(f => f.severity === 'error').length;
  if (args.includes('--json')) console.log(JSON.stringify({...report, source: file, errors}));
  else {
    console.log(`${file}: ${report.boundaries.length} seam(s) checked${report.skipped.length ? `, ${report.skipped.length} outside frames ${dump.from}-${dump.to} (${report.skipped.join(', ')})` : ''}${report.current ? `, current ${report.current}` : ''}`);
    for (const v of report.vectors) console.log(`  frame ${v.boundary}: out ${fmt(v.out)}  in ${fmt(v.in)}`);
    for (const f of report.findings) console.log(`${f.severity.toUpperCase()} ${f.code} @${f.boundary}: ${f.message}\n  fix: ${f.fix}`);
    const warnings = report.findings.length - errors;
    console.log(errors ? `FAIL: ${errors} error(s)` : warnings ? `PASS with ${warnings} warning(s)` : 'PASS');
  }
  process.exit(errors ? 1 : 0);
}
