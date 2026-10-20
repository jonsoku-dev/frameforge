import type React from 'react';

/** Kit convention: front view, 400 viewBox, 8 px grid; each asset wraps its assembly steps in `<g {...a.part(n)}>` (n from 1)
 * and exports `meta`; index.tsx re-exports it as `<Name>Meta`, which catalog.ts and the sheet pick up. */
export type ArtProps = {size: number; ink?: string; accent?: string; soft?: string; paper?: string; stroke?: number; radius?: number; draw?: number; parts?: number; style?: React.CSSProperties};
export type ArtMeta = {name: string; parts: string[]; tags: string[]};

export const VIEW = 400;
export const PALETTE = {ink: '#1f1d2b', accent: '#ff6b4a', soft: '#ffd9c7', paper: '#fffaf2'};

/** Resolves an asset's props into SVG attribute objects in viewBox units, so every asset shares one line and corner. */
export function art(props: ArtProps) {
  const scale = VIEW / props.size;
  const draw = Math.min(1, Math.max(0, props.draw ?? 1));
  const shown = props.parts ?? Infinity;
  const {ink = PALETTE.ink, accent = PALETTE.accent, soft = PALETTE.soft, paper = PALETTE.paper} = props;
  // A fully drawn line carries no dash, so no seam shows where the dash would wrap.
  const dash = draw >= 1 ? {} : {pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - draw};
  const line = {stroke: ink, strokeWidth: (props.stroke ?? props.size * 0.045) * scale, strokeLinecap: 'round', strokeLinejoin: 'round', ...dash} as const;
  return {
    ink, accent, soft, paper,
    r: (props.radius ?? props.size * 0.04) * scale,
    svg: {width: props.size, height: props.size, viewBox: `0 0 ${VIEW} ${VIEW}`, style: props.style},
    /** Outline only. */
    line: {...line, fill: 'none'},
    /** Outlined face filled with a palette colour; the fill fades in with `draw`. */
    fill: (color: string) => ({...line, fill: color, fillOpacity: draw}),
    part: (index: number) => ({'data-part': index, opacity: shown >= index ? 1 : 0}),
  };
}
