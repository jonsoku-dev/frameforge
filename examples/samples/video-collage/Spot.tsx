import type {CSSProperties, ReactNode} from 'react';
import {AbsoluteFill, AnimatedImage, Audio, Easing, MotionProbe, MotionSound, Sequence, Video, googleFont, interpolate, spring, useCurrentFrame} from 'frameforge';
import {Plate} from './assets';

const display = googleFont('Jua', {weights: [400], fallback: 'sans-serif'});
const ui = googleFont('Gowun Dodum', {weights: [400], fallback: 'sans-serif'});
const ink = '#052E16';
const paper = '#F0FDF4';
const accent = '#22C55E';
const soft = '#BBF7D0';
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} satisfies {extrapolateLeft: 'clamp'; extrapolateRight: 'clamp'};
// Music hits at 3 s and 15 s; the engine keeps motion sounds out of their half-second.
const HITS = [90, 450];
const center: CSSProperties = {display: 'flex', alignItems: 'center', justifyContent: 'center'};

function span(frame: number, from: number, dur: number): number {
  return interpolate(frame, [from, from + dur], [0, 1], {...clamp, easing: ease});
}

function pop(frame: number, at: number, dur: number): number {
  return spring({frame, fps: 30, delay: at, durationInFrames: dur, config: {overshootClamping: true}});
}

function wipeLeft(p: number): string {
  return `inset(0 ${(1 - p) * 100}% 0 0)`;
}

function Glyphs({text, frame, at, size, color = ink, stagger = 2}: {text: string; frame: number; at: number; size: number; color?: string; stagger?: number}) {
  return <span style={{display: 'flex', color, fontFamily: display, fontSize: size, lineHeight: 1, letterSpacing: '-0.02em'}}>
    {Array.from(text).map((glyph, index) => {
      const rise = span(frame, at + index * stagger, 12);
      // Jua ink reaches above the 1em line box; the mask grows upward without moving the glyph.
      return <span key={index} style={{display: 'inline-block', overflow: 'hidden', height: '1.3em', paddingTop: '0.15em', marginTop: '-0.15em', paddingInline: '0.08em', marginInline: '-0.08em'}}>
        <span style={{display: 'inline-block', transform: `translateY(${(1 - rise) * 120}%)`, visibility: rise === 0 ? 'hidden' : 'visible'}}>{glyph === ' ' ? ' ' : glyph}</span>
      </span>;
    })}
  </span>;
}

function Centered({top, children}: {top: number; children: ReactNode}) {
  return <div style={{position: 'absolute', left: 0, right: 0, top, display: 'flex', justifyContent: 'center'}}>{children}</div>;
}

function Title({frame}: {frame: number}) {
  return <AbsoluteFill style={{background: ink}}>
    <Centered top={300}><Glyphs text="바람결 FC" frame={frame} at={6} size={260} color={paper} stagger={3} /></Centered>
    <Centered top={640}><span style={{fontFamily: ui, fontSize: 56, color: soft, opacity: span(frame, 40, 20)}}>시즌 리캡 · 가상의 클럽</span></Centered>
  </AbsoluteFill>;
}

// Clip A sits on an accent plate offset behind it, so the clip reads as pasted on a hand-drawn card.
function ClipA({frame}: {frame: number}) {
  const p = pop(frame, 90, 18);
  return <AbsoluteFill style={{background: ink}}>
    <MotionProbe id="clip-a" value={(1 - p) * 120} family="card" axis="y" />
    <div style={{position: 'absolute', inset: 0, transform: `translateY(${(1 - p) * 120}px)`}}>
      <Plate size={1440} style={{position: 'absolute', left: 240, top: 110}} />
      <div style={{position: 'absolute', left: 200, top: 70, width: 1440, height: 680, overflow: 'hidden', background: ink}}>
        <Sequence from={90} durationInFrames={180} layout="none">
          <Video src="/footage/club-a.mp4" trimBefore={30} volume={0.4} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
        </Sequence>
      </div>
      <div style={{position: 'absolute', left: 240, top: 110, padding: '10px 24px', borderRadius: 999, background: soft, fontFamily: ui, fontSize: 44, color: ink}}>샘플 영상</div>
    </div>
    <Centered top={840}><Glyphs text="첫 경기 하이라이트" frame={frame} at={100} size={120} color={paper} stagger={2} /></Centered>
  </AbsoluteFill>;
}

function Split({frame}: {frame: number}) {
  const wipe = span(frame, 276, 24);
  const score = Math.floor(span(frame, 300, 60) * 3);
  return <AbsoluteFill style={{background: ink}}>
    <MotionProbe id="split" value={wipe} family="wipe" axis="progress" />
    <div style={{position: 'absolute', left: 0, top: 0, width: 960, height: 1080, clipPath: wipeLeft(wipe)}}>
      <Sequence from={270} durationInFrames={180} layout="none">
        <Video src="/footage/club-b.mp4" volume={0.4} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
      </Sequence>
    </div>
    <div style={{position: 'absolute', left: 960, top: 0, width: 960, height: 1080, background: soft, clipPath: wipeLeft(wipe)}} />
    <div style={{position: 'absolute', left: 960, width: 960, top: 150, textAlign: 'center', fontFamily: ui, fontSize: 48, color: ink}}>예시 점수 · 샘플 데이터</div>
    <div style={{position: 'absolute', left: 960, width: 960, top: 230, textAlign: 'center', fontFamily: display, fontSize: 360, lineHeight: 1, color: ink}}>{score}</div>
    <div style={{position: 'absolute', left: 960, width: 960, top: 760, display: 'flex', justifyContent: 'center'}}>
      <Glyphs text="득점 기록" frame={frame} at={300} size={130} stagger={3} />
    </div>
  </AbsoluteFill>;
}

function Badge({frame}: {frame: number}) {
  const reveal = span(frame, 450, 24) * 1500;
  const p = pop(frame, 462, 24);
  const rule = span(frame, 500, 20);
  return <AbsoluteFill style={{background: ink}}>
    <AbsoluteFill style={{background: soft, clipPath: `circle(${reveal}px at 960px 540px)`}} />
    <MotionProbe id="badge" value={p} family="shape" axis="scale" />
    <div style={{position: 'absolute', left: 680, top: 110, width: 560, height: 560, transform: `rotate(${(1 - p) * -360}deg) scale(${p})`}}>
      <Sequence from={450} durationInFrames={90} layout="none">
        <AnimatedImage src="/footage/badge.gif" width={560} height={560} />
      </Sequence>
    </div>
    <Centered top={740}><Glyphs text="바람결 FC" frame={frame} at={480} size={150} stagger={2} /></Centered>
    <div style={{position: 'absolute', left: 560, top: 940, width: 800, height: 16, background: accent, clipPath: wipeLeft(rule)}} />
  </AbsoluteFill>;
}

function Still() {
  return <AbsoluteFill style={{background: soft, ...center, flexDirection: 'column', gap: 40}}>
    <span style={{fontFamily: display, fontSize: 220, lineHeight: 1, color: ink}}>바람결 FC</span>
    <span style={{fontFamily: ui, fontSize: 60, color: ink}}>다음 시즌에도 같은 자리에서</span>
    <span style={{fontFamily: ui, fontSize: 40, color: ink}}>예시 영상 · 가상의 클럽</span>
  </AbsoluteFill>;
}

export function VideoCollage() {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{background: ink}}>
    <Audio src="/audio/generated/video-collage/music.wav" volume={0.9} />
    <MotionSound src="/audio/generated/video-collage/pop.wav" role="land" families={['card']} quiet={HITS} />
    <MotionSound src="/audio/generated/video-collage/whoosh.wav" role="move" families={['wipe']} quiet={HITS} />
    <MotionSound src="/audio/generated/video-collage/ding.wav" role="appear" families={['shape']} quiet={HITS} />
    {frame < 90 && <Title frame={frame} />}
    {frame >= 90 && frame < 270 && <ClipA frame={frame} />}
    {frame >= 270 && frame < 450 && <Split frame={frame} />}
    {frame >= 450 && frame < 540 && <Badge frame={frame} />}
    {frame >= 540 && <Still />}
  </AbsoluteFill>;
}
