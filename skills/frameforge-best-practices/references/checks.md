# Checks

Before claiming done:
1. Stills: a contact sheet of at least the check frames in `prompt.md` (`npm run render -- <entry.tsx> <Id> <sheet.png> --frames 30,120,240`; set `FRAMEFORGE_PORT` when another render is running); look at every cell; a `Clipped text` error means the mask is wrong (fix the mask, do not shrink the text).
2. `npx tsc --noEmit`, `npm test`.
3. `npm run lint:video -- <entry.tsx>` must print no error-severity finding.
4. Render, then `npm run frame-check -- <mp4>` (thin < 0.08, huddled < 0.25, no empty run > 1 s, no frozen run > 1 s, measured against the frame 0.5 s earlier, outside the final 1 s hold; `--hold <frames>` changes the hold, `--hold 0` for loops; no `featureless` run of 3+ frames, a flat colour or a full blur with no edge; on films of 4 s or more the final 2 s keep a motion share of at least 0.5, an `end hold` fail, skipped only when `--hold` is given for a declared hold) and `node scripts/flash-check.mjs <mp4>` (≤ 3 flashes per second).
5. The render's `{"audit": [...]}` line also reports `element_cropped` (a `data-subject` element more than 2 % outside the frame) and `subject_overlaps_text` (a subject covering more than 20 % of a text box), and `corner_hud` (small text, under 6 % of the short side, within 8 % of two edges for more than half the frames: a timecode, frame counter, scene number, BPM or REC; remove it or opt in with `data-hud="allow"` and a reason in `prompt.md`).
6. Render log: `motionSounds` lists the derived effects with frame, role, intensity, pan; `identicalShare` is the still-frame share.
7. Write in `prompt.md`: what was measured, what was not, and every deviation from the brief.
