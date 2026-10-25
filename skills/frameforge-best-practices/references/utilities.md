# Utilities (optional appendix)

Utilities you may use when a calm explainer, captions, charts or a data film needs them. They are not the path for a motion-graphics film (`showreel.md`, `bespoke.md`), and none of them is a scene, a palette or a look to reuse: every parameter below is the film's own choice.

| Need | Utility | Reference |
| --- | --- | --- |
| Titles, lower thirds, counters, cards, tickers, charts, code panels, diagrams, maps | `import {...} from '@/blocks'` | `../../frameforge-blocks/SKILL.md` |
| Kinetic blocks (one word per beat on fields, a drawn thread through words, a line on dense text, a whip between scenes, a tile mosaic, a toggle) | `WordBeat`, `Thread`, `TextField`, `WhipPan`, `BauhausMosaic`, `Toggle` from `@/blocks` | `docs/reference/blocks-text.md`; each takes `frame`, `at`, `palette` and the film's own copy |
| Drawn props and icons for an explainer | the motif kit (`import {Cup, Card, Pin} from '@/assets'`) or `assets.json` + `npm run art` | `assets.md` |
| Shader texture presets | `<Shader frag={shaders.<name>}>`: `iris`, `tunnel`, `liquid`, `grainField`, `gradientMesh`, `streaks`, `cubeField`, `planet`, `sun`, `sliced`, `orbits` | `docs/reference/generative.md` |
| Algorithmic backgrounds | `<Generative system="...">` | `../../frameforge-generative/SKILL.md` |
| DOM post effects | `<Glow>`, `<ChromaticShift>`, `<Scanlines>`, `<VhsGlitch>`, `<Extrude>`, `grainEffect`, `vignetteEffect` | `docs/reference/effects.md` |
| Seams between scenes | `<Seam>`, `cutTheCurve`, `zoomThrough`, `inverseZoom` | `seams.md` |
| A rendered 3D hero or turntable | `3d.json` + `npm run blender` + `<ImageSequence>` | `../../frameforge-3d/SKILL.md` |
| Narration and captions | `narration.json`, `npm run voice`, `<Voiceover>`, `<Subtitles>` | `../../frameforge-voice/SKILL.md`, `captions.md` |
| A process shown with cause and effect | `<Stream>` (a pour from a lip), labels inside the `data-subject` element | `motion.md` |
| Transitions | `TransitionSeries` from `@/packages/transitions` | `motion.md` |

Combining a utility with bespoke code is fine: a bespoke world under a block chart, a block lower third over a shader.
