---
name: frameforge-3d
description: Add rendered 3D to a Frameforge film: a 3d.json shot spec rendered by headless Blender into a PNG sequence that <ImageSequence> plays, CC0 models and HDRIs fetched from Poly Haven with models.json, and <Model>/<Turntable>/<StudioLights> inside <ThreeCanvas>. Use when a brief asks for a product turntable, a 3D hero, a dolly or orbit shot, or a real model instead of a spinning primitive.
---

# Frameforge 3D

Everything is a spec file next to the Spot plus an idempotent script, like `assets.json` → `npm run art` and `audio.json` → `npm run score`. No live socket, no server. Full reference: `docs/reference/three-d.md`.

## When to use 3D

- A product or object should turn, be lit like a studio shot, or be seen from a moving camera: render it with Blender and play the PNGs. The film stays a pure frame function; the pictures are files.
- A scene needs a real model turning live with the frame (a vase behind a title): `<Model>` inside `<ThreeCanvas>`.
- A flat motif or kit asset already says it: do not use 3D. Three motion families per film still apply; a rendered shot counts as one.

## The loop: spec → render → play

1. Write `examples/samples/<slug>/3d.json` (copy `examples/samples/turntable-spot/3d.json`). One entry per shot:
   `name`, `frames`, `fps`, `width`, `height`, `engine` (`eevee` for seconds per shot, `cycles` for minutes), `samples`, `seed`,
   `camera` {`preset`: `turntable` | `orbit` | `dolly` | `static`, `radius`, `height`, `fov` (horizontal, degrees), `from`, `to`},
   `subject` {`kind`: `primitive` | `glb` | `script`, `primitive`: `cube` | `sphere` | `torus` | `monkey` | `cylinder`, `src`, `script`, `scale`, `rotation` (degrees)},
   `material` {`base` #rrggbb, `metallic`, `roughness`, `emission`}, `light` {`preset`: `studio` | `sunset` | `hdri`, `hdri`, `strength`},
   `background` (#rrggbb or `transparent`), `shadowCatcher`.
   Hex colours come out as written (Standard view transform). A primitive is 2 units across; a glTF is normalised to 2 × `scale`.
   Frame the subject with `radius` and `fov`: at radius 13 and fov 40 a 2.3-unit torus fills about 58 % of the frame height.
2. Quick look: `npm run blender -- examples/samples/<slug>/3d.json --frames 0-1`, then Read `public/assets/generated/<slug>/3d/<shot>/0000.png`. Adjust the spec, repeat (`--force` when only the renderer changed).
3. Full render: `npm run blender -- examples/samples/<slug>/3d.json` (EEVEE 1080p: about one second per frame; a 150-frame hero in 2–3 minutes). The folder gets `manifest.json` (`frames`, `fps`, `width`, `height`, `specHash`, `blender`, `seconds`). A second run with the same spec skips.
4. Play it: `<Sequence from={at} layout="none"><ImageSequence src="/assets/generated/<slug>/3d/<shot>" frames={150} fps={30} /></Sequence>`. Pass `frames` and `fps` from the manifest; the render never fetches it. Past the end the last image holds (`loop` wraps). A transparent shot composites over the film's paper colour; put kit motifs and glyph titles around it as in any scene.
5. Hold the last two seconds: an `<ImageSequence>` holds by itself; a `<Turntable>` keeps turning, so wrap that scene in `<Freeze frame={hold - 1} active={frame >= hold}>`.

Determinism: one Blender process per shot, factory settings, camera posed per frame by a pure function, fixed samples and seed, no adaptive sampling or denoising, stamps off, so the same spec gives byte-identical PNGs on the same machine (the test proves it). The hex background pixel is asserted by `tests/three-d.test.tsx`.

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
- Otherwise swap the shot for `<ThreeCanvas>` with a primitive and `<StudioLights>` (see `examples/samples/three-spin/Spot.tsx`), keep 3d.json in place so the shot can be rendered later, and write the substitution in `prompt.md` and your report. Do not fake the sequence with a still.

## Checks

`python3 scripts/assets/blender.py --self-check`, `python3 scripts/assets/models.py --self-check`, `npx tsx --test tests/three-d.test.tsx`, then the usual contact sheet (`FRAMEFORGE_PORT=<port> npm run render -- <entry.tsx> <Id> <sheet.png> --frames …`), `npx tsc --noEmit`, `npm test`, `npm run lint:video -- <entry.tsx>`.
