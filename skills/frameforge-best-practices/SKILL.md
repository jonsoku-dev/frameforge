---
name: frameforge-best-practices
description: Make deterministic motion-graphics and explainer videos with the Frameforge engine (React frame functions, bespoke WebGL, canvas and three.js rendering, generated music, motion-derived sound effects, a deterministic renderer and checks). Use when the user asks for a video, spot, ad, intro, explainer, reel, ident or caption film, or asks to render, check, fix or tune one. Works the same in Claude Code, Codex, Cursor and Grok Build.
---


# Frameforge best practices

Motion-graphics films (showreel, ident, launch, promo, "show off") follow `../frameforge-motion/SKILL.md` only; the rules below are for explainers, process, caption, chart and data films.

The task skills (`frameforge-create`, `frameforge-assets`, `frameforge-audio`, `frameforge-render`, `frameforge-studio`, `frameforge-check`) and the lever skills (`frameforge-blocks`, `frameforge-voice`, `frameforge-3d`, `frameforge-generative`) provide workflows and references. The repository root is two folders above this file.

The repository root is the folder that holds `package.json` with `"name": "frameforge-local"`. Everything below is relative to it. Read only the reference file your step needs.

## The one workflow

1. **Engine brief** → for a new film, fill `examples/samples/<slug>/brief.md` before the concept. For a revision, read the existing brief, plan and source first; preserve the original request and history while merging the new requirements and decisions without recreating the film. Record when the user explicitly supersedes an earlier condition and follow the latest instruction. The brief contains `## Request` verbatim, `## Intent ledger` (one row per clause, every word of the request covered: quoted clause, kind `must`/`forbid`/`taste`/`implied`, engine means, where it is verified), `## Engine translation` (the film in engine vocabulary; adds detail, never contradicts, weakens or drops an active must or forbid; open choices labelled `Decision:`), and `## Gaps` (what the engine cannot do and the substitute; `None.` when empty). Run `node bin/frameforge.mjs brief-check <slug>` and report any unresolved conflict. The user's intent is the ledger; every later step follows the translation.
2. **Plan** → for a new film write `examples/samples/<slug>/prompt.md` from the Engine translation; for a revision preserve the existing plan and update only what is needed. The template covers: Inputs, Direction (a `Concept:` paragraph first: the single idea, its world, one recurring hero, a palette derived from the concept, the signature moves and the code that makes each, how motion enacts each line of copy; then a `Banned:` line), Structure (BPM, bars, one row per beat or bar in absolute frames), Build (the rendering plan: layers, techniques, camera, fonts), Second pass, Gotchas. Show the Structure table before code. Rules: `docs/samples/rules.md` is binding. Template: `examples/samples/_template/`. Nothing in this repository's docs or examples is a scene, palette or line to reuse: if the scene list could be pasted into another prompt's film unchanged, start again.
3. **Build, by film kind** →
   - Motion graphics (showreel, reel, ident, launch, promo, brand film, "show off"): follow `../frameforge-motion/SKILL.md`. Choose typography, media and rendering techniques for the concept; helpers and contracts are in `references/bespoke.md`.
   - Explainer, process, captions, charts, data, or a calm film the request asks for: the utilities appendix (`references/utilities.md`: blocks, the motif kit and `assets.json`, shader presets, generative backgrounds, post effects, narration, a rendered 3D hero). Select assets for their expressive fit and rights, then inspect their actual integration; details in `references/assets.md`.
4. **Motion** → for a new film, write `Spot.tsx` as a pure function of `useCurrentFrame()`. For a revision, make only the needed changes to existing relevant files instead of replacing `Spot.tsx` by default. Match motion, cuts and settled reading time to the brief. Plan what each shot adds, where attention moves, and how the ending serves the message. Use `references/seams.md` and a music grid when they serve the edit. Keep readable words whole and in contrast; mark DOM subjects `data-subject` when useful. Frame-check measures holds, sparse frames and end motion against fixed thresholds; review each result against the intended shot and report any conflict without changing the diagnostic result.
   **Second pass** → within the authorized scope, inspect relevant states and the last requested frame. Before rendering a contact sheet or still, check whether asset generation, network requests or other out-of-range effects are permitted; frame selection alone does not prevent them. If this route is not allowed or cannot be assessed, use an authorized observation method or mark affected observations NOT VERIFIED. Critique the scene purposes and revise weak compositions, actions or timing; inspect the revision with an authorized method.
5. **Sound** → preserve requested audio or silence; generate a score only when it fits the brief and its sources are authorized. Outside snapshot mode, the renderer generates a score whenever `audio.json` exists. Remove the unused audio file and import only when they came from the newly copied template; preserve user-owned files and report a limitation if the tools cannot perform the cleanup. For generated sound, `audio.json` next to the Spot can specify sections, hits and `sfx[]` intents; `references/sound.md` describes motion-derived effects. A spoken film is narration-first: `narration.json` → `npm run voice` → `narration.timing.json` → scenes on `useNarration`, `<Voiceover>` and `<Subtitles>` (`frameforge-voice`, `references/captions.md`).
6. **Check** → after the second pass, inspect authorized check frames using a permitted method; `npx tsc --noEmit`; `npm test`; `npm run lint:video -- examples/samples/<slug>/entry.tsx`; then check the render's possible effects and authorization before rendering the requested range, or the whole film if authorized, and run `node bin/frameforge.mjs check renders/samples/<slug>.mp4 --film <slug>` (frame-check, flash-check, seam-check on the render's `.motion.json`, narration-check when the film speaks, brief). A partial render does not establish whole-film status. Report each must and forbid clause as MET, UNMET or NOT VERIFIED with evidence and repeat every Gap. Preserve the actual technical check statuses. When available, review the authorized final output at playback speed and listen to the mix; a sheet and measurements do not establish playback or listening. `references/checks.md`.
7. **Studio** → `VIDEO_ENTRY=examples/samples/index.tsx npm run dev` (port 4317) shows every registered composition with the process log, tuning variables and renders. Register new films in `examples/samples/index.tsx`.

## Hard rules

- Deterministic frames only: no `Math.random`, wall clock, timers, CSS animations, no state carried between paints. Use `random(seed)`, `rng(seed)` streams and `noise2D/3D/4D` (`references/bespoke.md`).
- Copy in the brief's language; fictional brands with plausible, specific names (never "Client A"); sample numbers labelled once, small, in the film's language ("Sample data", "サンプルデータ", "샘플 데이터"; blocks pick the word from `lang` or their copy); real screens only in explainers, unmodified, with trademark notes in `prompt.md`.
- No shared audio or asset files committed: everything under `public/audio/generated/` and `public/assets/generated/` is produced on demand from the specs.
- Never show text in a garbled intermediate state while it is read: whole glyphs, no scramble, no half-erased swap. Fast glyph motion on the way in or out (a slam, a scatter) is motion, not a read.
- Keep required text readable and above decoration. Avoid unnecessary technique labels and corner HUD (the audit reports `corner_hud` unless the film opts in with `data-hud="allow"` and a reason). Inspect canvas and shader text using an authorized observation method because it is not in the render audit; report it NOT VERIFIED if no suitable method is available. Choose typography and visual sources for the brief and document rights and substitutions.
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
