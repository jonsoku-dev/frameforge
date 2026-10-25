import React, {forwardRef, useImperativeHandle, useLayoutEffect, useRef} from 'react';
import {continueRender, delayRender, useCurrentFrame, useVideoConfig, whenGoogleFontsSettled} from '../core/index';
import {validateCanvasSize} from '../core/effects';
import {positive} from '../core/math';

export type Canvas2DInfo = {width: number; height: number; fps: number; /** Seconds from the frame. */ time: number};
export type Canvas2DProps = {
  width: number; height: number;
  /** Paints one frame. It must depend only on its arguments (and seeded values made outside it): the canvas is cleared and its state
   * reset before every call, in CSS pixels whatever the pixel density. */
  draw: (ctx: CanvasRenderingContext2D, frame: number, info: Canvas2DInfo) => void;
  pixelDensity?: number; style?: React.CSSProperties; className?: string;
};

let fontsSettled = false, fontsPending: Promise<void> | null = null;
/** null once every Google Font requested so far has loaded (or failed to a fallback); else the promise that settles then. Canvas text
 * does not repaint when a font arrives the way DOM text does, so a canvas paints only after this.
 * shortcut: settles once, so a googleFont() first called after that is not awaited; call googleFont at module level. */
export function canvasFontsReady(): Promise<void> | null {
  if (fontsSettled) return null;
  fontsPending ??= whenGoogleFontsSettled().then(() => { fontsSettled = true; });
  return fontsPending;
}

/** A 2D canvas the film paints itself, synchronously for every frame: particles, type, shapes, any bespoke drawing. Same frame, same
 * pixels. The first paint waits for the film's Google Fonts, so canvas type never renders in a fallback face. */
export const Canvas2D = forwardRef<HTMLCanvasElement, Canvas2DProps>(function Canvas2D({width, height, draw, pixelDensity = 1, style, className}, ref) {
  validateCanvasSize(width, height, 'Canvas2D'); positive(pixelDensity, 'Canvas2D pixelDensity');
  const frame = useCurrentFrame(), {fps} = useVideoConfig();
  const canvas = useRef<HTMLCanvasElement>(null);
  useImperativeHandle(ref, () => canvas.current!, []);
  useLayoutEffect(() => {
    const paint = () => {
      const ctx = canvas.current?.getContext('2d');
      if (!ctx) return;
      ctx.reset();
      ctx.setTransform(pixelDensity, 0, 0, pixelDensity, 0, 0);
      draw(ctx, frame, {width, height, fps, time: frame / fps});
    };
    const fonts = canvasFontsReady();
    if (!fonts) { paint(); return; }
    const hold = delayRender('<Canvas2D> fonts');
    let live = true;
    fonts.then(() => { if (live) paint(); }).finally(() => continueRender(hold));
    return () => { live = false; };
  });
  return <canvas ref={canvas} width={Math.round(width * pixelDensity)} height={Math.round(height * pixelDensity)} className={className} style={{width, height, ...style}} />;
});
