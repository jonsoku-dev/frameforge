# countdown-hype (CountdownHype)

Purpose: a ten-second countdown that builds to the name of a sale, where each digit shoves the previous one off the frame.

Brand: "ZAPLOOM MARKET" is a fictional online market coined for this sample. No real store, logo, or claim. The discount figure is labeled 예시.

Format: 1920x1080, 30 fps, 300 frames (10 s). Port 4409.

Palette: ink `#141414`, paper `#F5F5F5`, accent `#00E5A0`. Digit and label color is derived from the background (accent on ink, ink on accent and paper), so text is always readable.

Fonts: Anton 400 (digits, name), Noto Sans KR 500 (labels, MARKET, discount line). Noto Sans KR covers Hangul, so 예시/샘플 share one family with the Latin labels.

## Scene table (absolute frames)

Rhythm: digits step every 24 frames (10 at 0 ... 1 at 216). Background cuts fall on the even digits' arrival frames (every 48), so every cut lands on a click. Cut spacing 48 frames, never ink next to paper.

| Frames | Fills the frame | Motion | Text |
|---|---|---|---|
| 0-239 background | accent 0-47, ink 48-95, accent 96-143, paper 144-191, accent 192-239 | hard cuts at 48, 96, 144, 192 | none |
| 24k..24k+23, k=0..9 | digit 10-k, huge, 860 px growing 1% per step to 937 px (ink height about 75% of the frame for "1") | digit k enters over 10 frames and shoves digit k-1 out; entry side by k mod 4: 1 right, 2 left, 3 bottom, 0 top | digit; labels "SALE STARTS IN" and "SAMPLE 샘플" 42 px at top 60; ten 18 px ticks fill at the bottom |
| 228-239 | accent, name card enters (eased wipe-in, 12 frames, fully settled on 240) shoving the "1" out right; name drawn in ink so it reads on accent; "UP TO -70% / 예시" rises 230-239 | the last movement | ZAPLOOM / MARKET |
| 240-299 | ink cut on the impact frame, name recolors to accent and paper | none, 60 frames still | ZAPLOOM / MARKET / UP TO -70% · 예시 (52 px) |

## Audio
Audio: spec `audio.json` (tech, 128 bpm, E minor, seed 18). Sections ten 0-3s (0.5), build 3-6s (0.7), last digits 6-8s (0.9), hold 8-10s (0.1). Hits at 8 s. Music `/audio/generated/countdown-hype/music.wav` at the root, volume 0.9. SFX in `/audio/generated/countdown-hype/<name>.wav`, volume 0.8, at frames click.wav 0, 24, ..., 216; impact.wav 240.
- Shares its track with logo-reveal; this sample's pattern is a metronome of ten clicks then one impact, no riser or whoosh.

## References
`docs/references/opus-5-5/*.md` for the hard-cut-on-beat rhythm; LINE GAME film for the hard-cut accent/ink/paper alternation and the final name card.

## Prohibitions
No ink-to-paper cut, no full-frame flash besides the cuts, no glow, no gradient, no real brand, no data-clip on text, text inside the 5% safe margin when at rest.

## Check frames
0, 47, 48, 100, 150, 215, 232, 240, 270.
