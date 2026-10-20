import type {CSSProperties} from 'react';
import type {LucideIcon} from 'lucide-react';
import {PiggyBank, Repeat, Wallet} from 'lucide-react';
import {AbsoluteFill, Audio, Easing, Sequence, googleFont, interpolate, spring, useCurrentFrame} from 'frameforge';

const W = 1920;
const H = 1080;
const ink = '#111827';
const paper = '#F9FAFB';
const accent = '#22C55E';
const soft = '#DCFCE7';
const display = googleFont('Black Han Sans', {weights: [400], fallback: 'sans-serif'});
const ui = googleFont('Noto Sans KR', {weights: [500], fallback: 'sans-serif'});
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} satisfies {extrapolateLeft: 'clamp'; extrapolateRight: 'clamp'};
const center: CSSProperties = {display: 'flex', alignItems: 'center', justifyContent: 'center'};

function span(frame: number, from: number, dur: number) {
  return interpolate(frame, [from, from + dur], [0, 1], {...clamp, easing: ease});
}

function pop(frame: number, at: number, dur: number, settle = false) {
  return spring({frame, fps: 30, delay: at, durationInFrames: dur, config: {overshootClamping: settle}});
}

function push(frame: number, at: number, dur: number, amount: number) {
  return 1 + amount * Math.sin(interpolate(frame, [at, at + dur], [0, 1], clamp) * Math.PI);
}

function Glyphs({text, frame, at, size, color, stagger = 3}: {text: string; frame: number; at: number; size: number; color: string; stagger?: number}) {
  return <span style={{display: 'flex', fontFamily: display, fontSize: size, fontWeight: 400, lineHeight: 1.1, letterSpacing: '-0.045em', color}}>
    {Array.from(text).map((glyph, index) => {
      const rise = span(frame, at + index * stagger, 12);
      return <span key={`${glyph}${index}`} style={{display: 'inline-block', overflow: 'hidden', height: '1.3em', paddingTop: '0.13em', paddingBottom: '0.12em', marginTop: '-0.13em', marginBottom: '-0.12em', paddingInline: '0.08em', marginInline: '-0.08em'}}>
        <span style={{display: 'inline-block', transform: `translateY(${(1 - rise) * 120}%)`, visibility: rise === 0 ? 'hidden' : 'visible'}}>{glyph === ' ' ? ' ' : glyph}</span>
      </span>;
    })}
  </span>;
}

function Hook({frame}: {frame: number}) {
  const escape = span(frame, 4, 54);
  const stay = pop(frame, 14, 16, true);
  return <AbsoluteFill style={{background: ink, overflow: 'hidden'}}>
    {[0, 1, 2, 3].map((i) => <div key={i} style={{position: 'absolute', left: 1080 + i * 170 + escape * 750, top: 190 + i * 175 + escape * 310, width: 230, height: 230, borderRadius: '50%', background: accent, transform: `rotate(${i * 14}deg)`}} />)}
    <div style={{position: 'absolute', left: 1110, top: 430, width: 400 * stay, height: 400 * stay, borderRadius: '50%', background: accent, ...center}}>
      <div style={{width: 180 * stay, height: 24, borderRadius: 20, background: ink}} />
    </div>
    <div style={{position: 'absolute', left: 150, top: 325}}><Glyphs text="왜 남지 않을까" frame={frame} at={-4} size={142} color={paper} stagger={1} /></div>
    <div style={{position: 'absolute', left: 158, top: 525, fontFamily: ui, fontSize: 44, color: soft}}>빠져나가는 돈, 붙잡을 방법은?</div>
  </AbsoluteFill>;
}

function Stack({frame}: {frame: number}) {
  const cover = span(frame, 164, 16) * 1250;
  return <AbsoluteFill style={{background: paper, overflow: 'hidden'}}>
    {[0, 1, 2, 3, 4].map((i) => {
      const p = pop(frame, 78 + i * 10, 16, true);
      return <div key={i} style={{position: 'absolute', left: 715 - i * 25, top: 690 - i * 76, width: 500 + i * 50, height: 118, borderRadius: 80, background: i === 4 ? accent : soft, border: `12px solid ${accent}`, transform: `translateY(${(1 - p) * 310}px)`}} />;
    })}
    <div style={{position: 'absolute', left: 150, top: 185}}><Glyphs text="한 번만 정하면" frame={frame} at={86} size={126} color={ink} /></div>
    <div style={{position: 'absolute', left: 158, top: 355, fontFamily: ui, fontSize: 46, color: ink}}>매달 차곡차곡 쌓여요</div>
    <AbsoluteFill style={{background: accent, clipPath: `circle(${cover}px at 50% 55%)`}} />
  </AbsoluteFill>;
}

const steps: [LucideIcon, string, string][] = [[Wallet, '지갑 연결', '예시 월 3만원'], [Repeat, '자동 반복', '예시 매달 1일'], [PiggyBank, '저금 시작', '예시 차곡차곡']];

function Cards({frame}: {frame: number}) {
  return <AbsoluteFill style={{background: soft, overflow: 'hidden'}}>
    <div style={{position: 'absolute', left: 150, top: 100}}><Glyphs text="복잡하지 않아요" frame={frame} at={180} size={116} color={ink} stagger={1} /></div>
    <div style={{position: 'absolute', left: 150, right: 150, top: 370, display: 'flex', gap: 42}}>
      {steps.map(([Icon, title, example], i) => {
        const p = pop(frame, 180 + i * 4, 12, true);
        return <div key={title} style={{position: 'relative', width: 478, height: 470, transform: `translateY(${(1 - p) * 520}px)`}}>
          <div style={{position: 'absolute', inset: '22px -22px -22px 22px', background: ink}} />
          <div style={{position: 'absolute', inset: 0, background: paper, padding: 54, display: 'flex', flexDirection: 'column', justifyContent: 'space-between'}}>
            <div style={{width: 132, height: 132, borderRadius: '50%', background: accent, ...center}}><Icon size={84} strokeWidth={2.5} color={ink} /></div>
            <div style={{fontFamily: display, fontSize: 72, lineHeight: 1.1, letterSpacing: '-0.04em', color: ink}}>{title}</div>
            <div style={{fontFamily: ui, fontSize: 42, color: ink}}>{example}</div>
          </div>
        </div>;
      })}
    </div>
  </AbsoluteFill>;
}

function Promise({frame}: {frame: number}) {
  const line = span(frame, 300, 16);
  return <AbsoluteFill style={{background: accent, overflow: 'hidden'}}>
    <div style={{position: 'absolute', left: 150, top: 260, width: 1240, height: 32, background: ink, transform: `scaleX(${line})`, transformOrigin: 'left'}} />
    <div style={{position: 'absolute', left: 150, top: 365}}><Glyphs text="매달 조금씩," frame={frame} at={300} size={146} color={ink} stagger={1} /></div>
    <div style={{position: 'absolute', left: 150, top: 545}}><Glyphs text="자동으로 모인다" frame={frame} at={306} size={146} color={ink} stagger={1} /></div>
    <div style={{position: 'absolute', right: 165, top: 295, width: 430, height: 430, borderRadius: '50%', background: soft, ...center}}><div style={{width: 280, height: 280, borderRadius: '50%', border: `28px solid ${ink}`}} /></div>
  </AbsoluteFill>;
}

function Name({frame}: {frame: number}) {
  const underline = span(frame, 375, 14);
  const tagline = span(frame, 378, 10);
  return <AbsoluteFill style={{background: ink, overflow: 'hidden', ...center, flexDirection: 'column', gap: 42}}>
    <Glyphs text="모으미" frame={frame} at={375} size={208} color={paper} stagger={3} />
    <div style={{width: 650, height: 28, background: accent, transform: `scaleX(${underline})`, transformOrigin: 'left'}} />
    <div style={{fontFamily: ui, fontSize: 48, color: soft, transform: `translateY(${(1 - tagline) * 80}px)`}}>작게 시작해도, 모임은 커진다</div>
  </AbsoluteFill>;
}

export function CmpMotionTerra() {
  const frame = useCurrentFrame();
  const camera = push(frame, 330, 30, 0.04);
  return <AbsoluteFill style={{background: ink, overflow: 'hidden'}}>
    <Audio src="/audio/generated/cmp-motion-terra/music.wav" volume={0.9} />
    <Sequence from={75} durationInFrames={30} layout="none"><Audio src="/audio/generated/cmp-motion-terra/whoosh.wav" volume={0.8} /></Sequence>
    <Sequence from={90} durationInFrames={30} layout="none"><Audio src="/audio/generated/cmp-motion-terra/pop.wav" volume={0.8} /></Sequence>
    <Sequence from={180} durationInFrames={30} layout="none"><Audio src="/audio/generated/cmp-motion-terra/click.wav" volume={0.8} /></Sequence>
    <Sequence from={375} durationInFrames={30} layout="none"><Audio src="/audio/generated/cmp-motion-terra/impact.wav" volume={0.8} /></Sequence>
    <AbsoluteFill style={{transform: `scale(${camera})`}}>
      {frame < 75 ? <Hook frame={frame} /> : null}
      {frame >= 75 && frame < 180 ? <Stack frame={frame} /> : null}
      {frame >= 180 && frame < 300 ? <Cards frame={frame} /> : null}
      {frame >= 300 && frame < 375 ? <Promise frame={frame} /> : null}
      {frame >= 375 ? <Name frame={frame} /> : null}
    </AbsoluteFill>
  </AbsoluteFill>;
}
