import type {CSSProperties} from 'react';
import {PiggyBank, Repeat, Wallet} from 'lucide-react';
import {AbsoluteFill, Audio, Easing, Sequence, googleFont, interpolate, spring, useCurrentFrame} from 'frameforge';

const W = 1920;
const H = 1080;
const S = Math.min(W, H);
const SIZES = {headline: S * 0.1, label: S * 0.035, icon: S * 0.06, hero: S * 0.35, marginX: W * 0.05, marginY: H * 0.05};
const display = googleFont('Black Han Sans', {weights: [400], fallback: 'sans-serif'});
const ui = googleFont('Noto Sans KR', {weights: [500], fallback: 'sans-serif'});
const ink = '#111827';
const paper = '#F9FAFB';
const accent = '#22C55E';
const soft = '#DCFCE7';
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} satisfies {extrapolateLeft: 'clamp'; extrapolateRight: 'clamp'};
const center: CSSProperties = {display: 'flex', alignItems: 'center', justifyContent: 'center'};

function span(frame: number, from: number, dur: number): number {
  return interpolate(frame, [from, from + dur], [0, 1], {...clamp, easing: ease});
}

function pop(frame: number, at: number, dur: number, settle = false): number {
  return spring({frame, fps: 30, delay: at, durationInFrames: dur, config: {overshootClamping: settle}});
}

function Glyphs({text, frame, at, size = SIZES.headline, color = ink, stagger = 2}: {text: string; frame: number; at: number; size?: number; color?: string; stagger?: number}) {
  return <span style={{display: 'flex', color, fontFamily: display, fontSize: size, fontWeight: 400, lineHeight: 1, letterSpacing: '-0.03em'}}>
    {Array.from(text).map((glyph, index) => {
      const rise = span(frame, at + index * stagger, 12);
      return <span key={index} style={{display: 'inline-block', overflow: 'hidden', height: '1.25em', paddingTop: '0.1em', paddingBottom: '0.1em', marginTop: '-0.1em', marginBottom: '-0.1em', paddingInline: '0.06em', marginInline: '-0.06em'}}>
        <span style={{display: 'inline-block', transform: `translateY(${(1 - rise) * 120}%)`, visibility: rise === 0 ? 'hidden' : 'visible'}}>{glyph === ' ' ? ' ' : glyph}</span>
      </span>;
    })}
  </span>;
}

function Hook({frame}: {frame: number}) {
  const drop = pop(frame, 5, 18);
  const slide = span(frame, 26, 26);
  return <AbsoluteFill style={{background: ink, overflow: 'hidden'}}>
    <div style={{position: 'absolute', left: SIZES.marginX, top: H * 0.22}}><Glyphs text="돈은 어디로" frame={frame} at={4} color={paper} /></div>
    <div style={{position: 'absolute', left: SIZES.marginX, top: H * 0.35}}><Glyphs text="새는 걸까?" frame={frame} at={12} color={paper} /></div>
    <div style={{position: 'absolute', left: 1180 + slide * 240, top: 520 + (1 - drop) * -560, width: 470, height: 470, borderRadius: '50%', background: accent, ...center}}>
      <div style={{width: 330, height: 330, border: `24px solid ${soft}`, borderRadius: '50%'}} />
    </div>
    <div style={{position: 'absolute', left: 1000, top: 805, width: 740, height: 14, background: paper, transform: `rotate(-8deg) scaleX(${span(frame, 22, 18)})`, transformOrigin: 'left'}} />
  </AbsoluteFill>;
}

function Turn({frame}: {frame: number}) {
  const grow = pop(frame, 75, 22, true);
  const cover = span(frame, 106, 32);
  return <AbsoluteFill style={{background: soft, overflow: 'hidden'}}>
    <div style={{position: 'absolute', inset: 0, background: paper, clipPath: `inset(0 0 ${(1 - cover) * 100}% 0)`}} />
    <div style={{position: 'absolute', left: 280, top: 330, width: 480 + grow * 180, height: 480 + grow * 180, borderRadius: '50%', background: accent, ...center}}>
      <div style={{width: '68%', height: '68%', border: `26px solid ${ink}`, borderRadius: '50%'}} />
    </div>
    <div style={{position: 'absolute', left: 780, top: 430, width: 820, height: 18, background: accent, transform: `rotate(-20deg) scaleX(${span(frame, 80, 30)})`, transformOrigin: 'left center'}} />
    {[0, 1, 2, 3].map(i => <div key={i} style={{position: 'absolute', left: 950 + i * 130, top: 410 - i * 46, width: 170, height: 170, borderRadius: '50%', background: i % 2 ? soft : accent, border: `12px solid ${ink}`, transform: `scale(${pop(frame, 90 + i * 7, 14, true)})`}} />)}
    <div style={{position: 'absolute', left: SIZES.marginX, bottom: 100}}><Glyphs text="조금씩 모이면, 차곡차곡" frame={frame} at={102} color={ink} size={110} /></div>
  </AbsoluteFill>;
}

function Steps({frame}: {frame: number}) {
  const cards = [
    {Icon: Wallet, title: '지갑 연결', value: '한 번 연결 · 예시'},
    {Icon: Repeat, title: '매달 반복', value: '매달 자동 · 예시'},
    {Icon: PiggyBank, title: '저금통에 쌓기', value: '작은 금액 · 예시'},
  ];
  return <AbsoluteFill style={{background: soft, overflow: 'hidden'}}>
    <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H * 0.48, background: accent}} />
    <div style={{position: 'absolute', left: SIZES.marginX, top: 70}}><Glyphs text="이렇게 모여요" frame={frame} at={182} color={ink} /></div>
    <div style={{position: 'absolute', left: 100, right: 100, top: 350, bottom: 130, display: 'flex', gap: 36, alignItems: 'center'}}>
      {cards.map(({Icon, title, value}, i) => {
        const land = pop(frame, 184 + i * 12, 20, true);
        return <div key={title} style={{flex: 1, height: 470, background: paper, border: `8px solid ${ink}`, transform: `translateY(${(1 - land) * 650}px)`, ...center, flexDirection: 'column', gap: 24}}>
          <div style={{width: 128, height: 128, borderRadius: '50%', background: accent, ...center}}><Icon size={SIZES.icon * 1.7} strokeWidth={2.5} color={ink} /></div>
          <div style={{fontFamily: ui, fontWeight: 500, fontSize: 46, color: ink}}>{title}</div>
          <div style={{fontFamily: ui, fontWeight: 500, fontSize: 38, color: ink}}>{value}</div>
        </div>;
      })}
    </div>
    <div style={{position: 'absolute', left: 110, right: 110, top: 556, height: 16, background: accent, transform: `scaleX(${span(frame, 190, 48)})`, transformOrigin: 'left center'}} />
  </AbsoluteFill>;
}

function Promise({frame}: {frame: number}) {
  const wipe = span(frame, 300, 18);
  return <AbsoluteFill style={{background: soft, overflow: 'hidden'}}>
    <div style={{position: 'absolute', inset: 0, background: accent, clipPath: `circle(${wipe * 1450}px at 42% 54%)`}} />
    <div style={{position: 'absolute', left: 110, top: 220, width: 560, height: 560, borderRadius: '50%', border: `34px solid ${ink}`, ...center}}><div style={{width: '65%', height: '65%', borderRadius: '50%', background: soft}} /></div>
    <div style={{position: 'absolute', left: 740, top: 370}}><Glyphs text="매달 조금씩," frame={frame} at={304} color={ink} size={130} /></div>
    <div style={{position: 'absolute', left: 740, top: 540}}><Glyphs text="자동으로 모인다" frame={frame} at={316} color={ink} size={130} /></div>
  </AbsoluteFill>;
}

function Name() {
  return <AbsoluteFill style={{background: ink, ...center, flexDirection: 'column', gap: 28}}>
    <div style={{display: 'flex', alignItems: 'center', gap: 30}}>
      <div style={{width: 120, height: 120, borderRadius: '50%', background: accent, ...center}}><div style={{width: 72, height: 72, borderRadius: '50%', border: `12px solid ${paper}`}} /></div>
      <div style={{fontFamily: display, fontWeight: 400, fontSize: 180, lineHeight: 1.2, color: paper}}>차곡달</div>
    </div>
    <div style={{width: 640, height: 16, background: accent}} />
    <div style={{fontFamily: ui, fontWeight: 500, fontSize: 48, color: paper}}>매일의 작은 여유</div>
  </AbsoluteFill>;
}

export function Spot() {
  const frame = useCurrentFrame();
  const camera = 1 + 0.04 * Math.sin(interpolate(frame, [318, 342], [0, Math.PI], clamp));
  return <AbsoluteFill style={{background: ink, overflow: 'hidden'}}>
    <Audio src="/audio/generated/cmp-motion-luna6/music.wav" volume={0.9} />
    <Sequence from={75} durationInFrames={30} layout="none"><Audio src="/audio/generated/cmp-motion-luna6/whoosh.wav" volume={0.8} /></Sequence>
    <Sequence from={180} durationInFrames={30} layout="none"><Audio src="/audio/generated/cmp-motion-luna6/pop.wav" volume={0.8} /></Sequence>
    <Sequence from={390} durationInFrames={30} layout="none"><Audio src="/audio/generated/cmp-motion-luna6/impact.wav" volume={0.8} /></Sequence>
    <AbsoluteFill style={{transform: `scale(${camera})`}}>
      {frame < 75 ? <Hook frame={frame} /> : null}
      {frame >= 75 && frame < 180 ? <Turn frame={frame} /> : null}
      {frame >= 180 && frame < 300 ? <Steps frame={frame} /> : null}
      {frame >= 300 && frame < 390 ? <Promise frame={frame} /> : null}
      {frame >= 390 ? <Name /> : null}
    </AbsoluteFill>
  </AbsoluteFill>;
}
