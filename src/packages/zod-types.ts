import {interpolateColors} from '../core/math';

// Studio editors key off these schema descriptions.
export const FRAMEFORGE_COLOR_BRAND = '__frameforge-color';
export const FRAMEFORGE_TEXTAREA_BRAND = '__frameforge-textarea';
export const FRAMEFORGE_MATRIX_BRAND = '__frameforge-matrix';

/** Bytes of a CSS color in any syntax `interpolateColors` accepts; throws `invalid color string X provided` otherwise. */
export function parseColor(value: string): {a: number; r: number; g: number; b: number} {
  let rgba: string;
  try { rgba = interpolateColors(0, [0], [value]); } catch { throw new Error(`invalid color string ${value} provided`); }
  const [r = 0, g = 0, b = 0, alpha = 0] = rgba.slice(5, -1).split(', ').map(Number);
  return {a: Math.round(alpha * 255), r, g, b};
}

/**
 * The `z` from your own zod install: zod is not a Frameforge dependency, so the schema factories take it as an argument,
 * e.g. `zColor(z)` where the reference API is `zColor()`.
 */
export type ZodLike = {string: () => any; number: () => any; array: (item: any) => any};

const isColor = (value: string) => { try { parseColor(value); return true; } catch { return false; } };
const isSquare = (values: number[]) => values.length > 0 && Number.isInteger(Math.sqrt(values.length));

/** A string that must be a color; the studio shows a color picker. */
export const zColor = <Z extends ZodLike>(z: Z): ReturnType<Z['string']> => z.string().refine(isColor, {message: 'Invalid color'}).describe(FRAMEFORGE_COLOR_BRAND);
/** A string edited as a multi-line text area. */
export const zTextarea = <Z extends ZodLike>(z: Z): ReturnType<Z['string']> => z.string().describe(FRAMEFORGE_TEXTAREA_BRAND);
/** A flat square matrix of numbers (4, 9, 16, ... entries). */
export const zMatrix = <Z extends ZodLike>(z: Z): ReturnType<Z['array']> => z.array(z.number()).refine(isSquare, {message: 'Invalid matrix, must be a square matrix'}).describe(FRAMEFORGE_MATRIX_BRAND);

export const zodTypesInternals = {parseColor, FRAMEFORGE_COLOR_BRAND, FRAMEFORGE_TEXTAREA_BRAND, FRAMEFORGE_MATRIX_BRAND};
