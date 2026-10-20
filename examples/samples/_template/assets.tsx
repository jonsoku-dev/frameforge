import type {CSSProperties, ComponentType, ReactNode} from 'react';

// Placeholder assets: replace them with the film's own hero and its reductions (docs/guides/assets.md, 주 에셋 품질 기준).
// Front view, 400×400 viewBox on an 8-unit grid, one stroke and one radius for every asset, fills in the accent only.
/** One stroke width, in viewBox units: 20 is 5% of the drawing, about 10 px at the 195 px beat icon. */
export const STROKE = 20;
/** One corner radius, in viewBox units. */
export const RADIUS = 32;
const ink = '#111111';
const accent = '#2F5BFF';
const paper = '#F4F4F1';

/** `face` is the background colour, used only to hide what sits behind a front face. */
export type AssetProps = {draw?: number; size: number; color?: string; fill?: string; face?: string; style?: CSSProperties};
export type Asset = ComponentType<AssetProps>;

/** Lines draw first (`strokeDashoffset`); the fills arrive over the last 30% of `draw`. */
function Frame({draw, size, color, style, children}: {draw: number; size: number; color: string; style?: CSSProperties; children: (line: object, fill: number) => ReactNode}) {
  const line = {pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - draw, fill: 'none', stroke: color};
  const fill = Math.min(1, Math.max(0, (draw - 0.7) / 0.3));
  return <svg width={size} height={size} viewBox="0 0 400 400" style={style}>
    <g strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">{children(line, fill)}</g>
  </svg>;
}

const R = RADIUS;

/** A cup: body, handle, saucer, steam (4 shapes). The steam is the detail. */
export function Cup({draw = 1, size, color = ink, fill = accent, style}: AssetProps) {
  const body = `M96 144H288V${304 - R}Q288 304 ${288 - R} 304H${96 + R}Q96 304 96 ${304 - R}Z`;
  return <Frame draw={draw} size={size} color={color} style={style}>{(line, f) => <>
    <path d={body} fill={fill} fillOpacity={f} />
    <path d={body} {...line} />
    <path d="M288 176Q344 176 344 224Q344 272 288 272" {...line} />
    <path d="M56 352H328" {...line} />
    <path d="M192 112Q168 88 192 64Q216 40 192 16" {...line} />
  </>}</Frame>;
}

/** A card with an offset block behind it: block, face, header bar, two lines, a button (6 shapes). The offset block is the detail. */
export function Card({draw = 1, size, color = ink, fill = accent, face = paper, style}: AssetProps) {
  const rect = (x: number, y: number, w: number, h: number) => `M${x + R} ${y}H${x + w - R}Q${x + w} ${y} ${x + w} ${y + R}V${y + h - R}Q${x + w} ${y + h} ${x + w - R} ${y + h}H${x + R}Q${x} ${y + h} ${x} ${y + h - R}V${y + R}Q${x} ${y} ${x + R} ${y}Z`;
  return <Frame draw={draw} size={size} color={color} style={style}>{(line, f) => <>
    <path d={rect(80, 88, 280, 264)} fill={fill} fillOpacity={f} />
    <path d={rect(80, 88, 280, 264)} {...line} />
    <path d={rect(40, 48, 280, 264)} fill={face} />
    <path d={rect(40, 48, 280, 264)} {...line} />
    <path d="M88 112H200" {...line} />
    <path d="M88 176H272M88 224H232" {...line} />
    <circle cx={256} cy={264} r={16} {...line} fill={fill} fillOpacity={f} />
  </>}</Frame>;
}

export const ASSETS = {Cup, Card} satisfies Record<string, Asset>;
