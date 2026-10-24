# data-reel

**Purpose.** A 30-second explainer that walks a viewer through a fictional household-ledger app, 누리장부, one data block per beat, so that an agent reading `src/blocks/` sees every chart, code and diagram block in use with its motion and sound wiring.

**Fiction.** 누리장부 (Nuri Ledger) is a fictional app coined for this sample. Not a real company, product, logo or claim. Every number is 예시 data: each chart carries the 예시 pill, the name card says 예시 데이터.

## Format

- 1920×1080, 30 fps, 900 frames (30 s). Composition id `DataReel`, entry `entry.tsx`, component `Spot.tsx`. Render port 4322.
- Sound: `audio.json` (mood `tech`, 120 BPM, D minor). Music at root volume 0.9. Effects come from motion (`MotionSound`); nothing is hand placed.

## Palette (four colours, no others)

- ink `#1B1F3B` (hook and name background, lines, text, the code panel)
- paper `#F5F2EA` (the stage card the blocks sit on, 1696×828 at 112,212)
- accent `#E4572E` (bars, lines, rings, checks, pills, arrows' fills)
- soft `#F6D5C8` (the field around the stage card in the middle scenes, tracks, rect nodes, heatmap base, table stripes)

## Fonts

- Headline: Gothic A1 800 (`googleFont('Gothic A1', {weights: [800]})`), headlines and every number in the blocks.
- UI: IBM Plex Sans KR 500, labels and the tagline.
- Code: JetBrains Mono 400, passed to `CodeBlock` as `fonts.mono`.
- Text mask: the `Glyphs` pattern from `examples/samples/_template/Spot.tsx`.

## Blocks

All from `@/blocks` with the shared contract (`frame`, `at`, `out`, `palette`, `fonts`, `size` 43 px, placement on the 1600×760 stage at 160,240). No asset is drawn in this file; axes, connectors, checks and arrowheads are the blocks' own paths in one stroke width (`size × 1.5/3.5` = 18.5 px) and one corner radius (`size × 0.4`).

## Scene table (absolute frames, 30 fps)

| Frames | Time | What fills the frame | Block | Motion | Text |
| --- | --- | --- | --- | --- | --- |
| 0-72 | 0-2.4 s | Ink field, headline 176 px, `Sparkline` 1600×380 | Sparkline | line draws in 0-48, dot rides the end | "지출, 한눈에" rises from frame -8 (half up at 0) to 28 |
| 60-150 | 2-5 s | Soft field with the paper stage card wipes up from the bottom (60-72); `BarChart` six bars | BarChart | bars grow from the baseline 64-104 staggered, counters count up, target line draws from ~99 | "월별 지출", 1월-6월, 목표 60만 |
| 150-225 | 5-7.5 s | `LineChart` with area | LineChart | axis draws 154-169, line 163-199 with the leading dot, area fades 187-205 | "저축 추이", 0만/64만 ticks |
| 225-345 | 7.5-11.5 s | `BarChartRace` five categories over four snapshots | BarChartRace | bars re-sort 229-325 with smooth y, widths follow values, month label swaps | "카테고리 순위", 식비 교통 쇼핑 여가 구독 |
| 345-435 | 11.5-14.5 s | `Donut` 560 px left, `Heatmap` 7×4 right | Donut, Heatmap | ring sweeps to 72% 349-394 with the counter; cells pop in a seeded order 355-400 | "예산 달성과 소비 시간", 이달 예산 달성, 요일과 시간대 |
| 435-525 | 14.5-17.5 s | `CodeBlock` panel 1600×620 on the stage | CodeBlock (typing) | panel rises 439-453, characters type at 5 per frame with a caret, done by ~479 | "자동 분류 규칙", a TypeScript rule table |
| 525-600 | 17.5-20 s | `Flowchart` four nodes in a row | Flowchart | nodes pop 529-569 staggered, arrows draw after both ends landed | "알림이 오기까지", 결제 → 자동 분류 → 예산 비교 → 알림 |
| 600-675 | 20-22.5 s | `ProcessSteps` three numbered circles | ProcessSteps | the fill runs 612-664 through all three, the near step scales up | "시작은 세 단계" |
| 675-750 | 22.5-25 s | `Timeline` four milestones | Timeline | marker travels 689-739, milestones pop as it passes, labels alternate | "출시 일정", 1월 3월 5월 7월 |
| 750-815 | 25-27.2 s | `Compare` two columns, four rows | Compare | rows rise 760-794 in sync, checks and crosses draw per cell | "기본과 프로" |
| 815-840 | 27.2-28 s | Ink wipes up over the stage; name 240 px | — | wipe 815-827, glyphs rise 817-835, accent bar 825-839, tagline fades 828-840 | "누리장부", "가계부 앱 · 가상 브랜드 · 예시 데이터" |
| 840-900 | 28-30 s | hold: name card | — | nothing moves | same |

"Fills the frame" names the thing that covers most of the picture in each row. No row is a bare background: every middle scene keeps the stage card, a 108 px headline and a block that spans the stage; the card's soft margins give every frame a headline-sized band even while a headline rises.

One dominant motion direction, up: the paper field and the ink end card wipe upward, bars grow upward, panels and rows rise. Continuity is the soft field, the paper stage card and the headline slot, which persist across the middle scenes while each block fades out over its last 8 frames and the next block enters with its own upward motion.

## Audio cues

- Music `/audio/generated/data-reel/music.wav` at 0.9, sections on 2 s bar lines (0, 2, 12, 18, 26, 28, 30 s), energy 0.1 in the last 2 s.
- Hits at 3.6 s (bars landed, frame 108, the last counter settles there), 11.5 s (race settled, frame 345), 28.0 s (name landed, frame 840).
- Effects derived from motion: the stage and end-card wipes and the code panel rise (`whoosh`, move, families wipe and card), bar growth and markers (`tick`, land, families shape and card). Quiet frames are the three hits.

## References and why

- `examples/samples/_template/Spot.tsx`: the `Glyphs` mask, `span`, `MotionProbe` and `MotionSound` wiring.
- `examples/samples/kit-launch/Spot.tsx`: the hard-cut scene switch and the hook-to-stage continuity.
- `docs/reference/blocks-data.md`: the block contract and props used here.

## Prohibitions

- No glow, particles, bezel, real brand, real logo, real number, icon library.
- No text below 38 px (the code block runs at exactly 38 px). No fade-only scene: every cut replaces the block.

## Check frames (contact sheet)

40 (sparkline), 120 (bars), 210 (line), 330 (race settled), 410 (donut and heatmap), 500 (code typed), 585 (flowchart), 660 (steps), 735 (timeline), 795 (compare), 880 (name).

Composition check: `npm run frame-check -- renders/samples/data-reel.mp4` prints PASS (thin share 0, huddled 0.002, no empty run; a reported static run 12-60 is the hook's line drawing under the change threshold, inside the 120-frame limit).

## Deviations

- "Each scene born from the previous one's object": not met literally. The middle scenes share the soft field, the stage card and the headline slot, but a block does not grow out of the previous block; it fades and the next one enters upward.

## Verified and not verified

- Verified: contact sheet of the check frames above, `npx tsc --noEmit`, `npx tsx --test tests/blocks-data.test.tsx`, `npm run lint:video`, `npm run score`, the full 900-frame render (`--concurrency 3`, audit empty, ten derived effects), `frame-check` PASS, `flash-check` PASS (worst second 0 flashes).
- Not verified: `CodeBlock` highlight, diff and scroll modes in Chrome (node markup tests only).
