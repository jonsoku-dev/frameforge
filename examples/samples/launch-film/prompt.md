# launch-film

Purpose: a 30 s launch spot for a thermal tumbler that a paying client would put in front of customers. The viewer should feel the cold-coffee problem in four seconds, see a product worth wanting, believe one number, and leave with the name.
Fictional brand: 늘온 (NEULON), a Korean kitchenware brand, and its first product, the 늘온 텀블러. Not a real company, product or logo. Every number on screen is labelled 예시.

Format: 1920x1080, 30 fps, 900 frames, composition id `LaunchFilm`, port 4371.

## Art direction

- Palette, four colours: ink #17161A (night scenes, type on paper), paper #F1EBE0 (day scenes, type on ink and accent), accent #D94F2B "ember" (the tumbler's powder coat, the ring, the bars, the payoff field), soft #D8CFC1 "stone" (the steel band, the chart track). Contrast measured with WCAG: ink/paper 15.2, ink/accent 4.4, paper/accent 3.5, ink/soft 11.7; soft is never text on accent (2.7).
- Fonts: Noto Serif KR 900 for headlines, numbers and the name (an editorial serif: warmth, not tech); IBM Plex Sans KR 500 for labels.
- Hierarchy (short side 1080): number 380 px, name 230 px, headline 128 px (11.9 %), label 44 px. Nothing smaller than 44 px.
- One stroke, 14 px (1.3 %), for the ring, the plate ellipse, the leader lines and the chart; one corner radius, 24 px.
- Negative space: type sits left on a 96 px margin, the object sits right; half of every frame is one flat colour on purpose, and that half is always the scene's colour field, never an empty background.
- The one gradient: none. No glow, no particles, no icon library, no off-palette colour (the 3D materials are the palette hexes).

## Hero

A designed tumbler modelled in Blender by `shots/tumbler.py` (lathe profile with rounded foot and shoulder, ember powder coat with an orange-peel bump, a stone steel band, an ink lid with a domed top, sip slot and carry loop, an ink silicone foot ring, a debossed NEULON wordmark), rendered by `3d.json`:
- `hero` orbit −32° → 8°, 180 frames, the reveal (120-300).
- `section` the same tumbler cut in half (double wall with the vacuum gap, the coffee inside), dolly 9.4 → 7.6, 120 frames (300-420).
- `name` orbit 18° → 0°, 120 frames, then the last image holds (720-899).
All EEVEE, transparent film with the AO contact shadow, composited over the scene colour.

## Story

The current runs leftward (x−). Each row starts on its cut frame; every cut is a 24-frame `<Seam>` centred on it with both backgrounds named. Reserved vectors, two: Z forward at 300 (deeper into the product) and y− at 600 (the winning bar rises into the payoff). A carrier, the ember ring, is the degree mark of the cooling number and rides the current into the next scene, where it lands as the plate the tumbler rises from; it rides again into the name.

| Frames | Beat | Fills the frame | Motion | Seam into the next row | Text |
|---|---|---|---|---|---|
| 0-120 | Tension | ink field; a 380 px number counting 72 → 38 at right with the ember ring as its degree mark; two-line headline left | headline glyphs rise (GlyphRise), the number counts down from the first beat after frame 18 (Counter, 66 frames), the ring pulses on every beat | 120 cutTheCurve x−; from 96 the ring drops below the number, then rides left and lands as the plate at 142 | 커피는 / 식는다. · 오전 8시 → 오후 2시 · 예시 |
| 120-300 | Product | paper field; the ember tumbler (about 800 px tall) rises out of the ring plate at right and orbits; headline left | ring flattens into the plate, tumbler rises (card y), orbit render, glyph rise, label rise | 300 zoomThrough Z+: deeper into the tumbler | 식지 않게 / 끝까지. · 늘온 텀블러 · 520 ml |
| 300-420 | Mechanism | ink field; the cut-away tumbler (about 900 px) at right, two leader lines with labels; headline left | dolly render, leader lines draw, labels rise, WordCascade | 420 cutTheCurve x− | 열을 가두는 / 두 겹의 벽 · 스테인리스 내벽 · 이중 진공층 |
| 420-600 | Proof | paper field; a BarChart 1100 × 640 at right (three bars, 늘온 tallest), headline left | glyph rise, bars grow, values count; from 576 the 늘온 bar rises and widens into the ember field | 600 cutTheCurve y− (elevation): the payoff is born from the winning bar | 6시간 뒤 / 남은 온도 · 같은 조건 측정 · 예시 · 일반 머그 31° · 보통 텀블러 52° · 늘온 68° |
| 600-720 | Payoff | ember field; two lines at 141 px in paper, the paper ring (470 px) at right drawing closed around 68° | WordCascade, ring draws (stroke) and pulses on the beat, GlyphRise 68° | 720 cutTheCurve x−; the ring rides left and lands as the plate under the name tumbler | 아침의 온도 / 저녁까지 그대로. · 68° · 오후 6시 · 예시 |
| 720-899 | Name | ink field; ember tumbler (about 760 px) rises out of the ring at right, name left; still from 840 | tumbler rises, orbit render, LogoOutro, nothing moves after 840 | — | 늘온 · 처음 온도 그대로 · 늘온 텀블러 · 가상 브랜드 |

## Sound

`audio.json`: mood dramatic, 120 bpm (one bar = 2 s = 60 frames, so every cut is a bar line and `beatsFromSpec` puts the grid on the cuts). Sections: tension 0-4 (0.3), product 4-10 (0.55), mechanism 10-14 (0.65), proof 14-20 (0.8), payoff 20-24 (1.0), name 24-28 (0.45), hold 28-30 (0.08) so the music fades in the last 2 s. Hits on the big visual events: 4 s tumbler rises (lift), 10 s zoom into the wall (soft), 14 s proof (soft), 20 s payoff field (slam), 24 s name (lift). Effects derive from motion probes: `whoosh` on move (camera, card), `tick` on appear (text, the counter's steps), `thud` on land (card, shape); `quiet` holds the five hit frames.
Beat sync (`beatsFromSpec`): the cut frames are the grid's bar lines, the counter and the chart start on beats, the ring pulses on every beat in the tension and payoff scenes. The render derived four effects: thud at 145 and 743 (tumbler lands), tick at 332 and 616 (leader line, ring draw); whoosh derived none, every camera move sits inside a hit's quiet window.

## References

examples/samples/seam-reel (nested Seam tree, carrier above the tree), examples/samples/turntable-spot (scripted Blender subject, ImageSequence offset), examples/samples/blocks-reel (block usage, born-from fields).

## Prohibitions

No fade-only entrance, no rightward seam, no scene starting from rest after a cut, no glow, particles, gradient, bezel, icon library, real brand, text under 44 px, type over the render.

## Checks

Check frames (contact sheet): 40, 100, 114, 126, 160, 250, 296, 306, 380, 426, 520, 590, 606, 680, 714, 726, 800, 880.
`node bin/frameforge.mjs check renders/samples/launch-film.mp4 --film launch-film` must print PASS for frame-check, flash-check and seam-check.

## Review round (independent reviewer, 40 frames)

Changed: incoming type and objects start 8 frames before each cut; the next field colour sweeps in from the right under the outgoing content over the last 10 frames (120, 300, 420, 720); seams run one at a time (nesting stacked the first seam's paper under the Z seam); the number shows 72 from frame 0 and drops one step per beat (7 steps to 38); headlines use a local copy of the template's glyph rise with a 0.14 em mask so serif descenders and commas fit; the tumbler emerges through the plate's front arc. 3D: `light.environment` (stone sky gradient) and a numeric `shadowCatcher` darkness were added to `scripts/assets/blender_scene.py` (other films unchanged: both default to the old behaviour), studio strength 0.72 so the coat samples #D5502F against #D94F2B, two hard rims, satin ink lid, a vertical NEULON wordmark, and a lidless section with a stone vacuum gap, steel inner wall and softened cut edges. Proof: BarChart draws the competitors in stone, the 늘온 column and its 150 px 68° count are drawn on the chart's geometry in ember, the column opens into the payoff field with a clip-path. Payoff ring 470 px with 68° at 210 px. End card: name, a rule the name's width, tagline 72 px, label, lockup with the tumbler; a music hit at 26 s and a hand-placed swell tail at 800.
Engine finding (not fixed, outside this film's scope): `scripts/render.mjs` ducks the music with `sidechaincompress` keyed on the effects stem, and the mix ends when that stem ends; the first delivery's music stopped at 25.3 s after the last effect. The tail effect keeps the effects stem to 30 s here.
Product orbit is slow: frame-check sees still runs 170-225 and 235-290, so a spec line rises at 225.

## Measured

Full render 900 frames 60.4 s, audit empty; frame-check, flash-check, seam-check PASS (5 seams, each 7.7 → 10.9 ‰/f). Delivered mix: I −24.1 LUFS, LRA 3.3, TP −12.2; tension −28.2 dB RMS, payoff −24.3, name −24.4, music audible to 29 s (−32.5 dB) and fading in the last second (−43.5).
Not verified: listening by ear; another GPU.
