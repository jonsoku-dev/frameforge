---
name: frameforge-3d
description: Add rendered 3D to a Frameforge film: a 3d.json shot spec rendered by headless Blender into a PNG sequence that <ImageSequence> plays (builtin sculpted hero subjects, premium looks such as glossy, glass, chrome, scanline with a scanline-to-glossy sweep, bloom, depth of field, eased orbit, push-in and crane moves), CC0 models and HDRIs fetched from Poly Haven with models.json, and <Model>/<Turntable>/<StudioLights> inside <ThreeCanvas>. Use when a brief asks for a 3D hero, a lit or glossy subject, a product turntable, a dolly or orbit shot, or a real model instead of a spinning primitive.
---

# Frameforge 3D

Everything is a spec file next to the Spot plus an idempotent script, like `assets.json` → `npm run art` and `audio.json` → `npm run score`. No live socket, no server. Full reference: `docs/reference/three-d.md`.

## A 3D hero is a Blender shot by default

A film whose hero is a 3D subject (a head, a product, a gem, a knot, a mascot) renders it with Blender: `3d.json` with `subject.kind: "builtin"` or a Poly Haven model, a `look`, a moving camera, and `<ImageSequence>` in the Spot. The raymarched `<Shader>` presets (`sliced`, `planet`, `sun`, `orbits`) are backgrounds, textures and the fallback when Blender is absent, never the hero when Blender is there: next to a lit render they read as tech demos.

Pick in this order:
1. A builtin hero, offline and instant: `head` (a sculpted bust with lids, irises, lips, carved hair, on a turned socle), `bottle` (a serum bottle with a gold cap), `gem` (a round brilliant), `knot` (a twisted (2, 3) torus knot with a rounded-triangle profile), `plush` (a soft round mascot with ears and gloss-black eyes).
2. A Poly Haven CC0 model through `models.json` when the brief names a real object (`marble_bust_01` is a scanned classical bust, `horse_statue_01` a porcelain horse, `rubber_duck_toy`, `vintage_pocket_watch`), as `"subject": {"kind": "glb", "src": "models/<name>/<name>.gltf"}`. A `look` overrides its materials; leave `look` out to keep its scanned textures.
3. `subject.kind: "script"` for a shape neither has.

Then a `look` and a camera move:

```json
{"name": "reveal", "frames": 90, "fps": 30, "width": 1920, "height": 1080, "samples": 32,
 "camera": {"preset": "orbit", "from": -40, "to": 28, "ease": "inout", "radius": 9, "radiusTo": 7.4, "height": 1.6, "heightTo": 0.8, "target": 0.3, "fov": 30},
 "subject": {"kind": "builtin", "builtin": "head"},
 "look": "scanline", "sweep": {"to": "glossy", "from": 18, "until": 72},
 "material": {"base": "#D8D0C4", "accent": "#7FE8FF", "scroll": 0.04}, "dof": 4, "background": "#05060A"}
```

| `look` | What it is | Reads from `material` |
| --- | --- | --- |
| `glossy` | clear-coated lacquer, soft studio reflections | `base` |
| `glass` | clear transmission with raytraced refraction (EEVEE has no dispersion) | `base` tint, `ior` (1.45; a gem 2.4) |
| `chrome` | mirror metal reflecting the studio room | `base` tint |
| `plush` | sheen fuzz over a soft matte, fine noise bump | `base` |
| `toon` | three flat light bands, a hard highlight, an ink outline (EEVEE only) | `base` |
| `scanline` | horizontal emissive slices over a near-black body, brighter where the key light falls | `accent`, `lines` (per unit, 36), `width` (0.16), `glow` (5), `scroll` (lines per frame) |
| `wireframe` | an even emissive lattice on a remeshed copy over a dark body | `accent`, `glow` |
| `holographic` | thin-film iridescence on black lacquer with a rainbow fresnel rim | `base`, `glow` |

- `sweep: {to, from, until}` wipes the shot's `look` into `to`, bottom to top, between those frames, with a bright seam in `accent` on the boundary. The classic: `scanline` to `glossy`.
- `bloom` (default 0.5 with a look, 0 without): compositor glare on pixels brighter than white, so scan lines, seams and highlights glow while the background away from them keeps its hex (exact at the corner of a 1080p frame). Use opaque backgrounds with bloom; a transparent film loses the halo outside the subject.
- `dof`: f-stop (e.g. 4); focus follows the look-at point. Motion blur is not offered: the camera is posed per frame with no animation data, so EEVEE's shutter would see no motion; add `<CameraMotionBlur>` in the film instead.
- Camera: `ease` (`linear`, `inout`, `out`) shapes orbit, dolly and the moves; `radiusTo` pushes in, `heightTo` cranes, `target` is the height the camera looks at (a head: 0.3). All three combine with any preset.
- With a look and no HDRI, the lighting is a hero rig (soft key, two strip rims, top) plus Blender's bundled CC0 studio HDRI for reflections; `light.hdri` also takes a bundled name: `studio`, `city`, `courtyard`, `forest`, `interior`, `night`, `sunrise`, `sunset`, and `light.rotate` turns it (degrees).
- Speed (Apple M-series Mac, EEVEE, 32 samples, 1080p): about 0.9 s per frame for the head with a sweep, depth of field and bloom, after a one-off 15–20 s to sculpt the head at `detail` 300 (2–3 s for the other builtins); a 90-frame hero shot took 103 s. Render at 960x540 and let `<ImageSequence fit="cover">` scale it only for soft looks (glossy, plush, toon, chrome): it renders at about 0.4 s per frame, roughly half the time, but scan lines and wireframes go soft and shimmer when scaled up, so keep those at 1080p.

## When to use 3D

- A hero subject, a product or object that should turn, be lit like a studio shot, or be seen from a moving camera: render it with Blender and play the PNGs. The film stays a pure frame function; the pictures are files.
- A scene needs a real model turning live with the frame (a vase behind a title): `<Model>` inside `<ThreeCanvas>`.
- A flat motif or kit asset already says it: do not use 3D. Three motion families per film still apply; a rendered shot counts as one.

## The loop: spec → render → play

1. Write `examples/samples/<slug>/3d.json` (copy `examples/samples/turntable-spot/3d.json`). One entry per shot:
   `name`, `frames`, `fps`, `width`, `height`, `engine` (`eevee` for seconds per shot, `cycles` for minutes), `samples`, `seed`,
   `camera` {`preset`: `turntable` | `orbit` | `dolly` | `static`, `radius`, `height`, `fov` (horizontal, degrees), `from`, `to`},
   `subject` {`kind`: `builtin` | `primitive` | `glb` | `script`, `builtin`: `head` | `bottle` | `gem` | `knot` | `plush`, `detail` (voxels, 64–512, default 256), `primitive`: `cube` | `sphere` | `torus` | `monkey` | `cylinder`, `src`, `script`, `scale`, `rotation` (degrees)},
   `look`, `sweep`, `bloom`, `dof` (above),
   `material` {`base` #rrggbb, `metallic`, `roughness`, `emission`}, `light` {`preset`: `studio` | `sunset` | `hdri`, `hdri`, `strength`},
   `background` (#rrggbb or `transparent`), `shadowCatcher`.
   Hex colours come out as written (Standard view transform). A primitive is 2 units across; a glTF is normalised to 2 × `scale`.
   Frame the subject with `radius` and `fov`: at radius 13 and fov 40 a 2.3-unit torus fills about 58 % of the frame height.
2. Quick look: `npm run blender -- examples/samples/<slug>/3d.json --frames 0-1`, then Read `public/assets/generated/<slug>/3d/<shot>/0000.png`. Adjust the spec, repeat (`--force` when only the renderer changed).
3. Full render: `npm run blender -- examples/samples/<slug>/3d.json` (EEVEE 1080p: about one second per frame; a 150-frame hero in 2–3 minutes, speed details above). The folder gets `manifest.json` (`frames`, `fps`, `width`, `height`, `specHash`, `blender`, `seconds`). A second run with the same spec skips.
4. Play it: `<Sequence from={at} layout="none"><ImageSequence src="/assets/generated/<slug>/3d/<shot>" frames={150} fps={30} /></Sequence>`. Pass `frames` and `fps` from the manifest; the render never fetches it. Past the end the last image holds (`loop` wraps). A transparent shot composites over the film's paper colour; put kit motifs and glyph titles around it as in any scene.
5. Hold the last two seconds: an `<ImageSequence>` holds by itself; a `<Turntable>` keeps turning, so wrap that scene in `<Freeze frame={hold - 1} active={frame >= hold}>`.

Determinism: one Blender process per shot, factory settings, camera, sweep level and scan-line scroll set per frame by pure functions, builtin meshes built from fixed fields with no randomness, fixed samples and seed, no adaptive sampling or denoising, stamps off, so the same spec gives byte-identical PNGs on the same machine (the test proves it). The hex background pixel is asserted by `tests/three-d.test.tsx`.

## CC0 models and HDRIs

1. Write `examples/samples/<slug>/models.json`: `{"slug", "items": [{"name": "vase", "kind": "model" | "hdri" | "texture", "query": "ceramic vase", "id"?: "ceramic_vase_01", "resolution": "1k"}]}`. Poly Haven has no search; the script picks the first catalogue id holding every query word, then name/tags. Give `id` (the last part of the asset's page URL) when you know what you want.
2. `npm run models -- examples/samples/<slug>/models.json` writes `public/assets/generated/<slug>/models/vase/vase.gltf` (plus `.bin` and `textures/`; Poly Haven serves no `.glb`), or `models/<name>.hdr`, and pins the pick in `models.lock.json` next to the spec (id, authors, CC0, every file's url and md5). Commit the lock, never the files. Offline or no match: exit 1 with the item name.
3. Use it: `<Model src="/assets/generated/<slug>/models/vase/vase.gltf" scale={6} />` inside `<ThreeCanvas>` (with `<StudioLights />` and `<Turntable speed={0.12}>`), or in 3d.json as `"subject": {"kind": "glb", "src": "models/vase/vase.gltf"}` and `"light": {"preset": "hdri", "hdri": "models/sky.hdr"}`.

Poly Haven is CC0, so no credit line is needed; `CREDITS.md` appears only if another licence ever enters the lock.

## What to put in prompt.md

- Which scenes are Blender shots (shot name, frames, engine, samples, seconds it took) and which are live `<ThreeCanvas>`.
- The Poly Haven ids used and that they are CC0; the fallback you took if a download failed (a primitive in place of the model, said plainly).
- The render command and the quick-look frames you looked at; the check frames must land inside every `<ImageSequence>` scene.
- What was not verified (a full render, a GPU other than this one).

## When Blender is absent

`npm run blender` stops with `Blender not found: install Blender 4.2+ or set BLENDER_PATH`. Then:
- If the PNGs already exist (a teammate rendered them, or the spec is unchanged), nothing is needed; the renderer only reads files.
- Otherwise swap the shot for `<ThreeCanvas>` with a `<Model>` (a Poly Haven model) and `<StudioLights>` (see `examples/samples/three-spin/Spot.tsx`), or, for a head, planet or star with no model at all, the `<Shader>` presets `sliced`, `planet`, `sun` (`docs/reference/generative.md`). Keep 3d.json in place so the shot can be rendered later, and write the substitution in `prompt.md` and your report. Do not fake the sequence with a still.

## Checks

`python3 scripts/assets/blender.py --self-check`, `python3 scripts/assets/models.py --self-check`, `npx tsx --test tests/three-d.test.tsx`, then the usual contact sheet (`FRAMEFORGE_PORT=<port> npm run render -- <entry.tsx> <Id> <sheet.png> --frames …`), `npx tsc --noEmit`, `npm test`, `npm run lint:video -- <entry.tsx>`.
