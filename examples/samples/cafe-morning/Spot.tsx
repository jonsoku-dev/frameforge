import type {CSSProperties, ReactNode} from 'react';
import {AbsoluteFill, Audio, Easing, MotionProbe, MotionSound, googleFont, interpolate, spring, useCurrentFrame} from 'frameforge';
import {ClockCup, Cup, HeartCup, PinCup} from './assets';

const display = googleFont('Black Han Sans', {weights: [400], fallback: 'sans-serif'});
const ui = googleFont('Noto Sans KR', {weights: [500], fallback: 'sans-serif'});
const ink = '#1C1917';
const paper = '#FAF7F2';
const accent = '#D97706';
const soft = '#FDE68A';
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} satisfies {extrapolateLeft: 'clamp'; extrapolateRight: 'clamp'};
const center: CSSProperties = {display: 'flex', alignItems: 'center', justifyContent: 'center'};

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

function Glyphs({text, frame, at, size, color = ink, stagger = 2}: {text: string; frame: number; at: number; size: number; color?: string; stagger?: number}) {
  return <span style={{display: 'flex', color, fontFamily: display, fontSize: size, lineHeight: 1, letterSpacing: '-0.02em'}}>
    {Array.from(text).map((glyph, index) => {
      const rise = span(frame, at + index * stagger, 12);
      // Black Han Sans ink reaches above the 1em line box; the mask grows upward without moving the glyph.
      return <span key={index} style={{display: 'inline-block', overflow: 'hidden', height: '1.3em', paddingTop: '0.15em', marginTop: '-0.15em', paddingInline: '0.08em', marginInline: '-0.08em'}}>
        <span style={{display: 'inline-block', transform: `translateY(${(1 - rise) * 120}%)`, visibility: rise === 0 ? 'hidden' : 'visible'}}>{glyph === ' ' ? '\u00A0' : glyph}</span>
      </span>;
    })}
  </span>;
}

function Centered({top, children}: {top: number; children: ReactNode}) {
  return <div style={{position: 'absolute', left: 0, right: 0, top, display: 'flex', justifyContent: 'center'}}>{children}</div>;
}

function Hook({frame}: {frame: number}) {
  return <AbsoluteFill style={{background: paper}}>
    <Cup draw={span(frame, 0, 50)} size={560} style={{position: 'absolute', left: 680, top: 120}} />
    <Centered top={760}><Glyphs text="아침, 어디서 시작하죠?" frame={frame} at={24} size={120} /></Centered>
  </AbsoluteFill>;
}

const cards = [[PinCup, '가까운 곳 찾기', '0.4km'], [ClockCup, '픽업 시간 예약', '7:30'], [HeartCup, '단골 메뉴', '1탭']] as const;

function Cards({frame}: {frame: number}) {
  // The soft field grows out of the hook cup, so the scene is born from that object.
  const field = interpolate(frame, [96, 150], [0, 1600], {...clamp, easing: Easing.in(Easing.cubic)});
  return <AbsoluteFill style={{background: soft, clipPath: `circle(${field}px at 960px 400px)`}}>
    <MotionProbe id="field" value={field} family="wipe" axis="progress" />
    <AbsoluteFill style={{transform: `scale(${push(frame, 180, 30, 0.05)})`}}>
      <div style={{position: 'absolute', left: 140, top: 200, display: 'flex', gap: 40}}>
        {cards.map(([Shape, title, figure], i) => {
          const p = pop(frame, 150 + i * 6, 16, true);
          return <div key={title} style={{position: 'relative', width: 520, height: 640, transform: `translateY(${(1 - p) * 300}px)`, visibility: p === 0 ? 'hidden' : 'visible'}}>
            <MotionProbe id={`card-${i}`} value={(1 - p) * 300} family="card" axis="y" />
            <div style={{position: 'absolute', left: 24, top: 24, width: 520, height: 640, background: ink}} />
            <div style={{position: 'absolute', inset: 0, background: paper, padding: 56, display: 'flex', flexDirection: 'column', justifyContent: 'space-between'}}>
              {/* The drawing's viewBox margin is pulled back so the icon keeps the old 120 px row. */}
              <Shape size={160} style={{margin: -20}} />
              <div>
                <div style={{fontFamily: ui, fontWeight: 500, fontSize: 52, color: ink}}>{title}</div>
                <div style={{fontFamily: display, fontSize: 120, lineHeight: 1.1, color: ink, marginTop: 24}}>{figure}</div>
                <div style={{marginTop: 32, height: 20, borderRadius: 10, background: soft, overflow: 'hidden'}}>
                  <div style={{height: '100%', width: `${span(frame, 200 + i * 40, 40) * 100}%`, background: accent}} />
                </div>
              </div>
              <div style={{alignSelf: 'flex-start', padding: '10px 24px', borderRadius: 999, background: soft, fontFamily: ui, fontWeight: 500, fontSize: 40, color: ink}}>예시</div>
            </div>
          </div>;
        })}
      </div>
    </AbsoluteFill>
  </AbsoluteFill>;
}

function Promise({frame}: {frame: number}) {
  // The wipe starts before the 12.5 s hit so the accent is already sweeping when the line lands.
  const wipe = span(frame, 350, 22);
  const draw = span(frame, 390, 30);
  return <AbsoluteFill>
    <MotionProbe id="promise-wipe" value={wipe} family="wipe" axis="progress" />
    <MotionProbe id="promise-cup" value={draw} family="shape" axis="progress" />
    <AbsoluteFill style={{background: accent, clipPath: `inset(0 ${(1 - wipe) * 100}% 0 0)`}} />
    <Cup draw={draw} size={300} color={paper} style={{position: 'absolute', left: 810, top: 170}} />
    <Centered top={500}><Glyphs text="아침은" frame={frame} at={380} size={200} color={paper} stagger={3} /></Centered>
    <Centered top={700}><Glyphs text="가까운 곳에서" frame={frame} at={386} size={200} color={paper} stagger={2} /></Centered>
  </AbsoluteFill>;
}

function Name({frame}: {frame: number}) {
  const slide = pop(frame, 480, 18, true);
  const bar = span(frame, 500, 16);
  const tag = span(frame, 512, 14);
  return <AbsoluteFill style={{background: ink, ...center, flexDirection: 'column', gap: 48}}>
    <MotionProbe id="name" value={(slide - 1) * 1200} family="card" axis="x" />
    <div style={{fontFamily: display, fontSize: 360, lineHeight: 1.1, color: paper, transform: `translateX(${(slide - 1) * 1200}px)`}}>마루컵</div>
    <div style={{width: 720, height: 24, background: accent, transform: `scaleX(${bar})`}} />
    <div style={{fontFamily: ui, fontWeight: 500, fontSize: 56, color: soft, opacity: tag}}>동네 카페 주문 · 가상 브랜드</div>
  </AbsoluteFill>;
}

export function CafeMorning() {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{background: paper, overflow: 'hidden'}}>
    <Audio src="/audio/generated/cafe-morning/music.wav" volume={0.9} />
    {/* No hand-placed effects: the engine derives them from the motion probes below; quiet = the music hits at 5.0 s and 12.5 s. */}
    <MotionSound src="/audio/generated/cafe-morning/pop.wav" role="land" families={['card']} quiet={[150, 375]} />
    <MotionSound src="/audio/generated/cafe-morning/whoosh.wav" role="move" families={['wipe', 'card']} quiet={[150, 375]} />
    <MotionSound src="/audio/generated/cafe-morning/ding.wav" role="appear" families={['shape']} quiet={[150, 375]} />
    {frame < 150 ? <Hook frame={frame} /> : null}
    {frame >= 110 && frame < 375 ? <Cards frame={frame} /> : null}
    {frame >= 350 && frame < 480 ? <Promise frame={frame} /> : null}
    {frame >= 480 ? <Name frame={frame} /> : null}
  </AbsoluteFill>;
}
