import type {CSSProperties} from 'react';
import {AbsoluteFill, Audio, Encircle, Generative, Highlight, ImageSequence, MotionProbe, MotionSound, Seam, Sequence, Solid, Subtitles, Voiceover, googleFont, grainEffect, interpolate, lightLeakEffect, spring, useCurrentFrame, useNarration, vignetteEffect} from 'frameforge';
import {Donut, GlyphRise, LogoOutro, LowerThird, NotificationCard, ProcessSteps, StatCard, type BlockProps} from '@/blocks';
import {Book, Calendar, Card} from '@/assets';
import timing from './narration.timing.json';

// 하루결 (fictional planner app). Narration first: every scene starts on a measured line; the hero is a Blender-rendered ring
// (3d.json → npm run blender), titles and cards come from the block catalogue, cuts are seams in one leftward current,
// the open rides an aurora and the close carries grain and a vignette. Numbers on screen are 예시.
const W = 1920;
const H = 1080;
const S = Math.min(W, H);
const SIZES = {headline: S * 0.1, label: S * 0.035, hero: S * 0.35, marginX: W * 0.05, marginY: H * 0.05};
const display = googleFont('Gothic A1', {weights: [900], fallback: 'sans-serif'});
const ui = googleFont('Noto Sans KR', {weights: [500, 600], fallback: 'sans-serif'});
const ink = '#121A2B';
const paper = '#F4F1EA';
const accent = '#2F5BFF';
const soft = '#CFD6E6';
const palette = {ink, paper, accent, soft};
const fonts = {display, ui};
const radius = 18;
const SEAM = 16;
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} satisfies {extrapolateLeft: 'clamp'; extrapolateRight: 'clamp'};
const center: CSSProperties = {display: 'flex', alignItems: 'center', justifyContent: 'center'};
const captions = {fonts, palette: {ink, paper, accent}, radius};
const common = (frame: number): Omit<BlockProps, 'at' | 'size'> => ({frame, fps: 30, palette, fonts});
const onInk = {...palette, ink: paper, paper: ink};

function pop(frame: number, at: number, dur: number, settle = false): number {
  return spring({frame, fps: 30, delay: at, durationInFrames: dur, config: {overshootClamping: settle}});
}

/** The rendered ring: 150 turntable frames looping from `at` (the Sequence resets the clock), framed by `size`. */
function Hero({frame, at, size, x, y, id}: {frame: number; at: number; size: number; x: number; y: number; id: string}) {
  const rise = pop(frame, at, 22, true);
  return <div style={{position: 'absolute', left: x, top: y + (1 - rise) * S * 0.12, width: size, height: size * 9 / 16, opacity: Math.min(1, rise * 1.4)}}>
    <MotionProbe id={id} value={(1 - rise) * S * 0.12} family="card" axis="y" />
    <Sequence from={at} layout="none"><ImageSequence src="/assets/generated/showcase-spot/3d/hero" frames={150} fps={30} loop fit="contain" style={{position: 'absolute', inset: 0}} /></Sequence>
  </div>;
}

function Hook({frame, at, progress}: {frame: number; at: number; progress: number}) {
  const circle = interpolate(progress, [0.45, 0.85], [0, 1], clamp);
  return <AbsoluteFill style={{background: ink}}>
    <Generative system="aurora" seed="harugyeol" width={W} height={H} fit="fill" palette={palette} params={{bands: 4, speed: 0.05, height: 0.22, amplitude: 0.08, scale: 1.1}} style={{position: 'absolute', left: 0, top: 0, opacity: 0.9}} />
    <div style={{position: 'absolute', left: SIZES.marginX + S * 0.04, top: H * 0.3, display: 'flex', flexDirection: 'column', gap: S * 0.03}}>
      <GlyphRise {...common(frame)} at={at + 2} x={0} y={0} size={SIZES.headline * 1.2} color={paper} text="하루가 흩어질 때," />
      <div style={{marginTop: SIZES.headline * 1.5}}>
        <Encircle progress={circle} color={accent} seed="gyeol" roughness={0.6} strokeWidth={10} padding={22}>
          <GlyphRise {...common(frame)} at={at + 26} x={0} y={0} size={SIZES.headline * 1.2} color={paper} text="결을 잡아 주는 앱." />
        </Encircle>
      </div>
    </div>
  </AbsoluteFill>;
}

function Brand({frame, at}: {frame: number; at: number}) {
  return <AbsoluteFill style={{background: paper}}>
    {/* The promoted word sits behind the ring, the subject. */}
    <Subtitles timing={timing} style="embed" {...captions} />
    <Hero frame={frame} at={at - SEAM / 2} size={W * 0.5} x={W * 0.45} y={H * 0.12} id="hero-brand" />
    <LowerThird {...common(frame)} at={at + 18} size={S * 0.06} variant="mask-reveal" name="하루결" role="하루를 한 결로 · 가상 브랜드" />
  </AbsoluteFill>;
}

function Product({frame, at}: {frame: number; at: number}) {
  const toasts: [typeof Card, string, string][] = [[Card, '할 일', '아침 러닝 30분'], [Book, '메모', '회의 전에 읽을 것 셋'], [Calendar, '일정', '오후 3시 디자인 리뷰']];
  return <AbsoluteFill style={{background: paper}}>
    <Hero frame={frame} at={at - 40} size={W * 0.46} x={W * 0.5} y={H * 0.2} id="hero-product" />
    <GlyphRise {...common(frame)} at={at + 2} x={SIZES.marginX + S * 0.04} y={H * 0.12} size={SIZES.headline} color={ink} text="한 결로 모입니다" />
    {toasts.map(([Icon, title, body], i) => <NotificationCard key={title} {...common(frame)} at={at + 22 + i * 14} x={SIZES.marginX + S * 0.04} y={H * 0.29 + i * S * 0.155} size={S * 0.054} icon={Icon} title={title} body={body} time={`0${7 + i}:30 · 예시`} from="right" width={W * 0.4} />)}
  </AbsoluteFill>;
}

function Data({frame, at, until}: {frame: number; at: number; until: number}) {
  return <AbsoluteFill style={{background: paper}}>
    <GlyphRise {...common(frame)} at={at + 2} x={SIZES.marginX + S * 0.04} y={H * 0.12} size={SIZES.headline} color={ink} text="아침 계획, 열 명 중 여덟" />
    <Donut frame={frame} at={at + 12} out={until} palette={palette} fonts={fonts} size={SIZES.label * 1.1} x={SIZES.marginX + S * 0.04} y={H * 0.3} width={S * 0.6} height={S * 0.6} value={80} unit="%" label="아침 계획 완료" />
    <StatCard {...common(frame)} at={at + 30} out={until} x={W * 0.52} y={H * 0.36} size={S * 0.06} value={8} unit="명" label="열 명 중 (예시)" />
  </AbsoluteFill>;
}

function Steps({frame, at, until}: {frame: number; at: number; until: number}) {
  return <AbsoluteFill style={{background: paper}}>
    <GlyphRise {...common(frame)} at={at + 2} x={SIZES.marginX + S * 0.04} y={H * 0.12} size={SIZES.headline} color={ink} text="세 단계면 충분합니다" />
    <ProcessSteps frame={frame} at={at + 14} out={until} palette={palette} fonts={fonts} size={SIZES.label * 1.3} x={SIZES.marginX + S * 0.04} y={H * 0.36} width={W * 0.9 - S * 0.08} height={S * 0.4} steps={['적기', '고르기', '끝내기']} />
  </AbsoluteFill>;
}

function Promise({frame, at, progress}: {frame: number; at: number; progress: number}) {
  const highlight = interpolate(progress, [0.35, 0.8], [0, 1], clamp);
  return <AbsoluteFill style={{background: ink}}>
    <Generative system="flowField" seed="harugyeol-flow" width={W} height={H} fit="fill" palette={{...palette, accent: soft}} params={{lines: 110, steps: 100, stepLength: 0.005, scale: 2.2, grow: 3, strokeWidth: 0.002}} style={{position: 'absolute', left: 0, top: 0, opacity: 0.55}} />
    <div style={{position: 'absolute', left: W * 0.5 - S * 0.45, top: H * 0.27, width: S * 0.9, height: SIZES.headline * 1.5}}>
      <GlyphRise {...common(frame)} at={at + 4} x={0} y={0} size={SIZES.headline * 1.3} color={paper} text="오늘의 결을" />
    </div>
    <div style={{position: 'absolute', left: W * 0.5 - S * 0.45, top: H * 0.27 + SIZES.headline * 1.7, ...center, justifyContent: 'flex-start'}}>
      <Highlight progress={highlight} color={accent} seed="tomorrow" roughness={0.5} strokeWidth={70}>
        <span style={{display: 'inline-block', position: 'relative', height: SIZES.headline * 1.5, width: S * 0.86}}>
          <GlyphRise {...common(frame)} at={at + 18} x={0} y={0} size={SIZES.headline * 1.3} color={paper} text="내일로 잇습니다" />
        </span>
      </Highlight>
    </div>
  </AbsoluteFill>;
}

function Cta({frame, at, hold}: {frame: number; at: number; hold: number}) {
  return <AbsoluteFill style={{background: ink}}>
    <LogoOutro {...common(frame)} palette={onInk} at={at + 4} align="center" size={SIZES.headline * 2.2} color={paper} brand="하루결" tagline="지금 시작하세요 · 가상 브랜드" />
    <Solid width={W} height={H} effects={[vignetteEffect({amount: 0.5, softness: 0.6}), grainEffect({seed: 'cta', frame: Math.min(frame, hold), amount: 0.08, size: 2})]} style={{position: 'absolute', left: 0, top: 0}} />
  </AbsoluteFill>;
}

export function ShowcaseSpot() {
  const frame = useCurrentFrame();
  const n = useNarration(timing);
  const at = {brand: n.at('name'), product: n.at('product'), data: n.at('data'), steps: n.at('steps'), promise: n.at('promise'), cta: n.at('cta')};
  const hold = n.line('cta').endFrame;
  const spoken = (id: string) => interpolate(frame, [n.line(id).startFrame, n.line(id).endFrame], [0, 1], clamp);
  const leak = interpolate(frame, [at.cta - 14, at.cta + 14], [0, 1], clamp);
  return <AbsoluteFill style={{background: ink, overflow: 'hidden'}}>
    <Voiceover src="/audio/generated/showcase-spot/voice.wav" />
    <Audio src="/audio/generated/showcase-spot/music.wav" volume={0.45} />
    <MotionSound src="/audio/generated/showcase-spot/whoosh.wav" role="move" families={['card', 'camera']} quiet={[at.brand, at.cta]} />
    <MotionSound src="/audio/generated/showcase-spot/pop.wav" role="land" families={['card', 'shape']} quiet={[at.brand, at.cta]} />
    {/* One leftward current; Z seams only where the meaning asks: deeper into the name, and the promise arriving bigger. */}
    <Seam at={at.brand - SEAM / 2} duration={SEAM} technique="zoomThrough" subject="text" id="s1" from={<Hook frame={frame} at={n.at('hook')} progress={spoken('hook')} />} to={
      <Seam at={at.product - SEAM / 2} duration={SEAM} id="s2" from={<Brand frame={frame} at={at.brand} />} to={
        <Seam at={at.data - SEAM / 2} duration={SEAM} id="s3" from={<Product frame={frame} at={at.product} />} to={
          <Seam at={at.steps - SEAM / 2} duration={SEAM} id="s4" from={<Data frame={frame} at={at.data} until={at.steps + 2} />} to={
            <Seam at={at.promise - SEAM / 2} duration={SEAM} technique="inverseZoom" id="s5" from={<Steps frame={frame} at={at.steps} until={at.promise + 2} />} to={
              <Seam at={at.cta - SEAM / 2} duration={SEAM} technique="rackFocus" id="s6" from={<Promise frame={frame} at={at.promise} progress={spoken('promise')} />} to={<Cta frame={frame} at={at.cta} hold={hold} />} />
            } />
          } />
        } />
      } />
    } />
    {leak > 0 && leak < 1 ? <Solid width={W} height={H} effects={[lightLeakEffect({seed: 'cta-seam', progress: leak, intensity: 0.8})]} style={{position: 'absolute', left: 0, top: 0}} /> : null}
    {/* The rail rides in front of every scene; no scene moved up to make room for it. */}
    <Subtitles timing={timing} {...captions} />
  </AbsoluteFill>;
}
