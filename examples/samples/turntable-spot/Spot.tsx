import type {CSSProperties} from 'react';
import type {} from '@react-three/fiber'; // brings in the <group> JSX type
import {AbsoluteFill, Audio, Easing, Freeze, ImageSequence, Model, MotionProbe, MotionSound, Sequence, StudioLights, ThreeCanvas, Turntable, googleFont, interpolate, spring, useCurrentFrame} from 'frameforge';
import {Cup, Heart, Leaf, type ArtProps} from '@/assets';

// 24 s product spot for 결 세라믹, a fictional ceramics brand: a Blender-rendered glaze ring turns on a transparent film over
// the paper, a dolly shot of a cup body on ink, and a CC0 vase inside <ThreeCanvas> for the name. Two Blender shots come from
// 3d.json (`npm run blender`), the vase from models.json (`npm run models`).
const W = 1920;
const H = 1080;
const S = Math.min(W, H);
const SIZES = {headline: S * 0.1, label: S * 0.035, icon: S * 0.06, hero: S * 0.35, marginX: W * 0.05, marginY: H * 0.05};
const display = googleFont('Gothic A1', {weights: [900], fallback: 'sans-serif'});
const ui = googleFont('Noto Sans KR', {weights: [500], fallback: 'sans-serif'});
const ink = '#1F1B18';
const paper = '#F2ECE3';
const accent = '#C8553D';
const soft = '#DCCBB8';
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} satisfies {extrapolateLeft: 'clamp'; extrapolateRight: 'clamp'};
const center: CSSProperties = {display: 'flex', alignItems: 'center', justifyContent: 'center'};
// Scene starts on 2 s bar lines (120 bpm); the last 60 frames are the still hold.
const AT = {hook: 0, hero: 120, beats: 300, dolly: 420, name: 540, hold: 660};
const RING = {x: W * 0.7, y: H * 0.5, r: S * 0.29}; // where the ring sits in the rendered hero frames (image centre shifted right)
type Asset = (props: ArtProps) => React.JSX.Element;

const span = (frame: number, from: number, dur: number) => interpolate(frame, [from, from + dur], [0, 1], {...clamp, easing: ease});
const pop = (frame: number, at: number, dur: number, settle = false) => spring({frame, fps: 30, delay: at, durationInFrames: dur, config: {overshootClamping: settle}});
const push = (frame: number, at: number, dur: number, amount: number) => 1 + amount * Math.sin(interpolate(frame, [at, at + dur], [0, 1], clamp) * Math.PI);

function Glyphs({text, frame, at, size = SIZES.headline, color = ink, stagger = 2}: {text: string; frame: number; at: number; size?: number; color?: string; stagger?: number}) {
  return <span style={{display: 'flex', color, fontFamily: display, fontSize: size, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.04em', whiteSpace: 'nowrap'}}>
    {Array.from(text).map((glyph, index) => {
      const rise = span(frame, at + index * stagger, 12);
      return <span key={index} style={{display: 'inline-block', overflow: 'hidden', height: '1.15em', paddingTop: '0.1em', marginTop: '-0.1em', paddingInline: '0.06em', marginInline: '-0.06em'}}>
        <span style={{display: 'inline-block', transform: `translateY(${(1 - rise) * 120}%)`, visibility: rise === 0 ? 'hidden' : 'visible'}}>{glyph === ' ' ? ' ' : glyph}</span>
      </span>;
    })}
  </span>;
}

function Hook({frame}: {frame: number}) {
  // The plate springs up, then folds away in the last 20 frames so the ring rises onto clean paper.
  const grow = pop(frame, AT.hook + 4, 24) * (1 - span(frame, AT.hero - 20, 20));
  return <AbsoluteFill style={{background: paper}}>
    <MotionProbe id="plate" value={grow * RING.r * 2} family="shape" axis="scale" />
    <div style={{position: 'absolute', left: RING.x - RING.r, top: RING.y - RING.r, width: RING.r * 2, height: RING.r * 2, borderRadius: '50%', background: accent, transform: `scale(${grow})`}} />
    <div style={{position: 'absolute', left: SIZES.marginX, top: H * 0.36, display: 'flex', flexDirection: 'column', gap: S * 0.02}}>
      <Glyphs text="손끝에 닿는 결," frame={frame} at={AT.hook + 16} />
      <Glyphs text="그 차이를 아시나요" frame={frame} at={AT.hook + 34} />
    </div>
  </AbsoluteFill>;
}

/** The Blender ring rises where the plate was and turns for 150 frames, then holds; the type rises with it. */
function Hero({frame}: {frame: number}) {
  const rise = pop(frame, AT.hero, 26, true);
  return <AbsoluteFill style={{background: paper}}>
    <MotionProbe id="ring" value={(1 - rise) * H} family="card" axis="y" />
    <div style={{position: 'absolute', left: RING.x - W / 2, top: 0, width: W, height: H, transform: `translateY(${(1 - rise) * H}px)`}}>
      <Sequence from={AT.hero} layout="none">
        <ImageSequence src="/assets/generated/turntable-spot/3d/hero" frames={150} fps={30} />
      </Sequence>
    </div>
    <div style={{position: 'absolute', left: SIZES.marginX, top: H * 0.3, display: 'flex', flexDirection: 'column', gap: S * 0.03}}>
      <Glyphs text="한 바퀴," frame={frame} at={AT.hero + 4} />
      <Glyphs text="빛이 도는 유약" frame={frame} at={AT.hero + 18} />
      <div style={{fontFamily: ui, fontWeight: 500, fontSize: SIZES.label * 1.3, color: ink, opacity: span(frame, AT.hero + 50, 14)}}>유약 링 · 렌더 예시</div>
    </div>
  </AbsoluteFill>;
}

/** Three kit motifs at hero size on ink, each drawn in; the flat motifs never share a frame with the glossy renders. */
function Beats({frame}: {frame: number}) {
  const wipe = span(frame, AT.beats, 16);
  const items: [Asset, string][] = [[Cup, '손에 맞는 두께'], [Leaf, '자연에서 온 유약'], [Heart, '오래 쓰는 마음']];
  const size = S * 0.38;
  return <AbsoluteFill style={{background: paper}}>
    <MotionProbe id="beats-wipe" value={wipe} family="wipe" axis="progress" />
    <AbsoluteFill style={{background: ink, clipPath: `inset(0 0 0 ${(1 - wipe) * 100}%)`}} />
    <div style={{position: 'absolute', left: SIZES.marginX, top: SIZES.marginY + S * 0.02}}><Glyphs text="세 가지 결" frame={frame} at={AT.beats + 10} color={paper} /></div>
    <div style={{position: 'absolute', left: SIZES.marginX, right: SIZES.marginX, top: H * 0.3, display: 'flex', justifyContent: 'space-between'}}>
      {items.map(([Shape, word], i) => {
        const p = pop(frame, AT.beats + 16 + i * 10, 18);
        return <div key={word} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: S * 0.03, width: (W - SIZES.marginX * 2) / 3}}>
          <div style={{transform: `scale(${p})`, visibility: p === 0 ? 'hidden' : 'visible'}}><Shape size={size} ink={paper} accent={accent} soft={soft} paper={ink} draw={span(frame, AT.beats + 20 + i * 10, 24)} /></div>
          <div style={{fontFamily: ui, fontWeight: 500, fontSize: SIZES.label * 1.5, color: paper, opacity: span(frame, AT.beats + 34 + i * 10, 10)}}>{word}</div>
        </div>;
      })}
    </div>
  </AbsoluteFill>;
}

/** Paper wipes back in; the Blender dolly shot moves in on an ink-glazed sphere for 90 frames and holds. */
function Dolly({frame}: {frame: number}) {
  const wipe = span(frame, AT.dolly, 14);
  const camera = push(frame, AT.dolly + 60, 50, 0.03);
  return <AbsoluteFill style={{background: ink}}>
    <MotionProbe id="dolly" value={camera} family="camera" axis="scale" />
    <AbsoluteFill style={{background: paper, clipPath: `inset(0 0 ${(1 - wipe) * 100}% 0)`}} />
    <AbsoluteFill style={{transform: `scale(${camera})`, opacity: wipe}}>
      <Sequence from={AT.dolly} layout="none">
        <ImageSequence src="/assets/generated/turntable-spot/3d/dolly" frames={90} fps={30} style={{left: W * 0.19}} />
      </Sequence>
    </AbsoluteFill>
    <div style={{position: 'absolute', left: SIZES.marginX, top: H * 0.3, display: 'flex', flexDirection: 'column', gap: S * 0.03}}>
      <Glyphs text="가까이 볼수록" frame={frame} at={AT.dolly + 10} />
      <Glyphs text="달라지는 결" frame={frame} at={AT.dolly + 26} />
    </div>
  </AbsoluteFill>;
}

/** A CC0 vase from Poly Haven, tinted to the accent, turns on a shadowed floor inside <ThreeCanvas> while the name rises; frozen for the hold. */
function Name({frame}: {frame: number}) {
  const wipe = span(frame, AT.name, 16);
  const bar = span(frame, AT.name + 30, 16);
  const scale = pop(frame, AT.name + 4, 30, true);
  return <AbsoluteFill style={{background: paper}}>
    <MotionProbe id="name-wipe" value={wipe} family="wipe" axis="progress" />
    <MotionProbe id="name" value={span(frame, AT.name + 8, 40)} family="text" axis="progress" />
    <AbsoluteFill style={{background: soft, clipPath: `inset(0 ${(1 - wipe) * 100}% 0 0)`}} />
    <ThreeCanvas width={W} height={H} camera={{position: [0, 1.2, 7.2], fov: 32}} gl={{antialias: true, alpha: true}} shadows>
      <StudioLights intensity={1.1} />
      <group position={[1.9, -1.55, 0]} scale={scale}>
        <Turntable speed={0.12} phase={0.6}>
          <Model src="/assets/generated/turntable-spot/models/vase/vase.gltf" scale={8} color={accent} />
        </Turntable>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]} receiveShadow>
          <planeGeometry args={[30, 30]} />
          <shadowMaterial color={ink} opacity={0.32} transparent />
        </mesh>
      </group>
    </ThreeCanvas>
    <div style={{position: 'absolute', left: SIZES.marginX, top: H * 0.28, display: 'flex', flexDirection: 'column', gap: S * 0.035}}>
      <Glyphs text="결 세라믹" frame={frame} at={AT.name + 8} size={SIZES.headline * 1.7} />
      <div style={{width: W * 0.3, height: S * 0.018, background: accent, transform: `scaleX(${bar})`, transformOrigin: 'left'}} />
      <div style={{fontFamily: ui, fontWeight: 500, fontSize: SIZES.label * 1.4, color: ink, opacity: span(frame, AT.name + 48, 14)}}>손으로 빚은 결 · 가상 브랜드</div>
    </div>
  </AbsoluteFill>;
}

export function TurntableSpot() {
  const frame = useCurrentFrame();
  const quiet = [AT.hero, AT.beats, AT.dolly, AT.name];
  return <AbsoluteFill style={{background: ink, overflow: 'hidden'}}>
    <Audio src="/audio/generated/turntable-spot/music.wav" volume={0.9} />
    <MotionSound src="/audio/generated/turntable-spot/whoosh.wav" role="move" families={['card', 'wipe', 'camera']} quiet={quiet} />
    <MotionSound src="/audio/generated/turntable-spot/impact.wav" role="land" families={['card', 'shape']} quiet={quiet} />
    {frame < AT.hero ? <Hook frame={frame} /> : null}
    {frame >= AT.hero && frame < AT.beats ? <Hero frame={frame} /> : null}
    {frame >= AT.beats && frame < AT.dolly ? <Beats frame={frame} /> : null}
    {frame >= AT.dolly && frame < AT.name ? <Dolly frame={frame} /> : null}
    {frame >= AT.name ? <Freeze frame={AT.hold - 1} active={frame >= AT.hold}><Name frame={Math.min(frame, AT.hold - 1)} /></Freeze> : null}
  </AbsoluteFill>;
}
