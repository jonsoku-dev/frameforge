---
name: frameforge-create
description: Create a new Frameforge film (motion-graphics spot, ad, intro, explainer, reel, ident, caption film): brief, scene table, assets, Spot.tsx, audio.json, registration. Use when the user asks to make a video with Frameforge.
---

# Create a film

1. Repository root = two folders above this file (it holds `package.json` with `"name": "frameforge-local"`). Run `npm install` once if `node_modules` is missing.
2. Pick a slug (kebab-case) and copy `examples/samples/_template/` to `examples/samples/<slug>/`; rename `template.audio.json` to `audio.json` and set `"slug"`.
   Not inside the engine repository: run `frameforge init <dir>` once (or `node <engine>/bin/frameforge.mjs init <dir>`), then `frameforge new <slug>` inside it. That copies the template to `films/<slug>/`, renames the id to the PascalCase slug, and registers it in `films/index.tsx`; use `frameforge score|art|lint|render|studio|check` there instead of the npm scripts, with `films/<slug>` in place of `examples/samples/<slug>`.
3. Write `prompt.md` first: purpose, audience, palette (four colours), two fonts, scene table in absolute frames (rows of 2–5 s, what fills the frame in each), audio cues, check frames. Rules: `docs/samples/rules.md`.
4. Assets: use the kit (`import {Cup, Card, Pin} from '@/assets'`) or `assets.json` + `npm run art -- examples/samples/<slug>/assets.json`. Never an icon library, never ad-hoc shapes for heroes. See `../frameforge-best-practices/references/assets.md`.
5. Write `Spot.tsx` as a pure frame function with motion probes and `MotionSound` maps (`../frameforge-best-practices/references/motion.md`, `sound.md`); `entry.tsx` registers the composition; add one import and one `<Composition>` line to `examples/samples/index.tsx`.
6. Generate sound: `npm run score -- examples/samples/<slug>/audio.json`.
7. Check and render as `frameforge-check` and `frameforge-render` say. Report what you measured and what you did not.
