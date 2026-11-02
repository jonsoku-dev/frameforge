---
description: Review a rendered Frameforge film against its brief and saved output, preserving technical findings and creative-review gaps
argument-hint: <video.mp4> [film slug]
---

Check this Frameforge render: $ARGUMENTS

1. Call the `frameforge` MCP tool `read_skill` with `name: "frameforge-check"` and follow its review guidance within the authorized scope. Read the available film brief, plan and prior user feedback; identify the exact saved video being reviewed. A check request is not permission to generate assets or render a replacement.
2. Call the `frameforge` MCP tool `check` with the video path and, when given, the film slug. Show the table rows as they come back.
3. For every FAIL, identify the measured finding and inspect the interval against its purpose. Propose a fix for an unintended defect; report an intentional hold or other unresolved conflict with the actual status intact. WARN and SKIP are not passes, and a partial check does not establish whole-film status.
4. Review the saved output against the brief even when every numeric row is PASS. Inspect relevant states and transitions at delivery size, including hero/asset craft, type, light, composition and information hierarchy. Frames extracted from the saved video are evidence for that artifact; stills rendered from current source are not proof of the saved video's contents. Record observed intervals and concrete findings. If the video, brief or an observation method is unavailable, mark the affected observations NOT VERIFIED instead of inferring quality from numeric results.
5. Report each must and forbid clause as MET, UNMET or NOT VERIFIED with evidence and remaining gaps. State whether playback and listening were actually performed; a contact sheet is neither. Keep technical results, self-review and user acceptance separate. Preserve any prior user quality rejection and its scope; neither numeric PASS nor this review clears it by itself.
