import type {CSSProperties, ReactNode} from 'react';

/** Line weight and corner radius in px on the 1080 frame, shared with the film's HTML boxes. Each asset converts both into its 400-unit viewBox. */
export const STROKE = 18;
export const RADIUS = 12;

const ink = '#1C1917';
const accent = '#EA580C';
const soft = '#FED7AA';

type Props = {draw?: number; size: number; color?: string; style?: CSSProperties};

/** Stroke trace for pathLength 1; the 1 2 dash leaves no round-cap dot at draw 0. */
const trace = (draw: number) => ({pathLength: 1, strokeDasharray: '1 2', strokeDashoffset: 1 - draw});
/** Fills arrive once the outline is mostly drawn. */
const after = (draw: number) => Math.min(1, Math.max(0, (draw - 0.6) / 0.4));

function Frame({size, color, draw, style, children}: Required<Pick<Props, 'size' | 'color' | 'draw'>> & {style?: CSSProperties; children: ReactNode}) {
  return <svg width={size} height={size} viewBox="0 0 400 400" style={{overflow: 'visible', visibility: draw === 0 ? 'hidden' : 'visible', ...style}}>
    <g fill="none" stroke={color} strokeWidth={(STROKE * 400) / size} strokeLinecap="round" strokeLinejoin="round">{children}</g>
  </svg>;
}

/** The delivery scooter, side view facing right, centred on the viewBox so it can turn about the route point. 9 shapes: two wheels, the rear cowl, the floor and steering column, the handlebar, the seat, the delivery box with its lid line (the characteristic detail), the headlight. */
export function Scooter({draw = 1, size, color = ink, style}: Props) {
  const r = (RADIUS * 400) / size;
  const f = after(draw);
  return <Frame size={size} color={color} draw={draw} style={style}>
    <rect x={48} y={88} width={136} height={112} rx={r} fill={accent} fillOpacity={f} {...trace(draw)} />
    <path d="M48 128H184" {...trace(draw)} />
    <path d="M48 288C48 232 88 208 144 208H208L224 288Z" fill={soft} fillOpacity={f} {...trace(draw)} />
    <path d="M128 200H216" {...trace(draw)} />
    <path d="M224 288H272L296 136" {...trace(draw)} />
    <path d="M272 128H328" {...trace(draw)} />
    <circle cx={312} cy={176} r={16} fill={accent} fillOpacity={f} {...trace(draw)} />
    <circle cx={104} cy={312} r={40} fill={soft} fillOpacity={f} {...trace(draw)} />
    <circle cx={312} cy={312} r={40} fill={soft} fillOpacity={f} {...trace(draw)} />
  </Frame>;
}

/** Tip of the pin in viewBox units: place this point on the route. */
export const PIN_TIP = {x: 200, y: 376};

/** A stop on the route: map pin with a target in its head. 4 shapes: the pin body, the soft disc, the accent dot, the ground ring under the tip (a flat ring, not a shadow). */
export function Pin({draw = 1, size, color = ink, style}: Props) {
  const f = after(draw);
  return <Frame size={size} color={color} draw={draw} style={style}>
    <ellipse cx={200} cy={376} rx={80} ry={20} {...trace(draw)} />
    <path d="M200 376C152 304 64 240 64 160A136 136 0 1 1 336 160C336 240 248 304 200 376Z" fill={accent} fillOpacity={f} {...trace(draw)} />
    <circle cx={200} cy={160} r={64} fill={soft} fillOpacity={f} {...trace(draw)} />
    <circle cx={200} cy={160} r={16} fill={accent} stroke="none" opacity={f} />
  </Frame>;
}

/**
 * The front door, a double door in its frame. 7 shapes: the frame, the lit interior, two leaves, two knobs, the threshold.
 * open 0..1 swings each leaf 70 degrees towards the viewer: the leaf narrows by the cosine and its far edge grows a little, a flat stand-in for perspective.
 * The frame spans x 64 to 336 and y 8 to 392.
 */
export function Door({draw = 1, size, color = ink, style, open = 0}: Props & {open?: number}) {
  const r = (RADIUS * 400) / size;
  const f = after(draw);
  const a = (open * 70 * Math.PI) / 180;
  const w = 112 * Math.cos(a);
  const e = 112 * Math.sin(a) * 0.12;
  const leaf = (hinge: number, dir: 1 | -1) => {
    const far = hinge + dir * w;
    return <g>
      <path d={`M${hinge} 32L${far} ${32 - e}V${392 + e}L${hinge} 392Z`} fill={accent} fillOpacity={f} {...trace(draw)} />
      <circle cx={far - dir * 20 * Math.cos(a)} cy={216} r={10} fill={soft} fillOpacity={f} {...trace(draw)} />
    </g>;
  };
  return <Frame size={size} color={color} draw={draw} style={style}>
    <rect x={88} y={32} width={224} height={360} fill={soft} stroke="none" opacity={f} />
    <rect x={64} y={8} width={272} height={384} rx={r} {...trace(draw)} />
    {leaf(88, 1)}
    {leaf(312, -1)}
    <path d="M40 392H360" {...trace(draw)} />
  </Frame>;
}
