---
name: frameforge-3d-lighting
description: "Light Frameforge Blender shots like a studio: light presets (three-point, product, rim, studio, sunset, hdri), key:fill:rim ratios by what the subject is made of (light.ratio), the procedural soft-box world and its rotation and tint, bloom and exposure choices. Use when a 3D render looks flat, washed out, too dark, has no separation from the background, or glass loses its tint."
---

# Frameforge 3D lighting

Light gives the shape and the material their read. Inspect shape, material and lighting together. Isolate a variable to diagnose a technical cause; make a documented coordinated change when the observed picture requires it. Field reference: `docs/reference/three-d.md`.

## When to use

- The subject looks flat (no shadow side), blown out (big white patches), muddy, or merges with a dark background.
- Glass or liquid looks washed out; metal looks dull.

## Steps

1. Inspect: `--inspect` lists `lights` (name, energy, position), `world` (softbox, hdri, flat), `class` and `ratio`.
2. Pick the preset by subject:
   - `three-point`: faces, busts, characters, mascots. A soft key front-left, a broad fill, a rim behind.
   - `product`: bottles, gems, devices. A top box, two tall strips behind the sides (the edge lines glass and gloss need), a low front fill.
   - `rim`: dramatic dark shots and silhouettes. Strong strips behind, a weak key.
   - `studio` (default) keeps the older hero rig; `hdri` lights from a Poly Haven HDRI or a bundled studio light.
3. Ratios: the rig scales key, fill and rim by the subject's class: organic 1 : 0.3 : 0.6 (the fill stays low so the form models), hard 1 : 0.45 : 0.9, metal 0.7 : 0.7 : 1, glass 0.5 : 0.6 : 0.45 (more fill and a softer rim, because a strong rim washes the tint out of glass and liquid). Override with `light.ratio: [key, fill, rim]` only when the render says so.
4. The world: shots with a look or a rig are lit and reflected by the soft-box studio. `light.rotate` turns it (move a reflection off a face), `light.environment` (#rrggbb) tints it. The camera still sees `background`.
5. Overall level: `light.strength` scales everything. Prefer lowering strength or `bloom`, or switching `view` to `agx`, over removing a light.

## Quality bar

- The intended subject and action read through chosen light, contrast or silhouette. Full edge separation and a three-point look are options, not requirements for every scene.
- For a shaped studio look, inspect reflection shapes and unwanted highlight clipping. Deliberate glow or stylized light may differ; it must still serve the subject and information.
- Check the material cues the shot needs (for example glass tint and edges, or clay detail in shadow) instead of requiring every surface to share one lighting treatment.

## Self-review loop

Render one frame, Read the PNG, judge light side, shadow side and edge separately, change one thing (preset, one ratio number, rotate, strength, bloom), render again. Inspect the actual used camera angles too; the spec route offers `--review`, while a separately authored scene needs its own saved-frame evidence.

## Constraints

- The bundled rig energies are tuned for its normalized 2–2.4-unit subjects. A custom world scale may require different light placement and energy; judge its output.
- Use `view: standard` when exact background hex is required. Choose color management for the shot otherwise; preserve any reported mismatch.
