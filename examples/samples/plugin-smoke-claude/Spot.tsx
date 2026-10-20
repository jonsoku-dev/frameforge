import type {CSSProperties} from 'react';
import {AbsoluteFill, Audio, Easing, MotionProbe, MotionSound, googleFont, interpolate, spring, useCurrentFrame} from 'frameforge';
import {Bag, Bell, Cup} from '@/assets';

const display = googleFont('Black Han Sans', {weights: [400], fallback: 'sans-serif'});
const ui = googleFont('Noto Sans KR', {weights: [500], fallback: 'sans-serif'});
const ink = '#2B1D16';
const cream = '#FFF6E8';
const apricot = '#F29B5B';
const butter = '#FFD77A';
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} satisfies {extrapolateLeft: 'clamp'; extrapolateRight: 'clamp'};
const center: CSSProperties = {display: 'flex', alignItems: 'center', justifyContent: 'center'};
// Scene starts in frames; the brand hold is the last 60 frames.
const AT = {order: 0, bag: 75, bell: 150, brand: 225};
// Music hits at 2.5 s, 5 s and 7.5 s: no derived sound within half a second of them.
const QUIET = [AT.bag, AT.bell, AT.brand];

function span(frame: number, from: number, duration: number): number {
  return interpolate(frame, [from, from + duration], [0, 1], {...clamp, easing: ease});
}

function pop(frame: number, at: number, duration: number, settle = false): number {
  return spring({frame, fps: 30, delay: at, durationInFrames: duration, config: {overshootClamping: settle}});
}

function Glyphs({text, frame, at, size, color = ink}: {text: string; frame: number; at: number; size: number; color?: string}) {
  return <span style={{display: 'flex', color, fontFamily: display, fontSize: size, lineHeight: 1, letterSpacing: '-0.035em'}}>
    {Array.from(text).map((glyph, index) => {
      const rise = span(frame, at + index * 2, 12);
      return <span key={`${glyph}-${index}`} style={{display: 'inline-block', overflow: 'hidden', height: '1.3em', paddingTop: '0.15em', marginTop: '-0.15em', paddingInline: '0.08em', marginInline: '-0.08em'}}>
        <span style={{display: 'inline-block', transform: `translateY(${(1 - rise) * 120}%)`, visibility: rise === 0 ? 'hidden' : 'visible'}}>{glyph === ' ' ? ' ' : glyph}</span>
      </span>;
    })}
  </span>;
}

function Copy({text, frame, at, color = ink}: {text: string; frame: number; at: number; color?: string}) {
  return <div style={{position: 'absolute', left: 120, right: 120, top: 165, ...center}}><Glyphs text={text} frame={frame} at={at} size={150} color={color} /></div>;
}

function Order({frame}: {frame: number}) {
  const draw = span(frame, AT.order, 34);
  const scale = pop(frame, AT.order + 4, 22, true);
  return <AbsoluteFill style={{background: cream}}>
    <MotionProbe id="cup-draw" value={draw} family="shape" axis="progress" />
    <MotionProbe id="cup-pop" value={scale} family="shape" axis="scale" />
    <Copy text="갓 구운 아침" frame={frame} at={AT.order} />
    <Cup size={560} draw={draw} ink={ink} accent={apricot} soft={butter} paper={cream} style={{position: 'absolute', left: 680, top: 365, transform: `scale(${scale})`}} />
    <div style={{position: 'absolute', left: 0, right: 0, bottom: 125, ...center, color: ink, fontFamily: ui, fontSize: 46}}>가상 베이커리 앱 · 예시</div>
  </AbsoluteFill>;
}

function Packed({frame}: {frame: number}) {
  const wipe = span(frame, AT.bag, 14);
  const move = interpolate(frame, [AT.bag + 25, AT.bag + 59], [-680, 0], {...clamp, easing: ease});
  return <AbsoluteFill style={{background: cream}}>
    <AbsoluteFill style={{background: apricot, clipPath: `inset(0 ${(1 - wipe) * 100}% 0 0)`}}>
      <MotionProbe id="bag-move" value={move} family="card" axis="x" />
      <Copy text="한 번에 담고" frame={frame} at={AT.bag} color={cream} />
      <Bag size={600} draw={span(frame, AT.bag + 4, 30)} ink={cream} accent={butter} soft={cream} paper={apricot} style={{position: 'absolute', left: 660, top: 345, transform: `translateX(${move}px)`}} />
    </AbsoluteFill>
  </AbsoluteFill>;
}

function Arrival({frame}: {frame: number}) {
  const drop = interpolate(frame, [AT.bell + 20, AT.bell + 46], [-240, 0], {...clamp, easing: ease});
  const ring = pop(frame, AT.bell + 46, 20, true);
  return <AbsoluteFill style={{background: butter}}>
    <MotionProbe id="bell-drop" value={drop} family="card" axis="y" />
    <MotionProbe id="bell-ring" value={ring} family="shape" axis="scale" />
    <Copy text="주문이 도착" frame={frame} at={AT.bell} />
    <Bell size={540} draw={span(frame, AT.bell + 4, 26)} ink={ink} accent={apricot} soft={cream} paper={butter} style={{position: 'absolute', left: 690, top: 360, transform: `translateY(${drop}px) scale(${ring})`}} />
  </AbsoluteFill>;
}

function Brand({frame}: {frame: number}) {
  const lockup = pop(frame, AT.brand, 18, true);
  const tagline = span(frame, AT.brand + 24, 14);
  return <AbsoluteFill style={{background: ink, ...center, flexDirection: 'column', gap: 35}}>
    <MotionProbe id="brand-lockup" value={lockup} family="text" axis="scale" />
    <Cup size={420} draw={1} ink={cream} accent={apricot} soft={butter} paper={ink} style={{transform: `scale(${lockup})`}} />
    <Glyphs text="포근빵" frame={frame} at={AT.brand} size={200} color={cream} />
    <div style={{color: butter, fontFamily: ui, fontSize: 48, opacity: tagline}}>갓 구운 하루를 주문하세요</div>
  </AbsoluteFill>;
}

export function PluginSmokeClaude() {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{background: cream, overflow: 'hidden'}}>
    <Audio src="/audio/generated/plugin-smoke-claude/music.wav" volume={0.9} />
    <MotionSound src="/audio/generated/plugin-smoke-claude/whoosh.wav" role="move" families={['card']} quiet={QUIET} />
    <MotionSound src="/audio/generated/plugin-smoke-claude/pop.wav" role="land" families={['card', 'shape']} quiet={QUIET} />
    <MotionSound src="/audio/generated/plugin-smoke-claude/ding.wav" role="appear" families={['shape', 'text']} quiet={QUIET} />
    {frame < AT.bag ? <Order frame={frame} /> : null}
    {frame >= AT.bag && frame < AT.bell ? <Packed frame={frame} /> : null}
    {frame >= AT.bell && frame < AT.brand ? <Arrival frame={frame} /> : null}
    {frame >= AT.brand ? <Brand frame={frame} /> : null}
  </AbsoluteFill>;
}
