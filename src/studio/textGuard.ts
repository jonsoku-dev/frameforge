export type ClippedText = {text: string; side: 'top' | 'bottom' | 'left' | 'right'; px: number; element: Element};

let ctx: CanvasRenderingContext2D | null = null;

type Clipper = {element: Element; moving: HTMLElement[]};

function clipperOf(parent: Element, root: Element): Clipper | null {
  const moving: HTMLElement[] = [];
  for (let node: Element | null = parent; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    const clips = node === root || style.clipPath !== 'none' || [style.overflow, style.overflowX, style.overflowY].some(value => value !== 'visible');
    if (!clips) {
      // A transform between text and its mask is a reveal in motion; the check is made with those transforms removed.
      if (style.transform !== 'none' && node instanceof HTMLElement) moving.push(node);
      continue;
    }
    const allow = parent.closest('[data-clip="allow"]');
    return allow && node.contains(allow) ? null : {element: node, moving};
  }
  return null;
}

export function findClippedText(root: Element): ClippedText[] {
  ctx ??= document.createElement('canvas').getContext('2d');
  if (!ctx) return [];
  const found: ClippedText[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    const content = node.textContent ?? '';
    if (!parent || !content.trim()) continue;
    const clipper = clipperOf(parent, root);
    if (!clipper) continue;
    const style = getComputedStyle(parent);
    ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const ink = ctx.measureText(content);
    const contentArea = ink.fontBoundingBoxAscent + ink.fontBoundingBoxDescent;
    const range = document.createRange();
    range.selectNodeContents(node);
    if (!contentArea) continue;
    // Measure at rest: clear the in-between transforms, read rects, restore before the next paint.
    const saved = clipper.moving.map(element => [element, element.style.transform] as const);
    for (const [element] of saved) element.style.transform = 'none';
    const lines = [...range.getClientRects()].filter(line => line.width > 0 && line.height > 0);
    const clip = clipper.element.getBoundingClientRect();
    const text = content.trim().slice(0, 24);
    const over: Record<ClippedText['side'], number> = {top: 0, bottom: 0, left: 0, right: 0};
    for (const [element, transform] of saved) element.style.transform = transform;
    if (!lines.length) continue;
    lines.forEach((line, index) => {
      // Range rects span the font's content area whatever the line-height, and scale with CSS transforms above the clipper.
      const r = line.height / contentArea;
      const baseline = line.top + ink.fontBoundingBoxAscent * r;
      const left = index === 0 ? line.left - Math.max(0, ink.actualBoundingBoxLeft) * r : line.left;
      const right = index === lines.length - 1 ? line.right + Math.max(0, ink.actualBoundingBoxRight - ink.width) * r : line.right;
      over.top = Math.max(over.top, clip.top - (baseline - ink.actualBoundingBoxAscent * r));
      over.bottom = Math.max(over.bottom, baseline + ink.actualBoundingBoxDescent * r - clip.bottom);
      over.left = Math.max(over.left, clip.left - left);
      over.right = Math.max(over.right, right - clip.right);
    });
    for (const side of ['top', 'bottom', 'left', 'right'] as const) if (over[side] > 0.5) found.push({text, side, px: Math.round(over[side] * 10) / 10, element: parent});
  }
  return found;
}
