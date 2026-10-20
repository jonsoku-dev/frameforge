import type {CSSProperties, ReactNode} from 'react';
import {AbsoluteFill, Audio, Easing, MotionProbe, MotionSound, googleFont, interpolate, spring, useCurrentFrame} from 'frameforge';
import {Clock, Lightbulb, Moon, Phone, Sun} from '@/assets';

const display = googleFont('Do Hyeon', {weights: [400], fallback: 'sans-serif'});
const ui = googleFont('IBM Plex Sans KR', {weights: [500], fallback: 'sans-serif'});
const ink = '#0F172A';
const paper = '#F8FAFC';
const accent = '#F59E0B';
const soft = '#FEF3C7';
const kit = {ink, accent, soft, paper};
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
      // Do Hyeon ink reaches above the 1em line box; the mask grows upward without moving the glyph.
      return <span key={index} style={{display: 'inline-block', overflow: 'hidden', height: '1.3em', paddingTop: '0.15em', marginTop: '-0.15em', paddingInline: '0.08em', marginInline: '-0.08em'}}>
        <span style={{display: 'inline-block', transform: `translateY(${(1 - rise) * 120}%)`, visibility: rise === 0 ? 'hidden' : 'visible'}}>{glyph === ' ' ? ' ' : glyph}</span>
      </span>;
    })}
  </span>;
}

function Centered({top, children}: {top: number; children: ReactNode}) {
  return <div style={{position: 'absolute', left: 0, right: 0, top, display: 'flex', justifyContent: 'center'}}>{children}</div>;
}

function Hook({frame}: {frame: number}) {
  const draw = span(frame, 0, 75);
  return <AbsoluteFill style={{background: paper}}>
    <MotionProbe id="bulb" value={draw} family="shape" axis="progress" />
    <Lightbulb size={560} draw={draw} {...kit} style={{position: 'absolute', left: 680, top: 90}} />
    <Centered top={720}><Glyphs text="어두운 방, 말 한마디" frame={frame} at={14} size={120} /></Centered>
  </AbsoluteFill>;
}

const modes = [[Sun, '해 뜨는 아침'], [Moon, '달 뜨는 밤'], [Clock, '예약한 시간']] as const;

function Phones({frame}: {frame: number}) {
  // The soft field grows out of the bulb's centre (960, 370), so the scene is born from the hook object.
  const field = interpolate(frame, [90, 130], [0, 1400], {...clamp, easing: Easing.in(Easing.cubic)});
  const rise = pop(frame, 90, 24, true);
  const drop = (1 - rise) * 700;
  return <AbsoluteFill style={{background: paper}}>
    <AbsoluteFill style={{background: soft, clipPath: `circle(${field}px at 960px 370px)`}} />
    <AbsoluteFill style={{transform: `scale(${push(frame, 150, 40, 0.04)})`}}>
      <MotionProbe id="phone" value={drop} family="card" axis="y" />
      <Phone size={860} {...kit} style={{position: 'absolute', left: 120, top: 110, transform: `translateY(${drop}px)`}} />
      {modes.map(([Icon, label], i) => {
        const p = pop(frame, 130 + i * 8, 16, true);
        return <div key={label} style={{position: 'absolute', left: 960, top: 160 + i * 290, width: 820, height: 250, boxSizing: 'border-box', transform: `translateX(${(1 - p) * 300}px)`, visibility: p === 0 ? 'hidden' : 'visible', background: paper, border: `6px solid ${ink}`, display: 'flex', alignItems: 'center', gap: 40, padding: '0 48px'}}>
          <Icon size={170} {...kit} />
          <div style={{display: 'flex', flexDirection: 'column', gap: 20}}>
            <div style={{fontFamily: ui, fontWeight: 500, fontSize: 56, color: ink}}>{label}</div>
            <div style={{alignSelf: 'flex-start', padding: '8px 22px', borderRadius: 999, background: soft, fontFamily: ui, fontWeight: 500, fontSize: 40, color: ink}}>예시</div>
          </div>
        </div>;
      })}
    </AbsoluteFill>
  </AbsoluteFill>;
}

function Promise({frame}: {frame: number}) {
  // The bright side is a paper layer wiped in from the left over the dim layer (lit objects in ink on ink).
  const wipe = span(frame, 270, 22);
  const dim = {ink: paper, accent: ink, soft: ink, paper: ink};
  const bright = {ink, accent, soft, paper};
  return <AbsoluteFill style={{background: ink}}>
    <MotionProbe id="promise-wipe" value={wipe} family="wipe" axis="progress" />
    <Lightbulb size={480} {...dim} style={{position: 'absolute', left: 260, top: 90}} />
    <Moon size={480} {...dim} style={{position: 'absolute', left: 1180, top: 90}} />
    <AbsoluteFill style={{background: paper, clipPath: `inset(0 ${(1 - wipe) * 100}% 0 0)`}}>
      <Lightbulb size={480} {...bright} style={{position: 'absolute', left: 260, top: 90}} />
      <Moon size={480} {...bright} style={{position: 'absolute', left: 1180, top: 90}} />
    </AbsoluteFill>
    <Centered top={640}><Glyphs text="말로 켜고" frame={frame} at={300} size={140} /></Centered>
    <Centered top={800}><Glyphs text="말로 끕니다" frame={frame} at={306} size={140} /></Centered>
  </AbsoluteFill>;
}

function Name({frame}: {frame: number}) {
  const parts = Math.round(span(frame, 420, 30) * 4);
  const lockup = span(frame, 440, 30);
  const tag = span(frame, 480, 16);
  return <AbsoluteFill style={{background: ink, ...center, flexDirection: 'column'}}>
    <MotionProbe id="lockup" value={lockup} family="text" axis="progress" />
    <Lightbulb size={420} ink={paper} accent={accent} soft={soft} paper={ink} parts={parts} style={{position: 'absolute', left: 750, top: 110}} />
    <Centered top={540}><Glyphs text="샛불" frame={frame} at={440} size={320} color={paper} stagger={4} /></Centered>
    <Centered top={900}><div style={{fontFamily: ui, fontWeight: 500, fontSize: 56, color: soft, opacity: tag}}>스마트 조명 앱 · 가상 브랜드</div></Centered>
  </AbsoluteFill>;
}

export function KitLaunch() {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{background: paper, overflow: 'hidden'}}>
    <Audio src="/audio/generated/kit-launch/music.wav" volume={0.9} />
    {/* No hand-placed effects: the engine derives them from the motion probes; quiet = the music hits at 3.0 s and 14.0 s. */}
    <MotionSound src="/audio/generated/kit-launch/ding.wav" role="appear" families={['shape']} quiet={[90, 420]} />
    <MotionSound src="/audio/generated/kit-launch/pop.wav" role="land" families={['card', 'text']} quiet={[90, 420]} />
    <MotionSound src="/audio/generated/kit-launch/whoosh.wav" role="move" families={['wipe']} quiet={[90, 420]} />
    {frame < 90 ? <Hook frame={frame} /> : null}
    {frame >= 90 && frame < 270 ? <Phones frame={frame} /> : null}
    {frame >= 270 && frame < 420 ? <Promise frame={frame} /> : null}
    {frame >= 420 ? <Name frame={frame} /> : null}
  </AbsoluteFill>;
}
