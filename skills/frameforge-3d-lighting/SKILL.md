---
name: frameforge-3d-lighting
description: Light Frameforge Blender shots like a studio: light presets (three-point, product, rim, studio, sunset, hdri), key:fill:rim ratios by what the subject is made of (light.ratio), the procedural soft-box world and its rotation and tint, bloom and exposure choices. Use when a 3D render looks flat, washed out, too dark, has no separation from the background, or glass loses its tint.
---

# Frameforge 3D lighting

Light gives the shape and the material their read. Fix shape and material first; then change light one variable at a time. Field reference: `docs/reference/three-d.md`.

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

- A visible light side, shadow side and edge on every hero subject; the subject separates from the background along its whole silhouette.
- Highlights are shaped (a soft box, a strip), not a single clipped blob; bloom stays a halo, not a fog.
- Glass shows tint and edge lines at the same time; skin, stone and clay keep detail in the shadow side.

## Self-review loop

Render one frame, Read the PNG, judge light side, shadow side and edge separately, change one thing (preset, one ratio number, rotate, strength, bloom), render again. Look at the `--review` sheet too: a rig that flatters the front can leave the back black during an orbit.

## Constraints

- Lights aim at the camera target; the subject is normalised to about 2–2.4 units, so energies are tuned for that size. Scale the subject, not the energies.
- Keep the background hex exact with `view: standard`; light changes never change the background.
