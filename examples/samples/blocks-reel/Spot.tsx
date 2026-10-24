import type {ReactNode} from 'react';
import {AbsoluteFill, Audio, MotionProbe, MotionSound, googleFont, spring, useCurrentFrame} from 'frameforge';
import {Bell} from '@/assets';
import {Checklist, Counter, GlyphRise, HighlightSweep, LogoOutro, LowerThird, MessageThread, NotificationCard, StatCard, Ticker, Typewriter, WordCascade, ZoomSwap, blockRise, type BlockProps, type LowerThirdVariant} from '@/blocks';

// 온결 (fictional) block reel: every block of the text, lower-third and card families once, 30 s, scene changes always upward.
const W = 1920;
const H = 1080;
const S = Math.min(W, H);
const SIZES = {headline: S * 0.1, label: S * 0.035, hero: S * 0.35, marginX: W * 0.05, marginY: H * 0.05};
// Accent chosen so paper (3.46:1) and ink (4.63:1) both clear the contrast audit on it.
const palette = {ink: '#15161A', paper: '#F3F1EB', accent: '#E8481F', soft: '#FFD9CC'};
const fonts = {display: googleFont('Gothic A1', {weights: [900], fallback: 'sans-serif'}), ui: googleFont('Noto Sans KR', {weights: [500], fallback: 'sans-serif'})};
const AT = {hook: 0, cascade: 80, zoom: 170, type: 280, sweep: 360, counter: 440, stats: 500, toast: 580, thread: 650, check: 730, outro: 800, end: 900};
const WIPE = 12;
const HITS = [AT.cascade, AT.counter, AT.outro];
const DISC = {x: W * 0.72, y: H * 0.5};

type Scene = {frame: number};
const common = (frame: number): Omit<BlockProps, 'at' | 'size'> => ({frame, fps: 30, palette, fonts});

/** A scene background that wipes up from the bottom edge over the previous scene. */
function Wipe({frame, at, color, children}: Scene & {at: number; color: string; children?: ReactNode}) {
  const w = blockRise(frame, at, WIPE);
  return <AbsoluteFill style={{background: color, clipPath: `inset(${(1 - w) * 100}% 0 0 0)`}}>
    <MotionProbe id={`wipe-${at}`} value={w} family="wipe" axis="progress" />
    {children}
  </AbsoluteFill>;
}

/** The accent disc: the hero of the hook, grown into a background, kept as the counterweight of the card beats. */
function Disc({frame, at, id = `disc-${at}`, scale = 1, color = palette.accent}: Scene & {at: number; id?: string; scale?: number; color?: string}) {
  const pop = spring({frame, fps: 30, delay: at, durationInFrames: 18});
  const d = SIZES.hero * 1.1 * pop * scale;
  return <>
    <MotionProbe id={id} value={d} family="shape" axis="scale" />
    <div style={{position: 'absolute', left: DISC.x - d / 2, top: DISC.y - d / 2, width: d, height: d, borderRadius: '50%', background: color}} />
  </>;
}

/** A paper panel with the ink offset block, risen on a settled spring; the stage for the typewriter and the checklist. */
function Panel({frame, at, width, height, children}: Scene & {at: number; width: number; height: number; children?: ReactNode}) {
  const rise = spring({frame, fps: 30, delay: at, durationInFrames: 20, config: {overshootClamping: true}});
  const offset = S * 0.022;
  return <div style={{position: 'absolute', left: (W - width) / 2, top: (H - height) / 2, width, height, transform: `translateY(${(1 - rise) * H}px)`}}>
    <MotionProbe id={`panel-${at}`} value={(1 - rise) * H} family="card" axis="y" />
    <div style={{position: 'absolute', left: offset, top: offset, width, height, background: palette.ink}} />
    <div style={{position: 'absolute', inset: 0, background: palette.paper}}>{children}</div>
  </div>;
}

// On an ink scene the lower third inverts ink and paper; on the accent scene its accent shapes turn ink so they stay visible.
const TONES = {paper: palette, ink: {...palette, ink: palette.paper, paper: palette.ink}, accent: {...palette, accent: palette.ink}};
const Third = ({frame, at, out, variant, side = 'left', on = 'paper'}: Scene & {at: number; out: number; variant: LowerThirdVariant; side?: 'left' | 'right'; on?: keyof typeof TONES}) =>
  <LowerThird {...common(frame)} palette={TONES[on]} at={at} out={out} size={S * 0.06} variant={variant} side={side} name="김온결" role="제품 디자이너 · 가상 인물" />;

function Hook({frame}: Scene) {
  return <AbsoluteFill style={{background: palette.ink}}>
    <Disc frame={frame} at={AT.hook} />
    <div style={{position: 'absolute', left: SIZES.marginX, top: H * 0.33, display: 'flex', flexDirection: 'column', gap: S * 0.025}}>
      <GlyphRise {...common(frame)} at={AT.hook + 8} x={0} y={0} size={SIZES.headline * 1.25} color={palette.paper} text="하루를 잇는" />
      <GlyphRise {...common(frame)} at={AT.hook + 22} x={0} y={SIZES.headline * 1.5} size={SIZES.headline * 1.25} color={palette.paper} text="가장 가벼운 방법" />
    </div>
  </AbsoluteFill>;
}

function Cascade({frame}: Scene) {
  // Born from the hook's disc: it grows until it covers the frame, then the copy cascades onto it.
  const grow = 1 + blockRise(frame, AT.cascade, WIPE) * 7;
  // Once the disc covers the frame the fill becomes the scene background, so the copy has a real background behind it.
  return <AbsoluteFill style={{background: frame >= AT.cascade + WIPE ? palette.accent : 'transparent'}}>
    <Disc frame={frame} at={AT.hook} id="disc-grow" scale={grow} />
    <WordCascade {...common(frame)} at={AT.cascade + WIPE} out={AT.zoom + 2} size={SIZES.headline * 1.1} lines={['가볍게 시작하고', '단단하게 이어집니다']} />
    <Third frame={frame} at={AT.cascade + 22} out={AT.zoom - 10} variant="clean-bar" on="accent" />
  </AbsoluteFill>;
}

function Zoom({frame}: Scene) {
  return <Wipe frame={frame} at={AT.zoom} color={palette.paper}>
    <ZoomSwap {...common(frame)} at={AT.zoom + 6} out={AT.type + 4} align="center" size={SIZES.headline * 1.75} words={['출근길에', '점심시간에', '잠들기 전에']} hold={26} swap={14} />
    <Third frame={frame} at={AT.zoom + 18} out={AT.type - 10} variant="bold-block" />
  </Wipe>;
}

function Type({frame}: Scene) {
  return <Wipe frame={frame} at={AT.type} color={palette.ink}>
    <Panel frame={frame} at={AT.type} width={W * 0.72} height={H * 0.36}>
      <div style={{position: 'absolute', left: S * 0.06, top: S * 0.05, width: S * 0.12, height: S * 0.012, background: palette.accent}} />
      <Typewriter {...common(frame)} at={AT.type + 16} out={AT.sweep + 2} x={S * 0.06} y={S * 0.12} size={S * 0.072} speed={2} text="오늘 할 일 세 가지를 적습니다." />
    </Panel>
    <Third frame={frame} at={AT.type + 26} out={AT.sweep - 10} variant="kicker-name" side="right" on="ink" />
  </Wipe>;
}

function Sweep({frame}: Scene) {
  return <Wipe frame={frame} at={AT.sweep} color={palette.paper}>
    <HighlightSweep {...common(frame)} at={AT.sweep + 6} out={AT.counter + 2} align="center" size={SIZES.headline * 1.1} before="작은 기록이 " word="큰 흐름" after="이 됩니다" delay={14} sweep={14} />
    <Third frame={frame} at={AT.sweep + 18} out={AT.counter - 10} variant="soft-pill" />
  </Wipe>;
}

function Count({frame}: Scene) {
  return <Wipe frame={frame} at={AT.counter} color={palette.accent}>
    <Counter {...common(frame)} at={AT.counter + 6} out={AT.stats + 2} align="center" size={SIZES.headline * 2.6} color={palette.paper} to={1284} unit="일" count={40} example />
    <div style={{position: 'absolute', left: 0, right: 0, top: H * 0.7, textAlign: 'center', fontFamily: fonts.ui, fontSize: SIZES.label * 1.3, fontWeight: 500, color: palette.ink, opacity: blockRise(frame, AT.counter + 30, 12)}}>이어진 날 · 샘플 데이터</div>
  </Wipe>;
}

function Stats({frame}: Scene) {
  const size = S * 0.06;
  return <Wipe frame={frame} at={AT.stats} color={palette.paper}>
    <StatCard {...common(frame)} at={AT.stats + 4} out={AT.toast + 2} x={W * 0.1} y={H * 0.3} size={size} value={1284} unit="일" label="이어진 날" />
    <StatCard {...common(frame)} at={AT.stats + 14} out={AT.toast + 2} x={W * 0.55} y={H * 0.3} size={size} value={92} unit="%" label="다시 돌아온 비율" />
    <Third frame={frame} at={AT.stats + 26} out={AT.toast - 10} variant="mask-reveal" />
  </Wipe>;
}

function Toast({frame}: Scene) {
  return <Wipe frame={frame} at={AT.toast} color={palette.ink}>
    <Disc frame={frame} at={AT.toast + 4} />
    <NotificationCard {...common(frame)} at={AT.toast + 8} duration={54} x={SIZES.marginX} y={H * 0.12} size={S * 0.052} icon={Bell} title="온결" body="오늘의 기록이 저장됐어요" time="지금" />
    <Third frame={frame} at={AT.toast + 22} out={AT.thread - 10} variant="side-rule" on="ink" />
  </Wipe>;
}

function Thread({frame}: Scene) {
  return <Wipe frame={frame} at={AT.thread} color={palette.paper}>
    <Disc frame={frame} at={AT.thread + 2} color={palette.soft} />
    <MessageThread {...common(frame)} at={AT.thread + 8} out={AT.check + 2} x={SIZES.marginX} y={H * 0.16} size={S * 0.056} width={W * 0.5} step={22} typing={10} messages={[
      {side: 'left', name: '온결', text: '오늘도 기록을 이었어요'},
      {side: 'right', name: '나', text: '벌써 1,284일째네요'},
      {side: 'left', name: '온결', text: '내일도 같은 시간에 만나요'},
    ]} />
  </Wipe>;
}

function Check({frame}: Scene) {
  return <Wipe frame={frame} at={AT.check} color={palette.accent}>
    <Panel frame={frame} at={AT.check} width={W * 0.62} height={H * 0.5}>
      <Checklist {...common(frame)} at={AT.check + 10} out={AT.outro - 12} x={S * 0.09} y={S * 0.075} size={S * 0.07} items={['기록을 남긴다', '흐름을 잇는다', '내일을 확인한다']} />
    </Panel>
    <Ticker {...common(frame)} at={AT.check + 20} out={AT.outro - 6} size={S * 0.042} speed={5} items={['서울', '부산', '대전', '광주', '제주', '강릉']} />
  </Wipe>;
}

function Outro({frame}: Scene) {
  return <Wipe frame={frame} at={AT.outro} color={palette.ink}>
    <LogoOutro {...common(frame)} at={AT.outro} align="center" size={SIZES.headline * 2.1} color={palette.paper} brand="온결" tagline="하루를 잇다 · 가상 브랜드" />
  </Wipe>;
}

const SCENES: [number, (props: Scene) => ReactNode][] = [[AT.hook, Hook], [AT.cascade, Cascade], [AT.zoom, Zoom], [AT.type, Type], [AT.sweep, Sweep], [AT.counter, Count], [AT.stats, Stats], [AT.toast, Toast], [AT.thread, Thread], [AT.check, Check], [AT.outro, Outro]];

export function BlocksReel() {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{background: palette.ink, overflow: 'hidden'}}>
    <Audio src="/audio/generated/blocks-reel/music.wav" volume={0.9} />
    <MotionSound src="/audio/generated/blocks-reel/whoosh.wav" role="move" families={['wipe', 'card']} quiet={HITS} />
    <MotionSound src="/audio/generated/blocks-reel/pop.wav" role="land" families={['card', 'shape']} quiet={HITS} />
    <MotionSound src="/audio/generated/blocks-reel/ding.wav" role="appear" families={['card', 'text']} quiet={HITS} />
    {/* A scene stays mounted through the next scene's wipe so the wipe has something to cover. */}
    {SCENES.map(([at, Scene], i) => frame >= at && frame < (SCENES[i + 1]?.[0] ?? AT.end) + WIPE ? <Scene key={at} frame={frame} /> : null)}
  </AbsoluteFill>;
}
