---
name: frameforge-assets
description: Draw, resolve or review visual assets for a Frameforge film: the parametric motif kit, assets.json resolution (host image skill, CC0 SVG, kit), asset sheets and the quality bar. Use when assets look weak or a film needs icons, heroes, landmarks, characters.
---

# Assets

Read `../frameforge-best-practices/references/assets.md`. Order of preference: kit component → `assets.json` intent resolved by `npm run art` → your own `assets.tsx` that passes the bar (silhouette test, 4–9 shapes, one stroke and radius, 8 px grid, same viewpoint, round caps, palette fills only). If your host has an image or vector generation tool, set `FRAMEFORGE_IMAGE_COMMAND` so the resolver can call it, or place the file yourself under `public/assets/generated/<slug>/<name>.svg` and run `npm run art` (provider `host`). Always render the asset sheet and look at it before animating.
