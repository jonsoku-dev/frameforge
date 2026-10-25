import {art, type ArtMeta, type ArtProps} from './system';

export const meta: ArtMeta = {name: 'Glass', parts: ['glass', 'liquid', 'ice', 'shine'], tags: ['glass', 'tumbler', 'cocktail', 'drink', 'water', 'juice', 'ice', 'pour', 'level', 'recipe', '유리잔', '잔', '칵테일', '음료', '얼음', '수위', '레시피']};

export type GlassProps = ArtProps & {
  /** Liquid level 0..1 of the inside height. */ fill?: number;
  /** Liquid colour; a palette colour by default. */ liquid?: string;
  /** Ice cubes floating at the surface, 0..3. */ ice?: number;
};

const TOP = 112, BOTTOM = 320, TOP_HALF = 80, BOTTOM_HALF = 60;
/** Half width of the inside at height y (the tumbler narrows toward its base). */
const half = (y: number) => BOTTOM_HALF + (TOP_HALF - BOTTOM_HALF) * (BOTTOM - y) / (BOTTOM - TOP);
/** The y of the liquid surface in viewBox units for a level 0..1; labels for oz marks go at `glassLevel(level) / 400 * size`. */
export const glassLevel = (level: number) => BOTTOM - (BOTTOM - TOP) * Math.min(1, Math.max(0, level));

/** A tumbler with a liquid that fills to `fill`, ice that floats on it, a thick base and a highlight. */
export function Glass({fill = 0.6, liquid, ice = 2, ...props}: GlassProps) {
  const a = art(props);
  const surface = glassLevel(fill), cubes = fill > 0 ? Math.max(0, Math.min(3, Math.round(ice))) : 0;
  return <svg {...a.svg}>
    <g {...a.part(1)}>
      <path d="M112 96 H288 L268 344 Q266 352 256 352 H144 Q134 352 132 344 Z" {...a.fill(a.paper)} />
      <path d="M140 320 H260" {...a.line} />
    </g>
    <g {...a.part(2)}>{fill > 0 ? <path d={`M${200 - half(surface)} ${surface} H${200 + half(surface)} L${200 + BOTTOM_HALF} ${BOTTOM} H${200 - BOTTOM_HALF} Z`} {...a.fill(liquid ?? a.accent)} /> : null}</g>
    <g {...a.part(3)}>{Array.from({length: cubes}, (_, i) => {
      const x = 200 + (i - (cubes - 1) / 2) * 48, y = Math.max(TOP - 8, surface - 24 + (i % 2) * 10);
      return <rect key={i} x={x - 20} y={y} width={40} height={40} rx={a.r} transform={`rotate(${[-8, 6, -3][i]} ${x} ${y + 20})`} {...a.fill(a.soft)} />;
    })}</g>
    <g {...a.part(4)}><path d="M132 128 L144 296" {...a.line} stroke={a.soft} /></g>
  </svg>;
}
