---
name: frameforge-audio
description: Music and sound for a Frameforge film: audio.json spec (mood, bpm, sections, hits, sfx intents), generation, measurement, motion-derived sound effects, ducking. Use when sound is missing, stitched, too dense or needs tuning.
---

# Audio

Read `../frameforge-best-practices/references/sound.md` and `docs/audio-score.md`. Write `audio.json` from the scene table (sections on bar lines, hits on visual events with weight/style when needed, sfx intents with length), run `npm run score -- examples/samples/<slug>/audio.json`, measure with `scripts/assets/score-report.py`, and let the engine place effects from motion probes (`useMotionSound`, `<MotionProbe>`, `<MotionSound>`). Providers for effects: Openverse CC0 → synth; the pick is pinned in `sfx.json`.
