import React, {useEffect} from 'react';
import katex from 'katex';
import {continueRender, delayRender} from '../core/index';

export type FormulaProps = {tex: string; display?: boolean; size?: number; color?: string; draw?: number; highlight?: string[]; highlightColor?: string; style?: React.CSSProperties};

let stylesheet: Promise<unknown> | null = null;
/** The KaTeX stylesheet and its fonts, loaded once per page; frames hold until the faces the markup uses are ready. */
function fontsReady(): Promise<void> {
  stylesheet ??= import('katex/dist/katex.min.css');
  return stylesheet.then(() => Promise.all([...document.fonts].filter(face => face.family.startsWith('KaTeX')).map(face => face.load()))).then(() => document.fonts.ready).then(() => undefined);
}

/**
 * A KaTeX formula. `draw` 0..1 reveals it left to right; `highlight` substrings of `tex` take `highlightColor`.
 * A TeX error throws a readable error so the composition fails instead of showing a red fragment.
 */
export function Formula({tex, display = true, size = 96, color = 'currentColor', draw = 1, highlight = [], highlightColor = '#2F5BFF', style}: FormulaProps): React.ReactElement {
  const marked = highlight.reduce((source, part) => source.split(part).join(`\\htmlClass{ff-hl}{${part}}`), tex);
  let html: string;
  try {
    html = katex.renderToString(marked, {displayMode: display, throwOnError: true, strict: false, trust: true, output: 'html'});
  } catch (error) {
    throw new Error(`Formula could not parse "${tex}": ${error instanceof Error ? error.message : String(error)}`);
  }
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handle = delayRender('Formula fonts');
    fontsReady().then(() => continueRender(handle), () => continueRender(handle));
  }, []);
  const clip = Math.min(1, Math.max(0, draw));
  return <span data-ff-hl={highlightColor} style={{display: 'inline-block', fontSize: size, color, clipPath: `inset(-0.2em ${(1 - clip) * 100}% -0.2em 0)`, visibility: clip === 0 ? 'hidden' : 'visible', ...style}}>
    <style>{`[data-ff-hl="${highlightColor}"] .ff-hl{color:${highlightColor}}`}</style>
    <span dangerouslySetInnerHTML={{__html: html}} />
  </span>;
}
