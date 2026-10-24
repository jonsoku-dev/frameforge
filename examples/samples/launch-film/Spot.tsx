import type {CSSProperties, ReactNode} from 'react';
import {AbsoluteFill, Audio, Easing, ImageSequence, MotionProbe, MotionSound, Seam, Sequence, beatsFromSpec, googleFont, interpolate, spring, useCurrentFrame} from 'frameforge';
import {BarChart, Counter, blockRise} from '@/blocks';
import audio from './audio.json';

// 늘온 (fictional) launch film: tension → product → mechanism → proof → payoff → name, one leftward current, an ember ring as the
// carrier. Brief and scene table: prompt.md. The tumbler is a Blender script (shots/tumbler.py) rendered by 3d.json.
const W = 1920;
const H = 1080;
const palette = {ink: '#17161A', paper: '#F1EBE0', accent: '#D94F2B', soft: '#D8CFC1'};
const {ink, paper, accent, soft} = palette;
const fonts = {display: googleFont('Noto Serif KR', {weights: [900], fallback: 'serif'}), ui: googleFont('IBM Plex Sans KR', {weights: [500], fallback: 'sans-serif'})};
const SIZE = {number: 380, name: 230, headline: 128, tagline: 72, label: 44, marginX: 96, marginY: 54};
const STROKE = 14;
const RADIUS = 24;
const grid = beatsFromSpec(audio, 30);
// Every cut is a bar line of the score (120 bpm: a bar is 60 frames).
const [, , product, , , section, , proof, , , payoff, , name] = grid.bars(0, 900).map(Math.round) as number[];
const AT = {tension: 0, product: product!, section: section!, proof: proof!, payoff: payoff!, name: name!, lockup: 780, hold: 840};
const SEAM = 24;
// Incoming type and objects start this many frames before their cut, so every cut lands on a scene already arriving.
const PRE = 8;
const HITS = [AT.product, AT.section, AT.proof, AT.payoff, AT.name, AT.lockup];
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const common = (frame: number) => ({frame, fps: 30, palette, fonts});
const beat = (frame: number) => Math.round(grid.nextBeat(frame));
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const span = (frame: number, from: number, dur: number, easing = ease) => interpolate(frame, [from, from + dur], [0, 1], {...clamp, easing});

// The renders put the tumbler at the image centre; each scene shifts the 1920-wide film to place it.
const PRODUCT_X = 1380;
const NAME_X = 1330;
const PLATE = {y: 948, w: 500, h: 104};
const DEGREE = {x: 1520, y: 430, d: 104};

/** The template's glyph rise with a deeper mask (0.14 em above, 0.14 em below the line box) so Noto Serif KR's descenders and
 * commas stay inside it; each glyph rises from below on the film's ease, `stagger` frames apart. */
function Rise({text, frame, at, size = SIZE.headline, color = ink, stagger = 2, x, y, font = fonts.display, weight = 900}: {text: string; frame: number; at: number; size?: number; color?: string; stagger?: number; x: number; y: number; font?: string; weight?: number}) {
  return <div style={{position: 'absolute', left: x, top: y, display: 'flex', color, fontFamily: font, fontSize: size, fontWeight: weight, lineHeight: 1, letterSpacing: '-0.03em', whiteSpace: 'nowrap', visibility: frame < at ? 'hidden' : 'visible'}}>
    <MotionProbe id={`rise-${at}-${x}-${y}`} value={(1 - span(frame, at, 14)) * 120} family="text" axis="y" />
    {Array.from(text).map((glyph, i) => {
      const p = span(frame, at + i * stagger, 14);
      return <span key={i} style={{display: 'inline-block', overflow: 'hidden', height: '1.28em', paddingTop: '0.14em', marginTop: '-0.14em', marginBottom: '-0.14em', paddingInline: '0.08em', marginInline: '-0.08em'}}>
        <span style={{display: 'inline-block', transform: `translateY(${(1 - p) * 125}%)`, visibility: p <= 0 ? 'hidden' : 'visible'}}>{glyph === ' ' ? ' ' : glyph}</span>
      </span>;
    })}
  </div>;
}

function Label({children, color = ink, size = SIZE.label, style}: {children: ReactNode; color?: string; size?: number; style?: CSSProperties}) {
  return <div style={{fontFamily: fonts.ui, fontWeight: 500, fontSize: size, color, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: size * 0.4, ...style}}>{children}</div>;
}

/** A label that rises 0.6 em into place: the entry is a move, never a fade alone. */
function RiseLabel({frame, at, children, color, x, y, size}: {frame: number; at: number; children: ReactNode; color?: string; x: number; y: number; size?: number}) {
  const p = span(frame, at, 16);
  return <div style={{position: 'absolute', left: x, top: y, opacity: p, transform: `translateY(${(1 - p) * 0.6 * (size ?? SIZE.label)}px)`, visibility: p === 0 ? 'hidden' : 'visible'}}>
    <MotionProbe id={`label-${at}-${y}`} value={(1 - p) * 30} family="text" axis="y" />
    <Label color={color} size={size}>{children}</Label>
  </div>;
}

const Chip = ({color = ink}: {color?: string}) => <span style={{fontSize: SIZE.label * 0.9, padding: '0 0.5em', border: `3px solid ${color}`, borderRadius: 999}}>예시</span>;

/** The ring as an ellipse: the degree mark, the plate the tumbler stands on, the payoff's circle. `draw` 0..1 strokes it in. */
function Ring({cx, cy, w, h, color, draw = 1}: {cx: number; cy: number; w: number; h: number; color: string; draw?: number}) {
  const pad = STROKE;
  return <svg width={w + pad * 2} height={h + pad * 2} style={{position: 'absolute', left: cx - w / 2 - pad, top: cy - h / 2 - pad, overflow: 'visible'}}>
    <ellipse cx={w / 2 + pad} cy={h / 2 + pad} rx={w / 2} ry={h / 2} fill="none" stroke={color} strokeWidth={STROKE} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} strokeLinecap="round" />
  </svg>;
}

/** The plate's front half, drawn over the tumbler so the object stands inside the ring rather than in front of it. */
function FrontArc({cx}: {cx: number}) {
  const a = PLATE.w / 2, b = PLATE.h / 2;
  return <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0}}>
    <path d={`M${cx - a} ${PLATE.y} A${a} ${b} 0 0 0 ${cx + a} ${PLATE.y}`} fill="none" stroke={accent} strokeWidth={STROKE} strokeLinecap="round" />
  </svg>;
}

/** The tumbler render rising out of the plate: the clip follows the plate's front arc, so the object emerges from inside the ring. */
function Tumbler({frame, from, rise, shot, frames, cx, ringAt}: {frame: number; from: number; rise: number; shot: string; frames: number; cx: number; ringAt: number}) {
  const p = spring({frame, fps: 30, delay: rise, durationInFrames: 30, config: {overshootClamping: true}});
  const lift = (1 - p) * 860;
  const a = PLATE.w / 2, b = PLATE.h / 2;
  const hole = `path('M0 0 H${W} V${PLATE.y} H${cx + a} A${a} ${b} 0 0 1 ${cx - a} ${PLATE.y} H0 Z')`;
  return <>
    {frame >= ringAt ? <Ring cx={cx} cy={PLATE.y} w={PLATE.w} h={PLATE.h} color={accent} /> : null}
    <div style={{position: 'absolute', inset: 0, clipPath: hole}}>
      <MotionProbe id={`tumbler-${rise}`} value={lift} family="card" axis="y" />
      <div style={{position: 'absolute', left: cx - W / 2, top: 0, width: W, height: H, transform: `translateY(${lift}px)`, visibility: p === 0 ? 'hidden' : 'visible'}}>
        <Sequence from={from} layout="none"><ImageSequence src={`/assets/generated/launch-film/3d/${shot}`} frames={frames} fps={30} /></Sequence>
      </div>
    </div>
    {frame >= ringAt ? <FrontArc cx={cx} /> : null}
  </>;
}

/** 72° cooling to 38° one step per beat: each new value drops a tenth of an em into place on its beat. */
function Cooling({frame}: {frame: number}) {
  const steps = 7, first = beat(8);
  const k = Math.max(0, Math.min(steps, grid.beatIndex(frame) - grid.beatIndex(first) + 1));
  const value = Math.round(72 - (34 * k) / steps);
  const drop = k > 0 && k <= steps ? 1 - span(frame, Math.round(grid.beatAt(frame)), 8) : 0;
  return <div style={{position: 'absolute', left: 1010, top: 350, fontFamily: fonts.display, fontWeight: 900, fontSize: SIZE.number, lineHeight: 1, letterSpacing: '-0.04em', color: paper, fontVariantNumeric: 'tabular-nums', transform: `translateY(${-drop * 0.08}em)`}}>
    <MotionProbe id="cooling" value={k / steps} family="text" axis="progress" />
    {value}
  </div>;
}

function Tension({frame}: {frame: number}) {
  return <AbsoluteFill style={{background: ink}}>
    <Turn frame={frame} cut={AT.product} color={paper} />
    <Rise frame={frame} at={-6} x={SIZE.marginX} y={300} color={paper} text="커피는" />
    <Rise frame={frame} at={6} x={SIZE.marginX} y={300 + SIZE.headline * 1.35} color={paper} text="식는다." />
    <RiseLabel frame={frame} at={30} x={SIZE.marginX} y={300 + SIZE.headline * 3} color={paper}>오전 8시 → 오후 2시 <Chip color={paper} /></RiseLabel>
    <Cooling frame={frame} />
  </AbsoluteFill>;
}

function Product({frame}: {frame: number}) {
  const at = AT.product;
  return <AbsoluteFill style={{background: paper}}>
    <Turn frame={frame} cut={AT.section} color={ink} />
    {/* The one slow camera push of the film: the reveal leans in on the product while it turns. */}
    <AbsoluteFill style={{transform: `scale(${1 + 0.08 * interpolate(frame, [at + 30, AT.section], [0, 1], clamp)})`, transformOrigin: `${PRODUCT_X}px ${PLATE.y}px`}}>
      <MotionProbe id="push" value={interpolate(frame, [at + 30, AT.section], [0, 1], clamp)} family="shape" axis="scale" />
      <Tumbler frame={frame} from={at} rise={at - 2} shot="hero" frames={180} cx={PRODUCT_X} ringAt={at + 4} />
    </AbsoluteFill>
    <Rise frame={frame} at={at - PRE} x={SIZE.marginX} y={330} text="식지 않게," />
    <Rise frame={frame} at={at + 6} x={SIZE.marginX} y={330 + SIZE.headline * 1.35} text="끝까지." />
    <RiseLabel frame={frame} at={at + 40} x={SIZE.marginX} y={330 + SIZE.headline * 3}>늘온 텀블러 · 520 ml</RiseLabel>
    <RiseLabel frame={frame} at={beat(at + 100)} x={SIZE.marginX} y={330 + SIZE.headline * 3 + SIZE.label * 1.6}>보온 12시간 · 보냉 24시간 <Chip /></RiseLabel>
  </AbsoluteFill>;
}

// Leader targets measured on the section render's first frame (image px); the dolly scales them about the image centre.
const SECTION_SHIFT = 160;
const LEADERS = [{x: 1010, y: 292, label: '스테인리스 내벽', at: 16}, {x: 1104, y: 640, label: '이중 진공층', at: 34}];
const dolly = (frame: number) => 9.0 / (9.0 + (7.8 - 9.0) * Math.min(1, Math.max(0, (frame - AT.section) / 119)));

function Section({frame}: {frame: number}) {
  const at = AT.section;
  const k = dolly(frame);
  return <AbsoluteFill style={{background: ink}}>
    <Turn frame={frame} cut={AT.proof} color={paper} />
    <div style={{position: 'absolute', left: SECTION_SHIFT, top: 0, width: W, height: H}}>
      <Sequence from={at} layout="none"><ImageSequence src="/assets/generated/launch-film/3d/section" frames={120} fps={30} /></Sequence>
    </div>
    {LEADERS.map(({x, y, label, at: delay}, i) => {
      const px = W / 2 + (x - W / 2) * k + SECTION_SHIFT, py = H / 2 + (y - H / 2) * k;
      const end = 1400, draw = span(frame, at + delay, 14);
      return <div key={label}>
        <MotionProbe id={`leader-${i}`} value={draw} family="shape" axis="progress" />
        <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0}}>
          <circle cx={px} cy={py} r={STROKE * 0.8 * Math.min(1, draw * 3)} fill={paper} />
          <path d={`M${px} ${py} L${end} ${py}`} stroke={paper} strokeWidth={STROKE * 0.5} strokeLinecap="round" fill="none" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
        </svg>
        <RiseLabel frame={frame} at={at + delay + 4} x={end + 24} y={py - SIZE.label * 0.66} color={paper}>{label}</RiseLabel>
      </div>;
    })}
    <Rise frame={frame} at={at - PRE} x={SIZE.marginX} y={330} color={paper} text="열을 가두는" />
    <Rise frame={frame} at={at + 6} x={SIZE.marginX} y={330 + SIZE.headline * 1.35} color={paper} text="두 겹의 벽" />
  </AbsoluteFill>;
}

// The proof: BarChart draws the two competitors in stone; the 늘온 column beside it uses the chart's own geometry in ember.
const CHART = {x: 860, y: 150, w: 640, h: 800, size: 50, max: 74.8};
const SLOT = CHART.w / 2;
const BASE = CHART.y + CHART.h - CHART.size * 1.7;
const PLOT = CHART.h - CHART.size * 1.7 - CHART.size * 3.2;
const OURS = {left: CHART.x + CHART.w + SLOT * 0.19, width: SLOT * 0.62, height: (68 / CHART.max) * PLOT};
const CHART_AT = AT.proof - 6;
const OURS_AT = CHART_AT + 14;

function Proof({frame}: {frame: number}) {
  const at = AT.proof;
  const grow = spring({frame, fps: 30, delay: OURS_AT, durationInFrames: 36, config: {overshootClamping: true}});
  const top = BASE - OURS.height * grow;
  // From 574 the ember column opens into the whole field over 24 frames; the payoff stands on that field.
  const g = span(frame, AT.payoff - 26, 24, Easing.inOut(Easing.cubic));
  const inset = `inset(${top * (1 - g)}px ${(W - OURS.left - OURS.width) * (1 - g)}px ${(H - BASE) * (1 - g)}px ${OURS.left * (1 - g)}px round ${RADIUS * (1 - g)}px ${RADIUS * (1 - g)}px 0 0)`;
  return <AbsoluteFill style={{background: paper}}>
    <Rise frame={frame} at={at - PRE} x={SIZE.marginX} y={330} text="6시간이 지나도" size={SIZE.headline * 0.9} />
    <Rise frame={frame} at={at + 6} x={SIZE.marginX} y={330 + SIZE.headline * 1.25} text="남은 온도" size={SIZE.headline * 0.9} />
    <RiseLabel frame={frame} at={at + 40} x={SIZE.marginX} y={330 + SIZE.headline * 2.75}>같은 조건 측정 <Chip /></RiseLabel>
    <BarChart {...common(frame)} palette={{...palette, accent: soft}} at={CHART_AT} x={CHART.x} y={CHART.y} width={CHART.w} height={CHART.h} size={CHART.size} stroke={STROKE} radius={RADIUS} max={CHART.max} unit="°" example={false} duration={60}
      data={[{label: '일반 머그', value: 31}, {label: '보통 텀블러', value: 52}]} />
    {/* BarChart's bars run a radius past the baseline; a paper strip under the line keeps the baseline the bottom edge. */}
    <div style={{position: 'absolute', left: CHART.x, top: BASE + STROKE / 2, width: CHART.w + SLOT, height: RADIUS + 2, background: paper, visibility: frame < CHART_AT ? 'hidden' : 'visible'}} />
    <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0, visibility: frame < CHART_AT ? 'hidden' : 'visible'}}>
      <path d={`M${CHART.x + CHART.w} ${BASE} L${CHART.x + CHART.w + SLOT} ${BASE}`} stroke={ink} strokeWidth={STROKE} strokeLinecap="round" fill="none" />
    </svg>
    <div style={{position: 'absolute', left: OURS.left, top, width: OURS.width, height: BASE - top, background: accent, borderRadius: `${RADIUS}px ${RADIUS}px 0 0`, visibility: grow === 0 ? 'hidden' : 'visible'}}>
      <MotionProbe id="ours" value={OURS.height * grow} family="shape" axis="y" />
    </div>
    <div style={{position: 'absolute', left: CHART.x + CHART.w, width: SLOT, top: BASE + STROKE + CHART.size * 0.45, textAlign: 'center', opacity: Math.min(1, grow * 2)}}><Label size={CHART.size} style={{justifyContent: 'center'}}>늘온</Label></div>
    {g > 0 ? <AbsoluteFill style={{background: accent, clipPath: inset}}><MotionProbe id="field" value={g} family="wipe" axis="progress" /></AbsoluteFill> : null}
    <Counter {...common(frame)} at={OURS_AT} x={OURS.left - 70} y={top - 170} size={150} to={68} unit="°" count={36} />
  </AbsoluteFill>;
}

const PAYOFF_RING = {x: 1480, y: 520, d: 470};

function Payoff({frame}: {frame: number}) {
  const at = AT.payoff;
  return <AbsoluteFill style={{background: accent}}>
    <Turn frame={frame} cut={AT.name} color={ink} />
    <Rise frame={frame} at={at - PRE} x={SIZE.marginX} y={340} size={SIZE.headline * 1.1} color={paper} text="아침의 온도," />
    <Rise frame={frame} at={at + 6} x={SIZE.marginX} y={340 + SIZE.headline * 1.5} size={SIZE.headline * 1.1} color={paper} text="저녁까지 그대로." />
    <Rise frame={frame} at={at + 14} x={PAYOFF_RING.x - 175} y={PAYOFF_RING.y - 120} size={210} color={paper} text="68°" />
    <RiseLabel frame={frame} at={at + 32} x={PAYOFF_RING.x - 128} y={PAYOFF_RING.y + PAYOFF_RING.d / 2 + 34} color={paper}>오후 6시 <Chip color={paper} /></RiseLabel>
  </AbsoluteFill>;
}

const TYPE_X = 460;
// Two serif glyphs at 1 em advance, tracked −0.03 em: the rule is the name's own width.
const NAME_W = SIZE.name * 2 * 0.97;

function Name({frame}: {frame: number}) {
  const at = AT.name;
  const rule = span(frame, at + 22, 18);
  return <AbsoluteFill style={{background: ink}}>
    <Tumbler frame={frame} from={at} rise={at - 4} shot="name" frames={120} cx={NAME_X} ringAt={at + 8} />
    <Rise frame={frame} at={at - PRE} x={TYPE_X} y={330} size={SIZE.name} color={paper} stagger={4} text="늘온" />
    <div style={{position: 'absolute', left: TYPE_X, top: 330 + SIZE.name * 1.22, width: NAME_W, height: STROKE, background: accent, transform: `scaleX(${rule})`, transformOrigin: 'left'}}>
      <MotionProbe id="name-rule" value={rule} family="wipe" axis="progress" />
    </div>
    <Rise frame={frame} at={AT.lockup - 16} x={TYPE_X} y={330 + SIZE.name * 1.22 + 52} size={SIZE.tagline} color={paper} font={fonts.ui} weight={500} stagger={1} text="처음 온도 그대로" />
    <RiseLabel frame={frame} at={AT.lockup - 4} x={TYPE_X} y={330 + SIZE.name * 1.22 + 52 + SIZE.tagline * 1.6} color={paper}>늘온 텀블러 · 가상 브랜드</RiseLabel>
  </AbsoluteFill>;
}

/** The ember ring on the stage above every scene: the degree mark of the cooling number, then down and left on the current into
 * the product plate; the payoff circle, then a ride on the current into the name plate. It never changes shape before a cut. */
function Carrier({frame}: {frame: number}) {
  if (frame < AT.product + 4) {
    const t = interpolate(frame, [AT.product - 28, AT.product + 4], [0, 1], clamp);
    const pulse = t > 0 ? 1 : 1 + 0.08 * grid.pulse(frame, 8);
    const d = DEGREE.d * pulse;
    // Down first, then left: the ring clears the number before it joins the current; it flattens only after the cut.
    const flat = span(frame, AT.product, 4, Easing.out(Easing.quad));
    const cx = interpolate(Easing.in(Easing.cubic)(t), [0, 1], [DEGREE.x, PRODUCT_X]), cy = interpolate(Easing.out(Easing.cubic)(t), [0, 1], [DEGREE.y, PLATE.y]);
    const w = interpolate(t, [0, 1], [d, PLATE.w * 0.7]) + flat * PLATE.w * 0.3 * t;
    return <>
      <MotionProbe id="ring-1" value={cx} family="shape" axis="x" />
      <Ring cx={cx} cy={cy} w={w} h={frame < AT.product ? w : interpolate(flat, [0, 1], [w, PLATE.h])} color={accent} />
    </>;
  }
  if (frame >= AT.payoff && frame < AT.name + 8) {
    const t = interpolate(frame, [AT.name - 6, AT.name + 8], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
    const draw = span(frame, AT.payoff - 2, 30);
    const d = PAYOFF_RING.d * (t > 0 ? 1 : 1 + 0.025 * grid.pulse(frame, 10));
    const cx = interpolate(t, [0, 1], [PAYOFF_RING.x, NAME_X]), cy = interpolate(t, [0, 1], [PAYOFF_RING.y, PLATE.y]);
    const w = interpolate(t, [0, 1], [d, PLATE.w]);
    const h = frame < AT.name ? w : interpolate(t, [0, 1], [d, PLATE.h]);
    return <>
      <MotionProbe id="ring-2" value={cx} family="shape" axis="x" />
      <MotionProbe id="ring-draw" value={draw} family="shape" axis="progress" />
      <Ring cx={cx} cy={cy} w={w} h={Math.min(w, h)} color={frame < AT.name ? paper : accent} draw={draw} />
    </>;
  }
  return null;
}

/** Where the field colour changes at a cut, the next scene's colour sweeps in from the right edge on the current under this
 * scene's content over its last 10 frames, so the luminance turns over a sweep instead of on one frame. */
function Turn({frame, cut, color}: {frame: number; cut: number; color: string}) {
  const p = span(frame, cut - 10, 10, Easing.in(Easing.quad));
  return p > 0 ? <AbsoluteFill style={{background: color, clipPath: `inset(0 0 0 ${(1 - p) * 100}%)`}}><MotionProbe id={`turn-${cut}`} value={p} family="wipe" axis="progress" /></AbsoluteFill> : null;
}

export function LaunchFilm() {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{background: ink, overflow: 'hidden'}}>
    <Audio src="/audio/generated/launch-film/music.wav" volume={1} />
    <MotionSound src="/audio/generated/launch-film/whoosh.wav" role="move" families={['camera']} quiet={HITS} />
    <MotionSound src="/audio/generated/launch-film/thud.wav" role="land" families={['card']} quiet={HITS} />
    <MotionSound src="/audio/generated/launch-film/tick.wav" role="appear" families={['shape']} quiet={HITS} />
    {/* The end card's tail: a soft swell under the still hold, placed by hand because nothing moves there. It also keeps the effects
        stem as long as the music, since the renderer's ducking ends the music bed when the effects stem ends. */}
    <Sequence from={AT.lockup + 20} durationInFrames={900 - AT.lockup - 20} layout="none"><Audio src="/audio/generated/launch-film/tail.wav" volume={0.35} /></Sequence>
    {/* One seam at a time, switched halfway between cuts: nested seams would stack every earlier seam's background under the
        Z seam's translucent wrapper. */}
    {frame < 210 ? <Seam at={AT.product - SEAM / 2} duration={SEAM} id="s1" fromBackground={ink} toBackground={paper} from={<Tension frame={frame} />} to={<Product frame={frame} />} />
      : frame < 360 ? <Seam at={AT.section - SEAM / 2} duration={SEAM} technique="zoomThrough" id="s2" fromBackground={paper} toBackground={ink} from={<Product frame={frame} />} to={<Section frame={frame} />} />
      : frame < 510 ? <Seam at={AT.proof - SEAM / 2} duration={SEAM} id="s3" fromBackground={ink} toBackground={paper} from={<Section frame={frame} />} to={<Proof frame={frame} />} />
      : frame < 660 ? <Seam at={AT.payoff - SEAM / 2} duration={SEAM} axis="y" direction={-1} id="s4" fromBackground={paper} toBackground={accent} from={<Proof frame={frame} />} to={<Payoff frame={frame} />} />
      : <Seam at={AT.name - SEAM / 2} duration={SEAM} id="s5" fromBackground={accent} toBackground={ink} from={<Payoff frame={frame} />} to={<Name frame={frame} />} />}
    <Carrier frame={frame} />
  </AbsoluteFill>;
}
