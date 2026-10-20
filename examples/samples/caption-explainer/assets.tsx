import type {CSSProperties, ReactNode} from 'react';

/** Line weight and corner radius in px on the 1080 frame. Each asset converts both into its 400-unit viewBox, so every size shares one visible weight and corner. */
export const STROKE = 16;
export const RADIUS = 32;

const ink = '#1E1B4B';
const accent = '#F59E0B';
const soft = '#FEF3C7';

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

/** A rounded box from (x0, y0) to (x1, y1) with the tail on the bottom edge between tx0 and tx1, pointing at (px, py). One path, so it traces in one pass. */
function bubblePath(x0: number, y0: number, x1: number, y1: number, r: number, tail: [number, number, number, number]) {
  const [tx0, tx1, px, py] = tail;
  return `M${x0 + r} ${y0}H${x1 - r}Q${x1} ${y0} ${x1} ${y0 + r}V${y1 - r}Q${x1} ${y1} ${x1 - r} ${y1}H${tx1}L${px} ${py}L${tx0} ${y1}H${x0 + r}Q${x0} ${y1} ${x0} ${y1 - r}V${y0 + r}Q${x0} ${y0} ${x0 + r} ${y0}Z`;
}

/**
 * The hero: a wide speech bubble whose three typing dots are the characteristic detail. 4 shapes: the body with its tail, three dots.
 * Footprint is 368 by 200 units inside the square (y 104 to 304), so at size 1000 it covers 920 by 500 px. dots scales each dot (0..1) for a staggered pop.
 */
export function Speech({draw = 1, size, color = ink, style, dots = [1, 1, 1]}: Props & {dots?: readonly number[]}) {
  const r = (RADIUS * 400) / size;
  return <Frame size={size} color={color} draw={draw} style={style}>
    <path d={bubblePath(16, 104, 384, 264, r, [128, 168, 120, 304])} fill={soft} fillOpacity={after(draw)} {...trace(draw)} />
    {[152, 200, 248].map((cx, i) => <circle key={cx} cx={cx} cy={184} r={16} fill={accent} transform={`translate(${cx} 184) scale(${dots[i] ?? 0}) translate(${-cx} -184)`} />)}
  </Frame>;
}

/** The card's small mark: the hero bubble reduced to a near-square, with the same three dots. 4 shapes. */
export function Chat({draw = 1, size, color = ink, style}: Props) {
  const r = (RADIUS * 400) / size;
  return <Frame size={size} color={color} draw={draw} style={style}>
    <path d={bubblePath(40, 64, 360, 288, r, [104, 168, 96, 352])} fill={soft} fillOpacity={after(draw)} {...trace(draw)} />
    {[120, 200, 280].map(cx => <circle key={cx} cx={cx} cy={176} r={24} fill={accent} stroke="none" opacity={after(draw)} />)}
  </Frame>;
}

/** The brand seal on the card back: a bubble with a sprout growing out of it (말씨, a word seed). 5 shapes: bubble, stem, two leaves, the seed. */
export function Sprout({draw = 1, size, color = accent, style}: Props) {
  const r = (RADIUS * 400) / size;
  return <Frame size={size} color={color} draw={draw} style={style}>
    <path d={bubblePath(48, 176, 352, 336, r, [112, 168, 104, 384])} {...trace(draw)} />
    <path d="M200 256V120" {...trace(draw)} />
    <path d="M200 160C200 104 160 72 104 72C104 128 144 160 200 160Z" fill={soft} fillOpacity={after(draw)} {...trace(draw)} />
    <path d="M200 136C200 80 240 48 296 48C296 104 256 136 200 136Z" fill={soft} fillOpacity={after(draw)} {...trace(draw)} />
    <circle cx={200} cy={264} r={24} fill={color} stroke="none" opacity={after(draw)} />
  </Frame>;
}

/** Below this size the calendar drops its header rule and the check grows, so the line weight does not fill the page. */
const DETAIL = 200;

/** One day of the streak: a calendar leaf. 5 shapes: the page, the header rule, two binder rings, and the check that is the characteristic detail. done 0..1 fills the page accent and draws the check. */
export function Day({draw = 1, size, color = ink, style, done = 0}: Props & {done?: number}) {
  const r = (RADIUS * 400) / size;
  return <Frame size={size} color={color} draw={draw} style={style}>
    <rect x={40} y={72} width={320} height={296} rx={r} fill={accent} fillOpacity={done} {...trace(draw)} />
    {size >= DETAIL ? <path d="M40 152H360" {...trace(draw)} /> : null}
    <path d="M136 32V104M264 32V104" {...trace(draw)} />
    <path d={size >= DETAIL ? 'M128 256L184 312L280 208' : 'M120 224L184 288L288 184'} {...trace(done)} />
  </Frame>;
}
