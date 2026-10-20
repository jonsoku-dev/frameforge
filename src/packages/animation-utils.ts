import type React from 'react';
import {interpolate, interpolateColors, type InterpolateOptions} from '../core/math';

const lengthUnits = ['px', 'em', 'rem', 'pt', 'cap', 'ch', 'ex', 'ic', 'lh', 'rlh', 'vmax', 'vmin', 'vb', 'vi', 'cqw', 'vh', 'vw', 'cqh', 'cqi', 'cqb', 'cqmin', 'cqmax', 'cm', 'mm', 'Q', 'in', 'pc'] as const;
const angleUnits = ['rad', 'deg', 'grad', 'turn'] as const;
const lengthPercentageUnits = ['%', ...lengthUnits] as const;
export type LengthUnit = (typeof lengthUnits)[number];
export type AngleUnit = (typeof angleUnits)[number];
export type LengthPercentageUnit = (typeof lengthPercentageUnits)[number];
export type TransformFunctionReturnType = string;
type Length = `${number}${LengthUnit}`;
type LengthPercentage = `${number}${LengthPercentageUnit}`;
type Angle = `${number}${AngleUnit}`;

function finiteArg(fn: string, param: string, value: unknown): asserts value is number {
  if (typeof value === 'number' && Number.isFinite(value)) return;
  const shown = JSON.stringify(value);
  throw new Error(`Argument passed to "${fn}" for param "${param}" is ${shown}${typeof value === 'number' ? ' (must be finite)' : ''}`);
}
const CSS_NUMBER = String.raw`[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?`;
function checkUnitString(value: string, units: readonly string[]): string {
  if (!units.some(unit => value.endsWith(unit))) throw new Error(`input ${value} does not end with a valid unit. Valid units are: ${units.join(', ')}`);
  // This message lists the length units even when angles or percentages were expected.
  if (!new RegExp(`^${CSS_NUMBER}(?:${units.join('|')})$`).test(value)) throw new Error(`input ${value} is not a valid transform. Must be a number or a string ending in one of the following units: ${lengthUnits.join(', ')}`);
  return value;
}
const signatures = (fn: string, lines: string[]) => new Error(`${fn}() supports only the following signatures:\n${lines.join('\n')}`);
const values = (fn: string, names: string[], args: unknown[]) => names.map((name, i) => { finiteArg(fn, name, args[i]); return args[i]; }).join(', ');

type OneValue<S, U> = {(value: S): string; (value: number, unit?: U): string};
const oneValue = <S extends string, U extends string>(fn: string, param: string, units: readonly string[], fallback: U): OneValue<S, U> =>
  ((value: unknown, unit: unknown = fallback) => {
    if (typeof value === 'string') return `${fn}(${checkUnitString(value, units)})`;
    finiteArg(fn, param, value);
    return `${fn}(${value}${unit})`;
  }) as OneValue<S, U>;

export const matrix = (a: number, b: number, c: number, d: number, tx: number, ty: number): string => `matrix(${values('matrix', ['a', 'b', 'c', 'd', 'tx', 'ty'], [a, b, c, d, tx, ty])})`;
export const matrix3d = (...args: [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number]): string =>
  `matrix3d(${values('matrix3d', ['a1', 'b1', 'c1', 'd1', 'a2', 'b2', 'c2', 'd2', 'a3', 'b3', 'c3', 'd3', 'a4', 'b4', 'c4', 'd4'], args)})`;
export const perspective = oneValue<LengthPercentage, LengthUnit>('perspective', 'length', lengthUnits, 'px');
export const rotate = oneValue<Angle, AngleUnit>('rotate', 'angle', angleUnits, 'deg');
export const rotateX = oneValue<Angle, AngleUnit>('rotateX', 'angle', angleUnits, 'deg');
export const rotateY = oneValue<Angle, AngleUnit>('rotateY', 'angle', angleUnits, 'deg');
export const rotateZ = oneValue<Angle, AngleUnit>('rotateZ', 'angle', angleUnits, 'deg');
export const skewX = oneValue<Angle, AngleUnit>('skewX', 'angle', angleUnits, 'deg');
export const skewY = oneValue<Angle, AngleUnit>('skewY', 'angle', angleUnits, 'deg');
export const translateX = oneValue<LengthPercentage, LengthPercentageUnit>('translateX', 'x', lengthPercentageUnits, 'px');
export const translateY = oneValue<LengthPercentage, LengthPercentageUnit>('translateY', 'y', lengthPercentageUnits, 'px');
export const translateZ = oneValue<Length, LengthUnit>('translateZ', 'z', lengthUnits, 'px');
export function rotate3d(x: number, y: number, z: number, angle: Angle): string;
export function rotate3d(x: number, y: number, z: number, angle: number, unit?: AngleUnit): string;
export function rotate3d(x: number, y: number, z: number, angle: number | Angle, unit: AngleUnit = 'deg'): string {
  const axis = values('rotate3d', ['x', 'y', 'z'], [x, y, z]);
  return `rotate3d(${axis}, ${rotateValue('rotate3d', angle, unit)})`;
}
const rotateValue = (fn: string, angle: unknown, unit: unknown) => {
  if (typeof angle === 'string') return checkUnitString(angle, angleUnits);
  finiteArg(fn, 'angle', angle);
  return `${angle}${unit}`;
};
export function scale(x: number, y: number = x): string { finiteArg('scale', 'x', x); return `scale(${x}, ${y})`; }
export const scale3d = (x: number, y: number, z: number): string => `scale3d(${values('scale3d', ['x', 'y', 'z'], [x, y, z])})`;
export const scaleX = (x: number): string => `scaleX(${values('scaleX', ['x'], [x])})`;
export const scaleY = (y: number): string => `scaleY(${values('scaleY', ['y'], [y])})`;
export const scaleZ = (z: number): string => `scaleZ(${values('scaleZ', ['z'], [z])})`;

const SKEW = ['skew(angle: AngleUnitString): string;', 'skew(angle: AngleUnitString, angle2: AngleUnitString): string;', 'skew(angle: number, unit: AngleUnit): string;', 'skew(angleX: number, angleY: number): string;', 'skew(angleX: number, unitX: AngleUnit, angleY: number, unitY: AngleUnit): string;'];
export function skew(angle: number | Angle): string;
export function skew(angle: Angle, angle2: Angle): string;
export function skew(angle: number, unit: AngleUnit): string;
export function skew(angleX: number, angleY: number): string;
export function skew(angleX: number, unitX: AngleUnit, angleY: number, unitY: AngleUnit): string;
export function skew(...args: unknown[]): string {
  const [a, b, c, d] = args;
  if (args.length === 1 || args.length === 2) {
    if (typeof a === 'string') {
      checkUnitString(a, angleUnits);
      if (args.length === 1) return `skew(${a}, ${a})`;
      if (typeof b === 'string') return `skew(${a}, ${checkUnitString(b, angleUnits)})`;
      throw signatures('skew', SKEW);
    }
    if (args.length === 2 && typeof a !== 'number') throw signatures('skew', SKEW);
    finiteArg('skew', 'angle', a);
    if (args.length === 1) return `skew(${a}deg, ${a}deg)`;
    if (typeof b !== 'number') return `skew(${a}${b}, ${a}${b})`;
    finiteArg('skew', 'angle', b);
    return `skew(${a}deg, ${b}deg)`;
  }
  // Follows the documented (number, unit, number, unit) signature; the 4.0.537 reference rejects it.
  if (args.length === 4 && typeof a === 'number' && typeof c === 'number') { finiteArg('skew', 'angle', a); finiteArg('skew', 'angle', c); return `skew(${a}${b}, ${c}${d})`; }
  throw signatures('skew', SKEW);
}

const TRANSLATE = ['translate(x: LengthPercentageUnitString)', 'translate(x: number)', 'translate(x: number, y: number)', 'translate(translation: number, unit: LengthPercentageUnit)', 'translate(x: number, unitX: LengthPercentageUnit, y: number, unitY: LengthPercentageUnit): string;'];
export function translate(x: LengthPercentage | number): string;
export function translate(x: number, y: number): string;
export function translate(x: LengthPercentage, y: LengthPercentage): string;
export function translate(translation: number, unit: LengthPercentageUnit): string;
export function translate(x: number, unitX: LengthPercentageUnit, y: number, unitY: LengthPercentageUnit): string;
export function translate(...args: unknown[]): string {
  const [a, b, c, d] = args;
  if (args.length === 1 || args.length === 2) {
    if (typeof a === 'string') {
      checkUnitString(a, lengthPercentageUnits);
      if (args.length === 1) return `translate(${a})`;
      if (typeof b === 'string') return `translate(${a}, ${checkUnitString(b, lengthPercentageUnits)})`;
      throw signatures('translate', TRANSLATE);
    }
    if (args.length === 2 && typeof a !== 'number') throw signatures('translate', TRANSLATE);
    finiteArg('translate', 'x', a);
    if (args.length === 1) return `translate(${a}px)`;
    if (typeof b !== 'number') return `translate(${a}${b})`;
    finiteArg('translate', 'y', b);
    return `translate(${a}px, ${b}px)`;
  }
  if (args.length === 4 && typeof a === 'number' && typeof c === 'number') { finiteArg('translate', 'x', a); finiteArg('translate', 'y', c); return `translate(${a}${b}, ${c}${d})`; }
  throw signatures('translate', TRANSLATE);
}

const TRANSLATE3D = ['translate3d(x: LengthPercentageUnitString, y: LengthPercentageUnitString, z: LengthPercentageUnitString)', 'translate3d(x: number, unitX: LengthPercentageUnit, y: number, unitY: LengthPercentageUnit, z: number, unitZ: LengthUnit)'];
export function translate3d(x: LengthPercentage | number, y: LengthPercentage | number, z: LengthPercentage | number): string;
export function translate3d(x: number, unitX: LengthPercentageUnit, y: number, unitY: LengthPercentageUnit, z: number, unitZ: LengthUnit): string;
export function translate3d(...args: unknown[]): string {
  if (args.length === 3) return `translate3d(${args.map((v, i) => { if (typeof v === 'string') return checkUnitString(v, lengthPercentageUnits); finiteArg('translate3d', 'xyz'[i]!, v); return `${v}px`; }).join(', ')})`;
  if (args.length === 6 && [0, 2, 4].every(i => typeof args[i] === 'number')) {
    [0, 2, 4].forEach((at, i) => finiteArg('translate3d', 'xyz'[i]!, args[at]));
    return `translate3d(${args[0]}${args[1]}, ${args[2]}${args[3]}, ${args[4]}${args[5]})`;
  }
  throw signatures('translate3d', TRANSLATE3D);
}

/** Joins transform function strings into one CSS `transform` value. */
export const makeTransform = (transforms: string[]): string => transforms.join(' ');

type Token = {kind: 'color'; text: string} | {kind: 'raw'; text: string} | {kind: 'number'; value: number; unit: string} | {kind: 'function'; name: string; args: Token[]};
const isColor = (text: string) => { try { interpolateColors(0, [0], [text]); return true; } catch { return false; } };
const numberToken = (text: string): Token => {
  const m = /^(-?\d+(?:\.\d+)?)([a-zA-Z%]*)$/.exec(text);
  return m ? {kind: 'number', value: Number(m[1]), unit: m[2]!} : {kind: 'raw', text};
};
// One un-nested function call or one whitespace-free run; colours win over functions so `rgba(0, 0, 0, 0.5)` stays one colour.
const tokenize = (value: string): Token[] => (value.match(/[\w-]+\([^()]*\)|\S+/g) ?? []).map(text => {
  if (isColor(text)) return {kind: 'color', text};
  const call = /^([\w-]+)\(([^()]*)\)$/.exec(text);
  return call ? {kind: 'function', name: call[1]!, args: call[2]!.split(',').map(arg => arg.trim()).filter((arg, i, all) => arg !== '' || i < all.length - 1).map(numberToken)} : numberToken(text);
});

function interpolateValue(input: number, range: [number, number], start: unknown, end: unknown, options: InterpolateOptions): unknown {
  const fail = (what: string) => new Error(`${what} Start value: ${String(start)}, end value: ${String(end)}`);
  if (end === undefined || end === null) return start;
  if (typeof start !== typeof end && start !== 0 && end !== 0) throw fail('The start and end values must be of the same type.');
  if (typeof start === 'number' && typeof end === 'number') return interpolate(input, range, [start, end], options);
  const parse = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? tokenize(String(value)) : [];
  const from = parse(start), to = parse(end);
  if (from.length !== to.length) throw fail('The start and end values must have the same structure.');
  const pair = (a: Token, b: Token | undefined): string => {
    if (a.kind === 'raw') { if (b?.kind === 'raw' && b.text === a.text) return a.text; throw fail('Non-animatable values cannot be interpolated.'); }
    if (a.kind === 'color') { if (b?.kind !== 'color') throw fail('The start and end values must be of the same type.'); return interpolateColors(input, range, [a.text, b.text], {easing: options.easing, posterize: options.posterize}); }
    if (a.kind === 'function') {
      if (b?.kind !== 'function' || b.name !== a.name) throw fail('The start and end values must be of the same type.');
      return `${a.name}(${a.args.map((arg, i) => pair(arg, b.args[i])).join(', ')})`;
    }
    if (b === undefined) throw fail('The start and end values must be of the same type.');
    const endValue = b.kind === 'number' ? b.value : undefined, endUnit = b.kind === 'number' ? b.unit : b.kind === 'raw' ? b.text : undefined;
    // A zero on either side may borrow the other side's unit.
    if (a.unit !== endUnit && a.value !== 0 && endValue !== 0) throw fail('The units of the start and end values must match.');
    return `${interpolate(input, range, [a.value, endValue ?? 0], options)}${a.unit || endUnit || ''}`;
  };
  const text = from.map((token, i) => pair(token, to[i])).join(' ');
  return Number.isNaN(Number(text)) ? text : Number(text);
}

/** Interpolates every property of the style keyframe at or before `input` towards the next keyframe; numbers, units, colours and transform functions animate, equal keywords pass through. */
export function interpolateStyles(input: number, inputRange: number[], outputStylesRange: React.CSSProperties[], options: Pick<InterpolateOptions, 'easing' | 'extrapolateLeft' | 'extrapolateRight' | 'posterize'> = {}): React.CSSProperties {
  if (inputRange.length !== outputStylesRange.length) throw new Error(`inputRange (${inputRange.length}) and outputStylesRange (${outputStylesRange.length}) must have the same length`);
  if (inputRange.length < 2) throw new Error('inputRange must have at least 2 elements');
  if (inputRange.some((v, i) => !(i === 0 || v > inputRange[i - 1]!))) throw new Error(`inputRange must be strictly monotonically non-decreasing but got [${inputRange.join(',')}]`);
  const {posterize, easing: allEasing} = options;
  if (posterize !== undefined && !(typeof posterize === 'number' && Number.isFinite(posterize) && posterize > 0)) throw new Error(`posterize must be a positive finite number, but got ${String(posterize)}`);
  if (allEasing !== undefined && typeof allEasing !== 'function') {
    const list = allEasing as readonly unknown[];
    if (list.length !== inputRange.length - 1) throw new Error(`When easing is an array, it must have one entry per segment between keyframes (length inputRange.length - 1 = ${inputRange.length - 1}), but got length ${list.length}`);
    list.forEach((entry, i) => { if (typeof entry !== 'function') throw new Error(`easing[${i}] must be a function`); });
  }
  let segment = 0;
  while (segment < inputRange.length - 2 && input >= inputRange[segment + 1]!) segment++;
  const start = outputStylesRange[segment]! as Record<string, unknown>, end = outputStylesRange[segment + 1]! as Record<string, unknown>;
  const easing = typeof allEasing === 'object' ? allEasing[segment] : allEasing;
  const range: [number, number] = [inputRange[segment]!, inputRange[segment + 1]!];
  return Object.fromEntries(Object.keys(start).map(key => [key, interpolateValue(input, range, start[key], end[key], {...options, easing})]));
}
