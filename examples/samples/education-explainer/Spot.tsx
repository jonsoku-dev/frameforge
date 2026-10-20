import type {CSSProperties} from 'react';
import {AbsoluteFill, Audio, Easing, Sequence, googleFont, interpolate, spring, useCurrentFrame} from 'frameforge';

const display = googleFont('Do Hyeon', {weights: [400], fallback: 'sans-serif'});
const ui = googleFont('Noto Sans KR', {weights: [500], fallback: 'sans-serif'});
const paper = '#FDFCF7';
const ink = '#1B1B1B';
const accent = '#1D4ED8';
const soft = '#93C5FD';
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} satisfies {
  extrapolateLeft: 'clamp';
  extrapolateRight: 'clamp';
};

// Example model: principal 120px, 30% per beat, six beats. Simple adds 36px each beat; compound adds 30% of its own height.
const base = 120;
const rate = 0.3;
const beats = [116, 144, 172, 200, 228, 256];
const floor = 900;
const simpleTop = (t: number) => base * (1 + rate * t);
const compoundTop = (t: number) => base * (1 + rate) ** t;
const chartX = (t: number) => 300 + 230 * t;
const columns = [
  {x: 700, color: ink, lag: 0, top: simpleTop},
  {x: 1220, color: accent, lag: 8, top: compoundTop},
] as const;
const popFrames = [6, 12, ...beats.flatMap(at => columns.map(column => at + column.lag))];

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

function Glyphs({text, frame, at, size, color, font = display, out, stagger = 3}: {text: string; frame: number; at: number; size: number; color: string; font?: string; out?: number; stagger?: number}) {
  return <span style={{display: 'flex', color, fontFamily: font, fontWeight: font === display ? 400 : 500, fontSize: size, lineHeight: 1, letterSpacing: '-0.02em', whiteSpace: 'nowrap'}}>
    {Array.from(text).map((glyph, index) => {
      const rise = span(frame, at + index * stagger, 12) - (out === undefined ? 0 : span(frame, out + index * stagger, 12));
      // The mask also reaches 0.1em below the line because Noto Sans KR parentheses descend past the 1.15em box.
      return <span key={`${glyph}${index}`} style={{display: 'inline-block', overflow: 'hidden', height: '1.25em', paddingTop: '0.1em', marginTop: '-0.1em', paddingBottom: '0.1em', marginBottom: '-0.1em', paddingInline: '0.06em', marginInline: '-0.06em'}}>
        <span style={{display: 'inline-block', transform: `translateY(${(1 - rise) * 120}%)`, visibility: rise === 0 ? 'hidden' : 'visible'}}>{glyph === ' ' ? ' ' : glyph}</span>
      </span>;
    })}
  </span>;
}

const disc = (x: number, y: number, d: number, color: string): CSSProperties => ({position: 'absolute', left: x - d / 2, top: y - d / 2, width: d, height: d, borderRadius: '50%', background: color});

function Question({frame}: {frame: number}) {
  return <AbsoluteFill style={{background: accent, overflow: 'hidden'}}>
    <div style={{position: 'absolute', left: 160, top: 100}}><Glyphs text="같은 돈," frame={frame} at={10} size={190} color={paper} /></div>
    <div style={{position: 'absolute', left: 160, top: 320}}><Glyphs text="왜 다르게 자랄까?" frame={frame} at={22} size={190} color={paper} /></div>
    {columns.map((column, index) => <div key={column.x} style={{...disc(column.x, 760, 300, paper), transform: `translateY(${(pop(frame, popFrames[index], 16, true) - 1) * 900}px)`}} />)}
  </AbsoluteFill>;
}

function Growth({frame}: {frame: number}) {
  const open = pop(frame, 100, 20, true) * 1500;
  const drawn = 6 * span(frame, 350, 70);
  const filled = 6 * span(frame, 420, 36);
  const line = (top: (t: number) => number, to: number) => Array.from({length: 61}, (_, i) => (i / 60) * to).map(t => `${chartX(t)},${floor - top(t)}`).join(' ');
  return <AbsoluteFill style={{background: paper, overflow: 'hidden', clipPath: `circle(${open}px at 960px 760px)`}}>
    <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
      {filled > 0 ? <polygon points={`${line(compoundTop, filled)} ${line(simpleTop, filled).split(' ').reverse().join(' ')}`} fill={accent} /> : null}
      {drawn > 0 ? <>
        <polyline points={line(simpleTop, drawn)} fill="none" stroke={ink} strokeWidth={8} strokeLinecap="round" />
        <polyline points={line(compoundTop, drawn)} fill="none" stroke={accent} strokeWidth={8} strokeLinecap="round" />
      </> : null}
    </svg>
    {columns.map(column => Array.from({length: 7}, (_, k) => {
      const below = k === 0 ? 0 : column.top(k - 1);
      const d = column.top(k) - below;
      const drop = k === 0 ? 1 : pop(frame, beats[k - 1] + column.lag, 16, true);
      const x = interpolate(pop(frame, 300 + k * 4, 22, true), [0, 1], [column.x, chartX(k)]);
      const settle = span(frame, 304 + k * 2, 18);
      const shrink = interpolate(settle, [0, 1], [1, 20 / d]);
      if (k > 0 && frame < beats[k - 1] + column.lag) return null;
      return <div key={`${column.x}-${k}`} style={{...disc(x, floor - below - d / 2, d, column.color), transformOrigin: 'center top', transform: `translateY(${(drop - 1) * 700 - settle * 10}px) scale(${shrink})`}} />;
    }))}
    {columns.map((column, index) => <div key={column.x} style={{position: 'absolute', left: column.x - 200, width: 400, top: 930, display: 'flex', justifyContent: 'center'}}>
      <Glyphs text={index === 0 ? '단리' : '복리'} frame={frame} at={108 + index * 4} out={296} size={64} color={column.color} font={ui} />
    </div>)}
    <div style={{position: 'absolute', right: 96, top: 64}}><Glyphs text="예시 · 한 번에 이자 30%" frame={frame} at={112} size={40} color={ink} font={ui} stagger={1} /></div>
    <div style={{position: 'absolute', left: 96, top: 64}}><Glyphs text="이자가 붙는 두 가지 방식" frame={frame} at={108} out={290} size={96} color={ink} stagger={2} /></div>
    <div style={{position: 'absolute', left: 96, top: 64}}><Glyphs text="차이는 점점 벌어진다" frame={frame} at={312} size={96} color={ink} /></div>
    <div style={{position: 'absolute', left: 1600, top: floor - simpleTop(6) + 28}}><Glyphs text="단리" frame={frame} at={424} size={56} color={ink} font={ui} /></div>
    <div style={{position: 'absolute', left: 1540, top: floor - compoundTop(6) - 90}}><Glyphs text="복리" frame={frame} at={430} size={56} color={accent} font={ui} /></div>
  </AbsoluteFill>;
}

const symbols: {glyph: string; name?: string; sup?: boolean; gap?: boolean}[] = [
  {glyph: 'A', name: '결과'}, {glyph: '=', gap: true}, {glyph: 'P', name: '원금'}, {glyph: '('}, {glyph: '1'},
  {glyph: '+', gap: true}, {glyph: 'r', name: '이자율'}, {glyph: ')'}, {glyph: 'n', name: '횟수', sup: true},
];

function Formula({frame}: {frame: number}) {
  const open = span(frame, 458, 24) * 1950;
  const lift = span(frame, 630, 24) * -140;
  return <AbsoluteFill style={{background: accent, overflow: 'hidden', clipPath: `circle(${open}px at ${chartX(6)}px ${floor - compoundTop(6)}px)`}}>
    <div style={{position: 'absolute', left: 0, right: 0, top: 330, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', transform: `translateY(${lift}px)`}}>
      {symbols.map((symbol, index) => <div key={symbol.glyph} style={{position: 'relative', marginInline: symbol.gap ? 36 : 4, transform: symbol.sup ? 'translateY(-50px)' : undefined}}>
        <Glyphs text={symbol.glyph} frame={frame} at={470 + index * 5} size={symbol.sup ? 120 : 190} color={paper} font={ui} />
        {symbol.name ? <div style={{position: 'absolute', left: '50%', top: symbol.sup ? 300 : 250, transform: 'translateX(-50%)'}}>
          <Glyphs text={symbol.name} frame={frame} at={476 + index * 5} size={48} color={soft} font={ui} stagger={2} />
        </div> : null}
      </div>)}
    </div>
    <div style={{position: 'absolute', left: 0, right: 0, top: 720, display: 'flex', justifyContent: 'center'}}>
      <Glyphs text="이자에도 이자가 붙는다" frame={frame} at={640} size={120} color={paper} stagger={2} />
    </div>
  </AbsoluteFill>;
}

export function Spot() {
  const frame = useCurrentFrame();
  // One camera push only, on the frame the formula completes; it settles at 552, before the 690 hold.
  const camera = push(frame, 522, 30, 0.04);
  return <AbsoluteFill style={{background: accent, overflow: 'hidden'}}>
    <Audio src="/audio/generated/education-explainer/music.wav" volume={0.9} />
    {popFrames.map(at => <Sequence key={at} from={at} durationInFrames={30} layout="none"><Audio src="/audio/generated/education-explainer/pop.wav" volume={0.8} /></Sequence>)}
    <Sequence from={514} durationInFrames={30} layout="none"><Audio src="/audio/generated/education-explainer/ding.wav" volume={0.8} /></Sequence>
    <AbsoluteFill style={{transform: `scale(${camera})`}}>
      {frame < 120 ? <Question frame={frame} /> : null}
      {frame >= 100 && frame < 490 ? <Growth frame={frame} /> : null}
      {frame >= 458 ? <Formula frame={frame} /> : null}
    </AbsoluteFill>
  </AbsoluteFill>;
}
