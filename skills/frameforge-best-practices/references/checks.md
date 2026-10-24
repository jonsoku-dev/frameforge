# Checks

Before claiming done:
1. Stills: a contact sheet of at least the check frames in `prompt.md` (`npm run render -- <entry.tsx> <Id> <sheet.png> --frames 30,120,240`; set `FRAMEFORGE_PORT` when another render is running); look at every cell; a `Clipped text` error means the mask is wrong (fix the mask, do not shrink the text).
2. `npx tsc --noEmit`, `npm test`.
3. `npm run lint:video -- <entry.tsx>` must print no error-severity finding.
4. Render, then `npm run frame-check -- <mp4>` (thin < 0.08, huddled < 0.25, no empty run > 1 s, no frozen run > 1 s, measured against the frame 0.5 s earlier, outside the final 1 s hold; `--hold <frames>` changes the hold, `--hold 0` for loops) and `node scripts/flash-check.mjs <mp4>` (≤ 3 flashes per second).
5. The render's `{"audit": [...]}` line also reports `element_cropped` (a `data-subject` element more than 2 % outside the frame) and `subject_overlaps_text` (a subject covering more than 20 % of a text box).
6. Render log: `motionSounds` lists the derived effects with frame, role, intensity, pan; `identicalShare` is the still-frame share.
7. Write in `prompt.md`: what was measured, what was not, and every deviation from the brief.
