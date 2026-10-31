---
description: Make a Frameforge film end to end from a request (brief, concept, bespoke code, music, contact sheet, second pass, render, check)
argument-hint: <what the film should be, in your own words>
---

Make this film with Frameforge. The request, verbatim: $ARGUMENTS

Hand the job to the `frameforge-maker` subagent with the request above unchanged. Review the actual render and brief, or ask a separate reviewer when available, without supplying a score or the maker's verdict. Identify concrete defects with observed frame ranges or timecodes. Return those findings to the maker for correction, then inspect the revised intervals and final render. Repeat while relevant evidence and permissions allow. If playback, listening or another input is unavailable, continue correcting independently observable defects and report the affected judgments as unverified. Do not invent a quality pass from a score, stills or technical checks.

Relay the mp4 path, each must and forbid clause as MET, UNMET or NOT VERIFIED with evidence, the actual `check` statuses, corrections, observation method, and playback, listening or other evidence that remains unverified.

If the subagent is not available, do it here with the `frameforge` MCP tools: motion graphics (showreel, ident, launch, promo, brand film) follow the `make_motion_film` workflow and `read_skill frameforge-motion`; explainers, captions, charts and calm films follow `make_explainer` and `read_skill frameforge-create`.
