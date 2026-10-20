import React, {createElement, forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState} from 'react';
import {cancelRender, continueRender, delayRender, getFrameforgeEnvironment, Img, registerAudioClip, Sequence, useCurrentFrame, useTimelinePosition, useVideoConfig, type SequenceProps} from './index';
import {cropClipPath, fitRect, paintCanvas, runEffectChain, validateCanvasSize, type CropProps, type EffectsProp, type ImageFit} from './effects';
import {finite, integer, positive} from './math';

/** `<Video>` and `<AnimatedImage>` take a `public/` path or an https URL; the dev server downloads https files once into `.cache/remote/`. */
export const isRemoteSrc = (src: string): boolean => /^https:\/\/[^/]/i.test(src);
export function validateMediaSrc(src: unknown, component: string): string {
  if (typeof src === 'string' && ((src.startsWith('/') && !src.startsWith('//')) || isRemoteSrc(src))) return src;
  throw new Error(`${component} src must be a public path starting with "/" or an https:// URL, got ${JSON.stringify(src)}`);
}
/** The dev-server route that serves a remote file from its download cache, so a fetch needs no CORS from the remote host. */
export const remoteMediaUrl = (src: string): string => `/__frameforge/remote?src=${encodeURIComponent(src)}`;
const asError = (error: unknown) => error instanceof Error ? error : new Error(String(error));
const fail = (error: Error, onError?: (error: Error) => void) => {
  if (onError) return onError(error);
  try { cancelRender(error); } catch {} // cancelRender records the error for the frame; the throw has nowhere to go here
};
// shortcut: settled assets stay cached for the page's life (decoded GIF frames included); add eviction if long renders run out of memory
const settled = new Map<string, unknown>();
const loading = new Map<string, Promise<unknown>>();
/** Loads `key` once per page and holds the frame with delayRender until the value is committed; null until then. */
function useAsset<T>(key: string | null, load: () => Promise<T>, {label, onError, timeoutInMilliseconds, retries}: {label: string; onError?: (error: Error) => void; timeoutInMilliseconds?: number; retries?: number}): T | null {
  const [, rerender] = useState(0);
  const handle = useRef<number | null>(null);
  const value = key !== null && settled.has(key) ? settled.get(key) as T : null;
  useEffect(() => {
    if (key === null || settled.has(key)) return;
    const id = delayRender(label, {timeoutInMilliseconds, retries});
    handle.current = id;
    let live = true;
    let promise = loading.get(key);
    if (!promise) {
      promise = load().then(result => { settled.set(key, result); return result; }).finally(() => loading.delete(key));
      loading.set(key, promise);
    }
    promise.then(() => { if (live) rerender(count => count + 1); }, error => {
      continueRender(id); handle.current = null;
      if (live) fail(asError(error), onError);
    });
    return () => { live = false; continueRender(id); };
  }, [key]);
  // Release only after the commit that shows the value, so the capture never sees the previous picture.
  useEffect(() => { if (value !== null && handle.current !== null) { continueRender(handle.current); handle.current = null; } });
  return value;
}

/* ---------- AnimatedImage ---------- */

export type AnimatedImageLoopBehavior = 'loop' | 'pause-after-finish' | 'clear-after-finish';
const LOOP_BEHAVIORS: readonly string[] = ['loop', 'pause-after-finish', 'clear-after-finish'];
/** Frame durations in microseconds, decoded once per src. */
type DecodedAnimation = {frames: ImageBitmap[]; durations: number[]; width: number; height: number};
/** Index of the frame on screen `timeUs` into the animation, or null once a 'clear-after-finish' animation has ended. */
export function animatedFrameIndex(timeUs: number, durations: readonly number[], loopBehavior: AnimatedImageLoopBehavior = 'loop'): number | null {
  if (!LOOP_BEHAVIORS.includes(loopBehavior)) throw new Error(`loopBehavior must be 'loop', 'pause-after-finish' or 'clear-after-finish', got ${String(loopBehavior)}`);
  if (!durations.length) return null;
  const total = durations.reduce((sum, duration) => sum + duration, 0);
  if (total <= 0) return 0;
  let time = Math.max(0, timeUs);
  if (time >= total) {
    if (loopBehavior === 'clear-after-finish') return null;
    if (loopBehavior === 'pause-after-finish') return durations.length - 1;
    time %= total;
  }
  for (let index = 0, end = 0; index < durations.length; index++) if (time < (end += durations[index]!)) return index;
  return durations.length - 1;
}
async function decodeAnimation(src: string, requestInit?: RequestInit): Promise<DecodedAnimation> {
  if (typeof ImageDecoder === 'undefined') throw new Error('AnimatedImage needs the ImageDecoder API, which this browser lacks; render and preview in Chrome');
  const response = await fetch(src, requestInit);
  if (!response.ok) throw new Error(`AnimatedImage ${src} failed with HTTP ${response.status}`);
  const decoder = new ImageDecoder({data: await response.arrayBuffer(), type: response.headers.get('content-type') ?? 'image/gif'});
  try {
    await decoder.tracks.ready;
    const count = decoder.tracks.selectedTrack?.frameCount ?? 1;
    const frames: ImageBitmap[] = [], durations: number[] = [];
    for (let frameIndex = 0; frameIndex < count; frameIndex++) {
      const {image} = await decoder.decode({frameIndex});
      durations.push(image.duration ?? 0);
      frames.push(await createImageBitmap(image));
      image.close();
    }
    return {frames, durations, width: frames[0]!.width, height: frames[0]!.height};
  } finally { decoder.close(); }
}
export type AnimatedImageProps = CropProps & React.AriaAttributes & {
  src: string; width?: number; height?: number; fit?: ImageFit; playbackRate?: number; loopBehavior?: AnimatedImageLoopBehavior;
  style?: React.CSSProperties; className?: string; id?: string; onError?: (error: Error) => void; requestInit?: RequestInit; effects?: EffectsProp;
  [data: `data-${string}`]: string | undefined;
};
/** A GIF, APNG, AVIF or WebP drawn frame-accurately to a canvas from the browser's ImageDecoder. */
export const AnimatedImage = forwardRef<HTMLCanvasElement, AnimatedImageProps>(function AnimatedImage({src, width, height, fit = 'fill', playbackRate = 1, loopBehavior = 'loop', style, className, onError, requestInit, effects, cropLeft, cropRight, cropTop, cropBottom, ...rest}, ref) {
  const frame = useCurrentFrame(), config = useVideoConfig();
  if (typeof src !== 'string' || !src) throw new Error('AnimatedImage requires a src');
  if (/^http:/i.test(src)) throw new Error('AnimatedImage src must use https://, not http://');
  positive(playbackRate, 'AnimatedImage playbackRate');
  const w = width ?? config.width, h = height ?? config.height;
  validateCanvasSize(w, h, 'AnimatedImage');
  if (!LOOP_BEHAVIORS.includes(loopBehavior)) throw new Error(`loopBehavior must be 'loop', 'pause-after-finish' or 'clear-after-finish', got ${String(loopBehavior)}`);
  const canvas = useRef<HTMLCanvasElement>(null);
  useImperativeHandle(ref, () => canvas.current!, []);
  const animation = useAsset(`animated-image:${src}`, () => decodeAnimation(isRemoteSrc(src) ? remoteMediaUrl(src) : src, requestInit), {label: `<AnimatedImage> ${src}`, onError});
  useLayoutEffect(() => {
    if (!animation) return;
    const shown = animatedFrameIndex(frame / config.fps * playbackRate * 1e6, animation.durations, loopBehavior);
    paintCanvas(canvas.current!, {width: w, height: h, effects}, (context, cw, ch) => {
      if (shown === null) return;
      const box = fitRect(fit, animation.width, animation.height, cw, ch);
      context.drawImage(animation.frames[shown]!, box.x, box.y, box.width, box.height);
    });
  });
  return <canvas {...rest} ref={canvas} width={w} height={h} className={className} style={{clipPath: cropClipPath({cropLeft, cropRight, cropTop, cropBottom}), ...style}} />;
});

/* ---------- CanvasImage ---------- */

export type CanvasImageProps = CropProps & {
  src: string; width?: number; height?: number; fit?: ImageFit; effects?: EffectsProp; className?: string; id?: string; style?: React.CSSProperties;
  crossOrigin?: 'anonymous' | 'use-credentials'; onError?: (error: Error) => void; maxRetries?: number; pauseWhenLoading?: boolean;
  delayRenderRetries?: number; delayRenderTimeoutInMilliseconds?: number;
};
function loadImage(src: string, crossOrigin: string, maxRetries: number): Promise<HTMLImageElement> {
  const attempt = (left: number, wait: number): Promise<HTMLImageElement> => new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = crossOrigin;
    image.onload = () => image.decode().then(() => resolve(image), reject);
    image.onerror = () => reject(new Error(`CanvasImage could not load ${src}`));
    image.src = src;
  }).catch(error => left > 0 ? new Promise<void>(done => setTimeout(done, wait)).then(() => attempt(left - 1, wait * 2)) : Promise.reject(error));
  return attempt(maxRetries, 1000);
}
/** A still image drawn to a canvas so `effects` can process it. */
export const CanvasImage = forwardRef<HTMLCanvasElement, CanvasImageProps>(function CanvasImage({src, width, height, fit = 'fill', effects, className, id, style, crossOrigin = 'anonymous', onError, maxRetries = 2, delayRenderRetries, delayRenderTimeoutInMilliseconds, cropLeft, cropRight, cropTop, cropBottom}, ref) {
  if (typeof src !== 'string' || !src) throw new Error('CanvasImage requires a src');
  integer(maxRetries, 'CanvasImage maxRetries');
  const canvas = useRef<HTMLCanvasElement>(null);
  useImperativeHandle(ref, () => canvas.current!, []);
  const image = useAsset(`canvas-image:${crossOrigin}:${src}`, () => loadImage(src, crossOrigin, maxRetries), {label: `<CanvasImage> ${src}`, onError, timeoutInMilliseconds: delayRenderTimeoutInMilliseconds, retries: delayRenderRetries});
  const w = width ?? image?.naturalWidth, h = height ?? image?.naturalHeight;
  if (w !== undefined && h !== undefined) validateCanvasSize(w, h, 'CanvasImage');
  useLayoutEffect(() => {
    if (!image || w === undefined || h === undefined) return;
    paintCanvas(canvas.current!, {width: w, height: h, effects}, (context, cw, ch) => {
      const box = fitRect(fit, image.naturalWidth, image.naturalHeight, cw, ch);
      context.drawImage(image, box.x, box.y, box.width, box.height);
    });
  });
  return <canvas ref={canvas} id={id} width={w} height={h} className={className} style={{clipPath: cropClipPath({cropLeft, cropRight, cropTop, cropBottom}), ...style}} />;
});

/* ---------- Video ---------- */

export type VideoProps = {
  src: string; trimBefore?: number; trimAfter?: number; playbackRate?: number; volume?: number; muted?: boolean; name?: string;
  style?: React.CSSProperties; className?: string; onError?: (error: Error) => void;
  delayRenderTimeoutInMilliseconds?: number; delayRenderRetries?: number;
};
/** One mounted `<Video>` as the renderer sees it; at local frame f it shows the file at (trimBefore + f × playbackRate) / fps seconds. */
export type VideoClip = {key: string; src: string; startFrame: number; trimBefore: number; trimAfter?: number; playbackRate: number; volume: number; muted: boolean};
const mountedVideos = new Map<string, VideoClip>();
/** Returns the videos rendered (while rendering) since the last call and clears the registry. */
export function collectVideos(): VideoClip[] {
  const clips = [...mountedVideos.values()];
  mountedVideos.clear();
  return clips;
}
/** The file frame shown at local frame `frame`, counted in composition frames: the frame whose interval covers the clip's position. */
export const videoSourceFrame = (trimBefore: number, frame: number, playbackRate = 1): number => Math.floor(videoPosition(trimBefore, frame, playbackRate) + 1e-9); // the epsilon absorbs 0.29 × 100 = 28.999...
/** The clip's position at local frame `frame`, in (fractional) composition frames of the file. */
export const videoPosition = (trimBefore: number, frame: number, playbackRate = 1): number => trimBefore + frame * playbackRate;
/** Seek target for the studio `<video>`: Chrome keeps currentTime to whole microseconds and shows the picture before an
 * exact frame boundary it rounds below, so aim 100 µs inside the frame (shorter than any real frame). */
export const videoSeekTime = (sourceFrame: number, fps: number): number => sourceFrame / fps + 1e-4;
/** The URL the renderer's frame server answers with that frame as a PNG. */
export const videoFrameUrl = (src: string, sourceFrame: number, fps: number): string =>
  `/__frameforge/video-frame?src=${encodeURIComponent(src)}&frame=${sourceFrame}&fps=${fps}`;
const probeAudio = async (src: string): Promise<boolean> => {
  const response = await fetch(`/__frameforge/video-meta?src=${encodeURIComponent(src)}`);
  if (!response.ok) throw new Error(`Video ${src}: ${await response.text()}`);
  return Boolean((await response.json() as {hasAudio: boolean}).hasAudio);
};
const fetchFrame = async (url: string): Promise<true> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Video frame ${url}: ${await response.text()}`);
  await response.arrayBuffer(); // an unread body holds its connection; six large frames would stall every later request
  return true;
};
/** A frame-accurate video: a seeked `<video>` in the studio, an ffmpeg-extracted PNG in `<Img>` while rendering. Its sound plays as an `<Audio>` clip. */
export function Video(props: VideoProps): React.ReactElement | null {
  const frame = useCurrentFrame(), {fps} = useVideoConfig(), {origin, rate, frozen} = useTimelinePosition();
  for (const name of ['loop', 'startFrom', 'endAt'] as const) if (name in props) throw new Error(`Video ${name} is unsupported in FrameForge`);
  const {src, trimBefore = 0, trimAfter, playbackRate = 1, volume = 1, muted = false, style, className, onError, delayRenderTimeoutInMilliseconds, delayRenderRetries} = props;
  validateMediaSrc(src, 'Video');
  if (typeof playbackRate !== 'number' || !(playbackRate >= 0.25 && playbackRate <= 4)) throw new Error(`Video playbackRate must be a number from 0.25 to 4, got ${String(playbackRate)}`);
  if (rate !== 1) throw new Error('Video under a Sequence playbackRate other than 1 is unsupported in FrameForge');
  if (typeof volume !== 'number' || !(volume >= 0 && volume <= 1)) throw new Error('Video volume must be a number between 0 and 1');
  integer(trimBefore, 'Video trimBefore');
  if (trimBefore < 0) throw new Error('Video trimBefore must be nonnegative');
  if (trimAfter !== undefined) { integer(trimAfter, 'Video trimAfter'); if (trimAfter <= trimBefore) throw new Error('Video trimAfter must be greater than trimBefore'); }
  const sourceFrame = videoSourceFrame(trimBefore, frame, playbackRate);
  const ended = trimAfter !== undefined && sourceFrame >= trimAfter;
  const rendering = getFrameforgeEnvironment().isRendering;
  const timing = {timeoutInMilliseconds: delayRenderTimeoutInMilliseconds, retries: delayRenderRetries};
  // A frozen video shows its picture silently; Audio cannot freeze.
  const wantsAudio = !muted && !frozen && !ended;
  const hasAudio = useAsset(rendering && wantsAudio ? `video-audio:${src}` : null, () => probeAudio(src), {label: `<Video> ${src} audio`, onError, ...timing});
  const url = videoFrameUrl(src, sourceFrame, fps);
  const extracted = useAsset(rendering && !ended ? url : null, () => fetchFrame(url), {label: `<Video> ${src} frame ${sourceFrame}`, onError, ...timing});
  if (ended) return null;
  const startFrame = Math.round(origin), key = `${src}:${startFrame}:${trimBefore}`;
  if (rendering) mountedVideos.set(key, {key, src, startFrame, trimBefore, ...(trimAfter === undefined ? {} : {trimAfter}), playbackRate, volume, muted});
  // In the renderer a clip on a file without a sound stream would break the mix, so it waits for the probe.
  // The clip carries the rate, so the mix plays (trimBefore + f × rate) / fps at local frame f, time-stretched by `rate`.
  if (wantsAudio && (!rendering || hasAudio === true)) registerAudioClip({key, src, volume, trimBefore, ...(trimAfter === undefined ? {} : {trimAfter}), startFrame, ...(playbackRate === 1 ? {} : {playbackRate})});
  if (rendering) return extracted ? <Img src={url} style={style} className={className} alt="" /> : null;
  return <SeekedVideo src={src} time={videoSeekTime(videoPosition(trimBefore, frame, playbackRate), fps)} playbackRate={playbackRate} style={style} className={className} onError={onError} timing={timing} />;
}
function SeekedVideo({src, time, playbackRate, style, className, onError, timing}: {src: string; time: number; playbackRate: number; style?: React.CSSProperties; className?: string; onError?: (error: Error) => void; timing: {timeoutInMilliseconds?: number; retries?: number}}) {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const element = video.current!;
    const handle = delayRender(`<Video> ${src} seek ${time.toFixed(3)}s`, timing);
    const done = () => continueRender(handle);
    const failed = () => { done(); fail(new Error(`Video could not load ${src}`), onError); };
    element.addEventListener('seeked', done, {once: true});
    element.addEventListener('error', failed, {once: true});
    element.playbackRate = playbackRate;
    if (element.readyState >= 2 && Math.abs(element.currentTime - time) < 1e-6) done();
    else element.currentTime = time;
    return () => { element.removeEventListener('seeked', done); element.removeEventListener('error', failed); done(); };
  }, [src, time, playbackRate]);
  // The element stays muted: the registered Audio clip carries the sound in the studio and the render.
  return <video ref={video} src={src} muted playsInline preload="auto" style={style} className={className} />;
}
export const OffthreadVideo = Video;
export const Html5Video = Video;

/* ---------- Artifact ---------- */

const ArtifactThumbnail: unique symbol = Symbol('Artifact.Thumbnail');
/** A file the renderer writes next to the output; Uint8Array content travels as base64. */
export type ArtifactEntry = {filename: string; encoding: 'utf8' | 'base64'; content: string};
const ARTIFACT_FILENAME = /^[0-9a-zA-Z\-!_.*'()/:&$@=;+,?]+$/;
const mountedArtifacts = new Map<string, ArtifactEntry>();
/** Returns the artifacts rendered (while rendering) since the last call and clears the registry. */
export function collectArtifacts(): ArtifactEntry[] {
  const entries = [...mountedArtifacts.values()];
  mountedArtifacts.clear();
  return entries;
}
function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
function ArtifactComponent({filename, content}: {filename: string; content: string | Uint8Array | typeof ArtifactThumbnail; downloadBehavior?: unknown}): null {
  if (typeof filename !== 'string' || !ARTIFACT_FILENAME.test(filename) || filename.startsWith('/') || filename.split('/').some(part => part === '..' || part === '.' || part === '')) throw new Error(`Artifact filename ${JSON.stringify(filename)} must be a relative path of letters, digits and -!_.*'()/:&$@=;+,?`);
  if (content === ArtifactThumbnail) throw new Error('Artifact.Thumbnail is unsupported in FrameForge');
  if (typeof content !== 'string' && !(content instanceof Uint8Array)) throw new Error('Artifact content must be a string or Uint8Array');
  // The studio has no output folder, so artifacts only register while rendering.
  if (getFrameforgeEnvironment().isRendering) mountedArtifacts.set(filename, typeof content === 'string' ? {filename, encoding: 'utf8', content} : {filename, encoding: 'base64', content: toBase64(content)});
  return null;
}
/** Emits a file during rendering; render it on one frame only, because filenames must be unique per render. */
ArtifactComponent.Thumbnail = ArtifactThumbnail;
export const Artifact = ArtifactComponent;

/* ---------- Track and Interactive ---------- */

type TimingProps = Pick<SequenceProps, 'from' | 'durationInFrames' | 'trimBefore' | 'playbackRate' | 'freeze' | 'name' | 'showInTimeline'> & {hidden?: boolean};
const timed = (timing: TimingProps, child: React.ReactNode, size?: {width?: number; height?: number}): React.ReactElement | null => {
  const {hidden, name: _name, showInTimeline: _show, ...sequence} = timing;
  if (hidden) return null;
  const needsSequence = Object.values(sequence).some(value => value !== undefined) || size?.width !== undefined || size?.height !== undefined;
  return needsSequence ? <Sequence layout="none" {...sequence} {...size}>{child}</Sequence> : <>{child}</>;
};
/** Groups clips onto one studio timeline row; it adds no DOM and only applies its timing props to its children. */
export function Track({children, width, height, from, durationInFrames, trimBefore, playbackRate, freeze, hidden}: TimingProps & {children?: React.ReactNode; width?: number; height?: number}): React.ReactElement | null {
  return timed({from, durationInFrames, trimBefore, playbackRate, freeze, hidden}, children, {width, height});
}
type ManagedProps = TimingProps & CropProps & {loop?: boolean; premountFor?: number; postmountFor?: number; styleWhilePremounted?: React.CSSProperties; styleWhilePostmounted?: React.CSSProperties};
const MANAGED = ['from', 'durationInFrames', 'trimBefore', 'playbackRate', 'freeze', 'hidden', 'name', 'showInTimeline', 'loop', 'cropLeft', 'cropRight', 'cropTop', 'cropBottom', 'premountFor', 'postmountFor', 'styleWhilePremounted', 'styleWhilePostmounted'] as const;
function splitManaged<T extends Record<string, unknown>>(props: T): [ManagedProps, Record<string, unknown>] {
  const managed: Record<string, unknown> = {}, rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) ((MANAGED as readonly string[]).includes(key) ? managed : rest)[key] = value;
  return [managed as ManagedProps, rest];
}
function managedElement(type: React.ElementType, props: Record<string, unknown>, ref: React.Ref<unknown>): React.ReactElement | null {
  const [managed, rest] = splitManaged(props);
  const clipPath = cropClipPath(managed);
  const style = clipPath ? {...(rest.style as React.CSSProperties | undefined), clipPath} : rest.style;
  return timed(managed, createElement(type, {...rest, style, ref}));
}
const TAGS = ['a', 'article', 'aside', 'button', 'code', 'div', 'em', 'footer', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'label', 'li', 'main', 'nav', 'ol', 'p', 'pre', 'section', 'small', 'span', 'strong', 'ul', 'circle', 'ellipse', 'g', 'line', 'path', 'rect', 'svg', 'text'] as const;
type Tag = typeof TAGS[number];
type PascalTag<T extends string> = T extends `h${infer N}` ? `H${N}` : Capitalize<T>;
type InteractiveElement<T extends Tag> = React.ForwardRefExoticComponent<Omit<React.ComponentPropsWithoutRef<T>, keyof ManagedProps> & ManagedProps & React.RefAttributes<Element>>;
const elements = Object.fromEntries(TAGS.map(tag => [tag[0]!.toUpperCase() + tag.slice(1), forwardRef<Element, Record<string, unknown>>(function InteractiveElement(props, ref) { return managedElement(tag, props, ref); })])) as unknown as {[T in Tag as PascalTag<T>]: InteractiveElement<T>};
type CreateOptions<P> = {Component: React.ComponentType<P>; schema?: Record<string, unknown>; componentName?: string; wrapInSequence?: boolean; layout?: 'none' | 'absolute-fill'};
/** Wraps a component so it takes the timing and crop props; the studio controls in `schema` are carried, not shown. */
function create<P extends object>({Component, layout = 'none'}: CreateOptions<P>): React.FC<P & ManagedProps> {
  return function InteractiveComponent(props: P & ManagedProps) {
    const [managed, rest] = splitManaged(props as Record<string, unknown>);
    const clipPath = cropClipPath(managed);
    const child = createElement(Component as React.ComponentType<Record<string, unknown>>, clipPath ? {...rest, style: {...(rest.style as object | undefined), clipPath}} : rest);
    return layout === 'absolute-fill' && !managed.hidden ? <Sequence {...managed}>{child}</Sequence> : timed(managed, child);
  };
}
/** Studio-editable elements. Outside the studio they are their plain element with the timing and crop props applied. */
export const Interactive = {...elements, create, withSchema: create};

/* ---------- HTML in canvas ---------- */

export const HTML_IN_CANVAS_UNSUPPORTED_MESSAGE = 'HTML in Canvas requires Chrome 149 or newer with Canvas Draw Element enabled at chrome://flags/#canvas-draw-element.';
type DrawElementContext = CanvasRenderingContext2D & {drawElementImage?: (element: Element, x: number, y: number) => void};
export const isHtmlInCanvasSupported = (): boolean => typeof CanvasRenderingContext2D !== 'undefined' && typeof (CanvasRenderingContext2D.prototype as DrawElementContext).drawElementImage === 'function';
export const getHtmlInCanvasUnsupportedMessage = (): string => typeof document === 'undefined' ? `HTML in Canvas is unavailable because there is no browser document. ${HTML_IN_CANVAS_UNSUPPORTED_MESSAGE}` : HTML_IN_CANVAS_UNSUPPORTED_MESSAGE;
export type HtmlInCanvasOnPaintParams = {readonly canvas: HTMLCanvasElement; readonly element: HTMLDivElement; readonly elementImage: Element; readonly pixelDensity: number};
export type HtmlInCanvasOnPaint = (params: HtmlInCanvasOnPaintParams) => void | Promise<void>;
export type HtmlInCanvasProps = CropProps & {
  width: number; height: number; children: React.ReactNode; onPaint?: HtmlInCanvasOnPaint; pixelDensity?: number; effects?: EffectsProp;
  style?: React.CSSProperties; className?: string;
};
/**
 * Lays its children out inside a canvas and paints them with the browser's drawElementImage, then `onPaint` or `effects`.
 * shortcut: the renderer's Chrome runs with --enable-blink-features=CanvasDrawElement, but a stock Chrome studio tab lacks drawElementImage and throws; preview needs the flag at chrome://flags/#canvas-draw-element
 */
function HtmlInCanvasComponent({width, height, children, onPaint, pixelDensity = 1, effects, style, className, cropLeft, cropRight, cropTop, cropBottom}: HtmlInCanvasProps): React.ReactElement {
  if (!isHtmlInCanvasSupported()) throw new Error(getHtmlInCanvasUnsupportedMessage());
  validateCanvasSize(width, height, 'HtmlInCanvas'); finite(pixelDensity, 'HtmlInCanvas pixelDensity');
  const canvas = useRef<HTMLCanvasElement>(null), element = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const target = canvas.current! as HTMLCanvasElement & {requestPaint?: () => void; onpaint?: (() => void) | null};
    const handle = delayRender('<HtmlInCanvas> paint');
    // The element must be painted into its own canvas, so effects run on a copy of that canvas afterwards.
    const paintDefault = () => {
      const context = target.getContext('2d') as DrawElementContext;
      context.setTransform(pixelDensity, 0, 0, pixelDensity, 0, 0);
      context.clearRect(0, 0, width, height);
      context.drawElementImage!(element.current!, 0, 0);
      if (!effects?.length) return;
      const output = runEffectChain(target, effects, target.width, target.height);
      if (output === target) return; // every effect disabled
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, target.width, target.height);
      context.drawImage(output, 0, 0);
    };
    target.onpaint = () => {
      const painted = onPaint ? onPaint({canvas: target, element: element.current!, elementImage: element.current!, pixelDensity}) : paintDefault();
      Promise.resolve(painted).then(() => continueRender(handle), error => { continueRender(handle); fail(asError(error)); });
    };
    target.requestPaint?.();
    return () => { target.onpaint = null; continueRender(handle); };
  });
  return createElement('canvas', {ref: canvas, layoutsubtree: '', width: Math.round(width * pixelDensity), height: Math.round(height * pixelDensity), className, style: {width, height, clipPath: cropClipPath({cropLeft, cropRight, cropTop, cropBottom}), ...style}},
    <div ref={element} style={{width, height}}>{children}</div>);
}
export const HtmlInCanvas = Object.assign(HtmlInCanvasComponent, {isSupported: isHtmlInCanvasSupported, isNestingSupported: (): boolean => false});
