---
name: frameforge-3d-modeling
description: Choose and shape the subject of a Frameforge Blender shot (3d.json): the CC0 scanned head, builtin subjects, Poly Haven models, a script subject, and the ordered subject.ops pipeline (bevel, subdivide, remesh, smooth, inflate, displace). Use when a 3D subject looks lumpy, faceted, mannequin-like, too small or cropped, or when a brief needs a shape the builtins do not have.
---

# Frameforge 3D modeling

The subject is the first thing a viewer judges. Get it right before materials or light: a good material on a bad shape still reads as a bad shape. Field reference: `docs/reference/three-d.md`. Rendering basics: `frameforge-3d`.

## When to use

- A shot needs a hero object and you are deciding what it is made from.
- A render shows faceting, blobby forms, stair-stepped edges, a plastic "mannequin" face, or a subject cut off by the frame.
- An imported model arrives at the wrong size, off centre or lying on its side.

## Steps

1. **Inspect before you add.** Run `npm run blender -- <3d.json> --inspect --shot <name>`. Read `source` (scan, builtin, glb, script, primitive), `bounds.size`, `objects[].faces`, `normalMap`, and `framing`. Decide from numbers what is wrong before touching the spec.
2. **Pick the source, in this order.**
   - A head: `subject: {kind: builtin, builtin: head}` is the CC0 scanned bust, fetched once by `blender.py` (pinned in `scripts/assets/scans/models.lock.json`) and shared by every film. Offline, or with `scan: false`, the sculpted head renders instead; the manifest's `subject` says which one you got. Write the fallback in `prompt.md` when it happens.
   - Another builtin (`bottle`, `gem`, `knot`, `plush`) when it fits the brief.
   - A Poly Haven model through `models.json` when the brief names a real object. Imports are normalised (largest side 2 × `scale`, centred on the origin); fix orientation with `subject.rotation`, never by moving the camera around a tilted model.
   - `kind: script` only for a shape nothing else has. The script returns its objects; keep it a pure function of the shot (no randomness without a fixed seed).
3. **Shape with ops, in order.** `subject.ops` is an ordered list applied to the body, then baked once. Order matters; the usual organic order is: give it enough geometry (`subdivide` or `remesh`), even it out (`smooth`), give it mass (`inflate`), add surface life last (`displace`). Hard surfaces want `bevel` first so edges catch light. Sizes are scene units whatever the model's own scale.
4. **Frame it.** Leave `camera.radius` out and the camera is solved from the subject's bounds so it fills `camera.fill` (0.9) of the frame at the widest moment of the move; `elevation` sets the camera's angle above the target. An explicit radius is fine, but then `--inspect` must report `cropped: false`.

## Quality bar

- Silhouette reads at thumbnail size; no facet steps on curved surfaces; edges are softened (a bevel or doubled profile points), never razor-sharp CG edges.
- A head has a hairline that grows out of the skin, eyes set in sockets, and a neck that meets shoulders; a scan keeps its normal map under every look (`normalMap: true`).
- Nothing important leaves the frame. Subject fills roughly 60–90 % of the frame's shorter side unless the brief says otherwise.
- Face counts stay under about 3 M (the inspect report warns).

## Self-review loop

Render one frame (`--frames 0`), Read the PNG, name the single worst problem, change one variable (one op, one parameter, the source), render again, compare. Stop when two consecutive changes no longer improve it. Run `--review` before calling the subject done: a shape that only works from one angle fails as soon as the camera moves.

## Constraints

- Remesh and heavy displacement destroy UVs: a scan's normal map no longer lines up after them. Shape scans with `smooth` and `inflate` only, or accept losing the map.
- Do not commit fetched models or renders; commit specs and locks.
- Examples in briefs and prompts stay invented and generic (a "ceramic cup", a "serum bottle"); no real brands.
