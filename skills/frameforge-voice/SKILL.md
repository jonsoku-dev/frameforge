---
name: frameforge-voice
description: Narration-first films with the Frameforge engine: write the spoken lines, synthesise and measure them (npm run voice), derive scene timing from the measured voice (useNarration), overlay rail and embed subtitles, draw KaTeX formulas, and run narration-check. Use when a film needs a voice-over, subtitles, captions or a spoken explainer, or when visuals overrun their lines.
---

# Frameforge voice

The repository root holds `package.json` with `"name": "frameforge-local"`. Full reference (Korean): `docs/reference/voice.md`. Caption doctrine: `skills/frameforge-best-practices/references/captions.md`. Every other rule of `skills/frameforge-best-practices/SKILL.md` still applies.

## Order of work

Lines first, voice second, timing third, scenes last. Never write the Spot before `narration.timing.json` exists.

1. **Lines** → `examples/samples/<slug>/narration.json`: `slug`, `language` (`ko` | `en` | `ja`), `voice {provider, name}`, optional `rate`, `leadMs`, `gapMs`, and `lines[] {id, text, pauseMs?, emphasis?[], embed?}`. One idea per line, 6–10 words, ids in lowercase. Mark `emphasis` phrases that the rail colours and at most one `embed` word per line, never on two neighbouring lines.
2. **Voice** → `npm run voice -- examples/samples/<slug>/narration.json`. Provider order for `auto`: `kokoro` (`pip install kokoro-onnx` plus model files, en and ja only) → `say` (macOS; Yuna for ko, Kyoko for ja, Samantha for en) → `silent` (estimated lengths, lines marked `estimated: true`). Lines are cached by hash; `--force` re-speaks everything. Output: `public/audio/generated/<slug>/voice.wav` (48 kHz stereo, −16 LUFS, not committed) and `narration.timing.json` (committed).
3. **Timing** → read `narration.timing.json`. `durationInFrames` = last `endMs` in frames + 60 (two seconds still), the same number in `entry.tsx` and `examples/samples/index.tsx`. `audio.json` `durationSeconds` equals that length; sections on bar lines; energy ≤ 0.45 while anyone speaks.
4. **Scenes** → in `Spot.tsx`: `import timing from './narration.timing.json'`, `const n = useNarration(timing)`, start every scene at `n.at('<id>')` and hold it until the next line. Progress through a line is `interpolate(frame, [n.line(id).startFrame, n.line(id).endFrame], [0, 1], clamp)`. Mount `<Voiceover src="/audio/generated/<slug>/voice.wav" />` once at the root and keep the music `<Audio volume={0.45}>` or lower (no voice ducking in the renderer yet).
5. **Captions** → `<Subtitles timing fonts palette radius />` as the last child of the root (an overlay, in front). `<Subtitles style="embed" />` goes under the subject inside the scene that owns the embed word. Centre scenes on the true frame centre; keep small labels out of the bottom caption span. A formula is `<Formula tex="..." draw highlight />`; write TeX with single backslashes in JSX attributes.
6. **Check** → `npm run narration-check -- examples/samples/<slug> --prompt prompt.md` must print `PASS` (codes: `line_overlap`, `line_too_fast`, `line_past_end`, `scene_inside_line`, `embed_adjacent`, `voice_missing`). Then the usual checks: contact sheet on the check frames, `npx tsc --noEmit`, `npm test`, `npm run lint:video`, render.

## Commands

| Need | Command |
| --- | --- |
| Speak and measure | `npm run voice -- examples/samples/<slug>/narration.json` |
| Re-speak after a text change elsewhere | `npm run voice -- examples/samples/<slug>/narration.json --force` |
| Check timing against scenes | `npm run narration-check -- examples/samples/<slug> --prompt prompt.md` or `--scenes 0,121,253` |
| Machine-readable report | `npm run narration-check -- examples/samples/<slug> --json` |
| Subtitle file | `serializeSrt({lines: captionsFromTiming(timing).map(c => [c])})` |
| Generator self-check | `python3 scripts/assets/voice.py --self-check` |

## Rules

- The voice is the clock. Visuals change on line boundaries or hold; never cut inside a line.
- Lines are spoken verbatim in the rail. Do not paraphrase for the caption.
- Every phrase is drop, rail or embed (see captions.md). Rail is the default; embed is scarce.
- Subtitles are an overlay. Nothing in the scene moves up to make room for them.
- `narration.timing.json` is committed; `voice.wav` and the line cache are not. Never write API keys to any file.
- Reading rates that fail the check: Korean over 8 syllables/s, English over 4 words/s, Japanese over 7 characters/s. Split the line or lower `rate`.
- Sample to copy: `examples/samples/narrated-explainer/` (Korean, provider `say`, seven lines, one embed, one formula).
