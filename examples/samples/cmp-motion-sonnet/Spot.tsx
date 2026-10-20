import type {CSSProperties, ReactNode} from 'react';
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
const AT = {hook: 0, turn: 75, steps: 180, promise: 300, name: 372, still: 390};
const COIN = {x: 1350, y: 540, d: 440};
const STACK = {base: 850, pitch: 84, w: 400, h: 76, n: 7};
const CARD = {w: 530, h: 640, top: 270, gap: 50, left: 115};
const cardCenter = (i: number): [number, number] => [CARD.left + i * (CARD.w + CARD.gap) + CARD.w / 2, CARD.top + 260];

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

function Glyphs({text, frame, at, size = SIZES.headline, color = ink, stagger = 2, out}: {text: string; frame: number; at: number; size?: number; color?: string; stagger?: number; out?: number}) {
  return <span style={{display: 'flex', color, fontFamily: display, fontSize: size, fontWeight: 400, lineHeight: 1, letterSpacing: '-0.02em', whiteSpace: 'pre'}}>
    {Array.from(text).map((glyph, index) => {
      const rise = span(frame, at + index * stagger, 12) - (out === undefined ? 0 : span(frame, out + index, 8));
      // Black Han Sans ink overshoots the 1em line box above and below, so the mask grows both ways without moving the glyph.
      return <span key={index} style={{display: 'inline-block', overflow: 'hidden', height: '1.3em', paddingTop: '0.12em', marginTop: '-0.12em', paddingBottom: '0.12em', marginBottom: '-0.12em', paddingInline: '0.08em', marginInline: '-0.08em'}}>
        <span style={{display: 'inline-block', transform: `translateY(${(1 - rise) * 125}%)`, visibility: rise <= 0 ? 'hidden' : 'visible'}}>{glyph}</span>
      </span>;
    })}
  </span>;
}

/** A UI line that reveals left to right by clip-path instead of fading. */
function Label({frame, at, children, size = SIZES.label, color = ink, style}: {frame: number; at: number; children: ReactNode; size?: number; color?: string; style?: CSSProperties}) {
  return <div style={{fontFamily: ui, fontWeight: 500, fontSize: size, lineHeight: 1.3, color, whiteSpace: 'nowrap', clipPath: `inset(-10% ${(1 - span(frame, at, 12)) * 100}% -10% 0)`, ...style}}>{children}</div>;
}

const flat = (x: number, y: number, w: number, h: number, color: string): CSSProperties =>
  ({position: 'absolute', left: x - w / 2, top: y - h / 2, width: w, height: h, borderRadius: Math.min(w, h) / 2, background: color});

function Hook({frame}: {frame: number}) {
  const coin = pop(frame, 0, 18) * COIN.d;
  return <AbsoluteFill style={{background: ink}}>
    {Array.from({length: 9}, (_, i) => {
      const t = Math.max(0, frame - (8 + i * 6));
      const x = COIN.x + (random(`x${i}`) - 0.5) * 380 - t * (3 + random(`v${i}`) * 5);
      const y = COIN.y + t * t * 0.55;
      return t > 0 ? <div key={i} style={flat(x, y, 90, 90, soft)} /> : null;
    })}
    <div style={flat(COIN.x, COIN.y, coin, coin, accent)} />
    <div style={{position: 'absolute', left: SIZES.marginX, top: 280, display: 'flex', flexDirection: 'column', gap: 24}}>
      <Glyphs text="월급은" frame={frame} at={6} size={170} color={paper} />
      <Glyphs text="어디로 갔지?" frame={frame} at={16} size={170} color={paper} />
    </div>
  </AbsoluteFill>;
}

function Turn({frame}: {frame: number}) {
  const wipe = span(frame, AT.turn, 24) * 1500;
  const squash = span(frame, AT.turn, 26);
  const collapse = span(frame, 168, 18);
  const coins = Array.from({length: STACK.n}, (_, i) => {
    const land = i === 0 ? 1 : pop(frame, 92 + i * 10, 12, true);
    const y = STACK.base - i * STACK.pitch;
    return i === 0 ? null : <div key={i} style={{...flat(COIN.x, y, STACK.w, STACK.h, accent), boxShadow: `0 12px 0 ${ink}`, transform: `translateY(${(land - 1) * 600}px)`, visibility: land <= 0.01 ? 'hidden' : 'visible'}} />;
  });
  const baseW = interpolate(squash, [0, 1], [COIN.d, STACK.w]);
  const baseH = interpolate(squash, [0, 1], [COIN.d, STACK.h]);
  return <AbsoluteFill>
    {frame < AT.steps ? <AbsoluteFill style={{background: soft, clipPath: `circle(${wipe}px at ${COIN.x}px ${COIN.y}px)`}} /> : null}
    <div style={{position: 'absolute', inset: 0, transformOrigin: `${COIN.x}px ${STACK.base + 40}px`, transform: `scaleY(${1 - collapse})`}}>
      <div style={{...flat(COIN.x, interpolate(squash, [0, 1], [COIN.y, STACK.base]), baseW, baseH, accent), boxShadow: squash > 0.9 ? `0 12px 0 ${ink}` : 'none'}} />
      {coins}
    </div>
    <div style={{position: 'absolute', left: SIZES.marginX, top: 330}}>
      <Glyphs text="매달 조금씩" frame={frame} at={80} size={150} out={166} />
      <Label frame={frame} at={104} size={52} style={{marginTop: 40}}>매달 3만원씩 · 예시</Label>
    </div>
  </AbsoluteFill>;
}

const STEPS: [LucideIcon, string, string][] = [[Wallet, '월급이 들어오면', '월급 250만원 · 예시'], [Repeat, '매달 자동 이체', '3만원 이체 · 예시'], [PiggyBank, '저금통에 쏙', '']];

function Steps({frame}: {frame: number}) {
  const months = Math.round(12 * span(frame, 236, 40));
  return <AbsoluteFill style={{background: soft}}>
    <div style={{position: 'absolute', left: SIZES.marginX, top: 70}}><Glyphs text="세 걸음이면 끝" frame={frame} at={190} size={130} /></div>
    {STEPS.map(([Icon, title, sub], i) => {
      const p = pop(frame, AT.steps + 2 + i * 8, 18, true);
      const [cx, cy] = cardCenter(i);
      const left = CARD.left + i * (CARD.w + CARD.gap);
      const ip = pop(frame, AT.steps + 20 + i * 8, 16);
      return <div key={title} style={{position: 'absolute', left, top: CARD.top, width: CARD.w, height: CARD.h, transform: `translate(${(COIN.x - cx) * (1 - p)}px, ${(COIN.y + 40 - cy) * (1 - p)}px) scale(${0.25 + 0.75 * p})`, visibility: p <= 0.01 ? 'hidden' : 'visible'}}>
        <div style={{position: 'absolute', left: 24, top: 24, width: '100%', height: '100%', background: ink, borderRadius: 28}} />
        <div style={{position: 'absolute', inset: 0, background: paper, borderRadius: 28, overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
          <div style={{...flat(60, 60, 64, 64, ink), ...{position: 'absolute', left: 28, top: 28}, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: ui, fontWeight: 500, fontSize: 40, color: paper}}>{i + 1}</div>
          <div style={{marginTop: 80, width: 220, height: 220, borderRadius: '50%', background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${ip})`}}>
            <Icon size={140} strokeWidth={2.5} color={ink} />
          </div>
          <div style={{marginTop: 56, fontFamily: ui, fontWeight: 500, fontSize: 50, color: ink, whiteSpace: 'nowrap'}}>{title}</div>
          <Label frame={frame} at={AT.steps + 30 + i * 8} style={{marginTop: 24}}>{i < 2 ? sub : `${months}개월 후 ${months * 3}만원 · 예시`}</Label>
        </div>
      </div>;
    })}
  </AbsoluteFill>;
}

function Promise({frame}: {frame: number}) {
  const [px, py] = cardCenter(2);
  return <AbsoluteFill style={{background: accent, clipPath: `circle(${span(frame, AT.promise, 24) * 2300}px at ${px}px ${py}px)`}}>
    <div style={{position: 'absolute', left: SIZES.marginX + 40, top: 210, display: 'flex', flexDirection: 'column', gap: 36}}>
      <Glyphs text="매달 조금씩," frame={frame} at={304} size={260} />
      <Glyphs text="자동으로 모인다" frame={frame} at={312} size={260} />
    </div>
    <div style={{position: 'absolute', left: SIZES.marginX + 40, top: 880, width: 1250, height: 28, background: ink, transformOrigin: 'left center', transform: `scaleX(${span(frame, 330, 16)})`}} />
  </AbsoluteFill>;
}

function Name({frame}: {frame: number}) {
  return <AbsoluteFill style={{background: accent}}>
    <AbsoluteFill style={{background: ink, clipPath: `inset(${(1 - span(frame, AT.name, 14)) * 100}% 0 0 0)`}} />
    <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 44}}>
      <Glyphs text="달콩" frame={frame} at={AT.name + 2} size={380} color={paper} />
      <div style={{width: 760, height: 24, background: accent, transformOrigin: 'left center', transform: `scaleX(${span(frame, 380, 10)})`}} />
      <Label frame={frame} at={378} size={64} color={paper}>매달 조금씩, 자동으로 모인다</Label>
    </div>
    <Label frame={frame} at={380} size={SIZES.label} color={soft} style={{position: 'absolute', left: 0, right: 0, bottom: SIZES.marginY + 10, textAlign: 'center'}}>가상 브랜드 · 샘플 데이터</Label>
  </AbsoluteFill>;
}

export function Spot() {
  const frame = useCurrentFrame();
  const camera = push(frame, 326, 34, 0.05);
  const at = (from: number, name: string, volume = 0.8) => <Sequence key={`${name}${from}`} from={from} durationInFrames={30} layout="none"><Audio src={`/audio/generated/cmp-motion-sonnet/${name}.wav`} volume={volume} /></Sequence>;
  return <AbsoluteFill style={{background: ink, overflow: 'hidden'}}>
    <Audio src="/audio/generated/cmp-motion-sonnet/music.wav" volume={0.9} />
    {[[75, 'whoosh'], [300, 'whoosh'], [102, 'pop'], [122, 'pop'], [142, 'pop'], [162, 'pop'], [374, 'pop'], [186, 'click'], [194, 'click'], [202, 'click']].map(([f, n]) => at(f as number, n as string))}
    <AbsoluteFill style={{transform: `scale(${camera})`}}>
      {frame < AT.turn + 1 ? <Hook frame={frame} /> : null}
      {frame >= AT.steps && frame < AT.promise + 24 ? <Steps frame={frame} /> : null}
      {frame >= AT.turn && frame < AT.steps + 10 ? <Turn frame={frame} /> : null}
      {frame >= AT.promise && frame < AT.name + 14 ? <Promise frame={frame} /> : null}
      {frame >= AT.name ? <Name frame={frame} /> : null}
    </AbsoluteFill>
  </AbsoluteFill>;
}
