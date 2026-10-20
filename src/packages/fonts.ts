import {continueRender, delayRender} from '../core/index';

export type FontFormat = 'woff2' | 'woff' | 'opentype' | 'truetype';
export type LoadFontOptions = {
  family: string; url: string; format?: FontFormat;
  ascentOverride?: string; descentOverride?: string; lineGapOverride?: string; display?: 'auto' | 'block' | 'fallback' | 'optional' | 'swap';
  featureSettings?: string; stretch?: string; style?: string; unicodeRange?: string; variant?: string; weight?: string;
};

const FORMATS: Record<string, FontFormat> = {woff2: 'woff2', woff: 'woff', otf: 'opentype', ttf: 'truetype'};
/** The format implied by the URL's file extension; throws when the extension is unknown. */
function getFontFormat(url: string): FontFormat {
  const extension = url.split('.').pop() ?? '';
  const format = FORMATS[extension.toLowerCase()];
  if (!format) throw new Error(`Could not automatically derive font format from extension: ${extension}. Pass the "format" parameter explicitly.`);
  return format;
}

const files = new Map<string, Promise<ArrayBuffer>>();
/** Loads a font file (usually `staticFile('x.ttf')`) under `family` and holds rendering until it is ready. Browser only. */
export async function loadFont({family, url, format, ...descriptors}: LoadFontOptions): Promise<void> {
  if (!format) getFontFormat(url);
  if (typeof FontFace === 'undefined' || typeof document === 'undefined') throw new Error('loadFont needs a browser with the FontFace API');
  const handle = delayRender(`Loading font ${family} from ${url}`);
  try {
    let file = files.get(url);
    if (!file) {
      file = fetch(url).then(response => {
        if (!response.ok) throw new Error(`loadFont: ${url} failed with HTTP ${response.status}`);
        return response.arrayBuffer();
      });
      files.set(url, file);
      file.catch(() => files.delete(url));
    }
    const face = new FontFace(family, await file, Object.fromEntries(Object.entries(descriptors).filter(([, value]) => value !== undefined)));
    document.fonts.add(await face.load());
  } finally {
    continueRender(handle);
  }
}
