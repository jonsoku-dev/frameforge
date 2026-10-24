# Captions

Captions carry the voice into the picture. They are written from the spoken lines, never the other way round, and they sit on top of a finished composition. API and generator: `docs/reference/voice.md`; workflow: `skills/frameforge-voice/SKILL.md`.

## Authoring order

Lines → voice → timing → scenes. Write `narration.json`, run `npm run voice`, read `narration.timing.json`, then build the Spot on `useNarration`. A scene starts on a line start (`n.at('id')`) or holds; `narration-check` fails a scene that starts inside a line.

## Every spoken phrase is one of three things

| Treatment | What it is | How often |
| --- | --- | --- |
| **drop** | Filler the ear accepts but the eye does not need ("so", "let's see", a repeated word). It is spoken and not shown. | Freely, but the rail still shows the line verbatim; drop only by leaving it out of the written line. |
| **rail** | The default. The line, verbatim, in a lower plate in front of everything, readable at a glance, words appearing in speaking order. Inline emphasis (`emphasis`) underlines a phrase in the accent; it does not change size or colour. | Every line. |
| **embed** | The scarce promoted peak. One word, very large, behind the subject, with a designed entrance and exit. It is the picture for a moment, not a caption. | At most one per line (`embed`), never on two neighbouring lines, one or two per film. |

Pick embed only for the word the film is about. If two candidates compete in one line, neither is the peak; keep both in the rail.

## The rail

- Verbatim. The viewer hears and reads the same words; a paraphrase makes them check twice.
- One or two rows, centred, inside the 80% title-safe box (bottom edge at 10% of the height). Break at the space nearest the middle, never mid-word.
- Paper text on an opaque plate (ink mixed with a little paper) with the film's one corner radius; emphasis words carry an accent underline, nothing else coloured.
- Words appear across the first part of the line, so the rail reads as speech; the full line stays until the next line starts (through a short gap), and the last line leaves with the voice so the final hold is still.
- Size at or above the label minimum (3.5% of the short side; the default is 4%).

## The embed

- One word from the line, display face, around half the short side, placed behind the subject (mount the embed layer under the scene content). The subject stays in front.
- Enter with the line (a short scale-down and fade), leave before the line ends. Never two visible at once, never adjacent lines.
- It is scarce because its job is contrast: the first embed in a film is a peak; the third is wallpaper.

## Captions are an overlay, not a band

- Centre compositions on the true frame centre. Never shift content up to make room for captions; a composition that only looks right with captions on is wrong without them.
- Keep only small critical text (labels, legal lines, units) out of the bottom caption span: the bottom 24% when the rail may take two rows, 16% for one. Headlines and heroes may cross it; the plate sits in front and the eye reads the plate.
- The embed is the exception that lives in the picture; place it where the subject hides part of it on purpose.

## Checks

- `npm run narration-check -- examples/samples/<slug> --prompt prompt.md` → `PASS`.
- The contact sheet shows every line's rail legible on its scene and the embed behind, not over, the subject.
- The layout audit in the render log reports no `text_overlap` between a rail word and scene text, and no `contrast_low` on emphasis words.
