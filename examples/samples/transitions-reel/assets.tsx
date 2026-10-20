import type {CSSProperties, ComponentType, ReactNode} from 'react';

// Front view, 400×400 viewBox on an 8-unit grid, ground line at y 352 on all three so the landmarks share a horizon.
/** One stroke width for the film, in viewBox units: 8 at the 840 px landmark is about 17 px on screen. */
export const STROKE = 8;
/** One corner radius for the film, in viewBox units. */
export const RADIUS = 16;
const accent = '#F43F5E';
const soft = '#FFE4E6';
const ink = '#0F172A';

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
const GROUND = 'M32 352H368';

/** Seoul: a hilltop tower. Antenna, its tip, observation deck with a window band, shaft, hill, ground (7 shapes). The deck is the detail. */
export function Tower({draw = 1, size, color = ink, fill = accent, shade = soft, style}: AssetProps) {
  const deck = `M${152 + R} 104H${248 - R}Q248 104 248 ${104 + R}V${160 - R}Q248 160 ${248 - R} 160H${152 + R}Q152 160 152 ${160 - R}V${104 + R}Q152 104 ${152 + R} 104Z`;
  const hill = 'M64 352Q200 264 336 352Z';
  return <Frame draw={draw} size={size} color={color} style={style}>{(line, f) => <>
    <path d={hill} fill={shade} fillOpacity={f} />
    <path d="M184 160H216V304H184Z" fill={shade} fillOpacity={f} />
    <path d={deck} fill={fill} fillOpacity={f} />
    <path d="M200 104V40" {...line} />
    <circle cx={200} cy={32} r={8} {...line} />
    <path d={deck} {...line} />
    <path d="M168 128H232" {...line} />
    <path d="M184 160V304M216 160V304" {...line} />
    <path d={hill} {...line} />
    <path d={GROUND} {...line} />
  </>}</Frame>;
}

/** Busan: a suspension bridge. Deck, two towers, the sagging main cable, hangers, water line (6 shapes). The cable is the detail. */
export function Bridge({draw = 1, size, color = ink, fill = accent, shade = soft, style}: AssetProps) {
  const tower = (x: number) => `M${x} 96H${x + 32}V352H${x}Z`;
  return <Frame draw={draw} size={size} color={color} style={style}>{(line, f) => <>
    <path d={tower(104)} fill={fill} fillOpacity={f} />
    <path d={tower(264)} fill={fill} fillOpacity={f} />
    <path d="M32 264H368V288H32Z" fill={shade} fillOpacity={f} />
    <path d={tower(104)} {...line} />
    <path d={tower(264)} {...line} />
    <path d="M32 264H368V288H32Z" {...line} />
    <path d="M32 232Q80 200 120 104Q200 272 280 104Q320 200 368 232" {...line} />
    <path d="M160 176V264M200 188V264M240 176V264" {...line} />
    <path d="M32 352Q72 336 112 352T192 352T272 352T352 352" {...line} />
  </>}</Frame>;
}

/** Jeju: a volcano with a flat crater. Cone with a crater notch, snow cap, side cone (oreum), cloud, ground (5 shapes). The crater is the detail. */
export function Volcano({draw = 1, size, color = ink, fill = soft, shade = accent, style}: AssetProps) {
  // The crater dips into the top edge so it survives the silhouette test.
  const crater = `L${152 - R / 2} ${128 + R / 2}Q152 128 ${152 + R / 2} 128Q200 160 ${248 - R / 2} 128Q248 128 ${248 + R / 2} ${128 + R / 2}`;
  const cone = `M48 352${crater}L352 352Z`;
  const cap = `M124 184${crater}L276 184L240 160L216 184L184 160L160 184Z`;
  const oreum = 'M32 352Q88 280 144 352Z';
  return <Frame draw={draw} size={size} color={color} style={style}>{(line, f) => <>
    <path d={cone} fill={fill} fillOpacity={f} />
    <path d={cap} fill={shade} fillOpacity={f} />
    <path d={oreum} fill={shade} fillOpacity={f} />
    <path d={cone} {...line} />
    <path d={cap} {...line} />
    <path d={oreum} {...line} />
    <path d="M264 80H344Q360 80 360 64Q360 48 344 48Q336 32 312 40Q288 32 280 56Q264 56 264 80Z" {...line} />
    <path d={GROUND} {...line} />
  </>}</Frame>;
}

export const ASSETS = {Tower, Bridge, Volcano} satisfies Record<string, Asset>;
