import {AbsoluteFill, Audio, Easing, Sequence, googleFont, interpolate, spring, useCurrentFrame} from 'frameforge';

const syne = googleFont('Syne', {weights: [800], fallback: 'sans-serif'});
const inter = googleFont('Inter', {weights: [500], fallback: 'sans-serif'});
const ink = '#101418';
const paper = '#F4F1EA';
const accent = '#E63946';
const FPS = 30;
const CX = 960;
const CY = 540;
const S = 280;
const BY = 606;
const XH = 0.5 * S;
const SW = 0.14 * S;
const DOT_R = 36;
const X0 = 510;
const DX = X0 + SW / 2;
const DY = BY - XH - DOT_R - 25;
const CLICKS = Array.from({length: 8}, (_, k) => 16 + 2 * k);
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} satisfies {
  extrapolateLeft: 'clamp';
  extrapolateRight: 'clamp';
};

function span(frame: number, from: number, dur: number): number {
  return interpolate(frame, [from, from + dur], [0, 1], {...clamp, easing: ease});
}

// Two concentric rings of four quarter bands. k 0-3 outer, 4-7 inner; each enters from its own quadrant's corner.
const PIECES = Array.from({length: 8}, (_, k) => {
  const quadrant = k % 4;
  const outer = k < 4;
  const r1 = outer ? 150 : 96;
  const r2 = outer ? 190 : 134;
  const a0 = (quadrant * 90 - 90) * Math.PI / 180;
  const a1 = a0 + Math.PI / 2;
  const at = (r: number, a: number) => `${(CX + r * Math.cos(a)).toFixed(2)} ${(CY + r * Math.sin(a)).toFixed(2)}`;
  const d = `M ${at(r2, a0)} A ${r2} ${r2} 0 0 1 ${at(r2, a1)} L ${at(r1, a1)} A ${r1} ${r1} 0 0 0 ${at(r1, a0)} Z`;
  return {k, d, dir: a0 + Math.PI / 4};
});

function Ring({frame}: {frame: number}) {
  const lock = span(frame, 96, 16);
  const spin = 45 * span(frame, 56, 40) * (1 - lock);
  const shrink = 1 - interpolate(frame, [122, 140], [0, 1], {...clamp, easing: Easing.inOut(Easing.quad)});
  return <g transform={`translate(${CX} ${CY}) scale(${shrink}) translate(${-CX} ${-CY})`}>
    {PIECES.map(({k, d, dir}) => {
      const enter = spring({frame, fps: FPS, delay: 2 * k, durationInFrames: 16});
      const reach = 90 * (1 - lock) + 1300 * (1 - enter);
      return <path key={k} d={d} fill={paper} transform={`rotate(${spin} ${CX} ${CY}) translate(${Math.cos(dir) * reach} ${Math.sin(dir) * reach})`} />;
    })}
  </g>;
}

function Dot({frame}: {frame: number}) {
  const grow = interpolate(frame, [128, 140], [0, 1], clamp);
  const travel = span(frame, 140, 24);
  return <circle cx={CX + (DX - CX) * travel} cy={CY + (DY - CY) * travel} r={DOT_R * grow} fill={accent} />;
}

function Stem({frame}: {frame: number}) {
  const rise = span(frame, 164, 16);
  return <rect x={X0} y={BY - XH} width={SW} height={XH} fill={paper} style={{transformOrigin: `${X0 + SW / 2}px ${BY}px`, transform: `scaleY(${rise})`}} />;
}

function Glyphs({text, frame, at, size, color, stagger = 4}: {text: string; frame: number; at: number; size: number; color: string; stagger?: number}) {
  return <span style={{display: 'flex', color, fontFamily: syne, fontSize: size, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.01em'}}>
    {Array.from(text).map((glyph, index) => {
      const rise = span(frame, at + index * stagger, 12);
      // The mask grows upward and sideways so a glyph rising past the 1em line box is not clipped; negative margins keep the glyph's position.
      return <span key={index} style={{display: 'inline-block', overflow: 'hidden', height: '1.15em', paddingTop: '0.1em', marginTop: '-0.1em', paddingInline: '0.06em', marginInline: '-0.06em'}}>
        <span style={{display: 'inline-block', transform: `translateY(${(1 - rise) * 120}%)`, visibility: rise === 0 ? 'hidden' : 'visible'}}>{glyph}</span>
      </span>;
    })}
  </span>;
}

function Label({frame}: {frame: number}) {
  const rise = span(frame, 224, 15);
  return <div style={{position: 'absolute', left: 0, right: 0, top: BY + 64, height: 48, overflow: 'hidden', textAlign: 'center', fontFamily: inter, fontWeight: 500, fontSize: 40, lineHeight: '48px', letterSpacing: '0.3em', color: paper}}>
    <div style={{transform: `translateY(${(1 - rise) * 100}%)`}}>MOTION STUDIO</div>
  </div>;
}

export function Spot() {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{background: ink, overflow: 'hidden'}}>
    <Audio src="/audio/generated/logo-reveal/music.wav" volume={0.9} />
    {CLICKS.map(at => <Sequence key={at} from={at} durationInFrames={30} layout="none"><Audio src="/audio/generated/logo-reveal/click.wav" volume={0.35} /></Sequence>)}
    <Sequence from={112} durationInFrames={30} layout="none"><Audio src="/audio/generated/logo-reveal/impact.wav" volume={0.8} /></Sequence>
    <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0}}>
      <Ring frame={frame} />
      <Dot frame={frame} />
      <Stem frame={frame} />
    </svg>
    <div style={{position: 'absolute', left: X0 + SW + 17, top: BY - 0.8 * S}}>
      <Glyphs text="ldra" frame={frame} at={176} size={S} color={paper} />
    </div>
    <Label frame={frame} />
    <AbsoluteFill style={{background: paper, opacity: frame === 112 ? 1 : frame === 113 ? 0.7 : 0}} />
  </AbsoluteFill>;
}
