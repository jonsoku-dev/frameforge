import type {CSSProperties} from 'react';
import {AbsoluteFill, Audio, Easing, Sequence, googleFont, interpolate, spring, useCurrentFrame} from 'frameforge';

const anton = googleFont('Anton', {weights: [400], fallback: 'sans-serif'});
const ui = googleFont('Noto Sans KR', {weights: [500], fallback: 'sans-serif'});
const ink = '#141414';
const paper = '#F5F5F5';
const accent = '#00E5A0';
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} satisfies {extrapolateLeft: 'clamp'; extrapolateRight: 'clamp'};
const STEP = 24;
const HIT = 240;
const W = 2200;
const H = 1300;

function span(frame: number, from: number, dur: number): number {
  return interpolate(frame, [from, from + dur], [0, 1], {...clamp, easing: ease});
}

function pop(frame: number, at: number, dur: number): number {
  return spring({frame, fps: 30, delay: at, durationInFrames: dur});
}

/** Cuts land on the even digits (every 48 frames); accent always sits between ink and paper. */
function background(frame: number): string {
  if (frame >= HIT) return ink;
  return [accent, ink, accent, paper, accent][Math.floor(frame / 48)];
}

/** Where item k enters from; the item it replaces leaves the opposite way. */
function entry(k: number): [number, number] {
  return [[0, -H], [W, 0], [-W, 0], [0, H]][k % 4] as [number, number];
}

function arrival(frame: number, k: number): number {
  if (k === 0) return 1;
  return span(frame, k === 10 ? HIT - 12 : k * STEP, k === 10 ? 12 : 10);
}

function Slot({frame, k, children}: {frame: number; k: number; children: React.ReactNode}) {
  if (frame < (k === 10 ? HIT - 12 : k * STEP) || (k < 10 && frame >= (k + 1) * STEP + 14)) return null;
  const [ex, ey] = entry(k);
  const [nx, ny] = entry(k + 1);
  const into = 1 - arrival(frame, k);
  const out = k === 10 ? 0 : arrival(frame, k + 1);
  const x = ex * into - nx * out;
  const y = ey * into - ny * out;
  return <AbsoluteFill style={{overflow: 'hidden', alignItems: 'center', justifyContent: 'center', transform: `translate(${x}px, ${y}px)`}}>{children}</AbsoluteFill>;
}

function Digit({frame, k, color}: {frame: number; k: number; color: string}) {
  const settle = k === 0 ? 1 : pop(frame, k * STEP, 14);
  return <Slot frame={frame} k={k}>
    <div style={{fontFamily: anton, fontSize: 860 * (1 + 0.01 * k), lineHeight: 1, color, transform: `scale(${0.9 + 0.1 * settle})`}}>{10 - k}</div>
  </Slot>;
}

function Name({frame, color, sub: subColor}: {frame: number; color: string; sub: string}) {
  const sub = span(frame, HIT - 10, 10);
  return <Slot frame={frame} k={10}>
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
      <div style={{fontFamily: anton, fontSize: 420, lineHeight: 1, color, letterSpacing: '0.01em'}}>ZAPLOOM</div>
      <div style={{fontFamily: ui, fontWeight: 500, fontSize: 64, lineHeight: 1.4, color: subColor, letterSpacing: '0.5em', marginRight: '-0.5em'}}>MARKET</div>
      <div style={{fontFamily: ui, fontWeight: 500, fontSize: 52, lineHeight: 1.4, color, marginTop: 56, opacity: sub, transform: `translateY(${(1 - sub) * 24}px)`}}>UP TO -70% · 예시</div>
    </div>
  </Slot>;
}

export function Spot() {
  const frame = useCurrentFrame();
  const bg = background(frame);
  const color = bg === ink ? accent : ink;
  const label: CSSProperties = {position: 'absolute', top: 60, fontFamily: ui, fontWeight: 500, fontSize: 42, lineHeight: 1.2, color, letterSpacing: '0.12em'};
  return <AbsoluteFill style={{background: bg, overflow: 'hidden'}}>
    <Audio src="/audio/generated/countdown-hype/music.wav" volume={0.9} />
    {Array.from({length: 10}, (_, k) => <Sequence key={k} from={k * STEP} durationInFrames={30} layout="none"><Audio src="/audio/generated/countdown-hype/click.wav" volume={0.8} /></Sequence>)}
    <Sequence from={HIT} durationInFrames={30} layout="none"><Audio src="/audio/generated/countdown-hype/impact.wav" volume={0.8} /></Sequence>
    {Array.from({length: 10}, (_, k) => <Digit key={k} frame={frame} k={k} color={color} />)}
    <Name frame={frame} color={bg === ink ? accent : ink} sub={bg === ink ? paper : ink} />
    {frame < HIT ? <>
      <div style={{...label, left: 96}}>SALE STARTS IN</div>
      <div style={{...label, right: 96}}>SAMPLE 샘플</div>
      <div style={{position: 'absolute', left: 96, right: 96, bottom: 64, display: 'flex', gap: 16}}>
        {Array.from({length: 10}, (_, k) => <div key={k} style={{flex: 1, height: 18, background: color, opacity: frame >= k * STEP ? 1 : 0.2}} />)}
      </div>
    </> : null}
  </AbsoluteFill>;
}
