---
name: frameforge-3d-review
description: "Review and fix Frameforge Blender shots using actual pictures and supporting scene diagnostics: --inspect (scene, objects, bounds, lights, framing, warnings), --review (a six-angle review sheet PNG), a focused diagnose-then-fix loop, and the quality gate before a shot goes into a film. Use before calling any 3D shot done, or when a render looks wrong and the cause is unclear."
---

# Frameforge 3D review

Judge the actual rendered picture against the brief and observed reference; use scene diagnostics to locate technical causes. Numbers can be misinterpreted and cannot establish aesthetic quality. Field reference: `docs/reference/three-d.md`.

## When to use

- Before a Blender shot goes into a film, and after every significant change to it.
- When a render looks wrong and you do not know whether shape, material, light or camera is the cause.

## Steps

For a separately authored Blender scene, the spec wrapper commands below do not automatically apply. Record the scene source, render command and relevant diagnostics it actually provides, then inspect saved frames at the actual used angles and event phases. Mark unavailable checks NOT VERIFIED.

1. **Scene diagnostics (spec route).** `npm run blender -- <3d.json> --inspect --shot <name>` writes and prints `<shot>/inspect.json`. Check, in order:
   - `source`: the subject you meant (scan, not the sculpted fallback, unless you chose it).
   - `bounds.size`: appropriate to the chosen scene units and framing; the normalized subject default is not a universal world scale.
   - `objects`: face counts sane, materials assigned to the evaluated faces (not only present in a slot), any missing scan normal map understood as intentional or an actual lost-detail defect.
   - `lights` and `world`: the rig you chose, energies in proportion to `ratio`.
   - `framing.extent` and `cropped`: check the intended shot size and any accidental loss of important features; retain warnings for intentional crops with a reason.
   - `warnings`: empty, or each one understood and accepted in `prompt.md`.
2. **Pictures.** `--review` adds `<shot>/review.png`: six views (front, three-quarter, side, back, other side, above), three columns, each framed to the subject. Read it. Then Read the shot's own frames at the moments that matter (first, the beat, last).
3. **Diagnose, then fix.** Name the single worst problem and its cause before changing anything: shape (`frameforge-3d-modeling`), material (`frameforge-3d-materials`), light (`frameforge-3d-lighting`) or camera and motion (`frameforge-3d-animation`).
4. **Focused revision.** Isolate one variable when diagnosing a technical cause. When the evidenced craft problem requires coordinated model, camera or lighting changes, state that decision and compare the same representative event before and after. Keep a short log in `prompt.md` (what changed, what improved). Revert a change that did not help.
5. **Record separate results.** Report technical checks and observed craft separately. Inspect every angle actually used by the film and its consequential sequence; a six-view model sheet or clean diagnostics cannot establish a finished scene, creative acceptance or playback quality.

## Quality bar

- Professional at a glance: a clear subject, shaped light with a shadow side and edge, materials that read as intended, purposeful framing, no unintended CG artefacts (sawtooth refraction, faceting, z-fighting stripes, fireflies, dither grain).
- Holds from every angle the camera visits.
- Matches the film: background hex, palette, motion family.

## Constraints

- Do not commit `inspect.json`, review sheets or renders (they live under `public/assets/generated/`).
- Describe failures plainly in the report (what is not verified, what fell back); do not call a shot done from the numbers alone.
