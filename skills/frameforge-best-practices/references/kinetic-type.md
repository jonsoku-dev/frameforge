# Kinetic type: motion that enacts the words

Type wins when the motion does what the sentence says. Type laid over an effect, or a word on a slide-like card, says nothing the words do not already say. This page is a method, not a set of lines: write the film's own copy and give each line its own behaviour.

## The method

1. Write the line, then underline its verb or its idea.
2. Give that word a physical behaviour that does what it means, built in your own code (per-glyph transforms in DOM, glyph paths or `fillText` on a canvas, type as a texture or a signed-distance field in a shader, extruded or lit type in three.js).
3. One behaviour per line, and every line gets its own. A film where every line enters the same way is a slideshow.
4. Colour and field changes land on the beat (`beatsFromSpec`: `pulse`, `bars`, the spec's `hits`); the text colour is whichever palette colour reads on the field behind it at that frame.
5. Words stay whole and legible at every frame they are meant to be read: no scramble, no half-erased swap, no long per-glyph fade. Fast glyph motion (a slam, a scatter, a shatter) is fine on the way in and out; the read itself is whole.

## Contracts

- DOM type is what the render audit measures. A chromatic split or echo marks its copies `aria-hidden="true"` or `data-fx="ghost"`, so the audit reads the word once.
- Canvas and shader type is not audited: check size (headline at least 10 % of the short side), the 5 % margin and contrast on the contact sheet.
- Fonts come from `googleFont` at module level, for DOM and canvas alike; never a system face.
- A glyph mask that clips ink fails the render with `Clipped text`; give masks room (`blockMask` from `@/blocks` is one ready mask) or mark an intentional overflow `data-clip="allow"`.

## Self-check

- Contact sheet, one cell per line: every line moves differently, and each motion could only belong to that line.
- No line could be swapped into another film without its motion becoming wrong.

Ready-made kinetic blocks exist for calm or data films; they are listed in `utilities.md`, not the path for a motion-graphics film.
