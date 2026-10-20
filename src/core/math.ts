export type EasingFunction = (value: number) => number;
export const finite = (value: number, name: string): number => {
  if (!Number.isFinite(value)) throw new Error(`${name} must be finite`);
  return value;
};
export const positive = (value: number, name: string): number => {
  finite(value, name);
  if (value <= 0) throw new Error(`${name} must be positive`);
  return value;
};
export const integer = (value: number, name: string): number => {
  finite(value, name);
  if (!Number.isInteger(value)) throw new Error(`${name} must be an integer`);
  return value;
};
// shortcut: mirrors the reference (4.0.537), where circle and bounce clamp their input to 0..1 while the other easings extrapolate; keep it so extend/identity extrapolation matches
const bounce = (x: number): number => {
  const n = 7.5625, d = 2.75;
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  if (x < 1 / d) return n * x * x;
  if (x < 2 / d) { x -= 1.5 / d; return n * x * x + 0.75; }
  if (x < 2.5 / d) { x -= 2.25 / d; return n * x * x + 0.9375; }
  x -= 2.625 / d; return n * x * x + 0.984375;
};
export const Easing = {
  linear: (x: number) => x,
  quad: (x: number) => x * x,
  cubic: (x: number) => x * x * x,
  poly: (power: number): EasingFunction => { positive(power, 'power'); return x => x ** power; },
  sin: (x: number) => 1 - Math.cos(x * Math.PI / 2),
  circle: (x: number) => x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.sqrt(1 - x * x),
  exp: (x: number) => 2 ** (10 * (x - 1)),
  bounce,
  back: (amount = 1.70158): EasingFunction => x => x * x * ((amount + 1) * x - amount),
  elastic: (bounciness = 1): EasingFunction => x => x === 0 || x === 1 ? x :
    1 - Math.cos(x * Math.PI / 2) ** 3 * Math.cos(x * bounciness * Math.PI),
  in: (easing: EasingFunction): EasingFunction => easing,
  out: (easing: EasingFunction): EasingFunction => x => 1 - easing(1 - x),
  inOut: (easing: EasingFunction): EasingFunction => x => x < 0.5 ? easing(x * 2) / 2 : 1 - easing((1 - x) * 2) / 2,
  bezier: (x1: number, y1: number, x2: number, y2: number): EasingFunction => {
    [x1, y1, x2, y2].forEach(v => finite(v, 'bezier control point'));
    if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) throw new Error('bezier x control points must be in [0, 1]');
    const curve = (t: number, a: number, b: number) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t * t * b + t ** 3;
    return x => {
      if (x <= 0 || x >= 1) return x;
      let low = 0, high = 1;
      for (let i = 0; i < 40; i++) {
        const mid = (low + high) / 2;
        if (curve(mid, x1, x2) < x) low = mid; else high = mid;
      }
      return curve((low + high) / 2, y1, y2);
    };
  },
};
export type Extrapolation = 'extend' | 'clamp' | 'identity';
export type InterpolateOptions = {
  extrapolateLeft?: Extrapolation; extrapolateRight?: Extrapolation;
  /** One function, or one per segment between keyframes. */
  easing?: EasingFunction | readonly EasingFunction[];
  /** Quantizes the input to multiples of this step before interpolating. */
  posterize?: number;
};
export function interpolate(input: number, inputRange: readonly number[], outputRange: readonly number[], options: InterpolateOptions = {}): number {
  finite(input, 'interpolate input');
  if (inputRange.length < 2 || inputRange.length !== outputRange.length) throw new Error('interpolate ranges must have equal lengths of at least two');
  inputRange.forEach((v, i) => {
    finite(v, 'inputRange'); finite(outputRange[i], 'outputRange');
    if (i > 0 && v <= inputRange[i - 1]) throw new Error('inputRange must be strictly increasing');
  });
  assertValidInterpolateEasingOption(options.easing, inputRange.length);
  assertValidInterpolatePosterizeOption(options.posterize);
  input = posterized(input, options.posterize);
  const left = options.extrapolateLeft ?? 'extend', right = options.extrapolateRight ?? 'extend';
  for (const mode of [left, right]) if (!['extend', 'clamp', 'identity'].includes(mode)) throw new Error('Invalid extrapolation mode');
  const last = inputRange.length - 1;
  if (input < inputRange[0]) {
    if (left === 'identity') return input;
    if (left === 'clamp') input = inputRange[0];
  }
  if (input > inputRange[last]) {
    if (right === 'identity') return input;
    if (right === 'clamp') input = inputRange[last];
  }
  let segment = 0;
  while (segment < last - 1 && input > inputRange[segment + 1]) segment++;
  const progress = (input - inputRange[segment]) / (inputRange[segment + 1] - inputRange[segment]);
  return outputRange[segment] + (outputRange[segment + 1] - outputRange[segment]) * (typeof options.easing === 'object' ? options.easing[segment]! : options.easing ?? Easing.linear)(progress);
}
export type SpringOptions = {
  frame: number; fps: number; from?: number; to?: number; delay?: number;
  config?: SpringConfig;
  durationInFrames?: number; durationRestThreshold?: number; reverse?: boolean;
};
export type SpringConfig = {mass?: number; damping?: number; stiffness?: number; overshootClamping?: boolean};
const springShape = (config: SpringConfig) => {
  const mass = positive(config.mass ?? 1, 'mass'), stiffness = positive(config.stiffness ?? 100, 'stiffness');
  const damping = finite(config.damping ?? 10, 'damping');
  if (damping < 0) throw new Error('damping must be nonnegative');
  const w = Math.sqrt(stiffness / mass);
  // Numeric API probes observed that above-critical damping uses the critical response.
  const a = Math.min(damping / (2 * mass), w);
  return {a, w, critical: Math.abs(a - w) < 1e-8, b: Math.sqrt(w * w - a * a)};
};
/** Closed-form response; pipeline is delay, duration stretch, reverse, then the response. */
export function spring({frame, fps, from = 0, to = 1, delay = 0, config = {}, durationInFrames, durationRestThreshold, reverse}: SpringOptions): number {
  finite(frame, 'spring frame'); positive(fps, 'fps'); finite(from, 'from'); finite(to, 'to'); finite(delay, 'delay');
  const {a, critical, b} = springShape(config);
  let f = frame - delay;
  const natural = durationInFrames !== undefined || reverse ? measureSpring({fps, config, threshold: durationRestThreshold}) : 0;
  if (durationInFrames !== undefined) {
    positive(durationInFrames, 'durationInFrames');
    if (f > durationInFrames) return reverse ? from : to;
    f = f * natural / durationInFrames;
  }
  if (reverse) f = natural - f;
  const t = Math.max(0, f / fps);
  const displacement = critical ? Math.exp(-a * t) * (1 + a * t) : Math.exp(-a * t) * (Math.cos(b * t) + a / b * Math.sin(b * t));
  let progress = 1 - displacement;
  // shortcut: mirrors the reference renderer (4.0.537), which clamps the normalized progress against `to` instead of 1; revisit when upstream changes it
  if (config.overshootClamping) progress = to > from ? Math.min(progress, to) : Math.max(progress, to);
  return from + (to - from) * progress;
}
/** Frames after which the spring stays within threshold of `to`. */
export function measureSpring({fps, config = {}, threshold = 0.005, from = 0, to = 1}: {fps: number; config?: SpringConfig; threshold?: number; from?: number; to?: number}): number {
  positive(fps, 'fps'); positive(threshold, 'threshold');
  const {a, critical, b} = springShape(config), span = Math.abs(to - from);
  let last = -1;
  for (let frame = 0; frame < 100000; frame++) {
    const t = frame / fps;
    const bound = Math.exp(-a * t) * (critical ? 1 + a * t : Math.sqrt(1 + (a / b) ** 2));
    if (bound * span < threshold) return last + 1;
    if (Math.abs(spring({frame, fps, config: {...config, overshootClamping: false}, from, to}) - to) > threshold) last = frame;
  }
  throw new Error('measureSpring did not settle within 100000 frames');
}
function mulberry32(a: number): number {
  a += 0x6D2B79F5; // oracle adds before truncating, which differs for seeds above 2^53
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export function random(seed: string | number | null): number {
  if (seed === null) return Math.random();
  if (typeof seed === 'string') { let h = 0; for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0; return mulberry32(h); }
  if (typeof seed === 'number') return mulberry32(seed * 10000000000);
  throw new Error('random() argument must be a number or a string');
}
/** Throws unless `easing` is undefined, one function, or an array with one function per segment (`inputRangeLength - 1` entries). */
export function assertValidInterpolateEasingOption(easing: EasingFunction | readonly EasingFunction[] | undefined, inputRangeLength: number): void {
  if (easing === undefined || typeof easing === 'function') return;
  const list = easing as readonly unknown[];
  if (list.length !== inputRangeLength - 1) throw new Error(`easing array needs ${inputRangeLength - 1} entries, one per segment, but has ${list.length}`);
  list.forEach((entry, index) => { if (typeof entry !== 'function') throw new Error(`easing[${index}] must be a function`); });
}
/** Throws unless `posterize` is undefined or a positive finite number. */
export function assertValidInterpolatePosterizeOption(posterize: number | undefined): void {
  if (posterize !== undefined && !(typeof posterize === 'number' && Number.isFinite(posterize) && posterize > 0)) throw new Error(`posterize must be a positive finite number, got ${String(posterize)}`);
}
// CSS named colors; lookups are case-sensitive, as in the reference.
const CSS_COLORS: Record<string, number> = {aliceblue: 0xf0f8ff, antiquewhite: 0xfaebd7, aqua: 0x00ffff, aquamarine: 0x7fffd4, azure: 0xf0ffff, beige: 0xf5f5dc, bisque: 0xffe4c4, black: 0x000000, blanchedalmond: 0xffebcd, blue: 0x0000ff, blueviolet: 0x8a2be2, brown: 0xa52a2a, burlywood: 0xdeb887, cadetblue: 0x5f9ea0, chartreuse: 0x7fff00, chocolate: 0xd2691e, coral: 0xff7f50, cornflowerblue: 0x6495ed, cornsilk: 0xfff8dc, crimson: 0xdc143c, cyan: 0x00ffff, darkblue: 0x00008b, darkcyan: 0x008b8b, darkgoldenrod: 0xb8860b, darkgray: 0xa9a9a9, darkgreen: 0x006400, darkgrey: 0xa9a9a9, darkkhaki: 0xbdb76b, darkmagenta: 0x8b008b, darkolivegreen: 0x556b2f, darkorange: 0xff8c00, darkorchid: 0x9932cc, darkred: 0x8b0000, darksalmon: 0xe9967a, darkseagreen: 0x8fbc8f, darkslateblue: 0x483d8b, darkslategray: 0x2f4f4f, darkslategrey: 0x2f4f4f, darkturquoise: 0x00ced1, darkviolet: 0x9400d3, deeppink: 0xff1493, deepskyblue: 0x00bfff, dimgray: 0x696969, dimgrey: 0x696969, dodgerblue: 0x1e90ff, firebrick: 0xb22222, floralwhite: 0xfffaf0, forestgreen: 0x228b22, fuchsia: 0xff00ff, gainsboro: 0xdcdcdc, ghostwhite: 0xf8f8ff, gold: 0xffd700, goldenrod: 0xdaa520, gray: 0x808080, green: 0x008000, greenyellow: 0xadff2f, grey: 0x808080, honeydew: 0xf0fff0, hotpink: 0xff69b4, indianred: 0xcd5c5c, indigo: 0x4b0082, ivory: 0xfffff0, khaki: 0xf0e68c, lavender: 0xe6e6fa, lavenderblush: 0xfff0f5, lawngreen: 0x7cfc00, lemonchiffon: 0xfffacd, lightblue: 0xadd8e6, lightcoral: 0xf08080, lightcyan: 0xe0ffff, lightgoldenrodyellow: 0xfafad2, lightgray: 0xd3d3d3, lightgreen: 0x90ee90, lightgrey: 0xd3d3d3, lightpink: 0xffb6c1, lightsalmon: 0xffa07a, lightseagreen: 0x20b2aa, lightskyblue: 0x87cefa, lightslategray: 0x778899, lightslategrey: 0x778899, lightsteelblue: 0xb0c4de, lightyellow: 0xffffe0, lime: 0x00ff00, limegreen: 0x32cd32, linen: 0xfaf0e6, magenta: 0xff00ff, maroon: 0x800000, mediumaquamarine: 0x66cdaa, mediumblue: 0x0000cd, mediumorchid: 0xba55d3, mediumpurple: 0x9370db, mediumseagreen: 0x3cb371, mediumslateblue: 0x7b68ee, mediumspringgreen: 0x00fa9a, mediumturquoise: 0x48d1cc, mediumvioletred: 0xc71585, midnightblue: 0x191970, mintcream: 0xf5fffa, mistyrose: 0xffe4e1, moccasin: 0xffe4b5, navajowhite: 0xffdead, navy: 0x000080, oldlace: 0xfdf5e6, olive: 0x808000, olivedrab: 0x6b8e23, orange: 0xffa500, orangered: 0xff4500, orchid: 0xda70d6, palegoldenrod: 0xeee8aa, palegreen: 0x98fb98, paleturquoise: 0xafeeee, palevioletred: 0xdb7093, papayawhip: 0xffefd5, peachpuff: 0xffdab9, peru: 0xcd853f, pink: 0xffc0cb, plum: 0xdda0dd, powderblue: 0xb0e0e6, purple: 0x800080, rebeccapurple: 0x663399, red: 0xff0000, rosybrown: 0xbc8f8f, royalblue: 0x4169e1, saddlebrown: 0x8b4513, salmon: 0xfa8072, sandybrown: 0xf4a460, seagreen: 0x2e8b57, seashell: 0xfff5ee, sienna: 0xa0522d, silver: 0xc0c0c0, skyblue: 0x87ceeb, slateblue: 0x6a5acd, slategray: 0x708090, slategrey: 0x708090, snow: 0xfffafa, springgreen: 0x00ff7f, steelblue: 0x4682b4, tan: 0xd2b48c, teal: 0x008080, thistle: 0xd8bfd8, tomato: 0xff6347, turquoise: 0x40e0d0, violet: 0xee82ee, wheat: 0xf5deb3, white: 0xffffff, whitesmoke: 0xf5f5f5, yellow: 0xffff00, yellowgreen: 0x9acd32};
type Rgba = [number, number, number, number]; // 0-255 bytes; r, g, b are integers, alpha is a rounded byte
const NUM = String.raw`[-+]?\d*\.?\d+`;
const RGB = new RegExp(String.raw`^rgb\(\s*(${NUM})\s*,\s*(${NUM})\s*,\s*(${NUM})\s*\)`);
const RGBA = new RegExp(String.raw`^rgba\(\s*(${NUM})\s*,\s*(${NUM})\s*,\s*(${NUM})\s*,\s*(${NUM})\s*\)`);
const HSL = new RegExp(String.raw`^hsl\(\s*(${NUM})\s*,\s*(${NUM})%\s*,\s*(${NUM})%\s*\)`);
const HSLA = new RegExp(String.raw`^hsla\(\s*(${NUM})\s*,\s*(${NUM})%\s*,\s*(${NUM})%\s*,\s*(${NUM})\s*\)`);
const PART = String.raw`(none|${NUM}(?:%|deg|g?rad|turn)?)`;
const SPACED = new RegExp(String.raw`^(oklch|oklab|lab|lch|hwb)\(\s*${PART}\s+${PART}\s+${PART}\s*(?:\/\s*(none|${NUM}%?)\s*)?\)`);
const byte = (unit: number) => Math.round(Math.min(1, Math.max(0, unit)) * 255);
// A component: `none` is 0, `%` scales by `percent` (the value 100% stands for), a bare number is taken as is.
const part = (text: string, percent: number) => text === 'none' ? 0 : text.endsWith('%') ? parseFloat(text) / 100 * percent : parseFloat(text);
// shortcut: `grad` is read as radians, matching what the reference (4.0.537) returns for it; switch to 400 grad per turn if it changes
const hue = (text: string) => text === 'none' ? 0 : text.endsWith('turn') ? parseFloat(text) * 360 : text.endsWith('rad') ? parseFloat(text) * 180 / Math.PI : parseFloat(text);
const gamma = (v: number) => v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
const linearSrgb = (r: number, g: number, b: number): [number, number, number] => [byte(gamma(r)), byte(gamma(g)), byte(gamma(b))];
function hslUnit(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)];
}
function oklabToRgb(L: number, a: number, b: number): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return linearSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);
}
// shortcut: Lab uses the D65 white (0.95047, 1, 1.08883) and Lindbloom's XYZ-to-sRGB matrix with no chromatic adaptation, which is what the reference (4.0.537) returns; CSS Color 4 says D50, so revisit if upstream switches
function labToRgb(L: number, a: number, b: number): [number, number, number] {
  const kappa = 24389 / 27, epsilon = 216 / 24389;
  const fy = (L + 16) / 116, fx = a / 500 + fy, fz = fy - b / 200;
  const X = (fx ** 3 > epsilon ? fx ** 3 : (116 * fx - 16) / kappa) * 0.95047;
  const Y = L > kappa * epsilon ? fy ** 3 : L / kappa;
  const Z = (fz ** 3 > epsilon ? fz ** 3 : (116 * fz - 16) / kappa) * 1.08883;
  return linearSrgb(3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z, -0.969266 * X + 1.8760108 * Y + 0.041556 * Z, 0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z);
}
const polar = (c: number, h: number): [number, number] => [c * Math.cos(h * Math.PI / 180), c * Math.sin(h * Math.PI / 180)];
const unitAlpha = (value: number) => Math.round(Math.min(1, Math.max(0, value)) * 255);
/** Parses one CSS color into rgba bytes; throws on anything the reference rejects. */
function parseColor(color: unknown): Rgba {
  if (typeof color !== 'string') throw new Error(`interpolateColors: ${String(color)} is not a color string`);
  const named = Object.hasOwn(CSS_COLORS, color) ? CSS_COLORS[color] : undefined;
  if (named !== undefined) return [named >> 16, (named >> 8) & 255, named & 255, 255];
  if (color === 'transparent') return [0, 0, 0, 0];
  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(color)?.[1];
  if (hex) {
    const full = hex.length <= 4 ? [...hex].map(c => c + c).join('') : hex;
    const value = full.length === 6 ? full + 'ff' : full;
    return [0, 2, 4, 6].map(i => parseInt(value.slice(i, i + 2), 16)) as Rgba;
  }
  const channel = (text: string) => Math.min(255, Math.max(0, Math.trunc(parseFloat(text))));
  let m = RGB.exec(color) ?? RGBA.exec(color);
  if (m) return [channel(m[1]!), channel(m[2]!), channel(m[3]!), m[4] === undefined ? 255 : unitAlpha(parseFloat(m[4]))];
  m = HSL.exec(color) ?? HSLA.exec(color);
  if (m) {
    const clamp = (text: string) => Math.min(1, Math.max(0, parseFloat(text) / 100));
    const h = ((parseFloat(m[1]!) % 360) + 360) % 360;
    return [...hslUnit(h, clamp(m[2]!), clamp(m[3]!)).map(byte), m[4] === undefined ? 255 : unitAlpha(parseFloat(m[4]))] as Rgba;
  }
  m = SPACED.exec(color);
  if (m) {
    const [, space, p1 = '', p2 = '', p3 = '', alpha] = m;
    const a = alpha === undefined || alpha === 'none' ? 255 : unitAlpha(part(alpha, 1));
    let rgb: [number, number, number];
    if (space === 'oklch') rgb = oklabToRgb(part(p1, 1), ...polar(part(p2, 0.4), hue(p3)));
    else if (space === 'oklab') rgb = oklabToRgb(part(p1, 1), part(p2, 0.4), part(p3, 0.4));
    else if (space === 'lab') rgb = labToRgb(part(p1, 100), part(p2, 125), part(p3, 125));
    else if (space === 'lch') rgb = labToRgb(part(p1, 100), ...polar(part(p2, 150), hue(p3)));
    else {
      const w = part(p2, 1), b = part(p3, 1);
      const unit = w + b >= 1 ? [w / (w + b), w / (w + b), w / (w + b)] : hslUnit(((hue(p1) % 360) + 360) % 360, 1, 0.5).map(v => v * (1 - w - b) + w);
      rgb = unit.map(byte) as [number, number, number];
    }
    return [...rgb, a];
  }
  throw new Error(`interpolateColors: invalid color string ${color}`);
}
const posterized = (input: number, posterize: number | undefined) => posterize === undefined ? input : Math.floor(input / posterize) * posterize;
export type InterpolateColorsOptions = {easing?: EasingFunction | readonly EasingFunction[]; posterize?: number};
/** Maps `input` across colour stops; always clamps and returns `rgba(r, g, b, a)` with integer channels and alpha to three decimals. */
export function interpolateColors(input: number, inputRange: readonly number[], outputRange: readonly string[], options: InterpolateColorsOptions = {}): string {
  finite(input, 'interpolateColors input');
  if (inputRange.length < 1 || inputRange.length !== outputRange.length) throw new Error('interpolateColors ranges must have equal lengths of at least one');
  assertValidInterpolateEasingOption(options.easing, inputRange.length);
  assertValidInterpolatePosterizeOption(options.posterize);
  const colors = outputRange.map(parseColor);
  const format = ([r, g, b, a]: number[]) => `rgba(${Math.round(r!)}, ${Math.round(g!)}, ${Math.round(b!)}, ${Math.round(a! / 255 * 1000) / 1000})`;
  if (colors.length === 1) { inputRange.forEach(v => finite(v, 'inputRange')); return format(colors[0]!); }
  const at = posterized(input, options.posterize);
  const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: options.easing} as const;
  return format([0, 1, 2, 3].map(i => interpolate(at, inputRange, colors.map(c => c[i]!), clamp)));
}
