import type {CSSProperties, ReactNode} from 'react';
import {random} from 'frameforge';

/** Line weight and corner radius in px on the 1080 frame, the same at every size. Each asset converts both into its 400-unit viewBox. */
export const STROKE = 16;
export const RADIUS = 24;

const paper = '#F4F1EA';
const accent = '#FF4D6D';
const ink = '#0B0B14';

type Props = {draw?: number; size: number; color?: string; style?: CSSProperties};

/** Stroke trace for pathLength 1; the 1 2 dash leaves no round-cap dot at draw 0. */
const trace = (draw: number) => ({pathLength: 1, strokeDasharray: '1 2', strokeDashoffset: 1 - draw});
/** Filled marks arrive once the outline is mostly drawn. */
const after = (draw: number) => Math.min(1, Math.max(0, (draw - 0.6) / 0.4));
const vb = (px: number, size: number) => (px * 400) / size;

function Frame({size, color, draw, style, children}: {size: number; color: string; draw: number; style?: CSSProperties; children: ReactNode}) {
  return <svg width={size} height={size} viewBox="0 0 400 400" style={{overflow: 'visible', visibility: draw === 0 ? 'hidden' : 'visible', ...style}}>
    <g fill="none" stroke={color} strokeWidth={vb(STROKE, size)} strokeLinecap="round" strokeLinejoin="round">{children}</g>
  </svg>;
}

/** Four-point star with concave sides; c pulls the side curves towards the centre. */
const star = (x: number, y: number, arm: number, c: number) =>
  `M${x} ${y - arm}Q${x + c} ${y - c} ${x + arm} ${y}Q${x + c} ${y + c} ${x} ${y + arm}Q${x - c} ${y + c} ${x - arm} ${y}Q${x - c} ${y - c} ${x} ${y - arm}Z`;

/** Zone 1, the garden of light: a big outlined sparkle, a small filled sparkle (the characteristic detail), a dot and a small ring. 4 shapes. */
export function Sparkle({draw = 1, size, color = accent, style}: Props) {
  const f = after(draw);
  return <Frame size={size} color={color} draw={draw} style={style}>
    <path d={star(176, 224, 144, 24)} {...trace(draw)} />
    <path d={star(312, 96, 56, 8)} fill={color} fillOpacity={f} {...trace(draw)} />
    <circle cx={320} cy={312} r={16} fill={color} stroke="none" opacity={f} />
    <circle cx={64} cy={80} r={24} {...trace(draw)} />
  </Frame>;
}

/** Zone 2, the sound square: two beamed eighth notes. 5 shapes: two filled heads, two stems, the beam (the characteristic detail). */
export function Music({draw = 1, size, color = accent, style}: Props) {
  const f = after(draw);
  return <Frame size={size} color={color} draw={draw} style={style}>
    <circle cx={128} cy={296} r={48} fill={color} fillOpacity={f} {...trace(draw)} />
    <circle cx={288} cy={264} r={48} fill={color} fillOpacity={f} {...trace(draw)} />
    <path d="M176 296V104" {...trace(draw)} />
    <path d="M336 264V72" {...trace(draw)} />
    <path d="M176 104L336 72V120L176 152Z" fill={color} fillOpacity={f} {...trace(draw)} />
  </Frame>;
}

/** Zone 3, the memory alley: a camera seen from the front. 5 shapes: body, top hump, lens ring, filled lens centre, flash dot (the characteristic detail). */
export function Camera({draw = 1, size, color = accent, style}: Props) {
  const f = after(draw);
  return <Frame size={size} color={color} draw={draw} style={style}>
    <rect x={48} y={128} width={304} height={208} rx={vb(RADIUS, size)} {...trace(draw)} />
    <path d="M136 128L160 80H240L264 128" {...trace(draw)} />
    <circle cx={200} cy={232} r={72} {...trace(draw)} />
    <circle cx={200} cy={232} r={24} fill={color} stroke="none" opacity={f} />
    <circle cx={304} cy={176} r={12} fill={color} stroke="none" opacity={f} />
  </Frame>;
}

/** The entry ticket: a stub with round notches top and bottom on the tear line. 6 shapes: the outline, three perforation dots (the characteristic detail), two print lines. */
export function Ticket({draw = 1, size, color = accent, style}: Props) {
  const f = after(draw);
  const r = vb(RADIUS, size);
  return <Frame size={size} color={color} draw={draw} style={style}>
    <path d={`M${48 + r} 96H224A40 40 0 0 0 304 96H${352 - r}A${r} ${r} 0 0 1 352 ${96 + r}V${304 - r}A${r} ${r} 0 0 1 ${352 - r} 304H304A40 40 0 0 0 224 304H${48 + r}A${r} ${r} 0 0 1 48 ${304 - r}V${96 + r}A${r} ${r} 0 0 1 ${48 + r} 96Z`} {...trace(draw)} />
    {[168, 200, 232].map(y => <circle key={y} cx={264} cy={y} r={8} fill={color} stroke="none" opacity={f} />)}
    <path d="M104 168H176" {...trace(draw)} />
    <path d="M104 232H152" {...trace(draw)} />
  </Frame>;
}

const snap = (v: number) => Math.round(v / 8) * 8;
/** Seven seeded stops on the 8 px grid; every third one is filled, the rest knock the roads out in the ink background. */
const NODES = Array.from({length: 7}, (_, i) => {
  const angle = (i / 7) * Math.PI * 2 + random('map-angle') * 0.5;
  const r = 96 + random(`map-r-${i}`) * 88;
  return {x: snap(200 + Math.cos(angle) * r), y: snap(200 + Math.sin(angle) * r), r: snap(16 + random(`map-s-${i}`) * 24)};
});
/** A loop through the seven stops and three cross streets: 10 roads. */
export const MAP_EDGES = [...NODES.map((a, i) => ({a, b: NODES[(i + 1) % 7]!})), ...[0, 2, 4].map(i => ({a: NODES[i]!, b: NODES[(i + 3) % 7]!}))];
export const MAP_NODES = NODES.length;

/** The festival map: stops joined by roads. `lines` draws each road (0..1, MAP_EDGES order) and `dots` scales each stop; both default to `draw`. */
export function FestivalMap({draw = 1, size, color = paper, style, lines, dots}: Props & {lines?: number[]; dots?: number[]}) {
  return <Frame size={size} color={color} draw={1} style={style}>
    {MAP_EDGES.map(({a, b}, i) => <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} {...trace(lines?.[i] ?? draw)} visibility={(lines?.[i] ?? draw) === 0 ? 'hidden' : undefined} />)}
    {NODES.map((n, i) => <circle key={i} cx={n.x} cy={n.y} r={n.r * (dots?.[i] ?? draw)} fill={i % 3 === 0 ? accent : ink} stroke={accent} />)}
  </Frame>;
}
