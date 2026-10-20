import type {CSSProperties, ReactNode} from 'react';
import type {LucideIcon} from 'lucide-react';
import {PiggyBank, Repeat, Wallet} from 'lucide-react';
import {AbsoluteFill, Audio, Easing, Sequence, googleFont, interpolate, spring, useCurrentFrame} from 'frameforge';

const W = 1920;
const H = 1080;
const S = Math.min(W, H);
const SIZES = {headline: S * 0.1, label: S * 0.035, icon: 96, hero: 400, marginX: W * 0.05, marginY: H * 0.05};
const display = googleFont('Black Han Sans', {weights: [400], fallback: 'sans-serif'});
const ui = googleFont('Noto Sans KR', {weights: [500], fallback: 'sans-serif'});
const ink = '#111827';
const paper = '#F9FAFB';
const accent = '#22C55E';
const soft = '#DCFCE7';
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} satisfies {extrapolateLeft: 'clamp'; extrapolateRight: 'clamp'};
const audio = '/audio/generated/cmp-motion-grokfast';

function span(frame: number, from: number, dur: number): number {
  return interpolate(frame, [from, from + dur], [0, 1], {...clamp, easing: ease});
}

function pop(frame: number, at: number, dur: number): number {
  return spring({frame, fps: 30, delay: at, durationInFrames: dur, config: {overshootClamping: true}});
}

function push(frame: number, at: number, dur: number, amount: number): number {
  const t = interpolate(frame, [at, at + dur], [0, 1], clamp);
  return 1 + amount * Math.sin(t * Math.PI);
}

function Glyphs({text, frame, at, size = SIZES.headline, color = ink, stagger = 2, dur = 10, out}: {text: string; frame: number; at: number; size?: number; color?: string; stagger?: number; dur?: number; out?: number}) {
  return <span style={{display: 'flex', color, fontFamily: display, fontSize: size, fontWeight: 400, lineHeight: 1, letterSpacing: '-0.03em', whiteSpace: 'pre'}}>
    {Array.from(text).map((glyph, index) => {
      const rise = span(frame, at + index * stagger, dur) - (out === undefined ? 0 : span(frame, out + index, 6));
      // Black Han Sans ink leaves the 1em line box above and below, so the mask grows both ways without moving the glyph.
      return <span key={index} style={{display: 'inline-block', overflow: 'hidden', height: '1.36em', paddingTop: '0.16em', marginTop: '-0.16em', paddingBottom: '0.14em', marginBottom: '-0.14em', paddingInline: '0.1em', marginInline: '-0.1em'}}>
        <span style={{display: 'inline-block', transform: `translateY(${(1 - rise) * 120}%)`, visibility: rise <= 0 ? 'hidden' : 'visible'}}>{glyph}</span>
      </span>;
    })}
  </span>;
}

function Rise({frame, at, dur, size, color, children}: {frame: number; at: number; dur: number; size: number; color: string; children: ReactNode}) {
  const rise = span(frame, at, dur);
  return <span style={{display: 'inline-block', overflow: 'hidden', height: '1.4em', paddingTop: '0.12em', marginTop: '-0.12em', paddingBottom: '0.18em', marginBottom: '-0.18em', paddingInline: '0.08em', marginInline: '-0.08em', color, fontFamily: ui, fontWeight: 500, fontSize: size, lineHeight: 1, whiteSpace: 'nowrap'}}>
    <span style={{display: 'inline-block', transform: `translateY(${(1 - rise) * 120}%)`, visibility: rise === 0 ? 'hidden' : 'visible'}}>{children}</span>
  </span>;
}

function Coin({x, y, d, rot = 0}: {x: number; y: number; d: number; rot?: number}) {
  const ring = Math.max(8, d * 0.055);
  return <div style={{position: 'absolute', left: x - d / 2, top: y - d / 2, width: d, height: d, boxSizing: 'border-box', borderRadius: '50%', background: accent, border: `${ring}px solid ${ink}`, transform: `rotate(${rot}deg)`, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
    <div style={{width: '62%', height: '62%', boxSizing: 'border-box', borderRadius: '50%', border: `${ring}px solid ${soft}`}} />
  </div>;
}

function Hit({at, name}: {at: number; name: string}) {
  return <Sequence from={at} durationInFrames={30} layout="none"><Audio src={`${audio}/${name}.wav`} volume={0.8} /></Sequence>;
}

function Story({frame}: {frame: number}) {
  const bend = span(frame, 75, 42);
  const y0 = 720 + 180 * bend;
  const y1 = 720 - 220 * bend;
  const c1 = 720 + 140 * bend;
  const c2 = 720 - 180 * bend;
  const line = `M 180 ${y0} C 640 ${c1} 1120 ${c2} 1680 ${y1}`;
  const draw = span(frame, 0, 12);
  const x = interpolate(frame, [0, 16, 75, 117], [1240, 1240, 1660, 1560], clamp);
  const y = interpolate(frame, [0, 16, 75, 117], [520, 520, 860, 300], clamp);
  const rot = interpolate(frame, [16, 75, 117], [0, 22, 0], clamp);
  const pile = [{x: 716, y: 678, at: 100}, {x: 967, y: 587, at: 112}, {x: 1227, y: 501, at: 124}];
  const title: CSSProperties = {position: 'absolute', left: SIZES.marginX + 24, top: 88};
  return <>
    <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0}}>
      {bend > 0 ? <path d={`${line} L 1920 ${y1} L 1920 1080 L 180 1080 Z`} fill={accent} /> : null}
      <path d={line} fill="none" stroke={ink} strokeWidth={44} strokeLinecap="round" strokeDasharray={4000} strokeDashoffset={4000 * (1 - draw)} />
    </svg>
    {[22, 34].map(at => {
      const t = interpolate(frame, [at, at + 20], [0, 1], clamp);
      const cy = 660 + t * 480;
      return frame >= at && cy + 60 < H ? <Coin key={at} x={1120 + (at - 22) * 10 + t * 30} y={cy} d={120} rot={t * 18} /> : null;
    })}
    {pile.map(coin => {
      const p = pop(frame, coin.at, 16);
      return frame >= coin.at ? <div key={coin.at} style={{position: 'absolute', left: coin.x, top: coin.y, transform: `translate(-50%, -50%) scale(${p})`}}><Coin x={0} y={0} d={150} /></div> : null;
    })}
    <Coin x={x} y={y} d={400} rot={rot} />
    <div style={title}><Glyphs text="월급이 샌다" frame={frame} at={0} stagger={1} dur={8} out={66} size={140} /></div>
    <div style={title}><Glyphs text="한 닢이 쌓인다" frame={frame} at={82} stagger={2} dur={10} out={166} size={124} /></div>
  </>;
}

const steps: {icon: LucideIcon; title: string; value: string; at: number}[] = [
  {icon: Wallet, title: '지갑에서', value: '3만 원', at: 178},
  {icon: Repeat, title: '매달 반복', value: '매월 1회', at: 188},
  {icon: PiggyBank, title: '통장으로', value: '12개월', at: 200},
];

function Steps({frame}: {frame: number}) {
  const open = span(frame, 180, 16);
  const r = open * 2000;
  return <>
    <div style={{position: 'absolute', left: 1560 - r, top: 300 - r, width: r * 2, height: r * 2, borderRadius: '50%', background: soft}} />
    <div style={{position: 'absolute', left: 144, top: 78}}><Glyphs text="이렇게 모인다" frame={frame} at={182} stagger={1} dur={8} size={124} /></div>
    {steps.map((step, index) => {
      const p = pop(frame, step.at, 18);
      const Icon = step.icon;
      return frame >= step.at ? <div key={step.title} style={{position: 'absolute', left: 144 + index * 556, top: 280, width: 520, height: 560, borderRadius: 32, background: paper, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, transform: `translateY(${(1 - p) * 180}px)`}}>
        <div style={{width: 168, height: 168, borderRadius: '50%', background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <Icon size={SIZES.icon} strokeWidth={2.5} color={ink} />
        </div>
        <div style={{fontFamily: ui, fontWeight: 500, fontSize: 50, color: ink}}>{step.title}</div>
        <div style={{fontFamily: ui, fontWeight: 500, fontSize: 76, color: ink}}>{step.value}</div>
        <div style={{fontFamily: ui, fontWeight: 500, fontSize: 42, color: ink}}>예시</div>
      </div> : null;
    })}
  </>;
}

function PromiseLine({frame}: {frame: number}) {
  const open = span(frame, 300, 14);
  const r = open * 1600;
  return <>
    <div style={{position: 'absolute', left: 960 - r, top: 400 - r, width: r * 2, height: r * 2, borderRadius: '50%', background: accent}} />
    <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8}}>
      <Glyphs text="매달 조금씩," frame={frame} at={306} stagger={1} dur={5} size={132} />
      <Glyphs text="자동으로 모인다" frame={frame} at={307} stagger={1} dur={5} size={132} />
    </div>
  </>;
}

function Lockup({frame}: {frame: number}) {
  const cover = span(frame, 368, 16);
  const r = cover * 1800;
  const move = span(frame, 368, 16);
  return <>
    <div style={{position: 'absolute', left: 500 - r, top: 540 - r, width: r * 2, height: r * 2, borderRadius: '50%', background: ink}} />
    <Coin x={960 + (500 - 960) * move} y={540} d={220 + (560 - 220) * move} />
    <div style={{position: 'absolute', left: 980, top: 348, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 18}}>
      <Glyphs text="달그루" frame={frame} at={384} stagger={1} dur={4} size={188} color={paper} />
      <div style={{width: 380, height: 18, background: accent, transform: `scaleX(${span(frame, 378, 12)})`, transformOrigin: 'left center'}} />
      <Rise frame={frame} at={386} dur={4} size={48} color={paper}>매달 조금씩, 자동으로 모인다</Rise>
    </div>
  </>;
}

export function CmpMotionGrokfast() {
  const frame = useCurrentFrame();
  // Last 60 frames are the hold, so they all sample the lockup frame.
  const live = Math.min(frame, 390);
  const camera = push(live, 316, 36, 0.05);
  return <AbsoluteFill style={{background: paper, overflow: 'hidden'}}>
    <Audio src={`${audio}/music.wav`} volume={0.9} />
    <Hit at={16} name="whoosh" />
    <Hit at={75} name="pop" />
    <Hit at={100} name="pop" />
    <Hit at={300} name="whoosh" />
    <Hit at={390} name="ding" />
    {[178, 188, 200].map(at => <Hit key={at} at={at} name="click" />)}
    <AbsoluteFill style={{transform: `scale(${camera})`, transformOrigin: 'center center'}}>
      <Story frame={live} />
      {live >= 176 ? <Steps frame={live} /> : null}
      {live >= 300 ? <PromiseLine frame={live} /> : null}
      {live >= 368 ? <Lockup frame={live} /> : null}
    </AbsoluteFill>
  </AbsoluteFill>;
}
