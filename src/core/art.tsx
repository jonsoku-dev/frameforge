import React, {useEffect, useRef, useState} from 'react';
import {continueRender, delayRender} from './index';

/** A resolved vector asset (`public/assets/generated/<slug>/<name>.svg`, written by `npm run art`) drawn inline so it can
 * draw in and take the film's palette. The SVG text is fetched once per src and cached for the page's life. */
export type ArtProps = {src: string; size: number; draw?: number; ink?: string; accent?: string; soft?: string; paper?: string; style?: React.CSSProperties};
const cache = new Map<string, Promise<string>>();
const PALETTE = ['ink', 'accent', 'soft', 'paper'] as const;

/** The resolver recoloured the file to a palette and wrote it on the root (`data-palette-ink` ...); swapping those exact
 * colours for the props lets one resolved asset serve several palettes at play time. */
export function recolorSvg(svg: string, colors: Partial<Record<(typeof PALETTE)[number], string>>): string {
  let out = svg;
  for (const role of PALETTE) {
    const to = colors[role];
    const from = svg.match(new RegExp(`data-palette-${role}="([^"]+)"`))?.[1];
    if (to && from && from.toLowerCase() !== to.toLowerCase()) out = out.split(from).join(to);
  }
  return out;
}

/** Sets pathLength=1 on every stroked shape so one dash offset draws the whole asset in at `draw` 0..1. */
export function drawInSvg(svg: string, draw: number): string {
  const offset = (1 - Math.min(1, Math.max(0, draw))).toFixed(4);
  return svg.replace(/<(path|line|polyline|polygon|circle|rect|ellipse)\b([^>]*?)(\/?)>/g, (match, tag: string, attrs: string, close: string) =>
    /stroke="(?!none)/.test(attrs) ? `<${tag}${attrs} pathLength="1" stroke-dasharray="1" stroke-dashoffset="${offset}"${close}>` : match);
}

export function Art({src, size, draw = 1, ink, accent, soft, paper, style}: ArtProps): React.ReactElement {
  if (typeof src !== 'string' || !src.startsWith('/')) throw new Error('Art src must be a public path starting with "/"');
  const [svg, setSvg] = useState<string | null>(null);
  const handle = useRef<number | null>(null);
  if (handle.current === null && svg === null) handle.current = delayRender(`Art ${src}`);
  useEffect(() => {
    let alive = true;
    (cache.get(src) ?? cache.set(src, fetch(src).then(response => { if (!response.ok) throw new Error(`Art ${src}: HTTP ${response.status}`); return response.text(); })).get(src)!)
      .then(text => { if (alive) setSvg(text); }, error => { if (alive) setSvg(`<!-- ${String(error)} -->`); });
    return () => { alive = false; };
  }, [src]);
  useEffect(() => { if (svg !== null && handle.current !== null) { continueRender(handle.current); handle.current = null; } }, [svg]);
  const html = svg === null ? '' : drawInSvg(recolorSvg(svg, {ink, accent, soft, paper}), draw);
  return <div style={{width: size, height: size, display: 'inline-block', lineHeight: 0, ...style}} dangerouslySetInnerHTML={{__html: html.replace(/<svg\b/, '<svg width="100%" height="100%"')}} />;
}
