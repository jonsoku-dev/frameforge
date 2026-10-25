---
name: frameforge-3d-review
description: Review and fix Frameforge Blender shots with numbers first and pictures second: --inspect (scene, objects, bounds, lights, framing, warnings), --review (a six-angle review sheet PNG), the diagnose-then-fix loop that changes one variable per render, and the quality gate before a shot goes into a film. Use before calling any 3D shot done, or when a render looks wrong and the cause is unclear.
---

# Frameforge 3D review

Judge 3D in two passes: numbers that a model cannot misread, then pictures you actually look at. Pictures alone get judged too kindly. Field reference: `docs/reference/three-d.md`.

## When to use

- Before a Blender shot goes into a film, and after every significant change to it.
- When a render looks wrong and you do not know whether shape, material, light or camera is the cause.

## Steps

1. **Numbers.** `npm run blender -- <3d.json> --inspect --shot <name>` writes and prints `<shot>/inspect.json`. Check, in order:
   - `source`: the subject you meant (scan, not the sculpted fallback, unless you chose it).
   - `bounds.size`: about 2–2.4 units; nothing tiny or huge.
   - `objects`: face counts sane, materials assigned, `normalMap` true for scans.
   - `lights` and `world`: the rig you chose, energies in proportion to `ratio`.
   - `framing.extent` between about 0.5 and 0.95; `cropped` false.
   - `warnings`: empty, or each one understood and accepted in `prompt.md`.
2. **Pictures.** `--review` adds `<shot>/review.png`: six views (front, three-quarter, side, back, other side, above), three columns, each framed to the subject. Read it. Then Read the shot's own frames at the moments that matter (first, the beat, last).
3. **Diagnose, then fix.** Name the single worst problem and its cause before changing anything: shape (`frameforge-3d-modeling`), material (`frameforge-3d-materials`), light (`frameforge-3d-lighting`) or camera and motion (`frameforge-3d-animation`).
4. **One variable per render.** Change one thing, render the same frame, compare with the last render. Keep a short log in `prompt.md` (what changed, what improved). Revert a change that did not help.
5. **Gate.** The shot passes when the numbers are clean, every review view is acceptable, and the frames in the film pass the usual checks (`frameforge-check`).

## Quality bar

- Professional at a glance: a clear subject, shaped light with a shadow side and edge, materials that read as what they are, no crop, no CG artefacts (sawtooth refraction, faceting, z-fighting stripes, fireflies, dither grain).
- Holds from every angle the camera visits.
- Matches the film: background hex, palette, motion family.

## Constraints

- Do not commit `inspect.json`, review sheets or renders (they live under `public/assets/generated/`).
- Describe failures plainly in the report (what is not verified, what fell back); do not call a shot done from the numbers alone.
