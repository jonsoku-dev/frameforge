import type {CSSProperties} from 'react';
import type {LucideIcon} from 'lucide-react';
import {PiggyBank, Repeat, Wallet} from 'lucide-react';
import {AbsoluteFill, Audio, Easing, Sequence, googleFont, interpolate, spring, useCurrentFrame} from 'frameforge';

const W = 1920;
const H = 1080;
const S = Math.min(W, H);
// Minimums from docs/samples/rules.md (구성 최소치).
const SIZES = {headline: S * 0.1, label: S * 0.035, icon: S * 0.06, hero: S * 0.35, marginX: W * 0.05, marginY: H * 0.05};
const display = googleFont('Black Han Sans', {weights: [400], fallback: 'sans-serif'});
const ui = googleFont('Noto Sans KR', {weights: [500], fallback: 'sans-serif'});
const ink = '#111827';
const paper = '#F9FAFB';
const accent = '#22C55E';
const soft = '#DCFCE7';
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const center: CSSProperties = {display: 'flex', alignItems: 'center', justifyContent: 'center'};
const AT = {turn: 75, step: 188, how: 176, promise: 292, name: 390};
const SFX = '/audio/generated/cmp-motion-haiku';

function span(frame: number, from: number, dur: number): number {
  return interpolate(frame, [from, from + dur], [0, 1], {...clamp, easing: ease});
}

function pop(frame: number, at: number, dur: number, settle = false): number {
  return spring({frame, fps: 30, delay: at, durationInFrames: dur, config: {overshootClamping: settle}});
}

/** Scale rises to 1 + amount at the midpoint and returns to 1. */
function push(frame: number, at: number, dur: number, amount: number): number {
  const t = interpolate(frame, [at, at + dur], [0, 1], clamp);
  return 1 + amount * Math.sin(t * Math.PI);
}

function Glyphs({text, frame, at, size = SIZES.headline, color = ink, stagger = 2}: {text: string; frame: number; at: number; size?: number; color?: string; stagger?: number}) {
  return <span style={{display: 'flex', color, fontFamily: display, fontSize: size, fontWeight: 400, lineHeight: 1, letterSpacing: '-0.02em'}}>
    {Array.from(text).map((glyph, index) => {
      if (glyph === ' ') return <span key={index} style={{width: '0.3em'}} />;
      const rise = span(frame, at + index * stagger, 12);
      // Line box holds 0.8em above the baseline; the mask grows upward and sideways without moving the glyph.
      return <span key={index} style={{display: 'inline-block', overflow: 'hidden', height: '1.2em', paddingTop: '0.12em', marginTop: '-0.12em', paddingInline: '0.06em', marginInline: '-0.06em'}}>
        <span style={{display: 'inline-block', transform: `translateY(${(1 - rise) * 120}%)`, visibility: rise === 0 ? 'hidden' : 'visible'}}>{glyph}</span>
      </span>;
    })}
  </span>;
}

function Disc({x, y, d, color}: {x: number; y: number; d: number; color: string}) {
  return <div style={{position: 'absolute', left: x - d / 2, top: y - d / 2, width: d, height: d, borderRadius: '50%', background: color}} />;
}

function Hook({frame}: {frame: number}) {
  const plate = pop(frame, 0, 14, true) * 760;
  const drop = interpolate(frame, [20, 72], [0, 1100], {...clamp, easing: Easing.bezier(0.5, 0, 1, 1)});
  return <AbsoluteFill style={{background: ink}}>
    <Disc x={1500} y={540} d={plate} color={paper} />
    <Disc x={1500} y={540 + drop} d={SIZES.hero} color={accent} />
    <div style={{position: 'absolute', left: SIZES.marginX, top: H * 0.36, display: 'flex', flexDirection: 'column', gap: S * 0.02}}>
      <Glyphs text="월급이" frame={frame} at={6} color={paper} />
      <Glyphs text="그냥 빠져나간다" frame={frame} at={16} color={paper} />
    </div>
  </AbsoluteFill>;
}

function Turn({frame}: {frame: number}) {
  return <AbsoluteFill style={{background: ink}}>
    <div style={{position: 'absolute', left: SIZES.marginX, top: SIZES.marginY + S * 0.03}}><Glyphs text="이제, 쌓인다" frame={frame} at={AT.turn + 2} color={paper} /></div>
    {[0, 1, 2, 3, 4, 5].map(i => {
      const p = pop(frame, AT.turn + 8 + i * 12, 14, true);
      return <div key={i} style={{position: 'absolute', left: W / 2 - 240, top: 900 - (i + 1) * 90, width: 480, height: 84, borderRadius: 42, background: accent, transform: `translateY(${(1 - p) * -600}px)`}} />;
    })}
  </AbsoluteFill>;
}

function How({frame}: {frame: number}) {
  const reveal = span(frame, AT.how - 4, 24) * 1400;
  const steps: [LucideIcon, string, string][] = [[Wallet, '월급에서 떼기', '예시 · 매달 10일'], [Repeat, '매달 반복', '한 번만 설정'], [PiggyBank, '저금통에 쌓기', '예시 · 30만 원']];
  return <AbsoluteFill style={{background: paper, clipPath: `circle(${reveal}px at 50% 50%)`}}>
    <div style={{position: 'absolute', left: SIZES.marginX, top: SIZES.marginY + S * 0.03}}><Glyphs text="세 단계면 끝" frame={frame} at={AT.how + 6} /></div>
    <div style={{position: 'absolute', left: 0, right: 0, top: H * 0.36, display: 'flex', justifyContent: 'center', gap: 40}}>
      {steps.map(([Shape, title, sub], i) => {
        const p = pop(frame, AT.step + i * 16, 18, true);
        return <div key={title} style={{width: 520, height: 560, borderRadius: 32, background: soft, transform: `scale(${p})`, visibility: p === 0 ? 'hidden' : 'visible', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 36}}>
          <div style={{fontFamily: ui, fontWeight: 500, fontSize: SIZES.label * 1.5, color: accent}}>0{i + 1}</div>
          <Shape size={SIZES.icon * 2} strokeWidth={2.5} color={ink} />
          <div style={{fontFamily: ui, fontWeight: 500, fontSize: SIZES.label * 1.5, color: ink}}>{title}</div>
          <div style={{fontFamily: ui, fontWeight: 500, fontSize: SIZES.label, color: ink}}>{sub}</div>
        </div>;
      })}
    </div>
  </AbsoluteFill>;
}

function Promise({frame}: {frame: number}) {
  const reveal = span(frame, AT.promise - 8, 16) * 1500;
  return <AbsoluteFill style={{background: accent, clipPath: `circle(${reveal}px at 50% 50%)`, ...center, flexDirection: 'column', gap: S * 0.04}}>
    <Glyphs text="매달 조금씩," frame={frame} at={AT.promise + 8} size={SIZES.headline * 1.5} />
    <Glyphs text="자동으로 모인다" frame={frame} at={AT.promise + 22} size={SIZES.headline * 1.5} />
  </AbsoluteFill>;
}

function Name({frame}: {frame: number}) {
  const reveal = span(frame, AT.name, 18) * 1500;
  const bar = span(frame, AT.name + 16, 16);
  return <AbsoluteFill style={{background: ink, clipPath: `circle(${reveal}px at 50% 50%)`, ...center, flexDirection: 'column', gap: S * 0.04}}>
    <Glyphs text="모아담" frame={frame} at={AT.name + 4} size={SIZES.headline * 1.8} color={paper} />
    <div style={{width: W * 0.3, height: S * 0.02, background: accent, transform: `scaleX(${bar})`}} />
    <div style={{fontFamily: ui, fontWeight: 500, fontSize: SIZES.label * 1.4, color: paper, opacity: span(frame, AT.name + 26, 12)}}>자동 적립 앱 · 가상 브랜드</div>
  </AbsoluteFill>;
}

const SFX_CUES: [number, string, number][] = [
  [AT.turn, 'whoosh', 0.8], [AT.how - 4, 'whoosh', 0.8], [AT.promise - 8, 'whoosh', 0.8],
  [AT.step, 'click', 0.8], [AT.step + 16, 'click', 0.8], [AT.step + 32, 'click', 0.8],
  [AT.name, 'impact', 0.8],
];

export function Spot() {
  const frame = useCurrentFrame();
  const camera = push(frame, AT.promise + 30, 36, 0.05);
  return <AbsoluteFill style={{background: ink, overflow: 'hidden'}}>
    <Audio src={`${SFX}/music.wav`} volume={0.9} />
    {SFX_CUES.map(([from, name, volume]) => <Sequence key={`${from}-${name}`} from={from} durationInFrames={30} layout="none"><Audio src={`${SFX}/${name}.wav`} volume={volume} /></Sequence>)}
    <AbsoluteFill style={{transform: `scale(${camera})`}}>
      {frame < AT.turn ? <Hook frame={frame} /> : null}
      {frame >= AT.turn && frame < AT.how ? <Turn frame={frame} /> : null}
      {frame >= AT.how - 4 && frame < AT.name + 20 ? <How frame={frame} /> : null}
      {frame >= AT.promise - 8 && frame < AT.name + 20 ? <Promise frame={frame} /> : null}
      {frame >= AT.name ? <Name frame={frame} /> : null}
    </AbsoluteFill>
  </AbsoluteFill>;
}
