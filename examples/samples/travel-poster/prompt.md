# VELORA COVE motion poster

## Purpose

Introduce the fictional island city VELORA COVE through a single horizon that grows into three geometric landmarks, then resolves into its name and invitation.

## Format

1920×1080, 30 fps, 450 frames (15 seconds), composition `TravelPoster`.

## Palette and fonts

- Sky: `#1C3F8C`
- Sand: `#F3E7D3`
- Accent: `#FF7A59`
- Ink: `#101828`
- Headline: Black Han Sans, weight 400
- UI: Noto Sans KR, weight 500

## Scene table

| Frames | Frame content | Motion | Text |
| --- | --- | --- | --- |
| 0–89 | Sand fills the frame while an ink horizon spans the center and sky wipes downward from it. | The line draws left to right, then the sky's clipped panel travels downward. | None. |
| 90–269 | The horizon remains as the common baseline for three landmarks. | Lighthouse rises from the horizon, bridge arcs grow from the lighthouse edge, and stacked tower squares rise from the bridge edge. Each has a spring label and Lucide icon. | Beacon / Anchor, Crossing / Sun, Outlook / Mountain. |
| 270–359 | The three landmarks compress toward the horizon into an accent skyline strip. | Shapes scale down and slide into a single strip, carrying the prior geometry forward. | Labels leave upward. |
| 346–369 | The completed skyline sits on sand below the city name. | Glyphs enter ahead of the hit and the name slams in from opposite sides at frame 360; an impact sound lands on that frame. | VELORA COVE. |
| 370–449 | The name and skyline hold in a full-frame final poster. | The one-line tagline rises and settles by frame 382, then all text remains still through the final 68 frames. | Where horizons become home. |

## Audio cues

Audio: spec `audio.json` (dramatic, 96 bpm, D minor, seed 22). Sections horizon 0-3s (0.25), landmarks 3-9s (0.55), skyline 9-12s (0.85), name 12-13s (0.55), hold 13-15s (0.1). Hits at 12 s. Music `/audio/generated/travel-poster/music.wav` at the root, volume 0.9. SFX in `/audio/generated/travel-poster/<name>.wav`, volume 0.8, at frames whoosh.wav 96, 150, 204; impact.wav 360.

## References

- `docs/references/opus-5-5/motion-studio-course.md` guides deterministic beat-based states and a visual change every 2–4 seconds.
- `docs/references/opus-5-5/charlie-hills.md` guides carrying one scene object into the next rather than cutting unrelated imagery.
- The LINE GAME films provide the measured glyph-rise mask, frame-driven springs, full-frame color fields, and audio sequence wiring patterns.

## Prohibitions

VELORA COVE is a fictional city, not a real place, company, product, or logo. The film makes no factual, price, date, or numeric claim. It uses no real logo, `#06C755`, Gothic A1, gradients, particles, glow, border, face, jewel, icon webfont, CSS animation, transition, state, effect, `Math.random`, date, or time-based behavior.

## Check frames

0, 45, 89, 96, 140, 196, 269, 330, 360, 390, and 449.
