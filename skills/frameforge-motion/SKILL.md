---
name: frameforge-motion
description: Create a Frameforge motion-graphics film by designing how type, forms and information change over time. Use for a showreel, ident, launch, promo or brand film.
---

# Motion graphics

Design the visual language and pace for the brief. Typography, graphics, images and information can all carry a film; a 3D object, dense effects, or constant motion is not required. Choose media and tools that serve the subject and respect the user's constraints.

Read `../frameforge-best-practices/references/bespoke.md` for rendering helpers and the relevant audio or 3D skill when needed. Existing examples and assets can explain APIs; do not copy their visual identity as a substitute for a concept.

## Workflow

1. Create the film with `frameforge new <slug>` or the repository template. Set the requested duration, dimensions and fps. Fill `brief.md` with the verbatim request, clause-by-clause intent ledger, engine translation and gaps; run `brief-check`.
2. In `prompt.md`, describe the concept, visual world, palette and chosen media. For each major event or shot, plan its frame range, information before and after, what remains visible, what becomes the focus, the motion that connects or separates the states, and the settled reading interval. Give events meaningfully different emphasis where their roles differ. For factual sequences, record the source and keep visible times and states consistent. A cut or hold can be intentional; don't add motion just to fill a frame.
3. Write `Spot.tsx` as a pure function of `useCurrentFrame()` using the chosen media and Frameforge components. Use seeded randomness; never use `Math.random` or wall-clock time. Choose type and assets appropriate to the brief and record their origin and rights.
4. Use requested or licensed sound, or generate a score when appropriate. Plan sound against the visual events, and verify the actual mix when listening is available. Do not replace a requested track or use external services without authorization.
5. Render a contact sheet including each major state, transitions and the actual last frame. Critique it against the planned information hierarchy and reading intervals; identify the weakest scenes and revise their composition, action or timing. Render and inspect the revision. Repeat for concrete unresolved defects when evidence and permissions allow; a score or a sheet alone is not a quality verdict.
6. Render the full film and run `frameforge check <out.mp4> --film <slug>`. Review flagged intervals against their purpose and the brief: retain useful reading holds, correct unintended stagnation and technical defects, and report the actual check status and any unresolved conflict. A skipped or unavailable check is not a pass. Inspect canvas and shader text visually because the audit cannot see it.
7. Watch the final film at playback speed and listen to the mix when available. Review transitions, focus, reading time, ending and event synchronization. If a separate reviewer is available, provide the brief and actual render and address concrete findings; otherwise label self-review. A contact sheet, audio waveform or automated pass is not playback or listening. Record observed intervals, findings, corrections and anything not verified.
8. Report the output, every must and forbid clause as MET, UNMET or NOT VERIFIED with evidence, actual check results, gaps and substitutes, and the playback and listening performed. Do not claim a creative or audio result that was not observed.
