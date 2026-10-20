Purpose: Tease a fictional interval workout app by turning three repeating countdown beats into its name and promise.

Format: 1080×1920, 30 fps, 10 seconds, 300 frames. Composition id `FitnessTimer`.

Palette: ink `#0F172A`, lime `#C6F135`, paper `#F8FAFC`.

Fonts: Anton 400 for the headline and app name. Noto Sans KR 500 for interface labels and the promise.

The app name “Movoza” is fictional and coined for this sample. It is not a real product or company.

| Frames | What fills the frame | Motion and text |
| --- | --- | --- |
| 0–180 | Lime field, ink countdown number, icon, and progress rail | A 60-frame `Loop` repeats three times. Each loop shoves 3, 2, 1 upward in 20-frame beats. Dumbbell, Flame, and Timer correspond to the three loop iterations, selected from the absolute frame. Progress fills once per loop. “샘플 데이터” labels the illustrative countdown. |
| 180–240 | Ink field with three lime rails and the centered Movoza lockup | The three rails travel inward from their timer positions and stack as an underline. “Movoza” rises in; one camera push settles by frame 240. The name is fully visible at frame 240. |
| 240–300 | Paper field with ink name, lime underline, and ink promise | Hold still: “Movoza” and “딱 3초, 바로 시작.” are already present at frame 240 and remain unchanged through the end. |

Audio: spec `audio.json` (tech, 130 bpm, A minor, seed 21). Sections round 1 0-3s (0.6), round 3 3-6s (0.8), cut 6-8s (0.9), hold 8-10s (0.1). Hits at 8 s. Music `/audio/generated/fitness-timer/music.wav` at the root, volume 0.9. SFX in `/audio/generated/fitness-timer/<name>.wav`, volume 0.8, at frames click.wav 0, 20, 40, ..., 160; impact.wav 240.

References: `examples/samples/cafe-morning/Spot.tsx` for the deterministic `span`, `Glyphs`, audio, and camera-push patterns. `docs/references/opus-5-5/motion-studio-course.md` for readable motion beats and controlled emphasis. Lucide React (ISC) supplies the three small icons.

Prohibitions: No real company or product, logo, unsupported workout result, extra palette color, third font, flash, phone frame, glow, or moving text after frame 240. The numbers are illustrative and labeled “샘플 데이터.”

Check frames: 0, 19, 20, 59, 60, 119, 120, 179, 180, 210, 239, 240, 270, 299.
