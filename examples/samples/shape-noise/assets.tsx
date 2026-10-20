import type {CSSProperties} from 'react';

/** Line weight in px on the 1080 frame. Every asset converts it into its 400-unit viewBox, so a small mark and the hero share one visible weight. */
export const STROKE = 16;
/** The round join is the only corner in this film. */
export const RADIUS = STROKE / 2;

const accent = '#8B5CF6';
const soft = '#DDD6FE';
const OUTER = 192;
const C = 200;
/** Below this size the gem is simplified: the inner edges would eat the faces. */
const DETAIL = 200;

type Props = {draw?: number; size: number; color?: string; style?: CSSProperties};

/** Stroke trace for pathLength 1; the 1 2 dash leaves no round-cap dot at draw 0. */
const trace = (draw: number) => ({pathLength: 1, strokeDasharray: '1 2', strokeDashoffset: 1 - draw});

/** Twelve vertices, outer corners at even indices. morph 0 is the six-point star (inner radius half the outer), morph 1 the hexagon (inner radius cos 30 degrees, so inner vertices sit on the edge midpoints). */
function vertices(morph: number): [number, number][] {
  const inner = OUTER * (0.5 + (Math.cos(Math.PI / 6) - 0.5) * morph);
  return Array.from({length: 12}, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 6;
    const r = i % 2 ? inner : OUTER;
    return [C + r * Math.cos(a), C + r * Math.sin(a)];
  });
}

const path = (points: [number, number][], close = true) => `M${points.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join('L')}${close ? 'Z' : ''}`;

/**
 * The studio's one shape: a faceted six-point star that morphs into an isometric cube. 8 shapes: three faces (top soft, right accent, left accent at 55% over soft so it stays opaque), the outline, and the Y of three cube edges, which is the characteristic detail.
 * Faces and edges share the twelve vertices, so the morph needs no path interpolation. color is the outline; omit it for a faces-only field piece.
 */
export function Gem({draw = 1, size, color, style, morph = 1, fill = 1}: Props & {morph?: number; fill?: number}) {
  const v = vertices(morph);
  const at = (i: number) => v[(i + 12) % 12]!;
  const face = (from: number) => path([[C, C], ...[0, 1, 2, 3, 4].map(k => at(from + k))]);
  const sw = (STROKE * 400) / size;
  return <svg width={size} height={size} viewBox="0 0 400 400" style={{overflow: 'visible', visibility: draw === 0 && fill === 0 ? 'hidden' : 'visible', ...style}}>
    <g opacity={fill}>
      <path d={face(-2)} fill={soft} />
      <path d={face(2)} fill={accent} />
      <path d={face(6)} fill={soft} />
      <path d={face(6)} fill={accent} fillOpacity={0.55} />
    </g>
    {color ? <g fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      {size >= DETAIL ? [-2, 2, 6].map(i => <path key={i} d={path([[C, C], at(i)], false)} {...trace(draw)} />) : null}
      <path d={path(v)} {...trace(draw)} />
    </g> : null}
  </svg>;
}
