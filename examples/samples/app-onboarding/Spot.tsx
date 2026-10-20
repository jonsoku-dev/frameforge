import type {CSSProperties, ReactNode} from 'react';
import {AbsoluteFill, Audio, Easing, Sequence, googleFont, interpolate, spring, useCurrentFrame} from 'frameforge';

const noto = googleFont('Noto Sans KR', {weights: [700], fallback: 'sans-serif'});
const nunito = googleFont('Nunito', {weights: [600], fallback: '"Noto Sans KR", sans-serif'});
const paper = '#FFFFFF';
const ink = '#1F2937';
const accent = '#0EA5E9';
const soft = '#E0F2FE';
const edge = 'rgba(31,41,55,0.12)';
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} satisfies {extrapolateLeft: 'clamp'; extrapolateRight: 'clamp'};
const L = 150; // inner left of the card text column
const rowX = (i: number) => L + i * 114 + 48; // centres of the seven circles
const streakY = [1340, 1270, 1290, 1160, 1080, 1040, 890];
const fillAt = (i: number) => 195 + i * 18;

function span(frame: number, from: number, dur: number): number {
  return interpolate(frame, [from, from + dur], [0, 1], {...clamp, easing: ease});
}

function pop(frame: number, at: number, dur: number, settle = false): number {
  return spring({frame, fps: 30, delay: at, durationInFrames: dur, config: {overshootClamping: settle}});
}

function mix(a: string, b: string, t: number): string {
  const c = (hex: string, k: number) => parseInt(hex.slice(1 + k * 2, 3 + k * 2), 16);
  return `rgb(${[0, 1, 2].map(k => Math.round(c(a, k) + (c(b, k) - c(a, k)) * t)).join(',')})`;
}

function Glyphs({text, frame, at, size, color, stagger = 3}: {text: string; frame: number; at: number; size: number; color: string; stagger?: number}) {
  return <span style={{display: 'flex', color, fontFamily: noto, fontSize: size, fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.03em'}}>
    {Array.from(text).map((glyph, index) => {
      const rise = span(frame, at + index * stagger, 12);
      // Noto Sans KR Hangul ink overshoots the 1.2em line box top and bottom, so the mask pads 0.2em and cancels it with negative margins.
      return <span key={index} style={{display: 'inline-block', overflow: 'hidden', paddingBlock: '0.2em', marginBlock: '-0.2em', paddingInline: '0.12em', marginInline: '-0.12em'}}>
        <span style={{display: 'inline-block', transform: `translateY(${(1 - rise) * 130}%)`, visibility: rise === 0 ? 'hidden' : 'visible'}}>{glyph === ' ' ? ' ' : glyph}</span>
      </span>;
    })}
  </span>;
}

const label: CSSProperties = {fontFamily: nunito, fontWeight: 600, color: ink};

/** A card slides up at `at`; `behind` are the frames where later cards arrive and push it back. */
function Card({frame, at, step, behind, children}: {frame: number; at: number; step: number; behind: number[]; children: ReactNode}) {
  const enter = pop(frame, at, 24, true);
  const back = behind.reduce((sum, b) => sum + pop(frame, b, 24, true), 0);
  return <AbsoluteFill style={{transform: `translateY(${(1 - enter) * 1700 - back * 70}px) scale(${1 - back * 0.05})`, transformOrigin: '50% 260px', visibility: frame < at ? 'hidden' : 'visible'}}>
    <div style={{position: 'absolute', left: 100, top: 260, width: 880, height: 1400, borderRadius: 56, background: paper, border: `3px solid ${edge}`, boxSizing: 'border-box'}} />
    <div style={{...label, position: 'absolute', right: 150, top: 320, fontSize: 52, background: soft, borderRadius: 32, padding: '8px 28px'}}>{step}/3</div>
    {children}
  </AbsoluteFill>;
}

function Pick({frame}: {frame: number}) {
  const options = ['아침 산책', '물 한 잔', '책 열 쪽'];
  const fall = interpolate(frame, [62, 94], [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
  const chosen = span(frame, 46, 8);
  const centre = span(frame, 96, 22);
  return <AbsoluteFill style={{clipPath: 'inset(260px 100px 260px 100px round 56px)'}}>
    <div style={{position: 'absolute', left: L, top: 420}}><Glyphs text="하나만 고른다" frame={frame} at={6} size={124} color={ink} /></div>
    {options.map((text, i) => {
      const first = i === 0;
      const t = first ? `translateY(${centre * 160}px) scale(${1 + 0.06 * centre})` : `translateY(${fall * 1100}px) rotate(${(i === 1 ? -9 : 9) * fall}deg)`;
      return <div key={text} style={{...label, position: 'absolute', left: L, top: 640 + i * 160, width: 780, height: 130, borderRadius: 40, boxSizing: 'border-box', paddingLeft: 48, display: 'flex', alignItems: 'center', fontSize: 52, transform: t, background: first ? mix(soft, accent, chosen) : soft, visibility: frame < 12 + i * 4 ? 'hidden' : 'visible'}}>
        {text}
        {first ? <div style={{position: 'absolute', right: 36, width: 70, height: 70, borderRadius: '50%', background: paper, transform: `scale(${pop(frame, 104, 14)})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44, color: accent}}>✓</div> : null}
      </div>;
    })}
    <div style={{...label, position: 'absolute', left: L, top: 1560, fontSize: 52, opacity: 0.75, visibility: frame < 96 ? 'hidden' : 'visible', transform: `translateY(${(1 - span(frame, 96, 12)) * 30}px)`}}>예시</div>
  </AbsoluteFill>;
}

function Daily({frame}: {frame: number}) {
  const done = Array.from({length: 7}, (_, i) => frame >= fillAt(i)).filter(Boolean).length;
  return <>
    <div style={{position: 'absolute', left: L, top: 420}}><Glyphs text="매일 한 번" frame={frame} at={166} size={124} color={ink} /></div>
    {Array.from({length: 7}, (_, i) => <div key={i} style={{position: 'absolute', left: rowX(i) - 48, top: 800, width: 96, height: 96, borderRadius: '50%', background: soft, overflow: 'hidden'}}>
      <div style={{width: '100%', height: '100%', borderRadius: '50%', background: accent, transform: `scale(${pop(frame, fillAt(i), 16)})`}} />
    </div>)}
    {'MTWTFSS'.split('').map((d, i) => <div key={i} style={{...label, position: 'absolute', left: rowX(i) - 48, width: 96, top: 918, textAlign: 'center', fontSize: 48, opacity: 0.75}}>{d}</div>)}
    <div style={{...label, position: 'absolute', left: L, top: 1180, fontSize: 150, lineHeight: 1}}>{done} <span style={{opacity: 0.35}}>/ 7</span></div>
    <div style={{...label, position: 'absolute', left: L, top: 1560, fontSize: 52, opacity: 0.75}}>예시</div>
  </>;
}

function Streak({frame}: {frame: number}) {
  const flood = span(frame, 480, 24);
  const c = mix(accent, paper, span(frame, 482, 14));
  const pts = Array.from({length: 7}, (_, i) => {
    const r = span(frame, 360 + i * 4, 26);
    return {x: rowX(i), y: interpolate(r, [0, 1], [848, streakY[i]]), d: interpolate(r, [0, 1], [96, 40])};
  });
  const lift = span(frame, 480, 14);
  return <>
    <Name frame={frame} />
    <div style={{position: 'absolute', left: L, top: 420, opacity: 1 - lift, transform: `translateY(${-lift * 60}px)`}}><Glyphs text="흐름을 본다" frame={frame} at={346} size={124} color={ink} /></div>
    <svg width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0}}>
      <polyline pathLength={1} points={pts.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={c} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={1} strokeDashoffset={1 - span(frame, 396, 40)} />
    </svg>
    {pts.map((p, i) => <div key={i} style={{position: 'absolute', left: p.x - p.d / 2, top: p.y - p.d / 2, width: p.d, height: p.d, borderRadius: '50%', background: frame < 360 ? accent : c}} />)}
    <div style={{...label, position: 'absolute', left: L, top: 1560, fontSize: 52, opacity: 0.75 * (1 - flood)}}>예시 · 샘플 데이터</div>
  </>;
}

function Name({frame}: {frame: number}) {
  const p = pop(frame, 480, 24, true);
  const inset = (1 - p);
  return <AbsoluteFill style={{background: accent, clipPath: `inset(${260 * inset}px ${100 * inset}px ${260 * inset}px ${100 * inset}px round ${56 * inset}px)`, visibility: frame < 480 ? 'hidden' : 'visible'}} />;
}

export function Spot() {
  const frame = useCurrentFrame();
  const hold = frame >= 480;
  return <AbsoluteFill style={{background: soft, fontFamily: noto, overflow: 'hidden'}}>
    <Audio src="/audio/generated/app-onboarding/music.wav" volume={0.9} />
    {[0, 150, 330, 480].map(f => <Sequence key={f} from={f} durationInFrames={30} layout="none"><Audio src="/audio/generated/app-onboarding/whoosh.wav" volume={0.8} /></Sequence>)}
    {Array.from({length: 7}, (_, i) => <Sequence key={i} from={fillAt(i)} durationInFrames={30} layout="none"><Audio src="/audio/generated/app-onboarding/pop.wav" volume={0.8} /></Sequence>)}
    <Card frame={frame} at={0} step={1} behind={[150, 330]}><Pick frame={frame} /></Card>
    <Card frame={frame} at={150} step={2} behind={[330]}><Daily frame={frame} /></Card>
    <Card frame={frame} at={330} step={3} behind={[]}><Streak frame={frame} /></Card>
    {hold ? <>
      <div style={{position: 'absolute', left: 0, right: 0, top: 1420, display: 'flex', justifyContent: 'center'}}><Glyphs text="Pinora" frame={frame} at={486} size={220} color={paper} stagger={3} /></div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 1690, display: 'flex', justifyContent: 'center'}}><Glyphs text="하루 하나로, 흐름이 된다" frame={frame} at={496} size={72} color={ink} stagger={1} /></div>
    </> : null}
  </AbsoluteFill>;
}
