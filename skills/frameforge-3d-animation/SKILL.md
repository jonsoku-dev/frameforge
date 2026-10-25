---
name: frameforge-3d-animation
description: Move Frameforge Blender shots: camera presets and moves (turntable, orbit, dolly, static, push-in, crane, easing, auto-framing), subject keyframes (subject.keys with location, rotation, scale and ease), motion blur from real camera and subject motion (motionBlur), depth of field, looping, scatter with spin, and the scanline-to-glossy sweep. Use when a 3D shot feels static, jerky, too fast, crops during the move, or needs blur.
---

# Frameforge 3D animation

A Blender shot is a pure function of the frame: the camera and the subject are keyed on every frame from the spec, so partial renders equal full ones and motion blur sees the real movement. Field reference: `docs/reference/three-d.md`.

## When to use

- The shot needs movement: a reveal, a product turn, a push-in, an object flying in or settling.
- The move looks mechanical, too fast, or jerks at the start and end.
- Fast motion strobes and needs blur.

## Steps

1. Decide the move from the beat it serves: a reveal eases in and out (`ease: inout`); an arrival lands softly (`out`); a loop turns at constant speed (`turntable`, `linear`).
2. Camera: `preset` plus `from`/`to`, `radiusTo` (push-in), `heightTo` (crane), `target`, `ease`. Leave `radius` out to auto-frame over the whole move.
3. Subject: `subject.keys` is a list of `{frame, location?, rotation?, scale?}` added on top of the subject's own rotation and scale, eased by `subject.ease`. Use it for an object that enters, tilts, settles or spins while the camera does something else. Auto-framing covers the space the keys sweep.
4. Motion blur: `motionBlur` is the shutter in frames (0.5 is a film look; 1 for very fast moves). It only shows where something moves between frames.
5. Secondary motion: `scatter {count, shape, size, radius, flatten, seed, spin}` places instanced bits around the subject and spins them; `sweep` wipes one look into another; `material.scroll` moves scan lines. Continuous small motion keeps a still subject alive.
6. Depth of field: `dof` (f-stop) focuses on the look-at point wherever the camera is.

## Lens and move rules

- Wider field of view (35–45°) for spaces and scatter; narrower (24–30°) for faces and products, which flatters proportions.
- One main move per shot. Combine camera and subject motion only when they read as one gesture (the camera orbits while the object settles).
- Keep a turntable under about one turn per four seconds for a hero; faster reads as a spinner.
- Ease every start and stop except loops. Hold the last frames still when the shot ends on a title.

## Quality bar

- No crop at any frame (`--inspect` → `framing.cropped: false` over the whole move).
- No visible jump at the loop point; no frozen stretch longer than the film's rules allow.
- Blur only where motion is fast; a slow move with heavy blur looks out of focus.

## Self-review loop

Render the first, middle and last frames (`--frames a-b` or single frames), Read them, check framing and speed, change one variable (ease, range, a key, the shutter), render again. Then a short full render through `<ImageSequence>` and a contact sheet of the film.

## Constraints

- Everything is keyed from the spec; never animate inside a script subject with random or time-based values.
- Motion blur and denoising still give byte-identical frames on the same machine; the fixture test covers keys, blur and scatter.
