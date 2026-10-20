# kit-launch

**Purpose.** A 20-second launch spot that makes a viewer remember "말로 켜고, 말로 끕니다" (you switch the light on and off with your voice) and the name 샛불. Every visual asset comes from the motif kit (`@/assets`). Nothing is drawn by hand. This film tests the kit and the motion-derived sound path.

**Fiction.** 샛불 (Saetbul) is a fictional smart-lamp app, coined for this sample. It is not a real product, company, logo, or claim. The phone's three modes carry the label 예시, and no number appears on screen.

## Format

- 1920×1080, 30 fps, 600 frames (20 s). Composition id `KitLaunch`, entry `entry.tsx`, component `Spot.tsx`. Dev server port 4511.
- Sound: `audio.json` (mood `upbeat`, 120 BPM, C major). Music at root volume 0.9. Sound effects come from motion (`MotionSound`), except none are hand placed.

## Palette (four colours, no others)

- ink `#0F172A` (dark scene, lines, text)
- paper `#F8FAFC` (hook and card background)
- accent `#F59E0B` (fills, the wipe's bright side)
- soft `#FEF3C7` (glass fill, pills, tagline)

Forbidden for variety: `#06C755`, Gothic A1.

## Fonts

- Headline: Do Hyeon 400 (`googleFont('Do Hyeon', {weights: [400]})`), for headlines and the name only.
- UI: IBM Plex Sans KR 500, for mode titles, pills and the tagline.
- Text mask: the `Glyphs` pattern from `examples/samples/cafe-morning/Spot.tsx`.

## Scene table (absolute frames, 30 fps)

| Frames | Time | What fills the frame | Motion | Text |
| --- | --- | --- | --- | --- |
| 0-90 | 0-3 s | Hook: Lightbulb 560 px, paper field | Bulb draws in (`draw` 0→1 over 0-75) | "어두운 방, 말 한마디" rises at 14 |
| 90-270 | 3-9 s | Phone 860 px on a soft field that grows out of the bulb's centre | Phone springs up from below (90-114); three mode tiles pop in at 130, 138, 146; one camera push at 150-190 | Titles "해 뜨는 아침", "달 뜨는 밤", "예약한 시간", each with a 예시 pill |
| 270-420 | 9-14 s | Lightbulb and Moon, dim (ink on ink) wiped to bright paper | Wipe left to right over 270-292 | "말로 켜고" (at 300), "말로 끕니다" (at 306) |
| 420-540 | 14-18 s | Lightbulb 420 px, its four parts assembling; name 샛불 at 320 px on ink | Parts 0→4 over 420-450; name rises from 440 | Tagline "스마트 조명 앱 · 가상 브랜드" at 480 |
| 540-600 | 18-20 s | hold: lockup | nothing moves | same |

"Fills the frame" names the thing that covers most of the picture in each row. No row is a bare background.

## Audio cues

- Music `/audio/generated/kit-launch/music.wav` at 0.9, sections on the 2 s bar lines (0, 4, 10, 14, 18, 20 s), energy 0.1 in the last 2 s.
- Hits at 3.0 s and 14.0 s (frames 90 and 420). At 120 BPM a bar is 2 s, so the 3 s hit falls at 1.5 bars and cannot sit on a bar line. The 14 s hit does.
- Effects are derived by the engine from motion: bulb draw (`ding`, appear), phone and text (`pop`, land), wipe (`whoosh`, move). Quiet frames 90 and 420 are the music hits.

## References and why

- `examples/samples/cafe-morning/Spot.tsx`: the `Glyphs` mask, `span`, `pop`, `push`, `MotionProbe` and `MotionSound` wiring, and the hard-cut scene switch.
- `docs/samples/rules.md`: sizes (headline 108 px, label 38 px, icon 65 px, hero 378 px), safe area, motion families, sound density.

## Prohibitions

- No glow, particles, bezel, real brand, real logo, or real number.
- No text below 38 px. No text inside an icon.
- No assets drawn in this file. Every visual comes from `@/assets`.
- No fade-only scene. Each cut changes an object.

## Check frames (contact sheet)

40, 75, 120, 170, 200, 260, 300, 340, 400, 440, 500, 590.

Scene events: bulb complete (75), phone landed (114), tile 3 landed (160), wipe mid (281), text rise (318), parts 2 of 4 (435), lockup settled (470).
