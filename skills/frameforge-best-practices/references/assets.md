# Assets

Quality bar (`docs/guides/assets.md`, 주 에셋 품질 기준): silhouette-readable, 4–9 shapes with one characteristic detail, one stroke width and one corner radius per film, 8 px grid in a 400×400 box, same viewpoint across the set, round caps, fills only in accent/soft/paper, no icon libraries, bitmaps, gradients or blur.

Three ways, in order of preference for a weak model:
1. **Kit**: `import {Cup, Phone, Pin} from '@/assets'`. Every asset takes `{size, ink, accent, soft, paper, stroke?, radius?, draw?, parts?, style?}`. `draw` 0..1 draws the strokes in; `parts` reveals assembly groups in order. The catalogue with tags is `src/assets/catalog.ts`; the sheet is rendered from `src/assets/Sheet.tsx`.
2. **Resolver**: `examples/samples/<slug>/assets.json` = `{"slug", "palette": {"ink","accent","soft","paper"}, "assets": [{"name", "intent", "source"?: "auto|host|image-command|library|kit", "recolor"?: true}]}` → `npm run art -- <that file>` writes `public/assets/generated/<slug>/<name>.svg`, a manifest and `CREDITS.md`. Providers: a file you placed yourself (`host`), your own image skill through `FRAMEFORGE_IMAGE_COMMAND` (PNG → vectorized), Openverse CC0 SVG, then the kit. Play with `<Art src="/assets/generated/<slug>/<name>.svg" size draw ink accent soft paper />`.
3. **Own drawing** only when neither fits: put it in `examples/samples/<slug>/assets.tsx`, follow the bar, and render an asset sheet of it before animating.

Hero props in a process film are illustrated objects, not icons: a recognisable silhouette, a label or detail, a highlight and a shadow, one outline weight. Take them from the kit or draw them in `assets.tsx`. Tools are shown in use: a bottle tilts and pours from its own neck. Kit props for this: `<Bottle size label="GIN" tilt={deg}>` with `bottleNeck({size, tilt, x, y})` as the `<Stream from>` point, and `<Glass size fill={0..1} liquid={colour} ice={0..3}>` with `glassLevel(fill)` for the surface height of an oz label.

Real screens (explainers): the user supplies the captures (the repo ships none). Put them unmodified in a folder under `public/` and add that folder to `.gitignore`; record DOM-measured rectangles in `prompt.md`; callouts may use `lucide-react` markers there and nowhere else.

A lit 3D hero with no asset file comes from the hero `<Shader>` presets: `shaders.planet` (terminator, clouds, city lights, atmosphere), `shaders.sun` (granulation, corona, flare), `shaders.sliced` (a raymarched bust, torus knot or blob in glossy, scanline or wireframe style; drive `u_orbit` from the frame, sweep `u_mix` 0→1 to turn the scanline hero glossy) and `shaders.orbits` (light rings round a sphere). Use one as the film's recurring hero; uniforms are in `docs/reference/generative.md`.
