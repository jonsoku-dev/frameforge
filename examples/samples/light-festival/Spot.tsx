import type {CSSProperties} from 'react';
import {AbsoluteFill, Audio, Easing, Sequence, googleFont, interpolate, spring, useCurrentFrame} from 'frameforge';
import {Camera, FestivalMap, MAP_EDGES, MAP_NODES, Music, Sparkle, Ticket} from './assets';

const W = 1920;
const H = 1080;
const display = googleFont('Black Han Sans', {weights: [400], fallback: 'sans-serif'});
const ui = googleFont('Noto Sans KR', {weights: [700], fallback: 'sans-serif'});
const ink = '#0B0B14';
const paper = '#F4F1EA';
const accent = '#FF4D6D';
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} satisfies {extrapolateLeft: 'clamp'; extrapolateRight: 'clamp'};
const center: CSSProperties = {display: 'flex', alignItems: 'center', justifyContent: 'center'};
const full: CSSProperties = {position: 'absolute', inset: 0};
// Absolute scene starts in frames; the final 60 frames are the still hold.
const AT = {manifesto: 120, dates: 300, tour: 540, kinetic: 900, lineup: 1200, cta: 1440, name: 1620};
const ZONE = [540, 660, 780];
const WORDS = ['밤', '빛', '춤', '도시', '켜', '져', '라', '지금', '함께', '가자'];
const WORD_SIZE = [340, 200, 420, 260, 300, 180, 400, 240, 320, 460];
const ARTISTS = ['나루 소리', '달빛 리버', '유리 무드', '블루 하루', '선우 리듬', '해안 필름'];

function span(frame: number, from: number, dur: number): number {
  return interpolate(frame, [from, from + dur], [0, 1], {...clamp, easing: ease});
}

function pop(frame: number, at: number, dur: number, settle = false): number {
  return spring({frame, fps: 30, delay: at, durationInFrames: dur, config: {overshootClamping: settle}});
}

/** Camera push and return: scale rises to 1 + amount at the midpoint and comes back. Used twice in the film. */
function push(frame: number, at: number, dur: number, amount: number): number {
  return 1 + amount * Math.sin(interpolate(frame, [at, at + dur], [0, 1], clamp) * Math.PI);
}

/** Per-glyph rise. The mask pads 0.1em above and below so Black Han Sans ink is not clipped (padding is cancelled by the negative margin, so position does not move). */
function Glyphs({text, frame, at, size, color, stagger = 3}: {text: string; frame: number; at: number; size: number; color: string; stagger?: number}) {
  return <span style={{display: 'flex', color, fontFamily: display, fontSize: size, fontWeight: 400, lineHeight: 1, letterSpacing: '-0.02em', whiteSpace: 'nowrap'}}>
    {Array.from(text).map((glyph, index) => {
      const rise = span(frame, at + index * stagger, 12);
      return <span key={index} style={{display: 'inline-block', overflow: 'hidden', height: '1.2em', paddingTop: '0.1em', paddingBottom: '0.1em', marginTop: '-0.1em', marginBottom: '-0.1em', paddingInline: '0.06em', marginInline: '-0.06em'}}>
        <span style={{display: 'inline-block', transform: `translateY(${(1 - rise) * 120}%)`, visibility: rise === 0 ? 'hidden' : 'visible'}}>{glyph === ' ' ? '\u00A0' : glyph}</span>
      </span>;
    })}
  </span>;
}

/** The ring from scene 1 grows out of a dot and breathes until the last 60 frames, when it settles. */
function Ring({frame, at, size}: {frame: number; at: number; size: number}) {
  const d = 48 + (size - 48) * span(frame, at, 48);
  const breath = 1 + 0.012 * Math.sin(frame / 18) * (1 - span(frame, 1690, 50));
  return <div style={{position: 'absolute', left: W / 2 - d / 2, top: H / 2 - d / 2, width: d, height: d, borderRadius: '50%', border: `${Math.min(36, d / 2)}px solid ${accent}`, transform: `scale(${breath})`}} />;
}

/** Full-bleed wipe from a colour: a diagonal slide across the frame (used between zone cards). */
function diag(p: number): string {
  const x = -400 + (W + 800) * p;
  return `polygon(0px 0px, ${x}px 0px, ${x - 400}px ${H}px, 0px ${H}px)`;
}

function Hook({frame}: {frame: number}) {
  return <>
    <Ring frame={frame} at={0} size={720} />
    <div style={{...full, ...center, flexDirection: 'column'}}>
      <Glyphs text="밤이" frame={frame} at={54} size={230} color={paper} />
      <Glyphs text="도시를" frame={frame} at={78} size={230} color={paper} />
      <Glyphs text="켠다" frame={frame} at={100} size={230} color={paper} />
    </div>
  </>;
}

/** Manifesto line: accent circle wipe, then a paper scaleX wipe that carries the ink line. Exit (optional) is a shrinking paper circle into the dates scene. */
function Line({frame, at, text, exit}: {frame: number; at: number; text: string; exit?: number}) {
  const f = frame - at;
  if (f < 0 || f >= 84 || (exit !== undefined && frame >= exit + 12)) return null;
  const exitP = exit === undefined ? 0 : span(frame, exit, 12);
  return <AbsoluteFill style={{clipPath: `circle(${(1 - exitP) * 1500}px at 50% 50%)`}}>
    <AbsoluteFill style={{background: accent, clipPath: `circle(${span(f, 0, 12) * 1500}px at 50% 50%)`}} />
    <AbsoluteFill style={{background: paper, transform: `scaleX(${span(f, 12, 12)})`, transformOrigin: 'left center'}} />
    <div style={{...full, ...center}}><Glyphs text={text} frame={f} at={24} size={200} color={ink} /></div>
  </AbsoluteFill>;
}

/** Number flip: the old figure folds away on its x axis, the new one unfolds. No mask, so the digits are never clipped. */
function Flip({frame, at, from, to, size}: {frame: number; at: number; from: string; to: string; size: number}) {
  const half = at + 24;
  const shown = frame < half ? from : to;
  const angle = frame < half ? span(frame, at, 24) * 90 : (1 - span(frame, half, 24)) * 90;
  return <div style={{fontFamily: display, fontSize: size, lineHeight: 1.2, color: paper, transform: `perspective(900px) rotateX(${angle}deg)`, whiteSpace: 'nowrap'}}>{shown}</div>;
}

/** Map-like abstract: seeded nodes joined by lines, drawn in, then turned slowly. The camera pushes into it. */
function MapAbstract({frame}: {frame: number}) {
  const zoom = push(frame, 420, 60, 0.06);
  return <div style={{position: 'absolute', left: 950, top: 110, width: 860, height: 860, transform: `scale(${zoom}) rotate(${(frame - AT.dates) * 0.12}deg)`}}>
    <FestivalMap size={860} lines={MAP_EDGES.map((_, i) => span(frame, AT.dates + 6 + i * 3, 30))} dots={Array.from({length: MAP_NODES}, (_, i) => pop(frame, AT.dates + 10 + i * 4, 16))} style={{position: 'absolute', inset: 0}} />
  </div>;
}

function Dates({frame}: {frame: number}) {
  return <>
    {/* Paper circle shrinks away over the ink root: the wipe into the dates scene. */}
    <AbsoluteFill style={{background: paper, clipPath: `circle(${(1 - span(frame, AT.dates, 12)) * 1500}px at 50% 50%)`}} />
    <MapAbstract frame={frame} />
    <div style={{position: 'absolute', left: 96, top: 210, display: 'flex', flexDirection: 'column', gap: 40}}>
      <div style={{fontFamily: ui, fontWeight: 700, fontSize: 44, color: accent, opacity: span(frame, AT.dates + 14, 12)}}>예시 날짜</div>
      <Flip frame={frame} at={AT.dates + 60} from="10.24" to="11.02" size={180} />
      <div style={{fontFamily: ui, fontWeight: 700, fontSize: 44, color: accent, marginTop: 40, opacity: span(frame, AT.dates + 110, 12)}}>예시 장소</div>
      <Glyphs text="은하 광장" frame={frame} at={AT.dates + 120} size={150} color={paper} />
    </div>
    <div style={{position: 'absolute', left: 96, top: 920, fontFamily: ui, fontWeight: 700, fontSize: 40, color: paper, opacity: span(frame, AT.dates + 150, 12)}}>샘플 데이터</div>
  </>;
}

/** Three zone cards, each 120 frames. The next card slides in on a diagonal over the last one. */
const CARDS = [
  {Icon: Sparkle, title: '빛의 정원', bg: paper, fg: ink, tint: accent},
  {Icon: Music, title: '소리 광장', bg: accent, fg: ink, tint: ink},
  {Icon: Camera, title: '기억 골목', bg: ink, fg: paper, tint: accent},
] as const;

function Tour({frame}: {frame: number}) {
  return <>{CARDS.map((card, i) => {
    const f = frame - ZONE[i]!;
    const end = i < 2 ? ZONE[i + 1]! + 24 : AT.kinetic;
    if (f < 0 || frame >= end) return null;
    return <AbsoluteFill key={i} style={{background: card.bg, clipPath: diag(span(f, 0, 24))}}>
      <div style={{position: 'absolute', left: W / 2 - 120, top: 170}}>
        <card.Icon draw={span(frame, ZONE[i]! + 6, 24)} size={240} color={card.tint} />
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 470, ...center}}>
        <Glyphs text={card.title} frame={f} at={6} size={150} color={card.fg} />
      </div>
      <div style={{position: 'absolute', left: W / 2 - 180, top: 700, width: 360, height: 12, background: card.tint, transform: `scaleX(${span(f, 12, 20)})`}} />
      <div style={{position: 'absolute', left: 0, right: 0, top: 740, textAlign: 'center', fontFamily: ui, fontWeight: 700, fontSize: 44, color: card.fg}}>{`예시 구역 ${i + 1}`}</div>
    </AbsoluteFill>;
  })}</>;
}

/** Ten hype words, one per second. Each word rises in, and an accent shape (bar, ring, block) reacts on the same beat. */
function Kinetic({frame}: {frame: number}) {
  const i = Math.floor((frame - AT.kinetic) / 30);
  const f = frame - AT.kinetic - i * 30;
  const size = WORD_SIZE[i]!;
  const kind = i % 3;
  const align: CSSProperties = kind === 0 ? {left: 96, justifyContent: 'flex-start'} : kind === 1 ? {right: 96, justifyContent: 'flex-end'} : {left: 0, right: 0, justifyContent: 'center'};
  return <AbsoluteFill style={{background: ink}}>
    {kind === 0 ? <div style={{position: 'absolute', left: 0, top: 880, width: 1400 * span(f, -6, 8), height: 40, background: accent}} /> : null}
    {kind === 1 ? <div style={{position: 'absolute', left: 1240, top: 300, width: 420 * pop(frame, AT.kinetic + i * 30 - 6, 12), height: 420 * pop(frame, AT.kinetic + i * 30 - 6, 12), borderRadius: '50%', border: `${26}px solid ${accent}`, boxSizing: 'border-box'}} /> : null}
    {kind === 2 ? <div style={{position: 'absolute', left: 1330, top: 640, width: 260 * pop(frame, AT.kinetic + i * 30 - 6, 12), height: 260 * pop(frame, AT.kinetic + i * 30 - 6, 12), background: accent}} /> : null}
    <div style={{position: 'absolute', top: 0, bottom: 0, right: 96, left: 96, display: 'flex', alignItems: 'center', ...align}}>
      <Glyphs text={WORDS[i]!} frame={f} at={-6} size={size} color={paper} stagger={2} />
    </div>
  </AbsoluteFill>;
}

function Lineup({frame}: {frame: number}) {
  const f = frame - AT.lineup;
  const slide = (1 - span(frame, AT.lineup, 60)) * 120;
  return <AbsoluteFill>
    <AbsoluteFill style={{background: paper, transform: `scaleX(${span(frame, AT.lineup, 12)})`, transformOrigin: 'left center'}} />
    <div style={{position: 'absolute', left: 96, top: 96}}><Glyphs text="라인업" frame={f} at={0} size={150} color={ink} /></div>
    <div style={{position: 'absolute', left: 96, top: 250, fontFamily: ui, fontWeight: 700, fontSize: 44, color: ink, opacity: span(frame, AT.lineup + 12, 12)}}>예시 아티스트 여섯 팀</div>
    <div style={{position: 'absolute', left: 96, top: 330 + slide, width: 1728, display: 'grid', gridTemplateColumns: 'repeat(3, 520px)', gap: 48}}>
      {ARTISTS.map((name, i) => {
        const head = i === 1;
        const p = pop(frame, AT.lineup + 4 + i * 6, 18, true);
        return <div key={name} style={{height: 280, background: head ? accent : ink, color: head ? ink : paper, ...center, transform: `scale(${p})${head ? ` scale(${push(frame, 1320, 30, 0.06)})` : ''}`, fontFamily: ui, fontWeight: 700, fontSize: 88}}>
          {name}
        </div>;
      })}
    </div>
  </AbsoluteFill>;
}

function Cta({frame}: {frame: number}) {
  const f = frame - AT.cta;
  return <AbsoluteFill style={{background: accent, clipPath: `circle(${span(f, 0, 30) * 1500}px at 50% 50%)`}}>
    <div style={{...full, ...center, flexDirection: 'column', gap: 60}}>
      <Glyphs text="밤이 도시를 켠다" frame={f} at={20} size={180} color={ink} />
      <div style={{display: 'flex', alignItems: 'center', gap: 40, opacity: span(f, 90, 12)}}>
        <Ticket draw={span(frame, AT.cta + 90, 24)} size={240} color={ink} />
        <div style={{fontFamily: ui, fontWeight: 700, fontSize: 48, color: ink}}>입장권 예시 10,000원 · 샘플 데이터</div>
      </div>
    </div>
  </AbsoluteFill>;
}

function Lockup({frame}: {frame: number}) {
  const f = frame - AT.name;
  return <AbsoluteFill style={{background: ink, clipPath: `circle(${span(f, 0, 30) * 1500}px at 50% 50%)`}}>
    <Ring frame={frame} at={AT.name} size={720} />
    <div style={{...full, ...center, flexDirection: 'column', gap: 20}}>
      <Glyphs text="달빛도시" frame={f} at={48} size={300} color={paper} />
      <Glyphs text="2026" frame={f} at={70} size={220} color={accent} />
      <div style={{fontFamily: ui, fontWeight: 700, fontSize: 56, color: paper, marginTop: 30, opacity: span(f, 100, 12)}}>10.24 – 11.02 (예시)</div>
      <div style={{fontFamily: ui, fontWeight: 700, fontSize: 48, color: paper, opacity: span(f, 108, 12)}}>은하 광장 (예시)</div>
    </div>
  </AbsoluteFill>;
}

export function LightFestivalSpot() {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{background: ink}}>
    {frame < AT.manifesto + 12 ? <Hook frame={frame} /> : null}
    <Line frame={frame} at={120} text="빛은 멈추지 않아" />
    <Line frame={frame} at={180} text="도시가 깨어난다" />
    <Line frame={frame} at={240} text="밤을 함께 켜자" exit={AT.dates} />
    {frame >= AT.dates && frame < AT.tour ? <Dates frame={frame} /> : null}
    {frame >= AT.tour && frame < AT.kinetic ? <Tour frame={frame} /> : null}
    {frame >= AT.kinetic && frame < AT.lineup ? <Kinetic frame={frame} /> : null}
    {frame >= AT.lineup && frame < AT.cta + 30 ? <Lineup frame={frame} /> : null}
    {frame >= AT.cta && frame < AT.name + 30 ? <Cta frame={frame} /> : null}
    {frame >= AT.name ? <Lockup frame={frame} /> : null}

    <Audio src="/audio/generated/light-festival/music.wav" volume={0.9} />
    <Sequence from={180} durationInFrames={30} layout="none"><Audio src="/audio/generated/light-festival/whoosh.wav" volume={0.6} /></Sequence>
    <Sequence from={240} durationInFrames={30} layout="none"><Audio src="/audio/generated/light-festival/whoosh.wav" volume={0.6} /></Sequence>
    <Sequence from={360} durationInFrames={30} layout="none"><Audio src="/audio/generated/light-festival/pop.wav" volume={0.6} /></Sequence>
    <Sequence from={660} durationInFrames={30} layout="none"><Audio src="/audio/generated/light-festival/whoosh.wav" volume={0.6} /></Sequence>
    <Sequence from={780} durationInFrames={30} layout="none"><Audio src="/audio/generated/light-festival/whoosh.wav" volume={0.6} /></Sequence>
    <Sequence from={1260} durationInFrames={30} layout="none"><Audio src="/audio/generated/light-festival/pop.wav" volume={0.6} /></Sequence>
    <Sequence from={1500} durationInFrames={30} layout="none"><Audio src="/audio/generated/light-festival/pop.wav" volume={0.6} /></Sequence>
    <Sequence from={1650} durationInFrames={30} layout="none"><Audio src="/audio/generated/light-festival/whoosh.wav" volume={0.6} /></Sequence>
  </AbsoluteFill>;
}
