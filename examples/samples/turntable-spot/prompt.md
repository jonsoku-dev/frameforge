# turntable-spot

Purpose: a 24 s product spot that shows the three 3D levers at once: a Blender-rendered turntable hero played by `<ImageSequence>` over the film's paper, a Blender dolly shot on ink, and a CC0 model turning live in `<ThreeCanvas>` behind the name. A viewer should feel the glaze and remember the name.
Fictional brand: 결 세라믹 (a ceramics maker). Not a real company, product or logo. Labels say 렌더 예시 / 가상 브랜드.

Format: 1920x1080, 30 fps, 720 frames, composition id `TurntableSpot`, port 4325.
Palette: ink #1F1B18 (text, beats background, the tiles' glaze), paper #F2ECE3 (hook, hero and dolly background), accent #C8553D (drawn mug, rendered mug, the vase, bar), soft #DCCBB8 (name background, motif fills). Four colours; every 3D subject is tinted to one of them.
Fonts: Gothic A1 900 headlines (Glyphs rise), Noto Sans KR 500 labels.
Assets: kit `Mug` drawn at 562 px in the hook (the form the rendered mug takes over), kit `Cup`, `Leaf`, `Heart` (`parts={2}`, no sparkles) at hero size (410 px) in the beats (`@/assets`, drawn in with `draw`); flat motifs never share a frame with a glossy render. No icon library.
3D: `3d.json` → `npm run blender -- examples/samples/turntable-spot/3d.json` renders `hero` (a scripted mug, `shots/mug.py`: open body with a solidified wall, bevelled rim and foot, inner lip, ink interior, cut torus handle, accent glaze roughness 0.5, turntable radius 10.5 height 4, EEVEE 32 samples, 150 frames, transparent film with the AO contact shadow at 80 %, about 175 s on an M-series Mac) and `dolly` (a scripted stack of three rounded tiles, `shots/tile.py`, ink stoneware roughness 0.6 with a low noise bump, studio preset, camera radius 12 → 8.8, 90 frames, about 105 s) into `public/assets/generated/turntable-spot/3d/`. `models.json` → `npm run models` fetched Poly Haven `ceramic_vase_01` (CC0, James Ray Cock) into `models/vase/vase.gltf`; `models.lock.json` pins it. The vase scene is live `<ThreeCanvas shadows>` with `<Model color={accent}>` (texture dropped, palette colour), `<StudioLights>` (the key casts a shadow onto a `shadowMaterial` floor) and `<Turntable speed={0.12}>`, frozen for the hold.
Sizes (`SIZES`, short side 1080): headline 108 px (name 173 px), label 38 px (used at 49–57 px), icon 65 px (motifs 195–208 px), hero shape 378 px (mug about 560 px, tile stack 680–920 px wide, vase about 640 px, kit motifs 410–562 px), margins 96 px / 54 px.

| Frames | Fills the frame | Motion | Text |
|---|---|---|---|
| 0-120 | Hook: the kit mug (562 px) springs up and draws in at right on paper, folds away in the last 20 frames | spring, draw-in, glyph rise | 손끝에 닿는 결, / 그 차이를 아시나요 |
| 120-300 | Hero: the Blender mug rises where the drawn mug was; it turns for 150 frames and holds, headline rises beside it from frame 124 | card rise (probe), ImageSequence turntable | 한 바퀴, / 손에 익는 유약 · 유약 머그 · 렌더 예시 |
| 300-420 | Beats: ink wipes in from the right; three kit motifs at 410 px with labels | wipe (probe), spring pops, draw-in | 세 가지 결 · 손에 맞는 두께 / 자연에서 온 유약 / 오래 쓰는 마음 |
| 420-540 | Dolly: paper wipes back; the Blender tile stack with its contact shadow moves in at right, one camera push | wipe, ImageSequence dolly, camera push (probe) | 가까이 볼수록 / 달라지는 결 |
| 540-660 | Name: soft wipes in, the accent vase turns at right on a shadowed floor in ThreeCanvas, name and bar rise from frame 548 | wipe (probe), spring scale, Turntable, glyph rise | 결 세라믹 · 손으로 빚은 결 · 가상 브랜드 |
| 660-719 | hold (Freeze at 659) | nothing moves | same |

Audio: /audio/generated/turntable-spot/music.wav at 0.9, upbeat 120 bpm (bar = 2 s, every scene starts on a bar line), hits at 4 s (mug lands), 10 s (beats), 14 s (dolly), 18 s (name). Effects come from the motion probes: whoosh on card/wipe/camera moves, impact on card/shape landings, quiet around the hits.
References: examples/samples/explainer-patterns/Spot.tsx (Glyphs, probes, MotionSound), examples/samples/three-spin/Spot.tsx (ThreeCanvas camera and lights), docs/reference/three-d.md (spec fields).
Prohibitions: no glow, particles, bezel, real brand, text under 38 px, no 3D colour outside the palette, no flat kit icon next to a glossy render. The transparent hero must sit on the paper, never on a black card.

Check frames (contact sheet): 40, 130, 180, 280, 330, 400, 440, 520, 560, 640, 700 (the ImageSequence scenes are 130–280 and 440–520; the Model scene 560–700).
Composition check: `npm run frame-check -- renders/samples/turntable-spot.mp4` must print PASS.

Verified: contact sheet of the check frames (mug, tile stack and vase all present, text inside the safe area), `npx tsc --noEmit`, `npm run lint:video` (no findings), `npx tsx --test tests/three-d.test.tsx`, a 0–149 render to MP4. Not verified: the full 720-frame render, `frame-check` and `flash-check` on it (the integrator renders it), the look on a machine without Blender (then `npm run blender` stops and the already rendered PNGs are needed).
