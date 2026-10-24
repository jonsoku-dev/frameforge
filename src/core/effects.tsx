import React, {forwardRef, useImperativeHandle, useLayoutEffect, useRef} from 'react';
import {integer, positive, random} from './math';

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

/* ---------- Colour and film effects ---------- */
/** Pixels as `getImageData` returns them: non-premultiplied RGBA bytes, row-major. */
export type Pixels = {readonly data: Uint8ClampedArray; readonly width: number; readonly height: number};
const unit = (value: number, name: string, min: number, max: number) => { if (!(typeof value === 'number' && value >= min && value <= max)) throw new Error(`${name} must be a number between ${min} and ${max}, got ${String(value)}`); };
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
export const srgbToLinear = (byte: number): number => { const c = byte / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
export const linearToSrgb = (value: number): number => { const v = clamp01(value); return 255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055); };
/** Composites `color` with `alpha` over pixel `i` of non-premultiplied `data`, so overlays work on transparent canvases too. */
const over = (data: Uint8ClampedArray, i: number, r: number, g: number, b: number, alpha: number) => {
  const a = data[i + 3]! / 255, outA = alpha + a * (1 - alpha);
  if (outA <= 0) return;
  const keep = a * (1 - alpha) / outA, add = alpha / outA;
  data[i] = data[i]! * keep + r * add; data[i + 1] = data[i + 1]! * keep + g * add; data[i + 2] = data[i + 2]! * keep + b * add; data[i + 3] = outA * 255;
};
/** A 2D effect that draws the source and rewrites its pixels with `transform`. */
const pixelEffect = <P,>(type: string, label: string, calculateKey: (params: P) => string, validateParams: (params: P) => void, transform: (pixels: Pixels, params: P) => void) => createEffect<P, null>({
  type, label, documentationLink: null, backend: '2d', calculateKey, validateParams, setup: () => null, cleanup: () => {},
  apply: ({source, target, params, width, height}) => {
    const context = context2d(target);
    context.drawImage(source, 0, 0);
    const pixels = context.getImageData(0, 0, width, height);
    transform(pixels, params);
    context.putImageData(pixels, 0, 0);
  },
});

export type ColorCorrection = {
  /** Stops, -5..5; +1 doubles the linear light. */ exposure?: number;
  /** -1 cool .. 1 warm. */ temperature?: number;
  /** -1 green .. 1 magenta. */ tint?: number;
  /** Multiplier around `pivot`; 1 is neutral. */ contrast?: number; pivot?: number;
  /** 1 is neutral. */ saturation?: number;
  /** -1..1, raises muted colours more than saturated ones. */ vibrance?: number;
  /** -1..1 lifts of the four luminance regions. */ blacks?: number; shadows?: number; highlights?: number; whites?: number;
};
export const NEUTRAL_CORRECTION: Required<ColorCorrection> = {exposure: 0, temperature: 0, tint: 0, contrast: 1, pivot: 0.5, saturation: 1, vibrance: 0, blacks: 0, shadows: 0, highlights: 0, whites: 0};
const correctionRanges: Record<keyof ColorCorrection, [number, number]> = {exposure: [-5, 5], temperature: [-1, 1], tint: [-1, 1], contrast: [0, 4], pivot: [0, 1], saturation: [0, 4], vibrance: [-1, 1], blacks: [-1, 1], shadows: [-1, 1], highlights: [-1, 1], whites: [-1, 1]};
export function validateCorrection(params: ColorCorrection): Required<ColorCorrection> {
  const full = {...NEUTRAL_CORRECTION, ...params};
  for (const key of Object.keys(correctionRanges) as (keyof ColorCorrection)[]) unit(full[key], `colorCorrection ${key}`, ...correctionRanges[key]);
  return full;
}
/** Grades one sRGB pixel: exposure and white balance in linear light, then region lifts, contrast, saturation and vibrance on display values. Returns bytes. */
export function correctPixel(r: number, g: number, b: number, params: Required<ColorCorrection>): [number, number, number] {
  const gain = 2 ** params.exposure;
  let dr = linearToSrgb(srgbToLinear(r) * gain * (1 + 0.25 * params.temperature)) / 255;
  let dg = linearToSrgb(srgbToLinear(g) * gain * (1 - 0.25 * params.tint)) / 255;
  let db = linearToSrgb(srgbToLinear(b) * gain * (1 - 0.25 * params.temperature)) / 255;
  const luma = 0.2126 * dr + 0.7152 * dg + 0.0722 * db, dark = 1 - luma;
  // Each region weight peaks in its own quarter of the tonal range; a full lift moves a pixel by at most a quarter.
  const lift = 0.25 * (params.blacks * dark ** 3 + params.shadows * 3 * dark * dark * luma + params.highlights * 3 * luma * luma * dark + params.whites * luma ** 3);
  const grade = (c: number) => {
    c = params.pivot + (c + lift - params.pivot) * params.contrast;
    return c;
  };
  dr = grade(dr); dg = grade(dg); db = grade(db);
  const l = 0.2126 * dr + 0.7152 * dg + 0.0722 * db;
  const chroma = Math.max(dr, dg, db) - Math.min(dr, dg, db);
  const sat = params.saturation * (1 + params.vibrance * (1 - clamp01(chroma)));
  return [clamp01(l + (dr - l) * sat) * 255, clamp01(l + (dg - l) * sat) * 255, clamp01(l + (db - l) * sat) * 255];
}
export function applyCorrection(pixels: Pixels, params: ColorCorrection): Pixels {
  const full = validateCorrection(params), {data} = pixels;
  for (let i = 0; i < data.length; i += 4) { const [r, g, b] = correctPixel(data[i]!, data[i + 1]!, data[i + 2]!, full); data[i] = r; data[i + 1] = g; data[i + 2] = b; }
  return pixels;
}
/** Exposure, white balance, contrast, saturation, vibrance and tonal-region lifts; the defaults leave pixels unchanged. */
export const colorCorrectionEffect = pixelEffect<ColorCorrection>('frameforge/color-correction', 'Color correction', params => JSON.stringify(validateCorrection(params)), params => { validateCorrection(params); }, applyCorrection);

export type CubeLut = {readonly title: string; readonly size: number; readonly domainMin: readonly [number, number, number]; readonly domainMax: readonly [number, number, number]; /** size^3 RGB triples in 0..1, red fastest. */ readonly data: Float32Array; /** Stable identity for effect keys. */ readonly key: string};
/** Parses a 3D `.cube` file (TITLE, LUT_3D_SIZE, DOMAIN_MIN, DOMAIN_MAX, then size^3 rows with red changing fastest). */
export function parseCubeLut(text: string): CubeLut {
  let title = '', size = 0, domainMin: [number, number, number] = [0, 0, 0], domainMax: [number, number, number] = [1, 1, 1];
  const rows: number[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const [word, ...rest] = line.split(/\s+/);
    if (word === 'TITLE') { title = rest.join(' ').replace(/^"|"$/g, ''); continue; }
    if (word === 'LUT_3D_SIZE') { size = Number(rest[0]); continue; }
    if (word === 'LUT_1D_SIZE') throw new Error('parseCubeLut reads 3D LUTs only');
    if (word === 'DOMAIN_MIN' || word === 'DOMAIN_MAX') {
      const triple = rest.slice(0, 3).map(Number) as [number, number, number];
      if (triple.length !== 3 || triple.some(v => !Number.isFinite(v))) throw new Error(`parseCubeLut: bad ${word} line`);
      if (word === 'DOMAIN_MIN') domainMin = triple; else domainMax = triple;
      continue;
    }
    const triple = [word, ...rest].map(Number);
    if (triple.length !== 3 || triple.some(v => !Number.isFinite(v))) throw new Error(`parseCubeLut: unreadable line "${line}"`);
    rows.push(...triple);
  }
  if (!(Number.isInteger(size) && size >= 2)) throw new Error('parseCubeLut: LUT_3D_SIZE missing or below 2');
  if (rows.length !== size ** 3 * 3) throw new Error(`parseCubeLut: expected ${size ** 3} rows, got ${rows.length / 3}`);
  const data = Float32Array.from(rows);
  let sum = 0; for (let i = 0; i < data.length; i += 7) sum = (sum * 31 + Math.round(data[i]! * 4096)) % 2147483647;
  return {title, size, domainMin, domainMax, data, key: `${title}:${size}:${sum}`};
}
/** Trilinear lookup of `r, g, b` in 0..1; returns 0..1. */
export function sampleLut(lut: CubeLut, r: number, g: number, b: number): [number, number, number] {
  const n = lut.size, last = n - 1;
  const coord = (v: number, axis: number) => Math.min(last, Math.max(0, (v - lut.domainMin[axis]!) / (lut.domainMax[axis]! - lut.domainMin[axis]!) * last));
  const x = coord(r, 0), y = coord(g, 1), z = coord(b, 2);
  const x0 = Math.min(last - 1, Math.floor(x)), y0 = Math.min(last - 1, Math.floor(y)), z0 = Math.min(last - 1, Math.floor(z));
  const fx = x - x0, fy = y - y0, fz = z - z0;
  const out: [number, number, number] = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    const at = (i: number, j: number, k: number) => lut.data[(i + n * (j + n * k)) * 3 + c]!;
    const lerp = (a: number, b: number, f: number) => a + (b - a) * f;
    const xy0 = lerp(lerp(at(x0, y0, z0), at(x0 + 1, y0, z0), fx), lerp(at(x0, y0 + 1, z0), at(x0 + 1, y0 + 1, z0), fx), fy);
    const xy1 = lerp(lerp(at(x0, y0, z0 + 1), at(x0 + 1, y0, z0 + 1), fx), lerp(at(x0, y0 + 1, z0 + 1), at(x0 + 1, y0 + 1, z0 + 1), fx), fy);
    out[c] = lerp(xy0, xy1, fz);
  }
  return out;
}
export function applyLut(pixels: Pixels, {lut, intensity = 1}: {lut: CubeLut; intensity?: number}): Pixels {
  const {data} = pixels;
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = sampleLut(lut, data[i]! / 255, data[i + 1]! / 255, data[i + 2]! / 255);
    data[i] += (r * 255 - data[i]!) * intensity; data[i + 1] += (g * 255 - data[i + 1]!) * intensity; data[i + 2] += (b * 255 - data[i + 2]!) * intensity;
  }
  return pixels;
}
/** Applies a parsed `.cube` LUT with trilinear interpolation, mixed in by `intensity` (0..1). */
export const lutEffect = pixelEffect<{lut: CubeLut; intensity?: number}>('frameforge/lut', 'LUT', ({lut, intensity = 1}) => `${lut.key}:${intensity}`, ({lut, intensity = 1}) => { if (!lut?.data || !lut.size) throw new Error('lutEffect needs a LUT from parseCubeLut'); unit(intensity, 'lutEffect intensity', 0, 1); }, applyLut);

export type LightLeakParams = {seed: string | number; /** 0..1; nothing shows at 0 and 1, the leaks sweep in to the middle and out again. */ progress: number; /** Degrees added to the warm hues. */ hueShift?: number; intensity?: number; /** `#rgb`/`#rrggbb` colours cycled per blob instead of the warm hues, so a leak can stay on the film's palette. */ colors?: readonly string[]};
export type LightLeakBlob = {x: number; y: number; r: number; hue: number; alpha: number; color?: string};
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
/** `rgba()` of a hex colour; the LUT of the four film colours stays exact. */
const rgba = (hex: string, alpha: number) => { const h = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex; return `rgba(${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)}, ${clamp01(alpha)})`; };
/** Two to four seeded blobs in unit coordinates; `r` is a fraction of the longer side. */
export function lightLeakBlobs({seed, progress, hueShift = 0, intensity = 1, colors}: LightLeakParams): LightLeakBlob[] {
  if (!(progress > 0 && progress < 1)) return [];
  const envelope = Math.sin(Math.PI * progress);
  const count = 2 + Math.floor(random(`${seed}:leak-count`) * 3);
  return Array.from({length: count}, (_, i) => {
    const k = `${seed}:leak${i}`;
    const sweep = 0.8 + 0.6 * random(`${k}:sweep`), direction = random(`${k}:dir`) < 0.5 ? -1 : 1;
    return {
      x: random(`${k}:x`) + direction * (progress - 0.5) * sweep, y: 0.1 + 0.8 * random(`${k}:y`),
      r: 0.25 + 0.35 * random(`${k}:r`), hue: 8 + 40 * random(`${k}:hue`) + hueShift,
      alpha: intensity * envelope * (0.35 + 0.45 * random(`${k}:a`)), ...(colors?.length ? {color: colors[i % colors.length]!} : {}),
    };
  });
}
/** Procedural film light leak: warm soft radial gradients screen-blended over the source. */
export const lightLeakEffect = createEffect<LightLeakParams, null>({
  type: 'frameforge/light-leak', label: 'Light leak', documentationLink: null, backend: '2d', setup: () => null, cleanup: () => {},
  calculateKey: ({seed, progress, hueShift = 0, intensity = 1, colors = []}) => `${seed}:${progress}:${hueShift}:${intensity}:${colors.join(',')}`,
  validateParams: ({seed, progress, hueShift = 0, intensity = 1, colors = []}) => { if (seed === undefined || seed === null) throw new Error('lightLeakEffect needs a seed'); unit(progress, 'lightLeakEffect progress', 0, 1); unit(intensity, 'lightLeakEffect intensity', 0, 4); if (!Number.isFinite(hueShift)) throw new Error('lightLeakEffect hueShift must be finite'); for (const color of colors) if (!HEX.test(color)) throw new Error(`lightLeakEffect colors must be #rgb or #rrggbb, got ${color}`); },
  apply: ({source, target, params, width, height}) => {
    const context = context2d(target);
    context.drawImage(source, 0, 0);
    context.globalCompositeOperation = 'screen';
    const side = Math.max(width, height);
    for (const blob of lightLeakBlobs(params)) {
      const gradient = context.createRadialGradient(blob.x * width, blob.y * height, 0, blob.x * width, blob.y * height, blob.r * side);
      const stop = (alpha: number, shift = 0) => blob.color ? rgba(blob.color, alpha) : `hsla(${blob.hue + shift}, 100%, ${shift ? 55 : 62}%, ${clamp01(alpha)})`;
      gradient.addColorStop(0, stop(blob.alpha)); gradient.addColorStop(0.55, stop(blob.alpha * 0.35, 12)); gradient.addColorStop(1, stop(0));
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);
    }
  },
});

export type VignetteParams = {/** Darkness at the corners, 0..1. */ amount?: number; /** 0 is a hard edge, 1 starts darkening at the centre. */ softness?: number; /** 1 round, 0 follows the frame's rectangle. */ roundness?: number};
/** Darkening alpha at normalized position `nx, ny` in -1..1 (corners are 1 on both axes). */
export function vignetteAlpha(nx: number, ny: number, {amount = 0.5, softness = 0.5, roundness = 1}: VignetteParams): number {
  const round = Math.sqrt((nx * nx + ny * ny) / 2), square = Math.max(Math.abs(nx), Math.abs(ny));
  const d = square + (round - square) * roundness;
  const edge = Math.max(1e-6, softness);
  const s = clamp01((d - (1 - edge)) / edge);
  return amount * s * s * (3 - 2 * s);
}
export function applyVignette(pixels: Pixels, params: VignetteParams): Pixels {
  const {data, width, height} = pixels;
  for (let y = 0; y < height; y++) {
    const ny = (y + 0.5) / height * 2 - 1;
    for (let x = 0; x < width; x++) over(data, (y * width + x) * 4, 0, 0, 0, vignetteAlpha((x + 0.5) / width * 2 - 1, ny, params));
  }
  return pixels;
}
/** Darkens towards the corners; on a transparent canvas it writes black with alpha, so it works as an overlay. */
export const vignetteEffect = pixelEffect<VignetteParams>('frameforge/vignette', 'Vignette', ({amount = 0.5, softness = 0.5, roundness = 1}) => `${amount}:${softness}:${roundness}`, ({amount = 0.5, softness = 0.5, roundness = 1}) => { unit(amount, 'vignetteEffect amount', 0, 1); unit(softness, 'vignetteEffect softness', 0, 1); unit(roundness, 'vignetteEffect roundness', 0, 1); }, applyVignette);

export type GrainParams = {seed: string | number; /** The frame the grain is drawn for; same (seed, frame) gives the same grain. */ frame: number; /** Strength 0..1. */ amount?: number; /** Grain cell size in pixels, 1 or more. */ size?: number};
export const GRAIN_TILE = 256;
/** A GRAIN_TILE x GRAIN_TILE tile of values in -1..1 from `random`, regenerated per (seed, frame); repeated over the canvas. */
export function grainTile(seed: string | number, frame: number): Float32Array {
  const tile = new Float32Array(GRAIN_TILE * GRAIN_TILE);
  for (let i = 0; i < tile.length; i++) tile[i] = random(`${seed}:g${frame}:${i}`) * 2 - 1;
  return tile;
}
export function applyGrain(pixels: Pixels, {seed, frame, amount = 0.2, size = 1}: GrainParams): Pixels {
  const tile = grainTile(seed, frame), {data, width, height} = pixels, cell = Math.max(1, size);
  for (let y = 0; y < height; y++) {
    const ty = Math.floor(y / cell) % GRAIN_TILE;
    for (let x = 0; x < width; x++) {
      const n = tile[ty * GRAIN_TILE + Math.floor(x / cell) % GRAIN_TILE]!, lum = n > 0 ? 255 : 0;
      over(data, (y * width + x) * 4, lum, lum, lum, Math.abs(n) * amount);
    }
  }
  return pixels;
}
/** Monochrome film grain, deterministic per (seed, frame) and moving across frames; works as an overlay on a transparent canvas. */
export const grainEffect = pixelEffect<GrainParams>('frameforge/grain', 'Grain', ({seed, frame, amount = 0.2, size = 1}) => `${seed}:${frame}:${amount}:${size}`, ({seed, frame, amount = 0.2, size = 1}) => { if (seed === undefined || seed === null) throw new Error('grainEffect needs a seed'); if (!Number.isFinite(frame)) throw new Error('grainEffect frame must be a number'); unit(amount, 'grainEffect amount', 0, 1); if (!(size >= 1)) throw new Error('grainEffect size must be 1 or more'); }, applyGrain);
