import type {CSSProperties, ReactNode} from 'react';
import {AbsoluteFill, Audio, CameraMotionBlur, MotionProbe, MotionSound, beatsFromSpec, googleFont, interpolate, interpolateColors, spring, springTrack, useCurrentFrame, Easing} from 'frameforge';
import spec from './audio.json';
import {Cursor} from './assets';

// One shape, never cut: a button becomes a loader, a check, a toggle, a slider, tabs, a chart, a toast and the name.
// Every value is a function of the frame (springTrack sums one spring per change). Brief: prompt.md.
const W = 1920;
const H = 1080;
const FPS = 60;
const SIZES = {headline: 108, label: 40, icon: 65, cursor: 96};
const display = googleFont('Gothic A1', {weights: [800], fallback: 'sans-serif'});
const ui = googleFont('Noto Sans KR', {weights: [500, 700], fallback: 'sans-serif'});
const paper = '#ECE9E4';
const soft = '#D5D0C8';
const ink = '#161616';
const accent = '#E2461C';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} satisfies {extrapolateLeft: 'clamp'; extrapolateRight: 'clamp'};
const grid = beatsFromSpec(spec, FPS);
/** Frame of beat n on the music grid (120 BPM at 60 fps: 30 frames a beat). */
const b = (n: number) => Math.round(grid.beatAt(0) + n * grid.framesPerBeat);
const SPRING = {damping: 26, stiffness: 180};
const SLOW = {damping: 24, stiffness: 110};
const FAST = {damping: 28, stiffness: 300};
const track = (frame: number, from: number, keys: [number, number][], config = SPRING) => springTrack({frame, fps: FPS, from, keys: keys.map(([at, to]) => ({at, to})), config});

// The beats each state starts on (prompt.md Structure).
const AT = {button: 0, loader: b(2), check: b(4), toggle: b(6), flip: b(7), slider: b(9), grab: b(10), drop: b(13), tabs: b(14), tab1: b(16), tab2: b(18), chart: b(20), hover: b(22), toast: b(24), name: b(26), still: b(28)};

// ---- the hero's shape and the camera: pure functions shared by the picture and the probes ----
const heroW = (f: number) => track(f, 360, [[AT.loader, 140], [AT.toggle, 280], [AT.slider, 1000], [AT.chart, 1100], [AT.toast, 780], [AT.name, 640]]);
const heroH = (f: number) => track(f, 112, [[AT.loader, 140], [AT.slider, 28], [AT.tabs, 120], [AT.chart, 640], [AT.toast, 140], [AT.name, 220]]);
const heroR = (f: number) => track(f, 56, [[AT.loader, 70], [AT.slider, 14], [AT.tabs, 60], [AT.chart, 40], [AT.toast, 70], [AT.name, 110]]);
const COLORS: [number, string][] = [[AT.toggle, ink], [AT.flip, accent], [AT.slider, soft], [AT.chart, ink], [AT.name, accent]];
function heroColor(f: number): string {
  let color = accent;
  // The colour arrives ahead of the shape (FAST) so a mid-morph mix never reads as a grey or salmon surface for long.
  for (const [at, next] of COLORS) if (f >= at) color = interpolateColors(spring({frame: f - at, fps: FPS, config: FAST}), [0, 1], [color, next]);
  return color;
}
// The camera zooms so each state fills the frame; it opens slightly too close and settles onto the button.
const camera = (f: number) => track(f, 3.3, [[0, 2.7], [AT.loader, 3.6], [AT.toggle, 3.3], [AT.slider, 1.6], [AT.chart, 1.3], [AT.toast, 2.0], [AT.name, 1.7]]);

// The slider knob: dragged by the cursor from beat 10 to 13, then it rests.
const KNOB_FROM = -200, KNOB_TO = 360;
const knobX = (f: number) => interpolate(f, [AT.grab + 4, AT.drop], [KNOB_FROM, KNOB_TO], {...clamp, easing: Easing.inOut(Easing.cubic)});
// The accent bar is the slider's fill, then the tab indicator: its edges ride different springs so the leading edge stretches ahead.
const barL = (f: number) => track(f, -500, [[AT.tabs, -490], [AT.tab1, -160], [AT.tab2, 173]], SLOW);
const barR = (f: number) => f < AT.tabs ? knobX(f) : track(f, KNOB_TO, [[AT.tabs, -170], [AT.tab1, 160], [AT.tab2, 490]], FAST);
const barH = (f: number) => track(f, 28, [[AT.tabs, 96]]);
// Toggle knob edges, same trick.
const toggleL = (f: number) => track(f, -126, [[AT.flip, 14]], SLOW);
const toggleR = (f: number) => track(f, -14, [[AT.flip, 126]], FAST);

// Cursor in world coordinates; it is drawn in screen space so it keeps its size.
const CURSOR: [number, number, number][] = [
  [10, 60, 22], [AT.loader + 8, 260, 170], [AT.toggle + 4, -70, 10], [AT.flip + 10, 150, 130],
  [AT.slider + 8, KNOB_FROM, 6], [AT.drop + 8, 470, 150], [AT.tabs + 30, 0, 14], [AT.tab1 + 30, 333, 14],
  [AT.tab2 + 14, 440, 150], [AT.chart + 40, 260, 40], [AT.toast, 1100, 700],
];
function cursorAt(f: number): {x: number; y: number} {
  const x = track(f, 620, CURSOR.map(([at, x]) => [at, x]), SLOW);
  const y = track(f, 420, CURSOR.map(([at, , y]) => [at, y]), SLOW);
  // While held, the cursor is the knob.
  return f >= AT.grab + 4 && f < AT.drop ? {x: knobX(f), y: 6} : {x, y};
}
const CLICKS = [AT.loader, AT.flip, AT.tab1, AT.tab2];
function press(f: number): number {
  const tap = (at: number) => interpolate(f, [at - 6, at - 2, at + 8], [0, 1, 0], clamp);
  const hold = interpolate(f, [AT.grab - 2, AT.grab + 2, AT.drop, AT.drop + 8], [0, 1, 1, 0], clamp);
  return Math.max(hold, ...CLICKS.map(tap));
}

/** 0..1 visibility of a state's content: a short blurred entry after `from`, a shorter blurred exit at `to`. */
function shown(f: number, from: number, to: number) {
  const v = Math.min(interpolate(f, [from + 4, from + 14], [0, 1], clamp), interpolate(f, [to - 2, to + 6], [1, 0], clamp));
  return {opacity: v, filter: v < 1 ? `blur(${(1 - v) * 14}px)` : 'none'} satisfies CSSProperties;
}

const at = (x: number, y: number, style: CSSProperties = {}): CSSProperties => ({position: 'absolute', left: x, top: y, transform: 'translate(-50%, -50%)', ...style});
const label = (size: number, color: string, weight = 700): CSSProperties => ({fontFamily: ui, fontWeight: weight, fontSize: size, color, whiteSpace: 'nowrap', lineHeight: 1.2});

function Button({f}: {f: number}) {
  const rise = interpolate(f, [6, 26], [24, 0], {...clamp, easing: Easing.out(Easing.cubic)});
  return <div style={{...at(0, rise), ...shown(f, -20, AT.loader), ...label(44, paper)}}>시작하기</div>;
}

function Loader({f}: {f: number}) {
  return <svg width={104} height={104} viewBox="0 0 104 104" style={{...at(0, 0), ...shown(f, AT.loader, AT.check)}}>
    <circle cx={52} cy={52} r={40} fill="none" stroke={paper} strokeOpacity={0.3} strokeWidth={10} />
    <circle cx={52} cy={52} r={40} fill="none" stroke={paper} strokeWidth={10} strokeLinecap="round" pathLength={1} strokeDasharray="0.28 1" transform={`rotate(${(f - AT.loader) * 9} 52 52)`} />
  </svg>;
}

function Check({f}: {f: number}) {
  const draw = interpolate(f, [AT.check + 2, AT.check + 18], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  return <svg width={96} height={96} viewBox="0 0 96 96" style={{...at(0, 0), ...shown(f, AT.check - 10, AT.toggle)}}>
    <path d="M24 50 L42 66 L74 32" fill="none" stroke={paper} strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
  </svg>;
}

function Toggle({f}: {f: number}) {
  const l = toggleL(f), r = toggleR(f);
  return <div style={shown(f, AT.toggle, AT.slider)}>
    <div style={{position: 'absolute', left: l, top: -56, width: r - l, height: 112, borderRadius: 56, background: paper}} />
    <div style={{...at(0, -108), ...label(SIZES.label, ink)}}>{f < AT.flip + 6 ? '알림 꺼짐' : '알림 켜짐'}</div>
  </div>;
}

function Slider({f}: {f: number}) {
  const x = knobX(f);
  const steps = Math.round(2000 + (x + 500) / 1000 * 10000);
  const value = Math.round(steps / 100) * 100;
  return <div style={shown(f, AT.slider, AT.tabs)}>
    <div style={{...at(0, -232), ...label(SIZES.label, ink, 500)}}>하루 목표</div>
    <div style={{...at(0, -140), fontFamily: display, fontWeight: 800, fontSize: SIZES.headline, color: ink, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', lineHeight: 1}}>{value.toLocaleString('en-US')}보</div>
    <div style={{...at(x, 0), width: 72, height: 72, borderRadius: 36, background: ink}} />
    <div style={{...at(0, 120), ...label(34, ink, 500), opacity: 0.7}}>예시</div>
  </div>;
}

const TABS = ['오늘', '이번 주', '이번 달'];
function Tabs({f}: {f: number}) {
  // A label turns light only while the indicator is under its centre, so it never reads light-on-grey mid-stretch.
  const l = barL(f), r = barR(f);
  return <div style={shown(f, AT.tabs, AT.chart)}>
    {TABS.map((tab, i) => {
      const x = (i - 1) * 333, under = Math.min(interpolate(x - l, [0, 60], [0, 1], clamp), interpolate(r - x, [0, 60], [0, 1], clamp));
      return <div key={tab} style={{...at(x, 0), ...label(SIZES.label + 4, interpolateColors(under, [0, 1], [ink, paper]))}}>{tab}</div>;
    })}
  </div>;
}

/** The fill / indicator: under the tab labels, over the hero. */
function Bar({f}: {f: number}) {
  // The bar lives inside the hero: while the toggle is still widening into the track, it is clipped to the hero's edges.
  const edge = heroW(f) / 2, l = Math.max(barL(f), -edge), r = Math.min(barR(f), edge), h = barH(f);
  const v = Math.min(interpolate(f, [AT.slider + 6, AT.slider + 16], [0, 1], clamp), interpolate(f, [AT.chart - 2, AT.chart + 8], [1, 0], clamp));
  return <div style={{position: 'absolute', left: l, top: -h / 2, width: Math.max(0, r - l), height: h, borderRadius: h / 2, background: accent, opacity: v}} />;
}

const DATA = [0.45, 0.62, 0.38, 0.8, 0.7, 0.95, 0.55];
const DAYS = ['월', '화', '수', '목', '금', '토', '일'];
function Chart({f}: {f: number}) {
  const hover = interpolate(f, [AT.hover, AT.hover + 12], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  return <div style={shown(f, AT.chart + 4, AT.toast)}>
    <div style={{position: 'absolute', left: -480, top: -262, display: 'flex', alignItems: 'center', gap: 20}}>
      <span style={label(48, paper)}>이번 주 걸음</span>
      <span style={{...label(30, ink, 700), background: accent, borderRadius: 999, padding: '4px 16px'}}>예시</span>
    </div>
    {DATA.map((v, i) => {
      const grow = spring({frame: f - AT.chart - 10 - i * 3, fps: FPS, config: SPRING});
      const h = v * 330 * grow, x = -390 + i * 130;
      return <div key={DAYS[i]}>
        <div style={{position: 'absolute', left: x - 36, top: 190 - h, width: 72, height: h, borderRadius: 18, background: i === 5 ? accent : soft, opacity: i === 5 ? 1 : 0.9}} />
        <div style={{...at(x, 236), ...label(36, paper, 500)}}>{DAYS[i]}</div>
      </div>;
    })}
    <div style={{...at(260, -200 - 20 * (1 - hover)), opacity: hover, background: paper, borderRadius: 20, padding: '10px 24px', ...label(38, ink)}}>12,400보 · +12%</div>
  </div>;
}

function Toast({f}: {f: number}) {
  return <div style={{...at(0, 0), ...shown(f, AT.toast, AT.name), display: 'flex', alignItems: 'center', gap: 24}}>
    <svg width={72} height={72} viewBox="0 0 96 96"><circle cx={48} cy={48} r={44} fill={accent} /><path d="M26 50 L42 64 L70 34" fill="none" stroke={paper} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" /></svg>
    <span style={label(SIZES.label + 4, paper)}>오늘 기록을 저장했어요</span>
  </div>;
}

function Name({f}: {f: number}) {
  const rise = interpolate(f, [AT.name + 10, AT.name + 34], [30, 0], {...clamp, easing: Easing.out(Easing.cubic)});
  const tag = interpolate(f, [AT.name + 22, AT.name + 46], [1, 0], {...clamp, easing: Easing.out(Easing.cubic)});
  return <>
    <div style={{...at(0, rise), ...shown(f, AT.name + 4, 1e6), fontFamily: display, fontWeight: 800, fontSize: 150, color: paper, letterSpacing: '-0.04em', lineHeight: 1, whiteSpace: 'nowrap'}}>똑딱</div>
    <div style={{...at(0, 182 + 24 * tag), opacity: 1 - tag, ...label(SIZES.label, ink, 500)}}>하루 루틴을 한 번에 · 가상 브랜드</div>
  </>;
}

/** The world at the camera's scale, centred; everything above lives in world coordinates around (0, 0). */
function Picture() {
  const f = useCurrentFrame();
  const scale = camera(f), cursor = cursorAt(f);
  const w = heroW(f), h = heroH(f);
  const states: ReactNode[] = [<Button f={f} />, <Loader f={f} />, <Check f={f} />, <Toggle f={f} />, <Bar f={f} />, <Slider f={f} />, <Tabs f={f} />, <Chart f={f} />, <Toast f={f} />, <Name f={f} />];
  return <AbsoluteFill style={{background: paper}}>
    <div style={{position: 'absolute', left: W / 2, top: H / 2, transform: `scale(${scale})`}}>
      <div style={{position: 'absolute', left: -w / 2, top: -h / 2, width: w, height: h, borderRadius: Math.min(heroR(f), h / 2), background: heroColor(f)}} />
      {states.map((state, i) => <div key={i}>{state}</div>)}
    </div>
    {f < AT.toast + 30 && <div style={{position: 'absolute', left: W / 2 + cursor.x * scale - SIZES.cursor * 0.2, top: H / 2 + cursor.y * scale - SIZES.cursor * 0.12}}>
      <Cursor size={SIZES.cursor} ink={ink} paper={paper} press={press(f)} />
    </div>}
  </AbsoluteFill>;
}

export function MorphUi() {
  const frame = useCurrentFrame();
  const quiet = spec.hits.map(hit => Math.round(hit.at * FPS));
  // Probes and sound live outside the blur: its copies are frozen and report nothing.
  return <AbsoluteFill>
    <Audio src="/audio/generated/morph-ui/music.wav" volume={0.9} />
    <MotionSound src="/audio/generated/morph-ui/click.wav" role="land" families={['card']} volume={0.5} quiet={quiet} />
    <MotionSound src="/audio/generated/morph-ui/swish.wav" role="move" families={['camera']} volume={0.35} quiet={quiet} />
    <MotionProbe id="camera" value={camera(frame)} family="camera" axis="scale" />
    <MotionProbe id="hero-w" value={heroW(frame)} family="shape" axis="x" />
    <MotionProbe id="press" value={press(frame)} family="card" axis="y" />
    <CameraMotionBlur shutterAngle={180} samples={4}>
      <Picture />
    </CameraMotionBlur>
  </AbsoluteFill>;
}
