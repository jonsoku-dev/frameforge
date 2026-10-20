/// <reference types="vite/client" />
import type {CSSProperties, ReactNode} from 'react';
import {AbsoluteFill, Audio, Easing, MotionProbe, MotionSound, googleFont, interpolate, spring, useCurrentFrame} from 'frameforge';
import {createTikTokStyleCaptions, parseSrt} from '@/packages/captions';
import {fitText} from '@/packages/layout-utils';
import srt from './captions/caption-explainer.srt?raw';
import {Chat, Day, Speech, Sprout} from './assets';

const ui = googleFont('Noto Sans KR', {weights: [500, 900], fallback: 'sans-serif'});
const ink = '#1E1B4B';
const paper = '#FAFAFA';
const accent = '#F59E0B';
const soft = '#FEF3C7';
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} satisfies {extrapolateLeft: 'clamp'; extrapolateRight: 'clamp'};
const center: CSSProperties = {display: 'flex', alignItems: 'center', justifyContent: 'center'};

const pages = createTikTokStyleCaptions({
  captions: parseSrt({input: srt, strict: true}).captions,
  combineTokensWithinMilliseconds: 2400,
  breakOnSilenceAfterMilliseconds: 150,
}).pages;
const longest = pages.reduce((a, page) => (page.text.length > a.length ? page.text : a), '');

function span(frame: number, from: number, dur: number): number {
  return interpolate(frame, [from, from + dur], [0, 1], {...clamp, easing: ease});
}

function pop(frame: number, at: number, dur: number, settle = false): number {
  return spring({frame, fps: 30, delay: at, durationInFrames: dur, config: {overshootClamping: settle}});
}

function Glyphs({text, frame, at, size, color = ink, stagger = 2}: {text: string; frame: number; at: number; size: number; color?: string; stagger?: number}) {
  return <span style={{display: 'flex', color, fontFamily: ui, fontWeight: 900, fontSize: size, lineHeight: 1, letterSpacing: '-0.02em'}}>
    {Array.from(text).map((glyph, index) => {
      const rise = span(frame, at + index * stagger, 12);
      // Noto Sans KR ink can reach above the 1em box; the mask grows upward without moving the glyph.
      return <span key={index} style={{display: 'inline-block', overflow: 'hidden', height: '1.3em', paddingTop: '0.15em', marginTop: '-0.15em', paddingInline: '0.08em', marginInline: '-0.08em'}}>
        <span style={{display: 'inline-block', transform: `translateY(${(1 - rise) * 120}%)`, visibility: rise === 0 ? 'hidden' : 'visible'}}>{glyph === ' ' ? ' ' : glyph}</span>
      </span>;
    })}
  </span>;
}

function Caption({frame}: {frame: number}) {
  const ms = (frame * 1000) / 30;
  const page = pages.find(p => ms >= p.startMs && ms < p.startMs + p.durationMs);
  if (!page) return null;
  const current = page.tokens.find(token => ms >= token.fromMs && ms < token.toMs);
  // The longest line sets the size: it must fit 1600 px, and the rule's 108 px headline minimum is the floor.
  const size = Math.min(120, fitText({text: longest, withinWidth: 1600, fontFamily: ui, fontWeight: 900}).fontSize);
  return <div style={{position: 'absolute', left: 0, right: 0, top: 760, display: 'flex', justifyContent: 'center', fontFamily: ui, fontWeight: 900, fontSize: size, lineHeight: 1.2, color: ink, whiteSpace: 'pre'}}>
    {page.tokens.map((token, i) => <span key={i} style={{color: token === current ? accent : ink}}>{i > 0 ? ' ' : ''}{token.text.trim()}</span>)}
  </div>;
}

function Bubble({frame}: {frame: number}) {
  const grow = pop(frame, 0, 36);
  const dots = pop(frame, 144, 20, true);
  return <AbsoluteFill style={{background: paper}}>
    <MotionProbe id="bubble" value={grow} family="shape" axis="scale" />
    <MotionProbe id="dots" value={dots} family="shape" axis="scale" />
    {/* The square 1000 px asset puts the bubble body at 160 to 560 and the tail tip at 660, the same footprint as before. */}
    <Speech size={1000} dots={[0, 1, 2].map(i => pop(frame, 144 + i * 6, 14, true))} style={{position: 'absolute', left: 460, top: -100, transform: `scale(${grow})`}} />
  </AbsoluteFill>;
}

function Flip({frame}: {frame: number}) {
  // Face down until the spring turns it at 250; the back face shows while the card is past 90 degrees.
  const turn = pop(frame, 250, 30, true);
  const angle = (1 - turn) * 180;
  const line = span(frame, 300, 24);
  return <AbsoluteFill style={{background: soft}}>
    <MotionProbe id="flip" value={angle} family="card" axis="x" />
    <MotionProbe id="underline" value={line} family="wipe" axis="progress" />
    <div style={{position: 'absolute', left: 440, top: 120, width: 1040, height: 560, transform: `rotateY(${angle}deg)`}}>
      {angle > 90
        ? <div style={{position: 'absolute', inset: 0, background: ink, ...center}}>
          <Sprout size={280} />
        </div>
        : <div style={{position: 'absolute', inset: 0, background: paper}}>
          <Chat size={144} style={{position: 'absolute', left: 64, top: 64}} />
          <div style={{position: 'absolute', left: 72, top: 250, fontFamily: ui, fontWeight: 900, fontSize: 108, lineHeight: 1.2, color: ink, whiteSpace: 'pre'}}>한 잔 주세요.</div>
          <div style={{position: 'absolute', left: 72, top: 390, width: 760 * line, height: 20, background: accent}} />
          <div style={{position: 'absolute', left: 72, bottom: 64, fontFamily: ui, fontWeight: 500, fontSize: 44, color: ink}}>예시 문장</div>
        </div>}
    </div>
  </AbsoluteFill>;
}

function Streak({frame}: {frame: number}) {
  const count = interpolate(frame, [490, 570], [0, 7], {...clamp, easing: ease});
  const shown = Math.round(count);
  return <AbsoluteFill style={{background: soft}}>
    <MotionProbe id="count" value={count / 7} family="text" axis="progress" />
    <MotionProbe id="squares" value={span(frame, 500, 60)} family="shape" axis="progress" />
    <div style={{position: 'absolute', left: 0, right: 0, top: 110, textAlign: 'center', fontFamily: ui, fontWeight: 500, fontSize: 44, color: ink}}>연속 학습 일수 · 예시</div>
    <div style={{position: 'absolute', left: 0, right: 0, top: 170, textAlign: 'center', fontFamily: ui, fontWeight: 900, fontSize: 420, lineHeight: 1, color: ink}}>{shown}</div>
    <div style={{position: 'absolute', left: 468, top: 616, display: 'flex', gap: 24}}>
      {Array.from({length: 7}, (_, i) => <Day key={i} size={120} done={Math.min(1, Math.max(0, count - i))} style={{transform: `scale(${pop(frame, 500 + i * 6, 14, true)})`}} />)}
    </div>
  </AbsoluteFill>;
}

function Lockup({frame}: {frame: number}) {
  const bar = span(frame, 676, 12);
  const tag = span(frame, 680, 10);
  return <AbsoluteFill style={{background: paper, ...center, flexDirection: 'column', gap: 40}}>
    <MotionProbe id="lockup" value={span(frame, 672, 16)} family="text" axis="progress" />
    <Glyphs text="말씨랩" frame={frame} at={672} size={320} stagger={3} />
    <div style={{width: 720, height: 24, background: accent, transform: `scaleX(${bar})`}} />
    <div style={{fontFamily: ui, fontWeight: 500, fontSize: 56, color: ink, opacity: tag}}>한마디씩 말이 먼저 나오는 공부 · 가상 브랜드</div>
  </AbsoluteFill>;
}

export function CaptionExplainer() {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{background: paper, overflow: 'hidden'}}>
    <Audio src="/audio/generated/caption-explainer/music.wav" volume={0.9} />
    {/* No hand-placed effects: the engine derives them from the probes above; quiet = the music hits at 4.8 s and 19.2 s. */}
    <MotionSound src="/audio/generated/caption-explainer/pop.wav" role="land" families={['card']} quiet={[144, 576]} />
    <MotionSound src="/audio/generated/caption-explainer/ding.wav" role="appear" families={['shape']} quiet={[144, 576]} />
    <MotionSound src="/audio/generated/caption-explainer/whoosh.wav" role="move" families={['wipe']} quiet={[144, 576]} />
    {frame < 240 ? <Bubble frame={frame} /> : null}
    {frame >= 240 && frame < 480 ? <Flip frame={frame} /> : null}
    {frame >= 480 && frame < 672 ? <Streak frame={frame} /> : null}
    {frame >= 672 ? <Lockup frame={frame} /> : null}
    <Caption frame={frame} />
  </AbsoluteFill>;
}
