---
name: frameforge-check
description: Verify a Frameforge film before calling it done: stills, type check, tests, determinism lint, the full render's audit line, frame-check, flash-check, seam-check, narration-check (frameforge check), sound numbers. Use when asked to check, review or fix a film.
---

# Check

Follow `../frameforge-best-practices/references/checks.md` in order: a contact sheet of the check frames and look at every cell; `npx tsc --noEmit`; `npm test`; `npm run lint:video -- <entry.tsx>`; render the WHOLE film (sheets and 150-frame parts miss static runs, overlaps and clipped text; five of seven new films failed only on the full render) and read its `{"audit": [...]}` line (safe area, overlap, contrast, size: it must be empty); then `node bin/frameforge.mjs check <out.mp4> --film <slug>` and make every row PASS (frame-check, flash-check, seam-check on the render's `.motion.json`, narration-check when the film speaks); read `motionSounds` in the render log; write deviations and unverified items into `prompt.md`. A cross review by a different model (six criteria in `docs/samples/README.md`) catches what self-checks miss.
