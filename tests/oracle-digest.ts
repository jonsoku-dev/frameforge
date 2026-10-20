import {createHash} from 'node:crypto';

/** Oracle files keep no rendered markup of the reference package, only a digest: the SHA-256 of the markup with every
 * number replaced by `#` (its structure), and the numbers themselves. Two renders match when the structures hash the
 * same and every number is within the tolerance. */
const NUMBER = /-?\d*\.?\d+(?:e[-+]?\d+)?/gi;
export type MarkupDigest = {structure: string; numbers: number[]};

export function digestMarkup(markup: string): MarkupDigest {
  return {structure: createHash('sha256').update(markup.replace(NUMBER, '#')).digest('hex'), numbers: (markup.match(NUMBER) ?? []).map(Number)};
}

/** null when equal, else a one-line reason. */
export function compareDigest(markup: string, expected: MarkupDigest, tolerance = 1e-6): string | null {
  const mine = digestMarkup(markup);
  if (mine.structure !== expected.structure) return `structure differs: ${markup.slice(0, 300)}`;
  if (mine.numbers.length !== expected.numbers.length) return `number count ${mine.numbers.length} vs ${expected.numbers.length}`;
  const bad = mine.numbers.findIndex((value, i) => Math.abs(value - expected.numbers[i]!) > tolerance);
  return bad < 0 ? null : `number ${bad} is ${mine.numbers[bad]}, expected ${expected.numbers[bad]}`;
}
