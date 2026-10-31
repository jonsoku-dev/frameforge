# Motion comparison: continuity, emphasis and reproducibility

## Scope

A 12-second, 1080 × 1920, 30 fps editorial visualization of the 3 May 2022 Villarreal–Liverpool second leg was made from the same brief by two separate runs. This is one comparison, not a model benchmark: the runs had different tools, iteration time and revision counts. Neither render contains match footage or club logos.

- Reference: Claude Opus 5.5 intermediate render, SHA-256 `fd276123e929ba26bf31c2a130c2a0079cd950b32b0abba9c20a780b56513fff`.
- Original Codex render: SHA-256 prefix `e83b2356`.
- Revised Codex v7: SHA-256 `b27f9727a0346d0e6255efce4aacc24275824a96b9e65328123064cc01ed4b24`.

The local videos are not included in this repository. The film was rendered with a local engine snapshot containing uncommitted work, not the clean main checkout used for this change. Review used stills decoded at 0.2-second intervals and selected full-size frames. It did not include normal-speed perceptual playback or direct listening. Audio quality, perceived synchronization and equivalence of creative quality are **not verified**.

## Findings and changes

The reference carries score and goal nodes through a shared visual timeline and gives the aggregate result a distinct visual emphasis. The original Codex version holds a large halftime score, repeats the goal-list layout and moves to a separate result panel. The reference also shows incorrect intermediate score states; that error must not be copied. Match facts were checked against [UEFA's match report](https://www.uefa.com/uefachampionsleague/news/0275-150efde21205-174d7778325c-1000--villarreal-2-3-liverpool-agg-2-5-reds-comeback-sinks-yellow/).

The revised film retains the scoreboard as a state anchor but progressively reduces it as goal nodes take emphasis; the nodes then move into the aggregate layout. It distinguishes the aggregate lead, the second-leg equalizer and the second-leg lead. Sampled frames show the second-leg sequence 2–0, 2–1, 2–2 and 2–3 and the Liverpool aggregate win 5–2. An independent reviewer found that Díaz's earlier label had less settled reading time; its entrance was shortened in v7. The 212–244 frame interval is approximately 1.1 seconds for reading all three goals, and frames 306–359 give roughly 1.8 seconds to read the result. These are intentional reading intervals, not evidence that all holds are good or that a frame diagnostic should be suppressed. The final render retained a frame-check warning.

One earlier revision passed the renderer's default first/middle/last-frame idempotence check but failed at frame 30 on a moving circle edge. A raster background and an integer-pixel position removed the observed differences in selected comparisons; this does not prove every frame is pixel-identical. The episode demonstrates why a renderer should allow authors to inspect significant transition frames and report which frames were actually tested. Pixel identity, frame diagnostics and layout audits do not establish visual quality.
