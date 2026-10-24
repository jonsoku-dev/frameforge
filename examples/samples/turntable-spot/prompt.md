# turntable-spot

Purpose: a 24 s product spot that shows the three 3D levers at once: a Blender-rendered turntable hero played by `<ImageSequence>` over the film's paper, a Blender dolly shot on ink, and a CC0 model turning live in `<ThreeCanvas>` behind the name. A viewer should feel the glaze and remember the name.
Fictional brand: 결 세라믹 (a ceramics maker). Not a real company, product or logo. Labels say 렌더 예시 / 가상 브랜드.

Format: 1920x1080, 30 fps, 720 frames, composition id `TurntableSpot`, port 4325.
Palette: ink #1F1B18 (text, beats and dolly background), paper #F2ECE3 (hook, hero and name background), accent #C8553D (plate, glaze ring, bar), soft #DCCBB8 (cup body, motif fills). Four colours.
Fonts: Gothic A1 900 headlines (Glyphs rise), Noto Sans KR 500 labels.
Assets: kit `Mug` beside the ring, kit `Cup`, `Leaf`, `Heart` in the beats (`@/assets`, drawn in with `draw`). No icon library.
3D: `3d.json` → `npm run blender -- examples/samples/turntable-spot/3d.json` renders `hero` (torus, turntable, EEVEE 32 samples, 150 frames, transparent film with the AO contact shadow, 146 s on an M-series Mac) and `dolly` (cylinder, camera radius 13 → 7, sunset preset, 90 frames, 62 s) into `public/assets/generated/turntable-spot/3d/`. `models.json` → `npm run models` fetched Poly Haven `ceramic_vase_01` (CC0, James Ray Cock) into `models/vase/vase.gltf`; `models.lock.json` pins it. The vase scene is live `<ThreeCanvas>` with `<StudioLights>` and `<Turntable speed={0.12}>`, frozen for the hold.
Sizes (`SIZES`, short side 1080): headline 108 px (name 173 px), label 38 px (used at 49–57 px), icon 65 px (motifs 195–208 px), hero shape 378 px (ring about 626 px, cup body 420–760 px, vase about 430 px), margins 96 px / 54 px.

| Frames | Fills the frame | Motion | Text |
|---|---|---|---|
| 0-120 | Hook: accent plate (626 px circle) springs up at right on paper | spring plate, glyph rise | 손끝에 닿는 결, / 그 차이를 아시나요 |
| 120-300 | Hero: the Blender glaze ring rises in front of the plate, the plate shrinks away; the ring turns for 150 frames and holds; Mug motif pops beside it | card rise (probe), ImageSequence turntable, motif draw | 한 바퀴, / 빛이 도는 유약 · 유약 링 · 렌더 예시 |
| 300-420 | Beats: ink wipes in from the right; three kit motifs with labels | wipe (probe), spring pops, draw-in | 세 가지 결 · 손에 맞는 두께 / 자연에서 온 유약 / 오래 쓰는 마음 |
| 420-540 | Dolly: Blender cup body moves in over ink, one camera push | ImageSequence dolly, camera push (probe) | 가까이 볼수록 / 달라지는 결 |
| 540-660 | Name: paper wipes in, the CC0 vase turns at right in ThreeCanvas, name and bar rise | wipe (probe), spring scale, Turntable, glyph rise | 결 세라믹 · 손으로 빚은 결 · 가상 브랜드 |
| 660-719 | hold (Freeze at 659) | nothing moves | same |

Audio: /audio/generated/turntable-spot/music.wav at 0.9, upbeat 120 bpm (bar = 2 s, every scene starts on a bar line), hits at 4 s (ring lands), 10 s (beats), 14 s (dolly), 18 s (name). Effects come from the motion probes: whoosh on card/wipe/camera moves, impact on card/shape landings, quiet around the hits.
References: examples/samples/_template/Spot.tsx (Glyphs, probes, MotionSound), examples/samples/three-spin/Spot.tsx (ThreeCanvas camera and lights), docs/reference/three-d.md (spec fields).
Prohibitions: no glow, particles, bezel, real brand, text under 38 px. The transparent hero must sit on the paper, never on a black card.

Check frames (contact sheet): 40, 130, 180, 280, 330, 400, 440, 520, 560, 640, 700 (the ImageSequence scenes are 130–280 and 440–520; the Model scene 560–700).
Composition check: `npm run frame-check -- renders/samples/turntable-spot.mp4` must print PASS.

Verified: contact sheet of the check frames (ring, cup body and vase all present, text inside the safe area), `npx tsc --noEmit`, `npm run lint:video` (no findings), `npx tsx --test tests/three-d.test.tsx`, a 0–149 render to MP4. Not verified: the full 720-frame render, `frame-check` and `flash-check` on it (the integrator renders it), the look on a machine without Blender (then `npm run blender` stops and the already rendered PNGs are needed).
