# Showreel recipe

Motion graphics means spectacle and continuity by default. Every second shows at least one active effect or transformation, the camera never fully stops, scenes morph into each other, the frame is layered (foreground type, an effect on it, a textured background), and the technique changes on every beat. A calm explainer is the exception the request has to ask for. The protective rules still hold: whole words only, the final text legible, the four palette colours, every value a function of the frame.

## Beat map: 15 s at 120 bpm

One beat is 0.5 s (15 frames at 30 fps, 30 at 60 fps). 30 beats, cuts on bar lines (every 2 s), a new technique on every beat or two. Frames below are at 30 fps.

| Frames | Beats | Technique | Component | Text |
| --- | --- | --- | --- | --- |
| 0-15 | 1 | Hook: full-frame light-speed streaks already racing at frame 0 | `<Shader frag={shaders.streaks}>` | none |
| 15-60 | 2-4 | Glowing headline punches through the streak core; chromatic split on the arrival | `<Glow>`, `<ChromaticShift>`, `GlyphRise` | "MOTION" |
| 60-120 | 5-8 | Macro iris fills the frame, the pupil dilates on the beat; the camera pushes into the pupil | `<Shader frag={shaders.iris}>`, CSS `scale` push | none |
| 120-180 | 9-12 | Out of the pupil: liquid marbling fills the letters of a word | `<Shader frag={shaders.liquid}>` behind a text `mask` | "DESIGN" |
| 180-240 | 13-16 | 3D perspective card fly-through, each card a cut on the beat, extruded titles | `perspective` + `rotateY`/`translateZ`, `<Extrude>` | client names |
| 240-300 | 17-20 | Isometric cube field rising on the beat, camera drifting over it | `<Shader frag={shaders.cubeField} uniforms={{u_beat: 0.5}}>` | one stat |
| 300-360 | 21-24 | CRT and VHS beat: scanlines over the type, a glitch burst on each snare | `<Scanlines>`, `<VhsGlitch>` | "PLAY" |
| 360-420 | 25-28 | A cubic-bezier curve draws itself with a glowing dot on its head; waveform bars behind | `evolvePath`, `<Glow>`, bars from `beatsFromSpec` | tagline |
| 420-450 | 29-30 | Live lockup: the name settles by 435, its glow keeps pulsing, grain and drift stay | `<Glow intensity={pulse}>`, `drift`, `grainEffect` | brand |

Every row is a seam from the previous one: the streak core becomes the headline, the headline zooms into the iris, the pupil opens into the liquid, the liquid word flies back as the first card. Write it as one continuous morph (`references/seams.md`, `zoomThrough`).

## Code per technique

Imports for all fragments:

```tsx
import {AbsoluteFill, ChromaticShift, Extrude, Glow, Scanlines, Shader, VhsGlitch, drift, evolvePath, interpolate, shaders, useCurrentFrame} from 'frameforge';
import {GlyphRise} from '@/blocks';
const palette = {ink: '#0b0a12', paper: '#fff6ea', accent: '#ff4d2e', soft: '#ffc2a6'};
const beat = 15, pulse = (frame: number) => Math.exp(-(frame % beat) / 5);  // 1 on the beat, falling to 0.05 before the next
```

Full-frame shader hook, moving at frame 0:

```tsx
<Shader frag={shaders.streaks} width={1920} height={1080} palette={palette} seed="reel" uniforms={{u_speed: 1.4}} style={{position: 'absolute', inset: 0}} />
```

Glowing headline with a chromatic hit on arrival:

```tsx
<Glow radius={18} intensity={0.5 + 0.5 * pulse(frame)} color={palette.accent}>
  <ChromaticShift amount={interpolate(frame, [15, 27], [14, 0], {extrapolateRight: 'clamp'})} angle={0}>
    <GlyphRise frame={frame} at={15} text="MOTION" size={260} palette={palette} fonts={fonts} align="center" />
  </ChromaticShift>
</Glow>
```

Macro iris with the camera pushing into the pupil:

```tsx
<div style={{position: 'absolute', inset: 0, transform: `scale(${interpolate(frame, [60, 120], [1, 6])})`}}>
  <Shader frag={shaders.iris} width={1920} height={1080} palette={palette} seed="reel" uniforms={{u_dilate: pulse(frame)}} />
</div>
```

Liquid inside letters (the shader is the fill, the word is the mask):

```tsx
<div style={{position: 'absolute', inset: 0, WebkitMaskImage: 'url(/assets/generated/reel/design-mask.svg)', maskImage: 'url(/assets/generated/reel/design-mask.svg)'}}>
  <Shader frag={shaders.liquid} width={1920} height={1080} palette={palette} seed="reel" uniforms={{u_flow: 1.5}} />
</div>
```

The mask is the word's letter shapes as an SVG file (drawn in `assets.tsx` and exported, or resolved by `npm run art`). An SVG image used as a mask cannot load web fonts, so outline the letters instead of using `<text>`. The letters must stay whole and legible while the liquid flows inside them; hold the word 1.2 s.

3D fly-through with extruded titles:

```tsx
<div style={{position: 'absolute', inset: 0, perspective: 1400}}>
  <div style={{position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transform: `translateZ(${(frame - 180) * 40}px) rotateY(${-18 + (frame - 180) * 0.2}deg)`}}>
    {cards.map((card, i) => <div key={card} style={{position: 'absolute', left: 560, top: 340, width: 800, height: 400, background: palette.paper, transform: `translateZ(${-i * 900}px)`}}>
      <Extrude depth={14} color={palette.accent} angle={45}><span style={{fontSize: 120, fontWeight: 900, color: palette.ink}}>{card}</span></Extrude>
    </div>)}
  </div>
</div>
```

Opaque cards hide the titles behind them; the audit does not count a title covered by a card in front as overlapping text.

Isometric cube field on the beat:

```tsx
<Shader frag={shaders.cubeField} width={1920} height={1080} palette={palette} seed="reel" uniforms={{u_beat: 0.5, u_cells: 12}} />
```

CRT and VHS beat:

```tsx
<Scanlines frame={frame} density={4} opacity={0.35} roll={1} style={{position: 'absolute', inset: 0}}>
  <VhsGlitch seed="reel-play" frame={frame} amount={0.9}>
    <GlyphRise frame={frame} at={300} text="PLAY" size={300} palette={palette} fonts={fonts} align="center" />
  </VhsGlitch>
</Scanlines>
```

A drawn curve with a glowing dot on its head:

```tsx
const path = 'M 200 800 C 700 100, 1200 1000, 1720 300';
const draw = interpolate(frame, [360, 405], [0, 1], {extrapolateRight: 'clamp'});
const {strokeDasharray, strokeDashoffset} = evolvePath(draw, path);
<svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
  <path d={path} fill="none" stroke={palette.soft} strokeWidth={10} strokeLinecap="round" strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} />
</svg>
<Glow radius={14} intensity={1} color={palette.accent}><div style={{position: 'absolute', left: head.x - 14, top: head.y - 14, width: 28, height: 28, borderRadius: 14, background: palette.paper}} /></Glow>
```

`head` is `getPointAtLength(path, draw * getLength(path))`.

Live lockup, never a dead hold:

```tsx
<div style={{position: 'absolute', inset: 0, transform: drift(frame, {x: 8, y: 5, scale: 0.01, period: 180})}}>
  <Glow radius={16} intensity={0.55 + 0.3 * Math.sin(frame / 10)} color={palette.accent}>
    <GlyphRise frame={frame} at={420} text="Halden Studio" size={180} palette={palette} fonts={fonts} align="center" />
  </Glow>
</div>
```

## Checks for a reel

- Contact sheet one frame per beat: every cell shows a different technique, none is a still layout.
- frame-check `motion share` near 1, no frozen run.
- The last second: the name whole and legible, the glow still moving.
- Every effect is a component above, a `<Shader>` preset or `grainEffect`; no stock images, no CSS animations.
