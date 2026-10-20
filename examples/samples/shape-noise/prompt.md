# ShapeNoise (모양결 스튜디오, 가상 브랜드)

Purpose: a 20-second abstract spot that shows a fictional design studio's motion language, a hexagon that grows out of a star, drifts through a noise field and streaks out, so a viewer remembers the studio's name.
Fictional brand: 모양결 스튜디오 ("shape grain"). Coined for this film; no real company, product or logo. Tagline is a fictional line. No numbers appear on screen.

Format: 1920x1080, 30 fps, 600 frames, composition id `ShapeNoise`, dev server port 4482.
Palette (four colours at most): ink #111111 (background), paper #F5F5F4 (second background and the stroke on ink), accent #8B5CF6 (hero fill and streak), soft #DDD6FE (noise field and tagline).
Fonts: display `Do Hyeon` 400 for the headline (Glyphs rise), UI `IBM Plex Sans KR` 500 for the tagline and label. Both Hangul-capable Google Fonts. Gothic A1 and #06C755 are not used.
Assets: one drawn asset, `Gem` in `assets.tsx` (no icon library). A faceted six-point star that morphs into an isometric cube: twelve shared vertices, three faces (top soft, right accent, left accent over soft), the outline, and the Y of three cube edges. `morph` 0 is the star, 1 the cube; `draw` traces the outline and edges, `fill` fades the faces. The hero, the streak, the 44-piece field (faces only) and the mark are this one drawing at different sizes. `STROKE` 16 px (1.5% of the short side) is converted into the 400-unit viewBox per size; the round join is the only corner (`RADIUS` 8). Contact sheet: `.scratch/samples/shape-noise/assets-sheet.png`.
Sizes (short side 1080): hero radius 470 px (87%), headline 180 px, label 46 px, mark 120 px, margins 96 px horizontal, 54 px vertical. Field shapes 48 to 72 px, each at least 44 px.

Motion families: spring (hero entrance, hero shrink), wipe (clip-path, paper and ink), text rise (Glyphs). Camera push: two, at 296 to 426 and 450 to 480.

| Frames | Fills the frame | Motion | Text |
|---|---|---|---|
| 0-120 (0-4 s) | the star, 87% of the short side, accent fill, paper outline drawn in over 0-40 | spring entrance at 0; spin 0 to 360 degrees, eased, across 0-210 (a full turn so the top-lit gem rests where it started) | none |
| 120-292 (4-9.7 s) | the hexagon morph (star to hexagon 120-210, then hold) over 44 drifting field shapes, soft | field fades in 118-190 with a stagger; each gem drifts on noise3D without spinning | none |
| 292-326 | the hero shrinks to 30% on paper, the paper wipe covers ink from the left at 292-310 | hero scale 1 to 0.3 over 292-326 | none |
| 326-420 | the streak, a 30% hexagon with ink outline, crosses left to right on an ease-in; Trail with 6 layers | camera push 296-426; streak x 960 to 2220 | none |
| 420-452 | the paper field, then the ink wipe from the left (436-452) | field fades out 430-446 | none |
| 450-540 | the name 모양결 스튜디오 on ink, a mark (hexagon outline) above | mark draws 440-470, name rises 450-490, accent bar 486-502 | name and tagline, 180 and 46 px |
| 540-599 | the same name and tagline on ink | nothing moves (last 2 s) | same |

The name reads for 1.2 s or more: it is fully up at about 490 and holds until 599. The hero, field and streak are the same object across cuts: the hexagon that morphs is the hexagon that shrinks and streaks.

Audio: /audio/generated/shape-noise/music.wav at 0.9, 120 BPM (a bar is 2 s; the mood's tech range is 124 BPM, which is not on bar lines at 2 s). Sections at even seconds: 0-4 hook, 4-10 morph, 10-16 streak, 16-18 name, 18-20 hold (energy 0.1). Hits at 4 s (the morph start) and 15 s (the name landing). 15 s is a beat, not a bar line; the generator pulls the bar grid to the nearest bar, so this offset is advisory and is reported.
Sound effects come from motion: `MotionSound` role move for whoosh on the paper wipe and streak, role land for impact on the hero landing and the name. `quiet={[120, 450]}` lists the two hit frames. No hand-placed Audio except the root music.

References: examples/samples/cafe-morning/Spot.tsx (Glyphs rise, MotionProbe and MotionSound declarations, Black Han Sans glyph mask), examples/samples/_template/Spot.tsx (SIZES, span/pop/push helpers, Callout pattern). The Trail child reads its own frame because Trail re-renders the child under a frozen frame, so a prop-driven child would draw identical copies.

Prohibitions: no glow, no particles or dust, no frame border, no bezel, no real brand or logo, no number on screen, no Gothic A1, no #06C755, no icon library, no text smaller than the label size, no full-frame flash, no hard cut between ink and paper (wipes only).

Check frames (stills): 30, 80, 150, 200, 260, 310, 360, 390, 430, 470, 510, 560. Composition check: no full render (port 4318 is shared). Build and test with `npx tsc --noEmit` and `npm test`.
