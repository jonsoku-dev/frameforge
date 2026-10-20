import type {CSSProperties, ReactNode} from 'react';
import {Anchor, Mountain, Sun} from 'lucide-react';
import {AbsoluteFill, Audio, Easing, Sequence, googleFont, interpolate, spring, useCurrentFrame} from 'frameforge';

const headline = googleFont('Black Han Sans', {weights: [400], fallback: 'sans-serif'});
const ui = googleFont('Noto Sans KR', {weights: [500], fallback: 'sans-serif'});
const sky = '#1C3F8C';
const sand = '#F3E7D3';
const accent = '#FF7A59';
const ink = '#101828';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} satisfies {extrapolateLeft: 'clamp'; extrapolateRight: 'clamp'};
const ease = Easing.bezier(0.16, 1, 0.3, 1);

function span(frame: number, from: number, duration: number) {
  return interpolate(frame, [from, from + duration], [0, 1], {...clamp, easing: ease});
}

function pop(frame: number, at: number, duration: number, settle = true) {
  return spring({frame, fps: 30, delay: at, durationInFrames: duration, config: {overshootClamping: settle}});
}

function Glyphs({text, frame, at, size, color, family, stagger = 2}: {text: string; frame: number; at: number; size: number; color: string; family: string; stagger?: number}) {
  return <span style={{display: 'flex', color, fontFamily: family, fontSize: size, fontWeight: 400, lineHeight: 1, letterSpacing: '-0.045em'}}>
    {Array.from(text).map((glyph, index) => {
      const rise = span(frame, at + index * stagger, 12);
      return <span key={`${glyph}-${index}`} style={{display: 'inline-block', overflow: 'hidden', height: '1.55em', paddingTop: '0.16em', marginTop: '-0.16em', paddingInline: '0.09em', marginInline: '-0.09em'}}>
        <span style={{display: 'inline-block', transform: `translateY(${(1 - rise) * 120}%)`, visibility: rise === 0 ? 'hidden' : 'visible'}}>{glyph === ' ' ? ' ' : glyph}</span>
      </span>;
    })}
  </span>;
}

function Horizon({frame}: {frame: number}) {
  const draw = span(frame, 0, 42);
  const wipe = span(frame, 36, 42);
  return <AbsoluteFill style={{background: sand, overflow: 'hidden'}}>
    <div style={{position: 'absolute', inset: 0, background: sky, clipPath: `inset(0 0 ${(1 - wipe) * 100}% 0)`}} />
    <div style={{position: 'absolute', left: 96, top: 540, width: 1728, height: 18, background: ink, transform: `scaleX(${draw})`, transformOrigin: 'left'}} />
  </AbsoluteFill>;
}

type LandmarkProps = {frame: number; at: number; x: number; label: string; icon: ReactNode; children: ReactNode};
function Landmark({frame, at, x, label, icon, children}: LandmarkProps) {
  const enter = pop(frame, at, 16);
  const leave = span(frame, 270, 30);
  const labelEnter = pop(frame, at + 8, 10);
  return <div style={{position: 'absolute', left: x, top: 540, transform: `translateY(${(1 - enter) * 180 - leave * 20}px) scale(${1 - leave * 0.72})`, transformOrigin: 'bottom left'}}>
    {children}
    <div style={{position: 'absolute', top: 78, left: 0, width: 230, display: 'flex', alignItems: 'center', gap: 12, opacity: labelEnter * (1 - leave), transform: `translateY(${(1 - labelEnter) * 30}px)`}}>
      {icon}
      <Glyphs text={label} frame={frame} at={at + 9} size={42} color={ink} family={ui} stagger={1} />
    </div>
  </div>;
}

function Landmarks({frame}: {frame: number}) {
  const strip = span(frame, 300, 30);
  return <AbsoluteFill style={{overflow: 'hidden'}}>
    <Landmark frame={frame} at={96} x={320} label="Beacon" icon={<Anchor size={48} strokeWidth={2.5} color={ink} />}>
      <div style={{position: 'absolute', left: 0, bottom: 0, width: 120, height: 300, background: accent}} />
      <div style={{position: 'absolute', left: -20, bottom: 300, width: 0, height: 0, borderLeft: '80px solid transparent', borderRight: '80px solid transparent', borderBottom: `120px solid ${accent}`}} />
    </Landmark>
    <Landmark frame={frame} at={150} x={520} label="Crossing" icon={<Sun size={48} strokeWidth={2.5} color={ink} />}>
      <div style={{position: 'absolute', left: 0, bottom: 0, width: 720, height: 130, borderTop: `28px solid ${accent}`, borderRadius: '50% 50% 0 0', transform: 'rotate(180deg)', transformOrigin: 'center bottom'}} />
      <div style={{position: 'absolute', left: 80, bottom: 0, width: 28, height: 115, background: accent}} />
      <div style={{position: 'absolute', left: 570, bottom: 0, width: 28, height: 115, background: accent}} />
    </Landmark>
    <Landmark frame={frame} at={204} x={1320} label="Outlook" icon={<Mountain size={48} strokeWidth={2.5} color={ink} />}>
      {[0, 1, 2].map((square) => <div key={square} style={{position: 'absolute', left: (2 - square) * 24, bottom: square * 94, width: 144 - square * 24, height: 94, background: accent}} />)}
    </Landmark>
    <div style={{position: 'absolute', left: 220, top: 520, width: 1480, height: 60, background: accent, transform: `scaleX(${strip})`, transformOrigin: 'left'}} />
  </AbsoluteFill>;
}

function Finale({frame}: {frame: number}) {
  const slam = pop(frame, 360, 14, true);
  const tag = pop(frame, 378, 12, true);
  const nameStyle: CSSProperties = {position: 'absolute', top: 220, fontFamily: headline, fontSize: 176, fontWeight: 400, lineHeight: 1, color: ink};
  return <AbsoluteFill style={{background: sand, overflow: 'hidden'}}>
    <div style={{position: 'absolute', left: 220, top: 520, width: 1480, height: 60, background: accent}} />
    <div style={{position: 'absolute', left: 420, top: 430, width: 1050, height: 90, background: accent}} />
    <div style={{...nameStyle, left: 182, transform: `translateX(${(slam - 1) * 900}px)`}}><Glyphs text="VELORA" frame={frame} at={346} size={176} color={ink} family={headline} stagger={0} /></div>
    <div style={{...nameStyle, right: 180, transform: `translateX(${(1 - slam) * 900}px)`}}><Glyphs text="COVE" frame={frame} at={346} size={176} color={ink} family={headline} stagger={0} /></div>
    <div style={{position: 'absolute', left: 0, right: 0, top: 730, display: 'flex', justifyContent: 'center', opacity: tag, transform: `translateY(${(1 - tag) * 80}px)`}}>
      <Glyphs text="Where horizons become home" frame={frame} at={370} size={58} color={ink} family={ui} stagger={0} />
    </div>
  </AbsoluteFill>;
}

export function Spot() {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{background: sand, overflow: 'hidden'}}>
    <Audio src="/audio/generated/travel-poster/music.wav" volume={0.9} />
    {[96, 150, 204].map((at) => <Sequence key={at} from={at} durationInFrames={30} layout="none"><Audio src="/audio/generated/travel-poster/whoosh.wav" volume={0.8} /></Sequence>)}
    <Sequence from={360} durationInFrames={30} layout="none"><Audio src="/audio/generated/travel-poster/impact.wav" volume={0.8} /></Sequence>
    <Horizon frame={frame} />
    {frame >= 90 && frame < 360 ? <Landmarks frame={frame} /> : null}
    {frame >= 360 ? <Finale frame={frame} /> : null}
  </AbsoluteFill>;
}
