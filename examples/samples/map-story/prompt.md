# map-story

**Purpose.** A 20-second spot for a fictional same-day delivery brand, 바람배송, that shows the three map blocks in use (`MapOutline`, `RouteMap`, `Markers`): the world draws in, the camera flies to Korea, a route runs 서울 → 부산 → 제주, the day's 예시 delivery counts pop up, then the name card.

**Fiction.** 바람배송 is a fictional brand coined for this sample. Not a real company, product, logo or claim. Every number is 예시 data; the headline and the name card say 예시. Times on the route plates are illustrative.

**Map data.** Natural Earth 1:50m admin-0 countries (public domain, https://www.naturalearthdata.com/about/terms-of-use/), fetched by `npm run geo -- examples/samples/map-story/geo.json` into `public/assets/generated/map-story/geo/` (gitignored) and pinned with url and sha256 in `geo.lock.json`. Items: `world` (all 237 features, simplify 0.03°) and `korea` (`iso_a3` KOR, simplify 0.01°, the same geometry so its outline retraces the world layer's). No basemap image.

## Format

- 1920×1080, 30 fps, 600 frames (20 s). Composition id `MapStory`, entry `entry.tsx`, component `Spot.tsx`. Render port 4351.
- Sound: `audio.json` (mood `upbeat`, 120 BPM, A major, 2 s bars). Music at root volume 0.9; effects come from motion (`MotionSound`), nothing is hand placed.

## Palette (four colours, no others)

- ink `#14213D` (the ocean field of every map scene, text on the name card)
- paper `#F7F3EA` (headlines on the map, label plates, the name card field)
- accent `#FF7A2F` (Korea highlight, route line and dot, pins and value bubbles, the name rule, the scooter body)
- soft `#8FB3E0` (land at 30 % and country outlines, the scooter seat)

## Fonts

- Display: Gothic A1 900, headlines, the brand and the marker values.
- UI: Noto Sans KR 500, plates and the tagline.

## Blocks and assets

All map scenes are one stack of blocks on one camera: `camera(frame)` returns a `{center, zoom}` fit (Mercator) that every map block takes, so the world layer, the Korea layer, the route and the markers always line up. `RouteMap` and `Markers` get `data` = an empty FeatureCollection so they draw no second base map. The map blocks take the swapped palette (`{...palette, ink: paper, paper: ink}`) because they sit on the ink field. Headlines are `GlyphRise` (119 px), the name card is `LogoOutro` (180 px brand, 72 px tagline) next to the kit `Scooter` (540 px, draws in and springs). Outline strokes are 2.5 px (world) and 4 px (Korea); the route line is the block default (`size × 0.36` = 17 px at the 48 px label size).

## Scene table (absolute frames, 30 fps)

| Frames | Time | What fills the frame | Block | Motion | Text |
| --- | --- | --- | --- | --- | --- |
| 0-120 | 0-4 s | the whole world, edge to edge, outlines and land in soft | MapOutline (world) | outlines trace in by path length from frame -2, land fills; camera drifts 1 → 1.06 | "하루 만에, 섬까지" rises from -8, drops 126-150 |
| 120-240 | 4-8 s | the world zooming to Korea until Korea fills two thirds of the height | MapOutline (world, korea) | log-scale zoom 120-225 with the centre leading, Korea outline retraces 186-214 and fills accent 210-226 | "전국 어디든" rises 205, drops 228-250 |
| 240-360 | 8-12 s | Korea with the route from Seoul over Busan to Jeju | RouteMap | accent fill fades 256-264, the dot travels the great-circle route 250-345 with the line behind it, stops pop as it passes | "서울에서 제주까지" 250, plates "서울 · 09:00", "부산 · 13:00", "제주 · 18:00" |
| 360-480 | 12-16 s | Korea with four pins and value bubbles | Markers | pins pop 366-406 with an 8-frame stagger, bubbles grow with the value, the values count up | "오늘의 배송 · 예시" 376, 서울 1,240건, 대전 540건, 부산 860건, 제주 310건 |
| 480-600 | 16-20 s | the paper name card wiping up over the map, scooter 540 px, brand 180 px; frames 540-600 hold still | LogoOutro, Scooter | wipe 480-494, scooter draws and springs from 488, brand rises 492, rule and tagline by 532 | "바람배송", "가상 브랜드 · 예시 데이터" |

"Fills the frame" names the thing that covers most of the picture in each row: the map is full bleed in every map scene, so no row is a bare background.

One continuous camera carries the film: the zoom is the only large move, and every scene after it is born on the same map (the route draws on the Korea that just lit up, the pins land on the route's cities). The name card wipes upward. There is no hard cut between the map scenes; the scene boundaries are where the headline and the top block change.

## Audio cues

- Music `/audio/generated/map-story/music.wav` at 0.9, sections on bar lines (0, 4, 8, 12, 16, 18, 20 s), energy 0.1 in the last 2 s.
- Hits at 7.0 s (Korea fills accent, frame 210), 11.5 s (the dot reaches Jeju, frame 345), 16.5 s (the brand lands, frame 495).
- Effects derived from motion: the zoom and the name wipe (`whoosh`, move, family wipe), outline, route, scooter and pins (`tick`, land, families shape and card). Quiet frames are the three hits.

## References and why

- `examples/samples/data-reel/Spot.tsx`: block placement, headline timing, MotionSound wiring.
- `examples/samples/_template/Spot.tsx`: sizes and the still hold.
- `docs/reference/blocks-maps.md`: the map block props used here.

## Prohibitions

- No basemap image, tiles, glow, particles, real brand, real logo, real number, icon library. No text below 38 px (plates are 48 px).

## Check frames (contact sheet)

20 (world drawing), 60 (world drawn), 150 (zoom start), 180 (zoom mid), 215 (Korea lit), 300 (route mid), 345 (route at Jeju), 450 (markers), 580 (name hold).

## Deviations

- The map scenes are not separated by cuts; the seam check therefore reports its boundaries as unmeasured (no camera probe on a cut) instead of measuring an exit and entry vector. The zoom is reported as a `wipe` probe so its whoosh is derived without a seam measurement.
- The scooter is the kit asset at its own stroke (`size × 0.045`); the map outlines use a thinner data stroke.

## Verified and not verified

- Verified: see the report of the map-blocks workstream (contact sheet of the check frames, `npx tsc --noEmit`, `npx tsx --test tests/blocks-maps.test.tsx`, `python3 scripts/assets/geo.py --self-check`, `npm run lint:video`, `npm run score`, the full render and `node bin/frameforge.mjs check`).
- Not verified: the 110m scale and the land, coastline and lakes layers in a film (fetched by URL check and the self-check only); the equirectangular projection in Chrome (node markup tests only).
