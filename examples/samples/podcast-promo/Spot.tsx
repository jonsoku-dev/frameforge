import type {ReactNode} from 'react';
import {AbsoluteFill, Audio, Easing, Sequence, googleFont, interpolate, random, useCurrentFrame} from 'frameforge';

const headline = googleFont('Nanum Myeongjo', {weights: [800], fallback: 'serif'});
const ui = googleFont('Noto Sans KR', {weights: [400], fallback: 'sans-serif'});
const ink = '#2B1D14';
const paper = '#F1E9DC';
const accent = '#E9A23B';
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} satisfies {
  extrapolateLeft: 'clamp';
  extrapolateRight: 'clamp';
};

const BARS = 24;
const BAR_PITCH = 56;
const BAR_W = 30;
const PART = 470;
const LINE_Y = 712;
const LINE_W = 1424; // the measured width of the title at 140px
const LINE_PITCH = LINE_W / BARS;
const TITLE = '답장을 미뤄도 괜찮은 밤';
const QUOTES = [
  {text: '빨리 답하지 않아도', at: 48, y: 440},
  {text: '닿는 말은 있어요', at: 96, y: 540},
  {text: '오늘은 천천히 듣자', at: 144, y: 640},
];
const POPS = [48, 96, 144];
const DING = 322;
const QUOTE_OUT = 258;
const TITLE_AT = 294;

function span(frame: number, from: number, dur: number): number {
  return interpolate(frame, [from, from + dur], [0, 1], {...clamp, easing: ease});
}

const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Bars breathe at the center, part into two columns, then shut into one line that becomes the title underline. */
function Bars({frame}: {frame: number}) {
  const grow = span(frame, 0, 12);
  const open = span(frame, 36, 24);
  // Two phases so the frame never sits on a bare line: columns close while still tall, then flatten under the rising title.
  const close = span(frame, 262, 30);
  const flat = span(frame, 290, 32);
  const centerY = mix(540, LINE_Y, flat);
  const pitch = mix(BAR_PITCH, LINE_PITCH, close);
  const width = mix(BAR_W, LINE_PITCH + 1.5, close);
  return <>{Array.from({length: BARS}, (_, i) => {
    const breath = 0.55 * random(`bar-${i}`) + 0.45 * (0.5 + 0.5 * Math.sin(frame * 0.16 + i * 0.7));
    const height = mix((80 + 380 * breath) * (0.4 + 0.6 * grow), 8, flat);
    const side = i < BARS / 2 ? -1 : 1;
    const x = (i - (BARS - 1) / 2) * pitch + side * PART * open * (1 - close);
    return <div key={i} style={{position: 'absolute', left: 960 + x - width / 2, top: centerY - height / 2, width, height, background: accent, borderRadius: (1 - close) * BAR_W / 2}} />;
  })}</>;
}

/** Each glyph rises from below its own mask. */
function Glyphs({text, frame, at, size, family, weight, stagger = 2}: {text: string; frame: number; at: number; size: number; family: string; weight: number; stagger?: number}) {
  return <span style={{display: 'flex', fontFamily: family, fontWeight: weight, fontSize: size, color: ink, lineHeight: 1, letterSpacing: '-0.02em'}}>
    {Array.from(text).map((glyph, index) => {
      const rise = span(frame, at + index * stagger, 12);
      // The glyph starts 1.6em down, below the mask's bottom edge (1.35em + 0.2em), so no sliver shows before it rises.
      // Parentheses in Noto Sans KR descend below the standard glyph mask, so the bottom gets 0.2em.
      return <span key={`${glyph}${index}`} style={{display: 'inline-block', overflow: 'hidden', height: '1.35em', paddingTop: '0.1em', paddingBottom: '0.2em', marginTop: '-0.1em', marginBottom: '-0.2em', paddingInline: '0.06em', marginInline: '-0.06em'}}>
        <span style={{display: 'inline-block', transform: `translateY(${(1 - rise) * 160}%)`, visibility: rise > 0 ? 'visible' : 'hidden'}}>{glyph === ' ' ? ' ' : glyph}</span>
      </span>;
    })}
  </span>;
}

function Row({top, children}: {top: number; children: ReactNode}) {
  return <div style={{position: 'absolute', top, left: 0, width: 1920, display: 'flex', justifyContent: 'center'}}>{children}</div>;
}

export function Spot() {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{background: paper, overflow: 'hidden'}}>
    <Audio src="/audio/generated/podcast-promo/music.wav" volume={0.9} />
    <Bars frame={frame} />
    {QUOTES.map((quote, i) => {
      // Each line squeezes to the center as the bar columns close in, one frame apart; linear so no hairline lingers.
      const wipe = interpolate(frame, [QUOTE_OUT + i, QUOTE_OUT + i + 6], [0, 50], clamp);
      return frame < QUOTE_OUT + i + 6 && <div key={quote.text} style={{position: 'absolute', inset: 0, clipPath: `inset(0 ${wipe}% 0 ${wipe}%)`}}><Row top={quote.y - 40}>
        <Glyphs text={quote.text} frame={frame} at={quote.at} size={80} family={ui} weight={400} />
      </Row></div>;
    })}
    <Row top={340}><Glyphs text="느린 대화" frame={frame} at={TITLE_AT + 14} size={64} family={ui} weight={400} stagger={1} /></Row>
    <Row top={428}><Glyphs text="EP. 01 (예시)" frame={frame} at={TITLE_AT + 20} size={48} family={ui} weight={400} stagger={1} /></Row>
    <Row top={520}><Glyphs text={TITLE} frame={frame} at={TITLE_AT} size={140} family={headline} weight={800} /></Row>
    {POPS.map(from => <Sequence key={from} from={from} durationInFrames={30} layout="none"><Audio src="/audio/generated/podcast-promo/pop.wav" volume={0.8} /></Sequence>)}
    <Sequence from={DING} durationInFrames={30} layout="none"><Audio src="/audio/generated/podcast-promo/ding.wav" volume={0.8} /></Sequence>
  </AbsoluteFill>;
}
