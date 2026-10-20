import type {CSSProperties} from 'react';
import {AbsoluteFill, Audio, Easing, Sequence, googleFont, interpolate, spring, useCurrentFrame} from 'frameforge';

const bebas = googleFont('Bebas Neue', {weights: [400], fallback: 'sans-serif'});
const notoKr = googleFont('Noto Sans KR', {weights: [500], fallback: 'sans-serif'});
const ink = '#0E0E10';
const paper = '#EDEDED';
const accent = '#7C3AED';
const muted = '#8A8A90';
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} satisfies {
  extrapolateLeft: 'clamp';
  extrapolateRight: 'clamp';
};

function span(frame: number, from: number, dur: number): number {
  return interpolate(frame, [from, from + dur], [0, 1], {...clamp, easing: ease});
}

function pop(frame: number, at: number, dur: number): number {
  return spring({frame, fps: 30, delay: at, durationInFrames: dur, config: {overshootClamping: true}});
}

function Glyphs({text, frame, at, size, color, stagger = 3, font = bebas, spacing = '0.02em'}: {text: string; frame: number; at: number; size: number; color: string; stagger?: number; font?: string; spacing?: string}) {
  return <span style={{display: 'flex', color, fontFamily: font, fontSize: size, fontWeight: font === bebas ? 400 : 500, lineHeight: 1, letterSpacing: spacing}}>
    {Array.from(text).map((glyph, index) => {
      const rise = span(frame, at + index * stagger, 12);
      // Mask padding is wider than the Gothic A1 measurement: Bebas caps sit high in the line box.
      return <span key={`${glyph}${index}`} style={{display: 'inline-block', overflow: 'hidden', height: '1.3em', paddingTop: '0.2em', marginTop: '-0.2em', paddingInline: '0.1em', marginInline: '-0.1em', whiteSpace: 'pre'}}>
        <span style={{display: 'inline-block', transform: `translateY(${(1 - rise) * 130}%)`, visibility: rise === 0 ? 'hidden' : 'visible'}}>{glyph}</span>
      </span>;
    })}
  </span>;
}

function Panel({frame}: {frame: number}) {
  const grow = span(frame, 0, 24);
  const width = 6 + interpolate(frame, [40, 85], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)}) * 1914;
  return <AbsoluteFill style={{background: ink, overflow: 'hidden'}}>
    <div style={{position: 'absolute', left: 960 - width / 2, top: 0, width, height: 1080, background: accent, transform: `scaleY(${grow})`, transformOrigin: 'center'}} />
    <div style={{position: 'absolute', left: 957, top: 0, width: 6, height: 1080, background: paper, transform: `scaleY(${grow})`, opacity: 1 - span(frame, 40, 14)}} />
  </AbsoluteFill>;
}

function Name({frame}: {frame: number}) {
  const up = span(frame, 210, 24);
  return <div style={{position: 'absolute', left: 120, top: 390, transform: `translateY(${-up * 320}px) scale(${1 - up * 0.35})`, transformOrigin: 'left center'}}>
    <Glyphs text="KERFWORKS" frame={frame} at={72} size={300} color={paper} stagger={3} />
    <div style={{marginTop: 18, opacity: span(frame, 115, 14)}}>
      <Glyphs text="DESIGN ENGINEERING CONFERENCE  /  2027  /  예시" frame={frame} at={115} size={44} color={paper} stagger={1} font={notoKr} spacing="0.16em" />
    </div>
  </div>;
}

const tracks = [['01', 'TYPE AND MOTION', ink, paper], ['02', 'DESIGN SYSTEMS', paper, ink], ['03', 'CREATIVE CODE', muted, ink]] as const;
const slot = (index: number) => 450 + index * 170;

function Bars({frame}: {frame: number}) {
  return <>
    {tracks.map(([num, label, bg, fg], index) => {
      const at = 214 + index * 22;
      // Bar 0 enters from the right; later bars peel out of the previous bar's slot.
      const t = pop(frame, at, 16);
      const x = index === 0 ? (1 - t) * 1800 : 0;
      const y = index === 0 ? 0 : (slot(index) - slot(index - 1)) * t - (slot(index) - slot(index - 1));
      return <div key={num} style={{position: 'absolute', left: 120, top: slot(index), width: 1680, height: 150, zIndex: 3 - index, background: bg, color: fg, display: 'flex', alignItems: 'center', paddingInline: 48, boxSizing: 'border-box', transform: `translate(${x}px, ${y}px)`, visibility: frame < at ? 'hidden' : 'visible', overflow: 'hidden'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 48, opacity: index === 1 ? 1 - span(frame, 328, 10) : 1}}>
        <Glyphs text={num} frame={frame} at={at + 6} size={34} color={fg} font={notoKr} spacing="0.1em" />
        <Glyphs text={label} frame={frame} at={at + 8} size={108} color={fg} stagger={1} />
        </div>
      </div>;
    })}
  </>;
}

function DateCard({frame}: {frame: number}) {
  const g = interpolate(frame, [330, 352], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  return <AbsoluteFill style={{zIndex: 10, background: paper, clipPath: `inset(${620 * (1 - g)}px ${120 * (1 - g)}px ${310 * (1 - g)}px ${120 * (1 - g)}px)`}}>
    <div style={{position: 'absolute', left: 120, top: 150, width: 8, height: 780, background: accent, transform: `scaleY(${span(frame, 346, 20)})`, transformOrigin: 'top'}} />
    <div style={{position: 'absolute', left: 190, top: 220}}>
      <Glyphs text="14-15 NOV 2027" frame={frame} at={346} size={300} color={ink} stagger={1} />
      <div style={{marginTop: 30}}><Glyphs text="QUILLMERE" frame={frame} at={352} size={200} color={accent} stagger={1} /></div>
      <div style={{marginTop: 40}}><Glyphs text="KERFWORKS 2027  /  예시 · 가상 행사" frame={frame} at={348} size={32} color={ink} stagger={0.4} font={notoKr} spacing="0.14em" /></div>
    </div>
  </AbsoluteFill>;
}

export function Spot() {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [360, 380], [0, 1], clamp);
  return <AbsoluteFill style={{background: ink, overflow: 'hidden'}}>
    <Audio src="/audio/generated/event-teaser/music.wav" volume={0.9} />
    <Sequence from={40} durationInFrames={30} layout="none"><Audio src="/audio/generated/event-teaser/whoosh.wav" volume={0.8} /></Sequence>
    <Sequence from={360} durationInFrames={30} layout="none"><Audio src="/audio/generated/event-teaser/impact.wav" volume={0.8} /></Sequence>
    <AbsoluteFill style={{transform: `scale(${1 + 0.03 * Math.sin(t * Math.PI)})`}}>
      <Panel frame={frame} />
      {frame >= 72 ? <Name frame={frame} /> : null}
      {frame >= 214 ? <Bars frame={frame} /> : null}
      {frame >= 330 ? <DateCard frame={frame} /> : null}
    </AbsoluteFill>
  </AbsoluteFill>;
}
