import type {CSSProperties, ReactNode} from 'react';
import {AbsoluteFill, Audio, Easing, Sequence, googleFont, interpolate, random, spring, useCurrentFrame} from 'frameforge';

const plex = googleFont('IBM Plex Sans KR', {weights: [700], fallback: 'sans-serif'});
// Plex Mono has no Hangul, so Korean label text falls through to Plex Sans KR.
const mono = googleFont('IBM Plex Mono', {weights: [500], fallback: `${plex}`});
const paper = '#F2F4F3';
const ink = '#15261B';
const accent = '#2F8F5B';
const soft = '#D9E8DF';
const ease = Easing.bezier(0.16, 1, 0.3, 1);
// Big numbers use the headline family: Plex Mono's comma is a full digit wide.
const figures: CSSProperties = {fontFamily: plex, fontWeight: 700, fontVariantNumeric: 'tabular-nums'};
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} satisfies {
  extrapolateLeft: 'clamp';
  extrapolateRight: 'clamp';
};

// Seasonal shape in thousands of trips: low winter, spring and autumn peaks, a rainy-season dip in July.
const seasonal = [34, 38, 57, 79, 96, 88, 71, 76, 99, 91, 58, 40];
const trips = seasonal.map((k, i) => Math.round((k * 1000 + (random(`trips-${i}`) - 0.5) * 8000) / 100) * 100);
const total = trips.reduce((sum, v) => sum + v, 0);
const peak = trips.indexOf(Math.max(...trips));
const baseline = 860;
const x = (i: number) => 256 + i * 128;
const top = (i: number) => baseline - (trips[i] / trips[peak]) * 500;
const barAt = (i: number) => 128 + i * 12;

function span(frame: number, from: number, dur: number): number {
  return interpolate(frame, [from, from + dur], [0, 1], {...clamp, easing: ease});
}

function pop(frame: number, at: number, dur: number, settle = false): number {
  return spring({frame, fps: 30, delay: at, durationInFrames: dur, config: {overshootClamping: settle}});
}

function push(frame: number, at: number, dur: number, amount: number): number {
  const t = interpolate(frame, [at, at + dur], [0, 1], clamp);
  return 1 + amount * Math.sin(t * Math.PI);
}

function Glyphs({text, frame, at, out = 9999, size, color, stagger = 2}: {text: string; frame: number; at: number; out?: number; size: number; color: string; stagger?: number}) {
  return <span style={{display: 'flex', color, fontFamily: plex, fontSize: size, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.03em'}}>
    {Array.from(text).map((glyph, index) => {
      const shown = span(frame, at + index * stagger, 12) - span(frame, out + index * stagger / 2, 10);
      return <span key={`${glyph}${index}`} style={{display: 'inline-block', overflow: 'hidden', height: '1.3em', paddingTop: '0.14em', marginTop: '-0.14em', paddingInline: '0.08em', marginInline: '-0.08em'}}>
        <span style={{display: 'inline-block', transform: `translateY(${(1 - shown) * 120}%)`, visibility: shown === 0 ? 'hidden' : 'visible'}}>{glyph === ' ' ? ' ' : glyph}</span>
      </span>;
    })}
  </span>;
}

function Headlines({frame}: {frame: number}) {
  const lines = [
    {text: '솔내시 자전거, 1년', at: 6, out: 114},
    {text: '달마다 나눠 보면', at: 124, out: 306},
    {text: '흐름은 계절을 탄다', at: 318, out: 444},
    {text: `${peak + 1}월, 가장 많이 달렸다`, at: 470, out: 9999},
  ];
  return <>{lines.map(line => frame >= line.at && frame < line.out + 30
    ? <div key={line.text} style={{position: 'absolute', left: 96, top: 110}}><Glyphs text={line.text} frame={frame} at={line.at} out={line.out} size={96} color={ink} /></div>
    : null)}</>;
}

function Total({frame}: {frame: number}) {
  // Quad ease-out stays under 60% through the first 20 frames, so the climb from zero is visible.
  const count = Math.round(total * interpolate(frame, [10, 70], [0, 1], {...clamp, easing: Easing.out(Easing.quad)}) / 100) * 100;
  const dock = span(frame, 116, 26);
  const label: CSSProperties = {fontFamily: mono, fontWeight: 500, color: ink, lineHeight: 1.2};
  return <div style={{position: 'absolute', right: interpolate(dock, [0, 1], [425, 96]), top: interpolate(dock, [0, 1], [400, 120]), transform: `scale(${interpolate(dock, [0, 1], [1, 0.42])})`, transformOrigin: 'right top', textAlign: 'right'}}>
    <div style={{...label, fontSize: 92, opacity: dock}}>연간 통행</div>
    <div data-clip="allow" style={{...label, ...figures, fontSize: 250, letterSpacing: '-0.02em'}}>{count.toLocaleString('en-US')}<span style={{fontSize: 106}}> 회</span></div>
  </div>;
}

function Bars({frame}: {frame: number}) {
  const grow = span(frame, 20, 60);
  const split = span(frame, 120, 12);
  return <>
    {trips.map((_, i) => {
      const rise = pop(frame, barAt(i), 36, true);
      const sink = span(frame, 372 + i * 3, 18);
      const width = interpolate(split, [0, 1], [128, 80]);
      const height = (14 + rise * (baseline - top(i) - 14)) * (1 - sink);
      // Before the split the twelve slots sit edge to edge and read as one line growing from the centre.
      const reveal = Math.max(0, Math.min(1, (grow * 768 - Math.abs(x(i) - 960) + 64) / 128));
      return <div key={i} style={{position: 'absolute', left: x(i) - width / 2, top: baseline - height, width, height, background: accent, transform: `scaleX(${split > 0 ? 1 : reveal})`, transformOrigin: x(i) < 960 ? 'right' : 'left'}} />;
    })}
  </>;
}

function Line({frame, children}: {frame: number; children: ReactNode}) {
  const draw = span(frame, 306, 54);
  const fill = span(frame, 372, 48);
  const points = trips.map((_, i) => `${x(i)},${top(i)}`).join(' L ');
  const column = span(frame, 450, 18);
  // Bars sit above the rising area so they visibly sink into it, and under the line that replaces them.
  return <>
    <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
      <path d={`M ${x(0)},${baseline} L ${points} L ${x(11)},${baseline} Z`} fill={soft} style={{transform: `scaleY(${fill})`, transformOrigin: `0 ${baseline}px`}} />
    </svg>
    {children}
    <div style={{position: 'absolute', left: x(peak) - 64, top: 300, width: 128, height: baseline - 300, background: accent, transform: `scaleY(${column})`, transformOrigin: 'bottom'}} />
    <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
    <path d={`M ${points}`} fill="none" stroke={ink} strokeWidth={8} strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
    {trips.map((_, i) => <circle key={i} cx={x(i)} cy={top(i)} r={14 * pop(frame, 300 + i * 3, 14) + (i === peak ? 16 * pop(frame, 456, 18) : 0)} fill={i === peak && frame >= 456 ? ink : accent} stroke={paper} strokeWidth={5} />)}
    </svg>
  </>;
}

function Peak({frame}: {frame: number}) {
  const badge = pop(frame, 478, 16, true);
  return <>
    {/* Left of the dot and the column: above it the badge would run into the docked total. */}
    <div style={{position: 'absolute', right: 1920 - (x(peak) - 72), top: top(peak) - 30, transform: `translateX(${(badge - 1) * 30}px)`, opacity: badge}}>
      <div style={{...figures, fontSize: 40, lineHeight: 1.2, color: paper, background: ink, padding: '6px 18px'}}>{trips[peak].toLocaleString('en-US')}회</div>
    </div>
  </>;
}

export function Spot() {
  const frame = useCurrentFrame();
  const wipe = span(frame, 120, 22);
  // One camera push, toward the peak month, so the insight lands on its own beat.
  const camera = push(frame, 450, 50, 0.05);
  return <AbsoluteFill style={{background: soft, overflow: 'hidden'}}>
    <Audio src="/audio/generated/data-story/music.wav" volume={0.9} />
    {trips.map((_, i) => <Sequence key={i} from={barAt(i) + 12} durationInFrames={30} layout="none"><Audio src="/audio/generated/data-story/click.wav" volume={0.8} /></Sequence>)}
    <Sequence from={456} durationInFrames={30} layout="none"><Audio src="/audio/generated/data-story/ding.wav" volume={0.8} /></Sequence>
    <AbsoluteFill style={{background: paper, clipPath: `inset(${(1 - wipe) * 100}% 0 0 0)`}} />
    <AbsoluteFill style={{transform: `scale(${camera})`, transformOrigin: `${x(peak)}px ${top(peak)}px`}}>
      <Line frame={frame}><Bars frame={frame} /></Line>
      {frame >= 450 ? <Peak frame={frame} /> : null}
      <div style={{position: 'absolute', left: 192, top: baseline, width: 1536, height: 4, background: ink, transform: `scaleX(${span(frame, 120, 20)})`}} />
      {trips.map((_, i) => <div key={i} style={{position: 'absolute', left: x(i) - 60, width: 120, top: baseline + 22, textAlign: 'center', fontFamily: mono, fontWeight: 500, fontSize: 38, lineHeight: 1.2, color: i === peak && frame >= 456 ? accent : ink, opacity: span(frame, barAt(i), 10)}}>{String(i + 1).padStart(2, '0')}</div>)}
    </AbsoluteFill>
    <Total frame={frame} />
    <Headlines frame={frame} />
    <div style={{position: 'absolute', left: 96, bottom: 60, fontFamily: mono, fontWeight: 500, fontSize: 34, lineHeight: 1.2, color: ink}}>샘플 데이터 · 가상의 도시 솔내시</div>
  </AbsoluteFill>;
}
