export type Rgba = [number, number, number, number];
export type Rect = {x: number; y: number; width: number; height: number};
export type LayoutFault = {code: 'text_outside_safe' | 'text_overlap' | 'contrast_low' | 'text_too_small' | 'element_cropped' | 'subject_overlaps_text'; message: string; fix: string; rect: Rect; text: string};

const round = (value: number) => Math.round(value * 10) / 10;
const rectOf = (r: {left: number; top: number; width: number; height: number}): Rect => ({x: round(r.left), y: round(r.top), width: round(r.width), height: round(r.height)});

/** `#rgb`, `#rrggbb[aa]`, `rgb()`/`rgba()` (comma or space syntax), `transparent`, `black`, `white` to [r, g, b, a]; null for anything else (an unknown colour is skipped, not guessed). */
export function parseCssColor(value: string): Rgba | null {
  const text = value.trim().toLowerCase();
  if (text === 'transparent') return [0, 0, 0, 0];
  if (text === 'black') return [0, 0, 0, 1];
  if (text === 'white') return [255, 255, 255, 1];
  const hex = /^#([0-9a-f]{3,8})$/.exec(text)?.[1];
  if (hex && [3, 4, 6, 8].includes(hex.length)) {
    const digits = hex.length <= 4 ? [...hex].map(d => d + d).join('') : hex;
    const parts = digits.match(/../g)!.map(part => parseInt(part, 16));
    return [parts[0]!, parts[1]!, parts[2]!, parts.length === 4 ? parts[3]! / 255 : 1];
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(text);
  if (!rgb) return null;
  const alpha = rgb[4] === undefined ? 1 : rgb[4].endsWith('%') ? Number(rgb[4].slice(0, -1)) / 100 : Number(rgb[4]);
  return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), alpha];
}

const luminance = ([r, g, b]: Rgba) => {
  const channel = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

/** WCAG 2 contrast ratio (1..21) of two opaque colours. */
export function contrastRatio(a: Rgba, b: Rgba): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

/** `fg` composited over an opaque `bg` by its alpha. */
export const over = (fg: Rgba, bg: Rgba): Rgba => [0, 1, 2].map(i => Math.round(fg[i]! * fg[3] + bg[i]! * (1 - fg[3]))).concat(1) as Rgba;

/** The opaque colour behind `element`: the nearest ancestor's background-color, `rootColor` past the root, or null when a background-image,
 * gradient or translucent colour makes it unknowable. */
export function effectiveBackground(element: Element, rootColor: Rgba | null, root: Element = document.documentElement): Rgba | null {
  const chain: Element[] = [];
  for (let node: Element | null = element; node; node = node === root ? null : node.parentElement) chain.push(node);
  return firstOpaque(chain, rootColor);
}

/** The first element in paint order (nearest first) with a known opaque background; null when one has an image, gradient or translucent colour. */
function firstOpaque(stack: Element[], rootColor: Rgba | null): Rgba | null {
  for (const node of stack) {
    const style = getComputedStyle(node);
    if (style.backgroundImage !== 'none') return null;
    const color = parseCssColor(style.backgroundColor);
    if (!color) return null;
    if (color[3] >= 1) return color;
    if (color[3] > 0) return null;
  }
  return rootColor;
}

/** What is painted under the middle of `rect`: a sibling layer (a wipe, a card) counts, not only ancestors; falls back to the ancestor walk when
 * the point is off the viewport or the element is not under it (covered by a transformed sibling). */
export function paintedBackground(element: Element, rect: Rect, rootColor: Rgba | null, root: Element = document.documentElement): Rgba | null {
  const stack = document.elementsFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
  const at = stack.indexOf(element);
  // The element itself comes first: text sits on its own background when the same node carries colour and background-color.
  return at < 0 ? effectiveBackground(element, rootColor, root) : firstOpaque(stack.slice(at).filter(node => (root.contains(node) || node === root) && painted(node, root)), rootColor);
}

/** Whether `node` paints at all: a layer faded to opacity 0 (an exited state) or hidden still hit-tests, but shows nothing behind the text. */
function painted(node: Element, root: Element): boolean {
  let opacity = 1;
  for (let up: Element | null = node; up && up !== root.parentElement; up = up.parentElement) {
    const style = getComputedStyle(up);
    if (style.visibility === 'hidden') return false;
    opacity *= Number(style.opacity);
  }
  return opacity > 0.05;
}

/** Whether an opaque layer that is not an ancestor of `element` paints over it at (x, y), such as a card flying in front of a card behind it
 * in 3D. Only positive evidence counts: an element that hit-testing skips (pointer-events: none) is never called covered, and the frozen
 * plus-lighter copies of a motion blur never cover anything. */
function coveredAt(element: Element, x: number, y: number, root: Element): boolean {
  const stack = document.elementsFromPoint(x, y);
  const at = stack.indexOf(element);
  if (at < 0) return false;
  return stack.slice(0, at).some(node => {
    if (node.contains(element) || !root.contains(node)) return false;
    let opacity = 1;
    for (let up: Element | null = node; up && up !== root.parentElement; up = up.parentElement) {
      const style = getComputedStyle(up);
      if (style.visibility === 'hidden' || blurCopy(up)) return false;
      opacity *= Number(style.opacity);
    }
    if (opacity < 0.99) return false;
    const style = getComputedStyle(node), color = parseCssColor(style.backgroundColor);
    return style.backgroundImage === 'none' && color !== null && color[3] >= 1;
  });
}

export const rectsOverlap = (a: Rect, b: Rect): number => Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));

/** Share of `rect`'s own area that lies outside the viewport (0 when inside, 1 when fully off screen). */
export function outsideShare(rect: Rect, viewport: {width: number; height: number}): number {
  const area = rect.width * rect.height;
  return area > 0 ? 1 - rectsOverlap(rect, {x: 0, y: 0, ...viewport}) / area : 0;
}

/** Share of `text`'s area that `cover` lies over. */
export const coveredShare = (cover: Rect, text: Rect): number => text.width * text.height > 0 ? rectsOverlap(cover, text) / (text.width * text.height) : 0;

export function insideSafeArea(rect: Rect, viewport: {width: number; height: number}, marginRatio: number): boolean {
  const mx = viewport.width * marginRatio, my = viewport.height * marginRatio;
  return rect.x >= mx && rect.y >= my && rect.x + rect.width <= viewport.width - mx && rect.y + rect.height <= viewport.height - my;
}

const SAFE = 0.05, OVERLAP = 0.2, LABEL = 0.035, BIG_TEXT = 38, CROPPED = 0.02, COVERED = 0.2;

/** <CameraMotionBlur> stacks frozen copies with plus-lighter; every layer but the top one is a copy. */
const blurCopy = (node: Element) => getComputedStyle(node).mixBlendMode === 'plus-lighter' && node.nextElementSibling !== null && getComputedStyle(node.nextElementSibling).mixBlendMode === 'plus-lighter';

type TextBox = {element: HTMLElement; text: string; rect: Rect; fontSize: number};

/** Leaf elements with visible text (opacity above 0.05 along the chain, visibility visible, some part inside the viewport), one box per element. */
function textBoxes(root: Element, viewport: {width: number; height: number}): TextBox[] {
  const boxes = new Map<HTMLElement, TextBox>();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    const text = (node.textContent ?? '').trim();
    if (!(parent instanceof HTMLElement) || !text) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const r = range.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0) || r.right <= 0 || r.bottom <= 0 || r.left >= viewport.width || r.top >= viewport.height) continue;
    let opacity = 1, hidden = false, copy = false;
    for (let up: Element | null = parent; up && up !== root.parentElement; up = up.parentElement) {
      const style = getComputedStyle(up);
      opacity *= Number(style.opacity);
      hidden ||= style.visibility === 'hidden';
      // <CameraMotionBlur> stacks frozen copies with plus-lighter; only the top copy is the text a viewer reads.
      copy ||= blurCopy(up);
    }
    if (hidden || copy || opacity <= 0.05) continue;
    const box = boxes.get(parent);
    // Size on screen: a camera scale between the text and the root makes 30px world text read as 39px.
    const scale = parent.offsetHeight > 0 ? parent.getBoundingClientRect().height / parent.offsetHeight : 1;
    if (!box) boxes.set(parent, {element: parent, text: text.slice(0, 24), rect: rectOf(r), fontSize: parseFloat(getComputedStyle(parent).fontSize) * scale});
    else {
      const x = Math.min(box.rect.x, r.left), y = Math.min(box.rect.y, r.top);
      box.rect = {x: round(x), y: round(y), width: round(Math.max(box.rect.x + box.rect.width, r.right) - x), height: round(Math.max(box.rect.y + box.rect.height, r.bottom) - y)};
    }
  }
  return [...boxes.values()];
}

/** Layout faults of the text in `root` at the current frame. `rootColor` is what shows behind the composition (null when transparent). */
export function findLayoutFaults(root: Element, {width, height, rootColor = parseCssColor(getComputedStyle(document.documentElement).backgroundColor)}: {width: number; height: number; rootColor?: Rgba | null}): LayoutFault[] {
  const faults: LayoutFault[] = [];
  if (rootColor && rootColor[3] < 1) rootColor = null;  // a transparent render has nothing known behind the composition
  const boxes = textBoxes(root, {width, height});
  const minLabel = Math.min(width, height) * LABEL;
  for (const {element, text, rect, fontSize} of boxes) {
    if (!insideSafeArea(rect, {width, height}, SAFE) && !element.closest('[data-clip="allow"]')) faults.push({code: 'text_outside_safe', text, rect, message: `"${text}" leaves the ${SAFE * 100}% safe area`, fix: 'Move the text inside the safe area, or mark a band that overflows on purpose with data-clip="allow".'});
    if (fontSize < minLabel && !element.closest('[data-size="allow"]')) faults.push({code: 'text_too_small', text, rect, message: `"${text}" is ${round(fontSize)}px, under ${Math.ceil(minLabel)}px (3.5% of the short side)`, fix: 'Raise the font size to the label minimum, or allow a small legal line with data-size="allow".'});
    const color = parseCssColor(getComputedStyle(element).color);
    const background = color && paintedBackground(element, rect, rootColor, root);
    if (color && background) {
      const ratio = contrastRatio(over(color, background), background), needed = fontSize >= BIG_TEXT ? 3 : 4.5;
      if (ratio < needed) faults.push({code: 'contrast_low', text, rect, message: `"${text}" has contrast ${round(ratio)}:1, under ${needed}:1`, fix: 'Darken or lighten the text or its background so the ratio clears the threshold.'});
    }
  }
  // Subjects (the hero, the object a process happens to) are marked data-subject; a subject entering from off frame on purpose takes data-clip="allow".
  for (const subject of root.querySelectorAll('[data-subject]')) {
    let shown = painted(subject, root);
    for (let up: Element | null = subject; shown && up && up !== root.parentElement; up = up.parentElement) shown = !blurCopy(up);
    if (!shown) continue;
    const rect = rectOf(subject.getBoundingClientRect()), name = subject.getAttribute('data-subject') || subject.tagName.toLowerCase();
    const out = outsideShare(rect, {width, height});
    if (out > CROPPED && out < 1 && !subject.closest('[data-clip="allow"]')) faults.push({code: 'element_cropped', text: name, rect, message: `subject "${name}" has ${Math.round(out * 100)}% of its box outside the frame`, fix: 'Reframe or shrink the subject so it stays whole in frame, or mark an entry from off frame with data-clip="allow".'});
    for (const box of boxes) {
      if (subject.contains(box.element)) continue;  // a label on the object (an oz mark on the glass) belongs to it
      const covered = coveredShare(rect, box.rect);
      if (covered > COVERED) faults.push({code: 'subject_overlaps_text', text: `${name} / ${box.text}`, rect, message: `subject "${name}" covers ${Math.round(covered * 100)}% of "${box.text}"`, fix: 'Move the text or the subject apart; put a label that belongs to the object inside its data-subject element.'});
    }
  }
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i]!, b = boxes[j]!;
    const shared = rectsOverlap(a.rect, b.rect), smaller = Math.min(a.rect.width * a.rect.height, b.rect.width * b.rect.height);
    if (!(smaller > 0 && shared / smaller > OVERLAP)) continue;
    const x = (Math.max(a.rect.x, b.rect.x) + Math.min(a.rect.x + a.rect.width, b.rect.x + b.rect.width)) / 2, y = (Math.max(a.rect.y, b.rect.y) + Math.min(a.rect.y + a.rect.height, b.rect.y + b.rect.height)) / 2;
    if (coveredAt(a.element, x, y, root) || coveredAt(b.element, x, y, root)) continue;  // one text is behind an opaque layer the other sits on
    faults.push({code: 'text_overlap', text: `${a.text} / ${b.text}`, rect: a.rect, message: `"${a.text}" and "${b.text}" overlap by ${Math.round(shared / smaller * 100)}% of the smaller`, fix: 'Separate the two texts in time or space; stacked words read as a mistake.'});
  }
  return faults;
}
