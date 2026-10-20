---
name: frameforge-studio
description: Open the Frameforge studio to preview compositions with sound, see the production process, tune declared variables and request renders. Use when the user wants to look at or tweak a film.
---

# Studio

From the repository root: `VIDEO_ENTRY=examples/samples/index.tsx npm run dev` then open http://127.0.0.1:4317 (another entry file works too). The rail lists compositions; the stage plays with sound (derived effects included); the inspector shows the brief, the process log (`process.json`), tunable `variables` with overrides, and render jobs. Stop the server when done. Stills without the studio: `npm run render -- <entry.tsx> <Id> <sheet.png> --frames 30,120,240` (set `FRAMEFORGE_PORT` to a free port when another render is running).
