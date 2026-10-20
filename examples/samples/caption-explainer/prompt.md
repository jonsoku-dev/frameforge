# caption-explainer

**Purpose.** A 25-second app explainer where the narration exists only as TikTok-style captions, so a viewer reads the whole pitch of 말씨랩 (fictional app) with the sound on or off. This film tests the caption and text-fit utilities.

**Fiction.** 말씨랩 is a fictional language-learning app, coined for this sample. It is not a real product, company, logo, or claim. The numbers on screen (the streak count) are labelled 예시.

## Format

- 1920×1080, 30 fps, 750 frames (25 s). Composition id `CaptionExplainer`, entry `entry.tsx`, component `Spot.tsx`, port 4483.
- Captions: `captions/caption-explainer.srt` (41 word-level cues, 12 lines, 0.6 s to 22.0 s), loaded with `parseSrt({strict: true})` and grouped with `createTikTokStyleCaptions` (2400 ms page, 150 ms silence break) from `@/packages/captions`.
- Sound: `audio.json` (mood `corporate`, 100 BPM, C major, bar 2.4 s, sections on bar lines, hits at 4.8 s and 19.2 s). Music at root volume 0.9. Three sound effects placed by `MotionSound` from motion probes.

## Palette (four colours, no others)

- Ink `#1E1B4B` (text, outlines, dark cards)
- Paper `#FAFAFA` (background)
- Soft `#FEF3C7` (background field, bubble fill)
- Accent `#F59E0B` (current caption word, underline, streak marks)

## Font

One family, Google Fonts `Noto Sans KR`, weights 500 and 900. Captions and the lockup use 900, labels use 500.

## Caption size

`fitText` (from `@/packages/layout-utils`) sizes the longest caption line to 1600 px, capped at 120 px. The longest line is 14 characters, so the fit lands at about 110 px. This is above the 108 px headline minimum in `docs/samples/rules.md`, so the film honours the rule and not the 96 px figure in the brief.

## Scene table (absolute frames)

| Frames | Time | What fills the frame | Motion | Text |
|---|---|---|---|---|
| 0–239 | 0–8 s | Soft speech bubble, 1000×560, centred above the captions | Bubble springs up from scale 0 (0–36). Three ink dots pop in one by one at 144, 150, 156 (the 4.8 s hit). | Captions, lines 1–4 |
| 240–479 | 8–16 s | Ink-backed paper card, 1040×560, flips from face down to face up (spring at 250) | Card flips on rotateY. Accent underline wipes under the sentence (300–324). | Captions, lines 5–9. Card reads "한 잔 주세요." and "예시 문장" |
| 480–671 | 16–22.4 s | Soft field with the streak number 0 to 7 (420 px) and seven rounded squares | Number counts to 7 by frame 570 (the 19.2 s hit at 576). Squares pop in from 500 and fill accent as the count passes them. | Captions, lines 9–12. Label "연속 학습 · 예시" |
| 672–749 | 22.4–25 s | Paper, lockup "말씨랩" at 320 px, accent bar, tagline | Glyphs rise (672–688), bar wipes (676–688), tagline fades in (680–690). Still from 690 to the end. | Lockup and tagline "한마디씩 말이 먼저 나오는 공부 · 가상 브랜드" |

## Audio cue list

- Music: sections 0–4.8 hook (0.3), 4.8–9.6 bubble (0.7), 9.6–14.4 card (0.6), 14.4–19.2 streak (0.75), 19.2–21.6 count (0.9), 21.6–25 hold (0.1). The last 2 s sit at energy 0.1.
- Sound effects, placed by motion: `pop` (card land, role land), `ding` (dots appear, role appear), `whoosh` (underline and squares move, role move). Quiet frames are the music hits, 144 and 576.

## References

- `examples/samples/cafe-morning/Spot.tsx`: motion probes, `MotionSound` wiring, the `Glyphs` rise mask, the `pop` and `span` helpers.
- `docs/samples/rules.md`: frame and safe-area limits, the headline minimum, and the sound density rule.
- `docs/references/opus-5-5/README.md`: the available reference index. No film from it is copied.

## Prohibitions

- No real brands, logos, or numbers. The streak count is 예시.
- No icon library. All marks are inline SVG (the bubble tail, the card's quote mark).
- No hand-placed `<Sequence><Audio/>`. Every effect comes from a motion probe.
- No `Math.random`, `Date`, state, effects, or CSS transitions. Every value is a function of the frame.
- No `data-clip="allow"` on text.

## Check frames

Look at frames 60, 150, 200, 300, 400, 500, 560, 600, 650, 700, 740 (eleven stills). The lockup is checked at 700 and 740, the bubble at 60 and 150, and the streak at 560 and 600.
