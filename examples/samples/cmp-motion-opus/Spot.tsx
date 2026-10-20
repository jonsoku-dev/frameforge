import type {CSSProperties} from 'react';
import type {LucideIcon} from 'lucide-react';
import {PiggyBank, Repeat, Wallet} from 'lucide-react';
import {AbsoluteFill, Audio, Easing, Sequence, googleFont, interpolate, random, spring, useCurrentFrame} from 'frameforge';

const W = 1920;
const H = 1080;
const S = Math.min(W, H);
// Minimums from docs/samples/rules.md (구성 최소치). Go bigger, never smaller.
const SIZES = {headline: S * 0.1, label: S * 0.035, icon: S * 0.06, hero: S * 0.35, marginX: W * 0.05, marginY: H * 0.05};
const display = googleFont('Black Han Sans', {weights: [400], fallback: 'sans-serif'});
const ui = googleFont('Noto Sans KR', {weights: [500], fallback: 'sans-serif'});
const ink = '#111827';
const paper = '#F9FAFB';
const accent = '#22C55E';
const soft = '#DCFCE7';
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} satisfies {extrapolateLeft: 'clamp'; extrapolateRight: 'clamp'};
const fill: CSSProperties = {position: 'absolute', inset: 0};
const label: CSSProperties = {fontFamily: ui, fontWeight: 500, color: ink, whiteSpace: 'nowrap'};
const AUDIO = '/audio/generated/cmp-motion-opus';
// Stack column: base coin centre and the step between coins.
const STACK = {x: 1400, y: 908, step: 56, w: 420, h: 64};

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
  return <span style={{display: 'flex', color, fontFamily: display, fontSize: size, fontWeight: 400, lineHeight: 1, letterSpacing: '-0.02em', whiteSpace: 'pre'}}>
    {Array.from(text).map((glyph, index) => {
      const rise = span(frame, at + index * stagger, 12);
      // Black Han Sans ink reaches above the 1em line box (kinetic-typo values), so the mask grows without moving the glyph.
      return <span key={index} style={{display: 'inline-block', overflow: 'hidden', height: '1.3em', paddingTop: '0.15em', marginTop: '-0.15em', paddingInline: '0.08em', marginInline: '-0.08em'}}>
        <span style={{display: 'inline-block', transform: `translateY(${(1 - rise) * 120}%)`, visibility: rise === 0 ? 'hidden' : 'visible'}}>{glyph}</span>
      </span>;
    })}
  </span>;
}

/** One coin: a circle seen from the front, or a pill seen from the side; the inner rim scales with it. */
function Coin({x, y, w, h}: {x: number; y: number; w: number; h: number}) {
  return <div style={{position: 'absolute', left: x - w / 2, top: y - h / 2, width: w, height: h, borderRadius: 999, background: accent, border: `${Math.max(4, h * 0.03)}px solid ${ink}`, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
    <div style={{width: w * 0.72, height: h * 0.72, borderRadius: 999, border: `${Math.max(3, h * 0.04)}px solid ${soft}`}} />
  </div>;
}

function Hook({frame}: {frame: number}) {
  const coins = [2, 13, 24, 35, 46].map((start, i) => {
    const t = interpolate(frame, [start, start + 30], [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
    return <Coin key={i} x={1450 + (random(`coin-${i}`) - 0.5) * 220} y={-16 + t * 1320} w={300} h={300} />;
  });
  const keep = interpolate(frame, [50, 72], [-16, 760], {...clamp, easing: Easing.in(Easing.quad)});
  return <AbsoluteFill style={{background: ink}}>
    <div style={{...fill, clipPath: 'inset(134px 0 0 0)'}}>{coins}{frame < 75 ? <Coin x={1450} y={keep} w={300} h={300} /> : null}</div>
    <div style={{position: 'absolute', left: 1190, top: 106, width: 520, height: 28, borderRadius: 14, background: paper}} />
    <div style={{position: 'absolute', left: SIZES.marginX, top: 300, display: 'flex', flexDirection: 'column', gap: 20}}>
      <Glyphs text="월급이" frame={frame} at={6} size={150} color={paper} />
      <Glyphs text="새어 나간다" frame={frame} at={14} size={150} color={paper} />
    </div>
  </AbsoluteFill>;
}

function Turn({frame}: {frame: number}) {
  const k = span(frame, 75, 15);
  const wipe = span(frame, 75, 20) * 1800;
  return <AbsoluteFill>
    <div style={{...fill, background: paper, clipPath: `circle(${wipe}px at ${STACK.x}px ${STACK.y}px)`}}>
      <div style={{position: 'absolute', left: SIZES.marginX, top: 300, display: 'flex', flexDirection: 'column', gap: 20}}>
        <Glyphs text="새던 돈이," frame={frame} at={76} size={150} />
        <Glyphs text="쌓인다" frame={frame} at={84} size={150} />
      </div>
    </div>
    <Coin x={1450 + (STACK.x - 1450) * k} y={760 + (STACK.y - 760) * k} w={300 + (STACK.w - 300) * k} h={300 + (STACK.h - 300) * k} />
    {Array.from({length: 8}, (_, i) => {
      const p = pop(frame, 88 + i * 7, 14, true);
      return p === 0 ? null : <Coin key={i} x={STACK.x} y={STACK.y - (i + 1) * STACK.step - (1 - p) * 700} w={STACK.w} h={STACK.h} />;
    })}
  </AbsoluteFill>;
}

const STEPS: [LucideIcon, string, string, string][] = [
  [Wallet, '01', '월급이 들어오면', '매달 25일 · 예시'],
  [Repeat, '02', '자동으로 떼어 두고', '50,000원 · 예시'],
  [PiggyBank, '03', '다달탑에 쌓인다', '1년 600,000원 · 예시'],
];
const CARD = {top: 300, w: 544, h: 580, gap: 48, pad: 40};

function How({frame}: {frame: number}) {
  const wipe = span(frame, 180, 18) * 2000;
  return <AbsoluteFill style={{background: soft, clipPath: `circle(${wipe}px at ${STACK.x}px ${STACK.y - 4 * STACK.step}px)`}}>
    <div style={{position: 'absolute', left: SIZES.marginX, top: SIZES.marginY + 50}}><Glyphs text="이렇게 모여요" frame={frame} at={186} size={120} /></div>
    {STEPS.map(([Icon, num, title, sub], i) => {
      const at = 190 + i * 26;
      const p = pop(frame, at, 18, true);
      const icon = pop(frame, at + 6, 16);
      return <div key={num} style={{position: 'absolute', left: SIZES.marginX + i * (CARD.w + CARD.gap), top: CARD.top, width: CARD.w, height: CARD.h, padding: CARD.pad, boxSizing: 'border-box', borderRadius: 28, background: paper, border: `4px solid ${ink}`,
        display: 'flex', flexDirection: 'column', gap: 24, transform: `translateY(${(1 - p) * 760}px)`, visibility: p === 0 ? 'hidden' : 'visible'}}>
        <div style={{...label, fontSize: 40}}>{num}</div>
        <div style={{width: 168, height: 168, flexShrink: 0, borderRadius: 999, background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${icon})`}}>
          <Icon size={104} strokeWidth={2.5} color={ink} />
        </div>
        <div style={{...label, fontSize: 50}}>{title}</div>
        <div style={{...label, fontSize: 40, alignSelf: 'flex-start', padding: '6px 20px', borderRadius: 999, background: soft}}>{sub}</div>
        {i === 2 ? <div style={{height: 24, borderRadius: 12, background: soft, overflow: 'hidden'}}>
          <div style={{height: '100%', background: accent, transformOrigin: 'left', transform: `scaleX(${span(frame, 252, 40)})`}} />
        </div> : null}
      </div>;
    })}
  </AbsoluteFill>;
}

// Card 3's icon centre, where the promise field opens.
const ICON3 = {x: SIZES.marginX + 2 * (CARD.w + CARD.gap) + CARD.pad + 84, y: CARD.top + CARD.pad + 56 + 24 + 84};

function PromiseScene({frame}: {frame: number}) {
  const wipe = span(frame, 300, 18) * 1900;
  return <AbsoluteFill style={{background: accent, clipPath: `circle(${wipe}px at ${ICON3.x}px ${ICON3.y}px)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 30}}>
    <Glyphs text="매달 조금씩," frame={frame} at={302} size={200} stagger={1.5} />
    <Glyphs text="자동으로 모인다" frame={frame} at={310} size={200} stagger={1.5} />
  </AbsoluteFill>;
}

function Name({frame}: {frame: number}) {
  const k = span(frame, 372, 14);
  return <AbsoluteFill style={{background: ink, clipPath: `inset(${(1 - k) * 100}% 0 0 0)`}}>
    {Array.from({length: 5}, (_, i) => <Coin key={i} x={400} y={760 - i * STACK.step} w={400} h={STACK.h} />)}
    <div style={{position: 'absolute', left: 720, top: 250, display: 'flex', flexDirection: 'column', gap: 28}}>
      <Glyphs text="다달탑" frame={frame} at={372} size={260} color={paper} />
      <div style={{width: 680, height: 20, borderRadius: 10, background: accent, transformOrigin: 'left', transform: `scaleX(${span(frame, 376, 13)})`}} />
      <div style={{...label, fontSize: 56, color: soft}}>매달 조금씩, 자동으로 모인다</div>
      <div style={{...label, fontSize: 40, color: paper}}>가상 브랜드</div>
    </div>
  </AbsoluteFill>;
}

const SFX: [number, string][] = [[2, 'whoosh'], [75, 'pop'], [88, 'tick'], [137, 'tick'], [180, 'whoosh2'], [190, 'click'], [216, 'click'], [242, 'click'], [300, 'whoosh'], [372, 'whoosh2'], [388, 'ding']];

export function Spot() {
  const frame = useCurrentFrame();
  // One push, on the promise line.
  const camera = push(frame, 315, 50, 0.05);
  return <AbsoluteFill style={{background: ink, overflow: 'hidden'}}>
    <Audio src={`${AUDIO}/music.wav`} volume={0.9} />
    {SFX.map(([at, name]) => <Sequence key={`${at}-${name}`} from={at} durationInFrames={30} layout="none"><Audio src={`${AUDIO}/${name}.wav`} volume={0.8} /></Sequence>)}
    <AbsoluteFill style={{transform: `scale(${camera})`}}>
      {frame < 96 ? <Hook frame={frame} /> : null}
      {frame >= 75 && frame < 200 ? <Turn frame={frame} /> : null}
      {frame >= 180 && frame < 320 ? <How frame={frame} /> : null}
      {frame >= 300 && frame < 388 ? <PromiseScene frame={frame} /> : null}
      {frame >= 372 ? <Name frame={frame} /> : null}
    </AbsoluteFill>
  </AbsoluteFill>;
}
