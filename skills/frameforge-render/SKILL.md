---
name: frameforge-render
description: Render a Frameforge composition to MP4 or a contact sheet, with frame ranges, parallel chunks, piped encoding and idempotency checks. Use when the user asks to render, export or make a still.
---

# Render

From the repository root: `npm run render -- <entry.tsx> <CompositionId> <out.mp4>` (options `--frames 30,120` for a contact sheet PNG, `--frame-range a-b`, `--concurrency N`, `--pipe`, `--check-idempotent`). Restrict output and observation to the authorized scope. The renderer can run asset or audio generation before rendering; check those inputs and their authorization. It fails on clipped text, dense hand-placed effects or mixed frame sizes and refuses to overwrite an existing output. After rendering run `npm run frame-check -- <out.mp4>` and `node scripts/flash-check.mjs <out.mp4>`; a partial result does not establish whole-film status.

To check selected transitions during a video render, add `--check-idempotent --idempotent-frames 0,30,120`. The result lists the frames actually compared; unchecked frames and creative quality remain unverified by this test.

On POSIX, for a partial video, an explicitly selected project-relative WAV snapshot and its matching version 1 manifest (composition, fps, durationInFrames, sha256) may be supplied with `--audio-snapshot <file.wav> --audio-snapshot-manifest <file.json> --frame-range a-b`. Both paths and a partial frame range are required; this mode cannot be combined with silence or a contact sheet. Do not select a snapshot automatically or silently replace a missing one. Report the actual audio source and scope from the summary. The snapshot's current-source equivalence and perceptual listening remain NOT VERIFIED without separate evidence; this mode does not establish an absolute offline or byte-access guarantee.
