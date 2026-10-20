import type {CSSProperties, ComponentType, ReactNode} from 'react';

// Front view, 400×400 viewBox on an 8-unit grid. Every asset is the same cup line: the hero cup at 560 px, its reductions on the cards.
/** One stroke width for the film, in viewBox units: 14 at the 560 px hero is about 20 px on screen. */
export const STROKE = 14;
/** One corner radius for the film, in viewBox units. */
export const RADIUS = 24;
const accent = '#D97706';
const soft = '#FDE68A';
const ink = '#1C1917';

export type AssetProps = {draw?: number; size: number; color?: string; fill?: string; shade?: string; style?: CSSProperties};
export type Asset = ComponentType<AssetProps>;

/** Lines draw first; the fills arrive over the last 30% of `draw`. */
function Frame({draw, size, color, style, children}: {draw: number; size: number; color: string; style?: CSSProperties; children: (line: object, fill: number) => ReactNode}) {
  const line = {pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - draw, fill: 'none', stroke: color};
  const fill = Math.min(1, Math.max(0, (draw - 0.7) / 0.3));
  return <svg width={size} height={size} viewBox="0 0 400 400" style={style}>
    <g strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">{children(line, fill)}</g>
  </svg>;
}

const R = RADIUS;
// Tapered cup body: rim 96–288 at y 136, base 120–264 at y 304.
const BODY = `M96 136H288L270 ${304 - R}Q264 304 ${264 - R} 304H${120 + R}Q120 304 114 ${304 - R}Z`;
const BAND = 'M102 192H282L276 248H108Z';
const RIM = 'M80 136H304';
const HANDLE = 'M286 168Q344 168 344 216Q344 264 276 264';
const SAUCER = `M48 336H336Q320 360 ${296 - R / 3} 360H${88 + R / 3}Q64 360 48 336Z`;
const STEAM = ['M160 104Q144 84 160 64Q176 44 160 24', 'M224 104Q208 84 224 64Q240 44 224 24'];

/** Hero: rim, body, sleeve band, handle, saucer, two steam curves (7 shapes). The steam is the detail. */
export function Cup({draw = 1, size, color = ink, fill = soft, shade = accent, style}: AssetProps) {
  return <Frame draw={draw} size={size} color={color} style={style}>{(line, f) => <>
    <path d={BODY} fill={fill} fillOpacity={f} />
    <path d={BAND} fill={shade} fillOpacity={f} />
    <path d={SAUCER} fill={fill} fillOpacity={f} />
    <path d={BODY} {...line} />
    <path d={HANDLE} {...line} />
    <path d={RIM} {...line} />
    <path d={SAUCER} {...line} />
    {STEAM.map(d => <path key={d} d={d} {...line} />)}
  </>}</Frame>;
}

/** Nearby: a map pin whose head holds the hero cup (pin, head ring, mini cup, its handle, ground line: 5 shapes). */
export function PinCup({draw = 1, size, color = ink, fill = soft, shade = accent, style}: AssetProps) {
  return <Frame draw={draw} size={size} color={color} style={style}>{(line, f) => <>
    <path d="M200 344Q96 232 96 160A104 104 0 0 1 304 160Q304 232 200 344Z" fill={shade} fillOpacity={f} />
    <circle cx={200} cy={160} r={64} fill={fill} fillOpacity={f} />
    <path d="M200 344Q96 232 96 160A104 104 0 0 1 304 160Q304 232 200 344Z" {...line} />
    <circle cx={200} cy={160} r={64} {...line} />
    <path d="M168 136H224L218 176Q216 192 200 192H192Q176 192 174 176Z" {...line} />
    <path d="M224 144Q240 144 240 160Q240 176 220 176" {...line} />
    <path d="M136 376H264" {...line} />
  </>}</Frame>;
}

/** Pickup time: the hero cup with a clock face on its body (rim, body, handle, saucer, face, two hands: 7 shapes). */
export function ClockCup({draw = 1, size, color = ink, fill = soft, shade = accent, style}: AssetProps) {
  return <Frame draw={draw} size={size} color={color} style={style}>{(line, f) => <>
    <path d={BODY} fill={fill} fillOpacity={f} />
    <path d={SAUCER} fill={fill} fillOpacity={f} />
    <circle cx={192} cy={216} r={56} fill={shade} fillOpacity={f} />
    <path d={BODY} {...line} />
    <path d={HANDLE} {...line} />
    <path d={RIM} {...line} />
    <path d={SAUCER} {...line} />
    <circle cx={192} cy={216} r={56} {...line} />
    <path d="M192 216V176M192 216L216 240" {...line} />
  </>}</Frame>;
}

/** Regular order: the hero cup with a heart on its band and one steam curve (rim, body, handle, saucer, heart, steam: 6 shapes). */
export function HeartCup({draw = 1, size, color = ink, fill = soft, shade = accent, style}: AssetProps) {
  const heart = 'M192 272Q144 240 144 208Q144 184 168 184Q184 184 192 200Q200 184 216 184Q240 184 240 208Q240 240 192 272Z';
  return <Frame draw={draw} size={size} color={color} style={style}>{(line, f) => <>
    <path d={BODY} fill={fill} fillOpacity={f} />
    <path d={SAUCER} fill={fill} fillOpacity={f} />
    <path d={heart} fill={shade} fillOpacity={f} />
    <path d={BODY} {...line} />
    <path d={HANDLE} {...line} />
    <path d={RIM} {...line} />
    <path d={SAUCER} {...line} />
    <path d={heart} {...line} />
    <path d="M192 104Q176 84 192 64Q208 44 192 24" {...line} />
  </>}</Frame>;
}

export const ASSETS = {Cup, PinCup, ClockCup, HeartCup} satisfies Record<string, Asset>;
