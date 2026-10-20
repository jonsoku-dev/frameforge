import React, {forwardRef, useImperativeHandle, useLayoutEffect, useRef} from 'react';
import {integer, positive} from './math';

export type EffectBackend = '2d' | 'webgl2' | 'webgpu';
export type EffectApplyParams<P, S> = {
  readonly source: CanvasImageSource; readonly target: HTMLCanvasElement; readonly state: S; readonly params: P;
  readonly width: number; readonly height: number; readonly gpuDevice: null; readonly flipSourceY: boolean;
};
export type EffectDefinition<P, S = unknown> = {
  readonly type: string; readonly label: string; readonly documentationLink: string | null; readonly backend: EffectBackend;
  /** Two descriptors of one definition with the same key are the same effect instance. */
  readonly calculateKey: (params: P) => string;
  readonly setup: (target: HTMLCanvasElement) => S;
  readonly apply: (params: EffectApplyParams<P, S>) => void;
  readonly cleanup: (state: S) => void;
  /** Studio controls; carried through, unused by the engine. */
  readonly schema?: Record<string, unknown>;
  readonly validateParams: (params: P) => void;
};
export type EffectDescriptor<P = unknown> = {readonly definition: EffectDefinition<P, unknown>; readonly effectKey: string; readonly params: P; readonly memoized: false};
export type EffectsProp = ReadonlyArray<EffectDescriptor<any>>;
type Toggle = {readonly disabled?: boolean};

/** Turns an effect definition into a factory whose descriptors go in a component's `effects` array. */
export function createEffect<P, S>(definition: EffectDefinition<P, S>): (params?: P & Toggle) => EffectDescriptor<P & Toggle> {
  if (!definition || typeof definition.type !== 'string' || !definition.type) throw new Error('createEffect requires a definition with a type');
  for (const name of ['calculateKey', 'setup', 'apply', 'cleanup', 'validateParams'] as const) if (typeof definition[name] !== 'function') throw new Error(`createEffect ${definition.type}: ${name} must be a function`);
  if (!['2d', 'webgl2', 'webgpu'].includes(definition.backend)) throw new Error(`createEffect ${definition.type}: unknown backend ${String(definition.backend)}`);
  return (params = {} as P & Toggle) => {
    definition.validateParams(params);
    return {definition: definition as unknown as EffectDefinition<P & Toggle, unknown>, effectKey: `${definition.calculateKey(params)}-disabled-${Boolean(params.disabled)}`, params, memoized: false};
  };
}

/** Runs each enabled effect in order, each painting into a fresh canvas from the previous output; returns the last canvas. */
export function runEffectChain(source: HTMLCanvasElement, effects: EffectsProp, width: number, height: number, createCanvas: () => HTMLCanvasElement = () => document.createElement('canvas')): HTMLCanvasElement {
  let current = source;
  for (const effect of effects) {
    if ((effect.params as Toggle | undefined)?.disabled) continue;
    const {definition} = effect;
    // shortcut: only 2D canvas effects run; add WebGL2/WebGPU contexts when an effect needs a shader
    if (definition.backend !== '2d') throw new Error(`Effect ${definition.type} needs the ${definition.backend} backend; FrameForge runs 2D canvas effects only`);
    const target = createCanvas();
    target.width = width; target.height = height;
    const state = definition.setup(target);
    try { definition.apply({source: current, target, state, params: effect.params, width, height, gpuDevice: null, flipSourceY: false}); }
    finally { definition.cleanup(state); }
    current = target;
  }
  return current;
}

/** Applies a row-major 4x5 color matrix (feColorMatrix layout, offsets in 0-1 units) to RGBA bytes in place. */
export function applyColorMatrix(data: Uint8ClampedArray, matrix: readonly number[]): Uint8ClampedArray {
  if (matrix.length !== 20 || matrix.some(value => !Number.isFinite(value))) throw new Error('colorMatrix needs 20 finite numbers');
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!, a = data[i + 3]!;
    for (let row = 0; row < 4; row++) {
      const m = row * 5;
      data[i + row] = matrix[m]! * r + matrix[m + 1]! * g + matrix[m + 2]! * b + matrix[m + 3]! * a + matrix[m + 4]! * 255;
    }
  }
  return data;
}

const context2d = (canvas: HTMLCanvasElement) => {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not get a 2D canvas context');
  return context;
};
/** Gaussian blur through the canvas `filter`; `radius` in pixels. */
export const blurEffect = createEffect<{radius: number}, null>({
  type: 'frameforge/blur', label: 'Blur', documentationLink: null, backend: '2d',
  calculateKey: ({radius}) => String(radius), setup: () => null, cleanup: () => {},
  validateParams: params => { if (!(params?.radius >= 0)) throw new Error('blurEffect radius must be a nonnegative number'); },
  apply: ({source, target, params}) => { const context = context2d(target); context.filter = `blur(${params.radius}px)`; context.drawImage(source, 0, 0); },
});
/** Per-pixel 4x5 color matrix, see `applyColorMatrix`. */
export const colorMatrixEffect = createEffect<{matrix: readonly number[]}, null>({
  type: 'frameforge/color-matrix', label: 'Color matrix', documentationLink: null, backend: '2d',
  calculateKey: ({matrix}) => matrix.join(','), setup: () => null, cleanup: () => {},
  validateParams: params => { applyColorMatrix(new Uint8ClampedArray(0), params?.matrix ?? []); },
  apply: ({source, target, params, width, height}) => {
    const context = context2d(target);
    context.drawImage(source, 0, 0);
    const pixels = context.getImageData(0, 0, width, height);
    applyColorMatrix(pixels.data, params.matrix);
    context.putImageData(pixels, 0, 0);
  },
});

export type ImageFit = 'fill' | 'contain' | 'cover';
/** Where a `sourceWidth` x `sourceHeight` picture lands inside a `width` x `height` box. */
export function fitRect(fit: ImageFit, sourceWidth: number, sourceHeight: number, width: number, height: number): {x: number; y: number; width: number; height: number} {
  if (fit === 'fill') return {x: 0, y: 0, width, height};
  if (fit !== 'contain' && fit !== 'cover') throw new Error(`fit must be 'fill', 'contain' or 'cover', got ${String(fit)}`);
  const scale = (fit === 'contain' ? Math.min : Math.max)(width / sourceWidth, height / sourceHeight);
  const w = sourceWidth * scale, h = sourceHeight * scale;
  return {x: (width - w) / 2, y: (height - h) / 2, width: w, height: h};
}

/** Sizes `canvas` to `width` x `height` logical pixels at `density`, paints with `draw`, then runs `effects`. */
export function paintCanvas(canvas: HTMLCanvasElement, {width, height, density = 1, effects = []}: {width: number; height: number; density?: number; effects?: EffectsProp}, draw: (context: CanvasRenderingContext2D, width: number, height: number) => void): void {
  const w = Math.round(width * density), h = Math.round(height * density);
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const source = effects.length ? document.createElement('canvas') : canvas;
  if (source !== canvas) { source.width = w; source.height = h; }
  const context = context2d(source);
  context.setTransform(density, 0, 0, density, 0, 0);
  context.clearRect(0, 0, width, height);
  draw(context, width, height);
  if (source === canvas) return;
  const output = runEffectChain(source, effects, w, h);
  const visible = context2d(canvas);
  visible.setTransform(1, 0, 0, 1, 0, 0);
  visible.clearRect(0, 0, w, h);
  visible.drawImage(output, 0, 0);
}

export function validateCanvasSize(width: number, height: number, component: string): void {
  integer(width, `${component} width`); positive(width, `${component} width`);
  integer(height, `${component} height`); positive(height, `${component} height`);
}
/** Clip-path for the documented crop ratios, or undefined when nothing is cropped. */
export function cropClipPath({cropLeft = 0, cropRight = 0, cropTop = 0, cropBottom = 0}: CropProps): string | undefined {
  for (const [name, value] of [['cropLeft', cropLeft], ['cropRight', cropRight], ['cropTop', cropTop], ['cropBottom', cropBottom]] as const) if (!(value >= 0 && value <= 1)) throw new Error(`${name} must be between 0 and 1`);
  if (!cropLeft && !cropRight && !cropTop && !cropBottom) return undefined;
  const percent = (value: number) => `${value * 100}%`;
  return `inset(${percent(cropTop)} ${percent(cropRight)} ${percent(cropBottom)} ${percent(cropLeft)})`;
}
export type CropProps = {cropLeft?: number; cropRight?: number; cropTop?: number; cropBottom?: number};

export type SolidProps = CropProps & {width: number; height: number; color?: string; effects?: EffectsProp; className?: string; style?: React.CSSProperties; pixelDensity?: number};
/** A canvas filled with one color (transparent without `color`), then passed through `effects`. */
export const Solid = forwardRef<HTMLCanvasElement, SolidProps>(function Solid({width, height, color, effects, className, style, pixelDensity = 1, cropLeft, cropRight, cropTop, cropBottom}, ref) {
  validateCanvasSize(width, height, 'Solid'); positive(pixelDensity, 'Solid pixelDensity');
  const canvas = useRef<HTMLCanvasElement>(null);
  useImperativeHandle(ref, () => canvas.current!, []);
  useLayoutEffect(() => {
    paintCanvas(canvas.current!, {width, height, density: pixelDensity, effects}, (context, w, h) => {
      if (color) { context.fillStyle = color; context.fillRect(0, 0, w, h); }
    });
  });
  return <canvas ref={canvas} width={Math.round(width * pixelDensity)} height={Math.round(height * pixelDensity)} className={className} style={{width, height, clipPath: cropClipPath({cropLeft, cropRight, cropTop, cropBottom}), ...style}} />;
});
