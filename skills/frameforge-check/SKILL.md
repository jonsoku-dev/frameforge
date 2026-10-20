---
name: frameforge-check
description: Verify a Frameforge film before calling it done: stills, type check, tests, determinism lint, frame-check, flash-check, sound numbers. Use when asked to check, review or fix a film.
---

# Check

Follow `../frameforge-best-practices/references/checks.md` in order: a contact sheet of the check frames and look at every cell; `npx tsc --noEmit`; `npm test`; `npm run lint:video -- <entry.tsx>`; render; `npm run frame-check`; `node scripts/flash-check.mjs`; read `motionSounds` in the render log; write deviations and unverified items into `prompt.md`. A cross review by a different model (six criteria in `docs/samples/README.md`) catches what self-checks miss.
