export type TextDimensions = {width: number; height: number};
export type TextTransform = 'inherit' | 'initial' | 'revert' | 'revert-layer' | 'unset' | 'none' | 'capitalize' | 'full-size-kana' | 'full-width' | 'lowercase' | 'uppercase';
/** One run of text and the CSS that shapes it. `additionalStyles` holds any other layout-affecting CSS (camelCase keys). */
export type TextWord = {
  text: string; fontFamily: string; fontSize: number | string; fontWeight?: number | string; letterSpacing?: string;
  fontVariantNumeric?: string; textTransform?: TextTransform; validateFontIsLoaded?: boolean; additionalStyles?: Record<string, string | number>;
};
/** Measures one word; inject one to measure outside a browser. */
export type TextMeasurer = (word: TextWord) => TextDimensions;

// The browser measurer lays the word out in a hidden span, so every CSS property counts as it will on the page.
const domMeasurer: TextMeasurer = word => {
  if (typeof document === 'undefined') throw new Error('measureText needs a browser document; pass a measurer as the second argument elsewhere');
  const span = document.createElement('span');
  Object.assign(span.style, {
    ...(word.fontFamily ? {fontFamily: word.fontFamily} : {}), display: 'inline-block', position: 'absolute', top: '-10000px', whiteSpace: 'pre',
    fontSize: typeof word.fontSize === 'number' ? `${word.fontSize}px` : word.fontSize, ...word.additionalStyles,
    ...(word.fontWeight !== undefined ? {fontWeight: String(word.fontWeight)} : {}), ...(word.letterSpacing ? {letterSpacing: word.letterSpacing} : {}),
    ...(word.fontVariantNumeric ? {fontVariantNumeric: word.fontVariantNumeric} : {}), ...(word.textTransform ? {textTransform: word.textTransform} : {}),
  });
  span.textContent = word.text;
  document.body.appendChild(span);
  const box = span.getBoundingClientRect();
  span.remove();
  return {width: box.width, height: box.height};
};

const cache = new Map<string, TextDimensions>();
/** Width and height of `text` as laid out with the given CSS. Cached per input. Browser only unless `measurer` is passed. */
export function measureText(word: TextWord, measurer: TextMeasurer = domMeasurer): TextDimensions {
  const key = JSON.stringify([word.text, word.fontFamily, word.fontSize, word.fontWeight, word.letterSpacing, word.fontVariantNumeric, word.textTransform, word.validateFontIsLoaded, word.additionalStyles]);
  const hit = measurer === domMeasurer ? cache.get(key) : undefined;
  if (hit) return hit;
  const size = measurer(word);
  if (word.validateFontIsLoaded) {
    const fallback = measurer({...word, fontFamily: ''});
    if (fallback.width === size.width && fallback.height === size.height) throw new Error(`measureText: "${word.text}" measures the same with and without font "${word.fontFamily}", so the font is probably not loaded yet`);
  }
  if (measurer === domMeasurer) cache.set(key, size);
  return size;
}

type FitStyle = Omit<TextWord, 'text' | 'fontSize'>;
/** The font size at which `text` is exactly `withinWidth` wide: measured once at 100px and scaled. */
export function fitText({text, withinWidth, ...style}: FitStyle & {text: string; withinWidth: number}, measurer?: TextMeasurer): {fontSize: number} {
  return {fontSize: withinWidth / measureText({...style, text, fontSize: 100}, measurer).width * 100};
}

/** A box of `maxLines` lines `maxBoxWidth` wide that words are added to one by one (a word should carry its leading space). */
export function fillTextBox({maxBoxWidth, maxLines}: {maxBoxWidth: number; maxLines: number}, measurer?: TextMeasurer): {add: (word: TextWord) => {exceedsBox: boolean; newLine: boolean}} {
  // Line widths count each line's first word without its leading space; the first line starts empty.
  const lines = [0];
  let empty = true;
  const trimmedWidth = (word: TextWord) => measureText({...word, text: word.text.trimStart()}, measurer).width;
  return {add(word) {
    const {width} = measureText(word, measurer);
    const last = lines.length - 1;
    if (lines[last]! + width <= maxBoxWidth) { lines[last]! += empty ? trimmedWidth(word) : width; empty = false; return {exceedsBox: false, newLine: false}; }
    if (lines.length >= maxLines) return {exceedsBox: true, newLine: false};
    const start = trimmedWidth(word);
    if (start > maxBoxWidth) return {exceedsBox: true, newLine: false};
    lines.push(start);
    empty = false;
    return {exceedsBox: false, newLine: true};
  }};
}

/** The largest font size up to `maxFontSize` (default 2000) at which `text` wraps into at most `maxLines` lines of `maxBoxWidth`. */
export function fitTextOnNLines({text, maxLines, maxBoxWidth, maxFontSize = 2000, ...style}: FitStyle & {text: string; maxLines: number; maxBoxWidth: number; maxFontSize?: number}, measurer?: TextMeasurer): {fontSize: number; lines: string[]} {
  const words = text.split(' ').map((word, i) => i === 0 ? word : ' ' + word);
  const layout = (fontSize: number): string[] | null => {
    const lines: {text: string; width: number}[] = [];
    for (const word of words) {
      const width = measureText({...style, text: word, fontSize}, measurer).width;
      const last = lines[lines.length - 1];
      if (last && last.width + width <= maxBoxWidth) { last.text += word; last.width += width; continue; }
      const start = last ? word.trimStart() : word;
      const startWidth = last ? measureText({...style, text: start, fontSize}, measurer).width : width;
      if (startWidth > maxBoxWidth || lines.length >= maxLines) return null;
      lines.push({text: start, width: startWidth});
    }
    return lines.map(line => line.text.trimEnd());
  };
  let low = 0.1, high = maxFontSize, best = layout(low) ?? [];
  const round = (value: number) => Math.round(value * 100) / 100;
  for (let mid = round((low + high) / 2); mid !== low && mid !== high; mid = round((low + high) / 2)) {
    const lines = layout(mid);
    if (lines) { low = mid; best = lines; } else high = mid;
  }
  const top = layout(high);
  return top ? {fontSize: high, lines: top} : {fontSize: low, lines: best};
}
