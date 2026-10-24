import type {CSSProperties} from 'react';
import {Easing, MotionProbe, interpolate, spring} from 'frameforge';
import type {BlockEntry} from './types';

export type BlockPalette = {ink: string; paper: string; accent: string; soft: string};
export type BlockFonts = {display: string; ui: string};
/** The contract every block shares: the scene passes its frame; `at` starts the entry, `out` (or `at + duration`) starts the exit,
 * which reverses the entry on the same axis; `size` is the block's main font size in px (secondary text is 0.7×, so pass ≥ 5 % of
 * the short side when a block has secondary text, ≥ 10 % for headlines); `x`/`y` place in px, else `align` inside the 5 % safe area. */
export type BlockProps = {frame: number; at: number; out?: number; duration?: number; fps?: number; palette: BlockPalette; fonts: BlockFonts; size: number; x?: number; y?: number; align?: 'left' | 'center' | 'right'; id?: string};

const CLAMP = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const OUT = Easing.bezier(0.16, 1, 0.3, 1);
const IN = Easing.bezier(0.7, 0, 0.84, 0);

/** Eased 0..1 over [from, from + dur]; ease-out by default, pass an ease-in for exits. */
export function blockRise(frame: number, from: number, dur: number, easing = OUT): number {
  return interpolate(frame, [from, from + dur], [0, 1], {...CLAMP, easing});
}

/** Spring 0..1 from `at`; `settle` clamps the overshoot. */
export function blockSettle(frame: number, at: number, dur: number, fps = 30, settle = false): number {
  return spring({frame, fps, delay: at, durationInFrames: dur, config: {overshootClamping: settle}});
}

/** Entry and exit folded into one 0..1: `enter` frames easing out from `at`, `exit` frames easing in from `out` or `at + duration`. */
export function blockPhase({frame, at, out, duration}: Pick<BlockProps, 'frame' | 'at' | 'out' | 'duration'>, enter: number, exit = enter): {p: number; leave: number; end: number; hidden: boolean} {
  const end = out ?? (duration === undefined ? Infinity : at + duration);
  const leave = Number.isFinite(end) ? blockRise(frame, end, exit, IN) : 0;
  return {p: blockRise(frame, at, enter) * (1 - leave), leave, end, hidden: frame < at || leave >= 1};
}

/** Outer placement box: px when `x`/`y` are given, else the safe area with `align`; motion transforms go on the child, never here. */
export function blockPlace({x, y, align = 'left'}: Pick<BlockProps, 'x' | 'y' | 'align'>, hidden: boolean): CSSProperties {
  const justify = {left: 'flex-start', center: 'center', right: 'flex-end'}[align];
  return {position: 'absolute', display: 'flex', visibility: hidden ? 'hidden' : 'visible',
    ...(x === undefined ? {left: 0, right: 0, paddingInline: '5%', justifyContent: justify} : {left: x}),
    ...(y === undefined ? {top: 0, bottom: 0, alignItems: 'center'} : {top: y})};
}

/** Glyph mask of the template: the line box is 0.8em but the ink rises 0.87em, so the mask grows 0.1em up and 0.06em out without moving the glyph. */
export const blockMask: CSSProperties = {display: 'inline-block', overflow: 'hidden', height: '1.15em', paddingTop: '0.1em', marginTop: '-0.1em', paddingInline: '0.06em', marginInline: '-0.06em'};

const nbsp = (glyph: string) => glyph === ' ' ? ' ' : glyph;

type Text = BlockProps & {color?: string; weight?: number};

export function GlyphRise({text, stagger = 2, rise = 12, color, weight = 900, ...props}: Text & {text: string; stagger?: number; rise?: number}) {
  const {frame, at, size, palette, fonts, id = `glyph-${at}`} = props;
  const {end} = blockPhase(props, rise);
  const glyphs = Array.from(text);
  const lift = (i: number) => blockRise(frame, at + i * stagger, rise) - (Number.isFinite(end) ? blockRise(frame, end + i * stagger, rise, IN) : 0);
  const hidden = frame < at || frame >= end + (glyphs.length - 1) * stagger + rise;
  return <div style={blockPlace(props, hidden)}>
    <MotionProbe id={id} value={(1 - lift(0)) * 120} family="text" axis="y" />
    <span style={{display: 'flex', color: color ?? palette.ink, fontFamily: fonts.display, fontSize: size, fontWeight: weight, lineHeight: 1, letterSpacing: '-0.04em', whiteSpace: 'nowrap'}}>
      {glyphs.map((glyph, i) => <span key={i} style={blockMask}>
        <span style={{display: 'inline-block', transform: `translateY(${(1 - lift(i)) * 120}%)`, visibility: lift(i) <= 0 ? 'hidden' : 'visible'}}>{nbsp(glyph)}</span>
      </span>)}
    </span>
  </div>;
}

export function WordCascade({lines, stagger = 4, color, weight = 900, ...props}: Text & {lines: string[]; stagger?: number}) {
  const {frame, at, size, palette, fonts, align = 'left', id = `cascade-${at}`} = props;
  const {leave, hidden} = blockPhase(props, 12, 14);
  let index = 0;
  const words = lines.map(line => line.split(' ').map(word => {
    // Heavier words (more glyphs) start later and take longer, so a line settles like a waterfall rather than a row.
    const heft = Array.from(word).length;
    return {word, at: at + index++ * stagger + heft * 1.5, dur: 10 + heft * 2.5};
  }));
  const lift = (word: {at: number; dur: number}) => blockRise(frame, word.at, word.dur) * (1 - leave);
  return <div style={blockPlace(props, hidden)}>
    <MotionProbe id={id} value={(1 - lift(words[0]![0]!)) * 120} family="text" axis="y" />
    <div style={{display: 'flex', flexDirection: 'column', gap: size * 0.18, alignItems: {left: 'flex-start', center: 'center', right: 'flex-end'}[align], color: color ?? palette.ink, fontFamily: fonts.display, fontSize: size, fontWeight: weight, lineHeight: 1, letterSpacing: '-0.04em'}}>
      {words.map((line, li) => <div key={li} style={{display: 'flex', gap: '0.28em', whiteSpace: 'nowrap'}}>
        {line.map((word, wi) => <span key={wi} style={blockMask}>
          <span style={{display: 'inline-block', transform: `translateY(${(1 - lift(word)) * 120}%)`, visibility: lift(word) <= 0 ? 'hidden' : 'visible'}}>{word.word}</span>
        </span>)}
      </div>)}
    </div>
  </div>;
}

const POW_IN = Easing.in(Easing.poly(4));
const POW_OUT = Easing.out(Easing.poly(4));

/** Words swap on the Z axis: the outgoing one grows to 1.2 while blurring out, the incoming one grows 0.75→1 out of blur; only one is ever mounted. */
export function ZoomSwap({words, hold = 36, swap = 16, color, weight = 900, ...props}: Text & {words: string[]; hold?: number; swap?: number}) {
  const {frame, at, size, palette, fonts, id = `zoom-${at}`} = props;
  const {end} = blockPhase(props, swap);
  const period = hold + swap, half = swap / 2;
  const k = Math.min(words.length - 1, Math.max(0, Math.floor((frame - at) / period)));
  const local = frame - at - k * period;
  // Each state is {word, u: outgoing 0..1} or {word, v: incoming 0..1}; the entry at `at` and the exit at `end` reuse the two halves.
  let word = words[k]!, u = 0, v = 1;
  if (frame >= end) { word = words[words.length - 1]!; u = blockRise(frame, end, half, POW_IN); }
  else if (k === 0 && local < half) v = blockRise(frame, at, half, POW_OUT);
  else if (k < words.length - 1 && local >= hold) {
    const t = local - hold;
    if (t < half) u = blockRise(frame, at + k * period + hold, half, POW_IN);
    else { word = words[k + 1]!; v = blockRise(frame, at + k * period + hold + half, half, POW_OUT); }
  }
  const scale = u > 0 ? 1 + u * 0.2 : 0.75 + v * 0.25;
  const blur = u > 0 ? u * 10 : (1 - v) * 10;
  const opacity = u > 0 ? 1 - u : v;
  const hidden = frame < at || u >= 1;
  return <div style={blockPlace(props, hidden)}>
    <MotionProbe id={id} value={scale} family="text" axis="scale" />
    <span style={{display: 'inline-block', color: color ?? palette.ink, fontFamily: fonts.display, fontSize: size, fontWeight: weight, lineHeight: 1.1, letterSpacing: '-0.04em', whiteSpace: 'nowrap', transform: `scale(${scale})`, filter: blur > 0.05 ? `blur(${blur}px)` : 'none', opacity}}>{word}</span>
  </div>;
}

/** Characters appear `speed` frames apart behind a block caret that blinks every `blink` frames; the exit deletes them again. */
export function Typewriter({text, speed = 2, blink = 15, color, weight = 500, ...props}: Text & {text: string; speed?: number; blink?: number}) {
  const {frame, at, size, palette, fonts, id = `type-${at}`} = props;
  const {end} = blockPhase(props, 1);
  const glyphs = Array.from(text);
  const typed = frame >= end ? Math.max(0, glyphs.length - Math.floor((frame - end) / speed)) : Math.min(glyphs.length, Math.max(0, Math.floor((frame - at) / speed) + 1));
  const caret = Math.floor(Math.max(0, frame - at) / blink) % 2 === 0;
  const hidden = frame < at || frame >= end && typed <= 0;
  const font: CSSProperties = {fontFamily: fonts.ui, fontSize: size, fontWeight: weight, lineHeight: 1.3, whiteSpace: 'pre'};
  return <div style={blockPlace(props, hidden)}>
    <MotionProbe id={id} value={typed / glyphs.length} family="text" axis="progress" />
    <span style={{position: 'relative', display: 'inline-block', color: color ?? palette.ink, ...font}}>
      <span style={{visibility: 'hidden'}}>{text}</span>
      <span style={{position: 'absolute', left: 0, top: 0}}>
        {glyphs.slice(0, typed).join('')}
        <span style={{display: 'inline-block', width: '0.5em', height: '0.95em', verticalAlign: '-0.12em', marginLeft: '0.08em', background: palette.accent, opacity: caret ? 1 : 0}} />
      </span>
    </span>
  </div>;
}

/** An accent bar sweeps behind `word` from the left; the frame it is full the word turns paper and the accent becomes the word's own
 * background (the contrast audit reads ancestor backgrounds). `before` and `after` are their own spans so their boxes never union across the word. */
export function HighlightSweep({before = '', word, after = '', delay = 12, sweep = 14, color, weight = 900, ...props}: Text & {before?: string; word: string; after?: string; delay?: number; sweep?: number}) {
  const {frame, at, size, palette, fonts, id = `sweep-${at}`} = props;
  const {p, leave, hidden} = blockPhase(props, 12, 12);
  const s = blockRise(frame, at + delay, sweep) * (1 - leave);
  return <div style={blockPlace(props, hidden)}>
    <MotionProbe id={id} value={s} family="text" axis="progress" />
    <span style={{display: 'inline-block', color: color ?? palette.ink, fontFamily: fonts.display, fontSize: size, fontWeight: weight, lineHeight: 1.25, letterSpacing: '-0.03em', whiteSpace: 'nowrap', opacity: p, transform: `translateY(${(1 - p) * 0.3}em)`}}>
      <span>{before}</span>
      <span style={{position: 'relative', display: 'inline-block', background: s >= 1 ? palette.accent : 'transparent'}}>
        <span style={{position: 'absolute', left: '-0.12em', right: '-0.12em', top: '0.02em', bottom: '0.02em', background: palette.accent, transform: `scaleX(${s})`, transformOrigin: 'left'}} />
        <span style={{position: 'relative', color: s >= 1 ? palette.paper : color ?? palette.ink}}>{word}</span>
      </span>
      <span>{after}</span>
    </span>
  </div>;
}

/** Integer part grouped by thousands; the value is rounded once so every frame agrees on the digits. */
export function formatNumber(value: number, decimals: number): string {
  const fixed = (Math.round(value * 10 ** decimals) / 10 ** decimals).toFixed(decimals);
  const [whole, fraction] = fixed.split('.');
  return whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction ? `.${fraction}` : '');
}

/** Counts `from`→`to` over `count` frames with a cubic ease-out; tabular digits keep the width still. `example` adds the 예시 tag. */
export function Counter({from = 0, to, decimals = 0, prefix = '', unit = '', count = 40, example = false, color, weight = 900, ...props}: Text & {from?: number; to: number; decimals?: number; prefix?: string; unit?: string; count?: number; example?: boolean}) {
  const {frame, at, size, palette, fonts, id = `count-${at}`} = props;
  const {p, hidden} = blockPhase(props, 10, 10);
  const t = blockRise(frame, at, count, Easing.out(Easing.cubic));
  const value = from + (to - from) * t;
  return <div style={blockPlace(props, hidden)}>
    <MotionProbe id={id} value={t} family="text" axis="progress" />
    <span style={{display: 'inline-flex', alignItems: 'baseline', gap: size * 0.18, color: color ?? palette.ink, fontFamily: fonts.display, fontSize: size, fontWeight: weight, lineHeight: 1, letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', opacity: p, transform: `translateY(${(1 - p) * 0.25}em)`}}>
      <span>{prefix}{formatNumber(value, decimals)}</span>
      {unit ? <span style={{fontSize: size * 0.5}}>{unit}</span> : null}
      {example ? <span style={{fontFamily: fonts.ui, fontSize: size * 0.35, fontWeight: 500, letterSpacing: 0, padding: '0.1em 0.5em', border: `${Math.max(2, size * 0.02)}px solid currentColor`, borderRadius: 999, alignSelf: 'center'}}>예시</span> : null}
    </span>
  </div>;
}

export const TEXT_BLOCKS: BlockEntry[] = [
  {id: 'glyph-rise', title: 'Glyph rise', family: 'text', props: ['text', 'stagger=2', 'rise=12', 'color', 'weight=900'], when: 'Headlines and names: each glyph rises out of its mask; the exit drops them back.'},
  {id: 'word-cascade', title: 'Word cascade', family: 'text', props: ['lines[]', 'stagger=4', 'color', 'weight=900'], when: 'Two or three lines of copy: words fall into place from below, heavier words later and slower.'},
  {id: 'zoom-swap', title: 'Zoom swap', family: 'text', props: ['words[]', 'hold=36', 'swap=16', 'color', 'weight=900'], when: 'One slot cycling through alternatives (times, places, verbs): a Z-axis swap through blur, never two readable at once.'},
  {id: 'typewriter', title: 'Typewriter', family: 'text', props: ['text', 'speed=2', 'blink=15', 'color', 'weight=500'], when: 'A sentence being written: characters arrive behind a blinking block caret; the exit deletes them.'},
  {id: 'highlight-sweep', title: 'Highlight sweep', family: 'text', props: ['before', 'word', 'after', 'delay=12', 'sweep=14', 'color', 'weight=900'], when: 'Stress one word in a sentence: an accent bar sweeps behind it and the word turns paper.'},
  {id: 'counter', title: 'Counter', family: 'text', props: ['to', 'from=0', 'decimals=0', 'prefix', 'unit', 'count=40', 'example=false', 'color', 'weight=900'], when: 'A number that counts up with tabular digits and an optional unit, prefix and 예시 tag.'},
];
