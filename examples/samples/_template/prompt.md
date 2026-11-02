# TODO-slug

Copy this folder to `examples/samples/<slug>/`. Rename `template.audio.json` to `audio.json` and set its `slug` to `<slug>`; in `Spot.tsx` change `./template.audio.json` to `./audio.json` and `/audio/generated/template/` to `/audio/generated/<slug>/`; rename `TemplateSpot` and the composition id in `entry.tsx`. Replace every TODO below and in the code.

Fill `brief.md` first (request verbatim, intent ledger, engine translation, gaps; `node bin/frameforge.mjs brief-check <slug>` must PASS); this plan follows its Engine translation and never drops a must or forbid row. Sections follow `docs/samples/rules.md` "기획 구조". A motion-graphics film is bespoke: you write its rendering code (`skills/frameforge-best-practices/references/bespoke.md`) and hold it to the bar (`skills/frameforge-best-practices/references/showreel.md`). Nothing in this repository's docs or examples is a scene, palette or line to reuse.

## Inputs

- Purpose: TODO who watches it and what they should feel or do after.
- Fictional names: TODO (plausible, specific, stated as fictional here).
- Palette: TODO colours by role, derived from the concept; choose the range the subject needs.
- Fonts: TODO available authorized typefaces (display, and UI if needed); prefer reproducible licensed local fonts and record any substitution.
- Music: TODO BPM, sections on bar lines, hits on the biggest changes (`audio.json`).

## Direction

Concept: TODO one paragraph, written before the Structure table: the single idea; the world it happens in; the one hero that recurs and changes state; the palette and why it fits; the signature moves and the code that makes each; how motion enacts each line of copy. Self-check: if this scene list could be pasted into another prompt's film unchanged, start again.

Banned: TODO the clichés this film would fall into, by name. Choose exclusions for this brief, not universal bans on media or composition. Preserve intentional reading holds, a quiet camera or a settled ending when they communicate the idea. Avoid unintended obscured copy or decorative motion that distracts from the subject.

## Structure

TODO BPM, TODO bars; one beat = 60 / BPM s = TODO frames.

| Frames | Beat | The world and camera | The hero becomes | Type and what its motion does | Technique (code) |
|---|---|---|---|---|---|
| 0-TODO | TODO | TODO the opening focus and its intended motion or stillness | TODO | TODO | TODO |
| TODO | TODO | TODO | TODO | TODO | TODO |
| TODO-end | TODO | TODO the ending state and sufficient reading time | TODO | TODO | TODO |

Cuts: TODO the frames of real cuts, or `none` for a continuous film. Choose a cut, match or hold for the narrative event (`skills/frameforge-best-practices/references/seams.md`).

## Build

- Format: TODO 1920x1080, TODO fps, TODO frames, composition id `TODO`.
- Layers: TODO the chosen rendering media and their roles; shader, canvas, DOM, images or 3D are options, not mandatory layers.
- Camera: TODO framing, movement or a deliberate hold for each shot.
- Determinism: seeded values from `rng(seed)` made once; particles as closed forms of the frame; no state between paints.
- Sizes: headline at least 10 % of the short side, labels 3.5 %, 5 % margins. Canvas and shader text is checked on the contact sheet, not by the audit.
- Sound: music from `audio.json`; `<MotionProbe>` on the big moves so the effects are derived.
- Check: `node bin/frameforge.mjs check renders/samples/<slug>.mp4 --film <slug>`; record each actual diagnostic status and inspect flagged intervals against the brief; never add motion only to force a PASS.

## Second pass

TODO build a representative shot with the actual assets and type before extending the timeline. Inspect saved output at delivery and small sizes, identify the largest evidenced weakness, revise and compare the same event. Record observed intervals and unverified playback/listening separately. Technical checks and self-review do not establish user acceptance.

## Gotchas

- TODO what broke while making this film.

## Start

Record the Structure table before writing `Spot.tsx`. When the user has authorized autonomous production, proceed without an extra approval gate; ask only for essential missing information or a genuinely new permission.
