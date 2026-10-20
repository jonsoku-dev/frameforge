# TODO-slug

Copy this folder to `examples/samples/<slug>/`. Rename `template.audio.json` to `audio.json` and set its `slug` to `<slug>`; change `/audio/generated/template/` in `Spot.tsx` to `/audio/generated/<slug>/`; rename `TemplateSpot` and the composition id in `entry.tsx`. Fill every TODO below and in the copy, keep `SIZES`.

Purpose: TODO one sentence. Who watches it and what they should do after.
Fictional brand: TODO name. Not a real company, product or logo. Numbers are labelled "예시" or "샘플 데이터".

Format: 1920x1080, 30 fps, 600 frames, composition id `TODO`, port TODO.
Palette: ink #111111 (TODO role), paper #F4F4F1 (TODO role), accent #2F5BFF (TODO role). Four colours at most.
Fonts: Gothic A1 900 headlines (Glyphs rise), Noto Sans KR 500 labels.
Assets: TODO hero and its reductions. Prefer the motif kit (`import {Cup} from '@/assets'`) or an `assets.json` resolved by `npm run art` and drawn with `<Art>`; draw in `assets.tsx` (one `STROKE`, one `RADIUS`; replace the placeholder `Cup` and `Card`) only what neither covers. No icon library.
Sizes (`SIZES` in Spot.tsx, short side 1080): headline 108 px, label 38 px, icon 65 px, hero shape 378 px, margins 96 px / 54 px. Nothing smaller.

| Frames | Fills the frame | Motion | Text |
|---|---|---|---|
| 0-90 | Hook: TODO | TODO | TODO |
| 90-210 | Beat: TODO | TODO | TODO |
| 210-330 | Beat: TODO | TODO | TODO |
| 330-450 | Promise: TODO | TODO | TODO |
| 450-540 | Name: TODO | TODO | TODO |
| 540-599 | hold | nothing moves | same |

"Fills the frame" names the thing that covers most of the picture in that row. If the answer is "the background", the row is empty: add a hero shape, a screen card or a full-bleed colour.

Audio: /audio/generated/<slug>/music.wav at 0.9. TODO sfx name at TODO frames (each one an on-screen event). `hits` in audio.json at the same seconds.
References: TODO file and why (e.g. examples/samples/cafe-morning/Spot.tsx for Glyphs, motion probes and MotionSound, examples/samples/_template/Spot.tsx for Callout and Screen).
Prohibitions: TODO. Always: no glow, particles, bezel, real brand, text smaller than `SIZES.label`.

Check frames (contact sheet): 40, 150, 270, 390, 500, 590, plus TODO one frame per scene event.
Composition check: `npm run frame-check -- renders/samples/<slug>.mp4` must print PASS.
