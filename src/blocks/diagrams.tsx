import type {ReactNode} from 'react';
import {Easing, MotionProbe, evolvePath, interpolate, spring} from 'frameforge';
import type {BlockEntry} from './types';

// Diagrams draw their lines as SVG paths in one stroke width; labels are HTML outside any clipping box.
type Palette = {ink: string; paper: string; accent: string; soft: string};
type Fonts = {display: string; ui: string};
type Block = {frame: number; at: number; out?: number; duration?: number; fps?: number; palette: Palette; fonts: Fonts; size?: number; stroke?: number; radius?: number; x?: number; y?: number; width?: number; height?: number; id?: string};
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const span = (frame: number, from: number, dur: number) => interpolate(frame, [from, from + dur], [0, 1], {...clamp, easing: ease});
const pop = (frame: number, at: number, dur: number, fps: number) => spring({frame, fps, delay: at, durationInFrames: dur, config: {overshootClamping: true}});
const dims = (b: Block) => { const size = b.size ?? 38; return {size, stroke: b.stroke ?? size * (1.5 / 3.5), radius: b.radius ?? size * 0.4, W: b.width ?? size * 20, H: b.height ?? size * 10}; };
const line = (d: string, colour: string, stroke: number, draw = 1, key?: string | number) => <path key={key} d={d} stroke={colour} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" fill="none" {...evolvePath(draw, d)} />;

function Box({b, children}: {b: Block; children: ReactNode}) {
  const {W, H} = dims(b);
  if (b.frame < b.at || (b.out !== undefined && b.frame >= b.out)) return null;
  return <div style={{position: 'absolute', left: b.x ?? 0, top: b.y ?? 0, width: W, height: H, opacity: b.out === undefined ? 1 : 1 - span(b.frame, b.out - 8, 8)}}>{children}</div>;
}

const label = (b: Block, font: string, extra: object = {}) => ({color: b.palette.ink, fontFamily: font, fontSize: dims(b).size, lineHeight: 1, whiteSpace: 'nowrap' as const, ...extra});

export type FlowchartProps = Block & {nodes: {id: string; label: string; shape?: 'rect' | 'pill'}[]; edges?: [string, string][]; direction?: 'row' | 'column'};
/** Nodes pop in with a stagger; each connector draws from its source to its target with an arrowhead once both nodes landed. */
export function Flowchart(b: FlowchartProps) {
  const {frame, at, nodes, direction = 'row', fps = 30, palette: {ink, paper, accent, soft}, fonts} = b;
  const {size, stroke, radius, W, H} = dims(b);
  const edges = b.edges ?? nodes.slice(1).map((n, i) => [nodes[i]!.id, n.id] as [string, string]);
  const n = nodes.length, row = direction === 'row', gap = size * 2.4, stagger = 7, grow = 18;
  const nodeW = row ? (W - gap * (n - 1)) / n : W, nodeH = row ? Math.min(H, size * 4.5) : (H - gap * (n - 1)) / n;
  const box = (i: number) => ({x: row ? i * (nodeW + gap) : 0, y: row ? (H - nodeH) / 2 : i * (nodeH + gap)});
  const index = (id: string) => nodes.findIndex(node => node.id === id);
  const pops = nodes.map((_, i) => pop(frame, at + i * stagger, grow, fps));
  const head = stroke * 1.6;
  return <Box b={b}>
    <MotionProbe id={b.id ?? `flowchart-${at}`} value={pops[0] ?? 0} family="card" axis="scale" />
    <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
      {edges.map(([from, to]) => {
        const a = index(from), z = index(to);
        if (a < 0 || z < 0) return null;
        const p = box(a), q = box(z), draw = span(frame, at + Math.max(a, z) * stagger + grow * 0.7, 14);
        const d = row
          ? `M${p.x + nodeW + stroke} ${p.y + nodeH / 2} L${q.x - stroke * 1.2} ${q.y + nodeH / 2} M${q.x - stroke * 1.2 - head} ${q.y + nodeH / 2 - head} L${q.x - stroke * 1.2} ${q.y + nodeH / 2} L${q.x - stroke * 1.2 - head} ${q.y + nodeH / 2 + head}`
          : `M${p.x + nodeW / 2} ${p.y + nodeH + stroke} L${q.x + nodeW / 2} ${q.y - stroke * 1.2} M${q.x + nodeW / 2 - head} ${q.y - stroke * 1.2 - head} L${q.x + nodeW / 2} ${q.y - stroke * 1.2} L${q.x + nodeW / 2 + head} ${q.y - stroke * 1.2 - head}`;
        return draw > 0 ? line(d, ink, stroke, draw, `${from}-${to}`) : null;
      })}
    </svg>
    {nodes.map((node, i) => {
      const {x, y} = box(i), p = pops[i]!, pill = node.shape === 'pill';
      return <div key={node.id} style={{position: 'absolute', left: x, top: y, width: nodeW, height: nodeH, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: pill ? nodeH / 2 : radius, background: pill ? accent : soft, transform: `scale(${p})`, visibility: p === 0 ? 'hidden' : 'visible', ...label(b, fonts.ui, {color: pill ? paper : ink})}}>{node.label}</div>;
    })}
  </Box>;
}

export type ProcessStepsProps = Block & {steps: string[]; active?: number};
/** Numbered circles along a track: the fill runs to the active step and that step scales up; without `active` the beat walks through all steps. */
export function ProcessSteps(b: ProcessStepsProps) {
  const {frame, at, steps, palette: {ink, paper, accent, soft}, fonts} = b;
  const {size, stroke, W, H} = dims(b);
  const duration = b.duration ?? 60, n = steps.length, r = size * 0.95, left = r + stroke, step = (W - left * 2) / Math.max(1, n - 1), y = H * 0.4;
  const activeAt = b.active === undefined ? interpolate(frame, [at + 8, at + duration], [0, n - 1], {...clamp, easing: Easing.inOut(Easing.cubic)}) : span(frame, at + 8, duration * 0.6) * b.active;
  const fillX = left + activeAt * step, track = `M${left} ${y} L${W - left} ${y}`, fill = `M${left} ${y} L${fillX} ${y}`;
  return <Box b={b}>
    <MotionProbe id={b.id ?? `process-steps-${at}`} value={fillX} family="shape" axis="x" />
    <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
      {line(track, soft, stroke, span(frame, at, 12))}
      {activeAt > 0 ? line(fill, accent, stroke) : null}
    </svg>
    {steps.map((text, i) => {
      const reached = activeAt >= i - 0.01, near = 1 - Math.min(1, Math.abs(i - activeAt)), grow = span(frame, at + 4 + i * 4, 12);
      // Circles are HTML, not svg, so the number's background is the circle for the contrast audit.
      return <div key={text}>
        <div style={{position: 'absolute', left: left + i * step - r, top: y - r, width: r * 2, height: r * 2, boxSizing: 'border-box', borderRadius: '50%', border: `${stroke * 0.5}px solid ${paper}`, background: reached ? accent : soft, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${grow * (1 + 0.3 * near)})`, visibility: grow === 0 ? 'hidden' : 'visible', ...label(b, fonts.display, {color: reached ? paper : ink, fontVariantNumeric: 'tabular-nums'})}}>{i + 1}</div>
        <div style={{position: 'absolute', left: left + i * step - step / 2, width: step, top: y + r * 1.3 + size * 0.5, textAlign: 'center', opacity: span(frame, at + 10 + i * 4, 12) * (0.75 + 0.25 * near), ...label(b, fonts.ui)}}>{text}</div>
      </div>;
    })}
  </Box>;
}

export type TimelineProps = Block & {items: {date: string; label: string}[]};
/** Milestones on a horizontal rule with alternating labels; a marker travels along and each milestone pops as it passes. */
export function Timeline(b: TimelineProps) {
  const {frame, at, items, fps = 30, palette: {ink, accent, soft}, fonts} = b;
  const {size, stroke, W, H} = dims(b);
  const duration = b.duration ?? 60, n = items.length, left = size * 2, step = (W - left * 2) / Math.max(1, n - 1), y = H / 2;
  const t = interpolate(frame, [at + 10, at + duration], [0, n - 1], {...clamp, easing: Easing.inOut(Easing.cubic)}), mx = left + t * step;
  const rule = `M${left} ${y} L${W - left} ${y}`;
  return <Box b={b}>
    <MotionProbe id={b.id ?? `timeline-${at}`} value={mx} family="shape" axis="x" />
    <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
      {line(rule, soft, stroke, span(frame, at, 14))}
      {t > 0 ? line(`M${left} ${y} L${mx} ${y}`, accent, stroke) : null}
      {items.map((_, i) => {
        const x = left + i * step, up = i % 2 === 0, reach = at + 10 + ((i / Math.max(1, n - 1)) * (duration - 10)) * 0.92, p = pop(frame, reach, 14, fps);
        return <g key={i}>
          {line(`M${x} ${y} L${x} ${up ? y - size * 1.3 : y + size * 1.3}`, ink, stroke, p)}
          <circle cx={x} cy={y} r={stroke * 1.1 * p} fill={ink} />
        </g>;
      })}
      <circle cx={mx} cy={y} r={stroke * 1.6} fill={accent} stroke={ink} strokeWidth={stroke * 0.5} />
    </svg>
    {items.map((item, i) => {
      const x = left + i * step, up = i % 2 === 0, reach = at + 10 + ((i / Math.max(1, n - 1)) * (duration - 10)) * 0.92, p = pop(frame, reach, 14, fps);
      return <div key={i} style={{position: 'absolute', left: x - step / 2, width: step, top: up ? y - size * 1.9 - size * 2.3 : y + size * 1.9, display: 'flex', flexDirection: up ? 'column-reverse' : 'column', alignItems: 'center', gap: size * 0.3, opacity: p, transform: `translateY(${(1 - p) * (up ? size * 0.5 : -size * 0.5)}px)`}}>
        <div style={label(b, fonts.display, {color: accent, fontVariantNumeric: 'tabular-nums'})}>{item.date}</div>
        <div style={label(b, fonts.ui)}>{item.label}</div>
      </div>;
    })}
  </Box>;
}

export type CompareProps = Block & {columns: [string, string]; rows: {label: string; a: boolean | string; b: boolean | string}[]};
/** Two columns, rows revealing in sync; a boolean cell draws a check (accent) or a cross (ink) once its row landed, a string cell prints. */
export function Compare(b: CompareProps) {
  const {frame, at, columns, rows, fps = 30, palette: {ink, accent, soft}, fonts} = b;
  const {size, stroke, radius, W, H} = dims(b);
  const headH = size * 2.2, rowH = (H - headH) / Math.max(1, rows.length), labelW = W * 0.4, colW = (W - labelW) / 2, m = size * 0.5;
  const check = `M${-m * 0.9} ${0} L${-m * 0.2} ${m * 0.7} L${m} ${-m * 0.7}`, cross = `M${-m * 0.7} ${-m * 0.7} L${m * 0.7} ${m * 0.7} M${m * 0.7} ${-m * 0.7} L${-m * 0.7} ${m * 0.7}`;
  const under = `M0 ${headH - stroke} L${W} ${headH - stroke}`;
  const lands = rows.map((_, i) => pop(frame, at + 6 + i * 6, 16, fps));
  return <Box b={b}>
    <MotionProbe id={b.id ?? `compare-${at}`} value={(1 - (lands[0] ?? 1)) * size} family="card" axis="y" />
    <div style={{position: 'absolute', left: labelW, top: 0, width: colW * 2, height: H, display: 'flex'}}>
      {columns.map((c, k) => <div key={c} style={{width: colW, height: headH - size * 0.4, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: radius, background: k === 1 ? accent : soft, opacity: span(frame, at, 12), ...label(b, fonts.display, {color: k === 1 ? b.palette.paper : ink, fontSize: size * 1.1})}}>{c}</div>)}
    </div>
    {rows.map((r, i) => {
      const p = lands[i]!;
      return <div key={r.label} style={{position: 'absolute', left: 0, top: headH + i * rowH, width: W, height: rowH, display: 'flex', alignItems: 'center', opacity: p, transform: `translateY(${(1 - p) * size * 0.6}px)`, background: i % 2 ? soft : 'transparent', borderRadius: radius}}>
        <div style={{width: labelW, paddingLeft: size * 0.6, boxSizing: 'border-box', ...label(b, fonts.ui)}}>{r.label}</div>
        {[r.a, r.b].map((v, k) => <div key={k} style={{width: colW, textAlign: 'center', ...label(b, fonts.ui)}}>{typeof v === 'string' ? v : ''}</div>)}
      </div>;
    })}
    <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
      {line(under, ink, stroke, span(frame, at, 14))}
      {rows.map((r, i) => [r.a, r.b].map((v, k) => typeof v === 'boolean'
        ? <g key={`${i}-${k}`} transform={`translate(${labelW + colW * k + colW / 2} ${headH + i * rowH + rowH / 2})`}>{line(v ? check : cross, v ? accent : ink, stroke, span(frame, at + 14 + i * 6, 10), undefined)}</g>
        : null))}
    </svg>
  </Box>;
}

const base = ['frame', 'at', 'out', 'duration', 'fps', 'palette', 'fonts', 'size', 'stroke', 'radius', 'x', 'y', 'width', 'height', 'id'];
export const DIAGRAM_BLOCKS: BlockEntry[] = [
  {id: 'flowchart', when: 'A pipeline or decision path of two to six named steps with arrows.', title: 'Flowchart', family: 'diagram', props: [...base, 'nodes', 'edges', 'direction'], sample: 'data-reel'},
  {id: 'process-steps', when: 'Onboarding or how-it-works in numbered steps along one line.', title: 'Process steps', family: 'diagram', props: [...base, 'steps', 'active'], sample: 'data-reel'},
  {id: 'timeline', when: 'Dated milestones on one horizontal rule.', title: 'Timeline', family: 'diagram', props: [...base, 'items'], sample: 'data-reel'},
  {id: 'compare', when: 'Two plans or two options against the same rows, with checks and crosses.', title: 'Compare', family: 'diagram', props: [...base, 'columns', 'rows'], sample: 'data-reel'},
];
