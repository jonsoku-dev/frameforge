# transitions-reel

**Purpose.** A 20-second four-city reel in which each cut is a different TransitionSeries presentation, so the viewer reads the transitions themselves as the story. This sample tests the `TransitionSeries` engine features and the motion-driven sound path.

**Fiction.** 하루길 is a fictional travel app, coined for this sample. It is not a real product, company, logo, or claim. The cities are real places shown as drawn landmarks only. All numbers on screen are 예시 (example) values, labelled 예시.

## Format

- 1920×1080, 30 fps, 600 frames (20 s). Composition id `TransitionsReel`, entry `entry.tsx`, component `Spot.tsx`.
- Sound: `audio.json` (mood `house`, 120 BPM, A minor). Music at root volume 0.9. Motion sound: `pop` on landmark landings (role `land`, family `shape`), `whoosh` on transition sweeps (role `move`, family `wipe`). Both declared with `<MotionSound>`, quiet on the music hits at 120 and 480.

## Palette (four colours, no others)

- ink `#0F172A` (title and name scenes, dark city)
- paper `#F8FAFC` (Seoul scene)
- accent `#F43F5E` (accent sun, Jeju field, pills, bars)
- soft `#FFE4E6` (sun disc, tagline, title subline)

## Fonts

- Headline: Gowun Batang 700 (`googleFont('Gowun Batang', {weights: [700]})`), for the city names and the 하루길 lockup only.
- UI: Noto Sans KR 500, for labels, pills and taglines.

## Timeline

Scenes are placed on absolute frames. Each transition starts on a bar line (60 frames = one bar at 120 BPM). The leading fade does not shorten the film; the four joins between scenes do.

| Scene | Frames | Time | Length | What fills the frame |
| --- | --- | --- | --- | --- |
| Title | 0–137 | 0–4.6 s | 138 | Ink field, 하루길 at 260 px, accent bar, subline |
| 서울 | 120–259 | 4.0–8.6 s | 140 | Paper field, soft sun disc, tower (`Tower`, seven shapes) |
| 부산 | 240–375 | 8.0–12.5 s | 136 | Ink field, accent sun disc, suspension bridge (`Bridge`, six shapes) |
| 제주 | 360–499 | 12.0–16.6 s | 140 | Accent field, soft sun disc, volcano with a crater (`Volcano`, five shapes) |
| 하루길 lockup | 480–599 | 16.0–20.0 s | 120 | Ink field, 하루길 at 320 px, accent bar, tagline |

Transitions, in order:

| Frames | Presentation | Timing | Length | Between |
| --- | --- | --- | --- | --- |
| 0–15 | `fade()` | `linearTiming` 16 | 16 | leading, into the title |
| 120–137 | `slide({direction: 'from-right'})` | `springTiming` 18 | 18 | title → 서울 |
| 240–259 | `wipe({direction: 'from-top-left'})` | `linearTiming` 20 | 20 | 서울 → 부산 |
| 360–375 | `clockWipe({width: 1920, height: 1080})` | `springTiming` 16 | 16 | 부산 → 제주 |
| 480–499 | `iris({width: 1920, height: 1080})` | `springTiming` 20 | 20 | 제주 → lockup |

Each transition progress is reported with `<MotionProbe family="wipe" axis="progress">`, computed from its own timing at the transition's start frame.

## Motion

- Each city landmark springs in from its centre-bottom at local frame 8 (frames 128, 248, 368). Its scale is probed as family `shape`, axis `scale`.
- City name rises per glyph at local frame 6. Number pill fades in at local frame 30.
- Title and lockup: per-glyph rise, then accent bar scaleX, then subline opacity.
- Nothing moves after frame 530. The last 2 s hold still.

## Audio cue list

| Frames | Seconds | Cue |
| --- | --- | --- |
| 0 | 0.0 | Fade in, title (no sfx) |
| 120 | 4.0 | Music hit. Slide begins. Seoul landmark lands at 128 (pop, motion-derived) |
| 240 | 8.0 | Wipe sweeps (whoosh, motion-derived). Busan landmark lands at 248 |
| 360 | 12.0 | Clock wipe. Jeju landmark lands at 368 |
| 480 | 16.0 | Music hit. Iris opens on the lockup |

Sections: 0–4 title (0.3), 4–12 seoul-busan (0.8), 12–16 jeju (0.75), 16–18 name (0.6), 18–20 hold (0.12). Every section starts on a bar line.

## Scene-by-scene check frames

0, 8, 40, 100, 125, 150, 200, 250, 300, 350, 380, 420, 470, 500, 530, 580.

## References

- `examples/samples/cafe-morning/Spot.tsx` for the `Glyphs` rise mask, `span`, `pop`, `MotionProbe`, and `MotionSound` wiring.
- `examples/samples/_template` for the size table (headline ≥ 10% of the short side, labels ≥ 3.5%, hero ≥ 35%).
- `tests/transitions.test.tsx` and `src/packages/transitions.tsx` for presentation and timing semantics.

## Prohibitions

- No real brand, logo, city-government mark, or real figure. The landmarks are generic drawn silhouettes.
- No icon library. The three landmarks are drawn in `assets.tsx` with one stroke (`STROKE` 8 of a 400 viewBox, about 17 px at 840 px) and one radius (`RADIUS` 16), filled only in accent and soft. Contact sheet: `.scratch/samples/transitions-reel/assets-sheet.png`.
- No glow, particles, frame borders, or gradients.
- No Gothic A1, no `#06C755`, no Black Han Sans (used by cafe-morning).
- No hand-placed `<Sequence><Audio/>` for anything with motion. Only the root music.

## Decisions to check

- Five presentations for five scenes means one leading transition (`fade`) plus four joins. The engine allows a leading transition; it does not shorten the film.
- Transition probes cover all five transitions, including the fade. The brief says each one, so the fade is reported as family `wipe`.
