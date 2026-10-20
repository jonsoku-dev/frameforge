# 모아루프

Purpose: 이십 대가 매달의 작은 저축을 자동으로 이어 가도록 돕고, 영상이 끝난 뒤 “매달 조금씩, 자동으로 모인다”를 기억하게 한다.

Fictional brand: 모아루프는 가상 저축 앱 이름이며 실제 회사·제품·로고와 무관하다. 화면의 숫자는 모두 예시다.

Format: 1920x1080, 30 fps, 450 frames, composition id `CmpMotionLuna56`, port 4455. Audio is generated from `audio.json`.

Palette: ink `#111827` for type and dark fields, paper `#F9FAFB` for clean fields, accent `#22C55E` for coins and actions, soft `#DCFCE7` for cards. No other colours.

Fonts: Black Han Sans 400 for headlines, Noto Sans KR 500 for UI labels. Safe area is 96 px left/right and 54 px top/bottom. Minimums are 108 px headline, 38 px label, 65 px icon, 378 px hero shape.

| Scene | Frames | Fills the frame | Motion | Text |
|---|---:|---|---|---|
| Hook | 0–74 | Ink field, a 400 px coin and a long slipping line | Coin springs in, line wipes across, coin exits toward the next stack | `매달 돈이\n새어 나가?` |
| Turn | 75–179 | Paper field, coin stack and rising curve | The hook coin lands as a stack, curve wipes from its base | `작은 금액도\n쌓이면` |
| Steps | 180–299 | Soft field with three large UI cards | Cards spring in left-to-right, lucide icons pop, values tick into place | `자동으로 이어지는 3단계`, `예시` labels |
| Promise | 300–389 | Accent field with a full-width paper wipe and large type | Wipe reveals promise, one 1.05 camera push at frame 312 | `매달 조금씩,\n자동으로 모인다` |
| Name | 360–449 | Ink field, accent coin and paper rule | Name and tagline arrive by frame 384, then remain still for frames 390–449 | `모아루프`, `작은 습관이 큰 여유로` |

Audio: `/audio/generated/cmp-motion-luna56/music.wav` at 0.9. `pop.wav` at frame 75, `whoosh.wav` at frame 180, `click.wav` at frames 204, 228, 252, and `impact.wav` at frames 300 and 360. Hits are 2.5 s, 10 s, and 12 s. The final two seconds are low energy and visually still.

References: `examples/samples/cafe-morning/Spot.tsx` for one root frame, Glyphs masks, continuity, and bounded camera pushes. `examples/samples/kinetic-typo/Spot.tsx` for Black Han Sans padding and rising headline rhythm. `docs/references/opus-5-5/aiidelist.md` for letting one object become the next scene’s material. `docs/references/opus-5-5/motion-studio-course.md` for still-frame inspection before full rendering.

Prohibitions: no real products, logos, claims, unlabeled numbers, glow, particles, gradients, bezels, faces, jewels, random time, state, effects, CSS animations, or fade-only entrances. Lucide icons are ISC licensed and inline.

Check frames: 15, 60, 120, 200, 260, 320, 400, 449.
