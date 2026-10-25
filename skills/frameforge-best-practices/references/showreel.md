# The motion-graphics bar

For a showreel, reel, ident, launch, promo, brand film or any "show off" request. These films are bespoke: you write the rendering code for this concept (`bespoke.md`). This page holds constraints and self-checks only. It has no scenes, palettes or lines to reuse, on purpose: anything concrete in a skill ends up in every film.

## The bar

The film must beat a viral code-animated showreel that the same model would write from scratch with a canvas, a shader and its own type animation. If a frame of yours would look ordinary next to that, it is not done.

- Every frame is layered (a world, an effect over or through it, type) and moving. No 0.5 s window is frozen.
- No slide-like holds: nothing sits on a flat field waiting for the next cut. No flat cards, no centred headline on a plain background as a scene.
- The camera is never fully still; it pushes, orbits, rides, reframes.
- The technique changes on the beat, and every change is one the concept motivates.
- Type is animated by you, per glyph or per word, and the motion does what the words say (`kinetic-type.md`). Words are whole and legible at every frame they are meant to be read.
- Depth and light: real perspective (3D, parallax, raymarching), light that moves (speculars, bloom, glow, light sweeps), texture made in code (noise, grain, halftone, fields).
- No on-screen technique or scene labels (the name of an effect is not copy). No corner HUD (timecode, frame counter, scene number, BPM, REC). No system fonts.
- Text never sits under a brighter or busier layer that hides it; a word that has to be read is on top and in contrast.
- The end is a lockup still moving: the name arrives within the last 1.5 s and the world, the light or the particles keep going to the last frame.

## Concept first

In `prompt.md` Direction, before the Structure table, one `Concept:` paragraph:

1. The single idea, one sentence, specific to this request.
2. The world it happens in.
3. One hero that recurs and changes state across the film.
4. The palette, derived from the concept: four colours at most, named by role.
5. The signature moves this concept needs, each with the code that makes it (a shader, a canvas system, a three.js scene, a type animation).
6. How motion enacts each line of copy.

## Self-checks

Before the Structure table:
- Could this scene list be pasted into another prompt's film unchanged? Start again.
- Does any scene, palette or line come from a document, example or earlier film rather than from this request? Replace it.
- Is any row a hold, a card or a slide? Give it motion and a layer.

On the contact sheet (second pass, one cell per beat or scene):
- Every cell layered and moving, no two cells the same technique in a row, no flat or blurred cell.
- The first cell is already frame-filling and in motion.
- Every word meant to be read is whole, at least 10 % of the short side for headlines, inside the 5 % margin and in contrast. Canvas and shader text is not in the render audit: judge it here.
- Name the two weakest cells and remake those scenes with a new technique (not a tweak), then render the sheet again.

After the render: frame-check, flash-check and seam-check pass, the audit shows no `corner_hud`, and the final 2 s keep a motion share of at least 0.5.
