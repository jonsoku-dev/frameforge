# cmp-motion-luna6

Purpose: Help people in their twenties remember that a small amount can collect automatically each month.

Fictional brand: 차곡달. This name and identity are invented for this spot and do not represent a real company, product, or logo.

Format: 1920×1080, 30 fps, 450 frames (15 seconds), composition id `CmpMotionLuna6`, port 4451. No external image assets.
Palette: ink `#111827` for the opening and type, paper `#F9FAFB` for the cards, accent `#22C55E` for the coin and actions, soft `#DCFCE7` for supporting surfaces.
Fonts: Black Han Sans 400 for headlines and Noto Sans KR 500 for UI. Headline minimum 108 px, UI minimum 38 px, icon minimum 65 px, hero minimum 378 px. Safe margins are 96 px horizontally and 54 px vertically.
Icons: lucide-react (ISC), using Wallet, Repeat, and PiggyBank.
Motion: spring landings, shape wipes, and per-glyph lifts. One camera push at the turn, 78–102. No flashes. The last 60 frames are completely still.

| Frames | Fills the frame | Motion | Text |
|---|---|---|---|
| 0–74 | Ink field, oversized slipping coin, and broad paper track | Coin drops and slides along a track; the track bends into a rising curve | 돈은 어디로 새는 걸까? |
| 75–179 | Soft field with a large accent coin growing into a stack | The same coin follows the curve, multiplies into a broad stack, then wipes the soft field across | 조금씩 모이면, 차곡차곡 |
| 180–299 | Three large paper cards connected by the coin’s green path | Cards land in sequence; the continuing coin path links wallet, repeat, and piggy bank | 지갑 연결 / 매달 반복 / 저금통에 쌓기. Each card labels its amount 예시. |
| 300–389 | Full accent field and a large rising coin arc | The connected path expands into the field; one 1.04 camera push at 318–342; promise rises into place | 매달 조금씩, 자동으로 모인다 |
| 390–449 | Ink name card with coin-stack mark and underline | Already settled at frame 390; still throughout | 차곡달 / 매일의 작은 여유 |

Audio: generated music at `/audio/generated/cmp-motion-luna6/music.wav`, volume 0.9, upbeat, 120 BPM. Sections follow hook, turn, steps, promise, and hold. Hits at 2.5 s and 13 s. `whoosh` at frame 75, `pop` at frame 180, and `impact` at frame 390 align with the visible events.

References: `examples/samples/cafe-morning/Spot.tsx` for frame-based helpers and shape continuity; `examples/samples/recipe-steps/Spot.tsx` for the per-glyph mask allowances used with Korean fonts; `docs/references/opus-5-5/khiro19-note.md` for treating continuity and a single key push as the visual spine.

Prohibitions: No real product, company, logo, or unlabelled number. No glow, particles, frame border, phone bezel, face, gems, or decorative gradient. No text below the stated minimums, no fade-only arrivals, no movement in the final 60 frames.

Check frames: 15, 60, 120, 200, 260, 320, 400, 449.
