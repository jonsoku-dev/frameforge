import React, {type ReactNode} from 'react';
import {random} from '../core/math';

/* Drawn text annotations. No DOM measurement: the wrapper is an inline-block span and the SVG overlay stretches a
 * 100 x 100 viewBox over it (preserveAspectRatio none), so every path is written in percent coordinates. */

export type AnnotationKind = 'highlight' | 'circle' | 'underline' | 'strike' | 'box' | 'bracket-left' | 'bracket-right' | 'bracket-top' | 'bracket-bottom';
export type AnnotationProps = {
  children: ReactNode; /** 0..1, how much of the stroke is drawn. */ progress: number; color?: string;
  /** Screen pixels (non-scaling stroke); for Highlight, the band height as a percent of the box, default 85. */ strokeWidth?: number;
  seed?: string | number; /** 0 draws straight paths; 1 jitters points by up to 6 % of the box. */ roughness?: number; /** Pixels the overlay extends beyond the text box; for Underline, the gap under the glyph box. */ padding?: number; style?: React.CSSProperties;
};
const fix = (v: number) => Number(v.toFixed(2));
/** Jitters [x, y] pairs by seeded offsets of up to 6 % per unit of roughness and joins them into an `M ... L ...` path. */
function rough(points: readonly (readonly [number, number])[], seed: string | number, kind: string, roughness: number, close = false): string {
  const d = points.map(([x, y], i) => {
    const jx = (random(`${seed}:${kind}:${i}:x`) - 0.5) * 12 * roughness, jy = (random(`${seed}:${kind}:${i}:y`) - 0.5) * 12 * roughness;
    return `${i === 0 ? 'M' : 'L'}${fix(x + jx)} ${fix(y + jy)}`;
  }).join('');
  return close ? `${d}Z` : d;
}
/** A hand-drawn ellipse: four cubic arcs around the box, overshooting the start by one arc so the ends overlap. */
function roughEllipse(seed: string | number, roughness: number): string {
  const k = 0.5523, cx = 50, cy = 50, rx = 50, ry = 50;
  const j = (i: number, axis: string) => (random(`${seed}:circle:${i}:${axis}`) - 0.5) * 10 * roughness;
  // Anchor points at left, top, right, bottom, left again; the fifth ends slightly past the first.
  const anchors: [number, number][] = [[cx - rx, cy], [cx, cy - ry], [cx + rx, cy], [cx, cy + ry], [cx - rx, cy - 8 * roughness]].map(([x, y], i) => [x + j(i, 'x'), y + j(i, 'y')]);
  const handles: [number, number, number, number][] = [[0, -k * ry, -k * rx, 0], [k * rx, 0, 0, -k * ry], [0, k * ry, k * rx, 0], [-k * rx, 0, 0, k * ry]];
  let d = `M${fix(anchors[0]![0])} ${fix(anchors[0]![1])}`;
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = anchors[i]!, [bx, by] = anchors[i + 1]!, [h1x, h1y, h2x, h2y] = handles[i]!;
    d += `C${fix(ax + h1x)} ${fix(ay + h1y)} ${fix(bx + h2x)} ${fix(by + h2y)} ${fix(bx)} ${fix(by)}`;
  }
  return d;
}
/** The path for `kind` in 0..100 viewBox units; pure in (kind, seed, roughness). */
export function annotationPath(kind: AnnotationKind, seed: string | number = 1, roughness = 0.5): string {
  const row = (y: number): [number, number][] => [[0, y], [25, y], [50, y], [75, y], [100, y]];
  switch (kind) {
    case 'highlight': return rough(row(50), seed, kind, roughness * 0.3);
    case 'underline': return rough(row(100), seed, kind, roughness);
    case 'strike': return rough(row(52), seed, kind, roughness);
    case 'circle': return roughEllipse(seed, roughness);
    case 'box': return rough([[0, 0], [100, 0], [100, 100], [0, 100]], seed, kind, roughness, true);
    case 'bracket-left': return rough([[18, 0], [0, 0], [0, 100], [18, 100]], seed, kind, roughness);
    case 'bracket-right': return rough([[82, 0], [100, 0], [100, 100], [82, 100]], seed, kind, roughness);
    case 'bracket-top': return rough([[0, 18], [0, 0], [100, 0], [100, 18]], seed, kind, roughness);
    case 'bracket-bottom': return rough([[0, 82], [0, 100], [100, 100], [100, 82]], seed, kind, roughness);
  }
}
function Annotation({kind, children, progress, color = 'currentColor', strokeWidth, seed = 1, roughness = 0.5, padding = 6, style}: AnnotationProps & {kind: AnnotationKind}) {
  if (!(progress >= 0 && progress <= 1)) throw new Error(`${kind} progress must be between 0 and 1, got ${String(progress)}`);
  if (!(roughness >= 0 && roughness <= 1)) throw new Error(`${kind} roughness must be between 0 and 1`);
  const behind = kind === 'highlight';
  const pad = behind ? 0 : padding;
  // The ellipse is inscribed in its overlay, so the overlay grows by sqrt(2) to circumscribe the glyph box; the underline's overlay extends only downward so y=100 sits `padding` px under the glyphs.
  const grow = kind === 'circle' ? 20.7 : 0, up = kind === 'underline' ? 0 : pad;
  const overlay: React.CSSProperties = {position: 'absolute', left: `calc(${-grow}% - ${pad}px)`, top: `calc(${-grow}% - ${up}px)`, width: `calc(${100 + 2 * grow}% + ${2 * pad}px)`, height: `calc(${100 + 2 * grow}% + ${pad + up}px)`, overflow: 'visible', pointerEvents: 'none', zIndex: behind ? -1 : 1};
  // `isolation` keeps the highlight's negative z-index inside this span instead of behind the scene background.
  return <span style={{position: 'relative', display: 'inline-block', isolation: 'isolate', ...style}}>
    {children}
    {progress > 0 ? <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={overlay} aria-hidden="true">
      <path d={annotationPath(kind, seed, roughness)} fill="none" stroke={color} strokeWidth={strokeWidth ?? (behind ? 85 : 6)} strokeLinecap={behind ? 'butt' : 'round'} strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - progress} vectorEffect={behind ? undefined : 'non-scaling-stroke'} />
    </svg> : null}
  </span>;
}
/** A marker band behind the text; `strokeWidth` is the band height in percent of the text box. */
export const Highlight = (props: AnnotationProps) => <Annotation kind="highlight" {...props} />;
/** A hand-drawn ellipse around the text (named so because `Circle` is the shape component). */
export const Encircle = (props: AnnotationProps) => <Annotation kind="circle" {...props} />;
export const Underline = (props: AnnotationProps) => <Annotation kind="underline" {...props} />;
export const StrikeThrough = (props: AnnotationProps) => <Annotation kind="strike" {...props} />;
export const Box = (props: AnnotationProps) => <Annotation kind="box" {...props} />;
/** A square bracket on one `side` of the text. */
export const Bracket = ({side = 'left', ...props}: AnnotationProps & {side?: 'left' | 'right' | 'top' | 'bottom'}) => <Annotation kind={`bracket-${side}`} {...props} />;
