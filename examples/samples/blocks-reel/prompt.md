# blocks-reel

Purpose: show every block of the text, lower-third and card families (`src/blocks/`) in use once, as a 30 s brand reel, so an agent can see each block at its intended size and timing before picking one. Watched by whoever reads `skills/frameforge-blocks/SKILL.md`; after it they import from `@/blocks` instead of hand-writing a title, lower third, counter, card or ticker.
Fictional brand: 온결 (a daily-record app). Not a real company, product or logo. 김온결 is a fictional person. Numbers carry the 예시 tag or the words 샘플 데이터.

Format: 1920x1080, 30 fps, 900 frames, composition id `BlocksReel`, port 4321.
Palette: ink #15161A (dark scenes, text), paper #F3F1EB (light scenes, cards), accent #E8481F (the disc, bars, highlight; paper on it is 3.46:1, ink 4.63:1), soft #FFD9CC (bubbles, icon slot, the pale disc). Four colours.
Fonts: Gothic A1 900 for display text (glyph rises, numbers, names), Noto Sans KR 500 for UI text (roles, bodies, bubbles, ticker).
Assets: the accent disc (drawn, `Disc` in Spot.tsx) is the hero and the continuity object; the toast icon is the kit `Bell` from `@/assets`; checks are a drawn path. No icon library.
Sizes (short side 1080): headline 108 px and up (hook 135, cascade 119, zoom 189, sweep 119, counter 281, logo 227), labels 38 px and up (lower-third role 45, toast body 39, ticker 45, thread initials 42), margins 96 / 54 px.

| Frames | Fills the frame | Block | Motion | Text |
|---|---|---|---|---|
| 0-80 | ink field, accent disc (hero) right | GlyphRise ×2 | disc springs in, glyphs rise | 하루를 잇는 / 가장 가벼운 방법 |
| 80-170 | the disc grows until it is the background | WordCascade, LowerThird clean-bar (accent tone) | words fall in by weight, bar grows | 가볍게 시작하고 / 단단하게 이어집니다 |
| 170-280 | paper wipes up, one giant word | ZoomSwap, LowerThird bold-block | Z-axis swap through blur, block scales from the left | 출근길에 → 점심시간에 → 잠들기 전에 |
| 280-360 | ink wipes up, paper panel with ink offset | Typewriter, LowerThird kicker-name (right, ink tone) | panel rises, characters type behind a caret | 오늘 할 일 세 가지를 적습니다. |
| 360-440 | paper wipes up, sentence across the frame | HighlightSweep, LowerThird soft-pill | accent sweeps behind 큰 흐름, pill scales | 작은 기록이 큰 흐름이 됩니다 |
| 440-500 | accent wipes up, one number | Counter | counts 0→1,284 | 1,284 일 예시 · 이어진 날 · 샘플 데이터 |
| 500-580 | paper wipes up, two stat cards | StatCard ×2, LowerThird mask-reveal | cards spring up from below, counters count | 1,284 일 / 92 % |
| 580-650 | ink wipes up, toast top-left, disc right | NotificationCard, LowerThird side-rule (ink tone) | toast drops in from the top, holds, lifts out | 온결 · 오늘의 기록이 저장됐어요 · 지금 |
| 650-730 | paper wipes up, chat thread left, soft disc right | MessageThread | bubbles pop in, typing dots before each reply | three bubbles |
| 730-800 | accent wipes up, paper panel, ticker strip | Checklist, Ticker | items rise, checks draw, strip scrolls 5 px/frame | 기록을 남긴다 / 흐름을 잇는다 / 내일을 확인한다 · six cities |
| 800-840 | ink wipes up, brand name | LogoOutro | glyphs rise under the wipe, rule grows, tagline fades, still from 840 | 온결 · 하루를 잇다 · 가상 브랜드 |
| 840-899 | hold | nothing moves | same |

Every scene change is an upward wipe (`inset` from the bottom) or the disc growing, so the whole reel moves up; nothing enters by fade alone. Lower thirds are overlaid on six content beats, as they are used in real films, never alone on a background.

Audio: /audio/generated/blocks-reel/music.wav at 0.9, 120 bpm so bars sit on even seconds; sections 0-2 / 2-10 / 10-16 / 16-26 / 26-28 / 28-30 (hold ≤ 0.15). Hits at 2.667 s (disc fills, lift), 14.667 s (counter, slam), 26.667 s (logo, slam) = frames 80, 440, 800, listed in every `MotionSound quiet`. Effects derive from probes: whoosh on wipe/card moves, pop on card and shape landings, ding when a counter, check or text reveal passes halfway.
References: examples/samples/_template/Spot.tsx (Glyphs mask, Screen offset block, push), examples/samples/cafe-morning/Spot.tsx (MotionProbe and MotionSound maps), docs/reference/blocks-text.md (each block's props).
Prohibitions: no glow, particles, bezel, real brand, icon library, text under 38 px, CSS animation. Blocks are never unmounted before `at`; they hide themselves.

Check frames (contact sheet, one per block): 40 GlyphRise, 100 disc grown + first cascade word, 150 WordCascade settled + clean-bar, 210 ZoomSwap mid-swap, 265 ZoomSwap third word + bold-block, 320 Typewriter + kicker-name, 395 HighlightSweep + soft-pill, 470 Counter, 545 StatCard ×2 + mask-reveal, 615 NotificationCard + side-rule, 700 MessageThread with typing dots, 775 Checklist + Ticker, 830 LogoOutro, 880 hold.
Composition check: `npm run frame-check -- renders/samples/blocks-reel.mp4` must print PASS (full render and frame-check are run by the integrator; this workstream rendered the contact sheet and frames 0-149).
