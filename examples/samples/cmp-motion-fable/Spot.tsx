import type {CSSProperties} from 'react';
import type {LucideIcon} from 'lucide-react';
import {PiggyBank, Repeat, Wallet} from 'lucide-react';
import {AbsoluteFill, Audio, Easing, Sequence, googleFont, interpolate, spring, useCurrentFrame} from 'frameforge';

const W = 1920;
const H = 1080;
const display = googleFont('Black Han Sans', {weights: [400], fallback: 'sans-serif'});
const ui = googleFont('Noto Sans KR', {weights: [500], fallback: 'sans-serif'});
const ink = '#111827';
const paper = '#F9FAFB';
const accent = '#22C55E';
const soft = '#DCFCE7';
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} satisfies {extrapolateLeft: 'clamp'; extrapolateRight: 'clamp'};
const center: CSSProperties = {display: 'flex', alignItems: 'center', justifyContent: 'center'};
// Absolute scene starts; the last 60 frames are the still hold.
const AT = {hook: 0, turn: 75, steps: 180, promise: 300, name: 375, end: 450};
// The one coin that stops slipping: a 380px disc at the right that flattens into the base of the stack.
const COIN = {x: 1480, bottom: 890, d: 380, h: 64, gap: 6};
const STACK = [90, 98, 106, 114, 122, 130, 138];
const CARD = {w: 500, h: 520, top: 320, left: 160, step: 550, icon: 160};
const CARDS: [LucideIcon, string, string][] = [[Wallet, '월급 들어오면', '예시 2,000,000원'], [Repeat, '매달 자동 이체', '예시 50,000원'], [PiggyBank, '1년 뒤 통장', '예시 600,000원']];
const PIGGY = {x: CARD.left + 2 * CARD.step + 44 + CARD.icon / 2, y: CARD.top + 44 + CARD.icon / 2};

function span(frame: number, from: number, dur: number): number {
  return interpolate(frame, [from, from + dur], [0, 1], {...clamp, easing: ease});
}

function pop(frame: number, at: number, dur: number, settle = false): number {
  return spring({frame, fps: 30, delay: at, durationInFrames: dur, config: {overshootClamping: settle}});
}

/** Camera push and return around one beat: scale rises to 1 + amount at the midpoint and comes back. */
function push(frame: number, at: number, dur: number, amount: number): number {
  const t = interpolate(frame, [at, at + dur], [0, 1], clamp);
  return 1 + amount * Math.sin(t * Math.PI);
}

function Glyphs({text, frame, at, size, color, stagger = 2, font = display}: {text: string; frame: number; at: number; size: number; color: string; stagger?: number; font?: string}) {
  return <span style={{display: 'flex', color, fontFamily: font, fontSize: size, fontWeight: font === display ? 400 : 500, lineHeight: 1, letterSpacing: '-0.02em', whiteSpace: 'pre'}}>
    {Array.from(text).map((glyph, index) => {
      const rise = span(frame, at + index * stagger, 12);
      // Black Han Sans ink reaches above the 1em line box and the comma below it, so the mask grows without moving the glyph.
      return <span key={index} style={{display: 'inline-block', overflow: 'hidden', height: '1.55em', paddingTop: '0.16em', marginTop: '-0.16em', paddingInline: '0.09em', marginInline: '-0.09em'}}>
        <span style={{display: 'inline-block', transform: `translateY(${(1 - rise) * 120}%)`, visibility: rise === 0 ? 'hidden' : 'visible'}}>{glyph}</span>
      </span>;
    })}
  </span>;
}

function Wipe({frame, at, color, x, y, r = 1800}: {frame: number; at: number; color: string; x: number; y: number; r?: number}) {
  return <AbsoluteFill style={{background: color, clipPath: `circle(${span(frame, at, 16) * r}px at ${x}px ${y}px)`}} />;
}

/** The coin seen edge-on: one slab of the stack. */
function Slab({top, scaleY = 1}: {top: number; scaleY?: number}) {
  return <div style={{position: 'absolute', left: COIN.x - COIN.d / 2, top, width: COIN.d, height: COIN.d, borderRadius: '50%', background: accent, transform: `scaleY(${scaleY})`, transformOrigin: 'center bottom'}} />;
}

function Hook({frame}: {frame: number}) {
  const drops = [[240, -26], [620, -14], [1000, -30], [1350, -8], [1700, -20], [480, 6], [1150, 14], [1550, 22], [820, 30]];
  const land = pop(frame, 48, 18, true);
  return <AbsoluteFill style={{background: ink}}>
    {drops.map(([x, start], i) => {
      const t = interpolate(frame, [start, start + 46], [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
      return <div key={i} style={{position: 'absolute', left: x + t * 220, top: -160 + t * 1400, width: 130, height: 130, borderRadius: '50%', background: accent}} />;
    })}
    <Slab top={interpolate(land, [0, 1], [-420, COIN.bottom - COIN.d])} />
    <div style={{position: 'absolute', left: 160, top: 250}}><Glyphs text="돈이 새고 있다" frame={frame} at={4} size={170} color={paper} /></div>
  </AbsoluteFill>;
}

function Turn({frame}: {frame: number}) {
  const flat = pop(frame, 78, 14, true);
  return <>
    <Wipe frame={frame} at={AT.turn} color={soft} x={COIN.x} y={COIN.bottom - COIN.d / 2} />
    <Slab top={COIN.bottom - COIN.d} scaleY={1 - flat * (1 - COIN.h / COIN.d)} />
    {STACK.map((at, i) => {
      const top = COIN.bottom - COIN.d - (i + 1) * (COIN.h + COIN.gap);
      return <Slab key={at} top={top - (1 - pop(frame, at, 12, true)) * 900} scaleY={COIN.h / COIN.d} />;
    })}
    <div style={{position: 'absolute', left: 160, top: 280}}><Glyphs text="조금씩" frame={frame} at={80} size={240} color={ink} /></div>
    <div style={{position: 'absolute', left: 160, top: 560}}><Glyphs text="쌓인다" frame={frame} at={90} size={240} color={ink} /></div>
  </>;
}

function Steps({frame}: {frame: number}) {
  const topSlab = COIN.bottom - COIN.d - STACK.length * (COIN.h + COIN.gap);
  return <>
    <Wipe frame={frame} at={AT.steps - 2} color={paper} x={COIN.x} y={topSlab + COIN.d - COIN.h / 2} />
    <div style={{position: 'absolute', left: 160, top: 60}}><Glyphs text="이렇게 모아요" frame={frame} at={184} size={120} color={ink} /></div>
    {CARDS.map(([Shape, title, amount], i) => {
      const at = 186 + i * 10;
      const rise = pop(frame, at, 18, true);
      const icon = pop(frame, at + 8, 16);
      return <div key={title} style={{position: 'absolute', left: CARD.left + i * CARD.step, top: CARD.top, width: CARD.w, height: CARD.h, borderRadius: 32, background: soft, transform: `translateY(${(1 - rise) * 900}px)`, visibility: rise === 0 ? 'hidden' : 'visible'}}>
        <div style={{position: 'absolute', left: 44, top: 44, width: CARD.icon, height: CARD.icon, ...center, transform: `scale(${icon})`}}><Shape size={CARD.icon} strokeWidth={2.2} color={accent} /></div>
        <div style={{position: 'absolute', right: 44, top: 44, width: 72, height: 72, borderRadius: '50%', background: ink, color: paper, fontFamily: ui, fontWeight: 500, fontSize: 40, ...center}}>{i + 1}</div>
        <div style={{position: 'absolute', left: 44, top: 250, fontFamily: display, fontWeight: 400, fontSize: 72, lineHeight: 1.1, color: ink, letterSpacing: '-0.02em'}}>{title}</div>
        <div style={{position: 'absolute', left: 44, top: 370, fontFamily: ui, fontWeight: 500, fontSize: 48, lineHeight: 1.2, color: ink}}>{amount}</div>
      </div>;
    })}
  </>;
}

function PromiseScene({frame}: {frame: number}) {
  const line: CSSProperties = {position: 'absolute', left: 0, right: 0, display: 'flex', justifyContent: 'center'};
  return <>
    <Wipe frame={frame} at={AT.promise - 2} color={accent} x={PIGGY.x} y={PIGGY.y} />
    <div style={{...line, top: 300}}><Glyphs text="매달 조금씩," frame={frame} at={302} size={180} color={ink} /></div>
    <div style={{...line, top: 540}}><Glyphs text="자동으로 모인다" frame={frame} at={310} size={180} color={ink} /></div>
  </>;
}

function Name({frame}: {frame: number}) {
  const line: CSSProperties = {position: 'absolute', left: 0, right: 0, display: 'flex', justifyContent: 'center'};
  return <>
    <Wipe frame={frame} at={AT.name - 3} color={ink} x={W / 2} y={H / 2} r={1120} />
    <div style={{...line, top: 250}}><Glyphs text="소복" frame={frame} at={374} size={320} color={paper} /></div>
    <div style={{position: 'absolute', left: (W - 420) / 2, top: 640, width: 420, height: 20, background: accent, transform: `scaleX(${span(frame, 376, 12)})`}} />
    <div style={{...line, top: 700}}><Glyphs text="매달 조금씩, 자동으로 모인다" frame={frame} at={376} size={60} color={paper} stagger={0} font={ui} /></div>
    <div style={{...line, top: 940, opacity: 0.7}}><Glyphs text="가상 브랜드 · 금액은 예시" frame={frame} at={377} size={40} color={paper} stagger={0} font={ui} /></div>
  </>;
}

export function Spot() {
  const frame = useCurrentFrame();
  // One camera push, on the promise line.
  const camera = push(frame, 318, 36, 0.05);
  const sfx = (name: string, frames: number[]) => frames.map(f => <Sequence key={`${name}${f}`} from={f} durationInFrames={30} layout="none"><Audio src={`/audio/generated/cmp-motion-fable/${name}.wav`} volume={0.8} /></Sequence>);
  return <AbsoluteFill style={{background: ink, overflow: 'hidden'}}>
    <Audio src="/audio/generated/cmp-motion-fable/music.wav" volume={0.9} />
    {sfx('pop', [60, ...STACK])}
    {sfx('click', [186, 196, 206])}
    {sfx('whoosh', [AT.turn, AT.steps - 2, AT.promise - 2, AT.name - 3])}
    <AbsoluteFill style={{transform: `scale(${camera})`}}>
      {frame < AT.turn + 20 ? <Hook frame={frame} /> : null}
      {frame >= AT.turn && frame < AT.steps + 20 ? <Turn frame={frame} /> : null}
      {frame >= AT.steps - 2 && frame < AT.promise + 20 ? <Steps frame={frame} /> : null}
      {frame >= AT.promise - 2 && frame < AT.name + 20 ? <PromiseScene frame={frame} /> : null}
      {frame >= AT.name - 3 ? <Name frame={frame} /> : null}
    </AbsoluteFill>
  </AbsoluteFill>;
}
