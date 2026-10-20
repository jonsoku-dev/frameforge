import type {CSSProperties} from 'react';
import {PiggyBank, Repeat, Wallet} from 'lucide-react';
import {AbsoluteFill, Audio, Easing, Sequence, googleFont, interpolate, spring, useCurrentFrame} from 'frameforge';

const headline = googleFont('Black Han Sans', {weights: [400], fallback: 'sans-serif'});
const ui = googleFont('Noto Sans KR', {weights: [500], fallback: 'sans-serif'});
const ink = '#111827';
const paper = '#F9FAFB';
const accent = '#22C55E';
const soft = '#DCFCE7';
const W = 1920;
const H = 1080;
const M = 96;
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} satisfies {extrapolateLeft: 'clamp'; extrapolateRight: 'clamp'};

function span(frame: number, from: number, dur: number): number { return interpolate(frame, [from, from + dur], [0, 1], {...clamp, easing: ease}); }
function pop(frame: number, at: number, dur: number, settle = false): number { return spring({frame, fps: 30, delay: at, durationInFrames: dur, config: {overshootClamping: settle}}); }
function push(frame: number, at: number, dur: number, amount: number): number { const t = interpolate(frame, [at, at + dur], [0, 1], clamp); return 1 + amount * Math.sin(t * Math.PI); }

function Glyphs({text, frame, at, size, color = ink, stagger = 2}: {text: string; frame: number; at: number; size: number; color?: string; stagger?: number}) {
  return <span style={{display: 'flex', color, fontFamily: headline, fontSize: size, fontWeight: 400, lineHeight: 1, letterSpacing: '-0.03em'}}>{Array.from(text).map((glyph, index) => {
    const rise = span(frame, at + index * stagger, 12);
    return <span key={`${glyph}-${index}`} style={{display: 'inline-block', overflow: 'hidden', height: '1.3em', paddingTop: '0.15em', marginTop: '-0.15em', paddingInline: '0.08em', marginInline: '-0.08em'}}><span style={{display: 'inline-block', transform: `translateY(${(1 - rise) * 120}%)`, visibility: rise === 0 ? 'hidden' : 'visible'}}>{glyph === ' ' ? ' ' : glyph}</span></span>;
  })}</span>;
}

function Coin({frame, at, x, y, size = 420}: {frame: number; at: number; x: number; y: number; size?: number}) {
  const land = pop(frame, at, 18, true);
  return <div style={{position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size, borderRadius: '50%', background: accent, border: `18px solid ${ink}`, boxSizing: 'border-box', transform: `translateY(${(1 - land) * -700}px) rotate(${(1 - land) * -14}deg)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ink, fontFamily: headline, fontSize: size * 0.32}}>₩</div>;
}

function Hook({frame}: {frame: number}) {
  const line = span(frame, 10, 32);
  const exit = span(frame, 62, 13);
  return <AbsoluteFill style={{background: ink, overflow: 'hidden'}}>
    <div style={{position: 'absolute', left: M, top: 180}}><Glyphs text="매달 돈이" frame={frame} at={4} size={168} color={paper} /><Glyphs text="새어 나가?" frame={frame} at={18} size={168} color={paper} /></div>
    <div style={{position: 'absolute', left: 140, top: 700, width: 1420, height: 26, background: paper, transform: `scaleX(${line}) rotate(-8deg)`, transformOrigin: 'left center'}} />
    <div style={{transform: `translate(${exit * 520}px, ${exit * 170}px)`}}><Coin frame={frame} at={8} x={1500} y={690} size={410} /></div>
    <div style={{position: 'absolute', right: M, top: 820, fontFamily: ui, fontSize: 42, color: accent}}>작은 돈도 놓치지 않게</div>
  </AbsoluteFill>;
}

function Turn({frame}: {frame: number}) {
  const curve = span(frame, 98, 30);
  const stack = pop(frame, 78, 20, true);
  return <AbsoluteFill style={{background: paper, overflow: 'hidden'}}>
    <Coin frame={frame} at={76} x={520} y={590} size={390} />
    {[0, 1, 2, 3].map(i => <div key={i} style={{position: 'absolute', left: 410, top: 620 - i * 54, width: 220, height: 54, borderRadius: 27, background: accent, border: `12px solid ${ink}`, transform: `scaleY(${stack})`, transformOrigin: 'bottom'}} />)}
    <svg width={W} height={H} style={{position: 'absolute', inset: 0}}><path d="M820 770 C1060 740 1040 480 1320 430 C1460 405 1550 300 1690 190" fill="none" stroke={accent} strokeWidth="26" strokeDasharray="1100" strokeDashoffset={(1 - curve) * 1100} /></svg>
    <div style={{position: 'absolute', left: 820, top: 260}}><Glyphs text="작은 금액도" frame={frame} at={92} size={150} /><Glyphs text="쌓이면" frame={frame} at={106} size={190} color={accent} /></div>
    <div style={{position: 'absolute', right: M, bottom: 100, fontFamily: ui, fontSize: 44, color: ink}}>예시 · 한 달 1회</div>
  </AbsoluteFill>;
}

function StepCard({frame, at, x, icon: Icon, title, detail, value}: {frame: number; at: number; x: number; icon: typeof Wallet; title: string; detail: string; value: string}) {
  const land = pop(frame, at, 18, true);
  return <div style={{position: 'absolute', left: x, top: 300, width: 500, height: 500, background: paper, border: `12px solid ${ink}`, transform: `translateY(${(1 - land) * 700}px)`, padding: 44, boxSizing: 'border-box'}}>
    <div style={{width: 92, height: 92, borderRadius: 46, background: soft, display: 'flex', alignItems: 'center', justifyContent: 'center'}}><Icon size={70} strokeWidth={2.5} color={ink} /></div>
    <div style={{marginTop: 52, fontFamily: headline, fontSize: 76, color: ink}}>{title}</div>
    <div style={{marginTop: 24, fontFamily: ui, fontSize: 42, color: ink}}>{detail}</div>
    <div style={{position: 'absolute', left: 44, bottom: 46, fontFamily: ui, fontSize: 44, color: accent}}>{value} · 예시</div>
  </div>;
}

function Steps({frame}: {frame: number}) {
  return <AbsoluteFill style={{background: soft, overflow: 'hidden'}}>
    <div style={{position: 'absolute', left: M, top: 100}}><Glyphs text="자동으로 이어지는 3단계" frame={frame} at={184} size={112} /></div>
    <StepCard frame={frame} at={190} x={M} icon={Wallet} title="담기" detail="금액을 골라요" value="₩10,000" />
    <StepCard frame={frame} at={204} x={710} icon={Repeat} title="반복" detail="매달 자동으로" value="매월 1회" />
    <StepCard frame={frame} at={218} x={1324} icon={PiggyBank} title="모이기" detail="잔액이 자라요" value="₩30,000" />
  </AbsoluteFill>;
}

function Promise({frame}: {frame: number}) {
  const wipe = span(frame, 300, 16);
  return <AbsoluteFill style={{background: ink, overflow: 'hidden'}}><AbsoluteFill style={{background: accent, clipPath: `inset(0 ${(1 - wipe) * 100}% 0 0)`}} /><div style={{position: 'absolute', left: M, top: 220}}><Glyphs text="매달 조금씩," frame={frame} at={302} size={190} color={paper} stagger={1} /><Glyphs text="자동으로 모인다" frame={frame} at={306} size={190} color={ink} stagger={1} /></div><div style={{position: 'absolute', right: M, bottom: 110, fontFamily: ui, fontSize: 44, color: paper}}>모아루프의 한 줄 약속</div></AbsoluteFill>;
}

function Name({frame}: {frame: number}) {
  const arrive = pop(frame, 348, 18, true);
  const rule = span(frame, 354, 14);
  return <AbsoluteFill style={{background: ink, overflow: 'hidden'}}><div style={{position: 'absolute', left: 460, top: 250, width: 580, height: 580, borderRadius: 290, background: accent, transform: `scale(${arrive})`}} /><div style={{position: 'absolute', left: 0, right: 0, top: 420, display: 'flex', justifyContent: 'center'}}><Glyphs text="모아루프" frame={frame} at={350} size={230} color={paper} stagger={2} /></div><div style={{position: 'absolute', left: 560, top: 720, width: 800, height: 16, background: paper, transform: `scaleX(${rule})`, transformOrigin: 'center'}} /><div style={{position: 'absolute', left: 0, right: 0, top: 790, display: 'flex', justifyContent: 'center', fontFamily: ui, fontSize: 48, color: paper}}>작은 습관이 큰 여유로</div></AbsoluteFill>;
}

export function Spot() {
  const frame = useCurrentFrame();
  const camera = push(frame, 312, 24, 0.05) * push(frame, 360, 24, 0.04);
  return <AbsoluteFill style={{background: ink, fontFamily: ui, overflow: 'hidden'}}>
    <Audio src="/audio/generated/cmp-motion-luna56/music.wav" volume={0.9} />
    <Sequence from={75} durationInFrames={30} layout="none"><Audio src="/audio/generated/cmp-motion-luna56/pop.wav" volume={0.8} /></Sequence>
    <Sequence from={180} durationInFrames={30} layout="none"><Audio src="/audio/generated/cmp-motion-luna56/whoosh.wav" volume={0.8} /></Sequence>
    {[204, 228, 252].map(at => <Sequence key={at} from={at} durationInFrames={30} layout="none"><Audio src="/audio/generated/cmp-motion-luna56/click.wav" volume={0.8} /></Sequence>)}
    {[300, 360].map(at => <Sequence key={at} from={at} durationInFrames={30} layout="none"><Audio src="/audio/generated/cmp-motion-luna56/impact.wav" volume={0.8} /></Sequence>)}
    <AbsoluteFill style={{transform: `scale(${camera})`}}>
      {frame < 75 ? <Hook frame={frame} /> : null}
      {frame >= 75 && frame < 180 ? <Turn frame={frame} /> : null}
      {frame >= 180 && frame < 300 ? <Steps frame={frame} /> : null}
      {frame >= 300 && frame < 360 ? <Promise frame={frame} /> : null}
      {frame >= 360 ? <Name frame={frame} /> : null}
    </AbsoluteFill>
  </AbsoluteFill>;
}
