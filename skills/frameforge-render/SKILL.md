---
name: frameforge-render
description: Render a Frameforge composition to MP4 or a contact sheet, with frame ranges, parallel chunks, piped encoding and idempotency checks. Use when the user asks to render, export or make a still.
---

# Render

From the repository root: `npm run render -- <entry.tsx> <CompositionId> <out.mp4>` (options `--frames 30,120` for a contact sheet PNG, `--frame-range a-b`, `--concurrency N`, `--pipe`, `--check-idempotent`). The renderer generates the film's audio and assets first, fails on clipped text, dense hand-placed effects or mixed frame sizes, prints `motionSounds` and `identicalShare`, and refuses to overwrite an existing output. After rendering run `npm run frame-check -- <out.mp4>` and `node scripts/flash-check.mjs <out.mp4>`.
