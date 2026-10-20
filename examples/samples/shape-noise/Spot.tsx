import type {CSSProperties, ReactNode} from 'react';
import {AbsoluteFill, Audio, Easing, MotionProbe, MotionSound, Trail, googleFont, interpolate, noise3D, random, spring, useCurrentFrame} from 'frameforge';
import {Gem, STROKE} from './assets';

const display = googleFont('Do Hyeon', {weights: [400], fallback: 'sans-serif'});
const ui = googleFont('IBM Plex Sans KR', {weights: [500], fallback: 'sans-serif'});
const ink = '#111111';
const paper = '#F5F5F4';
const accent = '#8B5CF6';
const soft = '#DDD6FE';
const W = 1920;
const H = 1080;
const R = 470;
const HEADLINE = 180;
const LABEL = 46;
const MARK_R = 60;
const FIELD_R = 30;
const STREAK = 0.3;
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} satisfies {extrapolateLeft: 'clamp'; extrapolateRight: 'clamp'};
const center: CSSProperties = {display: 'flex', alignItems: 'center', justifyContent: 'center'};
// Scene starts in frames; the last 60 frames are the still hold.
const AT = {field: 118, morph: 120, wipeIn: 292, launch: 326, land: 420, wipeOut: 436, mark: 440, name: 450, tagline: 500};

const dots = Array.from({length: 44}, (_, i) => ({x: random(`x${i}`) * W, y: random(`y${i}`) * H, s: 0.8 + 0.4 * random(`s${i}`)}));

function span(frame: number, from: number, dur: number): number {
  return interpolate(frame, [from, from + dur], [0, 1], {...clamp, easing: ease});
}

function pop(frame: number, at: number, dur: number): number {
  return spring({frame, fps: 30, delay: at, durationInFrames: dur});
}

/** Camera push and return around one beat: scale rises to 1 + amount at the midpoint and comes back. */
function push(frame: number, at: number, dur: number, amount: number): number {
  const t = interpolate(frame, [at, at + dur], [0, 1], clamp);
  return 1 + amount * Math.sin(t * Math.PI);
}

const streakX = (frame: number) => interpolate(frame, [AT.launch, AT.land], [W / 2, W + 300], {...clamp, easing: Easing.bezier(0.7, 0, 0.84, 0)});

function Glyphs({text, frame, at, size, color, stagger = 2}: {text: string; frame: number; at: number; size: number; color: string; stagger?: number}) {
  return <span style={{display: 'flex', color, fontFamily: display, fontSize: size, lineHeight: 1, letterSpacing: '-0.02em'}}>
    {Array.from(text).map((glyph, index) => {
      const rise = span(frame, at + index * stagger, 12);
      // Do Hyeon ink reaches above the 1em line box; the mask grows upward without moving the glyph.
      return <span key={index} style={{display: 'inline-block', overflow: 'hidden', height: '1.3em', paddingTop: '0.15em', marginTop: '-0.15em', paddingInline: '0.08em', marginInline: '-0.08em'}}>
        <span style={{display: 'inline-block', transform: `translateY(${(1 - rise) * 120}%)`, visibility: rise === 0 ? 'hidden' : 'visible'}}>{glyph === ' ' ? ' ' : glyph}</span>
      </span>;
    })}
  </span>;
}

/** The star draws in and spins, then becomes the hexagon, then shrinks to the streak's size and leaves the scene. */
function Hero({frame}: {frame: number}) {
  const scale = pop(frame, 0, 24) * (frame < AT.launch ? 1 - (1 - STREAK) * span(frame, AT.wipeIn, 34) : 0);
  // A full turn: the gem's shading is lit from the top, so it must come to rest where it started.
  const turn = 360 * span(frame, 0, 210);
  return <>
    <MotionProbe id="hero" value={scale} family="shape" axis="scale" />
    <Gem size={2 * R} morph={span(frame, AT.morph, 90)} draw={span(frame, 0, 40)} fill={span(frame, 26, 24)} color={paper} style={{position: 'absolute', left: W / 2 - R, top: H / 2 - R, transform: `scale(${scale}) rotate(${turn}deg)`}} />
  </>;
}

/** Noise field of 44 small gems drifting on noise3D; each one is a pure function of the frame. They do not spin: the gem is lit from the top. */
function Field({frame}: {frame: number}) {
  const out = 1 - span(frame, 430, 16);
  return <>
    {dots.map((dot, i) => {
      const appear = span(frame, AT.field + (i % 11) * 4, 16) * out;
      const x = dot.x + 200 * noise3D('field-x', i, 0, frame / 120);
      const y = dot.y + 200 * noise3D('field-y', i, 0, frame / 120);
      return <Gem key={i} size={2 * FIELD_R} fill={appear} style={{position: 'absolute', left: x - FIELD_R, top: y - FIELD_R, transform: `scale(${dot.s * appear})`}} />;
    })}
  </>;
}

/** Trail re-renders this child under a frozen frame, so the streak reads its own frame instead of taking a prop. */
function Streak() {
  const frame = useCurrentFrame();
  if (frame < AT.launch) return null;
  return <Gem size={2 * R * STREAK} color={ink} style={{position: 'absolute', left: streakX(frame) - R * STREAK, top: H / 2 - R * STREAK}} />;
}

function Mark({frame}: {frame: number}) {
  return <Gem size={2 * MARK_R} draw={span(frame, AT.mark, 30)} fill={span(frame, AT.mark + 22, 10)} color={paper} style={{position: 'absolute', left: W / 2 - MARK_R, top: 250}} />;
}

function Name({frame}: {frame: number}) {
  return <div style={{position: 'absolute', left: 0, right: 0, top: 470, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40}}>
    <MotionProbe id="lockup" value={span(frame, 462, 24)} family="text" axis="progress" />
    <Glyphs text="모양결 스튜디오" frame={frame} at={AT.name + 12} size={HEADLINE} color={paper} />
    <div style={{width: W * 0.3, height: STROKE, background: accent, transform: `scaleX(${span(frame, 486, 16)})`}} />
    <div style={{fontFamily: ui, fontWeight: 500, fontSize: LABEL, color: soft, opacity: span(frame, AT.tagline, 20)}}>움직임으로 모양을 그리는 가상의 디자인 스튜디오</div>
  </div>;
}

export function ShapeNoise() {
  const frame = useCurrentFrame();
  // Two camera pushes at most: the streak and the name.
  const camera = push(frame, 296, 130, 0.05) * push(frame, AT.name, 30, 0.03);
  const paperWipe = span(frame, AT.wipeIn, 18);
  const inkWipe = span(frame, AT.wipeOut, 16);
  return <AbsoluteFill style={{background: ink, overflow: 'hidden'}}>
    <Audio src="/audio/generated/shape-noise/music.wav" volume={0.9} />
    {/* Effects come from the probes; quiet lists the music hits (frames 4 s and 15 s) so the music plays them. */}
    <MotionSound src="/audio/generated/shape-noise/whoosh.wav" role="move" families={['card', 'wipe']} quiet={[AT.morph, AT.name]} />
    <MotionSound src="/audio/generated/shape-noise/impact.wav" role="land" families={['shape', 'text']} quiet={[AT.morph, AT.name]} />
    <MotionProbe id="streak" value={streakX(frame)} family="card" axis="x" />
    <MotionProbe id="paper" value={paperWipe} family="wipe" axis="progress" />
    <AbsoluteFill style={{transform: `scale(${camera})`}}>
      {frame >= AT.wipeIn ? <AbsoluteFill style={{background: paper, clipPath: `inset(0 ${(1 - paperWipe) * 100}% 0 0)`}} /> : null}
      {frame >= AT.field ? <Field frame={frame} /> : null}
      <Hero frame={frame} />
      <Trail layers={6} lagInFrames={3} trailOpacity={0.5}><Streak /></Trail>
      {frame >= AT.wipeOut ? <AbsoluteFill style={{background: ink, clipPath: `inset(0 ${(1 - inkWipe) * 100}% 0 0)`}} /> : null}
      {frame >= AT.mark ? <Mark frame={frame} /> : null}
      {frame >= AT.mark ? <Name frame={frame} /> : null}
    </AbsoluteFill>
  </AbsoluteFill>;
}
