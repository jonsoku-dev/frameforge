# Seams

A film built from independently animated scenes looks like a slide deck: the eye's momentum dies at every cut. A seam is the cut treated as one motion that both scenes share. `src/packages/seams.tsx` (exported from `frameforge`) gives the curves and a `<Seam>` component; `scripts/seam-check.mjs` reads the motion dump a render writes (`<output>.motion.json`) and fails the film when a cut breaks the rules below.

## The vector law

How scene A exits decides how scene B enters.

- **Same axis.** x stays x, y stays y, Z stays Z.
- **Same direction.** Never mirrored. On Z the direction is the sign of d(scale)/dt: growing is a push, shrinking is a pull. A receding exit (shrinking) answered by an entry that grows from small is the classic violation: the eye was travelling backward and is thrown forward.
- **Matched speed.** The entry's first speed equals the exit's last speed. The exit eases in (power 4), the entry eases out (power 4), over the same distance and the same number of frames, so the two curves mirror at the cut. The incoming side is already at full speed when it appears; it never starts from rest.
- **Phase.** The cut lands mid-motion on both sides. A scene that settles before the cut, or starts from rest after it, is a dead beat.

## The current

One dominant direction per film, leftward by default. Every other vector is reserved and means something:

| Vector | Meaning | Function |
| --- | --- | --- |
| x− (the current) | the next thing | `cutTheCurve` |
| y− (upward) | elevation, reveal | `cutTheCurve({axis: 'y', direction: -1})` |
| Z forward (both sides grow) | deeper into the same thought | `zoomThrough` |
| Z backward (both sides shrink) | something bigger arrives | `inverseZoom` |
| scale burst | leaving a world | `zoomThrough` with `travel` ≥ 0.4 |

Consecutive seams never oppose each other: ping-pong reads as an error. A direction change needs a visible cause (a carrier object turns, a chapter card) or a chapter boundary.

## Motion performs, it never idles

- No wobble between entry and exit. Once a scene has arrived it holds or does one deliberate in-scene move (`nudge`), then exits.
- Stillness before a climax: the only pause in a film sits right before the name or the payoff.
- A carrier element can ride across a seam: it lives on the stage above both scenes, moves in the current, and lands inside the next scene (the coin in `examples/samples/seam-reel`).

## Blur and travel

- Blur the wrapper, never the children. Text-scale subjects peak at 10 px (`subject: 'text'`), full-frame surfaces at 18 px (`subject: 'surface'`, the default); both sides carry the same peak at the swap frame.
- Seams move about 12 % of the frame (230 px on x, 130 px on y, 0.12 on scale), never a full-frame slide. The stage colour (the root `AbsoluteFill` background) shows in the gap for a few frames; choose it on purpose.
- Z seams keep an opacity floor of 0.35 at the cut so the stage shows through and the two texts are never both readable.

## Catalogue

| Technique | Axis | What moves | Use |
| --- | --- | --- | --- |
| `cutTheCurve({frame, at, duration, axis?, direction?, travel?, subject?})` | x or y | both wrappers slide `travel` px, cut at `at + duration / 2` | the current, most cuts |
| `zoomThrough({frame, at, duration, travel?, subject?})` | z | exit 1 → 1.12, entry 0.88 → 1 | deeper into one card, one word, one thought |
| `inverseZoom(...)` | z | exit 1 → 0.88, entry 1.12 → 1 | a bigger surface arrives |
| `waterfallCut({frame, at, duration, words, stagger?})` | x | word i leaves `stagger` frames after word i − 1; the new words arrive in the same order; returns one fragment per word | headline to headline on one surface |
| `rackFocus({frame, at, duration, axis?})` | x or y | 3 % drift plus full blur at the cut | same surface, new subject |
| `waterfallEntry({frame, at, index, weight?, stagger?})` | in-scene | item `index` rises 12 % of the height, later and heavier items slower | title cards, card rows, lists |
| `nudge({frame, at, duration, from, to})` | in-scene | slow-fast-slow group slide, 10 / 65 / 25 of the time over 6 / 79 / 15 of the distance | re-centring a row before a zoom |

Each seam function returns `{axis, direction, cut, exit, entry}`; `exit` and `entry` are `{transform, opacity, filter, value}` for the two wrappers. Apply a fragment to one wrapper div around the whole scene (or the word), never to the children.

`<Seam at duration technique axis direction travel subject id from to>` renders `from` until the cut and `to` from the cut frame, applies the fragments to one absolute wrapper, and reports the wrapper's value as a camera probe (`<id>-out`, `<id>-in`) so the check can read both vectors. Seams nest: the `to` of one seam is the next seam.

```tsx
<Seam at={78} duration={24} id="s1" from={<Hook frame={frame} />} to={
  <Seam at={228} duration={24} technique="zoomThrough" id="s2" from={<Cards frame={frame} />} to={<Detail frame={frame} />} />
} />
```

## The check

```
npm run seam-check -- renders/samples/<slug>.mp4.motion.json --prompt examples/samples/<slug>/prompt.md
npm run seam-check -- renders/x.mp4.motion.json --scenes 90,240,390 [--window 12] [--json]
```

Boundaries are cut frames. `--scenes` lists them; `--prompt` reads the scene table of a brief: the first `a-b` range in every table row names that scene's frames and every row start after the first is a cut (fold the final still into the last row; a separate hold row is a boundary where nothing moves). Without either, boundaries are inferred from the frames where at least two probe keys appear or vanish at once.

For every boundary the outgoing vector is read over the last `window` frames (default 12) and the incoming vector over the first `window` frames: values are normalised to frame fractions (x / width, y / height, scale as is; `--width`, `--height` default 1920 × 1080), deltas are taken per probe key, the dominant axis is the largest summed |Δ|, the direction is the sign of the summed Δ on that axis, and the speed is the mean |Δ| per frame on it. Camera-family probes outrank the rest when any exist in the window (a `<Seam>` reports them), so a card dropping on y cannot hijack the seam's vector.

| Code | Severity | Rule |
| --- | --- | --- |
| `seam_axis_swap` | error | exit and entry move on different axes |
| `seam_mirrored_vector` | error | same axis, opposite sign (on Z: push answered by pull or the reverse) |
| `seam_dead_beat` | error | both sides below the rest speed, 0.0015 of the frame per frame (about 3 px) |
| `seam_speed_mismatch` | error | entry speed / exit speed outside 0.5–2 (a perfect mirror reads about 1.4: the exit's final step into the cut frame is never sampled, so the exit reads slower) |
| `seam_pingpong` | error | two consecutive seams on one axis with opposite directions |
| `seam_no_motion_data` | warning | no probe within `window` frames on one side |

Boundaries whose windows fall outside the rendered range are skipped and listed, so a `--frame-range` part render checks only the seams it contains. Exit code 1 on any error; `--json` prints `{boundaries, skipped, current, vectors, findings}` with a `fix` sentence per finding.

## Worked ledger

`examples/samples/seam-reel` (30 s, cuts at 90, 240, 390, 540, 690):

| Cut | Technique | Out | In | Reading |
| --- | --- | --- | --- | --- |
| 90 | cutTheCurve | x− 7.7 ‰/f | x− 10.9 ‰/f | the current; a coin rides across and lands in the 식비 card |
| 240 | zoomThrough | z+ 7.7 ‰/f | z+ 10.9 ‰/f | deeper into that card |
| 390 | waterfallCut | x− 39.4 ‰/f (four word probes summed) | x− 43.2 ‰/f | headline words leave and arrive in order on one surface |
| 540 | inverseZoom | z− 7.7 ‰/f | z− 10.9 ‰/f | the accent field arrives, bigger than the card |
| 690 | rackFocus | x− 1.9 ‰/f | x− 2.7 ‰/f | focus pulls from the wave to the name; stillness before it |

Measured with three part renders (`--frame-range 0-149`, `226-404`, `526-704`) and `--prompt`; each run skips the boundaries outside its range.

The two Z seams are separated by an x seam, so no two consecutive seams oppose. `tests/fixtures/seams/mirrored.motion.json` is the same first seam with the entry arriving from the left and moving right; the check reports `seam_mirrored_vector` and exits 1.
