---
name: frameforge-3d-materials
description: Make Frameforge Blender shots read as real materials: looks (glossy, glass, chrome, plush, toon, scanline, wireframe, holographic), clear and tinted glass (IOR, absorption, frost, hollow walls, liquid), measured PBR values, keeping a scan's normal map, and colour management (view standard, agx, neutral). Use when glass reads as grey plastic, metal looks flat, a surface looks like CG, or colours shift.
---

# Frameforge 3D materials

A material only reads against something to reflect and refract. With a `look` and no HDRI, every shot gets the procedural soft-box studio (a dark room with a key box, a top box, two tall strips behind, a fill and a low glow behind the subject). Change the material only after the shape is right (`frameforge-3d-modeling`). Field reference: `docs/reference/three-d.md`.

## When to use

- Glass looks grey, black or milky; liquid is invisible; a gem looks like dark plastic.
- Gloss looks like wet plastic, metal like grey paint, a scan lost its carved detail.
- Highlights clip to white, or the background hex shifts.

## Steps

1. Inspect: `--inspect` shows `look`, `class` (organic, hard, metal, glass), `objects[].materials`, `normalMap`, `view`.
2. Choose the look from what the object is, not from what looks flashy: lacquer and ceramic → `glossy`; polished metal → `chrome`; fabric and toys → `plush`; transparent objects → `glass`. Stylised looks (`scanline`, `wireframe`, `toon`, `holographic`) are for reveals and transitions, usually swept into a real look with `sweep`.
3. Glass:
   - Use measured values: `material.ior` 1.45–1.52 for glass, 1.33 for water (the liquid uses it), about 2.4 for a diamond. `frost` 0 for clear, 0.1–0.3 for frosted.
   - Colour comes from `material.absorption` (#rrggbb) and `density`, not from the base colour: thick parts get darker, thin edges stay clear.
   - The builtin bottle is a hollow shell; `subject.liquid {fill, colour}` fills it.
   - Engine: render glass heroes, gems and filled bottles with `engine: cycles` (with `denoise: true` and 128–256 samples for stills). EEVEE refracts one layer; it shows a bottle's wall as see-through with reflections and its liquid flatter. Use EEVEE glass for previews and motion where speed matters.
4. Scans: a look keeps the model's normal map; check `normalMap: true` in the inspect report. Base colour comes from `material.base`.
5. Colour management with `view`: `standard` (default) keeps hex colours exact, so use it when the background must match the film; `agx` rolls bright highlights off softly (white ceramic, chrome, bloom-heavy shots); `neutral` keeps product colours closer to the hex with a gentler roll-off. The inspect report warns when a non-standard view shifts the background.

## Quality bar

- Glass shows the room through it and bright edge lines from the strips; liquid has a visible meniscus line and colour that deepens with thickness.
- Metal shows soft-box reflections, not grey; gloss has one clear highlight shape, not a blown-out patch.
- No pure white areas larger than a highlight; nothing important clips (switch to `agx` or lower `bloom` before lowering light).
- Values are physical: base colours between about 30 and 240 in sRGB, metals metallic 1, dielectrics 0.

## Self-review loop

Render, Read the PNG, change one variable (IOR, absorption, frost, view, look), render again. Change lighting only in `frameforge-3d-lighting`, never in the same step. For glass compare an EEVEE preview with one Cycles frame before you commit to an engine.

## Constraints

- No paid or keyed material libraries. Textures come from Poly Haven (CC0) through `models.json`.
- `toon` is EEVEE only. Ray tracing is off when `toon` or `scanline` is in the shot.
