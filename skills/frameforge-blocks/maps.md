# Map blocks

Reference for the map blocks in `src/blocks/maps.tsx`. Import them with `import {MapOutline, RouteMap, Markers} from '@/blocks'`. They share the block contract described in `SKILL.md` (`frame`, `at`, `out`, `duration`, `fps`, `palette`, `fonts`, `size`, `stroke`, `radius`, `x`, `y`, `width`, `height`, `id`); the Korean reference with every prop is `docs/reference/blocks-maps.md`, and `examples/samples/map-story/Spot.tsx` uses all three.

## Map data

Declare `examples/samples/<slug>/geo.json` = `{"slug", "items": [{"name", "source": "natural-earth", "layer": "countries|land|coastline|lakes", "scale": "110m|50m", "filter"?: {"iso_a3": ["KOR"]}, "simplify"?: degrees}]}` and run `npm run geo -- examples/samples/<slug>/geo.json`. It fetches public-domain Natural Earth GeoJSON, filters, simplifies (Douglas-Peucker), writes `public/assets/generated/<slug>/geo/<name>.geojson` and pins url, sha256 and licence in `geo.lock.json`; a matching lock skips the fetch. Use `50m` when one country fills the frame, `110m` for a world view alone. Filter on `adm0_a3` for the few countries whose `iso_a3` is `-99`. Self-check: `python3 scripts/assets/geo.py --self-check`.

## Shared map props

`src` (the GeoJSON path, fetched once under `delayRender`) or `data` (a FeatureCollection; an empty one draws no base map, for layering), `projection` `equirectangular` (default) or `mercator` (clamped at ±85°), `fit` `'bounds'` (default) or `{center: [lon, lat], zoom}` (zoom 1 = 360° across the box; animate it per frame for a camera move), `highlight` values of `highlightKey` (default `iso_a3`). Defaults: `size` 38 (label plates), `stroke` `size × 0.12`, box `size × 40` by `size × 22`.

Colours come from the palette only: land `soft` at 30 %, outlines `soft`, highlight, route and pins `accent`, plates `ink` with `paper` text. On a dark field pass `{...palette, ink: palette.paper, paper: palette.ink}`. Hidden before `at` (returns `null`), fades over the 8 frames before `out`.

| Block | Own props | Motion | When to use |
| --- | --- | --- | --- |
| `MapOutline` | `duration` 60, `draw?` | Outlines trace in by path length over `duration × 0.7` while land fills; `highlight` features fill `accent` from `at + duration × 0.6`. Probe `shape`/`progress` | Place a story on the world or a region and light up a few countries |
| `RouteMap` | `route: [lon, lat][]`, `stops?: {at, label}[]`, `lead` 20, `duration` 90 | Base draws over `lead`, then a dot travels the great-circle route with the line drawing behind it; each stop and its plate pop as the dot passes. Probe `shape`/`x` | A journey between places |
| `Markers` | `points: {at, label, value?}[]`, `unit?`, `lead` 20 | Pins pop with an 8-frame stagger; a valued point grows an accent bubble whose area follows the value and counts the value up in its plate. Probe `card`/`scale` | Several places with a number each |

Pure helpers for tests and custom scenes: `project`, `bounds`, `fitBounds`, `fitCenter`, `toPixel`, `geoPath`, `greatCircle`. Catalogue: `MAP_BLOCKS` (family `map`, `sample: 'map-story'`) feeds `CATALOG`.

## Layering pattern from the sample

One `camera(frame)` returns the `fit` every map block takes, so all layers line up: one world `MapOutline` stays for the whole film, a second `MapOutline` on a filtered copy of the same scale lights the country after the zoom lands (identical geometry, the outline retraces), and `RouteMap` and `Markers` get an empty `data` so they draw no second base map. Interpolate zoom on a log scale and move the centre ahead of the zoom, keep one projection per film, and keep plates of nearby points apart (plates sit to the right of their point). Tests: `npx tsx --test tests/blocks-maps.test.tsx`.
