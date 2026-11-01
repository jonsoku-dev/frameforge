---
name: frameforge-3d-modeling
description: "Choose and shape the subject of a Frameforge Blender shot (3d.json): the CC0 scanned head, builtin subjects, Poly Haven models, a script subject, and the ordered subject.ops pipeline (bevel, subdivide, remesh, smooth, inflate, displace). Use when a 3D subject looks lumpy, faceted, mannequin-like, too small or cropped, or when a brief needs a shape the builtins do not have."
---

# Frameforge 3D modeling

The subject is the first thing a viewer judges. Judge silhouette and construction together with the intended material, light and shot: surface polish cannot repair a pose that fails to communicate. Field reference: `docs/reference/three-d.md`. Rendering basics: `frameforge-3d`.

## When to use

- A shot needs a hero object and you are deciding what it is made from.
- A render shows faceting, blobby forms, stair-stepped edges, a plastic "mannequin" face, or a subject cut off by the frame.
- An imported model arrives at the wrong size, off centre or lying on its side.

## Steps

1. **Inspect before you add.** For the spec route run `npm run blender -- <3d.json> --inspect --shot <name>`. For a separate authored scene, inspect its actual geometry, camera and saved output; these spec commands do not apply automatically. Read `source` (scan, builtin, glb, script, primitive), `bounds.size`, `objects[].faces`, `normalMap`, and `framing`. Use those values to diagnose technical problems; inspect the actual picture to judge shape and staging.
2. **Choose a source for the intended subject, without a mandatory order.**
   - A head: `subject: {kind: builtin, builtin: head}` is the CC0 scanned bust, fetched once by `blender.py` (pinned in `scripts/assets/scans/models.lock.json`) and shared by every film. Offline, or with `scan: false`, the sculpted head renders instead; the manifest's `subject` says which one you got. Write the fallback in `prompt.md` when it happens.
   - Another builtin (`bottle`, `gem`, `knot`, `plush`) when it fits the brief.
   - A Poly Haven model through `models.json` when the brief names a real object. Imports are normalised (largest side 2 × `scale`, centred on the origin); correct unintended import orientation with `subject.rotation` before composing the camera.
   - `kind: script` for an authored shape, expression or arrangement that serves the shot. The script returns its objects; keep it a pure function of the shot (no randomness without a fixed seed).
3. **Shape with ops, in order.** `subject.ops` is an ordered list applied to the body, then baked once. Order matters; the usual organic order is: give it enough geometry (`subdivide` or `remesh`), even it out (`smooth`), give it mass (`inflate`), add surface life last (`displace`). Hard surfaces want `bevel` first so edges catch light. Sizes are scene units whatever the model's own scale.
4. **Frame it.** Leave `camera.radius` out and the camera is solved from the subject's bounds so it fills `camera.fill` (0.9) of the frame at the widest moment of the move; `elevation` sets the camera's angle above the target. An explicit radius is fine. Inspect any crop against its purpose: avoid accidental loss of important features, but a deliberate close-up or foreground crop may be part of the composition; record it with the actual warning.

## Quality bar

- Silhouette and important features read at delivery size. Distinguish unintended faceting from deliberate planar or sharp geometry; soften edges where the material and scale require it.
- A face has coherent construction and expressive gaze for its style. Realistic anatomy is not a requirement for a stylized mascot. Preserve a scan's normal map when its detail is needed.
- Choose subject size and crop for the information hierarchy; keep the important action visible. No fixed screen-fill ratio establishes a good composition.
- Face counts stay under about 3 M (the inspect report warns).

## Self-review loop

Render one frame (`--frames 0`), Read the PNG, name the dominant problem, choose a focused correction (coordinating shape and staging when necessary), render again and compare. If a change does not improve the observed weakness, reassess its cause or the direction; an iteration count is not evidence that the shot is finished. Inspect the angles actually used in the film. The spec route offers `--review`; an authored scene needs equivalent authorized saved-frame evidence or an explicit NOT VERIFIED result.

## Constraints

- Remesh and heavy displacement destroy UVs: a scan's normal map no longer lines up after them. Shape scans with `smooth` and `inflate` only, or accept losing the map.
- Do not commit fetched models or renders; commit specs and locks.
- Repository sample brands are fictional. For user projects, follow the requested subject and authorized asset rights without implying official endorsement.
