# TODO-slug

Engine brief: written first, before `prompt.md`. It turns the user's request into the engine's vocabulary without losing any of it. `node bin/frameforge.mjs brief-check <slug>` (or `npm run brief-check -- examples/samples/<slug>`) must PASS before the Concept and the Structure table. Rules: `docs/samples/rules.md` 기획 구조.

## Request

<!-- The user's request, verbatim: copy it unchanged, typos included. Never paraphrase here. -->

## Intent ledger

<!-- One row per clause of the request; together the quoted clauses cover every word of it (brief-check fails on a sentence left over).
kind: must (stated requirement), forbid (stated ban), taste (stated preference; honoured unless it conflicts with a must), implied (what the genre expects but nobody said, e.g. "showreel" -> variety and a name card, "launch video" -> a product reveal; never overrides a stated clause).
means: the concrete engine means (a <Shader> preset, a block, a seam, an audio.json field, a size/fps/duration value).
verify: where it shows (scene row and frame range) or the check that proves it (frame-check, audit corner_hud, brief duration, ...).
A must clause that states seconds, WxH or fps is compared with entry.tsx. -->

| Clause | Kind | Means | Verify |
|---|---|---|---|

## Engine translation

<!-- The optimized brief, in engine vocabulary: concept (one idea), world, hero subject, palette (showreel.md named palette or derived), families (at most two from showreel.md), 3-5 signature moves with the component for each, duration / size / fps, audio direction (bpm, sections, hits). It may add specificity; it never contradicts, weakens or drops a must or forbid row. When the request is open ("you pick"), commit to bold choices and label them "Decision:" so they never read as the user's intent. prompt.md's Concept paragraph and Structure table follow this. -->

## Gaps

<!-- What the engine cannot do or what conflicts (a reference image that was not supplied, a real brand, a paid voice), and the substitute chosen. Never drop silently. Write "None." when there is nothing. Every gap is repeated to the user in the final report. -->
