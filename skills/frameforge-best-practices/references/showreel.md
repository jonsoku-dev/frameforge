# Showreel menu

Motion graphics means spectacle and continuity by default: every second shows an active effect or transformation, the camera never fully stops, scenes morph into each other, the frame is layered, and the technique changes on every beat. That is the bar, not the recipe. This file is a menu, not a scene list: four different requests must give four different films.

## Concept first

Before the Structure table, write one paragraph in `prompt.md` Direction under `Concept:`:

1. **The single idea**, one sentence ("a lighthouse keeper's last night shift", "a glass bottle remembers the sea it came from", "a typeface grows up", "a city map that breathes with traffic").
2. **The world** it happens in (deep space, a CRT set, a printed page, a Bauhaus poster wall, a data room).
3. **One hero subject** that recurs and changes state across the film (a rendered bust, a gem, a planet, a thread, a tile grid, a number). A 3D hero is a Blender shot (`frameforge-3d`), not a shader.
4. **The palette, derived from the concept** (pick or adapt one below; never the default red and lavender).
5. **Three to five signature moves** chosen for this concept from at most two families below.
6. **How motion enacts the words**: for each line of copy, what the motion does that the sentence says (`references/kinetic-type.md`).

Self-check before code: if your scene list could be pasted into another prompt's film unchanged, start again.

## Rules for the menu

- No film uses more than two families. One leads; the second, if any, supplies transitions or one beat.
- Never default to streaks, iris, liquid type, cube field or tunnel. Use one only when the concept names its world (space travel, an eye, a liquid, a city of data, a journey).
- The palette changes per film. Two films from this engine side by side must not share a palette.
- No corner readouts (timecode, frame counter, scene number, BPM, REC) unless the concept is literally a camera or a broadcast; the render audit reports `corner_hud` and the film must opt in with `data-hud="allow"` and a reason in `prompt.md`.
- No flat or blurred transition frames: a cut or whip shows the incoming picture by its middle frame (frame-check fails three featureless frames in a row).
- The end lockup arrives in the last 1.5 s and keeps moving (camera drift, a light sweep across the name, particles, the hero still turning); frame-check fails a final 2 s whose motion share is under 0.5.

## Families

| Family | The idea it suits | Signature moves (component) |
| --- | --- | --- |
| Type-led | a voice, a manifesto, "who we are", a list of promises | one word per beat on flat colour fields (`WordBeat`), a thread that draws under and loops through words (`Thread`), a line on a field of dense text (`TextField`), extruded stacked type (`<Extrude>`), a word cut straight through, whip pans between fields (`WhipPan`), glyph rises (`GlyphRise`) |
| Geometric / Bauhaus | design, systems, rhythm, a studio reel | seeded tile mosaics that flip on the beat (`BauhausMosaic`), saturated flat colour fields that change every beat, circles and quarter-circles as wipes, a premium toggle or switch flipping on (`Toggle`), whip pans with directional blur (`WhipPan`) |
| 3D hero | a product, a model, a mind, a launch | one lit subject rendered by Blender (`frameforge-3d`) that turns and changes look: a builtin `head`, `bottle`, `gem`, `knot` or `plush`, or a Poly Haven model; `look` glossy, glass, chrome, holographic, toon, plush, wireframe or scanline; a `sweep` from scan lines to gloss; bloom, depth of field, an eased orbit with push-in and crane; played with `<ImageSequence>`; 3D perspective card fly-throughs; `<Glow>` on the type around it |
| Cosmic / scientific | scale, time, speed, distance | a lit planet with terminator, clouds and city lights (`shaders.planet`; a Blender sphere with a Poly Haven texture when it is the hero), a star with corona and flare (`shaders.sun`), light orbits round a sphere (`shaders.orbits`), numbers counting (`Counter`), streaks for speed (`shaders.streaks`) |
| Retro / CRT | a launch with nostalgia, games, music | a CRT power-on (a dot that becomes a line that becomes the picture), `<Scanlines>`, `<VhsGlitch>` bursts on the snare, `<ChromaticShift>`, a neon tunnel (`shaders.tunnel`), a glitch title, halftone (`shaders.grainField`) |
| Data | results, growth, a product in numbers | charts that build on the beat (`BarChart`, `LineChart`), a drawn curve with a glowing head (`evolvePath`), waveform bars from `beatsFromSpec`, an isometric cube field as a city of values (`shaders.cubeField`), counters |

Image-like texture (macro, liquid, gradient, grain) is a supporting layer in any family: `shaders.iris`, `shaders.liquid`, `shaders.gradientMesh`, `shaders.grainField`, never stock images. The raymarched presets `shaders.sliced`, `shaders.planet`, `shaders.sun` and `shaders.orbits` are backgrounds and textures (a planet far behind the type, orbits as a screen layer), or the hero only when Blender is absent; say so in `prompt.md`.

## Palettes

Pick one, adapt it to the concept, name it in Inputs. Four colours: ink, paper, accent, soft.

| Name | ink | paper | accent | soft | Suits |
| --- | --- | --- | --- | --- | --- |
| Bauhaus flat | #16141c | #f4efe4 | #e2553a | #3045e8 (plus #d6f23a as a field) | geometric, type-led reels |
| Paper and ink | #1b1a17 | #f1ece1 | #d4532b | #8a8172 | manifestos, type-led |
| Cosmic black and gold | #05060a | #f6efe0 | #e8b04a | #3a4a6b | cosmic, scientific |
| Monochrome and one accent | #0c0c0c | #f2f2f2 | #ff3b1f | #6b6b6b | product, launch |
| CRT phosphor | #070b14 | #e8ecff | #ff3d7f | #5864ff | retro / CRT, 3D hero |
| Signal green | #0a0f0c | #e9f5ec | #39e27a | #1f5f3a | data, tech |
| Sunset print | #2a1220 | #fff1e2 | #ff7a3d | #ffb6c8 | warm brand films |
| Ice and steel | #0e1620 | #eef4f8 | #47b8ff | #8aa2b8 | engineering, calm launches |

## Shape of a 15 s reel at 120 bpm

One beat is 0.5 s (15 frames at 30 fps). Thirty beats, cuts on bar lines (every 2 s), a new move every beat or two, all from the concept's families. Fill the rows with your own concept; the example rows show the shape, not the content.

| Frames | Beats | What the row must do | Example (concept "a lighthouse keeper's last night shift", 3D hero and type-led) |
| --- | --- | --- | --- |
| 0-30 | 1-2 | Hook: the hero or its world fills the frame, already moving | a macro of the rendered lamp's glass, a beam sliding across it |
| 30-120 | 3-8 | Establish the hero and the idea in words that the motion enacts | the camera cranes down the tower; "LAST WATCH" sweeps on with the beam |
| 120-300 | 9-20 | Change the hero's state every bar; each state a different signature move | the lamp drawn in scan lines, then swept to chrome; the beam paints each word |
| 300-405 | 21-27 | The turn: the biggest transformation, on the biggest hit | dawn: the push-in lands on the glossy lamp as it goes dark |
| 405-450 | 28-30 | Live lockup, settled by 420, still moving at 449 | the name over the slowly orbiting lamp, a light sweep across it |

Every row is a seam from the previous one (`references/seams.md`, `zoomThrough`, `WhipPan`).

## Code per technique

Imports for all fragments:

```tsx
import {AbsoluteFill, ChromaticShift, Extrude, Glow, Scanlines, Shader, VhsGlitch, drift, evolvePath, interpolate, shaders, useCurrentFrame} from 'frameforge';
import {GlyphRise} from '@/blocks';
const palette = {ink: '#0b0a12', paper: '#fff6ea', accent: '#ff4d2e', soft: '#ffc2a6'};  // replace with the concept's palette
const beat = 15, pulse = (frame: number) => Math.exp(-(frame % beat) / 5);  // 1 on the beat, falling to 0.05 before the next
```

Any shader field, moving at frame 0 (swap the preset for the concept's family):

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

3D hero: a rendered subject drawn in scan lines that sweeps to gloss while the camera orbits and pushes in (one hero for the whole film). The shot lives in `3d.json` (`frameforge-3d`):

```json
{"name": "lens", "frames": 150, "fps": 30, "width": 1920, "height": 1080,
 "camera": {"preset": "orbit", "from": -35, "to": 30, "ease": "inout", "radius": 9, "radiusTo": 7.2, "height": 1.4, "heightTo": 0.7, "target": 0.2, "fov": 30},
 "subject": {"kind": "builtin", "builtin": "gem"}, "look": "scanline", "sweep": {"to": "chrome", "from": 30, "until": 110},
 "material": {"base": "#C8CCD4", "accent": "#FFB347", "scroll": 0.04}, "dof": 4, "background": "#07070B"}
```

```tsx
<Sequence from={120} layout="none">
  <ImageSequence src="/assets/generated/<slug>/3d/lens" frames={150} fps={30} />
</Sequence>
```

Type, `<Glow>` and seams go around the sequence as in any scene. Without Blender, the fallback is the raymarched bust: `<Shader frag={shaders.sliced} uniforms={{u_style: 1, u_orbit, u_mix}} />`, written down in `prompt.md` as a substitution.

Cosmic background: a lit planet turning behind the type, light orbits round it:

```tsx
<Shader frag={shaders.planet} width={1920} height={1080} palette={palette} seed="earth" uniforms={{u_spin: 0.15, u_light: [0.8, 0.3, 0.5], u_zoom: interpolate(frame, [0, 90], [1.2, 0.36], {extrapolateRight: 'clamp'})}} />
<Shader frag={shaders.orbits} width={1920} height={1080} palette={palette} seed="orbits" uniforms={{u_rings: 5, u_speed: 1.2}} style={{position: 'absolute', inset: 0, mixBlendMode: 'screen'}} />
```

Type-led and Bauhaus moves are blocks; usage per block is in `references/kinetic-type.md`:

```tsx
import {BauhausMosaic, Thread, TextField, Toggle, WhipPan, WordBeat} from '@/blocks';
<WordBeat frame={frame} at={0} palette={palette} fonts={fonts} size={300} words={['KEEP', 'THE', 'LIGHT']} punctuation="." fields={['#3045e8', '#d6f23a', '#16141c']} beat={15} />
```

## Checks for a reel

- Contact sheet one frame per beat: every cell shows a different technique from at most two families, none is a still layout, no cell is a flat or blurred field.
- frame-check `motion share` near 1, no frozen run.
- The last 2 s: the name whole and legible and still moving (frame-check end motion share at least 0.5); no corner readout in the audit.
- The concept paragraph is there, and the scene list could not be pasted into another prompt's film.
- Every effect is a component above, a block, a `<Shader>` preset, a Blender shot or `grainEffect`; no stock images, no CSS animations.
- A 3D hero is a Blender shot (or a Poly Haven `<Model>`), not a raymarched preset, unless `prompt.md` records that Blender was absent.
