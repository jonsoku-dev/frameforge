import {useMemo} from 'react';
import {BackSide, EdgesGeometry, IcosahedronGeometry} from 'three';
import type {} from '@react-three/fiber'; // brings in the <mesh>/<group> JSX types
import {AbsoluteFill, Audio, Easing, MotionProbe, MotionSound, ThreeCanvas, googleFont, interpolate, spring, useCurrentFrame} from 'frameforge';

// 10 s spot for a fictional 3D studio: a low-poly gem drawn with ink edges turns under one key light, then the name rises.
const W = 1920;
const H = 1080;
const S = Math.min(W, H);
const SIZES = {headline: S * 0.11, label: S * 0.04, marginX: W * 0.06};
const display = googleFont('Do Hyeon', {weights: [400], fallback: 'sans-serif'});
const ui = googleFont('IBM Plex Sans KR', {weights: [500], fallback: 'sans-serif'});
const ink = '#0B1220';
const paper = '#E2E8F0';
const accent = '#38BDF8';
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} satisfies {extrapolateLeft: 'clamp'; extrapolateRight: 'clamp'};
// The gem enters, turns, slides left for the name at 150, and everything is still for the last 60 frames.
const AT = {enter: 0, slide: 120, name: 150, settle: 240};

const span = (frame: number, from: number, dur: number) => interpolate(frame, [from, from + dur], [0, 1], {...clamp, easing: ease});

function Gem() {
  const frame = useCurrentFrame();
  const grow = spring({frame, fps: 30, delay: AT.enter, durationInFrames: 30});
  // One and a quarter turns that ease out by the hold, so the last two seconds do not move.
  const turn = interpolate(frame, [0, AT.settle], [0, Math.PI * 2.5], {...clamp, easing: Easing.bezier(0.3, 0.1, 0.3, 1)});
  const x = interpolate(span(frame, AT.slide, 40), [0, 1], [0, -2.05]);
  const edges = useMemo(() => new EdgesGeometry(new IcosahedronGeometry(1, 0)), []);
  return <group position={[x, 0, 0]} rotation={[0.35, turn, 0.12]} scale={grow * 1.75}>
    <mesh>
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color={accent} flatShading roughness={0.55} metalness={0.05} />
    </mesh>
    {/* A drawn look: an ink hull just behind the gem gives the silhouette a thick contour, and ink lines trace every facet edge. */}
    <mesh scale={1.06}>
      <icosahedronGeometry args={[1, 0]} />
      <meshBasicMaterial color={ink} side={BackSide} />
    </mesh>
    <lineSegments geometry={edges} scale={1.004}>
      <lineBasicMaterial color={ink} />
    </lineSegments>
  </group>;
}

function Glyphs({text, frame, at}: {text: string; frame: number; at: number}) {
  return <span style={{display: 'flex', color: paper, fontFamily: display, fontSize: SIZES.headline, lineHeight: 1}}>
    {Array.from(text).map((glyph, index) => {
      const rise = span(frame, at + index * 3, 14);
      return <span key={index} style={{display: 'inline-block', overflow: 'hidden', height: '1.15em', paddingTop: '0.1em', marginTop: '-0.1em'}}>
        <span style={{display: 'inline-block', transform: `translateY(${(1 - rise) * 120}%)`, visibility: rise === 0 ? 'hidden' : 'visible'}}>{glyph === ' ' ? ' ' : glyph}</span>
      </span>;
    })}
  </span>;
}

export function Spot() {
  const frame = useCurrentFrame();
  const camera = 1 + 0.04 * Math.sin(span(frame, AT.slide, 90) * Math.PI);
  const bar = span(frame, AT.name + 30, 20);
  return <AbsoluteFill style={{background: ink}}>
    <Audio src="/audio/generated/three-spin/music.wav" volume={0.9} />
    <MotionSound src="/audio/generated/three-spin/whoosh.wav" role="move" families={['camera', 'text']} quiet={[AT.slide]} />
    <MotionSound src="/audio/generated/three-spin/impact.wav" role="land" families={['shape']} quiet={[AT.slide]} />
    <MotionProbe id="gem" value={spring({frame, fps: 30, delay: AT.enter, durationInFrames: 30})} family="shape" axis="scale" />
    <MotionProbe id="camera" value={camera} family="camera" axis="scale" />
    <MotionProbe id="name" value={span(frame, AT.name, 40)} family="text" axis="progress" />
    <AbsoluteFill style={{transform: `scale(${camera})`}}>
      <ThreeCanvas width={W} height={H} camera={{position: [0, 0, 7], fov: 40}}>
        <ambientLight intensity={0.55} />
        <directionalLight position={[-3, 4, 5]} intensity={2.4} />
        <directionalLight position={[4, -2, 2]} intensity={0.5} color={paper} />
        <Gem />
      </ThreeCanvas>
      <div style={{position: 'absolute', left: W * 0.47, top: H * 0.36, display: 'flex', flexDirection: 'column', gap: S * 0.03}}>
        <Glyphs text="각진 결 스튜디오" frame={frame} at={AT.name} />
        <div style={{width: bar * W * 0.12, height: S * 0.012, background: accent}} />
        <span style={{fontFamily: ui, fontWeight: 500, fontSize: SIZES.label, color: paper, opacity: span(frame, AT.name + 40, 20)}}>면 스무 개로 빚는 3D 모션</span>
      </div>
    </AbsoluteFill>
  </AbsoluteFill>;
}
