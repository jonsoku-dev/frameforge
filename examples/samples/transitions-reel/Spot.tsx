import type {CSSProperties, ReactNode} from 'react';
import type {TransitionTiming} from '@/packages/transitions';
import {AbsoluteFill, Audio, Easing, MotionProbe, MotionSound, googleFont, interpolate, spring, useCurrentFrame} from 'frameforge';
import {TransitionSeries, clockWipe, fade, iris, linearTiming, slide, springTiming, wipe} from '@/packages/transitions';
import {Bridge, Tower, Volcano, type Asset} from './assets';

const FPS = 30;
const display = googleFont('Gowun Batang', {weights: [700], fallback: 'serif'});
const ui = googleFont('Noto Sans KR', {weights: [500], fallback: 'sans-serif'});
const ink = '#0F172A';
const paper = '#F8FAFC';
const accent = '#F43F5E';
const soft = '#FFE4E6';
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} satisfies {extrapolateLeft: 'clamp'; extrapolateRight: 'clamp'};
const center: CSSProperties = {display: 'flex', alignItems: 'center', justifyContent: 'center'};

// Scene starts and lengths in frames; each transition starts on a bar line (60 frames = 1 bar at 120 BPM).
const TIMING = {
  fade: linearTiming({durationInFrames: 16}),
  slide: springTiming({durationInFrames: 18}),
  wipe: linearTiming({durationInFrames: 20}),
  clock: springTiming({durationInFrames: 16}),
  iris: springTiming({durationInFrames: 20}),
};
const AT = {seoul: 120, busan: 240, jeju: 360, name: 480};

function span(frame: number, from: number, dur: number): number {
  return interpolate(frame, [from, from + dur], [0, 1], {...clamp, easing: ease});
}

function pop(frame: number, at: number, dur: number): number {
  return spring({frame, fps: FPS, delay: at, durationInFrames: dur});
}

// Progress of a transition that starts at global frame `at`, computed from its own timing.
function progressAt(timing: TransitionTiming, frame: number, at: number): number {
  return timing.getProgress({frame: Math.max(0, frame - at), fps: FPS});
}

function Glyphs({text, frame, at, size, color, stagger = 2}: {text: string; frame: number; at: number; size: number; color: string; stagger?: number}) {
  return <span style={{display: 'flex', color, fontFamily: display, fontSize: size, lineHeight: 1, letterSpacing: '-0.02em'}}>
    {Array.from(text).map((glyph, index) => {
      const rise = span(frame, at + index * stagger, 12);
      return <span key={index} style={{display: 'inline-block', overflow: 'hidden', height: '1.3em', paddingTop: '0.15em', marginTop: '-0.15em', paddingInline: '0.08em', marginInline: '-0.08em'}}>
        <span style={{display: 'inline-block', transform: `translateY(${(1 - rise) * 120}%)`, visibility: rise === 0 ? 'hidden' : 'visible'}}>{glyph === ' ' ? ' ' : glyph}</span>
      </span>;
    })}
  </span>;
}

function Title({frame}: {frame: number}) {
  const bar = span(frame, 60, 18);
  return <AbsoluteFill style={{background: ink, ...center, flexDirection: 'column', gap: 48}}>
    <Glyphs text="하루길" frame={frame} at={14} size={260} color={paper} stagger={4} />
    <div style={{width: 720, height: 20, background: accent, transform: `scaleX(${bar})`}} />
    <div style={{fontFamily: ui, fontWeight: 500, fontSize: 56, color: soft, opacity: span(frame, 74, 20)}}>네 도시, 하루 한 장의 여행</div>
  </AbsoluteFill>;
}

type CityProps = {
  frame: number;
  probe: string;
  name: string;
  label: string;
  figure: string;
  bg: string;
  fg: string;
  sun: string;
  pill: {bg: string; fg: string};
  Landmark: Asset;
  fill: string;
  shade: string;
};

function City({frame, probe, name, label, figure, bg, fg, sun, pill, Landmark, fill, shade}: CityProps) {
  const s = pop(frame, 8, 24);
  return <AbsoluteFill style={{background: bg, overflow: 'hidden'}}>
    <div style={{position: 'absolute', left: 1030, top: 170, width: 760, height: 760, borderRadius: '50%', background: sun}} />
    <MotionProbe id={probe} value={s} family="shape" axis="scale" />
    <Landmark size={840} color={fg} fill={fill} shade={shade} style={{position: 'absolute', left: 1000, top: 120, transform: `scale(${s})`, transformOrigin: '50% 100%'}} />
    <div style={{position: 'absolute', left: 128, top: 470}}>
      <Glyphs text={name} frame={frame} at={6} size={200} color={fg} stagger={3} />
    </div>
    <div style={{position: 'absolute', left: 128, top: 760, padding: '18px 40px', borderRadius: 999, background: pill.bg, color: pill.fg, fontFamily: ui, fontWeight: 500, fontSize: 52, opacity: span(frame, 30, 16)}}>
      {`${label} ${figure} · 예시`}
    </div>
  </AbsoluteFill>;
}

function Name({frame}: {frame: number}) {
  const bar = span(frame, 40, 20);
  return <AbsoluteFill style={{background: ink, ...center, flexDirection: 'column', gap: 48}}>
    <Glyphs text="하루길" frame={frame} at={14} size={320} color={paper} stagger={4} />
    <div style={{width: 800, height: 20, background: accent, transform: `scaleX(${bar})`}} />
    <div style={{fontFamily: ui, fontWeight: 500, fontSize: 56, color: soft, opacity: span(frame, 60, 20)}}>네 도시를 잇는 하루 여행 · 가상 브랜드</div>
  </AbsoluteFill>;
}

export function TransitionsReel() {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{background: ink, overflow: 'hidden'}}>
    <Audio src="/audio/generated/transitions-reel/music.wav" volume={0.9} />
    <MotionSound src="/audio/generated/transitions-reel/pop.wav" role="land" families={['shape']} quiet={[120, 480]} />
    <MotionSound src="/audio/generated/transitions-reel/whoosh.wav" role="move" families={['wipe']} quiet={[120, 480]} />
    <MotionProbe id="fade" value={progressAt(TIMING.fade, frame, 0)} family="wipe" axis="progress" />
    <MotionProbe id="slide" value={progressAt(TIMING.slide, frame, AT.seoul)} family="wipe" axis="progress" />
    <MotionProbe id="wipe" value={progressAt(TIMING.wipe, frame, AT.busan)} family="wipe" axis="progress" />
    <MotionProbe id="clock" value={progressAt(TIMING.clock, frame, AT.jeju)} family="wipe" axis="progress" />
    <MotionProbe id="iris" value={progressAt(TIMING.iris, frame, AT.name)} family="wipe" axis="progress" />
    <TransitionSeries>
      <TransitionSeries.Transition timing={TIMING.fade} presentation={fade()} />
      <TransitionSeries.Sequence durationInFrames={138}><Title frame={frame} /></TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={TIMING.slide} presentation={slide({direction: 'from-right'})} />
      <TransitionSeries.Sequence durationInFrames={140}>
        <City frame={frame - AT.seoul} probe="seoul-tower" name="서울" label="기온" figure="24℃" bg={paper} fg={ink} sun={soft} pill={{bg: accent, fg: paper}} Landmark={Tower} fill={accent} shade={soft} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={TIMING.wipe} presentation={wipe({direction: 'from-top-left'})} />
      <TransitionSeries.Sequence durationInFrames={136}>
        <City frame={frame - AT.busan} probe="busan-bridge" name="부산" label="거리" figure="4.2km" bg={ink} fg={paper} sun={accent} pill={{bg: soft, fg: ink}} Landmark={Bridge} fill={soft} shade={soft} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={TIMING.clock} presentation={clockWipe({width: 1920, height: 1080})} />
      <TransitionSeries.Sequence durationInFrames={140}>
        <City frame={frame - AT.jeju} probe="jeju-mount" name="제주" label="기온" figure="19℃" bg={accent} fg={ink} sun={soft} pill={{bg: ink, fg: paper}} Landmark={Volcano} fill={soft} shade={accent} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition timing={TIMING.iris} presentation={iris({width: 1920, height: 1080})} />
      <TransitionSeries.Sequence durationInFrames={120}><Name frame={frame - AT.name} /></TransitionSeries.Sequence>
    </TransitionSeries>
  </AbsoluteFill>;
}
