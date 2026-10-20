import type {CSSProperties} from 'react';
import {AbsoluteFill, Easing, googleFont, interpolate, useCurrentFrame} from 'frameforge';

const gothic = googleFont('Gothic A1', {weights: [900], fallback: 'sans-serif'});
const ink = '#111111';
const paper = '#f4f4f1';
const green = '#06C755';
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} satisfies {
  extrapolateLeft: 'clamp';
  extrapolateRight: 'clamp';
};

function span(frame: number, from: number, dur: number): number {
  return interpolate(frame, [from, from + dur], [0, 1], {...clamp, easing: ease});
}

function Glyphs({text, frame, at, size, color, stagger = 3}: {text: string; frame: number; at: number; size: number; color: string; stagger?: number}) {
  return <span style={{display: 'flex', color, fontSize: size, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.04em'}}>
    {Array.from(text).map((glyph, index) => {
      const rise = span(frame, at + index * stagger, 12);
      // Gothic A1 ink rises 0.87em above the baseline but the 1em line box only holds 0.8em, so the mask grows upward without moving the glyph.
      return <span key={`${glyph}${index}`} style={{display: 'inline-block', overflow: 'hidden', height: '1.15em', paddingTop: '0.1em', marginTop: '-0.1em', paddingInline: '0.06em', marginInline: '-0.06em'}}>
        <span style={{display: 'inline-block', transform: `translateY(${(1 - rise) * 120}%)`, visibility: rise === 0 ? 'hidden' : 'visible'}}>{glyph === ' ' ? '\u00A0' : glyph}</span>
      </span>;
    })}
  </span>;
}

function Hook({frame}: {frame: number}) {
  return <AbsoluteFill style={{background: green, overflow: 'hidden'}}>
    {Array.from({length: 4}, (_, index) => {
      const travel = span(frame, index * 3, 20);
      const y = index < 2 ? 96 + index * 120 : 900 + (index - 2) * 70;
      return <div key={index} style={{position: 'absolute', top: y, left: interpolate(travel, [0, 1], [160, 1480]), width: 280, height: 22, background: paper, transform: 'rotate(-8deg)', transformOrigin: 'center'}} />;
    })}
    <div style={{position: 'absolute', top: 360, left: 1180, width: 0, height: 0, borderTop: '150px solid transparent', borderBottom: '150px solid transparent', borderLeft: `240px solid ${ink}`, transform: `scale(${1 - span(frame, 8, 18)})`, transformOrigin: '120px 150px'}} />
    <div style={{position: 'absolute', left: 180, top: 390}}>
      <Glyphs text="같이" frame={frame} at={16} size={360} color={ink} />
    </div>
  </AbsoluteFill>;
}

function Columns({frame}: {frame: number}) {
  const words = ['퍼즐', '대전', '리듬'] as const;
  const rhythmA = [0.42, 0.78, 0.5, 0.92, 0.36, 0.7, 0.48, 0.84, 0.55];
  const rhythmB = [0.86, 0.34, 0.95, 0.4, 0.72, 0.28, 0.8, 0.46, 0.66];
  const mix = 0.5 + 0.5 * Math.sin((frame - 78) * 0.35);
  return <AbsoluteFill style={{overflow: 'hidden'}}>
    {words.map((word, index) => {
      return <div key={word} style={{position: 'absolute', top: 0, left: index * 640, width: 640, height: 1080, overflow: 'hidden', background: index === 1 ? green : index === 0 ? paper : ink}}>
        {index === 0 ? <div style={{position: 'absolute', left: 48, top: 150, display: 'grid', gridTemplateColumns: 'repeat(4, 124px)', gap: 16}}>
          {Array.from({length: 16}, (_, cell) => <div key={cell} style={{width: 124, height: 124, background: green, transform: `scaleY(${span(frame, 72 + (cell % 4) * 3 + Math.floor(cell / 4) * 2, 10)})`, transformOrigin: 'bottom'}} />)}
        </div> : null}
        {index === 1 ? <>
          <div style={{position: 'absolute', top: 280, left: interpolate(span(frame, 68, 16), [0, 1], [24, 48]), width: 240, height: 420, background: ink}} />
          <div style={{position: 'absolute', top: 280, left: interpolate(span(frame, 68, 16), [0, 1], [376, 352]), width: 240, height: 420, background: ink}} />
        </> : null}
        {index === 2 ? <div style={{position: 'absolute', left: 72, top: 150, display: 'flex', alignItems: 'flex-end', gap: 16, height: 640}}>
          {rhythmA.map((high, bar) => {
            const amount = rhythmA[bar] * (1 - mix) + rhythmB[bar] * mix;
            return <div key={bar} style={{width: 44, height: 80 + amount * 560, background: green}} />;
          })}
        </div> : null}
        <div style={{position: 'absolute', left: 48, bottom: 56}}>
          <Glyphs text={word} frame={frame} at={90 + index * 3} size={88} color={index === 0 ? ink : paper} stagger={2} />
        </div>
      </div>;
    })}
  </AbsoluteFill>;
}

function PromiseShot({frame}: {frame: number}) {
  const rule = span(frame, 196, 18);
  return <AbsoluteFill style={{background: paper, overflow: 'hidden', justifyContent: 'center'}}>
    <div style={{position: 'absolute', left: 120, top: 180, display: 'flex', flexDirection: 'column', gap: 8}}>
      <Glyphs text="친구와" frame={frame} at={158} size={200} color={ink} />
      <Glyphs text="지금" frame={frame} at={170} size={400} color={green} />
      <div style={{width: rule * 820, height: 22, marginTop: 36, background: green}} />
    </div>
  </AbsoluteFill>;
}

function Together({frame}: {frame: number}) {
  const cols = 10;
  const rows = 6;
  const dot = 108;
  const gapX = (1920 - cols * dot) / (cols + 1);
  const gapY = (1080 - rows * dot) / (rows + 1);
  return <AbsoluteFill style={{background: ink, overflow: 'hidden'}}>
    {Array.from({length: cols * rows}, (_, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const delay = Math.hypot(col - 4.5, row - 2.5) * 3;
      const born = span(frame, 236 + delay, 12);
      const gather = span(frame, 286, 22);
      const x = interpolate(gather, [0, 1], [gapX + col * (dot + gapX) + dot / 2, 960]);
      const y = interpolate(gather, [0, 1], [gapY + row * (dot + gapY) + dot / 2, 540]);
      return <div key={index} style={{position: 'absolute', left: x, top: y, width: dot, height: dot, marginLeft: -dot / 2, marginTop: -dot / 2, borderRadius: dot / 2, background: green, transform: `scale(${born * (1 - gather)})`}} />;
    })}
    <div style={{position: 'absolute', left: 500, top: 512, width: 720, height: 28, background: paper, transform: `scaleX(${span(frame, 304, 14)})`, transformOrigin: 'center'}} />
    <div style={{position: 'absolute', left: interpolate(span(frame, 308, 16), [0, 1], [80, 180]), top: 400}}>
      <Glyphs text="나" frame={frame} at={308} size={220} color={paper} stagger={0} />
    </div>
    <div style={{position: 'absolute', left: interpolate(span(frame, 312, 16), [0, 1], [1120, 1280]), top: 400}}>
      <Glyphs text="친구" frame={frame} at={312} size={220} color={paper} />
    </div>
  </AbsoluteFill>;
}

function EndCard({frame}: {frame: number}) {
  const push = frame < 400 ? 1 : interpolate(frame, [400, 449], [1, 1.04], {...clamp, easing: ease});
  const plate: CSSProperties = {position: 'absolute', inset: 0, background: green};
  const type: CSSProperties = {position: 'absolute', inset: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28, transform: `scale(${push})`};
  return <AbsoluteFill style={{overflow: 'hidden'}}>
    <div style={plate}>
      <div style={type}>
        <Glyphs text="FRAME GAME" frame={frame} at={352} size={180} color={ink} stagger={2} />
        <div style={{width: span(frame, 372, 12) * 320, height: 16, background: ink}} />
        <Glyphs text="친구와 지금" frame={frame} at={376} size={80} color={ink} stagger={1} />
      </div>
    </div>
  </AbsoluteFill>;
}

export function Opening() {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{background: ink, fontFamily: gothic, overflow: 'hidden'}}>
    <Hook frame={frame} />
    {frame >= 50 ? <Columns frame={frame} /> : null}
    {frame >= 140 ? <PromiseShot frame={frame} /> : null}
    {frame >= 230 ? <Together frame={frame} /> : null}
    {frame >= 340 ? <EndCard frame={frame} /> : null}
  </AbsoluteFill>;
}
