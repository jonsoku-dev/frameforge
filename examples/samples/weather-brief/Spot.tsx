import type {CSSProperties} from 'react';
import {Cloud, CloudRain, Moon, Sun} from 'lucide-react';
import {AbsoluteFill, Audio, Easing, Sequence, googleFont, interpolate, spring, useCurrentFrame} from 'frameforge';

const headline = googleFont('Do Hyeon', {weights: [400], fallback: 'sans-serif'});
const ui = googleFont('Noto Sans KR', {weights: [500], fallback: 'sans-serif'});
const night = '#0B1E3F';
const day = '#CFE8FF';
const ink = '#0F172A';
const accent = '#FFB703';
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} satisfies {extrapolateLeft: 'clamp'; extrapolateRight: 'clamp'};
const slots = [
  {label: '아침', temp: 18, icon: Sun},
  {label: '낮', temp: 24, icon: Cloud},
  {label: '저녁', temp: 21, icon: CloudRain},
  {label: '밤', temp: 16, icon: Moon},
] as const;
const xs = [330, 750, 1170, 1590];
const barHeights = slots.map(({temp}) => 100 + (temp - 14) * 18);

function span(frame: number, from: number, dur: number): number {
  return interpolate(frame, [from, from + dur], [0, 1], {...clamp, easing: ease});
}

function pop(frame: number, at: number, dur: number, settle = false): number {
  return spring({frame, fps: 30, delay: at, durationInFrames: dur, config: {overshootClamping: settle}});
}

function Glyphs({text, frame, at, size, color, family, weight = 500, stagger = 2}: {text: string; frame: number; at: number; size: number; color: string; family: string; weight?: number; stagger?: number}) {
  return <span style={{display: 'flex', color, fontFamily: family, fontSize: size, fontWeight: weight, lineHeight: 1, letterSpacing: '-0.03em'}}>
    {Array.from(text).map((glyph, index) => {
      const rise = span(frame, at + index * stagger, 12);
      return <span key={`${glyph}-${index}`} style={{display: 'inline-block', overflow: 'hidden', height: '1.35em', paddingTop: '0.1em', paddingBottom: '0.2em', marginTop: '-0.1em', marginBottom: '-0.2em', paddingInline: '0.1em', marginInline: '-0.1em'}}>
        <span style={{display: 'inline-block', transform: `translateY(${(1 - rise) * 145}%)`, visibility: rise > 0 ? 'visible' : 'hidden'}}>{glyph === ' ' ? '\u00a0' : glyph}</span>
      </span>;
    })}
  </span>;
}

function Hero({frame}: {frame: number}) {
  const wipe = span(frame, 12, 66);
  const rise = span(frame, 0, 68);
  const sunY = interpolate(rise, [0, 1], [1160, 430]);
  const title = pop(frame, 52, 18, true);
  return <AbsoluteFill style={{background: night, overflow: 'hidden'}}>
    <AbsoluteFill style={{background: day, clipPath: `inset(${(1 - wipe) * 100}% 0 0 0)`}} />
    <div style={{position: 'absolute', left: 960, top: sunY, width: 220, height: 220, borderRadius: '50%', background: accent, transform: 'translate(-50%, -50%) scale(' + (0.86 + 0.14 * pop(frame, 16, 20, true)) + ')'}} />
    <div style={{position: 'absolute', left: 0, right: 0, top: 645, display: 'flex', justifyContent: 'center', transform: `translateY(${(1 - title) * 80}px)`}}>
      <Glyphs text="오늘의 하늘" frame={frame} at={58} size={150} color={ink} family={headline} weight={400} />
    </div>
    <div style={{position: 'absolute', left: 0, right: 0, top: 832, display: 'flex', justifyContent: 'center'}}>
      <Glyphs text="Moru · 예시 일기예보" frame={frame} at={72} size={44} color={ink} family={ui} />
    </div>
  </AbsoluteFill>;
}

function IconDraw({frame, at, Icon}: {frame: number; at: number; Icon: typeof Sun}) {
  const draw = span(frame, at, 20);
  return <Icon size={88} strokeWidth={2.5} color={ink} strokeDasharray={220} strokeDashoffset={220 * (1 - draw)} />;
}

function Forecast({frame}: {frame: number}) {
  const entering = frame < 240;
  return <AbsoluteFill style={{background: 'transparent', overflow: 'hidden'}}>
    <div style={{position: 'absolute', left: 0, right: 0, top: 92, display: 'flex', justifyContent: 'center'}}><Glyphs text="시간대별 기온" frame={frame} at={96} size={64} color={ink} family={headline} /></div>
    {slots.map(({label, temp, icon: Icon}, index) => {
      const x = xs[index];
      const inT = pop(frame, 96 + index * 7, 22, true);
      const outT = span(frame, 246 + index * 3, 34);
      const y = entering ? interpolate(inT, [0, 1], [1180, 260]) : interpolate(outT, [0, 1], [260, 1250]);
      const bar = span(frame, 124 + index * 7, 28);
      const h = barHeights[index] * bar;
      return <div key={label} style={{position: 'absolute', left: x - 145, top: y, width: 290, height: 600, display: 'flex', alignItems: 'center', flexDirection: 'column', transform: `rotate(${(1 - inT) * (index % 2 ? 3 : -3)}deg)`}}>
        <div style={{height: 120, display: 'flex', alignItems: 'center'}}><IconDraw frame={frame} at={136 + index * 6} Icon={Icon} /></div>
        <Glyphs text={label} frame={frame} at={126 + index * 5} size={52} color={ink} family={ui} />
        <div style={{marginTop: 30, width: 86, height: 260, border: `6px solid ${ink}`, display: 'flex', alignItems: 'flex-end', padding: 7, boxSizing: 'border-box'}}><div style={{width: '100%', height: h, background: accent}} /></div>
        <div style={{marginTop: 18}}><Glyphs text={`${temp}° · 예시`} frame={frame} at={144 + index * 5} size={36} color={ink} family={ui} /></div>
      </div>;
    })}
  </AbsoluteFill>;
}

function Curve({frame}: {frame: number}) {
  const connect = span(frame, 236, 36);
  const exit = span(frame, 246, 34);
  const points = xs.map((x, i) => `${x},${760 - barHeights[i] * connect}`).join(' ');
  return <AbsoluteFill style={{background: day, overflow: 'hidden'}}>
    <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, transform: `translateY(${exit * 34}px)`}}>
      <polyline points={points} fill="none" stroke={accent} strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - connect} />
      {xs.map((x, i) => <circle key={x} cx={x} cy={760 - barHeights[i] * connect} r="18" fill={accent} />)}
    </svg>
    <div style={{position: 'absolute', left: 0, right: 0, top: 145, display: 'flex', justifyContent: 'center', transform: `translateY(${(1 - connect) * 40}px)`}}><Glyphs text="시간대별 기온" frame={frame} at={242} size={64} color={ink} family={headline} /></div>
    {frame < 330 ? <div style={{position: 'absolute', left: 0, right: 0, top: 824, display: 'flex', justifyContent: 'center', transform: `translateY(${(1 - exit) * 40}px)`}}><Glyphs text="예시 데이터" frame={frame} at={260} size={36} color={ink} family={ui} /></div> : null}
  </AbsoluteFill>;
}

function Advice({frame}: {frame: number}) {
  const rise = pop(frame, 326, 20, true);
  return <AbsoluteFill style={{background: day, overflow: 'hidden'}}>
    <div style={{position: 'absolute', left: 420, right: 420, top: 575, height: 18, background: accent, transform: `scaleX(${rise})`, transformOrigin: 'left center'}} />
    <div style={{position: 'absolute', left: 0, right: 0, top: 375, display: 'flex', justifyContent: 'center', transform: `translateY(${(1 - rise) * 180}px)`}}><Glyphs text="우산은 저녁에" frame={frame} at={332} size={132} color={ink} family={headline} /></div>
    <div style={{position: 'absolute', left: 0, right: 0, top: 642, display: 'flex', justifyContent: 'center'}}><Glyphs text="Moru · 예시" frame={frame} at={348} size={44} color={ink} family={ui} /></div>
  </AbsoluteFill>;
}

export function Spot() {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{background: day, overflow: 'hidden'}}>
    <Audio src="/audio/generated/weather-brief/music.wav" volume={0.9} />
    <Sequence from={136} durationInFrames={30} layout="none"><Audio src="/audio/generated/weather-brief/pop.wav" volume={0.8} /></Sequence>
    <Sequence from={142} durationInFrames={30} layout="none"><Audio src="/audio/generated/weather-brief/pop.wav" volume={0.8} /></Sequence>
    <Sequence from={148} durationInFrames={30} layout="none"><Audio src="/audio/generated/weather-brief/pop.wav" volume={0.8} /></Sequence>
    <Sequence from={154} durationInFrames={30} layout="none"><Audio src="/audio/generated/weather-brief/pop.wav" volume={0.8} /></Sequence>
    <Sequence from={258} durationInFrames={30} layout="none"><Audio src="/audio/generated/weather-brief/whoosh.wav" volume={0.8} /></Sequence>
    <Sequence from={338} durationInFrames={30} layout="none"><Audio src="/audio/generated/weather-brief/ding.wav" volume={0.8} /></Sequence>
    {frame < 112 ? <Hero frame={frame} /> : null}
    {frame >= 72 && frame < 240 ? <Forecast frame={frame} /> : null}
    {frame >= 220 && frame < 330 ? <Curve frame={frame} /> : null}
    {frame >= 330 ? <Advice frame={frame} /> : null}
  </AbsoluteFill>;
}
