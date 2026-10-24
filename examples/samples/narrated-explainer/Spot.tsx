import type {CSSProperties} from 'react';
import {AbsoluteFill, Audio, Easing, Formula, MotionProbe, MotionSound, Subtitles, Voiceover, googleFont, interpolate, spring, useCurrentFrame, useNarration} from 'frameforge';
import {Clock, LineChart} from '@/assets';
import timing from './narration.timing.json';

// Narration first: the lines in narration.json were spoken and measured (npm run voice), and every scene below starts on a line.
const W = 1920;
const H = 1080;
const S = Math.min(W, H);
const SIZES = {headline: S * 0.1, label: S * 0.035, icon: S * 0.06, hero: S * 0.35, marginX: W * 0.05, marginY: H * 0.05};
const display = googleFont('Gothic A1', {weights: [900], fallback: 'sans-serif'});
const ui = googleFont('Noto Sans KR', {weights: [500, 600], fallback: 'sans-serif'});
const ink = '#14213D';
const paper = '#F3EFE6';
const accent = '#C4511B';
const soft = '#D9D4C7';
const radius = 18;
const stroke = 16;
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} satisfies {extrapolateLeft: 'clamp'; extrapolateRight: 'clamp'};
const center: CSSProperties = {display: 'flex', alignItems: 'center', justifyContent: 'center'};
const captions = {fonts: {display, ui}, palette: {ink, paper, accent}, radius};

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

function Glyphs({text, frame, at, size = SIZES.headline, color = ink, stagger = 2}: {text: string; frame: number; at: number; size?: number; color?: string; stagger?: number}) {
  return <span style={{display: 'flex', color, fontFamily: display, fontSize: size, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.04em'}}>
    {Array.from(text).map((glyph, index) => {
      const rise = span(frame, at + index * stagger, 12);
      // Gothic A1 ink rises above the 1em line box, so the mask grows upward without moving the glyph.
      return <span key={index} style={{display: 'inline-block', overflow: 'hidden', height: '1.15em', paddingTop: '0.1em', marginTop: '-0.1em', paddingInline: '0.06em', marginInline: '-0.06em'}}>
        <span style={{display: 'inline-block', transform: `translateY(${(1 - rise) * 120}%)`, visibility: rise === 0 ? 'hidden' : 'visible'}}>{glyph === ' ' ? ' ' : glyph}</span>
      </span>;
    })}
  </span>;
}

function Label({children, frame, at, color = ink, size = SIZES.label * 1.3}: {children: string; frame: number; at: number; color?: string; size?: number}) {
  return <div style={{fontFamily: ui, fontWeight: 500, fontSize: size, color, opacity: span(frame, at, 10), whiteSpace: 'nowrap'}}>{children}</div>;
}

/** The ring that carries the film: the share of focused time, drawn as an arc of the one stroke width. */
function Ring({size, share, draw, track = soft}: {size: number; share: number; draw: number; track?: string}) {
  const r = (size - stroke) / 2;
  return <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{transform: 'rotate(-90deg)'}}>
    <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
    <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={accent} strokeWidth={stroke} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - share * draw} />
  </svg>;
}

function Hook({frame, at}: {frame: number; at: number}) {
  const draw = span(frame, 0, 40);
  return <AbsoluteFill style={{background: ink}}>
    <MotionProbe id="clock" value={draw} family="shape" axis="progress" />
    <Clock size={SIZES.hero * 1.3} ink={paper} accent={accent} soft={ink} paper={ink} stroke={stroke} radius={radius} draw={draw} style={{position: 'absolute', left: SIZES.marginX + S * 0.06, top: (H - SIZES.hero * 1.3) / 2}} />
    <div style={{position: 'absolute', left: W * 0.5, top: H * 0.33, display: 'flex', flexDirection: 'column', gap: S * 0.025}}>
      <Glyphs text="하루의 시간을" frame={frame} at={at} color={paper} />
      <Glyphs text="숫자 하나로." frame={frame} at={at + 14} color={accent} />
    </div>
  </AbsoluteFill>;
}

function Define({frame, at, progress}: {frame: number; at: number; progress: number}) {
  // Paper grows out of the clock face, so the scene is born from the hook's object.
  const field = interpolate(frame, [at, at + 30], [0, 1], {...clamp, easing: Easing.in(Easing.cubic)}) * W;
  const size = SIZES.hero * 1.5;
  return <AbsoluteFill style={{background: ink}}>
    <AbsoluteFill style={{background: paper, clipPath: `circle(${field}px at ${SIZES.marginX + S * 0.06 + SIZES.hero * 0.65}px ${H / 2}px)`}}>
      <MotionProbe id="field" value={field} family="wipe" axis="progress" />
      {/* The promoted word sits behind the ring, the subject, not behind the labels. */}
      <div style={{position: 'absolute', inset: 0, transform: `translateX(${W * 0.31 - W / 2}px)`}}><Subtitles timing={timing} style="embed" {...captions} /></div>
      <div style={{position: 'absolute', left: W * 0.31 - size / 2, top: (H - size) / 2, ...center}}>
        <Ring size={size} share={progress} draw={span(frame, at + 6, 30)} />
      </div>
      <div style={{position: 'absolute', left: W * 0.6, top: H * 0.5 - SIZES.label * 2, display: 'flex', flexDirection: 'column', gap: S * 0.02}}>
        <Label frame={frame} at={at + 20} size={SIZES.label * 1.6}>집중한 시간</Label>
        <Label frame={frame} at={at + 26} size={SIZES.label * 1.6} color={accent}>÷ 전체 시간</Label>
      </div>
    </AbsoluteFill>
  </AbsoluteFill>;
}

function FormulaScene({frame, at, progress}: {frame: number; at: number; progress: number}) {
  const rise = pop(frame, at, 20, true);
  return <AbsoluteFill style={{background: paper}}>
    <MotionProbe id="formula" value={(1 - rise) * S * 0.1} family="card" axis="y" />
    <div style={{position: 'absolute', inset: 0, ...center, flexDirection: 'column', gap: S * 0.06, paddingBottom: S * 0.3, transform: `translateY(${(1 - rise) * S * 0.1}px)`}}>
      <Formula tex="I = \frac{t_{f}}{t_{a}} \times 100" size={S * 0.13} color={ink} draw={span(frame, at, 36)} highlight={progress > 0.62 ? ['\\times 100'] : []} highlightColor={accent} />
      <div style={{display: 'flex', gap: S * 0.08}}>
        <Label frame={frame} at={at + 24}>분자: 집중 시간</Label>
        <Label frame={frame} at={at + 30}>분모: 전체 시간</Label>
        <Label frame={frame} at={at + 36} color={accent}>I: 예시 지수</Label>
      </div>
    </div>
  </AbsoluteFill>;
}

function Example({frame, at}: {frame: number; at: number}) {
  const full = W * 0.62, barH = S * 0.13;
  const total = pop(frame, at + 4, 24, true), focus = pop(frame, at + 30, 24, true);
  return <AbsoluteFill style={{background: paper}}>
    <MotionProbe id="bar-total" value={total * full} family="card" axis="x" />
    <MotionProbe id="bar-focus" value={focus * full * 5 / 8} family="card" axis="x" />
    <div style={{position: 'absolute', left: SIZES.marginX + S * 0.04, top: H * 0.26, display: 'flex', flexDirection: 'column', gap: S * 0.07}}>
      {[['전체 8시간', total, 1, soft, ink], ['집중 5시간', focus, 5 / 8, accent, paper]].map(([label, p, share, fill, text]) => <div key={label as string} style={{display: 'flex', alignItems: 'center', gap: S * 0.04}}>
        <div style={{width: full * (share as number) * (p as number), height: barH, borderRadius: radius, background: fill as string, ...center, justifyContent: 'flex-start', overflow: 'hidden'}}>
          <span style={{marginLeft: S * 0.03, fontFamily: ui, fontWeight: 600, fontSize: SIZES.label * 1.5, color: text as string, whiteSpace: 'nowrap', opacity: (p as number) > 0.6 ? 1 : 0}}>{label as string}</span>
        </div>
      </div>)}
    </div>
    <div style={{position: 'absolute', left: SIZES.marginX + S * 0.04, top: H * 0.66}}><Label frame={frame} at={at + 50} size={SIZES.label}>숫자는 예시</Label></div>
  </AbsoluteFill>;
}

function Result({frame, at, progress}: {frame: number; at: number; progress: number}) {
  const value = interpolate(progress, [0.1, 0.9], [0, 62.5], clamp);
  const size = SIZES.hero * 1.7;
  return <AbsoluteFill style={{background: paper}}>
    <div style={{position: 'absolute', left: (W - size) / 2, top: (H - size) / 2, ...center}}>
      <Ring size={size} share={value / 100} draw={1} />
    </div>
    <div style={{position: 'absolute', inset: 0, ...center, flexDirection: 'column', gap: S * 0.01}}>
      <span style={{fontFamily: display, fontWeight: 900, fontSize: SIZES.headline * 2, lineHeight: 1, letterSpacing: '-0.04em', color: ink, fontVariantNumeric: 'tabular-nums'}}>{value.toFixed(1)}</span>
      <Label frame={frame} at={at + 10} color={accent} size={SIZES.label * 1.2}>예시 지수 (예시 값)</Label>
    </div>
  </AbsoluteFill>;
}

function Trend({frame, at}: {frame: number; at: number}) {
  const draw = span(frame, at, 50);
  const size = SIZES.hero * 1.6;
  return <AbsoluteFill style={{background: paper}}>
    <MotionProbe id="chart" value={draw} family="shape" axis="progress" />
    <LineChart size={size} ink={ink} accent={accent} soft={soft} paper={paper} stroke={stroke} radius={radius} draw={draw} style={{position: 'absolute', left: SIZES.marginX + S * 0.04, top: (H - size) / 2 - S * 0.04}} />
    <div style={{position: 'absolute', left: W * 0.5, top: H * 0.3, display: 'flex', flexDirection: 'column', gap: S * 0.03}}>
      <Glyphs text="매일 기록하면" frame={frame} at={at + 10} />
      <Glyphs text="한 주가 선 하나로." frame={frame} at={at + 24} size={SIZES.headline * 0.8} color={accent} />
      <Label frame={frame} at={at + 50} size={SIZES.label}>지난 7일 · 예시 데이터</Label>
    </div>
  </AbsoluteFill>;
}

function Close({frame, at}: {frame: number; at: number}) {
  const wipe = span(frame, at - 6, 16);
  const bar = span(frame, at + 30, 16);
  return <AbsoluteFill style={{background: paper}}>
    <AbsoluteFill style={{background: ink, clipPath: `inset(0 0 0 ${(1 - wipe) * 100}%)`}}>
      <MotionProbe id="close-wipe" value={wipe} family="wipe" axis="progress" />
      <div style={{position: 'absolute', inset: 0, ...center, flexDirection: 'column', gap: S * 0.035, paddingBottom: S * 0.08}}>
        <Glyphs text="예시 지수" frame={frame} at={at + 6} size={SIZES.headline * 1.6} color={paper} />
        <div style={{width: W * 0.3, height: S * 0.016, borderRadius: radius, background: accent, transform: `scaleX(${bar})`}} />
        <Label frame={frame} at={at + 40} color={paper} size={SIZES.label * 1.2}>가상 서비스 · 숫자는 예시</Label>
      </div>
    </AbsoluteFill>
  </AbsoluteFill>;
}

export function NarratedExplainer() {
  const frame = useCurrentFrame();
  const n = useNarration(timing);
  const at = {define: n.at('define'), formula: n.at('formula'), example: n.at('example'), result: n.at('result'), trend: n.at('trend'), close: n.at('close')};
  const scene = frame < at.define ? 'hook' : frame < at.formula ? 'define' : frame < at.example ? 'formula' : frame < at.result ? 'example' : frame < at.trend ? 'result' : frame < at.close ? 'trend' : 'close';
  // Progress through a spoken line, held at 1 through the gap after it (the hook's progress would drop to 0 there).
  const spoken = (id: string) => interpolate(frame, [n.line(id).startFrame, n.line(id).endFrame], [0, 1], clamp);
  const camera = push(frame, at.result, 40, 0.04) * push(frame, at.close, 40, 0.04);
  return <AbsoluteFill style={{background: ink, overflow: 'hidden'}}>
    <Voiceover src="/audio/generated/narrated-explainer/voice.wav" />
    <Audio src="/audio/generated/narrated-explainer/music.wav" volume={0.45} />
    <MotionSound src="/audio/generated/narrated-explainer/whoosh.wav" role="move" families={['wipe', 'card']} quiet={[at.define, at.result]} />
    <MotionSound src="/audio/generated/narrated-explainer/pop.wav" role="land" families={['card', 'shape']} quiet={[at.define, at.result]} />
    <AbsoluteFill style={{transform: `scale(${camera})`}}>
      {scene === 'hook' ? <Hook frame={frame} at={n.at('hook')} /> : null}
      {scene === 'define' ? <Define frame={frame} at={at.define} progress={spoken('define')} /> : null}
      {scene === 'formula' ? <FormulaScene frame={frame} at={at.formula} progress={spoken('formula')} /> : null}
      {scene === 'example' ? <Example frame={frame} at={at.example} /> : null}
      {scene === 'result' ? <Result frame={frame} at={at.result} progress={spoken('result')} /> : null}
      {scene === 'trend' ? <Trend frame={frame} at={at.trend} /> : null}
      {scene === 'close' ? <Close frame={frame} at={at.close} /> : null}
    </AbsoluteFill>
    {/* The rail is an overlay in front of every scene; nothing above was moved up to make room for it. */}
    <Subtitles timing={timing} {...captions} />
  </AbsoluteFill>;
}
