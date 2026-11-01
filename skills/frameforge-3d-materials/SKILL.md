---
name: frameforge-3d-materials
description: "Make Frameforge Blender shots read as real materials: looks (glossy, glass, chrome, plush, toon, scanline, wireframe, holographic), clear and tinted glass (IOR, absorption, frost, hollow walls, liquid), measured PBR values, keeping a scan's normal map, and colour management (view standard, agx, neutral). Use when glass reads as grey plastic, metal looks flat, a surface looks like CG, or colours shift."
---

# Frameforge 3D materials

A material only reads against something to reflect and refract. With a `look` and no HDRI, every shot gets the procedural soft-box studio (a dark room with a key box, a top box, two tall strips behind, a fill and a low glow behind the subject). Judge shape, material and light together (`frameforge-3d-modeling`); isolate a variable to diagnose a cause, and coordinate changes when the observed shot requires it. Field reference: `docs/reference/three-d.md`.

## When to use

- Glass looks grey, black or milky; liquid is invisible; a gem looks like dark plastic.
- Gloss looks like wet plastic, metal like grey paint, a scan lost its carved detail.
- Highlights clip to white, or the background hex shifts.

## Steps

1. For the spec route, `--inspect` shows `look`, `class` (organic, hard, metal, glass), `objects[].materials`, `normalMap`, `view`. A separately authored scene needs its own actual mesh/material diagnostics or an explicit NOT VERIFIED result.
2. Choose the look from what the object is, not from what looks flashy: lacquer and ceramic → `glossy`; polished metal → `chrome`; fabric and toys → `plush`; transparent objects → `glass`. Stylised looks (`scanline`, `wireframe`, `toon`, `holographic`) can define the finished visual language or a transition; `sweep` is an optional change of state, not a requirement to finish realistically.
3. Glass:
   - Use measured values: `material.ior` 1.45–1.52 for glass, 1.33 for water (the liquid uses it), about 2.4 for a diamond. `frost` 0 for clear, 0.1–0.3 for frosted.
   - Colour comes from `material.absorption` (#rrggbb) and `density`, not from the base colour: thick parts get darker, thin edges stay clear.
   - The builtin bottle is a hollow shell; `subject.liquid {fill, colour}` fills it.
   - Engine: render glass heroes, gems and filled bottles with `engine: cycles` (with `denoise: true` and 128–256 samples for stills). EEVEE refracts one layer; it shows a bottle's wall as see-through with reflections and its liquid flatter. Use EEVEE glass for previews and motion where speed matters.
4. Scans: a look keeps the model's normal map; check `normalMap: true` in the inspect report. Base colour comes from `material.base`.
5. Colour management with `view`: `standard` (default) keeps hex colours exact, so use it when the background must match the film; `agx` rolls bright highlights off softly (white ceramic, chrome, bloom-heavy shots); `neutral` keeps product colours closer to the hex with a gentler roll-off. The inspect report warns when a non-standard view shifts the background.

## Quality bar

For a physical studio look, the following are useful diagnostic starting points, not universal rules for stylized, emissive or deliberately graphic scenes. Judge the intended material and important information in the actual saved output.

- Glass shows the room through it and bright edge lines from the strips; liquid has a visible meniscus line and colour that deepens with thickness.
- Metal shows soft-box reflections, not grey; gloss has one clear highlight shape, not a blown-out patch.
- No pure white areas larger than a highlight; nothing important clips (switch to `agx` or lower `bloom` before lowering light).
- Values are physical: base colours between about 30 and 240 in sRGB, metals metallic 1, dielectrics 0.

Before adjusting light to explain a missing material, verify the evaluated mesh actually uses it. A named material in the scene or a populated slot is insufficient: after conversion/boolean operations check each relevant polygon's material index against the intended non-empty material slot, then confirm the appearance on the saved output. In a separate authored scene, record that diagnostic yourself; the bundled spec inspection does not cover it automatically.

For a custom Blender scene, inspect the used face assignments after modifiers/conversion (adapt to the relevant mesh, not every unrelated object):

```python
from collections import Counter
used = Counter(face.material_index for face in mesh.polygons)
for index, face_count in used.items():
    material = mesh.materials[index] if index < len(mesh.materials) else None
    print(index, face_count, material.name if material else "UNASSIGNED")
```

Compare those names with the intended surface regions; a non-empty but wrong material also needs correction. Then render the actual shot to judge its appearance.

## Self-review loop

Render, Read the PNG, change one variable (IOR, absorption, frost, view, look), render again. Use `frameforge-3d-lighting` when the reflection environment is the cause. Isolate variables for diagnosis, but allow a documented coordinated material/light change when the intended appearance requires it. For glass compare an EEVEE preview with one Cycles frame before you commit to an engine.

## Constraints

- Use authored procedural textures or authorized licensed sources; Poly Haven (CC0) through `models.json` is one option. Record origin and rights. Do not purchase assets, invoke paid services or introduce credentials without applicable user authorization.
- `toon` is EEVEE only. Ray tracing is off when `toon` or `scanline` is in the shot.
