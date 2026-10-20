type Unpreload = () => void;
const noop: Unpreload = () => {};

function preloadLink(src: string, as: 'image' | 'font' | 'audio' | 'video'): Unpreload {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = as;
  link.href = src;
  if (as === 'font') link.crossOrigin = 'anonymous';
  document.head.appendChild(link);
  return () => link.remove();
}

// Firefox honours `<link rel=preload>` for media; other browsers only buffer a mounted media element.
function preloadMedia(src: string, tag: 'audio' | 'video'): Unpreload {
  if (typeof document === 'undefined') return noop;
  if (/Firefox\//.test(navigator.userAgent)) return preloadLink(src, tag);
  const media = document.createElement(tag);
  media.preload = 'auto';
  media.controls = true;
  media.style.display = 'none';
  media.src = src;
  document.body.appendChild(media);
  return () => media.remove();
}

/** Starts buffering audio so a later `<audio>` with this src plays at once. Returns a function that undoes it. No-op outside a browser. */
export const preloadAudio = (src: string): Unpreload => preloadMedia(src, 'audio');
/** Starts buffering a video. Returns a function that undoes it. No-op outside a browser. */
export const preloadVideo = (src: string): Unpreload => preloadMedia(src, 'video');
/** Adds `<link rel="preload" as="image">`. Returns a function that removes it. No-op outside a browser. */
export const preloadImage = (src: string): Unpreload => typeof document === 'undefined' ? noop : preloadLink(src, 'image');
/** Adds `<link rel="preload" as="font" crossorigin>`. Returns a function that removes it. No-op outside a browser. */
export const preloadFont = (src: string): Unpreload => typeof document === 'undefined' ? noop : preloadLink(src, 'font');

/** Follows redirects and resolves to the final URL. Rejects when the server does not allow CORS. */
export async function resolveRedirect(src: string): Promise<string> {
  const controller = new AbortController();
  const response = await fetch(src, {signal: controller.signal});
  controller.abort(); // only the final URL is needed, not the body
  return response.url || src;
}
