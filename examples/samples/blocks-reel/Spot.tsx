import type {ReactNode} from 'react';
import {AbsoluteFill, Audio, MotionProbe, MotionSound, googleFont, interpolate, spring, useCurrentFrame} from 'frameforge';
import {Bell} from '@/assets';
import {Checklist, Counter, GlyphRise, HighlightSweep, LogoOutro, LowerThird, MessageThread, NotificationCard, StatCard, Ticker, Typewriter, WordCascade, ZoomSwap, blockRise, type BlockProps, type LowerThirdVariant} from '@/blocks';

// 온결 (fictional) block reel: every block of the text, lower-third and card families once, 30 s, in four colour runs
// (ink → accent → paper → ink). Each run is born from an object of the last scene: the disc, the paper panel, the card's ink block.
const W = 1920;
const H = 1080;
const S = Math.min(W, H);
const SIZES = {headline: S * 0.1, label: S * 0.035, hero: S * 0.35, marginX: W * 0.05, marginY: H * 0.05};
// Accent chosen so paper (3.46:1) and ink (4.63:1) both clear the contrast audit on it.
const palette = {ink: '#15161A', paper: '#F3F1EB', accent: '#E8481F', soft: '#FFD9CC'};
const fonts = {display: googleFont('Gothic A1', {weights: [900], fallback: 'sans-serif'}), ui: googleFont('Noto Sans KR', {weights: [500], fallback: 'sans-serif'})};
const AT = {hook: 0, cascade: 80, zoom: 170, type: 280, sweep: 360, counter: 440, stats: 500, inbox: 580, check: 730, outro: 800, end: 900};
const GROW = 12;
const HITS = [AT.cascade, AT.counter, AT.outro];
const DISC = {x: W * 0.72, y: H * 0.5};
const PANEL = {width: W * 0.8, height: H * 0.36};
const CARD = {size: S * 0.06, x: W * 0.1, y: H * 0.3};

type Scene = {frame: number};
type Rect = {left: number; top: number; width: number; height: number};
const common = (frame: number): Omit<BlockProps, 'at' | 'size'> => ({frame, fps: 30, palette, fonts});
const CLAMP = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

/** A rectangle of the last scene growing into this scene's field over GROW frames; the children ride inside it so early text has its
 * colour behind it, and once it is full the scene background takes over. */
function Field({frame, at, from, color, children}: Scene & {at: number; from: Rect; color: string; children?: ReactNode}) {
  const g = blockRise(frame, at, GROW);
  const rect = {left: interpolate(g, [0, 1], [from.left, 0], CLAMP), top: interpolate(g, [0, 1], [from.top, 0], CLAMP), width: interpolate(g, [0, 1], [from.width, W], CLAMP), height: interpolate(g, [0, 1], [from.height, H], CLAMP)};
  return <AbsoluteFill style={{background: g >= 1 ? color : 'transparent'}}>
    <MotionProbe id={`field-${at}`} value={g} family="wipe" axis="progress" />
    {g < 1 ? <div style={{position: 'absolute', ...rect, background: color}}>{children}</div> : children}
  </AbsoluteFill>;
}

/** The accent disc: the hero of the hook that grows into the accent run. */
function Disc({frame, at, id = `disc-${at}`, scale = 1}: Scene & {at: number; id?: string; scale?: number}) {
  const pop = spring({frame, fps: 30, delay: at, durationInFrames: 18});
  const d = SIZES.hero * 1.1 * pop * scale;
  return <>
    <MotionProbe id={id} value={d} family="shape" axis="scale" />
    <div style={{position: 'absolute', left: DISC.x - d / 2, top: DISC.y - d / 2, width: d, height: d, borderRadius: '50%', background: palette.accent}} />
  </>;
}

/** A paper panel with the ink offset block, risen on a settled spring and dropped out at `out`; the stage for the typewriter and the checklist. */
function Panel({frame, at, out, width, height, children}: Scene & {at: number; out?: number; width: number; height: number; children?: ReactNode}) {
  const rise = spring({frame, fps: 30, delay: at, durationInFrames: 20, config: {overshootClamping: true}});
  const leave = out === undefined ? 0 : blockRise(frame, out, 12, x => x * x * x);
  const offset = S * 0.022;
  return <div style={{position: 'absolute', left: (W - width) / 2, top: (H - height) / 2, width, height, transform: `translateY(${(1 - rise + leave) * H}px)`}}>
    <MotionProbe id={`panel-${at}`} value={(1 - rise + leave) * H} family="card" axis="y" />
    <div style={{position: 'absolute', left: offset, top: offset, width, height, background: palette.ink}} />
    <div style={{position: 'absolute', inset: 0, background: palette.paper}}>{children}</div>
  </div>;
}

// On the accent run the lower third's accent shapes turn ink; on the ink run ink and paper swap, so every variant reads on its field.
const TONES = {paper: palette, ink: {...palette, ink: palette.paper, paper: palette.ink}, accent: {...palette, accent: palette.ink}};
const Third = ({frame, at, out, variant, on = 'paper', x}: Scene & {at: number; out: number; variant: LowerThirdVariant; on?: keyof typeof TONES; x?: number}) =>
  <LowerThird {...common(frame)} palette={TONES[on]} at={at} out={out} x={x} size={S * 0.06} variant={variant} name="김온결" role="제품 디자이너 · 가상 인물" />;

function Hook({frame}: Scene) {
  return <AbsoluteFill style={{background: palette.ink}}>
    <Disc frame={frame} at={AT.hook} />
    <div style={{position: 'absolute', left: SIZES.marginX, top: H * 0.33}}>
      <GlyphRise {...common(frame)} at={AT.hook + 8} x={0} y={0} size={SIZES.headline * 1.25} color={palette.paper} text="하루를 잇는" />
      <GlyphRise {...common(frame)} at={AT.hook + 22} x={0} y={SIZES.headline * 1.5} size={SIZES.headline * 1.25} color={palette.paper} text="가장 가벼운 방법" />
    </div>
  </AbsoluteFill>;
}

/** Accent run, 80–360: the disc grows into the field; cascade, zoom and the typewriter panel follow on it. */
function Cascade({frame}: Scene) {
  const grow = 1 + blockRise(frame, AT.cascade, GROW) * 7;
  // The eased growth covers the frame in about four frames; from there the field is the background and the copy starts at once.
  return <AbsoluteFill style={{background: frame >= AT.cascade + 4 ? palette.accent : 'transparent'}}>
    <Disc frame={frame} at={AT.hook} id="disc-grow" scale={grow} />
    <WordCascade {...common(frame)} at={AT.cascade + 4} out={AT.zoom - 14} stagger={2} size={SIZES.headline * 1.3} lines={['가볍게 시작하고', '단단하게 이어집니다']} />
    <Third frame={frame} at={AT.cascade + 22} out={AT.zoom - 10} variant="clean-bar" on="accent" />
  </AbsoluteFill>;
}

function Zoom({frame}: Scene) {
  return <AbsoluteFill style={{background: palette.accent}}>
    <ZoomSwap {...common(frame)} at={AT.zoom + 2} out={AT.type + 4} align="center" size={SIZES.headline * 1.75} words={['출근길에', '점심시간에', '잠들기 전에']} hold={26} swap={14} />
    <Third frame={frame} at={AT.zoom + 18} out={AT.type - 10} variant="bold-block" on="accent" />
  </AbsoluteFill>;
}

function Type({frame}: Scene) {
  return <AbsoluteFill style={{background: palette.accent}}>
    <Panel frame={frame} at={AT.type} width={PANEL.width} height={PANEL.height}>
      <div style={{position: 'absolute', left: S * 0.06, top: S * 0.05, width: S * 0.12, height: S * 0.012, background: palette.accent}} />
      <Typewriter {...common(frame)} at={AT.type + 16} out={AT.sweep + 2} x={S * 0.06} y={S * 0.11} size={SIZES.headline} speed={2} text="할 일 셋을 적습니다." />
    </Panel>
    <Third frame={frame} at={AT.type + 26} out={AT.sweep - 10} variant="kicker-name" on="accent" x={(W - PANEL.width) / 2} />
  </AbsoluteFill>;
}

/** Paper run, 360–580: the typewriter panel grows into the field; sweep, counter and the stat cards follow on it. */
function Sweep({frame}: Scene) {
  return <Field frame={frame} at={AT.sweep} color={palette.paper} from={{left: (W - PANEL.width) / 2, top: (H - PANEL.height) / 2, ...PANEL}}>
    <HighlightSweep {...common(frame)} at={AT.sweep + 3} out={AT.counter - 12} align="center" size={SIZES.headline * 1.1} before="작은 기록이 " word="큰 흐름" after="이 됩니다" delay={14} sweep={14} />
    <Third frame={frame} at={AT.sweep + 20} out={AT.counter - 10} variant="soft-pill" />
  </Field>;
}

function Count({frame}: Scene) {
  return <AbsoluteFill style={{background: palette.paper}}>
    <Counter {...common(frame)} at={AT.counter + 1} out={AT.stats + 2} align="center" size={SIZES.headline * 2.6} to={1284} unit="일" count={40} example />
    <div style={{position: 'absolute', left: 0, right: 0, top: H * 0.7, textAlign: 'center', fontFamily: fonts.ui, fontSize: SIZES.label * 1.3, fontWeight: 500, color: palette.ink, opacity: blockRise(frame, AT.counter + 30, 12)}}>이어진 날 · 샘플 데이터</div>
  </AbsoluteFill>;
}

function Stats({frame}: Scene) {
  return <AbsoluteFill style={{background: palette.paper}}>
    <StatCard {...common(frame)} at={AT.stats} out={AT.inbox + 2} x={CARD.x} y={CARD.y} size={CARD.size} value={1284} unit="일" label="이어진 날" />
    <StatCard {...common(frame)} at={AT.stats + 8} out={AT.inbox + 2} x={W * 0.55} y={CARD.y} size={CARD.size} value={92} unit="%" label="다시 돌아온 비율" />
    <Third frame={frame} at={AT.stats + 26} out={AT.inbox - 10} variant="mask-reveal" />
  </AbsoluteFill>;
}

/** Ink run, 580–900: the first stat card's ink block grows into the field; the toast announces, the thread replies, the checklist and the name follow. */
function Inbox({frame}: Scene) {
  const offset = S * 0.022;
  const size = S * 0.058;
  return <Field frame={frame} at={AT.inbox} color={palette.ink} from={{left: CARD.x + CARD.size * 0.4, top: CARD.y + CARD.size * 0.4, width: CARD.size * 10, height: CARD.size * 5.2}}>
    <NotificationCard {...common(frame)} at={AT.inbox + 4} out={AT.check - 6} x={W * 0.2} y={H * 0.08} width={W * 0.6} size={S * 0.065} icon={Bell} title="온결" body="오늘의 기록이 저장됐어요" time="지금" />
    <MessageThread {...common(frame)} at={AT.inbox + 30} out={AT.check + 2} x={W * 0.2 + offset} y={H * 0.33} size={size} width={W * 0.6 - offset * 2} step={22} typing={10} messages={[
      {side: 'left', name: '온결', text: '오늘도 기록을 이었어요'},
      {side: 'right', name: '나', text: '벌써 1,284일째네요'},
      {side: 'left', name: '온결', text: '내일도 같은 시간에 만나요'},
    ]} />
    <Third frame={frame} at={AT.inbox + 24} out={AT.check - 10} variant="side-rule" on="ink" />
  </Field>;
}

function Check({frame}: Scene) {
  return <AbsoluteFill style={{background: palette.ink}}>
    <Panel frame={frame} at={AT.check} out={AT.outro - 10} width={W * 0.62} height={H * 0.5}>
      <Checklist {...common(frame)} at={AT.check + 10} out={AT.outro - 12} x={S * 0.09} y={S * 0.075} size={S * 0.07} items={['기록을 남긴다', '흐름을 잇는다', '내일을 확인한다']} />
    </Panel>
    <Ticker {...common(frame)} at={AT.check + 20} out={AT.outro - 12} size={S * 0.042} speed={5} items={['서울', '부산', '대전', '광주', '제주', '강릉']} />
  </AbsoluteFill>;
}

function Outro({frame}: Scene) {
  return <AbsoluteFill style={{background: palette.ink}}>
    <LogoOutro {...common(frame)} at={AT.outro} align="center" size={SIZES.headline * 2.1} color={palette.paper} brand="온결" tagline="하루를 잇다 · 가상 브랜드" />
  </AbsoluteFill>;
}

const SCENES: [number, (props: Scene) => ReactNode][] = [[AT.hook, Hook], [AT.cascade, Cascade], [AT.zoom, Zoom], [AT.type, Type], [AT.sweep, Sweep], [AT.counter, Count], [AT.stats, Stats], [AT.inbox, Inbox], [AT.check, Check], [AT.outro, Outro]];

export function BlocksReel() {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{background: palette.ink, overflow: 'hidden'}}>
    <Audio src="/audio/generated/blocks-reel/music.wav" volume={0.9} />
    <MotionSound src="/audio/generated/blocks-reel/whoosh.wav" role="move" families={['wipe', 'card']} quiet={HITS} />
    <MotionSound src="/audio/generated/blocks-reel/pop.wav" role="land" families={['card', 'shape']} quiet={HITS} />
    <MotionSound src="/audio/generated/blocks-reel/ding.wav" role="appear" families={['card', 'text']} quiet={HITS} />
    {/* A scene stays mounted while the next scene's field grows over it. */}
    {SCENES.map(([at, Scene], i) => frame >= at && frame < (SCENES[i + 1]?.[0] ?? AT.end) + GROW ? <Scene key={at} frame={frame} /> : null)}
  </AbsoluteFill>;
}
