export type GoogleFontDisplay = 'auto' | 'block' | 'swap' | 'fallback' | 'optional';
export type GoogleFontOptions = {
  weights?: number[];
  italic?: boolean;
  display?: GoogleFontDisplay;
  fallback?: string;
};

const FAMILY = /^[\p{L}\p{N}][\p{L}\p{N} ]{0,80}$/u;
const DISPLAYS = new Set<GoogleFontDisplay>(['auto', 'block', 'swap', 'fallback', 'optional']);
const pending = new Map<string, Promise<void>>();

/** Builds a Google Fonts CSS2 URL for any published family. Weights are sorted. Italic tuples list roman first. */
export function googleFontHref(family: string, options: GoogleFontOptions = {}): string {
  const name = family.trim();
  if (!FAMILY.test(name)) throw new Error('googleFont family must be a Google Fonts family name');
  const display = options.display ?? 'swap';
  if (!DISPLAYS.has(display)) throw new Error('googleFont display is invalid');
  const weights = [...new Set(options.weights ?? [400])].sort((a, b) => a - b);
  for (const weight of weights) {
    if (!Number.isInteger(weight) || weight < 1 || weight > 1000) throw new Error('googleFont weight must be an integer from 1 to 1000');
  }
  const axis = options.italic ? 'ital,wght' : 'wght';
  const tuples = options.italic
    ? [...weights.map(weight => `0,${weight}`), ...weights.map(weight => `1,${weight}`)].join(';')
    : weights.join(';');
  return `https://fonts.googleapis.com/css2?family=${name.replaceAll(' ', '+')}:${axis}@${tuples}&display=${display}`;
}

function ensureStylesheet(href: string, family: string, weights: number[]): void {
  if (typeof document === 'undefined' || pending.has(href)) return;
  const loading = new Promise<void>(resolve => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    const finish = () => {
      const sample = 'Ag가';
      Promise.all(weights.map(weight => document.fonts.load(`${weight} 16px "${family}"`, sample).then(() => undefined, () => undefined))).then(() => resolve());
    };
    link.onload = finish;
    link.onerror = () => resolve();
    document.head.appendChild(link);
  });
  pending.set(href, loading);
}

/** Loads one Google Font family on demand and returns a CSS font-family stack. */
export function googleFont(family: string, options: GoogleFontOptions = {}): string {
  const href = googleFontHref(family, options);
  const name = family.trim();
  ensureStylesheet(href, name, [...new Set(options.weights ?? [400])]);
  const fallback = options.fallback ?? 'sans-serif';
  return `"${name}", ${fallback}`;
}

/** Resolves after requested stylesheets and document.fonts have settled. Missing families fall back instead of hanging. */
export function whenGoogleFontsSettled(): Promise<void> {
  const links = Promise.all([...pending.values()]);
  if (typeof document === 'undefined') return links.then(() => undefined);
  return links.then(() => document.fonts.ready).then(() => undefined);
}
