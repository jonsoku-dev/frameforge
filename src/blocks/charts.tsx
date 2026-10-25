import type {CSSProperties, ReactNode} from 'react';
import {Easing, MotionProbe, evolvePath, getLength, getPointAtLength, interpolate, makePie, random, spring} from 'frameforge';
import {sampleTag, type FilmLang} from './text';
import type {BlockEntry} from './types';

// Every chart is a pure function of `frame`: hidden before `at`, animating over `duration`, then held. Text stays in HTML
// outside the <svg> so the renderer's text-clip guard never sees a clipping ancestor; only bars and paths live in the svg.
type Palette = {ink: string; paper: string; accent: string; soft: string};
type Fonts = {display: string; ui: string};
type Block = {frame: number; at: number; out?: number; duration?: number; fps?: number; palette: Palette; fonts: Fonts; size?: number; stroke?: number; radius?: number; x?: number; y?: number; width?: number; height?: number; id?: string; example?: boolean | string; lang?: FilmLang};
type Datum = {label: string; value: number};
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const span = (frame: number, from: number, dur: number) => interpolate(frame, [from, from + dur], [0, 1], {...clamp, easing: ease});
const pop = (frame: number, at: number, dur: number, fps: number) => spring({frame, fps, delay: at, durationInFrames: dur, config: {overshootClamping: true}});
const tabular: CSSProperties = {fontVariantNumeric: 'tabular-nums', lineHeight: 1, whiteSpace: 'nowrap'};
// size defaults to 3.5% of a 1080 short side; stroke keeps the 1.5% ratio to it and radius is the one corner of the film.
const dims = (b: Block) => { const size = b.size ?? 38; return {size, stroke: b.stroke ?? size * (1.5 / 3.5), radius: b.radius ?? size * 0.4, W: b.width ?? size * 20, H: b.height ?? size * 12}; };
const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

/** Absolute box for one block: null before `at`, fades out over the last 8 frames before `out` (or `at + duration` when `out` is given as such). */
function Box({b, children}: {b: Block; children: ReactNode}) {
  const {W, H} = dims(b);
  if (b.frame < b.at || (b.out !== undefined && b.frame >= b.out)) return null;
  const fade = b.out === undefined ? 1 : 1 - span(b.frame, b.out - 8, 8);
  return <div style={{position: 'absolute', left: b.x ?? 0, top: b.y ?? 0, width: W, height: H, opacity: fade}}>{children}</div>;
}

/** The sample-data tag at the top right; `copy` is the chart's own text, whose script picks the word when neither `example` nor `lang` does. */
function Pill({b, copy}: {b: Block; copy: (string | undefined)[]}) {
  const text = sampleTag(b.example ?? true, b.lang, ...copy);
  if (!text) return null;
  const {size, radius} = dims(b);
  return <div style={{position: 'absolute', right: 0, top: 0, padding: `${size * 0.25}px ${size * 0.6}px`, borderRadius: radius, background: b.palette.soft, color: b.palette.ink, fontFamily: b.fonts.ui, fontSize: size, lineHeight: 1, whiteSpace: 'nowrap'}}>{text}</div>;
}

export type BarChartProps = Block & {data: Datum[]; max?: number; target?: number; unit?: string};
/** Bars grow from the baseline with a stagger, value labels count up, an optional target line draws across once the bars landed. */
export function BarChart(b: BarChartProps) {
  const {frame, at, data, target, unit = '', fps = 30, palette: {ink, accent}, fonts, example = true} = b;
  const {size, stroke, radius, W, H} = dims(b);
  const duration = b.duration ?? 60;
  const max = b.max ?? Math.max(...data.map(d => d.value), target ?? 0) * 1.1;
  const top = size * 3.2, base = H - size * 1.7, plotH = base - top, plotW = target === undefined ? W : W - size * 4, slot = plotW / data.length, barW = slot * 0.62;
  const stagger = Math.min(5, (duration * 0.4) / data.length), grow = duration * 0.5;
  const heights = data.map((d, i) => ({p: pop(frame, at + i * stagger, grow, fps), h: (d.value / max) * plotH}));
  const landed = at + (data.length - 1) * stagger + grow * 0.6;
  const line = span(frame, landed, duration * 0.3);
  const targetY = target === undefined ? 0 : base - (target / max) * plotH;
  const targetPath = `M0 ${targetY} L${W} ${targetY}`;
  return <Box b={b}>
    <MotionProbe id={b.id ?? `bar-chart-${at}`} value={heights[0] ? heights[0].p * heights[0].h : 0} family="shape" axis="y" />
    <Pill b={b} copy={[unit, ...data.map(d => d.label)]} />
    <svg width={W} height={base + stroke} style={{position: 'absolute', left: 0, top: 0}}>
      {data.map((d, i) => <rect key={d.label} x={i * slot + (slot - barW) / 2} y={base - heights[i]!.h * heights[i]!.p} width={barW} height={heights[i]!.h * heights[i]!.p + radius} rx={radius} fill={accent} />)}
      <path d={`M0 ${base} L${W} ${base}`} stroke={ink} strokeWidth={stroke} strokeLinecap="round" fill="none" />
      {target !== undefined ? <path d={targetPath} stroke={ink} strokeWidth={stroke * 0.5} strokeLinecap="round" fill="none" {...evolvePath(line, targetPath)} /> : null}
    </svg>
    {target !== undefined ? <div style={{position: 'absolute', right: 0, top: targetY - size * 1.3, color: ink, fontFamily: fonts.ui, fontSize: size, opacity: line, ...tabular}}>목표 {fmt(target)}{unit}</div> : null}
    {data.map((d, i) => {
      const {p, h} = heights[i]!;
      return <div key={d.label} style={{position: 'absolute', left: i * slot, width: slot, textAlign: 'center'}}>
        <div style={{position: 'absolute', left: 0, right: 0, top: base - h * p - size * 1.25, color: ink, fontFamily: fonts.display, fontSize: size * 1.05, opacity: Math.min(1, p * 2), ...tabular}}>{fmt(d.value * p)}{unit}</div>
        <div style={{position: 'absolute', left: 0, right: 0, top: base + stroke + size * 0.45, color: ink, fontFamily: fonts.ui, fontSize: size, opacity: Math.min(1, p * 2), lineHeight: 1, whiteSpace: 'nowrap'}}>{d.label}</div>
      </div>;
    })}
  </Box>;
}

export type LineChartProps = Block & {data: Datum[]; max?: number; min?: number; area?: boolean; unit?: string};
/** The line draws in along its length with a leading dot, the area fades in behind it, two y ticks and the x labels frame it. */
export function LineChart(b: LineChartProps) {
  const {frame, at, data, unit = '', min = 0, area = true, palette: {ink, accent}, fonts, example = true} = b;
  const {size, stroke, W, H} = dims(b);
  const duration = b.duration ?? 60;
  const max = b.max ?? Math.max(...data.map(d => d.value)) * 1.1;
  const left = size * 3.2, top = size * (example ? 3.2 : 1.6), base = H - size * 1.7, plotW = W - left - size * 1.2, plotH = base - top, dot = stroke * 0.9;
  const xy = (d: Datum, i: number) => [left + (i / Math.max(1, data.length - 1)) * plotW, base - ((d.value - min) / (max - min)) * plotH] as const;
  const points = data.map(xy);
  const d = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
  const axis = `M${left} ${top - size * 0.5} L${left} ${base} L${W} ${base}`;
  const draw = span(frame, at + duration * 0.15, duration * 0.6), axisDraw = span(frame, at, duration * 0.25);
  const head = getPointAtLength(d, getLength(d) * draw) ?? {x: points[0]![0], y: points[0]![1]};
  const fill = area ? 0.18 * span(frame, at + duration * 0.55, duration * 0.3) : 0;
  const last = data[data.length - 1]!;
  return <Box b={b}>
    <MotionProbe id={b.id ?? `line-chart-${at}`} value={draw} family="shape" axis="progress" />
    <Pill b={b} copy={[unit, ...data.map(d => d.label)]} />
    <svg width={W} height={base + stroke} style={{position: 'absolute', left: 0, top: 0}}>
      {fill > 0 ? <path d={`${d} L${points[points.length - 1]![0]} ${base} L${left} ${base} Z`} fill={accent} opacity={fill} /> : null}
      <path d={axis} stroke={ink} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" fill="none" {...evolvePath(axisDraw, axis)} />
      {[0, 1].map(t => <path key={t} d={`M${left - stroke * 1.5} ${base - t * plotH} L${left} ${base - t * plotH}`} stroke={ink} strokeWidth={stroke} strokeLinecap="round" fill="none" opacity={axisDraw} />)}
      {draw > 0 ? <path d={d} stroke={accent} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" fill="none" {...evolvePath(draw, d)} /> : null}
      {draw > 0 ? <circle cx={head.x} cy={head.y} r={dot} fill={ink} /> : null}
    </svg>
    {[min, max].map((v, t) => <div key={t} style={{position: 'absolute', right: W - left + stroke * 2.2, top: base - t * plotH - size * 0.5, color: ink, fontFamily: fonts.ui, fontSize: size, opacity: axisDraw, ...tabular}}>{fmt(v)}{unit}</div>)}
    {data.map((p, i) => <div key={p.label} style={{position: 'absolute', left: points[i]![0] - size * 2, width: size * 4, top: base + stroke + size * 0.45, textAlign: 'center', color: ink, fontFamily: fonts.ui, fontSize: size, opacity: axisDraw * (draw * (data.length - 1) >= i - 0.5 ? 1 : 0.35), lineHeight: 1, whiteSpace: 'nowrap'}}>{p.label}</div>)}
    <div style={{position: 'absolute', left: Math.min(Math.max(0, head.x - size * 2), W - size * 4), width: size * 4, textAlign: 'center', top: head.y - size * 1.6, color: ink, fontFamily: fonts.display, fontSize: size * 1.1, opacity: draw > 0 ? 1 : 0, ...tabular}}>{fmt(last.value * draw)}{unit}</div>
  </Box>;
}

export type BarChartRaceProps = Block & {snapshots: {label: string; values: Record<string, number>}[]; top?: number; unit?: string};
/** Ranked bars re-sort between data snapshots: each bar's y and width interpolate between its neighbouring ranks and values, labels ride along. */
export function BarChartRace(b: BarChartRaceProps) {
  const {frame, at, snapshots, unit = '', palette: {ink, accent}, fonts, example = true} = b;
  const {size, radius, W, H} = dims(b);
  const duration = b.duration ?? 90;
  const names = [...new Set(snapshots.flatMap(s => Object.keys(s.values)))];
  const rows = Math.min(b.top ?? names.length, names.length);
  const t = interpolate(frame, [at, at + duration], [0, snapshots.length - 1], clamp);
  const i = Math.min(Math.floor(t), snapshots.length - 1), f = ease(t - i);
  const a = snapshots[i]!, z = snapshots[Math.min(i + 1, snapshots.length - 1)]!;
  const rank = (s: typeof a) => [...names].sort((p, q) => (s.values[q] ?? 0) - (s.values[p] ?? 0) || p.localeCompare(q));
  const ra = rank(a), rz = rank(z);
  const lerp = (p: number, q: number) => p + (q - p) * f;
  const peak = lerp(a.values[ra[0]!] ?? 1, z.values[rz[0]!] ?? 1);
  const labelW = size * 4.2, plotW = W - labelW - size * 4, top = example ? size * 2 : 0, rowH = (H - top - size * 1.2) / rows, barH = rowH * 0.66, open = span(frame, at, 20);
  const bars = names.map(name => ({name, y: lerp(ra.indexOf(name), rz.indexOf(name)) * rowH, v: lerp(a.values[name] ?? 0, z.values[name] ?? 0), down: rz.indexOf(name) > ra.indexOf(name)}));
  // A bar moving down passes behind the one it swaps with: it thins and loses its labels while within a row of another bar, so bars never fuse.
  const crossing = (r: typeof bars[number]) => (r.down ? Math.max(0, ...bars.filter(o => o !== r).map(o => 1 - Math.abs(o.y - r.y) / rowH)) : 0);
  const lead = bars.reduce((m, r) => (r.v > m ? r.v : m), 0);
  return <Box b={b}>
    <MotionProbe id={b.id ?? `bar-chart-race-${at}`} value={(lead / peak) * plotW * open} family="shape" axis="x" />
    <Pill b={b} copy={[unit, ...names, ...snapshots.map(s => s.label)]} />
    <div style={{position: 'absolute', right: size * 0.6, bottom: size * 0.4, color: ink, fontFamily: fonts.display, fontSize: size * 2.2, opacity: 0.35, ...tabular}}>{f < 0.5 ? a.label : z.label}</div>
    {bars.filter(r => r.y < rows * rowH - 1).map(r => {
      const cross = crossing(r), h = barH * (1 - 0.6 * cross), end = labelW + (r.v / peak) * plotW * open;
      return <div key={r.name} data-row={r.name} style={{position: 'absolute', left: 0, top: top + r.y + (rowH - barH) / 2, width: W, height: barH, opacity: Math.min(1, (rows - r.y / rowH) * 1.5)}}>
        <div style={{position: 'absolute', right: W - labelW + size * 0.5, top: 0, height: barH, display: 'flex', alignItems: 'center', color: ink, fontFamily: fonts.ui, fontSize: size, whiteSpace: 'nowrap', opacity: 1 - cross}}>{r.name}</div>
        <div style={{position: 'absolute', left: labelW, top: (barH - h) / 2, height: h, width: Math.max(0, end - labelW), borderRadius: radius, background: accent, opacity: 1 - 0.5 * cross}} />
        <div style={{position: 'absolute', left: end + size * 0.5, top: 0, height: barH, display: 'flex', alignItems: 'center', color: ink, fontFamily: fonts.display, fontSize: size * 1.05, opacity: 1 - cross, ...tabular}}>{fmt(r.v)}{unit}</div>
      </div>;
    })}
  </Box>;
}

export type DonutProps = Block & {value: number; max?: number; unit?: string; label?: string; thickness?: number};
/** A progress ring (makePie) sweeps to the value while the centre number counts up; `label` sits under the number. */
export function Donut(b: DonutProps) {
  const {frame, at, value, max = 100, unit = '%', label, palette: {ink, accent, soft}, fonts, example = true} = b;
  const {size, W, H} = dims(b);
  const duration = b.duration ?? 45, thickness = b.thickness ?? size * 0.8;
  // The ring keeps clear of the sample-tag band at the top.
  const band = example ? size * 2 : 0, s = Math.min(W, H - band), r = s / 2 - thickness / 2, p = span(frame, at, duration);
  const ring = makePie({radius: r, progress: (value / max) * p, closePath: false});
  return <Box b={b}>
    <MotionProbe id={b.id ?? `donut-${at}`} value={p} family="shape" axis="progress" />
    <Pill b={b} copy={[unit, label]} />
    <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0}}>
      <g transform={`translate(${(W - s) / 2 + thickness / 2} ${band + (H - band - s) / 2 + thickness / 2})`}>
        <circle cx={r} cy={r} r={r} fill="none" stroke={soft} strokeWidth={thickness} />
        {p > 0 ? <path d={ring.path} fill="none" stroke={accent} strokeWidth={thickness} strokeLinecap="round" /> : null}
      </g>
    </svg>
    <div style={{position: 'absolute', left: 0, right: 0, top: band, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: size * 0.4}}>
      <div style={{color: ink, fontFamily: fonts.display, fontSize: size * 2.4, ...tabular}}>{fmt(value * p)}{unit}</div>
      {label ? <div style={{color: ink, fontFamily: fonts.ui, fontSize: size, opacity: span(frame, at + duration * 0.5, duration * 0.4), lineHeight: 1, whiteSpace: 'nowrap'}}>{label}</div> : null}
    </div>
  </Box>;
}

export type HeatmapProps = Block & {rows: number[][]; rowLabels?: string[]; colLabels?: string[]; order?: 'rows' | 'seeded'; seed?: string; max?: number};
/** Grid cells pop in row-major or in a seeded shuffle; each cell's alpha follows its value. */
export function Heatmap(b: HeatmapProps) {
  const {frame, at, rows, rowLabels = [], colLabels = [], order = 'rows', seed = 'heatmap', fps = 30, palette: {ink, accent, soft}, fonts, example = true} = b;
  const {size, stroke, radius, W, H} = dims(b);
  const duration = b.duration ?? 60;
  const cols = Math.max(...rows.map(r => r.length)), max = b.max ?? Math.max(...rows.flat());
  const left = rowLabels.length ? size * 3.4 : 0, band = example ? size * 2 : 0, top = band + (colLabels.length ? size * 1.6 : 0), gap = stroke * 0.5;
  const cw = (W - left - gap * (cols - 1)) / cols, ch = (H - top - gap * (rows.length - 1)) / rows.length;
  const cells = rows.flatMap((r, ri) => r.map((v, ci) => ({ri, ci, v, k: ri * cols + ci})));
  const slot = [...cells].sort((p, q) => (order === 'seeded' ? random(`${seed}-${p.k}`) - random(`${seed}-${q.k}`) : p.k - q.k)).map(c => c.k);
  const start = (k: number) => at + (slot.indexOf(k) / cells.length) * duration * 0.75;
  return <Box b={b}>
    <MotionProbe id={b.id ?? `heatmap-${at}`} value={span(frame, at, duration * 0.75)} family="shape" axis="progress" />
    <Pill b={b} copy={[...rowLabels, ...colLabels]} />
    <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0}}>
      {cells.map(c => {
        const p = pop(frame, start(c.k), 12, fps), x = left + c.ci * (cw + gap) + (cw * (1 - p)) / 2, y = top + c.ri * (ch + gap) + (ch * (1 - p)) / 2;
        return <g key={c.k}>
          <rect x={x} y={y} width={cw * p} height={ch * p} rx={radius * 0.6} fill={soft} />
          <rect x={x} y={y} width={cw * p} height={ch * p} rx={radius * 0.6} fill={accent} opacity={max ? c.v / max : 0} />
        </g>;
      })}
    </svg>
    {rowLabels.map((l, ri) => <div key={l} style={{position: 'absolute', left: 0, width: left - size * 0.6, top: top + ri * (ch + gap), height: ch, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', color: ink, fontFamily: fonts.ui, fontSize: size, opacity: span(frame, at, 12), whiteSpace: 'nowrap'}}>{l}</div>)}
    {colLabels.map((l, ci) => <div key={l} style={{position: 'absolute', left: left + ci * (cw + gap), width: cw, top: band, height: top - band - size * 0.3, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ink, fontFamily: fonts.ui, fontSize: size, opacity: span(frame, at, 12), whiteSpace: 'nowrap'}}>{l}</div>)}
  </Box>;
}

export type SparklineProps = Block & {data: number[]; dot?: boolean};
/** A small inline line for cards: draws in over `duration`, a dot rides the leading end. */
export function Sparkline(b: SparklineProps) {
  const {frame, at, data, dot = true, palette: {ink, accent}} = b;
  const {size, stroke} = dims(b);
  const W = b.width ?? size * 8, H = b.height ?? size * 2, duration = b.duration ?? 30;
  const lo = Math.min(...data), hi = Math.max(...data), pad = stroke;
  const d = data.map((v, i) => `${i ? 'L' : 'M'}${pad + (i / Math.max(1, data.length - 1)) * (W - pad * 2)} ${H - pad - ((v - lo) / (hi - lo || 1)) * (H - pad * 2)}`).join(' ');
  const draw = span(frame, at, duration);
  const head = getPointAtLength(d, getLength(d) * draw);
  return <Box b={{...b, width: W, height: H}}>
    <MotionProbe id={b.id ?? `sparkline-${at}`} value={draw} family="shape" axis="progress" />
    <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
      {draw > 0 ? <path d={d} stroke={accent} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" fill="none" {...evolvePath(draw, d)} /> : null}
      {dot && head && draw > 0 ? <circle cx={head.x} cy={head.y} r={stroke * 0.9} fill={ink} /> : null}
    </svg>
  </Box>;
}

const base = ['frame', 'at', 'out', 'duration', 'fps', 'palette', 'fonts', 'size', 'stroke', 'radius', 'x', 'y', 'width', 'height', 'id', 'example=true|false|text', 'lang=en|ja|ko'];
export const CHART_BLOCKS: BlockEntry[] = [
  {id: 'bar-chart', when: 'Compare a handful of categories or months; the counters make the values readable at speed.', title: 'Bar chart', family: 'chart', props: [...base, 'data', 'max', 'target', 'unit'], sample: 'data-reel'},
  {id: 'line-chart', when: 'Show a trend over time; the drawing line carries the eye to the last value.', title: 'Line chart', family: 'chart', props: [...base, 'data', 'max', 'min', 'area', 'unit'], sample: 'data-reel'},
  {id: 'bar-chart-race', when: 'Show rankings changing between snapshots (months, rounds, versions).', title: 'Bar chart race', family: 'chart', props: [...base, 'snapshots', 'top', 'unit'], sample: 'data-reel'},
  {id: 'donut', when: 'One share or completion rate that deserves the whole beat.', title: 'Donut', family: 'chart', props: [...base, 'value', 'max', 'unit', 'label', 'thickness'], sample: 'data-reel'},
  {id: 'heatmap', when: 'A two-axis density (weekday by hour, region by month) where the pattern matters more than the numbers.', title: 'Heatmap', family: 'chart', props: [...base, 'rows', 'rowLabels', 'colLabels', 'order', 'seed', 'max'], sample: 'data-reel'},
  {id: 'sparkline', when: 'A small trend inside a card or next to a number; no axes, no labels.', title: 'Sparkline', family: 'chart', props: [...base, 'data', 'dot'], sample: 'data-reel'},
];
