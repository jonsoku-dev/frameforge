# Sound

`audio.json` (schema and moods in `docs/audio-score.md`): `slug` = folder name, `durationSeconds`, `bpm`, `key`, `mood` (upbeat, calm, dramatic, minimal, tech, warm, corporate, lofi, house, hiphop, cinematic, ambient, chiptune), `sections` on bar lines with `energy` (last 2 s ≤ 0.15), `hits` (numbers or `{at, weight, style: slam|lift|soft}`) on visual events, `sfx[]` = `{name, intent, length, preset?}`, `seed`, `loudness {I: -24, TP: -2}`.

In the Spot: `<Audio src="/audio/generated/<slug>/music.wav" volume={0.9} />` at the root; report motion with `useMotionSound(key, value, {family: card|shape|text|wipe|camera, axis: x|y|scale|progress})` or `<MotionProbe id value family axis />`; declare `<MotionSound src="/audio/generated/<slug>/<name>.wav" role="move|land|appear" families quiet={[hit frames]} />`. Hand-placed `<Sequence from={n} durationInFrames={30} layout="none"><Audio .../></Sequence>` only for events without motion; the renderer rejects effects under 0.5 s apart or more than three in 4 s.

Generate and measure: `npm run score -- <audio.json>` then `python3 scripts/assets/score-report.py <music.wav> --spec <audio.json>` (I, LRA, continuity steps, arrangement jumps, per-hit numbers). Effects resolve text-to-sound (`ELEVENLABS_API_KEY`) → Openverse CC0 recording → synth preset; the pick is pinned in `public/audio/generated/<slug>/sfx.json`.
