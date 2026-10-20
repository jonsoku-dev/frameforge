# Recipe Steps

Purpose: show a fictional recipe app guiding one dish through three calm, readable preparation steps.

Format: 1080×1920 vertical, 30 fps, 20 seconds, 600 frames. Fictional app name: 포근담. It is a made-up sample brand, with no real logo, company, product, measured claim, or unmarked numeric data.

Palette: cream `#FFF4E6`, ink `#2B1B12`, accent `#E8590C`, soft `#FFD8B5`.

Fonts: headline Jua 400; UI Noto Sans KR 500.

| Frames | Scene and frame fill | Motion | Text |
| --- | --- | --- | --- |
| 0–119 | Warm cream card with three soft ingredient tiles, vertically spaced | Egg, milk, and wheat icons drop onto tiles with staggered springs; small accent landing marks settle | `오늘의 한 접시`, `달걀`, `우유`, `밀가루` |
| 120–269 | Cream background; the soft ingredient card slides upward as a large ink-outlined bowl grows into the center | Ingredient icons travel into the bowl; label and bowl settle by frame 150 | `1단계`, `섞는다` |
| 270–419 | The bowl rim becomes an accent timer ring on a soft card | SVG ring fills for 150 frames; example countdown changes from 5 to 1 | `2단계`, `굽는다`, `예시`, `5` through `1` |
| 420–509 | Timer ring expands from its center and diameter into a filled soft plate | Plate fills; Lucide Check icon lands by spring | `3단계`, `담는다` |
| 510–599 | Full cream end card | Brand and tagline rise during the first 30 frames, then hold completely still | `포근담`, `한 접시, 세 번의 손길` |

Audio: spec `audio.json` (warm, 88 bpm, F major, seed 20). Sections ingredients 0-4s (0.3), bowl 4-9s (0.5), timer 9-14s (0.65), check 14-17s (0.75), end card 17-18s (0.4), hold 18-20s (0.1). Hits at 14 s. Music `/audio/generated/recipe-steps/music.wav` at the root, volume 0.9. SFX in `/audio/generated/recipe-steps/<name>.wav`, volume 0.8, at frames pop.wav 20, 42, 64; click.wav 419; ding.wav 444.

References: `docs/references/opus-5-5/motion-studio-course.md` for restrained, readable motion pacing; `docs/references/opus-5-5/README.md` for the available reference index; `examples/samples/cafe-morning/Spot.tsx` and `examples/Opening.tsx` for deterministic frame helpers, spring landings, and glyph masks. The LINE GAME films are used only for implementation patterns, not their palette or font.

Prohibitions: no real brand/logo, no unmarked numeric claim, no gradients, particles, glow, phone bezel, or frame border; no color outside the four-color palette; no font beyond Jua and Noto Sans KR; no icon webfonts. Ingredient and Check icons use lucide-react (ISC).

Check frames: 0, 25, 70, 119, 130, 190, 269, 270, 345, 419, 420, 450, 509, 510, 539, 599.
