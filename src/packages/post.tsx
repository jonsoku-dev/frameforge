import React, {useId} from 'react';
import {random} from '../core/math';

/* Post effects for DOM scenes. Each wraps its children once (never a copy of them, so text is read and audited once) and is a pure
 * function of its props: pass `frame` for anything that moves, so the same frame gives the same pixels. */

type Wrap = {children?: React.ReactNode; style?: React.CSSProperties; className?: string};
const fill: React.CSSProperties = {position: 'absolute', inset: 0, pointerEvents: 'none'};
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const px = (value: number) => Number(value.toFixed(2));

/** CSS filter of a bloom: up to three stacked drop-shadows of `color` at `radius`, 2.5× and 6× it; `intensity` 0..1 sets their strength. */
export function glowFilter(radius: number, intensity: number, color: string): string {
  const i = clamp01(intensity);
  if (i === 0 || radius <= 0) return 'none';
  return [[1, 1], [2.5, 0.8], [6, 0.55]].map(([scale, alpha]) => `drop-shadow(0 0 ${px(radius * scale!)}px color-mix(in srgb, ${color} ${Math.round(i * alpha! * 100)}%, transparent))`).join(' ');
}
/** A bloom round its children's own shapes (type, strokes, an icon): stacked soft drop-shadows, so nothing is duplicated. Animate `intensity`
 * from the frame for a pulse. */
export function Glow({radius = 12, intensity = 0.8, color = '#ffffff', children, style, className}: Wrap & {radius?: number; intensity?: number; color?: string}) {
  return <div className={className} style={{filter: glowFilter(radius, intensity, color), ...style}}>{children}</div>;
}

/** RGB offsets of a chromatic shift: red goes `amount` px along `angle` degrees, blue the opposite way, green stays. */
export function chromaticOffsets(amount: number, angle: number): {red: [number, number]; blue: [number, number]} {
  const a = angle * Math.PI / 180, dx = px(Math.cos(a) * amount), dy = px(Math.sin(a) * amount);
  return {red: [dx, dy], blue: [-dx || 0, -dy || 0]};
}
function ChannelSplit({id, red, blue}: {id: string; red: [number, number]; blue: [number, number]}) {
  // Keeps one colour channel and the alpha: the identity row for `keep`, zero rows for the other two.
  const channel = (keep: number) => ['1 0 0 0 0', '0 1 0 0 0', '0 0 1 0 0'].map((row, r) => r === keep ? row : '0 0 0 0 0').concat('0 0 0 1 0').join('  ');
  return <filter id={id} x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
    <feColorMatrix in="SourceGraphic" type="matrix" values={channel(0)} result="r" />
    <feOffset in="r" dx={red[0]} dy={red[1]} result="ro" />
    <feColorMatrix in="SourceGraphic" type="matrix" values={channel(1)} result="g" />
    <feColorMatrix in="SourceGraphic" type="matrix" values={channel(2)} result="b" />
    <feOffset in="b" dx={blue[0]} dy={blue[1]} result="bo" />
    <feBlend in="ro" in2="g" mode="screen" result="rg" />
    <feBlend in="rg" in2="bo" mode="screen" />
  </filter>;
}
/** Chromatic aberration: the children's red and blue channels split `amount` px apart along `angle`. */
export function ChromaticShift({amount = 6, angle = 0, children, style, className}: Wrap & {amount?: number; angle?: number}) {
  const id = `ff-chroma-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  if (amount === 0) return <div className={className} style={style}>{children}</div>;
  return <div className={className} style={{filter: `url(#${id})`, ...style}}>
    <svg width={0} height={0} style={{position: 'absolute'}} aria-hidden><ChannelSplit id={id} {...chromaticOffsets(amount, angle)} /></svg>
    {children}
  </div>;
}

/** CRT scanlines over the children: one dark line every `density` px at `opacity`, rolling `roll` px per frame. */
export function Scanlines({density = 4, opacity = 0.25, roll = 0, frame = 0, children, style, className}: Wrap & {density?: number; opacity?: number; roll?: number; frame?: number}) {
  const line = Math.max(1, density / 2);
  return <div className={className} style={{position: 'relative', ...style}}>
    {children}
    <div style={{...fill, backgroundImage: `repeating-linear-gradient(to bottom, rgba(0, 0, 0, ${clamp01(opacity)}) 0 ${px(line)}px, transparent ${px(line)}px ${density}px)`, backgroundPositionY: `${px((frame * roll) % density)}px`}} />
  </div>;
}

/** One frame of a VHS glitch: whether a burst is on, its strength 0..1, the turbulence seed and the band frequency. Bursts come in seeded
 * runs of three frames; between them a faint residual wobble stays, so the effect never freezes. */
export function vhsGlitch(seed: string | number, frame: number, amount: number): {burst: boolean; strength: number; noiseSeed: number; bands: number} {
  const run = Math.floor(frame / 3);
  const burst = random(`${seed}:vhs:${run}`) > 0.62;
  const strength = clamp01(amount) * (burst ? 0.55 + 0.45 * random(`${seed}:vhs-s:${run}`) : 0.12);
  return {burst, strength, noiseSeed: Math.floor(random(`${seed}:vhs-n:${frame}`) * 1000), bands: px(0.01 + 0.05 * random(`${seed}:vhs-b:${run}`))};
}
/** VHS glitch: seeded horizontal slices of the children shift sideways (an SVG turbulence displacement), the red channel bleeds, and a
 * noise band crosses during a burst. `amount` 0..1; `frame` drives it. */
export function VhsGlitch({seed, amount = 0.6, frame, children, style, className}: Wrap & {seed: string | number; amount?: number; frame: number}) {
  const id = `ff-vhs-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const {burst, strength, noiseSeed, bands} = vhsGlitch(seed, frame, amount);
  const shift = px(strength * 60), bleed = px(2 + strength * 10);
  const band = random(`${seed}:vhs-y:${Math.floor(frame / 3)}`);
  return <div className={className} style={{position: 'relative', ...style}}>
    <svg width={0} height={0} style={{position: 'absolute'}} aria-hidden>
      <filter id={id} x="-10%" y="0%" width="120%" height="100%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency={`0 ${bands}`} numOctaves={1} seed={noiseSeed} result="noise" />
        <feComponentTransfer in="noise" result="steps"><feFuncR type="discrete" tableValues="0.5 0.5 0.2 0.5 0.85 0.5 0.5 0.35" /></feComponentTransfer>
        <feColorMatrix in="steps" type="matrix" values="1 0 0 0 0  0 0 0 0 0.5  0 0 0 0 0  0 0 0 0 1" result="map" />
        <feDisplacementMap in="SourceGraphic" in2="map" scale={shift} xChannelSelector="R" yChannelSelector="G" result="shifted" />
        <feColorMatrix in="shifted" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.7 0" result="red" />
        <feOffset in="red" dx={bleed} result="bleed" />
        <feBlend in="bleed" in2="shifted" mode="screen" />
      </filter>
    </svg>
    <div style={{filter: `url(#${id})`}}>{children}</div>
    {burst ? <div style={{...fill, top: `${px(band * 90)}%`, bottom: 'auto', height: '6%', background: 'rgba(255, 255, 255, 0.14)', mixBlendMode: 'screen'}} /> : null}
  </div>;
}

/** text-shadow of an extrusion: `depth` 1 px layers of `color` stepping along `angle` degrees, then one soft contact shadow. */
export function extrudeShadow(depth: number, color: string, angle = 45, shadow = 'rgba(0, 0, 0, 0.35)'): string {
  const a = angle * Math.PI / 180, layers = Math.max(0, Math.round(depth));
  const steps = Array.from({length: layers}, (_, k) => `${px(Math.cos(a) * (k + 1))}px ${px(Math.sin(a) * (k + 1))}px 0 ${color}`);
  if (layers) steps.push(`${px(Math.cos(a) * layers * 1.6)}px ${px(Math.sin(a) * layers * 1.6)}px ${px(layers * 0.8)}px ${shadow}`);
  return steps.join(', ') || 'none';
}
/** 3D extruded type: the text inside gets a solid side `depth` px deep in `color` along `angle` (degrees, 45 = down right) and a soft
 * shadow. Animate depth or angle from the frame and the block turns. */
export function Extrude({depth = 18, color = '#000000', angle = 45, shadow, children, style, className}: Wrap & {depth?: number; color?: string; angle?: number; shadow?: string}) {
  return <div className={className} style={{textShadow: extrudeShadow(depth, color, angle, shadow), ...style}}>{children}</div>;
}
