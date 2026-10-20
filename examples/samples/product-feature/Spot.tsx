import type {CSSProperties} from 'react';
import {AbsoluteFill, Audio, Easing, Sequence, googleFont, interpolate, random, spring, useCurrentFrame} from 'frameforge';

const serif = googleFont('Gowun Batang', {weights: [700], fallback: 'serif'});
const sans = googleFont('Noto Sans KR', {weights: [500], fallback: 'sans-serif'});
const paper = '#E9E4DC';
const ink = '#2A2622';
const accent = '#C2410C';
const white = '#FFFFFF';
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} satisfies {
  extrapolateLeft: 'clamp';
  extrapolateRight: 'clamp';
};
const CX = 960;
const CY = 400;

function span(frame: number, from: number, dur: number): number {
  return interpolate(frame, [from, from + dur], [0, 1], {...clamp, easing: ease});
}

function pop(frame: number, at: number, dur: number, settle = false): number {
  return spring({frame, fps: 30, delay: at, durationInFrames: dur, config: {overshootClamping: settle}});
}

function push(frame: number, at: number, dur: number, amount: number): number {
  const t = interpolate(frame, [at, at + dur], [0, 1], clamp);
  return 1 + amount * Math.sin(t * Math.PI);
}

function Glyphs({text, frame, at, size, color, font = serif, weight = 700, stagger = 3}: {text: string; frame: number; at: number; size: number; color: string; font?: string; weight?: number; stagger?: number}) {
  return <span style={{display: 'flex', fontFamily: font, color, fontSize: size, fontWeight: weight, lineHeight: 1}}>
    {Array.from(text).map((glyph, index) => {
      const rise = span(frame, at + index * stagger, 12);
      // Gowun Batang and Noto Sans KR sit taller and lower than Gothic A1, so the mask grows on every side without moving the glyph.
      return <span key={`${glyph}${index}`} style={{display: 'inline-block', overflow: 'hidden', height: '1.36em', paddingTop: '0.16em', marginTop: '-0.16em', paddingBottom: '0.26em', marginBottom: '-0.26em', paddingInline: '0.08em', marginInline: '-0.08em'}}>
        <span style={{display: 'inline-block', transform: `translateY(${(1 - rise) * 120}%)`, visibility: rise === 0 ? 'hidden' : 'visible'}}>{glyph === ' ' ? '\u00A0' : glyph}</span>
      </span>;
    })}
  </span>;
}

// Every outline is the same N points walked clockwise from top centre, so circle, shield and battery morph point by point.
type Pt = [number, number];
const N = 120;
function resample(path: Pt[]): Pt[] {
  const lengths = [0];
  for (let i = 1; i < path.length; i++) lengths.push(lengths[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  const total = lengths[lengths.length - 1];
  return Array.from({length: N}, (_, k) => {
    const target = (total * k) / N;
    let j = 1;
    while (lengths[j] < target) j++;
    const t = (target - lengths[j - 1]) / (lengths[j] - lengths[j - 1] || 1);
    return [path[j - 1][0] + (path[j][0] - path[j - 1][0]) * t, path[j - 1][1] + (path[j][1] - path[j - 1][1]) * t];
  });
}
const curve = (a: Pt, c: Pt, b: Pt): Pt[] => Array.from({length: 16}, (_, i) => {
  const t = (i + 1) / 16;
  return [(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]];
});
const circle = (r: number): Pt[] => Array.from({length: N}, (_, k) => {
  const a = -Math.PI / 2 + (2 * Math.PI * k) / N;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
});
const shield = resample([[CX, 170], [1150, 170], [1150, 430], ...curve([1150, 430], [1150, 580], [CX, 660]), ...curve([CX, 660], [770, 580], [770, 430]), [770, 170], [CX, 170]]);
const battery = resample([[CX, 270], [1260, 270], [1260, 530], [660, 530], [660, 270], [CX, 270]]);
const mix = (a: Pt[], b: Pt[], t: number): Pt[] => a.map((p, i) => [p[0] + (b[i][0] - p[0]) * t, p[1] + (b[i][1] - p[1]) * t]);
const path = (pts: Pt[]) => `M${pts.map(p => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L')}Z`;

function outline(frame: number, ring: number): Pt[] {
  const grown = 150 + (interpolate(span(frame, 140, 22), [0, 1], [[170, 240, 310][ring], 240]) - 150) * pop(frame, 30 + ring * 5, 24, true);
  return mix(mix(circle(grown), shield, span(frame, 150, 24)), battery, span(frame, 270, 25));
}

const headline: CSSProperties = {position: 'absolute', left: 0, right: 0, top: 790, display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: 28};

function Sound({frame}: {frame: number}) {
  const pulse = 1 + 0.25 * Math.sin(span(frame, 30, 12) * Math.PI);
  const disc = 150 * pop(frame, 2, 10) * pulse + 1200 * pop(frame, 110, 18, true);
  // Gaps open the rings into left and right arcs, then close them again for the shield.
  const o = span(frame, 70, 30) * (1 - span(frame, 125, 25));
  const arc = 50 - 25 * o;
  const shrink = 1 - 0.85 * span(frame, 180, 50);
  return <AbsoluteFill style={{background: paper, overflow: 'hidden'}}>
    <AbsoluteFill style={{background: ink, clipPath: `circle(${disc}px at ${CX}px ${CY}px)`}} />
    {frame >= 120 ? [0, 1].map(side => <div key={side} style={{position: 'absolute', top: 0, left: side ? 1420 : 200, height: CY * 2, display: 'flex', alignItems: 'center', gap: 20}}>
      {Array.from({length: 8}, (_, i) => {
        const h = (60 + random(`noise-${side}-${i}`) * 300) * (0.6 + 0.4 * Math.abs(Math.sin(frame * 0.3 + i * 1.7 + side))) * shrink * pop(frame, 124 + i * 2, 12);
        return <div key={i} style={{width: 20, height: h, borderRadius: 10, background: paper}} />;
      })}
    </div>) : null}
    <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
      {[0, 1, 2].map(ring => frame >= 30 + ring * 5 ? <path key={ring} d={path(outline(frame, ring))} pathLength={100} fill="none" stroke={accent} strokeWidth={18} strokeLinejoin="round" strokeLinecap="round"
        strokeDasharray={o > 0.001 ? `${arc} ${50 - arc}` : undefined} strokeDashoffset={25 + arc / 2} /> : null)}
    </svg>
    {frame < 130 ? <div style={headline}><Glyphs text="귀 기울이면" frame={frame} at={24} size={120} color={ink} /></div> : null}
    {frame >= 160 ? <div style={headline}><Glyphs text="소음은 바깥에" frame={frame} at={160} size={120} color={white} /></div> : null}
  </AbsoluteFill>;
}

function Battery({frame}: {frame: number}) {
  const erase = span(frame, 420, 20);
  const fill = span(frame, 290, 70);
  const split = pop(frame, 422, 18, true);
  const snap = pop(frame, 444, 10);
  const burst = span(frame, 450, 30);
  return <AbsoluteFill style={{background: paper, overflow: 'hidden', clipPath: `inset(${(1 - span(frame, 270, 20)) * 100}% 0 0 0)`}}>
    <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
      {erase < 0.97 ? <path d={path(outline(frame, 1))} pathLength={100} fill="none" stroke={ink} strokeWidth={18} strokeLinejoin="round" strokeDasharray={`${100 * (1 - erase)} 100`} /> : null}
      <rect x={1270} y={355} width={26 * pop(frame, 290, 12, true) * (1 - erase)} height={90} fill={ink} />
      {frame < 420 ? <rect x={688} y={298} width={544 * fill} height={204} fill={accent} /> : [-1, 1].map(side => {
        const w = interpolate(split, [0, 1], [272, 150]);
        const h = interpolate(split, [0, 1], [204, 150]);
        const x = CX + side * (interpolate(split, [0, 1], [136, 320]) - snap * 245);
        return <rect key={side} x={x - w / 2} y={CY - h / 2} width={w} height={h} rx={interpolate(split, [0, 1], [0, 75])} fill={accent} />;
      })}
      {frame >= 450 ? <circle cx={CX} cy={CY} r={150 + burst * 420} fill="none" stroke={accent} strokeWidth={16 * (1 - burst)} /> : null}
    </svg>
    {frame >= 284 && frame < 420 ? <div style={{...headline, top: 700, flexDirection: 'column', alignItems: 'center', gap: 24}}>
      <Glyphs text="30시간" frame={frame} at={284} size={140} color={ink} />
      <Glyphs text="예시" frame={frame} at={300} size={56} color={ink} font={sans} weight={500} />
    </div> : null}
    {frame >= 448 ? <div style={headline}><Glyphs text="한 번에 연결" frame={frame} at={448} size={120} color={ink} stagger={2} /></div> : null}
  </AbsoluteFill>;
}

function Name({frame}: {frame: number}) {
  const mark = pop(frame, 512, 12);
  return <AbsoluteFill style={{background: accent, overflow: 'hidden', clipPath: `circle(${pop(frame, 506, 20, true) * 1200}px at ${CX}px ${CY}px)`}}>
    {[-1, 1].map(side => <div key={side} style={{position: 'absolute', left: CX + side * 90 - 36, top: 230, width: 72, height: 72, borderRadius: '50%', background: white, transform: `scale(${mark})`}} />)}
    <div style={{position: 'absolute', left: 0, right: 0, top: 360, display: 'flex', justifyContent: 'center'}}>
      <Glyphs text="Ossle" frame={frame} at={510} size={240} color={white} />
    </div>
    <div style={{position: 'absolute', left: 0, right: 0, top: 700, display: 'flex', justifyContent: 'center'}}>
      <Glyphs text="조용하게, 오래, 바로." frame={frame} at={516} size={60} color={white} font={sans} weight={500} stagger={1} />
    </div>
  </AbsoluteFill>;
}

export function Spot() {
  const frame = useCurrentFrame();
  // One camera push only, on the snap of the two dots.
  const camera = push(frame, 446, 24, 0.06);
  return <AbsoluteFill style={{background: paper, overflow: 'hidden'}}>
    <Audio src="/audio/generated/product-feature/music.wav" volume={0.9} />
    <Sequence from={30} durationInFrames={30} layout="none"><Audio src="/audio/generated/product-feature/pop.wav" volume={0.8} /></Sequence>
    {[120, 270, 420].map(at => <Sequence key={at} from={at} durationInFrames={30} layout="none"><Audio src="/audio/generated/product-feature/whoosh.wav" volume={0.8} /></Sequence>)}
    <Sequence from={450} durationInFrames={30} layout="none"><Audio src="/audio/generated/product-feature/click.wav" volume={0.8} /></Sequence>
    <AbsoluteFill style={{transform: `scale(${camera})`}}>
      {frame < 300 ? <Sound frame={frame} /> : null}
      {frame >= 270 ? <Battery frame={frame} /> : null}
      {frame >= 505 ? <Name frame={frame} /> : null}
    </AbsoluteFill>
  </AbsoluteFill>;
}
