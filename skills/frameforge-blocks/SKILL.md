---
name: frameforge-blocks
description: Pick and place ready motion-graphics blocks (titles, lower thirds, counters, cards, tickers, checklists, charts, code, diagrams) from the Frameforge catalogue in src/blocks instead of hand-writing them. Use when a film needs a title, a name card, a number, a toast, a chat, a ticker, a chart or a diagram, or when a film looks amateur and its text and cards should be replaced by catalogue blocks.
---

# Frameforge blocks

`src/blocks/` holds frame-function React components that already meet the repository's bar (sizes, masks, probes, exits). Search the catalogue before hand-writing a title, lower third, counter, card or ticker. Hand-drawn versions of these are the first thing that makes a film look amateur. This skill covers the text, lower-third and card families; the chart, code and diagram families are listed in [data.md](data.md) next to this file.

```tsx
import {GlyphRise, LowerThird, StatCard} from '@/blocks';
```

Full props and snippets in Korean: `docs/reference/blocks-text.md`. Every block in use: `examples/samples/blocks-reel/Spot.tsx` (composition `BlocksReel`).

## How to pick

1. Name the job in one phrase (a headline, who is speaking, one number, a product moment, a list, a strip of many items). Find it in the table's "use when" column.
2. Check the scene has a frame-filling object besides the block. Lower thirds, toasts and counters are overlays; alone on a background the frame fails the thin and huddled checks.
3. If no block fits, use the motif kit (`@/assets`) or the template's own patterns (`Glyphs`, `Screen`, `Callout`) from `examples/samples/_template/Spot.tsx`, never an icon library and never a one-off animation that fades in.

## The prop contract

Every block takes the same props, so a scene can place any of them the same way.

| prop | meaning |
| --- | --- |
| `frame` | the current frame, passed down by the scene (`useCurrentFrame()` once at the root) |
| `at` | absolute frame where the entry starts; before it the block renders `visibility: hidden`, never unmounted |
| `out` or `duration` | absolute frame where the exit starts, or frames after `at`; neither means hold forever; the exit reverses the entry on the same axis |
| `fps` | default 30 |
| `palette` | `{ink, paper, accent, soft}`; on an ink scene pass `{...palette, ink: palette.paper, paper: palette.ink}`, on an accent scene `{...palette, accent: palette.ink}` |
| `fonts` | `{display, ui}` font-family strings from `googleFont()` |
| `size` | the block's main font size in px, derived by the caller from the short side; secondary text is 0.7× (toast body and time, thread initials 0.8×), so pass ≥ 5 % of the short side for blocks with secondary text and ≥ 10 % for headline blocks (`docs/samples/rules.md` minimums: labels ≥ 3.5 %, headlines ≥ 10 %) |
| `x`, `y` | px placement; without them `align` (`left`, `center`, `right`) places the block inside the 5 % safe area, vertically centred; lower thirds and tickers default to the bottom 8 % |
| `id` | motion-probe key, default `<block>-<at>`; set it when two instances of one block start on the same frame |

Every motion is `interpolate`, `spring` or `Easing` of `frame`. Each block reports one `<MotionProbe>` (family `text` for text blocks, `card` for lower thirds and cards), so declaring `<MotionSound role="move|land|appear" families={['card', 'text']} />` at the root gives the film its derived sound. Glyph masks follow the template (`0.1em` top, `0.06em` side allowance), so the text-clip guard passes; the ticker carries `data-clip="allow"`.

Helpers exported from `@/blocks` for your own scene code: `blockRise(frame, from, dur, easing?)`, `blockSettle(frame, at, dur, fps, settle)`, `blockPhase(props, enter, exit)`, `blockPlace(props, hidden)`, `blockMask`.

## Catalogue: text, lower thirds, cards

| id | block | family | own props | use when |
| --- | --- | --- | --- | --- |
| `glyph-rise` | `GlyphRise` | text | `text`, `stagger=2`, `rise=12`, `color`, `weight` | a headline or a name; glyphs rise out of a mask, the exit drops them |
| `word-cascade` | `WordCascade` | text | `lines[]`, `stagger=4`, `color`, `weight` | two or three lines of copy; words fall in from below, heavier words later and slower |
| `zoom-swap` | `ZoomSwap` | text | `words[]`, `hold=36`, `swap=16` | one slot cycling alternatives; Z-axis swap through blur, never two readable |
| `typewriter` | `Typewriter` | text | `text`, `speed=2`, `blink=15` | a sentence being written behind a block caret; the exit deletes it |
| `highlight-sweep` | `HighlightSweep` | text | `before`, `word`, `after`, `delay=12`, `sweep=14` | stress one word; an accent bar sweeps behind it and it turns paper |
| `counter` | `Counter` | text | `to`, `from=0`, `decimals`, `prefix`, `unit`, `count=40`, `example` | a number counting up with tabular digits and the 예시 tag |
| `lower-third` | `LowerThird` | lower-third | `variant` (`clean-bar`, `bold-block`, `kicker-name`, `soft-pill`, `mask-reveal`, `side-rule`), `name`, `role`, `side`, `enter=16`, `exit=12` | who or what is on screen, over a running scene, in the lower corner of the safe area |
| `stat-card` | `StatCard` | card | `value`, `label`, `unit`, `prefix`, `decimals`, `example=true`, `width`, `height` | one number that matters on a card with the ink offset block; two side by side to compare |
| `notification-card` | `NotificationCard` | card | `icon` (kit component from `@/assets`), `title`, `body`, `time`, `from=top｜right`, `width` | a product moment as an OS-neutral toast that slides in, holds, slides out |
| `message-thread` | `MessageThread` | card | `messages[{side, name, text}]`, `step=24`, `typing=10`, `width` | a short conversation with a typing beat before each reply |
| `ticker` | `Ticker` | card | `items[]`, `speed=4`, `cell`, `height` | many short items scrolling without end, separated by drawn dots |
| `checklist` | `Checklist` | card | `items[]`, `stagger=14`, `draw=12` | three to five steps ticked off with a drawn check path |
| `logo-outro` | `LogoOutro` | card | `brand`, `tagline`, `color` | the last scene: name, accent rule, tagline, still hold |

The same list is `TEXT_BLOCKS`, `LOWER_THIRD_BLOCKS` and `CARD_BLOCKS` (`BlockEntry[]` with `id`, `title`, `family`, `props`, `when`) merged into `CATALOG` from `@/blocks`, so an agent or the studio can read it at runtime.

## Placing a block in a scene

```tsx
function Stats({frame}: {frame: number}) {
  const size = S * 0.06;
  return <AbsoluteFill style={{background: palette.paper}}>
    <StatCard frame={frame} at={AT.stats + 4} out={AT.next + 2} x={W * 0.1} y={H * 0.3} size={size} palette={palette} fonts={fonts} value={1284} unit="일" label="이어진 날" />
    <LowerThird frame={frame} at={AT.stats + 26} out={AT.next - 10} size={S * 0.06} palette={palette} fonts={fonts} variant="mask-reveal" name="김온결" role="제품 디자이너 · 가상 인물" />
  </AbsoluteFill>;
}
```

Give `out` a few frames inside the next scene's wipe so the block is still there while the wipe covers it. Keep 2–5 s per beat, one dominant motion direction, the last 2 s still (`LogoOutro` stops moving 40 frames after its `at`).

## Checks

Blocks do not replace the film checks in `frameforge-check`: render the contact sheet of the check frames, `npx tsc --noEmit`, `npm test`, `npm run lint:video`, then the full render with `frame-check` and `flash-check`. The block unit tests are `npx tsx --test tests/blocks-text.test.tsx`.
