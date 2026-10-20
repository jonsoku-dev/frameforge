# weather-brief

**Purpose.** A 15 s one-day forecast teaser for the fictional weather app **Moru**, with every on-screen number marked 예시.

**Format.** Composition `WeatherBrief`, 1920×1080, 30 fps, 450 frames, port 4414.

**Palette.** Night `#0B1E3F`, day `#CFE8FF`, ink `#0F172A`, accent `#FFB703`.

**Fonts.** Headline Do Hyeon 400. UI Noto Sans KR 500.

## Scenes

| Frames | Fills the frame | Motion | Text |
|---|---|---|---|
| 0–89 | Night sky changing to day sky | Accent sun circle rises from below the bottom edge; a top-to-bottom day-color wipe follows it | `Moru` and `오늘의 하늘` rise after the sun settles |
| 90–239 | Day sky | Four cards slide up as columns; each Lucide icon draws on with strokeDashoffset and each accent temperature bar grows | `아침`, `낮`, `저녁`, `밤`; each temperature is marked `예시` |
| 240–329 | Day sky | Bar tops join into one accent temperature curve; cards slide down out of frame, not opacity-only | `시간대별 기온` |
| 330–389 | Day sky | Advice line rises from below with the curve as its underline | `우산은 저녁에` |
| 390–449 | Day sky | Hold still | `Moru` and `예시 일기예보` |

## Audio

Audio: spec `audio.json` (minimal, 100 bpm, C major, seed 23). Sections sunrise 0-3s (0.2), cards 3-8s (0.45), curve 8-11s (0.5), advice 11-13s (0.35), hold 13-15s (0.1). Hits at 11.3 s. Music `/audio/generated/weather-brief/music.wav` at the root, volume 0.9. SFX in `/audio/generated/weather-brief/<name>.wav`, volume 0.8, at frames pop.wav 136, 142, 148, 154; whoosh.wav 258; ding.wav 338.

## References

`docs/references/opus-5-5/*.md` and the LINE GAME films provide the one-root-frame, `span`/`pop`/`Glyphs`, and scene-born-from-previous-object patterns. Lucide icons are ISC licensed and installed in the repository.

## Prohibitions

No real product, logo, weather claim, or unmarked number. Moru is fictional. No `#06C755`, Gothic A1, glow, particles, gradients, phone bezel, frame border, icon webfonts, or opacity-only exit. Keep all text inside the TV safe area.

## Check frames

0, 30, 75, 105, 135, 165, 210, 245, 275, 320, 345, 375, 410, 449.
