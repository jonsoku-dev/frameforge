# TODO-slug

Copy this folder to `examples/samples/<slug>/`. Rename `template.audio.json` to `audio.json` and set its `slug` to `<slug>`; change `/audio/generated/template/` in `Spot.tsx` to `/audio/generated/<slug>/`; rename `TemplateSpot` and the composition id in `entry.tsx`. Fill every TODO below and in the copy, keep `SIZES`.

The six sections follow `docs/samples/rules.md` "기획 구조". The table alone decides *what*; Direction and Banned decide *how good*. A worked example: `examples/samples/morph-ui/prompt.md`.

## Inputs

Ask for these before anything else; the defaults stand when nobody answers.

- Purpose: TODO one sentence. Who watches it and what they should do after.
- Fictional brand: TODO name. Not a real company, product or logo. Invented names are plausible and specific (never "Client A"). Sample numbers carry one small footnote in the film's language ("Sample data", "サンプルデータ", "샘플 데이터"), not a tag on every stat.
- States the hero becomes: TODO 6–12 (e.g. button, loader, check, toggle, slider, chart, card, toast).
- Palette: ink #111111 (TODO role), paper #F4F4F1 (TODO role), accent #2F5BFF (TODO role). Four colours at most.
- Fonts: TODO one display, one UI (Google Fonts).
- Music: BPM TODO (generated from `audio.json`; an external track only with its licence written here and `npm run beats`).

## Direction

TODO one paragraph of taste: the bar it is held to (e.g. "Dribbble-level UI motion"), the one hero, what the camera does (it reframes so each state fills the frame), the grammar (continuous morph or joined scenes, `rules.md` 모션), the easing character (springs, a tiny overshoot at most), the effect or transformation that is running in every second (motion graphics means spectacle and continuity by default: the camera never fully stops, scenes morph into each other, a new technique on every beat, layered depth of foreground type, an effect and a textured background; restraint only when the request asks for a calm film), the end (a live lockup that keeps a glow pulse or drift, or an exact loop). A showreel or brand film names six to eight techniques with the component that makes each (`skills/frameforge-best-practices/references/showreel.md`). A process film says how each cause and its effect share the screen and how the layout moves on at every step.

Banned: TODO the clichés this film would fall into, by name. Always: headline-plus-three-cards layouts, a slide-like hold where nothing transforms, the same layout repeated across steps, icons for the props a process uses, stock images for texture (use `<Shader>` presets), fade-only entrances, bouncy easing, scrambled or half-revealed text, a shot with nothing moving, decorative dust particles, icon-library heroes, clip-art, stock gloss, off-palette colours, bezel, real brand, dead beats, text smaller than `SIZES.label`, anything that looks like a template.

## Structure

TODO BPM, TODO bars, something happens on every beat (one beat = 60 / BPM s = TODO frames).

| Frames | Beat | The hero becomes | The camera fills the frame with | Text |
|---|---|---|---|---|
| 0-90 | 1–3 | Hook: TODO a striking, frame-filling image or action by frame 30 (macro crop, full-bleed texture, a move under way), never a small mark on an empty field | TODO | TODO |
| 90-210 | 4–7 | TODO | TODO | TODO |
| 210-330 | 8–11 | TODO | TODO | TODO |
| 330-450 | 12–15 | TODO | TODO | TODO |
| 450-599 | 16–20 | Name: TODO, settled by 570, a live lockup until the end (glow pulse, drift) | TODO | TODO |

Fold the final lockup into the last row (a separate hold row would read as a cut to seam-check). If a row's camera answer is "the background", the row is empty.

Cuts: TODO the frames of real cuts, or `none` for a continuous morph. seam-check reads this line instead of the rows; delete it in a joined-scene film.

## Build

- Format: 1920x1080, TODO 30 or 60 fps (60 for a continuous morph, a fast camera or motion blur), TODO frames, composition id `TODO`, port TODO.
- Sizes (`SIZES` in Spot.tsx, short side 1080): headline 108 px, label 38 px, icon 65 px, hero shape 378 px, margins 96 px / 54 px, measured after the camera.
- Every value is a function of the frame. Values whose target changes on many beats use `springTrack`; the camera is one `springTrack` per axis, reported with `<MotionProbe family="camera">`.
- Motion blur (60 fps): TODO `<CameraMotionBlur shutterAngle={180} samples={4}>` around the picture; probes, `Audio` and `MotionSound` stay outside it.
- Secondary motion: TODO per shot (e.g. `drift(frame, {x: 10, y: 6, scale: 0.015, period: 240})` on the camera layer, a background layer at half amplitude, `breathe` on the accent). No 0.5 s window frozen; frame-check fails a frozen run over 1 s.
- Effects per beat (one line each): TODO e.g. `<Shader frag={shaders.tunnel}>` behind the hook, `<Glow>` pulsing on the headline, `<ChromaticShift>` on the cut, `<Scanlines>` + `<VhsGlitch>` on the glitch beat, `<Extrude>` on the name, `grainEffect` over all of it, small HUD timecode in a corner.
- Assets: TODO hero and its reductions. Mark the hero element `data-subject="TODO name"`; the render audit reports it when it leaves the frame (`element_cropped`) or covers text (`subject_overlaps_text`). Labels on the object go inside that element. Prefer blocks (`@/blocks`), the motif kit (`@/assets`) or an `assets.json` resolved by `npm run art`; draw in `assets.tsx` (one `STROKE`, one `RADIUS`) only what none covers. No icon library.
- Sound: /audio/generated/<slug>/music.wav at 0.9, sections on bar lines, `hits` on the TODO biggest state changes, derived sound effects from the probes.
- Before the full render: a contact sheet with one frame per beat (TODO list). Fix anything off the grid, cramped or hard to read.
- Check: `node bin/frameforge.mjs check renders/samples/<slug>.mp4 --film <slug>`; frame-check must print PASS.
- References: TODO file and why (e.g. examples/samples/morph-ui/Spot.tsx for the morph, camera and blur; examples/samples/cafe-morning/Spot.tsx for Glyphs and MotionSound).

## Gotchas

- Never put `will-change` on anything the camera scales: text renders blurry.
- Text that swaps inside a morphing container needs its own exit and entry timing, or the two overlap.
- A reveal caught mid-way must read: whole words only (`GlyphRise` and `Typewriter` defaults), never scramble or a half-erased swap.
- A process shot without its mechanism reads as a slideshow: show the pour stream (`<Stream>`) with the rising level, the arrow with the item it carries.
- Probes inside `CameraMotionBlur` are frozen copies and report nothing; keep them at the root.
- TODO what broke while making this film.

## Start

Show the state list on the beat grid (the Structure table) and get it confirmed before writing `Spot.tsx`.
