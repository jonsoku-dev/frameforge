# blocks-reel

Purpose: show every block of the text, lower-third and card families (`src/blocks/`) in use once, as a 30 s brand reel, so an agent can see each block at its intended size and timing before picking one. Watched by whoever reads `skills/frameforge-blocks/SKILL.md`; after it they import from `@/blocks` instead of hand-writing a title, lower third, counter, card or ticker.
Fictional brand: 온결 (a daily-record app). Not a real company, product or logo. 김온결 is a fictional person. Numbers carry the 예시 tag or the words 샘플 데이터.

Format: 1920x1080, 30 fps, 900 frames, composition id `BlocksReel`, port 4321.
Palette: ink #15161A (dark scenes, text), paper #F3F1EB (light scenes, cards), accent #E8481F (the disc, bars, highlight; paper on it is 3.46:1, ink 4.63:1), soft #FFD9CC (bubbles, icon slot, the pale disc). Four colours.
Fonts: Gothic A1 900 for display text (glyph rises, numbers, names), Noto Sans KR 500 for UI text (roles, bodies, bubbles, ticker).
Assets: the accent disc (drawn, `Disc` in Spot.tsx) is the hero that becomes the accent field; the paper panel and the stat card's ink block hand the field on; the toast icon is the kit `Bell` from `@/assets`; checks are a drawn path. No icon library.
Sizes (short side 1080): headline 108 px and up (hook 135, cascade 140, zoom 189, typewriter 108, sweep 119, counter 281, logo 227), labels 38 px and up (lower-third role 45, toast body 56, ticker 45, thread initials 50), margins 96 / 54 px.

| Frames | Field | Fills the frame | Block | Motion | Text |
|---|---|---|---|---|---|
| 0-80 | ink | accent disc (hero) right, two headline lines | GlyphRise ×2 | disc springs in, glyphs rise | 하루를 잇는 / 가장 가벼운 방법 |
| 80-170 | accent (the disc grows into the field) | two lines at 140 px | WordCascade, LowerThird clean-bar | words fall in by weight, bar grows | 가볍게 시작하고 / 단단하게 이어집니다 |
| 170-280 | accent | one giant word | ZoomSwap, LowerThird bold-block | Z-axis swap through blur | 출근길에 → 점심시간에 → 잠들기 전에 |
| 280-360 | accent | paper panel with ink offset, 80 % wide | Typewriter, LowerThird kicker-name | panel rises, characters type behind a caret | 할 일 셋을 적습니다. |
| 360-440 | paper (the panel grows into the field) | sentence across the frame | HighlightSweep, LowerThird soft-pill | accent sweeps behind 큰 흐름 | 작은 기록이 큰 흐름이 됩니다 |
| 440-500 | paper | one number at 281 px | Counter | counts 0→1,284 | 1,284 일 예시 · 이어진 날 · 샘플 데이터 |
| 500-580 | paper | two stat cards | StatCard ×2, LowerThird mask-reveal | cards spring up, counters count, 예시 beside the label | 1,284 일 / 92 % |
| 580-730 | ink (the first card's ink block grows into the field) | toast 60 % wide at the top, thread beneath it | NotificationCard, MessageThread, LowerThird side-rule | toast drops in and holds, bubbles pop in with typing dots | 온결 · 오늘의 기록이 저장됐어요 · three bubbles |
| 730-800 | ink | paper panel 62 % wide, ticker strip | Checklist, Ticker | panel rises, items rise, checks draw, strip scrolls, panel drops out at 786 | 기록을 남긴다 / 흐름을 잇는다 / 내일을 확인한다 · six cities |
| 800-840 | ink | brand name at 227 px | LogoOutro | glyphs rise, rule grows, tagline fades, still from 840 | 온결 · 하루를 잇다 · 가상 브랜드 |
| 840-899 | ink | hold | | nothing moves | same |

Four colour runs (ink, accent, paper, ink) so the film has a current; each run is born from an object of the last scene (the disc, the typewriter panel, the stat card's ink block) rather than a cut or a fade. Lower thirds are overlaid on six content beats because the catalogue needs all six variants shown; the tone swaps keep them on their field. The kicker-name variant puts the role above the name by design (a kicker is the small line over a name); on the typewriter beat its left edge aligns with the panel.

Audio: /audio/generated/blocks-reel/music.wav at 0.9, 120 bpm so bars sit on even seconds; sections 0-2 / 2-10 / 10-16 / 16-26 / 26-28 / 28-30 (hold ≤ 0.15). Hits at 2.667 s (disc fills, lift), 14.667 s (counter, slam), 26.667 s (logo, slam) = frames 80, 440, 800, listed in every `MotionSound quiet`. Effects derive from probes: whoosh on wipe/card moves, pop on card and shape landings, ding when a counter, check or text reveal passes halfway.
References: examples/samples/explainer-patterns/Spot.tsx (Glyphs mask, Screen offset block, push), examples/samples/cafe-morning/Spot.tsx (MotionProbe and MotionSound maps), docs/reference/blocks-text.md (each block's props).
Prohibitions: no glow, particles, bezel, real brand, icon library, text under 38 px, CSS animation. Blocks are never unmounted before `at`; they hide themselves.

Check frames (contact sheet, one per block): 40 GlyphRise, 105 field grown + cascade arriving, 150 WordCascade settled + clean-bar, 210 ZoomSwap mid-swap, 265 ZoomSwap third word + bold-block, 320 Typewriter + kicker-name, 395 HighlightSweep + soft-pill, 470 Counter, 545 StatCard ×2 + mask-reveal, 615 NotificationCard + first bubble + side-rule, 700 MessageThread settled, 775 Checklist + Ticker, 830 LogoOutro, 880 hold.
Composition check: `npm run frame-check -- renders/samples/blocks-reel.mp4` must print PASS (full render and frame-check are run by the integrator; this workstream rendered the contact sheet and frames 0-149).
