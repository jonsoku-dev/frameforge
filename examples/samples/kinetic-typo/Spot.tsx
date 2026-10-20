import type {CSSProperties} from 'react';
import {AbsoluteFill, Audio, Easing, Sequence, googleFont, interpolate, spring, useCurrentFrame} from 'frameforge';

const headline = googleFont('Black Han Sans', {weights: [400], fallback: 'sans-serif'});
const ui = googleFont('Noto Sans KR', {weights: [500], fallback: 'sans-serif'});
const ink = '#1A1A1A';
const paper = '#FFF7E6';
const accent = '#FFC300';
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} satisfies {
  extrapolateLeft: 'clamp';
  extrapolateRight: 'clamp';
};
const center: CSSProperties = {alignItems: 'center', justifyContent: 'center'};
const items = [84, 100, 116, 130, 144, 156, 168, 178];
const cut = 216;
// Final sentence: three centered lines; the big 오늘 flies down into the last one.
const line = {size: 260, tops: [505, 805, 1105]};

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

function Glyphs({text, frame, at, size, color, stagger = 3}: {text: string; frame: number; at: number; size: number; color: string; stagger?: number}) {
  return <span style={{display: 'flex', color, fontSize: size, fontWeight: 400, lineHeight: 1, letterSpacing: '-0.02em'}}>
    {Array.from(text).map((glyph, index) => {
      const rise = span(frame, at + index * stagger, 12);
      // Black Han Sans ink reaches above the 1em line box, so the mask grows upward without moving the glyph.
      return <span key={`${glyph}${index}`} style={{display: 'inline-block', overflow: 'hidden', height: '1.3em', paddingTop: '0.15em', marginTop: '-0.15em', paddingInline: '0.08em', marginInline: '-0.08em'}}>
        <span style={{display: 'inline-block', transform: `translateY(${(1 - rise) * 120}%)`, visibility: rise === 0 ? 'hidden' : 'visible'}}>{glyph === ' ' ? ' ' : glyph}</span>
      </span>;
    })}
  </span>;
}

function Stamp({frame, open}: {frame: number; open: number}) {
  const land = pop(frame, 0, 12);
  const plate = pop(frame, 12, 12);
  const ring = span(frame, 12, 28);
  const grow = span(frame, 56, 24);
  // The label parks in the corner before the first headline glyph shows at 66.
  const move = span(frame, 56, 22);
  const radius = 340 + ring * 480;
  const plateW = interpolate(grow, [0, 1], [820, 1080]);
  const plateH = interpolate(grow, [0, 1], [460, 1920]);
  // The word shrinks to a label at the top-left corner by layout, not transform: the text guard scales translations by the text's own scale.
  const size = interpolate(move, [0, 1], [330, 89]);
  const cx = interpolate(move, [0, 1], [540, 145]);
  const cy = interpolate(move, [0, 1], [960, 145]);
  const word: CSSProperties = {
    position: 'absolute', left: cx - 400, width: 800, top: cy - size / 2, display: 'flex', justifyContent: 'center',
    fontSize: size, lineHeight: 1, letterSpacing: '-0.02em', color: ink,
    transform: `translateY(${-open * 900}px) rotate(${-4 * (1 - land) - 4 * (1 - move)}deg) scale(${1.4 - 0.4 * land})`,
  };
  return <AbsoluteFill style={{background: paper, overflow: 'hidden', ...center}}>
    <div style={{position: 'absolute', left: 540 - plateW / 2, top: 960 - plateH / 2, width: plateW, height: plateH, borderRadius: (1 - grow) * 48, background: accent, transform: `rotate(${-4 * (1 - grow)}deg) scale(${plate})`}} />
    {frame >= 12 && ring < 1 ? <div style={{position: 'absolute', left: 540 - radius, top: 960 - radius, width: radius * 2, height: radius * 2, borderRadius: '50%', border: `${14 * (1 - ring) + 1}px solid ${ink}`, boxSizing: 'border-box'}} /> : null}
    <div style={word}>오늘</div>
  </AbsoluteFill>;
}

function List({frame, open}: {frame: number; open: number}) {
  return <AbsoluteFill style={{overflow: 'hidden'}}>
    <div style={{position: 'absolute', left: 54, top: 230, transform: `translateY(${-open * 900}px)`}}>
      <Glyphs text="할 일은" frame={frame} at={66} size={200} color={ink} />
    </div>
    {items.map((at, index) => {
      if (frame < at) return null;
      const slide = pop(frame, at, 12, true);
      const top = 420 + index * 170;
      // Rows above the slab are pushed up with the header, rows below fall away.
      const shove = top + 85 < 960 ? -open * 900 : open * 900;
      return <div key={at} style={{position: 'absolute', left: 54, top, height: 170, display: 'flex', alignItems: 'center', gap: 40, transform: `translate(${(slide - 1) * 500}px, ${shove}px)`}}>
        <div style={{width: 98, height: 98, border: `15px solid ${ink}`, boxSizing: 'border-box', transform: `scale(${pop(frame, at + 2, 10)})`}} />
        <span style={{fontFamily: ui, fontWeight: 500, fontSize: 128, lineHeight: 1, color: ink}}>할 일</span>
      </div>;
    })}
  </AbsoluteFill>;
}

function Cut({frame, open}: {frame: number; open: number}) {
  const sweep = span(frame, cut, 12);
  const fly = pop(frame, 290, 26, true);
  const half = 260 + 700 * open;
  const size = interpolate(fly, [0, 1], [330, line.size]);
  const cy = interpolate(fly, [0, 1], [960, line.tops[2] + line.size / 2]);
  const row = (top: number): CSSProperties => ({position: 'absolute', left: 0, width: 1080, top, display: 'flex', justifyContent: 'center'});
  return <AbsoluteFill style={{overflow: 'hidden', transform: `translateX(${(1 - sweep) * 1080}px)`}}>
    <div style={{position: 'absolute', left: 0, width: 1080, top: 960 - half, height: half * 2, background: ink}} />
    <div style={row(line.tops[0])}>{frame >= 290 ? <Glyphs text="오늘" frame={frame} at={296} size={line.size} color={accent} /> : null}</div>
    <div style={row(line.tops[1])}>{frame >= 290 ? <Glyphs text="할 일은" frame={frame} at={299} size={line.size} color={paper} /> : null}</div>
    <div style={{...row(cy - size / 2), fontSize: size, lineHeight: 1, letterSpacing: '-0.02em', color: accent}}>오늘</div>
    <div style={{position: 'absolute', left: 335, top: 1395, width: 410, height: 16, background: accent, transform: `scaleX(${span(frame, 330, 16)})`, transformOrigin: 'left center'}} />
  </AbsoluteFill>;
}

export function Spot() {
  const frame = useCurrentFrame();
  // The slab opens to the full frame after the cut; the list is pushed out by its edges.
  const open = span(frame, cut + 12, 24);
  // Two camera pushes only: the stamp landing and the cut.
  const camera = push(frame, 8, 22, 0.05) * push(frame, cut, 24, 0.04);
  const sfx = [[12, 'impact'], ...items.map(at => [at, 'click'] as const), [cut, 'whoosh']] as const;
  return <AbsoluteFill style={{background: paper, fontFamily: headline, overflow: 'hidden'}}>
    <Audio src="/audio/generated/kinetic-typo/music.wav" volume={0.9} />
    {sfx.map(([at, name]) => <Sequence key={at} from={at} durationInFrames={30} layout="none"><Audio src={`/audio/generated/kinetic-typo/${name}.wav`} volume={0.8} /></Sequence>)}
    <AbsoluteFill style={{transform: `scale(${camera})`}}>
      {frame < 256 ? <Stamp frame={frame} open={open} /> : null}
      {frame >= 66 && frame < 256 ? <List frame={frame} open={open} /> : null}
      {frame >= cut ? <Cut frame={frame} open={open} /> : null}
    </AbsoluteFill>
  </AbsoluteFill>;
}
