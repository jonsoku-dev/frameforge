# GenerativeIdent (물결 스튜디오, 가상 브랜드)

## 알고리즘 철학

이 작품의 배경은 손으로 그린 그림이 아니라 규칙이다. 규칙은 셋이다.

1. **표현하는 것.** 작은 결(grain)이 모여 큰 물결이 되는 과정. 오로라는 결이 쌓인 하늘이고, 흐름장은 결이 한 방향으로 정렬되는 순간이며, 마지막 카드의 그레인은 결 하나하나로 돌아간 상태다.
2. **규칙.** 모든 선과 띠는 `(seed, t)`의 닫힌 함수다. 프레임 사이에 누적되는 상태가 없으므로 어느 프레임이든 혼자 그릴 수 있고, 같은 시드는 같은 그림을 준다. 색은 작품의 네 색만 쓴다. 배경은 글자와 겨루지 않는다. 글자가 있는 동안 배경의 선은 가늘고 알파는 낮다.
3. **거부하는 것.** 글로우, 먼지 파티클, 두 번째 그라데이션(오로라가 이 작품의 유일한 그라데이션이다), 붙여 넣은 아이콘, 프레임마다 다른 난수.

Purpose: an 18-second studio ident that shows a fictional motion studio's language: a wave that becomes a current, a sentence drawn over by hand, a grained final card. The viewer should remember the name 물결 스튜디오.
Fictional brand: 물결 스튜디오 ("ripple studio"). No real company, product or logo. The tagline is fictional. No numbers appear on screen; the only label reads "가상 브랜드".

Format: 1920x1080, 30 fps, 540 frames, composition id `GenerativeIdent`, render port 4326.
Palette (four colours): ink #0B1020 (background), paper #F3F0E8 (second background, strokes on ink), accent #FF7A59 (wave fill, annotations, bar), soft #7FB8FF (wave swell, aurora, tagline).
Fonts: Gothic A1 900 headlines (Glyphs rise), Noto Sans KR 500 labels.
Assets: the kit `Wave` from `@/assets` at every size (hero 491 px, mark 207 px, top-left reduction 169 px), one stroke 16 px at hero size scaled per size, one radius 8. No icon library, no own drawing.
Generative systems: `aurora` (seed `mulgyeol`, bands 4, speed 0.06, height 0.2, amplitude 0.08, fit fill) under the open and the flow; `flowField` (seed `mulgyeol-flow`, 130 lines, grow 3.2 s, paper and soft only) inside a `Sequence` from 120 so it grows from the scene start. The aurora seed, band count and speed are the composition's `variables` (studio tune tab, group 배경), taken from `aurora.schema`.
Effects: `lightLeakEffect` on a transparent `Solid` over the seam (236–262, seed `seam`); `vignetteEffect` 0.55 and `grainEffect` (seed `card`, size 2, amount 0.1, frame clamped at 480) on a transparent `Solid` over the name card. The grain frame stops at the hold so the last two seconds are pixel-identical.
Annotations: `Highlight` behind 형태 (flow), `Underline` under 작은 결이 and `Encircle` around 큰 물결로 (statement); all drawn by `progress` with seeded roughness, no DOM measurement.
Sizes (short side 1080): headline 108 px, name 162 px, label 38 px (tagline 49 px), icon 65 px, hero 491 px, margins 96 / 54 px.

Motion families: spring (wave entrance, wave rise, name), wipe (paper from the left, ink from the right, clip-path), glyph rise (every headline) plus the annotations' stroke draw. Camera push: one, 390–422, on the name card only (scaling the whole stack moved the statement text 3 px past the safe margin at 391–405).

| Frames | Fills the frame | Motion | Text |
|---|---|---|---|
| 0–120 (0–4 s) | the aurora on ink and the wave hero, 491 px, centred | wave springs in at 0 and draws its lines 8–58; tagline fades in 66–80 and out 108–120; the aurora drifts | 흐름을 그리는 스튜디오 · 가상 브랜드 (label) |
| 120–240 (4–8 s) | the flow field growing over the aurora; the wave shrinks into the top-left mark 120–150 | streamlines grow 120–216; headline rises 150–176; highlight draws 192–214 | 흐름은 / 형태가 된다 (형태 highlighted) |
| 240–262 | the paper wipe from the left (240–258) with the light leak sweeping over it (236–262) | wave rises from below 240–262 | none until 248 |
| 246–390 (8.2–13 s) | paper, the wave on the right at 491 px assembling in four parts 250–294, the two headline lines | lines rise 248–290; underline 264–280; circle 280–306 | 작은 결이 / 큰 물결로 (underlined, circled) |
| 390–480 (13–16 s) | the ink wipe from the right (390–406), then the name card: mark, name, bar, tagline, under vignette and grain | mark fades 396–410; name rises 398–436; bar 430–446; tagline 438–450 | 물결 스튜디오 / 흐름을 그리는 스튜디오 · 가상 브랜드 |
| 480–539 | the same card | nothing moves (grain frozen at 480) | same |

Continuity: the wave is one object across every cut (hero, mark, assembled statement wave, name mark). The aurora runs under both the open and the flow, so the second scene is born inside the first.

Audio: /audio/generated/generative-ident/music.wav at 0.9, 120 BPM (a bar is 2 s), D minor, mood cinematic (the generator warns that 120 is above its usual 60–110 for cinematic; the bar grid needs 2 s sections). Sections 0–4 open 0.3, 4–8 flow 0.65, 8–14 statement 0.8, 14–16 name 0.5, 16–18 hold 0.1. Hits at 4 s (flow start) and 13 s (name card). Effects come from motion: `MotionSound` move = whoosh (wipe, card), land = impact (shape, card), appear = stroke (text: highlight and circle progress probes). `quiet={[120, 390]}`.

References: examples/samples/_template/Spot.tsx (SIZES, span/pop/push, Glyphs), examples/samples/shape-noise/Spot.tsx (noise field, one object across cuts), docs/reference/generative.md and docs/reference/effects.md (the systems and the effects used here).

Prohibitions: no glow, no dust particles, no second gradient, no frame border, no bezel, no real brand, no number on screen, no icon library, no text under the label size, no full-frame flash.

Check frames (contact sheet): 20, 80, 110, 135, 170, 215, 246, 256, 262, 275, 320, 360, 420, 500.
Verified: `npx tsc --noEmit` (own files clean), `npm test`, `npm run lint:video` (no findings), `npm run score`, the contact sheet above, a 0–149 part render. Not verified: a full 540-frame render, `frame-check` and `flash-check` on it (the integrator renders full films; seven renders share this machine). The contact sheet shows a dark 5 px strip at the left edge of some cells; a full-resolution render of frame 256 has no such strip, so it is a sheet artefact.
