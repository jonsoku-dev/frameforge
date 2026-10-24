import React, {useLayoutEffect, useRef, type DependencyList, type RefObject} from 'react';
import {continueRender, delayRender, getFrameforgeEnvironment, useCurrentFrame, useVideoConfig} from '../core/index';

/** Drives an existing animation library by frame instead of by its own clock. `duration` is in composition frames and `seek`
 * receives a continuous frame in [0, duration] (wrapped when looping); `ready` is awaited once before the first render capture. */
export type SeekableAdapter = {duration: number; seek: (frame: number) => void; destroy?: () => void; ready?: Promise<unknown>};
/** An adapter or a Web Animations animation, which is paused and driven by currentTime. */
export type SeekableSource = SeekableAdapter | Animation;

const wrap = (value: number, duration: number, loop: boolean) => duration <= 0 ? 0 : loop ? ((value % duration) + duration) % duration : Math.min(duration, Math.max(0, value));

/** The animation time in ms for a composition frame: frame / fps * 1000, wrapped into the duration or held at its ends. */
export function seekableFrame(frame: number, fps: number, durationMs: number, loop = false): number {
  return wrap(frame / fps * 1000, durationMs, loop);
}

/** What a source is seeked to for a composition frame: the adapter frame, or the animation's currentTime in ms. */
export function seekTarget(source: SeekableSource, frame: number, fps: number, loop = false): number {
  if ('seek' in source) return wrap(frame, source.duration, loop);
  return seekableFrame(frame, fps, Number(source.effect?.getComputedTiming().endTime ?? 0), loop);
}

/** Seeks a source to a composition frame, synchronously. */
export function applySeek(source: SeekableSource, frame: number, fps: number, loop = false): void {
  const target = seekTarget(source, frame, fps, loop);
  if ('seek' in source) source.seek(target);
  else { source.pause(); source.currentTime = target; }
}

/** Creates the source once per element (and when `deps` change), pauses it and seeks it in a layout effect every frame, before
 * paint. While rendering, the frame is held until the source's first `ready` settles. */
export function useSeekable<T extends Element>(ref: RefObject<T | null>, factory: (element: T) => SeekableSource, deps: DependencyList = [], loop = false): void {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const source = useRef<SeekableSource | null>(null);
  const handle = useRef<number | null>(null);
  // Held in the render phase: whenRenderReady returns at once when nothing is pending, so an effect-only hold could miss the capture.
  if (handle.current === null && source.current === null && getFrameforgeEnvironment().isRendering) handle.current = delayRender('Seekable');
  const release = () => { if (handle.current !== null) { continueRender(handle.current); handle.current = null; } };
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) { release(); return; }
    const created = factory(element);
    source.current = created;
    if (!('seek' in created)) created.pause();
    Promise.resolve(created.ready).then(release, release);
    return () => { release(); source.current = null; if ('seek' in created) created.destroy?.(); else created.cancel(); };
  }, deps);
  useLayoutEffect(() => { if (source.current) applySeek(source.current, frame, fps, loop); });
}

export type SeekableProps = {animate: (element: HTMLDivElement) => SeekableSource; loop?: boolean; style?: React.CSSProperties; children?: React.ReactNode};

/** A div whose Web Animations (or adapter) timeline follows the composition frame: `animate` runs once on mount. */
export function Seekable({animate, loop = false, style, children}: SeekableProps): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  useSeekable(ref, animate, [], loop);
  return <div ref={ref} style={style}>{children}</div>;
}
