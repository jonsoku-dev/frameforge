# morph-ui

The worked example for the six-section brief (`docs/samples/rules.md` 기획 구조) and for the continuous-morph grammar: one shape, never cut, the camera reframing every state, 60 fps with motion blur.

## Inputs

- Purpose: a 16 s product ident for a routine app. A viewer should feel "one tap and it's done" and remember the name.
- Fictional brand: 똑딱. Not a real company, product or logo. Every number on screen is labelled 예시.
- States the hero becomes: button, loader, check, toggle, slider, tabs, chart card, toast, name pill.
- Palette: paper #ECE9E4 (warm grey canvas), soft #D5D0C8 (tracks, quiet bars), ink #161616 (text, dark surfaces), accent #E2461C (the hero, the active thing).
- Fonts: Gothic A1 800 (numbers, the name), Noto Sans KR 500/700 (UI labels).
- Music: 120 BPM, generated from `audio.json` (mood tech, A minor).

## Direction

Dribbble-level UI motion. One shape, never cut: every state is the same element changing its width, height, radius and colour while its content swaps with a short blur. A cursor drives the changes with real clicks and one real drag. Warm-grey canvas, black and white components, one accent. Springs everywhere with a tiny overshoot at most (damping near critical). The camera zooms so each state fills the frame: close on the button and the loader, wide on the slider and the chart. It ends on the name pill and a 2 s still.

Banned: headline-plus-three-cards layouts, cuts, fade-only entrances, bouncy easing, particle bursts, glows, gradients on UI chrome, a stock icon set, dead beats, anything that looks like a template.

## Structure

120 BPM, 8 bars, something happens on every beat (one beat = 30 frames at 60 fps).

| Frames | Beat | The hero becomes | The camera fills the frame with | Text |
|---|---|---|---|---|
| 0-60 | 0–1 | accent pill button; the cursor arrives | the button (scale 3.3 settling to 2.7) | 시작하기 |
| 60-120 | 2–3 | click: the pill shrinks to a circle with a spinning ring | the circle (3.6) | none |
| 120-180 | 4–5 | the ring becomes a drawn check | the circle | none |
| 180-270 | 6–8 | the circle stretches into a dark toggle; click on beat 7, the knob slides with its leading edge ahead, the track turns accent | the toggle (3.3) | 알림 꺼짐 / 켜짐 |
| 270-420 | 9–13 | the toggle thins into a slider track; the cursor grabs the knob on beat 10 and drags it to beat 13 | the slider (1.6) | 하루 목표, 5,000보 to 10,600보, 예시 |
| 420-600 | 14–19 | the track thickens into tabs; the fill becomes the indicator; clicks on beats 16 and 18 stretch it across | the tabs | 오늘 / 이번 주 / 이번 달 |
| 600-720 | 20–23 | the tabs open into a dark chart card; bars grow; hover on 토 on beat 22 shows a tooltip | the card (1.3) | 이번 주 걸음, 예시, 12,400보 · +12% |
| 720-780 | 24–25 | the card collapses into a toast | the toast (2.0) | 오늘 기록을 저장했어요 |
| 780-959 | 26–31 | the toast becomes the accent name pill; still from 840 | the pill and the tagline (1.7) | 똑딱, 하루 루틴을 한 번에 · 가상 브랜드 |

Cuts: none

## Build

- Format: 1920x1080, 60 fps, 960 frames, composition id `MorphUi`.
- Beats come from `beatsFromSpec(audio.json, 60)`; `AT` in Spot.tsx names the beat each state starts on.
- Width, height, radius, camera scale, cursor x/y and the accent bar edges are `springTrack`s: one spring per change, so each stays a pure function of the frame. The toggle knob and the tab indicator have a slow trailing edge and a fast leading edge.
- The drag is direct manipulation: while held, the knob's x follows an eased curve and the cursor sits on the knob; the step count is computed from the knob position.
- Motion blur: `<CameraMotionBlur shutterAngle={180} samples={4}>` around the picture. `Audio`, `MotionSound` and the probes (camera scale, hero width, cursor press) sit outside it at the root.
- Sound: sections on bar lines, hits on the check (2 s), the chart (10 s) and the name (13 s). Derived effects: a click when the cursor press lands, a swish when the camera moves; the engine thins them.
- Assets: the cursor is the only drawn asset (`assets.tsx`); everything else is the hero itself plus text.
- Before the full render: a contact sheet at 20, 75, 135, 200, 240, 290, 345, 400, 450, 500, 560, 640, 690, 750, 820, 900.
- Check: `node bin/frameforge.mjs check renders/samples/morph-ui.mp4 --film morph-ui`.
- References: none outside this folder; the build list above is the method.

## Gotchas

- The cursor is drawn in screen space, outside the camera transform, or it would grow to four times its size on the close shots.
- `interpolate` needs a finite input range: a state that never exits uses a far-off frame, not `Infinity`.
- `grid.beatAt(frame)` takes a frame, not a beat index; beat n is `beatAt(0) + n * framesPerBeat`.
- Text that swaps inside the morphing shape gets its own blurred exit and entry, so 시작하기 has left before the ring appears.

## Start

The Structure table was the first thing written; the code followed it beat by beat.
