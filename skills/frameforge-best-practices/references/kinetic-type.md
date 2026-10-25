# Kinetic type: motion that enacts the words

A type-led film wins when the motion does what the sentence says. "We take the long way" is a line that wanders, loops and arrives under "way". "We read the fine print" sits on a field of text being read. "Keep / the / light" is one word per beat, the whole frame changing colour on each. Type laid over an effect background, or a word on a slide-like card, says nothing the words do not already say.

## The method

1. Write the line, then underline its verb or its idea: think, read, build, switch on, every beat, straight, fast.
2. Give that word a physical behaviour: think → a thread that loops; read → dense text; build → extruded, stacked type (`<Extrude>`); straight → a ruler-straight cut through the word; switch on → a toggle flipping; fast → a whip pan; every beat → a field swap per word.
3. One behaviour per line, and every line gets its own. A film where every line enters the same way is a slideshow.
4. Colour fields come from the concept's palette and change on the beat, flat and saturated, never a gradient wash. The text colour is whichever palette colour reads on the field (`readableOn`).
5. Words stay whole at every frame (`blockMask` rises, a scale punch); never a scramble or a half-revealed word.

## The blocks (`import {...} from '@/blocks'`)

| The words mean | Block | Usage |
| --- | --- | --- |
| a sentence said one word per beat | `WordBeat` | `<WordBeat frame={frame} at={0} palette={palette} fonts={fonts} size={H * 0.28} words={['KEEP', 'THE', 'LIGHT']} punctuation="." fields={['#3045e8', '#d6f23a', '#16141c']} beat={15} />` |
| thinking, connecting, following through | `Thread` | `<Thread frame={frame} at={30} palette={palette} fonts={fonts} draw={60} points={[[300, 480], [1000, 470], [1380, 330], [1470, 520], [900, 860], [1720, 850]]} loops={[2]} words={[{text: 'I think', x: 300, y: 300, size: 140}, {text: 'it through', x: 980, y: 690, size: 140}]} />`: route the points under and between the words, put a loop where the thought turns |
| reading, knowledge, volume, research | `TextField` | `<TextField frame={frame} at={0} palette={palette} corpus={lines} beat={10}><GlyphRise ... text="We read the fine print" /></TextField>`: write `corpus` in the film's language; the rows are images, so the audit does not count them as text |
| speed, a change of subject | `WhipPan` | `<WhipPan frame={frame} at={120} dur={8} direction="left" from={<SceneA />} to={<SceneB />} />`: both scenes stay visible at the middle frame, blurred along one axis only |
| design, system, pattern, rhythm | `BauhausMosaic` | `<BauhausMosaic frame={frame} at={0} palette={palette} colours={['#e2553a', '#3045e8', '#16141c', '#f4efe4', '#d6f23a']} beat={15} />`: a frame-filling grid that flips in waves on every beat; good as the beat under a word, or as a full-frame hit |
| switching on, a feature, a yes | `Toggle` | `<Toggle frame={frame} at={0} on={20} palette={palette} size={H * 0.18} x={1000} y={445} />` next to the word "ON" |

Combine at most two of these per line, and use the beat grid (`beatsFromSpec`) for `beat` and `at`, so field swaps, flips and the toggle land on the music's hits.

## Checks

- Contact sheet one cell per beat: every cell shows a different behaviour and the words are whole.
- frame-check: the field swaps and the mosaic keep `motion share` near 1; a WhipPan never leaves a flat or fully blurred frame.
- The render audit stays clean: TextField rows are images; WhipPan's moving scenes carry `data-clip="allow"` while they cross the frame edge.
