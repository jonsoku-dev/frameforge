import type {ReactNode} from 'react';
import {AbsoluteFill, Audio, Easing, MotionProbe, MotionSound, googleFont, interpolate, spring, useCurrentFrame} from 'frameforge';
import {BarChart, BarChartRace, CodeBlock, Compare, Donut, Flowchart, Heatmap, LineChart, ProcessSteps, Sparkline, Timeline} from '@/blocks';

// 누리장부: a fictional household-ledger app. Every number on screen is 예시 data; every block comes from '@/blocks'.
const W = 1920;
const H = 1080;
const S = Math.min(W, H);
const SIZES = {headline: S * 0.1, label: Math.ceil(S * 0.035), block: S * 0.04, marginX: W * 0.05, marginY: H * 0.05};
const display = googleFont('Gothic A1', {weights: [800], fallback: 'sans-serif'});
const ui = googleFont('IBM Plex Sans KR', {weights: [500], fallback: 'sans-serif'});
const mono = googleFont('JetBrains Mono', {weights: [400], fallback: 'monospace'});
const palette = {ink: '#1B1F3B', paper: '#F5F2EA', accent: '#E4572E', soft: '#F6D5C8'};
const fonts = {display, ui, mono};
const {ink, paper, accent, soft} = palette;
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} satisfies {extrapolateLeft: 'clamp'; extrapolateRight: 'clamp'};
// Absolute scene starts. At each cut the field wipes up in the other colour and the card hops; the headline rises at +8, the block starts at +6,
// the block fades out 8 frames before the next scene; the last 60 frames hold.
const AT = {hook: 0, bar: 60, line: 150, race: 225, budget: 345, code: 435, flow: 525, steps: 600, timeline: 675, compare: 750, name: 815, end: 900};
const MIDDLE = [AT.bar, AT.line, AT.race, AT.budget, AT.code, AT.flow, AT.steps, AT.timeline, AT.compare];
// The field alternates soft and ink from scene to scene; the paper card is the carrier that rides through every cut.
const fieldOf = (k: number) => (k % 2 ? ink : soft);
// One paper stage card for every middle scene: the blocks sit on it, the headline above it on the soft field. The soft margins
// around the card keep a headline-sized band of ink in every frame, even while a headline rises and a block has not started.
const STAGE = {x: 160, y: 240, w: 1600, h: 760};
const CARD = {left: 112, top: 212, width: 1696, height: 828, borderRadius: 24};

function span(frame: number, from: number, dur: number): number {
  return interpolate(frame, [from, from + dur], [0, 1], {...clamp, easing: ease});
}

function Glyphs({text, frame, at, size = SIZES.headline, color = ink, stagger = 2}: {text: string; frame: number; at: number; size?: number; color?: string; stagger?: number}) {
  return <span style={{display: 'flex', color, fontFamily: display, fontSize: size, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.03em'}}>
    {Array.from(text).map((glyph, index) => {
      const rise = span(frame, at + index * stagger, 12);
      // Gothic A1 ink rises above the 1em line box, so the mask grows upward without moving the glyph.
      return <span key={index} style={{display: 'inline-block', overflow: 'hidden', height: '1.15em', paddingTop: '0.1em', marginTop: '-0.1em', paddingInline: '0.06em', marginInline: '-0.06em'}}>
        <span style={{display: 'inline-block', transform: `translateY(${(1 - rise) * 120}%)`, visibility: rise === 0 ? 'hidden' : 'visible'}}>{glyph === ' ' ? ' ' : glyph}</span>
      </span>;
    })}
  </span>;
}

/** Headline at the top left plus the scene's block(s) on the card; the next scene's headline replaces this one at `until`. */
function Scene({frame, at, until, title, children}: {frame: number; at: number; until: number; title: string; children: ReactNode}) {
  if (frame < at || frame >= until) return null;
  const k = MIDDLE.indexOf(at);
  return <>
    <div style={{position: 'absolute', left: SIZES.marginX + 64, top: 70}}><Glyphs text={title} frame={frame} at={at + 8} color={fieldOf(k) === ink ? paper : ink} /></div>
    {children}
  </>;
}

const stage = (frame: number, at: number, until: number) => ({frame, at: at + 6, out: until, palette, fonts, size: SIZES.block, x: STAGE.x, y: STAGE.y, width: STAGE.w, height: STAGE.h});

function Hook({frame}: {frame: number}) {
  const spark = {frame, at: 0, duration: 48, palette, fonts, size: SIZES.block, stroke: 18, x: 160, y: 560, width: 1600, height: 380};
  // The headline starts before frame 0 so the first frame already carries half-risen glyphs instead of an empty field.
  return <AbsoluteFill style={{background: ink}}>
    <div style={{position: 'absolute', left: SIZES.marginX + 64, top: 250}}><Glyphs text="지출, 한눈에" frame={frame} at={-8} size={176} color={paper} /></div>
    <Sparkline {...spark} data={[42, 51, 38, 64, 57, 73, 61, 88]} />
  </AbsoluteFill>;
}

const months = ['1월', '2월', '3월', '4월', '5월', '6월'];
const spend = [42, 51, 38, 64, 49, 73].map((value, i) => ({label: months[i]!, value}));
const saving = [12, 18, 25, 31, 44, 58].map((value, i) => ({label: months[i]!, value}));
const race = [
  {label: '1월', values: {식비: 38, 교통: 22, 쇼핑: 31, 여가: 14, 구독: 9}},
  {label: '2월', values: {식비: 41, 교통: 20, 쇼핑: 44, 여가: 19, 구독: 12}},
  {label: '3월', values: {식비: 36, 교통: 24, 쇼핑: 29, 여가: 33, 구독: 15}},
  {label: '4월', values: {식비: 45, 교통: 21, 쇼핑: 27, 여가: 38, 구독: 24}},
];
const heat = [[3, 6, 8, 2], [2, 7, 6, 1], [4, 5, 9, 3], [3, 6, 7, 2], [5, 8, 9, 6], [7, 9, 8, 7], [6, 7, 5, 4]];
const code = `const rules = [
  {match: /카페|커피/, tag: '식비'},
  {match: /지하철|버스/, tag: '교통'},
];

export function classify(memo: string) {
  return rules.find(r => r.match.test(memo))?.tag ?? '기타';
}`;

function Name({frame}: {frame: number}) {
  const bar = span(frame, AT.name + 10, 14);
  return <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 40}}>
    <MotionProbe id="name-bar" value={bar} family="shape" axis="progress" />
    <Glyphs text="누리장부" frame={frame} at={AT.name + 2} size={240} color={paper} stagger={2} />
    <div style={{width: 520, height: 18, background: accent, transform: `scaleX(${bar})`}} />
    {frame >= AT.name + 13 ? <div style={{fontFamily: ui, fontWeight: 500, fontSize: 56, color: soft, opacity: span(frame, AT.name + 13, 12), lineHeight: 1}}>가계부 앱 · 가상 브랜드 · 예시 데이터</div> : null}
  </AbsoluteFill>;
}

export function DataReel() {
  const frame = useCurrentFrame();
  const k = MIDDLE.filter(a => frame >= a).length - 1;
  const wipe = k < 0 ? 0 : span(frame, MIDDLE[k]!, 10);
  const hop = k < 0 ? 0 : (1 - spring({frame, fps: 30, delay: MIDDLE[k]!, durationInFrames: 16, config: {overshootClamping: true}})) * 60;
  const inkIn = span(frame, AT.name, 12);
  return <AbsoluteFill style={{background: ink, overflow: 'hidden'}}>
    <Audio src="/audio/generated/data-reel/music.wav" volume={0.9} />
    {/* Effects come from the motion probes; quiet frames are the music hits (bars landed, race end, name). */}
    <MotionSound src="/audio/generated/data-reel/whoosh.wav" role="move" families={['wipe', 'card']} quiet={[108, 345, 840]} />
    <MotionSound src="/audio/generated/data-reel/tick.wav" role="land" families={['shape', 'card']} quiet={[108, 345, 840]} />
    <MotionProbe id="field-wipe" value={wipe} family="wipe" axis="progress" />
    <MotionProbe id="card-hop" value={hop} family="card" axis="y" />
    {frame < AT.bar + 10 ? <Hook frame={frame} /> : null}
    {frame >= AT.bar ? <AbsoluteFill style={{background: k > 0 ? fieldOf(k - 1) : ink}}>
      <AbsoluteFill style={{background: fieldOf(k), clipPath: `inset(${(1 - wipe) * 100}% 0 0 0)`}} />
      <div style={{position: 'absolute', ...CARD, background: paper, transform: `translateY(${hop}px)`}} />
      <Scene frame={frame} at={AT.bar} until={AT.line} title="월별 지출"><BarChart {...stage(frame, AT.bar, AT.line)} data={spend} target={60} unit="만" /></Scene>
      <Scene frame={frame} at={AT.line} until={AT.race} title="저축 추이"><LineChart {...stage(frame, AT.line, AT.race)} data={saving} unit="만" /></Scene>
      <Scene frame={frame} at={AT.race} until={AT.budget} title="카테고리 순위"><BarChartRace {...stage(frame, AT.race, AT.budget)} duration={96} snapshots={race} unit="만" /></Scene>
      <Scene frame={frame} at={AT.budget} until={AT.code} title="예산 달성과 소비 시간">
        <Donut {...stage(frame, AT.budget, AT.code)} size={48} width={640} height={700} y={270} value={72} label="이달 예산 달성" />
        <Heatmap {...stage(frame, AT.budget, AT.code)} size={48} x={880} width={880} height={700} y={270} at={AT.budget + 12} rows={heat} rowLabels={['월', '화', '수', '목', '금', '토', '일']} colLabels={['아침', '점심', '저녁', '밤']} order="seeded" seed="nuri" />
      </Scene>
      <Scene frame={frame} at={AT.code} until={AT.flow} title="자동 분류 규칙"><CodeBlock {...stage(frame, AT.code, AT.flow)} size={SIZES.label} height={620} y={300} code={code} lang="ts" mode="typing" charsPerFrame={5} /></Scene>
      <Scene frame={frame} at={AT.flow} until={AT.steps} title="알림이 오기까지"><Flowchart {...stage(frame, AT.flow, AT.steps)} size={56} height={560} y={346} nodes={[{id: 'pay', label: '결제'}, {id: 'tag', label: '자동 분류'}, {id: 'budget', label: '예산 비교'}, {id: 'push', label: '알림', shape: 'pill'}]} /></Scene>
      <Scene frame={frame} at={AT.steps} until={AT.timeline} title="시작은 세 단계"><ProcessSteps {...stage(frame, AT.steps, AT.timeline)} size={60} height={560} y={346} steps={['계좌 연결', '자동 분류', '예산 확인']} /></Scene>
      <Scene frame={frame} at={AT.timeline} until={AT.compare} title="출시 일정"><Timeline {...stage(frame, AT.timeline, AT.compare)} size={56} height={600} y={326} items={[{date: '1월', label: '기획'}, {date: '3월', label: '베타'}, {date: '5월', label: '출시'}, {date: '7월', label: '프로 요금제'}]} /></Scene>
      <Scene frame={frame} at={AT.compare} until={AT.name + 12} title="기본과 프로"><Compare {...stage(frame, AT.compare, AT.name)} height={640} y={300} columns={['기본', '프로']} rows={[{label: '자동 분류', a: true, b: true}, {label: '예산 알림', a: true, b: true}, {label: '가족 공유', a: false, b: true}, {label: '리포트', a: '월간', b: '주간'}]} /></Scene>
    </AbsoluteFill> : null}
    {frame >= AT.name ? <AbsoluteFill style={{background: ink, clipPath: `inset(${(1 - inkIn) * 100}% 0 0 0)`}}><Name frame={frame} /></AbsoluteFill> : null}
  </AbsoluteFill>;
}
