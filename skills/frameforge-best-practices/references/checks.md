# Checks

Before claiming done:
1. Stills: a contact sheet of at least the check frames in `prompt.md` (`npm run render -- <entry.tsx> <Id> <sheet.png> --frames 30,120,240`; set `FRAMEFORGE_PORT` when another render is running); look at every cell; a `Clipped text` error means the mask is wrong (fix the mask, do not shrink the text).
2. `npx tsc --noEmit`, `npm test`.
3. `npm run lint:video -- <entry.tsx>` must print no error-severity finding.
4. Render, then `npm run frame-check -- <mp4>` (thin < 0.08, huddled < 0.25, no empty run > 30 frames, no static run > 120 frames) and `node scripts/flash-check.mjs <mp4>` (≤ 3 flashes per second).
5. Render log: `motionSounds` lists the derived effects with frame, role, intensity, pan; `identicalShare` is the still-frame share.
6. Write in `prompt.md`: what was measured, what was not, and every deviation from the brief.
