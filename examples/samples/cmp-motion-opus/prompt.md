# cmp-motion-opus

Purpose: after 15 seconds a viewer in their twenties remembers "다달탑: 매달 조금씩, 자동으로 모인다", a savings app that moves a small amount every month without them thinking about it.
Fictional brand: 다달탑 ("다달이" monthly + "탑" tower). Coined for this spot. Not a real company, product or logo. Every number on screen carries "예시".

Format: 1920x1080, 30 fps, 450 frames (15 s), composition id `CmpMotionOpus`, entry `examples/samples/cmp-motion-opus/entry.tsx`, port 4441. Sound on.
Palette: ink #111827 (hook and name background, all type on light), paper #F9FAFB (turn background, type on dark), accent #22C55E (coins, promise field, underline), soft #DCFCE7 (card field, coin rims). Four colours, no gradient.
Fonts: Black Han Sans 400 for headlines only (Glyphs rise, mask 1.3em, 0.15em top, 0.08em sides as in kinetic-typo), Noto Sans KR 500 for labels.
Icons: lucide-react (ISC): Wallet, Repeat, PiggyBank, inside the step cards at 104 px.
Sizes (short side 1080): headline 108 px minimum (used 150-200), label 38 px minimum (used 40-56), icon 65 px minimum (used 104), hero shape 378 px minimum (coin column 504 px, falling coins 300 px), margins 96 / 54 px.

Motion language: (1) spring plates: coins land, cards pop; (2) wipes: circle clip-path from the previous object, inset wipe up for the name, scaleX underline and progress bar; (3) glyph rise for every headline. One camera push: 315-365 on the promise line, 1.05. No flash, no hard cut.

| Frames | Fills the frame | Motion | Text |
|---|---|---|---|
| 0-74 hook | ink field; five 300 px accent coins fall out of a paper slot at the top right and leave through the bottom, a sixth coin follows and stops at y 760 | coins fall with ease-in (start 2, 13, 24, 35, 46), keeper falls 50-72 | "월급이 / 새어 나간다" 150 px paper, rises from 6 and 14 |
| 75-179 turn | the caught coin squashes 75-90 into a 420x64 side-view coin at the stack base; a paper circle wipe opens from it 75-95; eight more coins drop onto it 88-137 (every 7 frames) into a 9-coin column 504 px tall | spring landings, settle | "새던 돈이, / 쌓인다" 150 px ink, rises from 76 and 84 |
| 180-299 how | soft circle wipe from the column centre 180-198 fills the frame; three paper cards 544x580 pop in at 190, 216, 242; card 3 progress bar fills 252-292 | spring plates, scaleX bar | "이렇게 모여요" 120 px ink; cards: 01 Wallet "월급이 들어오면" / "매달 25일 · 예시"; 02 Repeat "자동으로 떼어 두고" / "50,000원 · 예시"; 03 PiggyBank "다달탑에 쌓인다" / "1년 600,000원 · 예시" |
| 300-371 promise | accent circle wipe from card 3's icon 300-318 fills the frame; type fills 75% of the width | glyph rise 302 / 310, camera push 315-365 (1.05) | "매달 조금씩, / 자동으로 모인다" 200 px ink |
| 372-389 name in | ink panel wipes up from the bottom 372-386 carrying a 4-coin column (hero, left), name, tagline | inset wipe, name glyph rise 374-388, underline scaleX 376-389 | "다달탑" 260 px paper, tagline "매달 조금씩, 자동으로 모인다" 56 px soft, "가상 브랜드" 40 px |
| 390-449 hold | same picture, nothing moves | none | same |

Audio: `/audio/generated/cmp-motion-opus/music.wav` at 0.9, upbeat, 120 BPM, D major. Sections follow the table: hook 0-2.5 (0.25), turn 2.5-6 (0.6), how 6-10 (0.8), promise 10-12.4 (0.85), name 12.4-13 (0.45), hold 13-15 (0.08). Hits at 2.5 s (frame 75, the coin is caught) and 12.5 s (frame 375, the name panel). SFX (volume 0.8): whoosh at 2 (coins start falling), pop at 75 (coin caught), tick at 88 and 137 (first and last coin landing), whoosh2 at 180 (card field), click at 190, 216, 242 (cards), whoosh at 300 (promise field), whoosh2 at 372 (name panel), ding at 388 (underline done).

References and why:
- `docs/references/opus-5-5/aiidelist.md`: scenes born from the previous object. Here one coin carries the whole film: it falls, becomes the stack base, the stack opens the card field, card 3's icon opens the promise field.
- `docs/references/opus-5-5/khiro19-note.md`: continuity plus a zoom only at the key moment decided the comparison, so the single push sits on the promise line.
- `examples/samples/cafe-morning/Spot.tsx`: `span`, `pop`, `push`, `Glyphs`, circle wipe from an object, audio wiring.
- `examples/samples/kinetic-typo/Spot.tsx`: Black Han Sans mask padding.

Prohibitions: glow, particles, bezel, faces, gradients, real brands or real figures, fade-only entries, motion in the last 60 frames, text under 38 px, English copy.

Check frames: 15, 60, 120, 200, 260, 320, 400, 449 (plus 90, 340, 380 for the transitions).
Composition check: `npm run frame-check -- renders/samples/cmp-motion-opus.mp4` should print PASS (not run here: no full render in the comparison).
