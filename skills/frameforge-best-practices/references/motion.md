# Motion

- Frame function: `const frame = useCurrentFrame()` once at the root; helpers `span(frame, from, dur)` (eased 0..1), `pop(frame, at, dur)` (spring), `push(frame, at, dur, amount)` (camera scale). Copy them from `examples/samples/_template/Spot.tsx`.
- Grammar: continuous morph (one hero, never cut; size, radius and colour change, content swaps with a short blur; the camera zooms so each state fills the frame) or joined scenes (every cut a seam). One object carries continuity either way.
- Retargeted values: `springTrack({frame, fps, from, keys: [{at, to}], config})` sums one spring per change, so a value that moves on every beat stays a pure function of the frame. Stretchy indicators: leading and trailing edges on different springs.
- 60 fps films: `<CameraMotionBlur shutterAngle={180} samples={4}>` around the picture; `MotionProbe`, `Audio` and `MotionSound` outside it (frozen copies report nothing).
- Glyph rise masks: `height 1.15em, paddingTop 0.1em, marginTop -0.1em`, spaces as `' '`.
- Sizes (1080 short side): headline ≥ 10 %, labels ≥ 3.5 %, icons ≥ 6 %, hero ≥ 35 %; margins 5 %.
- No near-empty stretch over 10 frames; nothing still longer than 3 s except the final hold; the camera reframes as often as the states change, in one dominant direction.
- Transitions: `TransitionSeries` from `@/packages/transitions` (fade, slide, wipe, flip, clockWipe, iris; linearTiming/springTiming).
- Shapes, paths, noise, blur: `makeStar/makePolygon/...`, `getPointAtLength/evolvePath/interpolatePath`, `noise2D/3D`, `<Trail>`/`<CameraMotionBlur>` all import from `frameforge`.
- Media: `<Video src trimBefore volume playbackRate>`, `<AnimatedImage>`, `<Lottie src>`, `<Img>`; captions via `parseSrt` + `createTikTokStyleCaptions`.
- Existing animation code only: `<Seekable animate={el => el.animate(keyframes, {duration, fill: 'both'})}>` or `useSeekable(ref, factory)` seeks it per frame (`docs/reference/seekable.md`); new motion stays a frame function.
- Full guide: `docs/guides/motion-graphics.md`; explainers: `docs/guides/product-explainer.md`.
