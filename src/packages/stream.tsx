import React from 'react';

/* A drawn flow from a source to a target (a pour, a beam of data, a thrown item's trail): a filled ribbon along a quadratic
 * curve that leaves the source level and falls into the target, full width at the source and 40 % of it at the target. */

export type StreamPoint = [number, number];
export type StreamOptions = {
  from: StreamPoint; to: StreamPoint;
  /** How much of the curve is drawn: a number is the head (0..1, the tail stays at the source); [tail, head] lets the stream detach and fall. */
  progress: number | [number, number];
  /** Width in px at the source. */ width?: number;
  /** Peak sideways sway in px, zero at the source and growing toward the target. */ wobble?: number;
  /** The frame, which moves the sway down the stream; nothing else depends on it. */ frame?: number;
  /** Points per side. */ samples?: number;
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const fix = (v: number) => Number(v.toFixed(2));

/** The ribbon outline as an SVG path in the same px space as `from` and `to`; '' when nothing is drawn. */
export function streamPath({from, to, progress, width = 12, wobble = 0, frame = 0, samples = 24}: StreamOptions): string {
  const [tail, head] = (typeof progress === 'number' ? [0, progress] : progress).map(clamp01) as [number, number];
  const [x0, y0] = from, [x1, y1] = to;
  if (head <= tail || (x0 === x1 && y0 === y1)) return '';
  const [cx, cy] = [x1, y0];
  const left: string[] = [], right: string[] = [];
  for (let i = 0; i <= samples; i++) {
    const s = tail + (head - tail) * i / samples, u = 1 - s;
    const px = u * u * x0 + 2 * u * s * cx + s * s * x1, py = u * u * y0 + 2 * u * s * cy + s * s * y1;
    let tx = 2 * u * (cx - x0) + 2 * s * (x1 - cx), ty = 2 * u * (cy - y0) + 2 * s * (y1 - cy);
    // A straight drop puts the control point on the source, where the tangent vanishes; the chord gives the direction.
    if (Math.hypot(tx, ty) < 1e-9) [tx, ty] = [x1 - x0, y1 - y0];
    const len = Math.hypot(tx, ty), nx = -ty / len, ny = tx / len;
    // A detached tail narrows to a point over its first 15 % of the drawn length, so a stopped pour reads as falling.
    const taper = tail > 0 ? Math.min(1, i / (samples * 0.15)) : 1;
    const half = width / 2 * (1 - 0.6 * s) * taper;
    const sway = wobble * s * Math.sin(Math.PI * 2 * (3 * s - frame / 15));
    const mx = px + nx * sway, my = py + ny * sway;
    left.push(`${fix(mx + nx * half)} ${fix(my + ny * half)}`);
    right.push(`${fix(mx - nx * half)} ${fix(my - ny * half)}`);
  }
  return `M${left.join('L')}L${right.reverse().join('L')}Z`;
}

/** `streamPath` drawn over its positioned parent: coordinates are the parent's px, nothing is clipped. */
export function Stream({color = 'currentColor', style, ...options}: StreamOptions & {color?: string; style?: React.CSSProperties}): React.ReactElement | null {
  const d = streamPath(options);
  if (!d) return null;
  return <svg width="100%" height="100%" style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none', ...style}}><path d={d} fill={color} /></svg>;
}
