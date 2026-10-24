import React from 'react';
import {MotionProbe, useCurrentFrame} from '../core/index';

/** Seams: the cut between two scenes as one continuous motion. How scene A leaves decides how scene B arrives: same axis,
 * same direction (on Z the direction is the sign of d(scale)/dt), the same speed at the cut (exit ease-in power 4, entry
 * ease-out power 4, same distance over the same frames) and the cut at the midpoint, so both sides are mid-motion.
 * Every function is a pure function of `frame`; `scripts/seam-check.mjs` reads the probes `<Seam>` reports. */
export type SeamAxis = 'x' | 'y' | 'z';
export type SeamVector = {axis: SeamAxis; direction: 1 | -1};
export type SeamSubject = 'text' | 'surface';
/** Style fragment for one wrapper; `value` is the offset in px (x, y) or the scale (z) that the probes report. */
export type SeamSide = {transform: string; opacity: number; filter: string; value: number};
export type SeamStyles = SeamVector & {cut: number; travel: number; exit: SeamSide; entry: SeamSide};
export type SeamOptions = {
  frame: number; at: number; duration: number; axis?: SeamAxis; direction?: 1 | -1;
  /** Distance in px (x, y) or scale delta (z); default 12 % of the frame side, 0.12 on z. */
  travel?: number;
  /** Blur peak at the cut: text 10 px, surface 18 px. */
  subject?: SeamSubject; width?: number; height?: number;
};

const unit = (u: number) => Math.min(1, Math.max(0, u));
const round = (n: number) => Math.round(n * 1000) / 1000 || 0;
const side = (axis: SeamAxis, raw: number, opacity: number, blur: number): SeamSide => {
  const value = round(axis === 'z' ? 1 + raw : raw);
  return {value, transform: axis === 'z' ? `scale(${value})` : `translate${axis.toUpperCase()}(${value}px)`, opacity: round(opacity), filter: blur > 0.05 ? `blur(${round(blur)}px)` : 'none'};
};

/** Exit over [exitStart, exitStart + len], entry over [entryStart, entryStart + len]; the two eases mirror, so the entry's first
 * step equals the exit's last step. On Z the exit goes 1 → 1 + travel·direction and the entry 1 - travel·direction → 1, so
 * both sides grow (push) or both shrink (pull); the opacity floor lets the stage colour show at the swap. */
function make(o: SeamOptions, exitStart: number, entryStart: number, len: number): SeamStyles {
  const axis = o.axis ?? 'x', direction = o.direction ?? -1;
  const travel = o.travel ?? 0.12 * (axis === 'x' ? o.width ?? 1920 : axis === 'y' ? o.height ?? 1080 : 1);
  const peak = o.subject === 'text' ? 10 : 18;
  const floor = axis === 'z' ? 0.35 : 1;
  const p = unit((o.frame - exitStart) / len) ** 4;
  const q = 1 - (1 - unit((o.frame - entryStart) / len)) ** 4;
  return {axis, direction, cut: entryStart, travel, exit: side(axis, direction * travel * p, 1 - (1 - floor) * p, peak * p), entry: side(axis, -direction * travel * (1 - q), floor + (1 - floor) * q, peak * (1 - q))};
}

/** The current: the outgoing wrapper slides `travel` px along `axis` in `direction` (default leftward), the incoming one
 * arrives from the opposite side still moving the same way; the cut is at `at + duration / 2`. */
export function cutTheCurve(o: SeamOptions): SeamStyles {
  return make(o, o.at, o.at + o.duration / 2, o.duration / 2);
}
/** Z forward, deeper into the same thought: both sides grow. */
export function zoomThrough(o: Omit<SeamOptions, 'axis' | 'direction'>): SeamStyles {
  return cutTheCurve({...o, axis: 'z', direction: 1});
}
/** Z backward, something bigger arrives: both sides shrink. */
export function inverseZoom(o: Omit<SeamOptions, 'axis' | 'direction'>): SeamStyles {
  return cutTheCurve({...o, axis: 'z', direction: -1});
}
/** Focus swap on one surface: full blur at the cut with a 3 % drift along `axis` so the current never stops. */
export function rackFocus(o: SeamOptions): SeamStyles {
  const axis = o.axis ?? 'x';
  return cutTheCurve({...o, axis, travel: o.travel ?? 0.03 * (axis === 'x' ? o.width ?? 1920 : axis === 'y' ? o.height ?? 1080 : 1), subject: o.subject ?? 'surface'});
}
/** Word by word on one surface: the whole row shares one `cutTheCurve` offset (so the spacing never changes), and each word
 * dissolves in turn: word i blurs out `stagger` frames after word i - 1 before the cut at `at + duration / 2`, and the new
 * words sharpen in the same order after it. One SeamStyles per word; `value` is the shared row offset. */
export function waterfallCut({words, stagger = 2, ...o}: SeamOptions & {words: number; stagger?: number}): SeamStyles[] {
  const half = o.duration / 2, len = half - (words - 1) * stagger;
  if (!(len > 0)) throw new Error(`waterfallCut: ${words} words × ${stagger} stagger do not fit in ${half} frames per side`);
  const row = cutTheCurve({...o, subject: o.subject ?? 'text'});
  const peak = (o.subject ?? 'text') === 'text' ? 10 : 18;
  return Array.from({length: words}, (_, i) => {
    const e = unit((o.frame - (o.at + i * stagger)) / len) ** 4;
    const q = 1 - (1 - unit((o.frame - (row.cut + i * stagger)) / len)) ** 4;
    const blur = (b: number) => b > 0.05 ? `blur(${round(b)}px)` : 'none';
    return {...row, exit: {...row.exit, opacity: round(1 - e), filter: blur(peak * e)}, entry: {...row.entry, opacity: round(q), filter: blur(peak * (1 - q))}};
  });
}

/** In-scene arrival cascade from below: item `index` starts `index · stagger` frames after `at`, later and heavier items travel
 * slower (duration 14 + 2·index + 6·(weight - 1) frames) over 12 % of the height. */
export function waterfallEntry({frame, at, index, weight = 1, stagger = 3, height = 1080}: {frame: number; at: number; index: number; weight?: number; stagger?: number; height?: number}): {progress: number; y: number; opacity: number; transform: string} {
  const start = at + index * stagger, duration = 14 + 2 * index + 6 * (weight - 1);
  const progress = 1 - (1 - unit((frame - start) / duration)) ** 4;
  const y = 0.12 * height * (1 - progress);
  return {progress, y, opacity: Math.min(1, progress * 1.5), transform: `translateY(${y}px)`};
}

/** Group slide in three phases, slow-fast-slow: 10 / 65 / 25 of the time covers 6 / 79 / 15 of the distance with continuous speed. */
export function nudge({frame, at, duration, from, to}: {frame: number; at: number; duration: number; from: number; to: number}): number {
  const u = unit((frame - at) / duration), v = 1 / 0.825;
  const p = u < 0.1 ? 5 * v * u * u : u < 0.75 ? 0.05 * v + v * (u - 0.1) : 1 - 2 * v * (1 - u) ** 2;
  return from + (to - from) * p;
}

export type SeamTechnique = 'cutTheCurve' | 'zoomThrough' | 'inverseZoom' | 'rackFocus';
const TECHNIQUES: Record<SeamTechnique, (o: SeamOptions) => SeamStyles> = {cutTheCurve, zoomThrough, inverseZoom, rackFocus};
export type SeamProps = Omit<SeamOptions, 'frame'> & {
  technique?: SeamTechnique; from: React.ReactNode; to: React.ReactNode; id?: string;
  /** Each scene's background colour: the wrapper paints it past the frame edge by the travel distance, so the stage never shows as a border while the picture is displaced. */
  fromBackground?: string; toBackground?: string;
};

/** Renders `from` until the cut and `to` from the cut frame on, each inside one absolute wrapper that carries the fragment
 * (transform, opacity, blur: the children are never blurred one by one), and reports the wrapper's value as a camera probe
 * (`<id>-out` before the cut, `<id>-in` after) so the seam check can read both vectors. */
export function Seam({technique = 'cutTheCurve', from, to, id, fromBackground, toBackground, ...o}: SeamProps): React.ReactElement {
  const frame = useCurrentFrame();
  const styles = TECHNIQUES[technique]({...o, frame});
  const before = frame < styles.cut;
  const s = before ? styles.exit : styles.entry;
  // While the wrapper is displaced, text near the margin leaves the safe area on purpose; at rest every text check applies.
  const moving = s.value !== (styles.axis === 'z' ? 1 : 0);
  const background = before ? fromBackground : toBackground;
  const bleedX = round(styles.axis === 'z' ? styles.travel * (o.width ?? 1920) : styles.travel);
  const bleedY = round(styles.axis === 'z' ? styles.travel * (o.height ?? 1080) : styles.travel);
  return <div {...(moving ? {'data-clip': 'allow'} : {})} style={{position: 'absolute', inset: 0, transform: s.transform, opacity: s.opacity, filter: s.filter}}>
    <MotionProbe id={`${id ?? `seam-${o.at}`}-${before ? 'out' : 'in'}`} value={s.value} family="camera" axis={styles.axis === 'z' ? 'scale' : styles.axis} />
    {background ? <div style={{position: 'absolute', left: -bleedX, top: -bleedY, right: -bleedX, bottom: -bleedY, background}} /> : null}
    {before ? from : to}
  </div>;
}
