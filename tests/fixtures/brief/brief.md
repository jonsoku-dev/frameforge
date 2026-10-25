# who-am-i

## Request

> make a dynamic 10-second motion graphics video that shows who are you as Opus 5.5 - be as creative and dynamic as possible. Avoid the frames and texts on the corners which are typical ai made giveaways!

## Intent ledger

| Clause | Kind | Means | Verify |
|---|---|---|---|
| "make a dynamic 10-second motion graphics video" | must | 1920x1080, 60 fps, durationInFrames 600; continuous morph, camera on `springTrack` per axis inside `<CameraMotionBlur>` | brief duration check; frame-check motion share and frozen |
| "that shows who are you as Opus 5.5" | must | hero: one line of thought that recurs and changes state; `Thread` loops under "thinks", `TextField` behind "reads every word", `sliced` shader bust swept from scan-lines to gloss; the name "Opus 5.5" is the lockup | Structure rows 0-120 to 480-600; contact sheet per beat |
| "be as creative and dynamic as possible" | taste | maximal density: a new technique on every beat, never twice in a row; one push-through camera move; one full-frame texture moment (`grainField`) | frame-check static share; contact sheet shows a different technique per beat |
| "Avoid the frames and texts on the corners which are typical ai made giveaways!" | forbid | no corner readouts, no bezel or window frames, no `data-hud="allow"`; all copy centred inside the safe area | render audit has no `corner_hud`; contact sheet corners hold no text |
| a name card at the end | implied | `WordBeat` lockup "Opus 5.5" arriving by frame 510, drifting and glowing to the end | rows 480-600; frame-check end hold |
| a soundtrack | implied | `audio.json` 120 bpm, sections on bar lines, hits on the three biggest morphs | `score-report.py` transient_db |

## Engine translation

Concept: a thought becoming visible. One luminous line (the hero) is drawn, loops, knots into a scan-line bust that turns glossy, scatters into a field of words and resolves into the name. World: a dark ink field with warm grain. Palette: "monochrome and one accent" from showreel.md, ink #0E0E10, paper #F3EEE6, accent #FF6A3D. Families: type-led and 3D hero. Signature moves: `Thread` loop, `sliced` sweep (`u_mix`), `TextField` density, `WhipPan` between states, `WordBeat` name. 10 s, 1920x1080, 60 fps, continuous morph, `Cuts: none`. Audio: 120 bpm, five bars, hits on the knot, the gloss and the name.

Decision: the line-of-thought concept and the palette are our choices; the request left them open.

## Gaps

"Avoid the frames" is read as decorative borders, bezels and UI window frames (not video frames); stated to the user.
