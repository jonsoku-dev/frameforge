---
name: frameforge-best-practices
description: Make deterministic motion-graphics and explainer videos with the Frameforge engine (React frame functions, generated music, motion-derived sound effects, a drawn asset kit). Use when the user asks for a video, spot, ad, intro, explainer, reel, ident or caption film, or asks to render, check, fix or tune one. Works the same in Claude Code, Codex, Cursor and Grok Build; weak models stay inside the kit and the contracts below.
---

# Frameforge best practices

This skill holds every rule; the task skills (`frameforge-create`, `frameforge-assets`, `frameforge-audio`, `frameforge-render`, `frameforge-studio`, `frameforge-check`) and the lever skills (`frameforge-blocks`, `frameforge-voice`, `frameforge-3d`, `frameforge-generative`) are entry points into it. The repository root is two folders above this file.

The repository root is the folder that holds `package.json` with `"name": "frameforge-local"`. Everything below is relative to it. Read only the reference file your step needs.

## The one workflow

1. **Brief** → write `examples/samples/<slug>/prompt.md` first in six sections: Inputs, Direction (taste and a `Banned:` line), Structure (BPM, bars, one row per beat or bar in absolute frames), Build (fps, springs, camera, blur, beat contact sheet), Gotchas, Start (show the state list on the beat grid before code). Rules: `docs/samples/rules.md` is binding. Template: `examples/samples/_template/`.
2. **Assets** → never draw hero shapes ad hoc and never use an icon library (the one exception: `lucide-react` markers in explainer callouts over real screens). Before hand-writing a title, lower third, counter, card, chart, code panel or diagram, take it from the block catalogue (`import {LowerThird, BarChart} from '@/blocks'`, `frameforge-blocks`). A rendered 3D hero or turntable comes from `3d.json` and `<ImageSequence>` (`frameforge-3d`); an algorithmic background from `<Generative>` (`frameforge-generative`). Otherwise use the motif kit (`import {Cup, Card, Pin} from '@/assets'`, parametric: `size`, `ink/accent/soft/paper`, `stroke`, `radius`, `draw`, `parts`) or declare `examples/samples/<slug>/assets.json` with `intent` sentences and run `npm run art -- examples/samples/<slug>/assets.json`; the resolver picks host-placed files → your own image skill (`FRAMEFORGE_IMAGE_COMMAND`) → Openverse CC0 SVG → the kit, and `<Art src="/assets/generated/<slug>/<name>.svg" draw />` plays it. Details: `references/assets.md`.
3. **Motion** → `Spot.tsx` is a pure function of `useCurrentFrame()`; `interpolate`, `spring`, `Sequence`, wipes and glyph rises; pick a grammar: continuous morph (one hero changes state, the camera reframes each state; 60 fps, `springTrack`, `<CameraMotionBlur>` with probes outside it) or joined scenes; sizes from 구성 최소치; text inside the safe area; end on a 2 s still or an exact loop. `references/motion.md`. Every cut is a seam: one dominant direction per film, the exit vector decides the entry vector, cut mid-motion on both sides (`cutTheCurve`, `zoomThrough`, `<Seam>`; `references/seams.md`). Beats come from the music grid (`beatsFromSpec(audioSpec, fps)`: cuts on bar lines, pulses on hits).
4. **Sound** → `audio.json` next to the Spot (sections on bar lines, hits on visual events, `sfx[]` with `intent` sentences); in the Spot report animated values with `useMotionSound`/`<MotionProbe>` and declare `<MotionSound role src quiet />`; the engine derives move/land/appear sounds, ducks music under them, and refuses dense hand-placed effects. `references/sound.md`. A spoken film is narration-first: `narration.json` → `npm run voice` → `narration.timing.json` → scenes on `useNarration`, `<Voiceover>` (music ducks under it) and `<Subtitles>` as an overlay (`frameforge-voice`, `references/captions.md`).
5. **Check** → render a contact sheet of the check frames (`--frames`, own `FRAMEFORGE_PORT` if another render runs), look at every cell; `npx tsc --noEmit`; `npm test`; `npm run lint:video -- examples/samples/<slug>/entry.tsx`; then render `npm run render -- examples/samples/<slug>/entry.tsx <Id> renders/samples/<slug>.mp4` and run `node bin/frameforge.mjs check renders/samples/<slug>.mp4 --film <slug>` (frame-check, flash-check, seam-check on the render's `.motion.json`, narration-check when the film speaks). The renderer fails on clipped text, dense effects and mixed frame sizes and prints an `{"audit": [...]}` line for text outside the safe area, overlaps, low contrast and small text; fix the cause, never bypass. `references/checks.md`.
6. **Studio** → `VIDEO_ENTRY=examples/samples/index.tsx npm run dev` (port 4317) shows every registered composition with the process log, tuning variables and renders. Register new films in `examples/samples/index.tsx`.

## Hard rules

- Deterministic frames only: no `Math.random`, wall clock, timers, CSS animations. Use `random(seed)`.
- Korean copy for Korean briefs; fictional brands; numbers labelled 예시; real screens only in explainers, unmodified, with trademark notes in `prompt.md`.
- No shared audio or asset files committed: everything under `public/audio/generated/` and `public/assets/generated/` is produced on demand from the specs.
- Write what you did not verify in `prompt.md` and in your report.

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
| Every check in one table | `node bin/frameforge.mjs check <out.mp4> --film <slug>` |
| Other containers | `npm run render -- <entry.tsx> <Id> out.webm\|out.mov\|out.gif\|frames/ [--transparent] [--scale 2] [--crf 18]` |
| Link the skills into agent folders | `npm run skill:install` |
