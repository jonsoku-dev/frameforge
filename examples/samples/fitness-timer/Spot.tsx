import type {CSSProperties} from 'react';
import {Dumbbell, Flame, Timer} from 'lucide-react';
import {AbsoluteFill, Audio, Easing, Loop, Sequence, googleFont, interpolate, spring, useCurrentFrame} from 'frameforge';

const headline = googleFont('Anton', {weights: [400], fallback: 'sans-serif'});
const ui = googleFont('Noto Sans KR', {weights: [500], fallback: 'sans-serif'});
const ink = '#0F172A';
const lime = '#C6F135';
const paper = '#F8FAFC';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} satisfies {extrapolateLeft: 'clamp'; extrapolateRight: 'clamp'};
const ease = Easing.bezier(0.16, 1, 0.3, 1);

function span(frame: number, from: number, dur: number): number {
  return interpolate(frame, [from, from + dur], [0, 1], {...clamp, easing: ease});
}

function pop(frame: number, at: number, dur: number): number {
  return spring({frame, fps: 30, delay: at, durationInFrames: dur, config: {overshootClamping: true}});
}

function Glyphs({text, frame, at, size, color, family, weight = 400, stagger = 0}: {text: string; frame: number; at: number; size: number; color: string; family: string; weight?: number; stagger?: number}) {
  return <span style={{display: 'flex', color, fontFamily: family, fontSize: size, fontWeight: weight, lineHeight: 1, letterSpacing: '-0.035em'}}>
    {Array.from(text).map((glyph, index) => {
      const rise = span(frame, at + index * stagger, 10);
      return <span key={`${glyph}${index}`} style={{display: 'inline-block', overflow: 'hidden', height: '1.35em', paddingTop: '0.1em', marginTop: '-0.1em', paddingInline: '0.08em', marginInline: '-0.08em'}}>
        <span style={{display: 'inline-block', transform: `translateY(${(1 - rise) * 120}%)`, visibility: rise === 0 ? 'hidden' : 'visible'}}>{glyph === ' ' ? '\u00a0' : glyph}</span>
      </span>;
    })}
  </span>;
}

function Countdown({absoluteFrame}: {absoluteFrame: number}) {
  const frame = useCurrentFrame();
  const iteration = Math.floor(absoluteFrame / 60);
  const Icon = [Dumbbell, Flame, Timer][iteration];
  const digit = 3 - Math.floor(frame / 20);
  const elapsed = frame % 20;
  const shove = digit > 1 ? span(elapsed, 15, 5) : 0;
  const fill = span(frame % 60, 0, 60);
  const numberStyle: CSSProperties = {position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'};
  return <AbsoluteFill style={{background: lime, color: ink, overflow: 'hidden'}}>
    <div style={{position: 'absolute', top: 180, left: 0, right: 0, display: 'flex', justifyContent: 'center', transform: `scale(${0.82 + pop(frame, 0, 14) * 0.18})`}}>
      <Icon size={104} strokeWidth={2.5} color={ink} />
    </div>
    <div style={{position: 'absolute', top: 350, left: 0, right: 0, height: 700, overflow: 'hidden'}}>
      <div style={{...numberStyle, transform: `translateY(${-shove * 118}%)`}}><Glyphs text={String(digit)} frame={frame} at={-10} size={620} color={ink} family={headline} /></div>
      {digit > 1 && elapsed >= 15 ? <div style={{...numberStyle, transform: `translateY(${(1 - shove) * 118}%)`}}><Glyphs text={String(digit - 1)} frame={frame} at={-10} size={620} color={ink} family={headline} /></div> : null}
    </div>
    <div style={{position: 'absolute', top: 1190, left: 0, right: 0, display: 'flex', justifyContent: 'center'}}>
      <Glyphs text="샘플 데이터" frame={frame} at={0} size={38} color={ink} family={ui} weight={500} />
    </div>
    <div style={{position: 'absolute', left: 108, right: 108, bottom: 260, height: 18, background: 'rgba(15,23,42,0.18)', borderRadius: 12, overflow: 'hidden'}}>
      <div style={{height: '100%', width: `${fill * 100}%`, background: ink, transformOrigin: 'left'}} />
    </div>
  </AbsoluteFill>;
}

function NameBuild({frame}: {frame: number}) {
  const push = 1 + 0.035 * Math.sin(span(frame, 180, 60) * Math.PI);
  const rail = (index: number) => {
    const progress = span(frame, 180 + index * 4, 18);
    return {position: 'absolute' as const, left: 180 + index * 120, right: 180 + index * 120, top: interpolate(progress, [0, 1], [790 + index * 100, 1230 + index * 18]), height: 16, background: lime, transform: `scaleX(${1 - progress * 0.12})`, transformOrigin: 'center'};
  };
  return <AbsoluteFill style={{background: ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center'}}>
    {[0, 1, 2].map(index => <div key={index} style={rail(index)} />)}
    <div style={{position: 'absolute', top: 760, left: 80, right: 80, display: 'flex', justifyContent: 'center', transform: `translateY(${(1 - span(frame, 184, 18)) * 90}px) scale(${push})`}}>
      <Glyphs text="Movoza" frame={frame} at={186} size={196} color={paper} family={headline} stagger={2} />
    </div>
  </AbsoluteFill>;
}

function EndCard({frame}: {frame: number}) {
  return <AbsoluteFill style={{background: paper, overflow: 'hidden', alignItems: 'center', justifyContent: 'center'}}>
    <div style={{position: 'absolute', top: 710, left: 80, right: 80, display: 'flex', justifyContent: 'center'}}>
      <Glyphs text="Movoza" frame={frame} at={230} size={196} color={ink} family={headline} />
    </div>
    <div style={{position: 'absolute', top: 970, width: 360, height: 18, background: lime}} />
    <div style={{position: 'absolute', top: 1080, left: 90, right: 90, display: 'flex', justifyContent: 'center'}}>
      <Glyphs text="딱 3초, 바로 시작." frame={frame} at={230} size={54} color={ink} family={ui} weight={500} />
    </div>
  </AbsoluteFill>;
}

export function Spot() {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{background: lime, overflow: 'hidden'}}>
    <Audio src="/audio/generated/fitness-timer/music.wav" volume={0.9} />
    {[0, 20, 40, 60, 80, 100, 120, 140, 160].map(at => <Sequence key={at} from={at} durationInFrames={30} layout="none"><Audio src="/audio/generated/fitness-timer/click.wav" volume={0.8} /></Sequence>)}
    <Sequence from={240} durationInFrames={30} layout="none"><Audio src="/audio/generated/fitness-timer/impact.wav" volume={0.8} /></Sequence>
    <Loop durationInFrames={60} times={3}><Countdown absoluteFrame={frame} /></Loop>
    {frame >= 180 && frame < 240 ? <NameBuild frame={frame} /> : null}
    {frame >= 240 ? <EndCard frame={frame} /> : null}
  </AbsoluteFill>;
}
