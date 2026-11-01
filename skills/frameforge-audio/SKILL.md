---
name: frameforge-audio
description: Music and sound for a Frameforge film: audio.json spec (mood, bpm, sections, hits, sfx intents), generation, measurement, motion-derived sound effects, ducking. Use when sound is missing, stitched, too dense or needs tuning.
---

# Audio

Read `../frameforge-best-practices/references/sound.md` and `docs/audio-score.md`. Write `audio.json` from the scene table (sections on bar lines, hits on visual events with weight/style when needed, sfx intents with length), run `npm run score -- examples/samples/<slug>/audio.json`, measure with `scripts/assets/score-report.py`, and let the engine place effects from motion probes (`useMotionSound`, `<MotionProbe>`, `<MotionSound>`). Providers for effects: Openverse CC0 → synth; the pick is pinned in `sfx.json`.

For an outside project, automatic score and voice generation and reads of the engine's shared generated audio are temporarily blocked to prevent mixing or overwriting another project's files. An existing `audio.json` or `narration.json` also causes normal render preflight to fail. When authorized, an explicitly supplied project `public/` WAV can be used as `/music.wav`; do not delete or replace a user-owned spec to work around the failure. An explicit full-mix snapshot can serve a partial render. Report any unavailable audio rather than claiming the soundtrack exists. Generated art and 3D assets remain shared and are not covered by this audio protection.
