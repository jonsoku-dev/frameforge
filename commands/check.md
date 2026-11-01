---
description: Check a rendered Frameforge film (frame-check, flash-check, seam-check, narration-check, brief) and explain each failure
argument-hint: <video.mp4> [film slug]
---

Check this Frameforge render: $ARGUMENTS

1. Call the `frameforge` MCP tool `check` with the video path and, when given, the film slug.
2. Show the table rows as they come back.
3. For every FAIL, identify the measured finding and inspect the interval against its purpose (`read_skill frameforge-check` has what each check measures). Propose a fix for an unintended defect; report an intentional hold or other unresolved conflict with the actual status intact. WARN and SKIP are not passes, and a partial check does not establish whole-film status.
