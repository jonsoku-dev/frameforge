import type {CSSProperties, ReactNode} from 'react';
import {AbsoluteFill, Audio, Easing, Encircle, Generative, Highlight, MotionProbe, MotionSound, Sequence, Solid, Underline, aurora, googleFont, grainEffect, interpolate, lightLeakEffect, spring, useCurrentFrame, vignetteEffect} from 'frameforge';
import {Wave} from '@/assets';

// 물결 스튜디오 (fictional) ident: an aurora that evolves for the whole film, a flow field the wave turns into, a light-leak seam, a grained final card.
const W = 1920;
const H = 1080;
const S = Math.min(W, H);
const SIZES = {headline: S * 0.1, label: S * 0.035, icon: S * 0.06, hero: S * 0.35, marginX: W * 0.05, marginY: H * 0.05};
const display = googleFont('Gothic A1', {weights: [900], fallback: 'sans-serif'});
const ui = googleFont('Noto Sans KR', {weights: [500], fallback: 'sans-serif'});
const ink = '#0B1020';
const paper = '#F3F0E8';
const accent = '#FF7A59';
const soft = '#7FB8FF';
const palette = {ink, paper, accent, soft};
const STROKE = 16;
const RADIUS = 8;
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} satisfies {extrapolateLeft: 'clamp'; extrapolateRight: 'clamp'};
const center: CSSProperties = {display: 'flex', alignItems: 'center', justifyContent: 'center'};
// Absolute scene starts; the last 60 frames are the still hold.
const AT = {open: 0, flow: 120, seam: 240, statement: 246, name: 390, hold: 480, end: 540};

/** Studio tune tab: the aurora's seed and two of its parameters, taken from the system's own schema so the ranges stay in one place. */
export const variables = [
  {key: 'auroraSeed', type: 'string', label: '오로라 시드', default: 'mulgyeol', maxLength: 24, group: '배경', help: '같은 시드는 같은 그림을 그립니다'},
  ...aurora.schema.filter(entry => entry.key === 'bands' || entry.key === 'speed').map(entry => ({...entry, key: `aurora${entry.key[0]!.toUpperCase()}${entry.key.slice(1)}`, label: `오로라 ${entry.label}`, group: '배경'})),
];
export type GenerativeIdentProps = {auroraSeed?: string; auroraBands?: number; auroraSpeed?: number};

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

function Glyphs({text, frame, at, size = SIZES.headline, color = ink, stagger = 2}: {text: string; frame: number; at: number; size?: number; color?: string; stagger?: number}) {
  return <span style={{display: 'flex', color, fontFamily: display, fontSize: size, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.04em'}}>
    {Array.from(text).map((glyph, index) => {
      const rise = span(frame, at + index * stagger, 12);
      // Gothic A1 ink rises above the 1em line box, so the mask grows upward without moving the glyph.
      return <span key={index} style={{display: 'inline-block', overflow: 'hidden', height: '1.15em', paddingTop: '0.1em', marginTop: '-0.1em', paddingInline: '0.06em', marginInline: '-0.06em'}}>
        <span style={{display: 'inline-block', transform: `translateY(${(1 - rise) * 120}%)`, visibility: rise === 0 ? 'hidden' : 'visible'}}>{glyph === ' ' ? ' ' : glyph}</span>
      </span>;
    })}
  </span>;
}

function Line({children}: {children: ReactNode}) {
  return <span style={{display: 'flex', alignItems: 'baseline'}}>{children}</span>;
}

/** The aurora runs under the open and the flow; its seed and two parameters are the film's tunable variables. */
function Sky({bands, speed, seed}: {bands: number; speed: number; seed: string}) {
  return <Generative system="aurora" seed={seed} width={W} height={H} fit="fill" palette={palette} params={{bands, speed, height: 0.2, amplitude: 0.08, scale: 1.1}} style={{position: 'absolute', left: 0, top: 0}} />;
}

/** The wave enters at the centre, then shrinks into the top-left mark as the flow scene starts. */
function Hero({frame}: {frame: number}) {
  const enter = pop(frame, AT.open, 26);
  const shrink = span(frame, AT.flow, 30);
  const size = SIZES.hero * 1.35 * (1 - shrink) + SIZES.icon * 2.6 * shrink;
  const left = (W - SIZES.hero * 1.35) / 2 * (1 - shrink) + SIZES.marginX * shrink;
  const top = (H - SIZES.hero * 1.35) / 2 * (1 - shrink) + SIZES.marginY * shrink;
  return <>
    <MotionProbe id="hero-enter" value={enter * SIZES.hero} family="shape" axis="scale" />
    <MotionProbe id="hero-shrink" value={shrink * W} family="card" axis="x" />
    <div style={{position: 'absolute', left, top, width: size, height: size, transform: `scale(${enter})`, visibility: enter === 0 ? 'hidden' : 'visible'}}>
      <Wave size={size} ink={paper} accent={accent} soft={soft} paper={paper} stroke={STROKE * size / (SIZES.hero * 1.35)} radius={RADIUS} draw={span(frame, AT.open + 8, 50)} />
    </div>
    {frame < AT.flow ? <div style={{position: 'absolute', left: 0, right: 0, top: (H + SIZES.hero * 1.35) / 2 + S * 0.03, ...center, fontFamily: ui, fontWeight: 500, fontSize: SIZES.label * 1.3, color: soft, opacity: span(frame, AT.open + 66, 14) * (1 - span(frame, AT.flow - 12, 12))}}>흐름을 그리는 스튜디오 · 가상 브랜드</div> : null}
  </>;
}

function Flow({frame}: {frame: number}) {
  const highlight = span(frame, AT.flow + 72, 22);
  return <>
    <Sequence from={AT.flow} durationInFrames={AT.statement - AT.flow} layout="none">
      <Generative system="flowField" seed="mulgyeol-flow" width={W} height={H} fit="fill" palette={{...palette, accent: soft}} params={{lines: 130, steps: 110, stepLength: 0.005, scale: 2.2, grow: 3.2, strokeWidth: 0.0022}} style={{position: 'absolute', left: 0, top: 0, opacity: 0.75}} />
    </Sequence>
    <MotionProbe id="highlight" value={highlight} family="text" axis="progress" />
    <div style={{position: 'absolute', left: SIZES.marginX, top: H * 0.36, display: 'flex', flexDirection: 'column', gap: S * 0.025}}>
      <Glyphs text="흐름은" frame={frame} at={AT.flow + 30} color={paper} />
      <Line>
        <Highlight progress={highlight} color={accent} seed="form" roughness={0.5} strokeWidth={70}><Glyphs text="형태" frame={frame} at={AT.flow + 44} color={paper} /></Highlight>
        <Glyphs text="가 된다" frame={frame} at={AT.flow + 48} color={paper} />
      </Line>
    </div>
  </>;
}

function Statement({frame}: {frame: number}) {
  const wipe = span(frame, AT.seam, 18);
  const underline = span(frame, AT.statement + 18, 16);
  const circle = span(frame, AT.statement + 34, 26);
  const parts = 1 + Math.floor(span(frame, AT.statement + 4, 44) * 3.999);
  const rise = pop(frame, AT.seam, 22, true);
  const size = SIZES.hero * 1.3;
  return <AbsoluteFill style={{background: paper, clipPath: `inset(0 ${(1 - wipe) * 100}% 0 0)`}}>
    <MotionProbe id="paper-wipe" value={wipe} family="wipe" axis="progress" />
    <MotionProbe id="circle" value={circle} family="text" axis="progress" />
    <MotionProbe id="wave-rise" value={(1 - rise) * H} family="card" axis="y" />
    <div style={{position: 'absolute', left: SIZES.marginX, top: H * 0.3, display: 'flex', flexDirection: 'column', gap: S * 0.04}}>
      <Line><Underline progress={underline} color={accent} seed="small" roughness={0.6} strokeWidth={10}><Glyphs text="작은 결이" frame={frame} at={AT.statement + 2} /></Underline></Line>
      <Line><Encircle progress={circle} color={accent} seed="big" roughness={0.7} strokeWidth={10} padding={26}><Glyphs text="큰 물결로" frame={frame} at={AT.statement + 14} /></Encircle></Line>
    </div>
    <div style={{position: 'absolute', right: SIZES.marginX, top: (H - size) / 2, width: size, height: size, transform: `translateY(${(1 - rise) * H * 0.4}px)`, opacity: Math.min(1, rise * 2)}}>
      <Wave size={size} ink={ink} accent={accent} soft={soft} paper={paper} stroke={STROKE * size / (SIZES.hero * 1.35)} radius={RADIUS} parts={parts} />
    </div>
  </AbsoluteFill>;
}

function Name({frame}: {frame: number}) {
  const wipe = span(frame, AT.name, 16);
  // The one camera push lives on this card alone; scaling the whole stack pushed the statement text out of the safe area.
  const camera = push(frame, AT.name, 32, 0.04);
  const bar = span(frame, AT.name + 40, 16);
  const mark = SIZES.icon * 3.2;
  return <AbsoluteFill style={{background: ink, clipPath: `inset(0 0 0 ${(1 - wipe) * 100}%)`, transform: `scale(${camera})`, ...center, flexDirection: 'column', gap: S * 0.035}}>
    <MotionProbe id="ink-wipe" value={wipe} family="wipe" axis="progress" />
    <Wave size={mark} ink={paper} accent={accent} soft={soft} paper={paper} stroke={STROKE * mark / (SIZES.hero * 1.35)} radius={RADIUS} style={{opacity: span(frame, AT.name + 6, 14)}} />
    <Glyphs text="물결 스튜디오" frame={frame} at={AT.name + 8} size={SIZES.headline * 1.5} color={paper} />
    <div style={{width: W * 0.34, height: S * 0.016, background: accent, transform: `scaleX(${bar})`}} />
    <div style={{fontFamily: ui, fontWeight: 500, fontSize: SIZES.label * 1.3, color: soft, opacity: span(frame, AT.name + 48, 12)}}>흐름을 그리는 스튜디오 · 가상 브랜드</div>
  </AbsoluteFill>;
}

function GenerativeIdentSpot({auroraSeed = 'mulgyeol', auroraBands = 4, auroraSpeed = 0.06}: GenerativeIdentProps) {
  const frame = useCurrentFrame();
  const leak = interpolate(frame, [AT.seam - 4, AT.seam + 22], [0, 1], clamp);
  return <AbsoluteFill style={{background: ink, overflow: 'hidden'}}>
    <Audio src="/audio/generated/generative-ident/music.wav" volume={0.9} />
    <MotionSound src="/audio/generated/generative-ident/whoosh.wav" role="move" families={['wipe', 'card']} quiet={[AT.flow, AT.name]} />
    <MotionSound src="/audio/generated/generative-ident/impact.wav" role="land" families={['shape', 'card']} quiet={[AT.flow, AT.name]} />
    <MotionSound src="/audio/generated/generative-ident/stroke.wav" role="appear" families={['text']} quiet={[AT.flow, AT.name]} />
    <AbsoluteFill>
      {frame < AT.statement ? <Sky bands={auroraBands} speed={auroraSpeed} seed={auroraSeed} /> : null}
      {frame >= AT.flow && frame < AT.statement ? <Flow frame={frame} /> : null}
      {frame < AT.statement ? <Hero frame={frame} /> : null}
      {frame >= AT.seam && frame < AT.name + 16 ? <Statement frame={frame} /> : null}
      {frame >= AT.name ? <Name frame={frame} /> : null}
      {leak > 0 && leak < 1 ? <Solid width={W} height={H} effects={[lightLeakEffect({seed: 'seam', progress: leak, intensity: 0.9})]} style={{position: 'absolute', left: 0, top: 0}} /> : null}
      {/* The final card's film look; the grain frame stops at the hold so the last two seconds are pixel-identical. */}
      {frame >= AT.name ? <Solid width={W} height={H} effects={[vignetteEffect({amount: 0.55, softness: 0.6}), grainEffect({seed: 'card', frame: Math.min(frame, AT.hold), amount: 0.1, size: 2})]} style={{position: 'absolute', left: 0, top: 0}} /> : null}
    </AbsoluteFill>
  </AbsoluteFill>;
}
/** The Spot with its `variables` attached, so a registry can pass `variables={GenerativeIdent.variables}` from one import. */
export const GenerativeIdent = Object.assign(GenerativeIdentSpot, {variables});
