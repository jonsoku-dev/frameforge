# event-teaser

KERFWORKS 2027 is a fictional design-engineering conference; the name, the city (Quillmere), the dates and the tracks are invented. No real logo, number or claim appears, and the date card is labeled 예시 (sample).

**Purpose.** A 15 s teaser that announces the conference name, three tracks, then date and city, with the date card landing on the track's big hit at 12.0 s.

**Format.** Composition `EventTeaser`, 1920x1080, 30 fps, 450 frames. Port 4404.

**Palette.** ink `#0E0E10`, paper `#EDEDED`, accent `#7C3AED`, muted `#8A8A90`.
**Fonts.** Headlines Bebas Neue 400. Labels Noto Sans KR 500 (carries Hangul, so 예시 does not fall back to a system font).

## Scenes (absolute frames)

| Frames | Fills the frame | Motion | Text |
|---|---|---|---|
| 0-39 | ink | paper hairline grows from the center to full height | none |
| 40-89 | ink splitting into accent | the line widens into an accent panel to full width, hairline fades | none |
| 72-209 | accent panel | name rises letter by letter as the panel nears full width (stagger 3, done about 108); subtitle (44 px) from 115 | KERFWORKS, then Noto Sans KR "DESIGN ENGINEERING CONFERENCE / 2027 / 예시" |
| 210-329 | accent panel | name shrinks to 0.65 at the top left (subtitle reads about 29 px); bar 1 slides in from the right, bar 2 peels out of bar 1's slot, bar 3 out of bar 2's, bars 22 frames apart, labels stagger 1 (bar 3 label complete about 291) | 01 TYPE AND MOTION, 02 DESIGN SYSTEMS, 03 CREATIVE CODE |
| 330-351 | paper | bar 2 (paper, y 620-770) grows into the full-frame paper card, its label fading out over 328-338; full at 352 | none |
| 346-389 | paper | date, city and label rise glyph by glyph from 346 (first glyph lands about 358), accent rule from 346; one camera push from 360 | 14-15 NOV 2027, QUILLMERE, 예시 label |
| 390-449 | paper | hold still | same |

## Audio

Audio: spec `audio.json` (dramatic, 110 bpm, D minor, seed 13). Sections hairline 0-1.3s (0.15), name 1.3-7s (0.45), bars 7-11s (0.75), card 11-13s (0.85), hold 13-15s (0.1). Hits at 1.3, 12 s. Music `/audio/generated/event-teaser/music.wav` at the root, volume 0.9. SFX in `/audio/generated/event-teaser/<name>.wav`, volume 0.8, at frames whoosh.wav 40; impact.wav 360.

## References

`docs/references/opus-5-5/README.md` motion rules and the earlier films: one root frame, `span`/`pop`/`Glyphs` helpers, a scene born from the previous scene's object (line becomes panel, bar becomes next bar, bar becomes card).

## Prohibitions

No `#06C755`, no Gothic A1, no glow, no gradient, no data-clip on text, no motion after frame 390.

## Check frames

10, 60, 80, 100, 150, 225, 270, 320, 340, 352, 365, 400.
