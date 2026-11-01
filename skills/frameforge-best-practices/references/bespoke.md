# Bespoke rendering: the runtime helpers

A motion-graphics film writes its own rendering code. Frameforge is the deterministic renderer, the clock, the sound and the checks; the picture is yours. These helpers are infrastructure only: each one repaints synchronously for the frame the renderer asks for, so the same frame always gives the same pixels. All import from `frameforge`.

## Layers

| Need | Helper | Contract |
| --- | --- | --- |
| A fragment shader (raymarching, fields, fluids, post) | `<Shader frag={src} width={W} height={H} uniforms={{u_x: 0.3, u_c: '#ff0000'}} palette={...} seed="..." />` | GLSL ES 3.00. Without a `#version` line the source gets a prelude: `u_time` (s), `u_frame`, `u_resolution`, `u_seed`, every uniform you pass and do not declare, `out vec4 fragColor`, `centred()`, `hash()`, `vnoise()`, `fbm()` (integer hash, same on every GPU). With its own `#version` line it compiles exactly as written. Uniforms: a number is a float, 2-4 numbers a vec, a hex string a vec3 colour. A compile error names the line in your source. |
| A 2D canvas you paint (particles, geometry, type, trails) | `<Canvas2D width={W} height={H} draw={(ctx, frame, {width, height, fps, time}) => ...} />` | The canvas is cleared and its state reset before every `draw`, in CSS pixels at any `pixelDensity`. `draw` reads only its arguments and seeded values made outside it. The first paint waits for the film's Google Fonts. |
| A lit 3D scene | `<ThreeCanvas width={W} height={H} camera={{position: [0, 0, 5], fov: 40}}>...</ThreeCanvas>` with react-three-fiber JSX inside | `frameloop="demand"`, one synchronous advance per frame. Animate from `useCurrentFrame()`, never `useFrame` timing or `clock`. |
| Bloom on a 3D scene | `<Bloom strength={1.2} radius={0.4} threshold={0.8} />` inside `<ThreeCanvas>` | three's own EffectComposer (render, UnrealBloom, output) on each advance; props may change per frame. |
| Type | DOM elements over the canvases | DOM text is what the render audit measures (safe area, size, overlap, contrast). |

Stack layers as absolutely positioned siblings; blend them with CSS `mix-blend-mode` and `filter` driven by the frame. Chrome keeps about 16 live WebGL contexts: prefer one shader that draws several things over many shaders, and unmount shots you leave (a `<Shader>` gives its context back on unmount).

Not provided: uploading a canvas as a shader texture. Layer the canvas over the shader and blend it, or draw the type inside the shader.

## Numbers that must repeat

- `rng(seed)`: a seeded stream; each call returns the next value in [0, 1). Make it once per seed (module level or `useMemo`) and draw from it in a fixed order, so particle `i` is the same particle on every frame and every render.
- `random(seed)`: one value per seed (`random(\`star-${i}\`)`).
- `noise2D(seed, x, y)`, `noise3D(seed, x, y, z)`, `noise4D(...)`: simplex noise in -1..1. Use time as an axis (`noise3D('drift', x, y, frame / 90)`) for motion that never repeats and never jumps.
- Never `Math.random`, `Date.now`, `performance.now`, `requestAnimationFrame`, timers or CSS animations in a film: `npm run lint:video` fails them.
- A particle system is a closed form of the frame (`position = start + velocity * t + noise`), or a simulation stepped from frame 0 up to the current frame inside `draw`. Never state carried between paints: the renderer jumps between frames and renders chunks in parallel.

## Time and the beat

- `useCurrentFrame()`, `useVideoConfig()` at the root; pass `frame` down.
- `beatsFromSpec(spec, fps)` from the film's `audio.json`: `beatAt`, `nextBeat`, `barAt`, `bars(from, to)`, `phase(frame)` (0 to 1 across a beat) and `pulse(frame, decay)` (1 on the beat, falling to 0). Cuts on bar lines; accents on beats and on the spec's `hits`.
- Easing: `interpolate(frame, [a, b], [x, y], {easing: Easing.bezier(...), extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})`, `spring({frame, fps, delay, durationInFrames})`, `springTrack` for a value retargeted on many beats. Your own curves are fine when they are pure functions of the frame.
- Report the big moves with `<MotionProbe id value family axis />` at the root (outside any motion blur) so the engine derives the sound effects, and declare `<MotionSound role src quiet />` (`sound.md`).

## Fonts

`const display = googleFont('Family Name', {weights: [800]})` at module level returns a CSS family string. Use it in DOM styles and in canvas: `ctx.font = \`800 ${px}px ${display}\``. The renderer waits for every requested Google Font before it captures a frame, and `<Canvas2D>` paints only after they load. Google Fonts can access the network; use them only when authorized. A licensed local font can avoid that request. A system face can differ per machine, so report variability or substitutions. Call `googleFont` at module level, not inside a component (a family first requested after the fonts settled is not awaited by the canvas).

## Text the audit cannot see

- Text painted on a canvas or in a shader is not DOM text: the render audit does not measure it. Inspect its size (headline at least 10 % of the short side, labels 3.5 %), margin (5 %) and contrast using an authorized observation method. Before rendering a contact sheet or still, check whether asset generation, network requests and other out-of-range effects are permitted; frame selection alone does not prevent them. Report the observed scope and mark observations NOT VERIFIED if no suitable permitted method is available.
- A chromatic split or echo of DOM type (offset copies of the same word in other colours) marks the copies `aria-hidden="true"` or `data-fx="ghost"`: the audit then ignores them, and identical copies never count as overlapping text.
- Letters that slam across the safe margin for under 0.3 s are motion, not a fault; a word that sits outside the margin for 0.3 s in one run is reported.

## Loading anything else

Hold the frame while something loads with `const h = delayRender('why')` and `continueRender(h)` when it is ready (`cancelRender(error)` on failure). An image is ready when decoded; a model, a font file (`loadFont`) or data when parsed.

## The end and the poster

- Choose an ending that serves the brief; a settled lockup, deliberate hold, or live motion can all work. Frame-check can flag low motion in its final 2 s; assess the interval against its purpose and report the actual result and any conflict. A loop may end where it began (`--hold 0`).
- A poster or thumbnail can be a still render of one authorized frame (`npm run render -- <entry.tsx> <Id> poster.png --frames <n>`); a held end may also serve when it fits the brief.
