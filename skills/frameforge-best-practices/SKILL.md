---
name: frameforge-best-practices
description: Make deterministic motion-graphics and explainer videos with the Frameforge engine (React frame functions, bespoke WebGL, canvas and three.js rendering, generated music, motion-derived sound effects, a deterministic renderer and checks). Use when the user asks for a video, spot, ad, intro, explainer, reel, ident or caption film, or asks to render, check, fix or tune one. Works the same in Claude Code, Codex, Cursor and Grok Build.
---


# Frameforge best practices

Motion-graphics films (showreel, ident, launch, promo, "show off") follow `../frameforge-motion/SKILL.md` only; the rules below are for explainers, process, caption, chart and data films.

This skill holds every rule; the task skills (`frameforge-create`, `frameforge-assets`, `frameforge-audio`, `frameforge-render`, `frameforge-studio`, `frameforge-check`) and the lever skills (`frameforge-blocks`, `frameforge-voice`, `frameforge-3d`, `frameforge-generative`) are entry points into it. The repository root is two folders above this file.

The repository root is the folder that holds `package.json` with `"name": "frameforge-local"`. Everything below is relative to it. Read only the reference file your step needs.

## The one workflow

1. **Engine brief** → before any concept, fill `examples/samples/<slug>/brief.md`: `## Request` verbatim, `## Intent ledger` (one row per clause, every word of the request covered: quoted clause, kind `must`/`forbid`/`taste`/`implied`, engine means, where it is verified), `## Engine translation` (the film in engine vocabulary; adds detail, never contradicts, weakens or drops a must or forbid; open choices labelled `Decision:`), `## Gaps` (what the engine cannot do and the substitute; `None.` when empty). `node bin/frameforge.mjs brief-check <slug>` must PASS. The user's intent is the ledger; every later step follows the translation.
2. **Plan** → write `examples/samples/<slug>/prompt.md` from the Engine translation: Inputs, Direction (a `Concept:` paragraph first: the single idea, its world, one recurring hero, a palette derived from the concept, the signature moves and the code that makes each, how motion enacts each line of copy; then a `Banned:` line), Structure (BPM, bars, one row per beat or bar in absolute frames), Build (the rendering plan: layers, techniques, camera, fonts), Second pass, Gotchas. Show the Structure table before code. Rules: `docs/samples/rules.md` is binding. Template: `examples/samples/_template/`. Nothing in this repository's docs or examples is a scene, palette or line to reuse: if the scene list could be pasted into another prompt's film unchanged, start again.
3. **Build, by film kind** →
   - Motion graphics (showreel, reel, ident, launch, promo, brand film, "show off"): bespoke-first. Write the film's own rendering code for its concept (GLSL in `<Shader frag>`, a canvas painted in `<Canvas2D draw>`, a three.js scene in `<ThreeCanvas>` with `<Bloom>`, DOM type on top) and own the camera, easing, particles and type animation. Helpers and contracts: `references/bespoke.md`. The bar and its self-checks: `references/showreel.md`. Type: `references/kinetic-type.md`. Blocks, kit motifs and shader presets are not the path here.
   - Explainer, process, captions, charts, data, or a calm film the request asks for: the utilities appendix (`references/utilities.md`: blocks, the motif kit and `assets.json`, shader presets, generative backgrounds, post effects, narration, a rendered 3D hero). Never an icon library for heroes (the one exception: `lucide-react` markers in explainer callouts over real screens); details in `references/assets.md`.
4. **Motion** → `Spot.tsx` is a pure function of `useCurrentFrame()`. Spectacle and continuity by default: every second shows an active effect or transformation, the camera never fully stops, the frame is layered (type, effect, world) and the technique changes on the beat; restraint only when the request asks for a calm film. The first second is a striking, frame-filling, moving image. Every cut is a seam: one dominant direction per film, cut mid-motion on both sides (`references/seams.md`). Beats come from the music grid (`beatsFromSpec(audioSpec, fps)`: cuts on bar lines, pulses on hits). Text inside the safe area, sizes from 구성 최소치, words whole at every frame they are read. A process shows cause and effect together with the subject whole and marked `data-subject`. The end is a live lockup (arrives within the last 1.5 s and keeps moving; frame-check fails a final 2 s under 0.5 motion share) or an exact loop; a poster is a separate still render, never a held end. No transition leaves three flat or fully blurred frames (frame-check `featureless`). `references/motion.md`.
   **Second pass (mandatory)** → render a contact sheet, one cell per beat or scene; critique every cell in writing against `references/showreel.md` (bar and self-checks); remake the two weakest scenes with a new technique; render the sheet again; only then the final render.
5. **Sound** → `audio.json` next to the Spot (sections on bar lines, hits on visual events, `sfx[]` with `intent` sentences); in the Spot report animated values with `useMotionSound`/`<MotionProbe>` and declare `<MotionSound role src quiet />`; the engine derives move/land/appear sounds, ducks music under them, and refuses dense hand-placed effects. `references/sound.md`. A spoken film is narration-first: `narration.json` → `npm run voice` → `narration.timing.json` → scenes on `useNarration`, `<Voiceover>` (music ducks under it) and `<Subtitles>` as an overlay (`frameforge-voice`, `references/captions.md`).
6. **Check** → after the second pass, render a contact sheet of the check frames (`--frames`, own `FRAMEFORGE_PORT` if another render runs), look at every cell; `npx tsc --noEmit`; `npm test`; `npm run lint:video -- examples/samples/<slug>/entry.tsx`; then render `npm run render -- examples/samples/<slug>/entry.tsx <Id> renders/samples/<slug>.mp4` and run `node bin/frameforge.mjs check renders/samples/<slug>.mp4 --film <slug>` (frame-check, flash-check, seam-check on the render's `.motion.json`, narration-check when the film speaks, brief). Before delivery re-read the ledger against the frames and the check output; the report lists each must and forbid clause with PASS or FAIL and repeats every Gap. The renderer fails on clipped text, dense effects and mixed frame sizes and prints an `{"audit": [...]}` line for text outside the safe area, overlaps, low contrast and small text; fix the cause, never bypass. `references/checks.md`.
7. **Studio** → `VIDEO_ENTRY=examples/samples/index.tsx npm run dev` (port 4317) shows every registered composition with the process log, tuning variables and renders. Register new films in `examples/samples/index.tsx`.

## Hard rules

- Deterministic frames only: no `Math.random`, wall clock, timers, CSS animations, no state carried between paints. Use `random(seed)`, `rng(seed)` streams and `noise2D/3D/4D` (`references/bespoke.md`).
- Copy in the brief's language; fictional brands with plausible, specific names (never "Client A"); sample numbers labelled once, small, in the film's language ("Sample data", "サンプルデータ", "샘플 데이터"; blocks pick the word from `lang` or their copy); real screens only in explainers, unmodified, with trademark notes in `prompt.md`.
- No shared audio or asset files committed: everything under `public/audio/generated/` and `public/assets/generated/` is produced on demand from the specs.
- Never show text in a garbled intermediate state while it is read: whole glyphs, no scramble, no half-erased swap. Fast glyph motion on the way in or out (a slam, a scatter) is motion, not a read.
- Motion-graphics films are bespoke and must beat a viral code-animated showreel from the same model: every frame layered and moving, no slide-like holds, no flat cards, no on-screen technique or scene labels, no corner HUD (timecode, frame counter, scene number, BPM, REC; the audit reports `corner_hud` unless the film opts in with `data-hud="allow"` and a reason), end on a lockup that is still moving. Type in Google Fonts only, never a system font. Canvas and shader text is not in the render audit; check it on the contact sheet. Still banned: icon-library heroes, clip-art, stock images, off-palette colours, an effect that leaves the final text unreadable.
- Write what you did not verify in `prompt.md` and in your report. Never drop a request clause silently: it is a ledger row or a Gap.

## Commands

| Need | Command |
| --- | --- |
| Music + effects for one film | `npm run score -- examples/samples/<slug>/audio.json` |
| Assets for one film | `npm run art -- examples/samples/<slug>/assets.json` |
| Measure the music | `python3 scripts/assets/score-report.py public/audio/generated/<slug>/music.wav --spec examples/samples/<slug>/audio.json` |
| Render | `npm run render -- <entry.tsx> <Id> <out.mp4> [--frames 30,60] [--concurrency 3] [--frame-range a-b] [--pipe] [--check-idempotent]` |
| Contact sheet | `npm run render -- <entry.tsx> <Id> <sheet.png> --frames 30,120,240` |
| Lint | `npm run lint:video -- <entry.tsx>` |
| Composition check | `npm run frame-check -- <out.mp4>` |
| Flash check | `node scripts/flash-check.mjs <out.mp4>` |
| Compare two renders | `node scripts/snapshot-diff.mjs --against old.mp4 new.mp4 [--threshold 40]` |
| Voice for a narrated film | `npm run voice -- examples/samples/<slug>/narration.json` then `npm run narration-check -- examples/samples/<slug> --prompt examples/samples/<slug>/prompt.md` |
| Seams of a render | `npm run seam-check -- renders/samples/<slug>.mp4.motion.json --prompt examples/samples/<slug>/prompt.md` |
| 3D shots and CC0 models | `npm run blender -- examples/samples/<slug>/3d.json [--frames 0-1]`, `npm run models -- examples/samples/<slug>/models.json` |
| Beats of an external track | `npm run beats -- <audio file> --out beats.json` |
| Intent ledger of a film | `node bin/frameforge.mjs brief-check <slug>` |
| Every check in one table | `node bin/frameforge.mjs check <out.mp4> --film <slug>` |
| Other containers | `npm run render -- <entry.tsx> <Id> out.webm\|out.mov\|out.gif\|frames/ [--transparent] [--scale 2] [--crf 18]` |
| Link the skills into agent folders | `npm run skill:install` |
