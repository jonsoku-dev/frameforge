import type {CSSProperties} from 'react';
import {Easing, MotionProbe, googleFont, interpolate, interpolateColors, spring} from 'frameforge';
import type {BlockEntry} from './types';

type Palette = {ink: string; paper: string; accent: string; soft: string};
type Fonts = {display: string; ui: string; mono?: string};
type Block = {frame: number; at: number; out?: number; duration?: number; fps?: number; palette: Palette; fonts: Fonts; size?: number; stroke?: number; radius?: number; x?: number; y?: number; width?: number; height?: number; id?: string};
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const span = (frame: number, from: number, dur: number) => interpolate(frame, [from, from + dur], [0, 1], {...clamp, easing: ease});
const mix = (a: string, b: string, t: number) => interpolateColors(t, [0, 1], [a, b]);

export type Lang = 'ts' | 'js' | 'python' | 'json' | 'bash' | 'plain';
export type Token = {kind: 'keyword' | 'string' | 'number' | 'comment' | 'punct' | 'ident' | 'space'; text: string};
const KEYWORDS: Record<Lang, string[]> = {
  ts: 'const let var function return if else for while do switch case break continue import from export default class new this type interface extends implements async await true false null undefined as of in typeof'.split(' '),
  js: 'const let var function return if else for while do switch case break continue import from export default class new this async await true false null undefined of in typeof'.split(' '),
  python: 'def return if elif else for while in import from class True False None and or not with as lambda pass yield try except finally raise print'.split(' '),
  json: ['true', 'false', 'null'],
  bash: 'echo if then else fi for do done while export cd ls cat npm npx node git run set source exit mkdir rm cp mv'.split(' '),
  plain: [],
};
const COMMENT: Record<Lang, string | null> = {ts: '\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/', js: '\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/', python: '#[^\\n]*', bash: '#[^\\n]*', json: null, plain: null};
const STRING = '"(?:[^"\\\\\\n]|\\\\.)*"|\'(?:[^\'\\\\\\n]|\\\\.)*\'|`(?:[^`\\\\]|\\\\.)*`';
const GRAMMAR = Object.fromEntries((Object.keys(KEYWORDS) as Lang[]).map(lang => [lang, new RegExp(
  [COMMENT[lang] && `(?<comment>${COMMENT[lang]})`, `(?<string>${STRING})`, '(?<number>\\d+(?:\\.\\d+)?)', `(?<ident>${lang === 'bash' ? '\\$?' : ''}[A-Za-z_$][\\w$]*)`, '(?<space>\\s+)', '(?<punct>[\\s\\S])'].filter(Boolean).join('|'), 'g')])) as Record<Lang, RegExp>;

/** Deterministic regex tokeniser: comments, strings, numbers, keywords, identifiers, whitespace and single punctuation characters. */
export function tokenize(code: string, lang: Lang): Token[] {
  const words = new Set(KEYWORDS[lang]);
  return [...code.matchAll(GRAMMAR[lang])].map(m => {
    const [kind, text] = Object.entries(m.groups!).find(([, v]) => v !== undefined) as [Token['kind'], string];
    return {kind: kind === 'ident' && words.has(text) ? 'keyword' : kind, text};
  });
}

export type CodeBlockProps = Block & {code: string; lang?: Lang; mode?: 'typing' | 'highlight' | 'diff' | 'scroll'; highlight?: [number, number]; charsPerFrame?: number; scrollTo?: number; lines?: number; lineNumbers?: boolean};
/** A code panel on ink. `typing` reveals characters with a caret, `highlight` sweeps an accent bar over lines [from, to] and dims the rest,
 * `diff` slides +/- lines in on green/red tints, `scroll` moves a `lines`-tall window to `scrollTo` over the beat. */
export function CodeBlock(b: CodeBlockProps) {
  const {frame, at, code, lang = 'plain', mode = 'highlight', highlight, scrollTo = 1, lineNumbers = true, fps = 30, palette: {ink, paper, accent, soft}, fonts} = b;
  const size = b.size ?? 38, radius = b.radius ?? size * 0.4, W = b.width ?? size * 24, H = b.height ?? size * 14, pad = size * 0.8, lineH = size * 1.5;
  if (frame < at || (b.out !== undefined && frame >= b.out)) return null;
  const mono = fonts.mono ?? googleFont('JetBrains Mono', {weights: [400, 700], fallback: 'monospace'});
  const colour: Record<Token['kind'], string> = {keyword: accent, string: mix(accent, paper, 0.55), number: mix(accent, soft, 0.5), comment: mix(ink, paper, 0.5), punct: mix(ink, paper, 0.75), ident: paper, space: paper};
  const src = code.split('\n');
  const rows = b.lines ?? Math.max(1, Math.floor((H - pad * 2) / lineH));
  const typed = mode === 'typing' ? Math.floor((frame - at) * (b.charsPerFrame ?? (b.duration ? code.length / b.duration : 2))) : Infinity;
  const dim = mode === 'highlight' && highlight ? interpolate(frame, [at + 12, at + 24], [1, 0.3], clamp) : 1;
  const sweep = span(frame, at + 12, 12);
  const offset = mode === 'scroll' ? span(frame, at + 10, b.duration ?? 45) * Math.max(0, Math.min(scrollTo - 1, src.length - rows)) * lineH : 0;
  const enter = spring({frame, fps, delay: at, durationInFrames: 14, config: {overshootClamping: true}});
  const fade = b.out === undefined ? 1 : 1 - span(frame, b.out - 8, 8);
  const gutter = lineNumbers ? size * 1.8 : 0, marker = mode === 'diff' ? size * 0.9 : 0;
  const tints = {'+': mix(ink, 'hsl(140, 60%, 45%)', 0.3), '-': mix(ink, 'hsl(0, 70%, 55%)', 0.3)} as Record<string, string>;
  let seen = 0;
  const lines = src.map((text, i) => {
    const start = seen;
    seen += text.length + 1;
    const shown = Math.max(0, Math.min(text.length, typed - start));
    if (shown === 0 && typed < Infinity && start > typed) return null;
    const sign = mode === 'diff' && (text[0] === '+' || text[0] === '-') ? text[0] : null;
    const body = sign ? text.slice(1) : text;
    const lit = !highlight || (i + 1 >= highlight[0] && i + 1 <= highlight[1]);
    const slide = mode === 'diff' ? (1 - span(frame, at + 8 + i * 3, 12)) * (sign === '-' ? size * 1.5 : sign === '+' ? -size * 1.5 : 0) : 0;
    const style: CSSProperties = {position: 'relative', display: 'flex', height: lineH, alignItems: 'center', opacity: lit ? 1 : dim, background: sign ? tints[sign] : lit && highlight && mode === 'highlight' ? mix(ink, accent, 0.18 * sweep) : 'transparent', transform: slide ? `translateX(${slide}px)` : undefined};
    let cut = 0;
    return <div key={i} style={style}>
      {(mode === 'highlight' && lit && highlight) || (mode === 'scroll' && i + 1 === scrollTo) ? <div style={{position: 'absolute', left: -pad, top: 0, width: size * 0.25, height: lineH * sweep, background: accent}} /> : null}
      {lineNumbers ? <span style={{width: gutter, flex: 'none', color: paper, opacity: 0.45, fontVariantNumeric: 'tabular-nums'}}>{i + 1}</span> : null}
      {marker ? <span style={{width: marker, flex: 'none', color: sign === '+' ? mix(paper, 'hsl(140, 60%, 45%)', 0.4) : sign === '-' ? mix(paper, 'hsl(0, 70%, 55%)', 0.4) : paper}}>{sign ?? ' '}</span> : null}
      <span style={{whiteSpace: 'pre'}}>{tokenize(body, lang).map((t, k) => {
        const piece = t.text.slice(0, Math.max(0, shown - cut));
        cut += t.text.length;
        return piece ? <span key={k} style={{color: colour[t.kind]}}>{piece}</span> : null;
      })}</span>
      {mode === 'typing' && typed < code.length && typed >= start && typed <= start + text.length && (frame - at) % 16 < 10 ? <span style={{display: 'inline-block', width: size * 0.55, height: size * 1.15, background: accent, marginLeft: 2}} /> : null}
    </div>;
  });
  // The panel colour sits on the block's own box so the layout audit measures the text against ink, not the scene behind it.
  return <div style={{position: 'absolute', left: b.x ?? 0, top: b.y ?? 0, width: W, height: H, borderRadius: radius, background: ink, opacity: enter * fade, transform: `translateY(${(1 - enter) * size}px)`}}>
    <MotionProbe id={b.id ?? `code-block-${at}`} value={(1 - enter) * size} family="card" axis="y" />
    <div style={{position: 'absolute', left: pad, right: pad, top: pad, height: rows * lineH, overflow: mode === 'scroll' ? 'hidden' : 'visible', fontFamily: mono, fontSize: size, lineHeight: 1, color: paper}} data-clip={mode === 'scroll' ? 'allow' : undefined}>
      <div style={{transform: mode === 'scroll' ? `translateY(${-offset}px)` : undefined}}>{lines}</div>
    </div>
  </div>;
}

export const CODE_BLOCKS: BlockEntry[] = [
  {id: 'code-block', when: 'Show source: type it in, spotlight lines, show a diff or scroll to a line.', title: 'Code block', family: 'code', props: ['frame', 'at', 'out', 'duration', 'fps', 'palette', 'fonts', 'size', 'radius', 'x', 'y', 'width', 'height', 'id', 'code', 'lang', 'mode', 'highlight', 'charsPerFrame', 'scrollTo', 'lines', 'lineNumbers'], sample: 'data-reel'},
];
