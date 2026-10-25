---
description: Check a rendered Frameforge film (frame-check, flash-check, seam-check, narration-check, brief) and explain each failure
argument-hint: <video.mp4> [film slug]
---

Check this Frameforge render: $ARGUMENTS

1. Call the `frameforge` MCP tool `check` with the video path and, when given, the film slug.
2. Show the table rows as they come back.
3. For every FAIL, name the defect in one line and the fix (`read_skill frameforge-check` has what each check measures). Do not call the film done while a row fails.
