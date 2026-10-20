# app-onboarding

Purpose: a 20 s vertical onboarding film for the fictional habit app "Pinora", three stacked cards: pick one, do it daily, see the streak.
Fictional: Pinora is an invented name, not a real product or company. No logo, no real number. Numbers are labeled 예시.

Format: 1080x1920, 30 fps, 600 frames, composition id `AppOnboarding`, port 4405.
Sizes: headlines 124, step badge 52, labels 52 at 0.75, weekday letters 48, promise 72, name 220.
Palette: paper #FFFFFF, ink #1F2937, accent #0EA5E9, soft #E0F2FE (stage and option fills). Card edge is ink at 12% alpha.
Fonts: Noto Sans KR 700 headlines (Glyphs rise), Nunito 600 UI labels (Noto Sans KR fallback for Hangul).
Card rect: x 100..980, y 260..1660, radius 56. Text stays inside x 54..1026, y 96..1824.

| Frames | Fills the frame | Motion | Text |
|---|---|---|---|
| 0-150 | soft stage, white card (1400 tall) | card 1 springs up; headline at 6, options from 12 (4-frame stagger); option 1 turns accent, options 2 and 3 fall away (done by 94), 예시 label rises in at 96, option 1 slides to centre and gets a check | 하나만 고른다, three option labels, 1/3 |
| 150-330 | card 2 springs over card 1 (card 1 shrinks and lifts) | seven rings fill one by one, spring pop, at 195 + 18i | 매일 한 번, M T W T F S S, n / 7, 2/3 |
| 330-480 | card 3 springs over, circles already in card 2's row | circles rise and shrink into dots, line draws through them | 흐름을 본다, 예시 · 샘플 데이터, 3/3 |
| 480-540 | accent floods from the card rect to full frame | headline lifts out, dots and line turn white, name (486) and promise (496) rise below the line graph | Pinora, 하루 하나로, 흐름이 된다 |
| 540-600 | hold, nothing moves | none | same |

Audio: spec `audio.json` (calm, 90 bpm, F major, seed 14). Sections choose 0-5s (0.3), track 5-11s (0.5), flow 11-16s (0.55), flood 16-18s (0.7), hold 18-20s (0.1). Hits at 16 s. Music `/audio/generated/app-onboarding/music.wav` at the root, volume 0.9. SFX in `/audio/generated/app-onboarding/<name>.wav`, volume 0.8, at frames whoosh.wav 0, 150, 330, 480; pop.wav 195 + 18i (i = 0..6).
References: docs/references/opus-5-5/README.md style (few shapes, spring motion) and cafe-morning for Glyphs/pop/span patterns.
Prohibitions: no phone bezel, glow, gradient, particles, #06C755, Gothic A1, data-clip on text.
Check frames: 20, 80, 140, 200, 270, 330, 400, 460, 500, 599.
