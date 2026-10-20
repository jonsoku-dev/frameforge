import React, {useEffect, useRef} from 'react';
import {continueRender, delayRender, useCurrentFrame, useVideoConfig} from '../core/index';

/** Plays a Lottie JSON deterministically: the file's frame for the composition frame is shown with `goToAndStop`, never by
 * wall-clock playback. The animation data is fetched once per src. lottie-web is MIT; the animations themselves carry their
 * own licence (LottieFiles free animations: Lottie Simple License, credit encouraged; note it in prompt.md). */
export type LottieProps = {src: string; frame?: number; loop?: boolean; playbackRate?: number; style?: React.CSSProperties};
type Animation = {totalFrames: number; frameRate: number; goToAndStop: (value: number, isFrame: boolean) => void; destroy: () => void};
const data = new Map<string, Promise<unknown>>();

/** The file frame to show for a composition frame: the file's own frame rate mapped onto the composition's, looping or holding the last frame. */
export function lottieFrame(compositionFrame: number, fps: number, fileFps: number, totalFrames: number, loop: boolean, playbackRate = 1): number {
  const raw = compositionFrame * playbackRate * fileFps / fps;
  if (totalFrames <= 0) return 0;
  return loop ? ((raw % totalFrames) + totalFrames) % totalFrames : Math.min(totalFrames - 1, Math.max(0, raw));
}

export function Lottie({src, frame, loop = true, playbackRate = 1, style}: LottieProps): React.ReactElement {
  if (typeof src !== 'string' || !src.startsWith('/')) throw new Error('Lottie src must be a public path starting with "/"');
  const current = useCurrentFrame();
  const {fps} = useVideoConfig();
  const target = frame ?? current;
  const host = useRef<HTMLDivElement>(null);
  const animation = useRef<Animation | null>(null);
  const handle = useRef<number | null>(null);
  if (handle.current === null && animation.current === null) handle.current = delayRender(`Lottie ${src}`);
  useEffect(() => {
    let alive = true;
    const loaded = data.get(src) ?? data.set(src, fetch(src).then(response => { if (!response.ok) throw new Error(`Lottie ${src}: HTTP ${response.status}`); return response.json(); })).get(src)!;
    Promise.all([loaded, import('lottie-web')]).then(([animationData, module]) => {
      if (!alive || !host.current) return;
      const lottie = (module as {default: {loadAnimation: (options: object) => Animation}}).default;
      animation.current = lottie.loadAnimation({container: host.current, renderer: 'svg', loop: false, autoplay: false, animationData});
      const a = animation.current;
      a.goToAndStop(lottieFrame(target, fps, a.frameRate, a.totalFrames, loop, playbackRate), true);
      if (handle.current !== null) { continueRender(handle.current); handle.current = null; }
    }).catch(() => { if (handle.current !== null) { continueRender(handle.current); handle.current = null; } });
    return () => { alive = false; animation.current?.destroy(); animation.current = null; };
  }, [src]);
  useEffect(() => {
    const a = animation.current;
    if (a) a.goToAndStop(lottieFrame(target, fps, a.frameRate, a.totalFrames, loop, playbackRate), true);
  }, [target, fps, loop, playbackRate]);
  return <div ref={host} style={{width: '100%', height: '100%', ...style}} />;
}
