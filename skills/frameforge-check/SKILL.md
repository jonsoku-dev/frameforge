---
name: frameforge-check
description: "Verify a Frameforge film before calling it done: stills, type check, tests, determinism lint, the full render's audit line, frame-check, flash-check, seam-check, narration-check (frameforge check), sound numbers. Use when asked to check, review or fix a film."
---

# Check

Follow `../frameforge-best-practices/references/checks.md` within the authorized scope: inspect the last requested frame and other relevant frames using a permitted method; run `npx tsc --noEmit`, `npm test` and `npm run lint:video -- <entry.tsx>`; render the requested range (or the full film if authorized) and inspect its `{"audit": [...]}` line; then run `node bin/frameforge.mjs check <out.mp4> --film <slug>`. Before rendering a contact sheet, still or video, check whether asset generation, network requests and other out-of-range effects are permitted; frame selection alone does not prevent them. If no suitable permitted method exists, report affected observations NOT VERIFIED. A partial check does not establish results outside the observed range. Preserve each row's actual status. Inspect flagged intervals against the brief and report intentional holds or unresolved conflicts without changing a FAIL or SKIP into a pass. Review canvas and shader text visually when possible because the DOM audit cannot see it.

Read `motionSounds` in the render log. Review the final film at playback speed and listen to its mix when available; a sheet or measurements cannot establish either. Record observation gaps, deviations and any independent review in `prompt.md`. Report each must and forbid clause as MET, UNMET or NOT VERIFIED with evidence and repeat its Gaps.

For motion graphics, also inspect the visual-development decisions against the saved output: hero/asset craft, type, light and composition as well as the action and information hierarchy. A technically clean film can still fail the brief's visual quality. Record a user's rejection separately from technical results and address its scope; do not reduce an overall quality rejection to a few legibility fixes or declare acceptance from this checklist.

A `text_overlap` finding compares DOM text layout boxes, not glyph ink. Inspect the reported saved interval at delivery size before deciding whether there is a visible collision. Fix actual collisions; if only font metrics overlap, preserve the finding and document the observed clearance and frames. Do not change thresholds or mark required text as decoration merely to remove the diagnostic. Also compare immediately adjacent transition frames: a clear settled lockup can still jump when its DOM structure or typography changes.
