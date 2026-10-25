import type {CSSProperties, ReactNode} from 'react';
import {AbsoluteFill, Audio, Easing, MotionProbe, MotionSound, Sequence, breathe, drift, googleFont, interpolate, spring, useCurrentFrame} from 'frameforge';
import {MASK_DROP, blockMask} from '@/blocks';
import {Card, Cup, type Asset} from './assets';

// Explainer patterns (Glyphs, Icon, Screen, Callout, a five-scene layout) kept for calm explainers and product walkthroughs.
// Not a motion-graphics starter (that is examples/samples/_template/). Copy a pattern, not the film; every TODO is the film's own copy.
const W = 1920;
const H = 1080;
const S = Math.min(W, H);
// Minimums from docs/samples/rules.md (구성 최소치). Go bigger, never smaller.
const SIZES = {headline: S * 0.1, label: Math.ceil(S * 0.035), icon: S * 0.06, hero: S * 0.35, marginX: W * 0.05, marginY: H * 0.05};
const display = googleFont('Gothic A1', {weights: [900], fallback: 'sans-serif'});
const ui = googleFont('Noto Sans KR', {weights: [500], fallback: 'sans-serif'});
const ink = '#111111';
const paper = '#F4F4F1';
const accent = '#2F5BFF';
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} satisfies {extrapolateLeft: 'clamp'; extrapolateRight: 'clamp'};
const center: CSSProperties = {display: 'flex', alignItems: 'center', justifyContent: 'center'};
// Absolute scene starts; every scene's first reveal starts a few frames before its cut, so the cut frame already shows the
// incoming picture (frame-check fails three flat or blurred frames in a row). The name settles by 570 and the last 30 frames (1 s) are the hold, with the camera drift still on.
const AT = {hook: 0, beat1: 90, beat2: 210, promise: 330, name: 450, end: 600};
// Secondary motion between the beats (frame-check fails any 1 s with nothing moving). It floats content layers, not the scene
// backgrounds (a drifting background shows its edge) and not text set on the safe margin (the audit flags it outside).
const float = (frame: number, phase = 0) => drift(frame + phase, {x: 10, y: 6, scale: 0.012, period: 240});

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

/** Words rise out of glyph masks; the glyphs of one word share a rise so no frame shows letters at different heights. */
function Glyphs({text, frame, at, size = SIZES.headline, color = ink, stagger = 1}: {text: string; frame: number; at: number; size?: number; color?: string; stagger?: number}) {
  let word = 0;
  return <span style={{display: 'flex', color, fontFamily: display, fontSize: size, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.04em'}}>
    {Array.from(text).map((glyph, index, glyphs) => {
      if (index > 0 && glyphs[index - 1] === ' ' && glyph !== ' ') word++;
      const rise = span(frame, at + word * stagger, 8);
      // The blocks' mask: room above, below and beside the 1em line box for ink that leaves it; hidden glyphs wait past its clip edge.
      return <span key={index} style={blockMask}>
        <span style={{display: 'inline-block', transform: `translateY(${(1 - rise) * MASK_DROP}%)`, visibility: rise === 0 ? 'hidden' : 'visible'}}>{glyph === ' ' ? '\u00A0' : glyph}</span>
      </span>;
    })}
  </span>;
}

function Icon({asset: Shape, frame, at, size = SIZES.icon, color = ink}: {asset: Asset; frame: number; at: number; size?: number; color?: string}) {
  const p = pop(frame, at, 16);
  return <span style={{display: 'inline-flex', transform: `scale(${p})`, visibility: p === 0 ? 'hidden' : 'visible'}}>
    <Shape size={size} color={color} />
  </span>;
}

/** A centred card (a screenshot via <Img src={staticFile(...)} />, or drawn content) with an ink block offset behind it. */
function Screen({frame, at, width = W * 0.7, height = H * 0.7, children}: {frame: number; at: number; width?: number; height?: number; children: ReactNode}) {
  const rise = pop(frame, at, 20, true);
  const offset = S * 0.022;
  return <div style={{position: 'absolute', left: (W - width) / 2, top: (H - height) / 2, width, height, transform: `translateY(${(1 - rise) * H}px)`}}>
    <MotionProbe id={`screen-${at}`} value={(1 - rise) * H} family="card" axis="y" />
    <div style={{position: 'absolute', left: offset, top: offset, width, height, background: ink}} />
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden', background: paper}}>{children}</div>
  </div>;
}

/** Dims everything but `rect` (frame px), strokes it in the accent and shows a label card below or above it. */
function Callout({frame, at, end, rect: [x, y, w, h], text, icon}: {frame: number; at: number; end: number; rect: [number, number, number, number]; text: string; icon: Asset}) {
  const on = span(frame, at, 8) * (1 - span(frame, end - 8, 8));
  const p = pop(frame, at, 16) * (1 - span(frame, end - 6, 6));
  const pad = 8;
  const cardH = SIZES.label * 2.4;
  const below = y + h + pad + 40 + cardH < H - SIZES.marginY;
  return <>
    <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0, opacity: on}}>
      <path d={`M0 0H${W}V${H}H0Z M${x} ${y}h${w}v${h}h${-w}Z`} fillRule="evenodd" fill={ink} fillOpacity={0.55} />
      <rect x={x - pad} y={y - pad} width={w + pad * 2} height={h + pad * 2} rx={10} fill="none" stroke={accent} strokeWidth={6} />
    </svg>
    <div style={{position: 'absolute', left: 0, right: 0, top: below ? y + h + pad + 40 : y - pad - 40 - cardH, ...center, opacity: Math.min(1, p * 1.5), transform: `translateY(${(1 - p) * (below ? -30 : 30)}px)`}}>
      <div style={{...center, gap: SIZES.label * 0.6, height: cardH, padding: `0 ${SIZES.label * 1.2}px`, borderRadius: 20, background: ink, color: paper, fontFamily: ui, fontWeight: 500, fontSize: SIZES.label, whiteSpace: 'nowrap'}}>
        <Icon asset={icon} frame={frame} at={at + 4} size={SIZES.icon} color={paper} />{text}
      </div>
    </div>
  </>;
}

function Hook({frame}: {frame: number}) {
  // The hook fills the frame from frame 0: an accent disc wider than the screen is already contracting into the hero, never a dot growing on black.
  const hero = SIZES.hero + (W * 1.1 - SIZES.hero) * (1 - pop(frame, AT.hook, 36, true));
  return <AbsoluteFill style={{background: ink}}>
    <MotionProbe id="hero" value={hero} family="shape" axis="scale" />
    <div data-subject="hero" style={{position: 'absolute', right: SIZES.marginX + S * 0.05, top: (H - SIZES.hero) / 2, width: SIZES.hero, height: SIZES.hero, ...center, transform: float(frame)}}>
      <div style={{width: hero * breathe(frame, 60, 0.03), height: hero * breathe(frame, 60, 0.03), flex: 'none', borderRadius: '50%', background: accent}} />
    </div>
    <div style={{position: 'absolute', left: SIZES.marginX, top: H * 0.34, display: 'flex', flexDirection: 'column', gap: S * 0.02}}>
      <Glyphs text="TODO 질문 한 줄" frame={frame} at={AT.hook + 10} color={paper} />
      <Glyphs text="TODO 둘째 줄" frame={frame} at={AT.hook + 24} color={paper} />
    </div>
  </AbsoluteFill>;
}

function Beat({frame, at, title, items}: {frame: number; at: number; title: string; items: [Asset, string][]}) {
  return <AbsoluteFill style={{background: paper}}>
    <div style={{position: 'absolute', left: SIZES.marginX, top: SIZES.marginY + S * 0.04}}><Glyphs text={title} frame={frame} at={at - 4} /></div>
    <div style={{position: 'absolute', left: SIZES.marginX, right: SIZES.marginX, top: H * 0.4, display: 'flex', justifyContent: 'space-between', transform: float(frame, 60)}}>
      {items.map(([shape, word], i) => <div key={word} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: S * 0.03, width: (W - SIZES.marginX * 2) / items.length}}>
        <Icon asset={shape} frame={frame} at={at - 3 + i * 8} size={SIZES.icon * 3} />
        <div style={{fontFamily: ui, fontWeight: 500, fontSize: SIZES.label * 1.6, color: ink, opacity: span(frame, at + 14 + i * 8, 10)}}>{word}</div>
      </div>)}
    </div>
  </AbsoluteFill>;
}

function ScreenBeat({frame}: {frame: number}) {
  const at = AT.beat2;
  return <AbsoluteFill style={{background: accent}}>
    {/* The screen and its callout float together, so the shot never freezes while the callout reads; no scale, so the label stays at the minimum size. */}
    <AbsoluteFill style={{transform: drift(frame + 30, {x: 10, y: 6, scale: 0, period: 240})}}>
    <Screen frame={frame} at={at - 8}>
      {/* Swap for <Img src={staticFile('/screens/<slug>/<name>.png')} style={{width: '100%', height: '100%'}} /> when a capture exists. */}
      <div style={{position: 'absolute', left: '6%', top: '10%', width: '50%', height: '12%', background: ink}} />
      <div style={{position: 'absolute', left: '6%', top: '34%', width: '88%', height: '50%', background: accent, opacity: 0.25}} />
    </Screen>
    <Callout frame={frame} at={at + 40} end={AT.promise - 4} rect={[W * 0.15 + W * 0.7 * 0.06, H * 0.15 + H * 0.7 * 0.1, W * 0.7 * 0.5, H * 0.7 * 0.12]} text="TODO 이 버튼이 하는 일" icon={Cup} />
    </AbsoluteFill>
  </AbsoluteFill>;
}

function PromiseScene({frame}: {frame: number}) {
  const wipe = span(frame, AT.promise - 5, 14);
  return <AbsoluteFill style={{background: paper}}>
    <AbsoluteFill style={{background: accent, clipPath: `inset(0 ${(1 - wipe) * 100}% 0 0)`}} />
    <div style={{position: 'absolute', inset: 0, ...center, flexDirection: 'column', gap: S * 0.04, transform: float(frame, 120)}}>
      <Glyphs text="TODO 약속 한 줄" frame={frame} at={AT.promise + 4} color={paper} />
      <Icon asset={Cup} frame={frame} at={AT.promise + 20} size={SIZES.icon * 3} color={paper} />
    </div>
  </AbsoluteFill>;
}

function Name({frame}: {frame: number}) {
  const bar = span(frame, AT.name + 6, 16);
  return <AbsoluteFill style={{background: ink}}>
    <AbsoluteFill style={{...center, flexDirection: 'column', gap: S * 0.04, transform: float(frame, 180)}}>
    <Glyphs text="TODO 이름" frame={frame} at={AT.name - 4} size={SIZES.headline * 1.6} color={paper} />
    <div style={{width: W * 0.4, height: S * 0.02, background: accent, transform: `scaleX(${bar})`}} />
    <div style={{fontFamily: ui, fontWeight: 500, fontSize: SIZES.label * 1.4, color: paper, opacity: span(frame, AT.name + 30, 12)}}>TODO 한 줄 설명 · 가상 브랜드</div>
    </AbsoluteFill>
  </AbsoluteFill>;
}

export function ExplainerPatterns() {
  const frame = useCurrentFrame();
  // Two camera pushes at most: the screen callout and the name.
  const camera = push(frame, AT.beat2 + 36, 30, 0.04) * push(frame, AT.name, 30, 0.04);
  return <AbsoluteFill style={{background: ink, overflow: 'hidden'}}>
    <Audio src="/audio/generated/template/music.wav" volume={0.9} />
    {/* Effects come from the motion probes (Screen rise, hero pop); quiet lists the music hits so the music plays those. */}
    <MotionSound src="/audio/generated/template/whoosh.wav" role="move" families={['card', 'wipe']} quiet={[AT.beat1, AT.name]} />
    <MotionSound src="/audio/generated/template/impact.wav" role="land" families={['card', 'shape']} quiet={[AT.beat1, AT.name]} />
    <AbsoluteFill style={{transform: `scale(${camera})`}}>
      {frame < AT.beat1 ? <Hook frame={frame} /> : null}
      {frame >= AT.beat1 && frame < AT.beat2 ? <Beat frame={frame} at={AT.beat1} title="TODO 첫째 요점" items={[[Cup, 'TODO 하나'], [Card, 'TODO 둘'], [Cup, 'TODO 셋']]} /> : null}
      {frame >= AT.beat2 && frame < AT.promise ? <ScreenBeat frame={frame} /> : null}
      {frame >= AT.promise && frame < AT.name ? <PromiseScene frame={frame} /> : null}
      {frame >= AT.name ? <Name frame={frame} /> : null}
    </AbsoluteFill>
  </AbsoluteFill>;
}
