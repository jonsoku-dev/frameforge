# TODO-slug

Copy this folder to `examples/samples/<slug>/`. Rename `template.audio.json` to `audio.json` and set its `slug` to `<slug>`; in `Spot.tsx` change `./template.audio.json` to `./audio.json` and `/audio/generated/template/` to `/audio/generated/<slug>/`; rename `TemplateSpot` and the composition id in `entry.tsx`. Replace every TODO below and in the code.

Fill `brief.md` first (request verbatim, intent ledger, engine translation, gaps; `node bin/frameforge.mjs brief-check <slug>` must PASS); this plan follows its Engine translation and never drops a must or forbid row. Sections follow `docs/samples/rules.md` "기획 구조". A motion-graphics film is bespoke: you write its rendering code (`skills/frameforge-best-practices/references/bespoke.md`) and hold it to the bar (`skills/frameforge-best-practices/references/showreel.md`). Nothing in this repository's docs or examples is a scene, palette or line to reuse.

## Inputs

- Purpose: TODO who watches it and what they should feel or do after.
- Fictional names: TODO (plausible, specific, stated as fictional here).
- Palette: TODO four colours by role, derived from the concept.
- Fonts: TODO Google Fonts only (display, and UI if needed).
- Music: TODO BPM, sections on bar lines, hits on the biggest changes (`audio.json`).

## Direction

Concept: TODO one paragraph, written before the Structure table: the single idea; the world it happens in; the one hero that recurs and changes state; the palette and why it fits; the signature moves and the code that makes each; how motion enacts each line of copy. Self-check: if this scene list could be pasted into another prompt's film unchanged, start again.

Banned: TODO the clichés this film would fall into, by name. Always: slide-like holds, flat cards, a headline on a plain field as a scene, on-screen technique or scene labels, corner readouts, system fonts, text hidden under a brighter layer, a shot with nothing moving, flat or blurred transition frames, a held end, scrambled text, stock images, off-palette colours.

## Structure

TODO BPM, TODO bars; one beat = 60 / BPM s = TODO frames.

| Frames | Beat | The world and camera | The hero becomes | Type and what its motion does | Technique (code) |
|---|---|---|---|---|---|
| 0-TODO | TODO | TODO frame-filling and already moving at frame 0 | TODO | TODO | TODO |
| TODO | TODO | TODO | TODO | TODO | TODO |
| TODO-end | TODO | TODO the lockup arrives within the last 1.5 s and keeps moving to the last frame | TODO | TODO | TODO |

Cuts: TODO the frames of real cuts, or `none` for a continuous film. Every cut lands in motion, in the film's one direction (`skills/frameforge-best-practices/references/seams.md`).

## Build

- Format: TODO 1920x1080, TODO fps, TODO frames, composition id `TODO`.
- Layers: TODO what the shader draws, what the canvas paints, what the DOM type does, and how they blend.
- Camera: TODO how it moves in every row (never fully still).
- Determinism: seeded values from `rng(seed)` made once; particles as closed forms of the frame; no state between paints.
- Sizes: headline at least 10 % of the short side, labels 3.5 %, 5 % margins. Canvas and shader text is checked on the contact sheet, not by the audit.
- Sound: music from `audio.json`; `<MotionProbe>` on the big moves so the effects are derived.
- Check: `node bin/frameforge.mjs check renders/samples/<slug>.mp4 --film <slug>`; frame-check must PASS.

## Second pass

TODO after the first contact sheet (one cell per beat or scene): the critique of every cell against the bar, the two weakest scenes named, what replaced them, and the second sheet's verdict. Only then the final render.

## Gotchas

- TODO what broke while making this film.

## Start

Show the Structure table and get it confirmed before writing `Spot.tsx`.
