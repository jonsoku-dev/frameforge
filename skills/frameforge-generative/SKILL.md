---
name: frameforge-generative
description: Generative backgrounds, WebGL shader textures, post effects, colour and film effects, and drawn text annotations for a Frameforge film. Use when a film needs an algorithmic background (flow field, aurora, mesh gradient, halftone, ripples, voronoi, starfield, particles, noise lines), image-like texture made in code (macro eye, tunnel, liquid, grain, light-speed streaks, isometric cubes), glow, chromatic aberration, scanlines, VHS glitch, extruded type, a light leak, grain, vignette, colour grade or LUT, or a hand-drawn highlight, circle, underline, box or bracket on text.
---

# Frameforge generative

Everything here is a pure function of the frame and a seed. Same frame and seed, same pixels; nothing accumulates across frames. Reference: `docs/reference/generative.md` and `docs/reference/effects.md` (Korean). Worked example: `examples/samples/generative-ident/`.

## Workflow

1. **Philosophy first.** Before choosing a system, write three short paragraphs at the top of `prompt.md`: what the background expresses (one sentence tied to the brand's idea), its rules (a closed function of `(seed, t)`, the film's four colours only, never competing with text), and what it refuses (dust particles, pasted icons, stock images, per-frame random seeds, an effect that hides the final text). The philosophy picks the system; the system does not pick the philosophy.
2. **Choose the system.** `GENERATIVE_SYSTEMS` lists nine: `flowField`, `particles`, `starfield`, `meshGradient`, `halftone`, `ripples`, `voronoi`, `noiseLines`, `aurora`. Pick the one whose geometry is the idea (currents → flowField, a sky → aurora, soft colour → meshGradient). `meshGradient` or `aurora` is the film's one gradient; a film never has both plus a CSS gradient. `particles` draws large discs, not dust; `starfield` only in scenes without text.
3. **Place it.** `<Generative system="aurora" seed="<slug>" width={W} height={H} fit="fill" palette={{ink, paper, accent, soft}} params={{...}} />` as an absolute layer under the scene. Wrap it in `<Sequence from={sceneStart}>` when its time should start at the scene. Backgrounds never compete with text: while a headline is up, lines are thin, alphas low, and the accent belongs to the text (pass `palette={{...palette, accent: soft}}` to a line system under text).
3b. **Image-like texture: `<Shader>`.** For macro, liquid, tunnel or grain use a shader preset, never a stock image: `<Shader frag={shaders.iris} width={W} height={H} palette={{ink, paper, accent, soft}} seed="<slug>" uniforms={{u_dilate: p}} />` (`import {Shader, shaders} from 'frameforge'`). Presets: `iris` (macro eye, `u_dilate`), `tunnel` (warped camera tunnel, `u_speed`), `liquid` (marbling, `u_flow`), `grainField` (film-grain halftone, `u_cell`), `gradientMesh`, `streaks` (light-speed, `u_speed`), `cubeField` (isometric cubes jumping on the beat, `u_beat` seconds per beat, `u_cells`). Your own `frag` gets `u_time`, `u_frame`, `u_resolution`, `u_seed`, every user uniform (number, 2–4 array, hex colour as vec3), `fragColor` and `hash`/`vnoise`/`fbm`/`centred()`; use the integer `hash`, never `fract(sin(...))`. A compile error fails the frame with the GLSL log.
3c. **Post effects on DOM.** Wrap type or a layer: `<Glow radius intensity color>` (bloom, pulse `intensity` from the frame), `<ChromaticShift amount angle>`, `<Scanlines density opacity roll frame>`, `<VhsGlitch seed amount frame>`, `<Extrude depth color angle>`. Each wraps its children once, so the audit reads the text once.
4. **Expose variables.** Declare `export const variables` in the Spot with the seed (`type: 'string'`) and two parameters spread from the system's own `schema` (each entry already has `type, default, min, max, step`; rename the key and add a `group`). Pass `variables={variables}` in the entry's `<Composition>` and read them as Spot props with defaults. The studio tune tab then changes the background live.
5. **Effects.** Add `effects` to `Solid`, `CanvasImage`, `AnimatedImage`, `HtmlInCanvas` or `Generative`. Over text or DOM, put a transparent `<Solid width height effects={[...]} />` on top: `lightLeakEffect({seed, progress})` for a seam (nothing at progress 0 and 1), `vignetteEffect` and `grainEffect({seed, frame})` over the whole film; the grain keeps the final lockup alive. `colorCorrectionEffect` defaults are identity; `lutEffect` takes `parseCubeLut(text)`.
6. **Annotations are drawn, not pasted.** `<Highlight>`, `<Encircle>`, `<Underline>`, `<StrikeThrough>`, `<Box>`, `<Bracket side>` wrap the text and draw by `progress` (0..1) with seeded `roughness`. Animate `progress` with the film's easing; report it with `<MotionProbe family="text" axis="progress" />` so the appear sound lands on the stroke. One annotation per headline line; never a hand-placed SVG scribble.
7. **Check.** The common checks (`skills/frameforge-check`), plus: `npx tsx --test tests/generative.test.tsx tests/effects.test.tsx`; a contact sheet where the background reads as one idea across scenes; text legible on every frame with a background; the final lockup still moving (a glow pulse, drift or grain).

## Rules

- Layer depth: a textured background (shader or generative), the type, an effect on the type.
- Backgrounds never compete with text.
- Annotations drawn, not pasted.
- Seeds are strings named after the film (`<slug>-flow`), fixed for the film; time enters as `t`, never as a per-frame seed.
- Systems that need integration (flowField) compute the whole path once per seed and draw the prefix for `t`; never step forward from the previous frame.
- No `requestAnimationFrame`, timers or React state in a painter; the canvas is painted in `useLayoutEffect` from `useCurrentFrame()` like `Solid`.
