# Seams

A shared motion across a cut can preserve the eye's momentum; a deliberate cut or settled state can also serve the story. `src/packages/seams.tsx` (exported from `frameforge`) gives curves and a `<Seam>` component. `scripts/seam-check.mjs` reads a render's motion dump (`<output>.motion.json`) and measures the vector criteria below. A diagnostic failure is not itself an artistic verdict: examine the interval and report the actual result even when the difference is intentional.

## Shared-vector pattern

When a continuous shared vector serves the transition, compare scene A's exit with scene B's entry:

- **Same axis.** x stays x, y stays y, Z stays Z.
- **Same direction.** A reversal changes perceived momentum; use it deliberately when it serves the subject. On Z the direction is the sign of d(scale)/dt: growing is a push, shrinking is a pull. A receding exit followed by an entry growing from small reverses that motion.
- **Matched speed.** The entry's first speed equals the exit's last speed. The exit eases in (power 4), the entry eases out (power 4), over the same distance and the same number of frames, so the two curves mirror at the cut. The incoming side is already at full speed when it appears; it never starts from rest.
- **Phase.** For this continuous pattern the cut lands mid-motion on both sides. A settled state before or after a cut may instead serve reading or emphasis; the check can still flag it as a dead beat.

## The current

One possible approach is to assign directions consistently to meanings; choose the mapping for the film rather than assuming a default:

| Vector | Meaning | Function |
| --- | --- | --- |
| x− (the current) | the next thing | `cutTheCurve` |
| y− (upward) | elevation, reveal | `cutTheCurve({axis: 'y', direction: -1})` |
| Z forward (both sides grow) | deeper into the same thought | `zoomThrough` |
| Z backward (both sides shrink) | something bigger arrives | `inverseZoom` |
| scale burst | leaving a world | `zoomThrough` with `travel` ≥ 0.4 |

Opposing consecutive seams can create unintended ping-pong; compare them with the intended focus and rhythm. A direction change can also communicate a new event or a chapter boundary.

## In-scene motion and holds

- Choose in-scene movement for its purpose, for example a `nudge` that moves attention to the next piece of information; repeated state changes can be appropriate.
- Holds can create emphasis or provide reading time anywhere in a film. Compare each interval's length and information against its purpose instead of adding movement to satisfy a diagnostic.
- A carrier element can ride across a seam: it lives on the stage above both scenes, moves in the current, and lands inside the next scene (the coin in `examples/samples/seam-reel`).

## Blur and travel

- The provided helper applies blur to a wrapper: its text preset peaks at 10 px (`subject: 'text'`) and its surface preset at 18 px (`subject: 'surface'`, the default). Choose a treatment that preserves needed text readability.
- The examples use about 12 % frame travel (230 px on x, 130 px on y, 0.12 on scale); another distance or a full-frame move may fit a different transition. For `<Seam>`, supply each scene's background (`fromBackground`, `toBackground`) when the displaced picture should extend beyond the frame.
- The helper's Z seam uses an opacity floor of 0.35 at the cut. Check that overlapping text remains legible for the chosen design.

## Catalogue

| Technique | Axis | What moves | Use |
| --- | --- | --- | --- |
| `cutTheCurve({frame, at, duration, axis?, direction?, travel?, subject?})` | x or y | both wrappers slide `travel` px, cut at `at + duration / 2` | the current, most cuts |
| `zoomThrough({frame, at, duration, travel?, subject?})` | z | exit 1 → 1.12, entry 0.88 → 1 | deeper into one card, one word, one thought |
| `inverseZoom(...)` | z | exit 1 → 0.88, entry 1.12 → 1 | a bigger surface arrives |
| `waterfallCut({frame, at, duration, words, stagger?})` | x | the row shares one `cutTheCurve` offset (spacing never changes); word i dissolves `stagger` frames after word i − 1 and the new words sharpen in the same order; one fragment per word | headline to headline on one surface |
| `rackFocus({frame, at, duration, axis?})` | x or y | 3 % drift plus full blur at the cut | same surface, new subject |
| `waterfallEntry({frame, at, index, weight?, stagger?})` | in-scene | item `index` rises 12 % of the height, later and heavier items slower | title cards, card rows, lists |
| `nudge({frame, at, duration, from, to})` | in-scene | slow-fast-slow group slide, 10 / 65 / 25 of the time over 6 / 79 / 15 of the distance | re-centring a row before a zoom |

Each seam function returns `{axis, direction, cut, exit, entry}`; `exit` and `entry` are `{transform, opacity, filter, value}` for the two wrappers. Apply a fragment to one wrapper div around the whole scene (or the word), never to the children.

`<Seam at duration technique axis direction travel subject id from to fromBackground toBackground>` renders `from` until the cut and `to` from the cut frame, applies the fragments to one absolute wrapper, and reports the wrapper's value as a camera probe (`<id>-out`, `<id>-in`) so the check can read both vectors. Seams nest: the `to` of one seam is the next seam.

```tsx
<Seam at={78} duration={24} id="s1" fromBackground={ink} toBackground={paper} from={<Hook frame={frame} />} to={
  <Seam at={228} duration={24} technique="zoomThrough" id="s2" fromBackground={paper} toBackground={paper} from={<Cards frame={frame} />} to={<Detail frame={frame} />} />
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
| `seam_dead_beat` | error | either side below the rest speed, 0.0015 of the frame per frame (about 3 px): settling before the cut or starting from rest after it |
| `seam_speed_mismatch` | error | both sides move but entry speed / exit speed is outside 0.5–2 (a perfect mirror reads about 1.4: the exit's final step into the cut frame is never sampled, so the exit reads slower) |
| `seam_pingpong` | error | two consecutive measured seams on one axis with opposite directions |
| `seam_unmeasured` | warning | one or both sides have no camera-family probe in the window; the vectors other probes showed are printed |
| `seam_no_motion_data` | warning | no probe at all within `window` frames on one side |

A boundary is measured, and can fail, only when both sides carry camera-family probes, which `<Seam>` reports. A film that does not use `<Seam>` (plain wipes, hard cuts) gets warnings, not failures: the check exits 0 and prints `PASS with n warning(s)`.

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
