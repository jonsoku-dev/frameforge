import type {ReactNode} from 'react';
import {AbsoluteFill, Audio, Easing, Sequence, googleFont, interpolate, spring, useCurrentFrame} from 'frameforge';
import {Egg, Milk, Wheat, Check} from 'lucide-react';

const headline = googleFont('Jua', {weights: [400], fallback: 'sans-serif'});
const ui = googleFont('Noto Sans KR', {weights: [500], fallback: 'sans-serif'});
const cream = '#FFF4E6';
const ink = '#2B1B12';
const accent = '#E8590C';
const soft = '#FFD8B5';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} satisfies {
  extrapolateLeft: 'clamp';
  extrapolateRight: 'clamp';
};
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const ingredients = [
  {name: '달걀', Icon: Egg, at: 20, y: 560},
  {name: '우유', Icon: Milk, at: 42, y: 850},
  {name: '밀가루', Icon: Wheat, at: 64, y: 1140},
] as const;

function span(frame: number, from: number, duration: number): number {
  return interpolate(frame, [from, from + duration], [0, 1], {...clamp, easing: ease});
}

function pop(frame: number, at: number, duration: number): number {
  return spring({frame, fps: 30, delay: at, durationInFrames: duration, config: {overshootClamping: false}});
}

function Glyphs({text, frame, at, size, color, family, stagger = 2}: {text: string; frame: number; at: number; size: number; color: string; family: string; stagger?: number}) {
  return <span style={{display: 'flex', fontFamily: family, fontSize: size, fontWeight: family === headline ? 400 : 500, lineHeight: 1.15, color, letterSpacing: '-0.02em'}}>
    {Array.from(text).map((glyph, index) => {
      const rise = span(frame, at + index * stagger, 12);
      return <span key={`${glyph}${index}`} style={{display: 'inline-block', overflow: 'hidden', height: '1.3em', paddingTop: '0.1em', paddingBottom: '0.12em', marginTop: '-0.1em', marginBottom: '-0.12em', paddingInline: '0.06em', marginInline: '-0.06em'}}>
        <span style={{display: 'inline-block', transform: `translateY(${(1 - rise) * 140}%)`, visibility: rise > 0 ? 'visible' : 'hidden'}}>{glyph === ' ' ? ' ' : glyph}</span>
      </span>;
    })}
  </span>;
}

function CenterLine({top, children}: {top: number; children: ReactNode}) {
  return <div style={{position: 'absolute', top, left: 0, right: 0, display: 'flex', justifyContent: 'center'}}>{children}</div>;
}

function IngredientScene({frame}: {frame: number}) {
  return <AbsoluteFill style={{background: cream}}>
    <CenterLine top={250}><Glyphs text="오늘의 한 접시" frame={frame} at={4} size={76} color={ink} family={headline} /></CenterLine>
    <div style={{position: 'absolute', left: 112, top: 435, width: 856, height: 1050, borderRadius: 46, background: soft, transform: `translateY(${span(frame, 0, 16) * 0}px)`}} />
    {ingredients.map(({name, Icon, at, y}, index) => {
      const land = pop(frame, at, 18);
      const step = span(frame, 120, 20);
      const startX = 540 + (index - 1) * 208;
      const x = interpolate(step, [0, 1], [startX, 540 + (index - 1) * 140]);
      const targetY = 925 + (index - 1) * 62;
      const top = interpolate(step, [0, 1], [y, targetY]);
      const scale = interpolate(land, [0, 1], [0.5, 1]) * (1 - 0.3 * step);
      return <div key={name} style={{position: 'absolute', left: x - 180, top: interpolate(land, [0, 1], [y - 420, top]), width: 360, height: 220, borderRadius: 34, background: cream, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 28, transform: `scale(${scale})`, boxShadow: `0 16px 0 ${accent}22`}}>
        <Icon size={92} strokeWidth={2.4} color={accent} />
        <span style={{fontFamily: ui, fontSize: 52, fontWeight: 500, color: ink}}>{name}</span>
      </div>;
    })}
    {[20, 42, 64].map(at => <Sequence key={at} from={at} durationInFrames={30} layout="none"><Audio src="/audio/generated/recipe-steps/pop.wav" volume={0.8} /></Sequence>)}
  </AbsoluteFill>;
}

function StepHeader({frame, number, title}: {frame: number; number: string; title: string}) {
  return <>
    <CenterLine top={262}><span style={{fontFamily: ui, color: accent, fontSize: 42, fontWeight: 500, letterSpacing: '0.12em'}}>STEP {number}</span></CenterLine>
    <CenterLine top={330}><Glyphs text={title} frame={frame} at={132} size={124} color={ink} family={headline} stagger={0} /></CenterLine>
  </>;
}

function MixingScene({frame}: {frame: number}) {
  const entrance = pop(frame, 120, 24);
  const bowl = interpolate(entrance, [0, 1], [40, 600]);
  const ingredientsIn = span(frame, 138, 42);
  return <AbsoluteFill style={{background: cream}}>
    <AbsoluteFill style={{background: soft, clipPath: `inset(0 0 ${100 - entrance * 100}% 0)`, transform: `translateY(${(1 - entrance) * 1680}px)`}} />
    <StepHeader frame={frame} number="01" title="섞는다" />
    <div style={{position: 'absolute', left: 540 - bowl / 2, top: 900 - bowl / 2, width: bowl, height: bowl, borderRadius: '50%', border: `20px solid ${ink}`, background: cream, boxSizing: 'border-box'}} />
    {ingredients.map(({Icon}, index) => {
      const x0 = 540 + (index - 1) * 208;
      const y0 = ingredients[index].y + 110;
      const x = interpolate(ingredientsIn, [0, 1], [x0, 540 + (index - 1) * 120]);
      const y = interpolate(ingredientsIn, [0, 1], [y0, 900 + (index - 1) * 40]);
      const scale = interpolate(ingredientsIn, [0, 1], [0.78, 1]);
      return <div key={index} style={{position: 'absolute', left: x - 48, top: y - 48, transform: `scale(${scale})`}}><Icon size={96} strokeWidth={2.4} color={accent} /></div>;
    })}
    <div style={{position: 'absolute', left: 220, right: 220, top: 1370, height: 14, borderRadius: 8, background: accent, transform: `scaleX(${span(frame, 150, 28)})`, transformOrigin: 'left'}} />
  </AbsoluteFill>;
}

function BakingScene({frame}: {frame: number}) {
  const progress = interpolate(frame, [270, 419], [0, 1], clamp);
  const circumference = 2 * Math.PI * 260;
  const remaining = Math.max(1, 5 - Math.floor(progress * 5));
  return <AbsoluteFill style={{background: cream}}>
    <StepHeader frame={frame} number="02" title="굽는다" />
    <div style={{position: 'absolute', left: 120, top: 560, width: 840, height: 960, borderRadius: 60, background: soft}} />
    <svg style={{position: 'absolute', left: 280, top: 665}} width="520" height="520" viewBox="0 0 520 520" aria-label="예시 타이머 진행 링">
      <circle cx="260" cy="260" r="260" fill="none" stroke={cream} strokeWidth="26" />
      <circle cx="260" cy="260" r="260" fill="none" stroke={accent} strokeWidth="26" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)} transform="rotate(-90 260 260)" />
    </svg>
    <CenterLine top={828}><span style={{fontFamily: ui, fontSize: 42, color: accent, fontWeight: 500}}>예시</span></CenterLine>
    <CenterLine top={900}><span style={{fontFamily: headline, fontSize: 170, color: ink, lineHeight: 1}}>{remaining}</span></CenterLine>
    <CenterLine top={1260}><span style={{fontFamily: ui, fontSize: 46, color: ink, fontWeight: 500}}>타이머 예시</span></CenterLine>
    <Sequence from={419} durationInFrames={30} layout="none"><Audio src="/audio/generated/recipe-steps/click.wav" volume={0.8} /></Sequence>
  </AbsoluteFill>;
}

function PlateScene({frame}: {frame: number}) {
  const grow = pop(frame, 420, 26);
  const diameter = interpolate(grow, [0, 1], [520, 720]);
  const check = pop(frame, 444, 20);
  return <AbsoluteFill style={{background: cream}}>
    <StepHeader frame={frame} number="03" title="담는다" />
    <div style={{position: 'absolute', left: 540 - diameter / 2, top: 925 - diameter / 2, width: diameter, height: diameter, borderRadius: '50%', background: soft, boxShadow: `inset 0 0 0 ${interpolate(grow, [0, 1], [18, 24])}px ${cream}, inset 0 0 0 ${interpolate(grow, [0, 1], [32, 40])}px ${accent}`}} />
    <div style={{position: 'absolute', left: 476, top: 861, transform: `scale(${check}) rotate(${(1 - check) * -24}deg)`}}><Check size={128} strokeWidth={2.5} color={ink} /></div>
    <Sequence from={444} durationInFrames={30} layout="none"><Audio src="/audio/generated/recipe-steps/ding.wav" volume={0.8} /></Sequence>
  </AbsoluteFill>;
}

function EndCard({frame}: {frame: number}) {
  const rise = pop(frame, 510, 24);
  const stable = frame >= 540;
  const transform = `translateY(${stable ? 0 : (1 - rise) * 120}px)`;
  return <AbsoluteFill style={{background: cream}}>
    <div style={{position: 'absolute', left: 112, top: 690, width: 856, height: 540, borderRadius: 52, background: soft}} />
    <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 36, transform}}>
      <Glyphs text="포근담" frame={frame} at={510} size={160} color={ink} family={headline} stagger={3} />
      <div style={{width: 190, height: 12, borderRadius: 8, background: accent}} />
      <Glyphs text="한 접시, 세 번의 손길" frame={frame} at={520} size={52} color={ink} family={ui} stagger={1} />
    </div>
  </AbsoluteFill>;
}

export function Spot() {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{background: cream, overflow: 'hidden', fontFamily: ui}}>
    <Audio src="/audio/generated/recipe-steps/music.wav" volume={0.9} />
    {frame < 150 ? <IngredientScene frame={frame} /> : null}
    {frame >= 120 && frame < 270 ? <MixingScene frame={frame} /> : null}
    {frame >= 270 && frame < 420 ? <BakingScene frame={frame} /> : null}
    {frame >= 420 && frame < 510 ? <PlateScene frame={frame} /> : null}
    {frame >= 510 ? <EndCard frame={frame} /> : null}
  </AbsoluteFill>;
}
