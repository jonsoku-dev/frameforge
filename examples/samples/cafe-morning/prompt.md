# cafe-morning

**Purpose.** A 20-second spot that makes a viewer remember "아침은 가까운 곳에서" (the morning starts nearby), with the music as one continuous piece and only three sound effects. This sample tests the music generator.

**Fiction.** 마루컵 (MaruCup) is a fictional neighbourhood cafe app, coined for this sample. It is not a real product, company, logo, or claim. All numbers on screen are 예시 (example) values, labelled 예시.

## Format

- 1920×1080, 30 fps, 600 frames (20 s). Composition id `CafeMorning`, entry `entry.tsx`, component `Spot.tsx` (about 124 lines).
- Sound: `audio.json` (mood `warm`, accepted by the generator, 96 BPM, C major). Music at root volume 0.9. Three sound effects at volume 0.6.

## Palette (four colours, no others)

- ink `#1C1917` (dark scene and text)
- paper `#FAF7F2` (hook background, card faces)
- accent `#D97706` (promise field, icons, bar fills)
- soft `#FDE68A` (cards field, pills, tagline)

Forbidden for variety: `#06C755`, Gothic A1.

## Fonts

- Headline: Black Han Sans 400 (`googleFont('Black Han Sans', {weights: [400]})`), for headlines and numbers only.
- UI: Noto Sans KR 500, for labels, card titles, pills and the tagline.
- Text mask: the `Glyphs` padding from `examples/samples/kinetic-typo/Spot.tsx` (height 1.3em, top 0.15em, sides 0.08em), which was tuned for the same headline font. Every self-check frame rendered without a `Clipped text` error.

## Scene table (absolute frames, 30 fps)

| Frames | Time | What fills the frame | Motion | Text |
| --- | --- | --- | --- | --- |
| 0–110 | 0–3.7 s | Paper, with a cup outline about 560 px tall (the hero) | Cup draws in, stroke 0–50. Copy rises at 24 | "아침, 어디서 시작하죠?" (120 px) |
| 96–150 | 3.2–5.0 s | Soft disc grows out of the cup's centre and covers the paper (the hook cup is the origin of the next scene) | Disc radius eased in from 96 to 150 | Hook copy stays until 150 |
| 150–375 | 5.0–12.5 s | Three paper cards, each 520×640 with an ink offset block; the middle card pushes at 180 | Cards pop in at 150, 156, 162 (the 5.0 s hit). Each card has a bar that fills at 200, 240, 280 | Titles 52 px. Figures 120 px: 0.4km, 7:30, 1탭. Pill "예시" on each card |
| 350–480 | 11.7–16.0 s | Accent field wipes in from the left (350–372). The paper cup draws in at 390–420 on top | Line lands at 380 and 386 (promise hit at 375, 12.5 s) | "아침은" / "가까운 곳에서" (200 px, paper) |
| 480–600 | 16.0–20.0 s | Ink field, name block | Name slides in from the left (480–498), accent bar 500–516, tagline 512–526. Nothing moves after 530 | "마루컵" (360 px, paper). Tagline "동네 카페 주문 · 가상 브랜드" (56 px, soft) |

Still hold: frames 540–599 do not change. There is no camera move after 180.

Every scene has one object that fills the frame. The hook's cup is the hero (about 560 px). The cards fill the width. The promise fills the frame with accent. The name fills the centre.

## Audio cue list

- Music: `/audio/generated/cafe-morning/music.wav`, volume 0.9, from the spec. Sections 0–5 (hook, energy 0.3), 5–12.5 (cards, 0.75), 12.5–17.5 (promise, 0.6), 17.5–20 (name, 0.1). All on 2.5 s bar lines at 96 BPM.
- Music hits: 5.0 s (cards arrive, frame 150) and 12.5 s (promise, frame 375).
- SFX 1, `pop`, at frame 180 (6.0 s), the middle-card push. One beat (0.625 s) or more after the 5.0 s hit.
- SFX 2, `ding`, at frame 420 (14.0 s), when the promise cup completes. 1.5 s after the 12.5 s hit.
- SFX 3, `whoosh`, at frame 480 (16.0 s), the name slide.
- No SFX within a beat of a hit, at least 0.5 s apart, three total (under the four allowed).

## Measurements

From `npm run score -- examples/samples/cafe-morning/audio.json` and `python3 scripts/assets/score-report.py public/audio/generated/cafe-morning/music.wav --spec examples/samples/cafe-morning/audio.json`:

- `I`: -24.0 LUFS (target -24).
- `LRA`: 5.3.
- `continuity.steps_over_5db`: 1. The step is at 18.0 s, -8.5 dB. This is the designed drop into the 0.1-energy hold (the name section starts at 17.5 s, and its RMS is -34.6 dB against -25 dB for the promise). It is not a seam between two loops.
- `arrangement.jumps_over_2x`: 2. At 13.75 s (ratio 0.42), about 1.25 s after the 12.5 s promise hit, and at 17.5 s (ratio 0.22), the start of the name section.
- True peak -12.2 dBTP. Correlation 0.81. `rms_follows_energy`: true.

## References and why

- `docs/guides/motion-graphics.md` sections 6 (mask and clip guard) and 8 (self-check loop). The check frames follow its keyframe rule.
- `examples/samples/kinetic-typo/Spot.tsx` for the Black Han Sans `Glyphs` mask values.
- `examples/samples/_template/Spot.tsx` for the `pop`, `push`, and `span` helpers, and the `SIZES` minimums.
- `examples/samples/cafe-morning/Spot.tsx` for the single-push discipline and the frame-driven scene switching.
- `docs/samples/rules.md` (binding): text safe area, sizes, icons, SFX limits.

## Prohibitions

- No real brand, logo, product, number, or claim. The name is fictional and stated here.
- No `Math.random`, no state, no CSS transitions. All motion is a function of the frame.
- No more than four colours. No gradient, glow, particle, frame border, phone bezel, or face.
- No full-frame flash. No hard cut between black and white.
- No SFX on a glyph or a card. Only the three events above.
- No `data-clip="allow"` on text.
- No icon library. Every drawn asset is in `assets.tsx`: the hero `Cup` and its three card reductions `PinCup`, `ClockCup`, `HeartCup` (160 px), one stroke (`STROKE` 14 of a 400 viewBox) and one radius (`RADIUS` 24). Contact sheet: `.scratch/samples/cafe-morning/assets-sheet.png`.

## Check frames

Captured with the CDP script at `.scratch/samples/cafe-morning/shoot.mjs`, against the dev server on port 4491:

20, 60, 120, 180, 240, 300, 360, 420, 480, 540, 599.

Frame 120 shows the soft disc growing from the cup. Frame 240 and frame 300 differ by the bar fill. Frame 360 shows the accent wipe beginning. Frame 540 and frame 599 are identical.
