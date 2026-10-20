import type {LucideIcon} from 'lucide-react';
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
const disc = {cx: 1370, cy: 480, d: 620};
const base = {x: 460, y: 770, d: 400};
const cues: [number, string][] = [[4, 'whoosh'], [75, 'pop'], [96, 'tick'], [128, 'tick2'], [176, 'whoosh2'], [176, 'click'], [202, 'click2'], [228, 'click3'], [300, 'whoosh3'], [366, 'ding']];
const cards: {icon: LucideIcon; kicker: string; amount: string; at: number; bg: string; fg: string; pill: string; pillFg: string}[] = [
  {icon: Wallet, kicker: '월급에서', amount: '3만원', at: 176, bg: ink, fg: paper, pill: soft, pillFg: ink},
  {icon: Repeat, kicker: '같은 날', amount: '매월 1일', at: 202, bg: soft, fg: ink, pill: ink, pillFg: paper},
  {icon: PiggyBank, kicker: '열두 달', amount: '36만원', at: 228, bg: accent, fg: ink, pill: ink, pillFg: paper},
];

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

function Glyphs({text, frame, at, out, size = SIZES.headline, color = ink, stagger = 2, dur = 10}: {text: string; frame: number; at: number; out?: number; size?: number; color?: string; stagger?: number; dur?: number}) {
  return <span style={{display: 'flex', color, fontFamily: display, fontSize: size, fontWeight: 400, lineHeight: 1, letterSpacing: '-0.03em'}}>
    {Array.from(text).map((glyph, index) => {
      const enter = span(frame, at + index * stagger, dur);
      const leave = out == null ? 0 : span(frame, out + index * stagger, 8);
      const rise = Math.max(0, enter - leave);
      // Black Han Sans ink sits outside a 1em box; padding grows the mask and the negative margin keeps the glyph put.
      return <span key={index} style={{display: 'inline-block', overflow: 'hidden', height: '1.36em', paddingTop: '0.18em', marginTop: '-0.18em', paddingBottom: '0.06em', marginBottom: '-0.06em', paddingInline: '0.1em', marginInline: '-0.1em'}}>
        <span style={{display: 'inline-block', transform: `translateY(${(1 - enter - leave) * 110}%)`, visibility: rise === 0 ? 'hidden' : 'visible'}}>{glyph === ' ' ? ' ' : glyph}</span>
      </span>;
    })}
  </span>;
}

function leakPose(frame: number, i: number) {
  const t = span(frame, i * 9, 64);
  const slide = Math.min(1, t / 0.55);
  const drop = Math.max(0, (t - 0.55) / 0.45);
  return {x: disc.cx + slide * 420, y: disc.cy - 40 + drop * drop * 820, t};
}

function heroPose(frame: number) {
  const caught = leakPose(75, 4);
  if (frame <= 75) return {x: leakPose(frame, 4).x, y: leakPose(frame, 4).y, d: 120};
  const k = pop(frame, 75, 20);
  return {x: caught.x + (base.x - caught.x) * k, y: caught.y + (base.y - caught.y) * k, d: 120 + (base.d - 120) * k};
}

function Coin({x, y, d, color = accent, face = false}: {x: number; y: number; d: number; color?: string; face?: boolean}) {
  return <div style={{position: 'absolute', left: x - d / 2, top: y - d / 2, width: d, height: d, borderRadius: '50%', background: color}}>
    {face ? <div style={{position: 'absolute', inset: '24%', borderRadius: '50%', background: ink}} /> : null}
  </div>;
}

function Leak({frame}: {frame: number}) {
  const hero = heroPose(frame);
  const fold = span(frame, 75, 16);
  const open = span(frame, 80, 18);
  const draw = span(frame, 96, 36);
  const piles = [{at: 96, y: 655, d: 250}, {at: 112, y: 545, d: 190}, {at: 128, y: 455, d: 150}];
  const curve = 'M 640 640 C 980 600, 1320 250, 1780 300';
  return <>
    {frame < 250 ? <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0, clipPath: `circle(${open * 1600}px at ${base.x}px ${base.y}px)`}}>
      <path d={`${curve} L 1780 1000 L 160 1000 L 160 700 Z`} fill={soft} />
      <path d={curve} fill="none" stroke={accent} strokeWidth={26} strokeLinecap="round" strokeDasharray={2000} strokeDashoffset={2000 * (1 - draw)} />
    </svg> : null}
    {fold < 1 ? <div style={{position: 'absolute', left: disc.cx - disc.d / 2, top: disc.cy - disc.d / 2, width: disc.d, height: disc.d, transform: `translate(${(hero.x - disc.cx) * fold}px, ${(hero.y - disc.cy) * fold}px) scale(${1 - fold})`}}>
      <div style={{position: 'absolute', inset: 0, borderRadius: '50%', background: accent}} />
      <div style={{position: 'absolute', inset: '16%', borderRadius: '50%', background: soft}} />
      <div style={{position: 'absolute', left: 460, top: 380, width: 230, height: 230, borderRadius: '50%', background: paper}} />
    </div> : null}
    {frame < 150 ? [0, 1, 2, 3].map(i => {
      const c = leakPose(frame, i);
      return c.y > H + 80 ? null : <Coin key={i} x={c.x} y={c.y} d={128} color={ink} />;
    }) : null}
    {piles.map(pile => {
      const k = pop(frame, pile.at, 16);
      return k === 0 || frame >= 250 ? null : <Coin key={pile.at} x={base.x} y={base.y + (pile.y - base.y) * k} d={pile.d * k} face />;
    })}
    {frame < 250 ? <Coin x={hero.x} y={hero.y} d={hero.d} face /> : null}
    <div style={{position: 'absolute', left: SIZES.marginX, top: 390}}><Glyphs text="월급이 샌다" frame={frame} at={0} out={64} size={132} stagger={1} dur={8} /></div>
    <div style={{position: 'absolute', left: SIZES.marginX, top: SIZES.marginY + 16}}><Glyphs text="푼이 쌓인다" frame={frame} at={68} out={168} size={128} stagger={1} dur={8} /></div>
  </>;
}

function Steps({frame}: {frame: number}) {
  return <>
    {cards.map((card, index) => {
      const rise = span(frame, card.at, 16);
      return <div key={card.kicker} style={{position: 'absolute', left: index * 640, top: 0, width: 640, height: H, background: card.bg, transform: `scaleY(${rise})`, transformOrigin: 'bottom', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28}}>
        <span style={{display: 'inline-flex', transform: `scale(${pop(frame, card.at + 8, 14)})`}}><card.icon size={100} strokeWidth={2.5} color={card.fg} /></span>
        <div style={{fontFamily: ui, fontWeight: 500, fontSize: 48, color: card.fg}}>{card.kicker}</div>
        <div style={{fontFamily: ui, fontWeight: 500, fontSize: 80, color: card.fg}}>{card.amount}</div>
        <div style={{fontFamily: ui, fontWeight: 500, fontSize: 40, color: card.pillFg, background: card.pill, borderRadius: 999, padding: '8px 22px'}}>예시</div>
      </div>;
    })}
  </>;
}

function PromiseLine({frame}: {frame: number}) {
  const wipe = span(frame, 300, 14);
  return <AbsoluteFill style={{background: accent, clipPath: `circle(${wipe * 1760}px at 1528px 550px)`, alignItems: 'center', justifyContent: 'center', display: 'flex', flexDirection: 'column', gap: 12}}>
    <Glyphs text="매달 조금씩," frame={frame} at={304} size={132} color={paper} stagger={1} dur={8} />
    <Glyphs text="자동으로 모인다" frame={frame} at={308} size={132} color={paper} stagger={1} dur={8} />
  </AbsoluteFill>;
}

function Name({frame}: {frame: number}) {
  const k = span(frame, 362, 22);
  const cx = 1528 + (420 - 1528) * k;
  const cy = 550 + (500 - 550) * k;
  const r = 1760 + (250 - 1760) * k;
  const tag = span(frame, 368, 14);
  return <AbsoluteFill style={{background: ink}}>
    <div style={{position: 'absolute', left: cx - r, top: cy - r, width: r * 2, height: r * 2, borderRadius: '50%', background: accent}}>
      <div style={{position: 'absolute', inset: '18%', borderRadius: '50%', background: soft, transform: `scale(${span(frame, 376, 8)})`}} />
    </div>
    <div style={{position: 'absolute', left: 760, top: 340, display: 'flex', flexDirection: 'column', gap: 28}}>
      <Glyphs text="푼탑" frame={frame} at={366} size={210} color={paper} stagger={2} dur={8} />
      <div style={{width: 720, height: 22, background: accent, transform: `scaleX(${span(frame, 372, 12)})`, transformOrigin: 'left'}} />
      <div style={{overflow: 'hidden', height: 78, paddingTop: 10, marginTop: -10, paddingInline: 8, marginInline: -8}}>
        <div style={{transform: `translateY(${(1 - tag) * 110}%)`}}>
          <span style={{fontFamily: ui, fontWeight: 500, fontSize: 46, color: paper, lineHeight: 1}}>매달 조금씩, 자동으로 모인다</span>
        </div>
      </div>
    </div>
  </AbsoluteFill>;
}

export function Spot() {
  const frame = useCurrentFrame();
  const camera = push(frame, 324, 26, 0.04);
  return <AbsoluteFill style={{background: paper, overflow: 'hidden'}}>
    <Audio src="/audio/generated/cmp-motion-grok47/music.wav" volume={0.9} />
    {cues.map(([at, name]) => <Sequence key={`${name}${at}`} from={at} durationInFrames={30} layout="none"><Audio src={`/audio/generated/cmp-motion-grok47/${name}.wav`} volume={0.8} /></Sequence>)}
    <AbsoluteFill style={{transform: `scale(${camera})`}}>
      {frame < 250 ? <Leak frame={frame} /> : null}
      {frame >= 174 && frame < 330 ? <Steps frame={frame} /> : null}
      {frame >= 300 && frame < 374 ? <PromiseLine frame={frame} /> : null}
      {frame >= 362 ? <Name frame={frame} /> : null}
    </AbsoluteFill>
  </AbsoluteFill>;
}
