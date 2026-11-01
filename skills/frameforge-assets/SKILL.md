---
name: frameforge-assets
description: Draw, resolve or review visual assets for a Frameforge film: the parametric motif kit, assets.json resolution (host image skill, CC0 SVG, kit), asset sheets and the quality bar. Use when assets look weak or a film needs icons, heroes, landmarks, characters.
---

# Assets

Use this skill for motion graphics as well as explainers, process and data films. Read `../frameforge-best-practices/references/assets.md`. Select authored vector, licensed raster, local 3D, procedural media or a kit component according to the brief and actual tools. There is no mandatory kit-first order or shape-count target. For motion graphics, inspect the hero in its representative shot as described in `../frameforge-motion/references/visual-development.md`: silhouette, expressive pose, material, light, typography and spatial relationships at delivery size. Preserve authorized user assets and record sources, rights and substitutions. Review the actual asset and composition before extending animation.

Use host image/vector generation only when available and authorized; configuring `FRAMEFORGE_IMAGE_COMMAND` can invoke an external command and is not permission for a new service or cost. The resolver's `host` provider can read an already authorized local asset. Check output ownership and project boundaries before generating; do not overwrite another film's files.

For lit 3D, read `../frameforge-3d/SKILL.md`; use an appropriate authored or licensed model and inspect its actual finish. Shader presets can be useful when they serve the concept, not as proof of visual quality; uniforms are in `docs/reference/generative.md`. Keep frame evaluation deterministic regardless of medium.
