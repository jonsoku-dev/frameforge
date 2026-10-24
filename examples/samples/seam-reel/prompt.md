# seam-reel

Purpose: show that six independently built scenes can read as one continuous motion when every cut obeys the seam doctrine (`skills/frameforge-best-practices/references/seams.md`). Watched by agents and people tuning seams; after watching they should run `npm run seam-check` on their own film.
Fictional brand: 물길 (a household money-flow app). Not a real company, product or logo. Every number is labelled "예시".

Format: 1920x1080, 30 fps, 900 frames, composition id `SeamReel`, port 4323.
Palette: ink #14213D (hook, name backgrounds, text), paper #F3EFE6 (card and detail backgrounds), accent #E07A2F (the bigger-arrival surface, bars, pills), soft #BFD7EA (panels, chart bars). Four colours.
Fonts: Gothic A1 900 headlines (waterfall lines), Noto Sans KR 500 labels.
Assets: motif kit only (`@/assets`): Wave (hero), Coin (carrier and card icon), Bag, Ticket, BarChart, Tag, Book. No icon library, nothing drawn ad hoc.
Sizes (short side 1080): headline 110 px, name 220 px, label 44 px, icons 120 px, hero 540–760 px, margins 96 / 54 px. Nothing smaller.

The current runs leftward. Each row's start frame is the cut frame; every seam is 24 frames long (12 out, 12 in) centred on it. The final still belongs to the last row.

| Frames | Fills the frame | Motion | Seam into the next row | Text |
|---|---|---|---|---|
| 0-90 | Hook: ink field, Wave hero drawn at right | title lines arrive from below (waterfallEntry); a Coin starts riding leftward at 60 | 90 `cutTheCurve` x−, 12 % travel; the coin carries across the cut and lands in the 식비 card at 130 | 돈의 흐름, / 보이나요? |
| 90-240 | Cards: three spend cards on paper | cards cascade in (waterfallEntry, heavier later); at 180–210 the row `nudge`s left (10/65/25) to centre the 식비 card; the first card leaves past the margin on purpose (`data-clip="allow"` while shifted) | 240 `zoomThrough` (both sides grow): deeper into that card | 한눈에 보는 이번 달 · 식비/쇼핑/여가 · 예시 |
| 240-390 | Detail: the amount at 200 px and a BarChart drawn at right | number and pill arrive at the cut, chart draws 242–282, the number counts up 248–308; still after 308 | 390 `waterfallCut` x−: headline words leave one by one, the next headline's words arrive in the same order; chart leaves with the last word | 이번 달 식비, 얼마였죠? · 1,284,000원 · 예시 |
| 390-540 | Sort: soft panel with three tag rows, Book at right | panel enters with the first word; tag rows cascade (waterfallEntry) | 540 `inverseZoom` (both sides shrink): something bigger arrives | 카드 내역은 자동으로 분류돼요 · 식비/교통/구독 |
| 540-690 | Bigger: accent field, Wave at 760 px | lines arrive from the cut, Wave draws 540–596, a detail line lands 630–650, then stillness to 678 (the pause before the name) | 690 `rackFocus` x− (3 % drift, blur 18 px both sides at the cut) | 모든 계좌를 / 한 물길로 |
| 690-899 | Name: ink field, 물길 at 220 px, accent bar, tagline | name rises 692–720, bar wipes 720–740, tagline 742–765, still from 770 (final hold 840–899) | — | 물길 · 가계부가 아니라, 물길입니다 · 가상 브랜드 |

Vector ledger (measured by seam-check on part renders 0-149, 226-404, 526-704): 90 x− 7.7 → x− 10.9 ‰/f; 240 z+ 7.7 → z+ 10.9; 390 x− 39.4 → x− 43.2 (word probes); 540 z− 7.7 → z− 10.9; 690 x− 1.9 → x− 2.7. Consecutive seams never oppose; the two Z seams are separated by an x seam.

Audio: /audio/generated/seam-reel/music.wav at 0.9, 120 bpm (one bar = 2 s), sections on bar lines, `hits` at 3, 8, 13, 18, 23 s (the five cuts). Effects derive from motion: `whoosh` (move: camera, card, shape) and `thud` (land: card, shape); `quiet` lists the cut frames so the music hits own them.
References: examples/samples/_template/Spot.tsx for span/pop; src/packages/seams.tsx for every seam function; skills/frameforge-best-practices/references/seams.md for the doctrine.
Prohibitions: no fade-only entrances, no scene starting from rest after a cut, no mirrored vector, no rightward seam. Always: no glow, particles, bezel, real brand, text smaller than 44 px.

Check frames (contact sheet): 40, 84, 96, 160, 200, 234, 246, 300, 384, 396, 470, 534, 546, 620, 684, 696, 760, 880.
Seam check: `node scripts/seam-check.mjs renders/samples/seam-reel.mp4.motion.json --prompt examples/samples/seam-reel/prompt.md` must print PASS (the 0-149 part render checks the seam at 90 and skips the rest).
Composition check: `npm run frame-check -- renders/samples/seam-reel.mp4` must print PASS.
Not verified here: the full 900-frame render, frame-check, flash-check and listening to the mix are left to the integrator.
