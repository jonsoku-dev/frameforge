---
name: frameforge-check
description: "Verify a Frameforge film before calling it done: stills, type check, tests, determinism lint, the full render's audit line, frame-check, flash-check, seam-check, narration-check (frameforge check), sound numbers. Use when asked to check, review or fix a film."
---

# Check

Follow `../frameforge-best-practices/references/checks.md` within the authorized scope: inspect a contact sheet including the last requested frame; run `npx tsc --noEmit`, `npm test` and `npm run lint:video -- <entry.tsx>`; render the requested range (or the full film if authorized) and inspect its `{"audit": [...]}` line; then run `node bin/frameforge.mjs check <out.mp4> --film <slug>`. A partial check does not establish results outside the observed range. Preserve each row's actual status. Inspect flagged intervals against the brief and report intentional holds or unresolved conflicts without changing a FAIL or SKIP into a pass. Review canvas and shader text visually because the DOM audit cannot see it.

Read `motionSounds` in the render log. Review the final film at playback speed and listen to its mix when available; a sheet or measurements cannot establish either. Record observation gaps, deviations and any independent review in `prompt.md`. Report each must and forbid clause as MET, UNMET or NOT VERIFIED with evidence and repeat its Gaps.
