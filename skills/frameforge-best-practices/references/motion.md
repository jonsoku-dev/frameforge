# Motion

- Frame function: `const frame = useCurrentFrame()` once at the root; helpers `span(frame, from, dur)` (eased 0..1), `pop(frame, at, dur)` (spring), `push(frame, at, dur, amount)` (camera scale). Copy them from `examples/samples/_template/Spot.tsx`.
- Three motion families per film (e.g. spring plates, wipes/rings, glyph rise). One object carries continuity across scenes.
- Glyph rise masks: `height 1.15em, paddingTop 0.1em, marginTop -0.1em`, spaces as `' '`.
- Sizes (1080 short side): headline ≥ 10 %, labels ≥ 3.5 %, icons ≥ 6 %, hero ≥ 35 %; margins 5 %.
- No near-empty stretch over 10 frames; nothing still longer than 3 s except the final hold; two camera pushes at most.
- Transitions: `TransitionSeries` from `@/packages/transitions` (fade, slide, wipe, flip, clockWipe, iris; linearTiming/springTiming).
- Shapes, paths, noise, blur: `makeStar/makePolygon/...`, `getPointAtLength/evolvePath/interpolatePath`, `noise2D/3D`, `<Trail>`/`<CameraMotionBlur>` all import from `frameforge`.
- Media: `<Video src trimBefore volume playbackRate>`, `<AnimatedImage>`, `<Lottie src>`, `<Img>`; captions via `parseSrt` + `createTikTokStyleCaptions`.
- Existing animation code only: `<Seekable animate={el => el.animate(keyframes, {duration, fill: 'both'})}>` or `useSeekable(ref, factory)` seeks it per frame (`docs/reference/seekable.md`); new motion stays a frame function.
- Full guide: `docs/guides/motion-graphics.md`; explainers: `docs/guides/product-explainer.md`.
