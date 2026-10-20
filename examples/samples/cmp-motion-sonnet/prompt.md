# cmp-motion-sonnet

Purpose: in 15 seconds a person in their twenties remembers that 달콩 saves a little every month, automatically.
Fictional brand: 달콩 (달 = month, 콩 = a tiny bean-sized coin). Not a real company, product or logo. Every number on screen is labelled "예시"; the closing caption says 가상 브랜드.

Format: 1920x1080, 30 fps, 450 frames, composition id `CmpMotionSonnet`, port 4443, audio generated from `audio.json`.
Palette: ink #111827 (text, hard edges), paper #F9FAFB (cards, name text), accent #22C55E (coin, promise ground), soft #DCFCE7 (turn and steps ground).
Fonts: Black Han Sans 400 headlines (Glyphs rise), Noto Sans KR 500 labels.
Icons: lucide-react (ISC): Wallet, Repeat, PiggyBank.
Sizes (short side 1080): headline 120-170 px (min 108), labels 40-52 px (min 38), icons 140 px (min 65), hero shapes: coin 440 px, stack 580 px tall, cards 530x640. Safe area 96 px / 54 px.
Motion families: spring plates (coin morph, coin drops, cards), wipes (circle clip, scaleX bar, inset), glyph rise. One camera push 326-360 (1.05).

| Frames | Fills the frame | Motion | Text |
|---|---|---|---|
| 0-75 (0-2.5 s) hook | ink ground, 440 px accent coin right, soft coins slip off it and fall out of frame | coin springs in 0-18; 9 small coins leave it from 8, accelerating down | "월급은 / 어디로 갔지?" 150 px, glyph rise from 6 |
| 75-180 (2.5-6 s) turn | soft circle wipe grows from the coin (75-99) to the whole frame; the coin squashes into a flat coin (75-101) and becomes the base of a 7-coin stack at right | coins drop onto the stack at 102, 112 ... 162 (spring); stack collapses 168-186 | "매달 조금씩" 150 px from 80, "매달 3만원씩 · 예시" 48 px wipe |
| 180-300 (6-10 s) steps | three 530x640 cards fill the width; they leave the stack centre (scale .25 to 1) at 182/190/198 | spring plates, icon pops, example count-up 236-276 | "세 걸음이면 끝" 130 px; titles 50 px; examples 40 px (예시) |
| 300-372 (10-12.4 s) promise | accent circle wipe from the piggy-bank icon covers the frame (300-324); two 170 px lines | glyph rise 304 and 312 (read from 338), ink bar scaleX 330-346, camera push 326-360 | "매달 조금씩, / 자동으로 모인다" |
| 372-390 name arrives, 390-449 hold | ink inset wipe from the bar upward (372-386) fills frame; name 360 px | glyph rise 374, accent bar scaleX 380-390, tagline inset wipe 378-390; nothing moves after 390 | "달콩", "매달 조금씩, 자동으로 모인다", "가상 브랜드 · 샘플 데이터" |

Audio: music.wav at 0.9, upbeat, 120 BPM, C major, hits 2.5 s (turn, frame 75) and 12.5 s (name, frame 375). Last 2 s energy 0.1. SFX: whoosh 75 and 300; pop 102, 122, 142, 162 (coin drops) and 374 (name); click 186, 194, 202 (cards).
References: examples/samples/cafe-morning/Spot.tsx for Glyphs, span/pop/push and Audio wiring; docs/references/opus-5-5/aiidelist.md for the five beats and object-born scenes (coin -> stack -> cards -> promise bar -> name); examples/samples/_template for SIZES.
Prohibitions: no glow, particles, bezel, real brand, text under 38 px, fade-only entrances, hard cuts, flashes.

Check frames: 15, 60, 120, 200, 260, 320, 400, 449 plus 90, 170.
Composition check: `npm run frame-check -- renders/samples/cmp-motion-sonnet.mp4` (not run here, no render allowed).
