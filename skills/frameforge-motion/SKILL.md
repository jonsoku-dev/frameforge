---
name: frameforge-motion
description: Make a motion-graphics film (showreel, ident, launch, promo, brand film, "show off", "go all out") with Frameforge by writing bespoke shader, canvas and three.js code for one concept; Frameforge is only the deterministic renderer, the music and the checks. Use instead of the general create steps whenever the request is motion graphics.
---

# Motion graphics: write the film yourself

The bar is a viral code-animated showreel made by the same model with a blank canvas. A film made by assembling ready-made parts loses to that every time, so this path has almost no rules: you write the picture.

## What you read

Only these, nothing else in the repository:
- this file;
- `../frameforge-best-practices/references/bespoke.md` (the canvas, shader and three.js helpers, seeded random numbers, fonts);
- `../frameforge-audio/SKILL.md`, only for the `audio.json` format;
- `../frameforge-3d/SKILL.md`, only if you choose a Blender shot for the hero.
Do not read the blocks, kit, presets, samples, `docs/samples/rules.md`, `seams.md` or the other references, and do not copy any example. They pull films towards the same look.

## Steps

1. Create the film: `frameforge new <slug>` in a project (or copy `examples/samples/_template/` in the engine repo). Set duration, size and fps in `entry.tsx` and the index line to what the request says.
2. Fill `brief.md` (the user's request verbatim, one ledger row per clause with how the film meets it, gaps) and run `frameforge brief-check <slug>` until it passes. It keeps the user's intent; it is not a design document.
3. Pick one concept for this request: a single idea, its world, a hero that recurs and changes, a palette that comes from the idea. Write it in three lines at the top of `prompt.md`. The hero is an object, not a word: lit and dimensional (a three.js scene with `<Bloom>`, a raymarched object in your shader, or a Blender shot), strong enough to be the film's poster frame, and the camera keeps coming back to it as it changes state.
   Then list the shots, one line each: what is in front, what moves, what the camera does. No two lines may describe the same structure. "A word over an effect" is one structure however the effect changes, so it may appear once at most.
4. Write `Spot.tsx` as a pure function of `useCurrentFrame()`. Draw everything with your own code: WebGL fragment shaders (raymarching, fields, fluids, post), `<Canvas2D draw>` (particles in the thousands, geometry, trails, type), `<ThreeCanvas>` with `<Bloom>` for lit 3D. You own the camera, easing, particles and type animation. Seeded randomness only (`rng`, `noise*`), never `Math.random` or clocks. Type in a Google Font.
5. Write `audio.json` (mood, bpm, sections on the cuts, hits on the big moments, and one on the frame the name lands) so the music is generated in code; put cuts on its beat grid (`beatsFromSpec`).
6. Render a contact sheet, look at every cell like a top motion designer who will post this, and remake your two weakest scenes with a new idea (not a tweak). Check the shot list again against the sheet: if two shots read as the same formula, rebuild one. Then render the whole film.
7. Run `frameforge check <out.mp4> --film <slug>`. Its failures are defects to fix (frozen runs, blank transition frames, flashes, an end that stops). Canvas and shader text is invisible to the audit: check it on the sheet.
8. Report: what you made, every must and forbid clause of the request with pass or fail, the check output, what you did not verify.

## The bar, as checks on your own sheet

- Every frame is layered (foreground, effect, depth) and moving; nothing waits on a flat field; no word sits alone on a card.
- Each shot is a new visual idea, and the shots flow into each other in motion.
- No technique or scene names as labels, no corner readouts, no borders the request did not ask for.
- Words are whole and readable when they are meant to be read.
- A hero object carries the film; type alone over an effect is not a hero.
- The climax runs into the end: the name lands within the last 1.5 s, on a music hit, and nothing holds still for more than a second before it. The last frame is part of a move, not a card.
