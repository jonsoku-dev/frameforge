# Motion

- Design motion for the brief: establish what changes, what stays visible and where attention moves. A hold can serve reading; do not add drift solely to satisfy a diagnostic. Use `showreel.md` for review and `bespoke.md` for rendering helpers.
- Frame function: `const frame = useCurrentFrame()` once at the root; write your own timing helpers as pure functions of the frame (an eased 0..1 span from `interpolate` with `Easing`, a `spring`, a decaying kick from `beats.pulse`).
- Grammar: use a continuous morph, joined scenes, or a deliberate cut when it communicates the change. Continuity can come from a form, position, direction, color or meaning; it need not be the same object.
- Retargeted values: `springTrack({frame, fps, from, keys: [{at, to}], config})` sums one spring per change, so a value that moves on every beat stays a pure function of the frame. Stretchy indicators: leading and trailing edges on different springs.
- When motion blur serves the shot, `<CameraMotionBlur shutterAngle={180} samples={4}>` is an option; keep `MotionProbe`, `Audio` and `MotionSound` outside it (frozen copies report nothing).
- Glyph rise masks: use `blockMask` and `MASK_DROP` from `@/blocks` (0.1em above, 0.4em below, 0.3em beside each glyph, layout height unchanged), spaces as `'\u00A0'`. A clip fails the render with the block's name and the fix.
- Preserve meaningful readable text during its reading interval; entrance and exit motion must not obscure that interval. `GlyphRise`, `Typewriter` and `ZoomSwap` are options, not the only allowed choreography. Inspect the actual glyphs and settled words.
- Use the diagnostic size and margin guidance as a starting point, then inspect at delivery size. Report actual audit findings and any deliberate conflict; do not treat a percentage as proof of legibility or composition quality.
- Shape the opening for the requested mood and information; inspect it at delivery size.
- Sparse frames can be intentional. Inspect them against their purpose and actual reading time.
- Add secondary motion only when it helps the shot. Frame-check fails frozen runs beyond its threshold; inspect the flagged interval and report intentional holds or unresolved conflicts without relabeling the result.
- A process (recipe, how it works, assembly, data flowing) shows each cause and its effect at the same time: the bottle tilts, the stream pours (`<Stream from={lip} to={surface} progress={p} width={14} color={ink} wobble={3} frame={frame} />`, `[tail, head]` progress lets it stop and fall), and the level rises past labelled marks in the same frames. From the pour's first frame the level and its count both move while the stream is visible; a quantity never reads zero under a visible stream. Keep the subject whole in frame and mark it `data-subject` (the audit flags it cropped or covering text); put quantity labels on the object, inside the `data-subject` element.
- A process film can evolve a camera, tracker, subject or layout as each step changes. Make cause and effect clear rather than repeating unrelated copy.
- Transitions: `TransitionSeries` from `@/packages/transitions` (fade, slide, wipe, flip, clockWipe, iris; linearTiming/springTiming).
- Shapes, paths, noise, blur: `makeStar/makePolygon/...`, `getPointAtLength/evolvePath/interpolatePath`, `noise2D/3D`, `<Trail>`/`<CameraMotionBlur>` all import from `frameforge`.
- Media: `<Video src trimBefore volume playbackRate>`, `<AnimatedImage>`, `<Lottie src>`, `<Img>`; captions via `parseSrt` + `createTikTokStyleCaptions`.
- Existing animation code only: `<Seekable animate={el => el.animate(keyframes, {duration, fill: 'both'})}>` or `useSeekable(ref, factory)` seeks it per frame (`docs/reference/seekable.md`); new motion stays a frame function.
- Full guide: `docs/guides/motion-graphics.md`; explainers: `docs/guides/product-explainer.md`.
