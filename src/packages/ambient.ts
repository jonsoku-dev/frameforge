/* Secondary motion that keeps a held shot alive: pure functions of the frame, so the same frame always gives the same picture.
 * frame-check counts a picture as moving when it changes over half a second; 1 px/s of drift on a headline already registers. */

const TAU = Math.PI * 2;

export type DriftOptions = {/** Peak offset in px on x. */ x?: number; /** Peak offset in px on y. */ y?: number; /** Peak scale change, e.g. 0.02 for ±2 %. */ scale?: number; /** Frames per cycle. */ period?: number};

/** A slow camera float: x on a sine, y and scale a quarter and a half cycle later, so some axis is always moving.
 * Returns a CSS transform; peak speed on x is 2π·x / (period / fps) px/s. */
export function drift(frame: number, {x = 0, y = 0, scale = 0, period = 240}: DriftOptions = {}): string {
  if (!(period > 0)) throw new Error(`drift period must be positive, got ${String(period)}`);
  const t = TAU * frame / period;
  const r = (v: number) => Number(v.toFixed(3));
  return `translate(${r(x * Math.sin(t))}px, ${r(y * Math.sin(t + Math.PI / 2))}px) scale(${r(1 + scale * Math.sin(t + Math.PI))})`;
}

/** A breathing factor around 1 (1 ± amount) with `period` frames per breath, for a scale, an opacity or a glow radius. */
export function breathe(frame: number, period = 60, amount = 0.03): number {
  if (!(period > 0)) throw new Error(`breathe period must be positive, got ${String(period)}`);
  return 1 + amount * Math.sin(TAU * frame / period);
}
