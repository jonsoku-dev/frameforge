import React, {Children, createContext, forwardRef, isValidElement, useContext, useEffect, useRef} from 'react';
import {finite, integer, positive} from './math';
import type {MotionSample, MotionFamily, MotionAxis, SoundRole, SoundMap} from './sound';
export {Easing, interpolate, interpolateColors, assertValidInterpolateEasingOption, assertValidInterpolatePosterizeOption, spring, measureSpring, random} from './math';
export type {EasingFunction, InterpolateColorsOptions, InterpolateOptions, SpringOptions} from './math';
/** Frameforge's own version, kept equal to package.json by a test. */
export const VERSION = '0.1.0';
/** Render settings live in `npm run render` arguments; this stays empty for import compatibility. */
export const Config: Readonly<Record<string, never>> = Object.freeze({});
export {googleFont, googleFontHref, whenGoogleFontsSettled} from './fonts';
export type {GoogleFontDisplay, GoogleFontOptions} from './fonts';
export type VideoConfig = {
  id: string; width: number; height: number; fps: number; durationInFrames: number;
  defaultProps?: Record<string, unknown>; props?: Record<string, unknown>;
};
export type CompositionMetadataPatch = {
  width?: number; height?: number; fps?: number; durationInFrames?: number; props?: Record<string, unknown>;
  defaultCodec?: string; defaultOutName?: string; defaultVideoImageFormat?: string;
  defaultPixelFormat?: string; defaultProResProfile?: string; colorSpace?: string;
};
export type CalculateMetadataOptions = {
  defaultProps: Record<string, unknown>; props: Record<string, unknown>;
  abortSignal: AbortSignal; compositionId: string; isRendering: boolean;
};
export type CalculateMetadata = (options: CalculateMetadataOptions) => CompositionMetadataPatch | Promise<CompositionMetadataPatch>;
export type CompositionDefinition = VideoConfig & {
  component: React.ComponentType<any>;
  calculateMetadata?: CalculateMetadata;
  /** Studio-tunable inputs declared by the composition; the engine only carries them through. */
  variables?: readonly Record<string, unknown>[];
};
export type ResolvedComposition = CompositionDefinition & {props: Record<string, unknown>};
export const RegistryContext = createContext<((config: CompositionDefinition) => void) | null>(null);
let registeredRoot: React.ComponentType | null = null;
let inputProps: Record<string, unknown> = {};
export function registerRoot(component: React.ComponentType): void {
  if (typeof component !== 'function') throw new Error('registerRoot requires a React component');
  registeredRoot = component;
}
export const getRegisteredRoot = (): React.ComponentType | null => registeredRoot;
export function setInputProps(props: Record<string, unknown>): void { inputProps = {...props}; }
export function getInputProps<T extends Record<string, unknown> = Record<string, unknown>>(): T { return {...inputProps} as T; }
function validateConfig(config: Pick<VideoConfig, 'id' | 'width' | 'height' | 'fps' | 'durationInFrames'>): void {
  if (!config.id) throw new Error('Composition id is required');
  for (const name of ['width', 'height', 'durationInFrames'] as const) { integer(config[name], name); positive(config[name], name); }
  positive(config.fps, 'fps');
}
const METADATA_FIELDS = new Set(['width', 'height', 'fps', 'durationInFrames']);
const RENDERER_HINTS = new Set(['defaultCodec', 'defaultOutName', 'defaultVideoImageFormat', 'defaultPixelFormat', 'defaultProResProfile', 'colorSpace']);
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function aborted(id: string): DOMException {
  return new DOMException(`calculateMetadata aborted for ${id}`, 'AbortError');
}
function readMetadataPatch(id: string, value: unknown): CompositionMetadataPatch {
  if (!isRecord(value)) throw new Error(`calculateMetadata for ${id} must return an object`);
  const patch: CompositionMetadataPatch = {};
  for (const [key, field] of Object.entries(value)) {
    if (key === 'props') {
      if (!isRecord(field)) throw new Error(`calculateMetadata for ${id} returned props that are not an object`);
      patch.props = field;
      continue;
    }
    if (METADATA_FIELDS.has(key)) {
      if (typeof field !== 'number') throw new Error(`calculateMetadata for ${id} returned non-numeric ${key}`);
      if (key === 'width') patch.width = field;
      else if (key === 'height') patch.height = field;
      else if (key === 'fps') patch.fps = field;
      else patch.durationInFrames = field;
      continue;
    }
    if (RENDERER_HINTS.has(key)) continue;
    throw new Error(`calculateMetadata for ${id} returned unsupported field ${key}`);
  }
  return patch;
}
/** Merges default and input props, then applies calculateMetadata. Returned props replace that merge. */
export async function resolveCompositionMetadata({definition, input, abortSignal, isRendering}: {
  definition: CompositionDefinition; input: Record<string, unknown>; abortSignal: AbortSignal; isRendering: boolean;
}): Promise<ResolvedComposition> {
  if (!isRecord(input)) throw new Error('input props must be an object');
  const defaultProps = {...(definition.defaultProps ?? {})};
  const props = {...defaultProps, ...input};
  if (!definition.calculateMetadata) return {...definition, defaultProps, props};
  if (abortSignal.aborted) throw aborted(definition.id);
  const result = await definition.calculateMetadata({defaultProps, props, abortSignal, compositionId: definition.id, isRendering});
  if (abortSignal.aborted) throw aborted(definition.id);
  const patch = readMetadataPatch(definition.id, result);
  const resolved: ResolvedComposition = {
    ...definition, defaultProps, props: patch.props ?? props,
    width: patch.width ?? definition.width, height: patch.height ?? definition.height,
    fps: patch.fps ?? definition.fps, durationInFrames: patch.durationInFrames ?? definition.durationInFrames,
  };
  try { validateConfig(resolved); }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`calculateMetadata for ${definition.id}: ${message}`);
  }
  return resolved;
}
export function Composition<T extends object>(props: Omit<CompositionDefinition, 'component' | 'defaultProps'> & {component: React.ComponentType<T>; defaultProps?: T}): null {
  const register = useContext(RegistryContext);
  validateConfig(props);
  if (!register) throw new Error('Composition must be rendered inside RegistryContext');
  // The collector must be local to the host's discovery render, never React state.
  register(props as CompositionDefinition);
  return null;
}
export function Still<T extends object>(props: Omit<Parameters<typeof Composition<T>>[0], 'fps' | 'durationInFrames'>): React.ReactElement {
  return <Composition {...props} fps={1} durationInFrames={1} />;
}
/** The enclosing `<Folder>` name and its parent's name; both null outside any folder. */
export const FolderContext = createContext<{folderName: string | null; parentName: string | null}>({folderName: null, parentName: null});
export function Folder({name, children}: {name: string; children?: React.ReactNode}): React.ReactElement {
  const parent = useContext(FolderContext);
  return <FolderContext.Provider value={{folderName: name, parentName: parent.folderName}}>{children}</FolderContext.Provider>;
}
// origin: absolute composition frame of local frame 0; rate: local frames per absolute frame, so local = (absolute - origin) * rate.
type Timeline = {frame: number; config: VideoConfig; origin: number; rate: number; frozen: boolean};
const TimelineContext = createContext<Timeline | null>(null);
function useTimeline(): Timeline {
  const value = useContext(TimelineContext);
  if (!value) throw new Error('Timeline hooks and components require FrameProvider');
  return value;
}
export function FrameProvider({frame, config, children}: {frame: number; config: VideoConfig; children?: React.ReactNode}): React.ReactElement {
  finite(frame, 'frame'); validateConfig(config);
  return <TimelineContext.Provider value={{frame, config, origin: 0, rate: 1, frozen: false}}>{children}</TimelineContext.Provider>;
}
export const useCurrentFrame = (): number => useTimeline().frame;
/** Host API for media components: where this subtree's local frame 0 sits on the composition, its speed, and whether it is frozen. */
export const useTimelinePosition = (): {origin: number; rate: number; frozen: boolean} => { const {origin, rate, frozen} = useTimeline(); return {origin, rate, frozen}; };
export const useVideoConfig = (): VideoConfig => useTimeline().config;
/** The base style of `<AbsoluteFill>`; a caller's `style` is spread over it. */
export const absoluteFillSchema: Readonly<React.CSSProperties> = Object.freeze({position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column'});
export const AbsoluteFill = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(function AbsoluteFill({style, ...props}, ref) {
  return <div {...props} ref={ref} style={{...absoluteFillSchema, ...style}} />;
});
/** Stage zoom the studio provides around the composition; 1 elsewhere. */
export const CurrentScaleContext = createContext(1);
type OutsideOption = {dontThrowIfOutsideOfFrameforge?: boolean};
function useInsideComposition(options: OutsideOption | undefined, hook: string): boolean {
  const inside = useContext(TimelineContext) !== null;
  if (!inside && !options?.dontThrowIfOutsideOfFrameforge) throw new Error(`${hook} must be called inside a composition, or pass {dontThrowIfOutsideOfFrameforge: true}`);
  return inside;
}
/** The studio stage zoom (1 at 100%); 1 while rendering and outside a composition when allowed. */
export function useCurrentScale(options?: OutsideOption): number {
  const scale = useContext(CurrentScaleContext);
  return useInsideComposition(options, 'useCurrentScale') ? scale : 1;
}
/** `devicePixelRatio` in the studio; 1 while rendering, because the renderer captures at device scale 1. */
export function usePixelDensity(options?: OutsideOption): number {
  useInsideComposition(options, 'usePixelDensity');
  return getFrameforgeEnvironment().isRendering || typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
}
export type DelayPlaybackHandle = {unblock: () => void};
/** The studio's playback blocker; the default (render, tests) blocks nothing. */
export const BufferContext = createContext<{delayPlayback: () => DelayPlaybackHandle}>({delayPlayback: () => ({unblock: () => {}})});
/** `delayPlayback()` pauses studio playback until every returned handle is unblocked; a no-op while rendering. Call it in an effect. */
export const useBufferState = () => useContext(BufferContext);
export type SequenceProps = {
  children?: React.ReactNode; from?: number; durationInFrames?: number; layout?: 'none' | 'absolute-fill';
  style?: React.CSSProperties; className?: string; name?: string; showInTimeline?: boolean;
  width?: number; height?: number;
  playbackRate?: number; trimBefore?: number; freeze?: number | null; premountFor?: number; postmountFor?: number;
};
export function Sequence(props: SequenceProps): React.ReactElement | null {
  const parent = useTimeline();
  const firstRate = useRef(props.playbackRate ?? 1);
  if (firstRate.current !== (props.playbackRate ?? 1)) throw new Error('Sequence playbackRate must be constant across frames');
  const {children, from = 0, durationInFrames = Infinity, layout = 'absolute-fill', style, className, width, height, playbackRate = 1, trimBefore = 0, freeze, premountFor, postmountFor} = props;
  integer(from, 'Sequence from');
  if (durationInFrames !== Infinity) { integer(durationInFrames, 'Sequence durationInFrames'); positive(durationInFrames, 'Sequence durationInFrames'); }
  positive(playbackRate, 'Sequence playbackRate'); integer(trimBefore, 'Sequence trimBefore');
  if (trimBefore < 0) throw new Error('Sequence trimBefore must be nonnegative');
  if (freeze != null) finite(freeze, 'Sequence freeze');
  for (const [name, value] of [['premountFor', premountFor], ['postmountFor', postmountFor]] as const) if (value !== undefined && (finite(value, `Sequence ${name}`) < 0)) throw new Error(`Sequence ${name} must be nonnegative`);
  if (layout !== 'none' && layout !== 'absolute-fill') throw new Error('Invalid Sequence layout');
  if (layout === 'none' && (style !== undefined || className !== undefined)) throw new Error('Sequence style/className require absolute-fill layout');
  if (width !== undefined) { integer(width, 'Sequence width'); positive(width, 'Sequence width'); }
  if (height !== undefined) { integer(height, 'Sequence height'); positive(height, 'Sequence height'); }
  const local = parent.frame - from, remaining = parent.config.durationInFrames - from;
  if (local < 0 || local >= Math.min(durationInFrames / playbackRate, remaining)) return null;
  const config = {...parent.config, durationInFrames: trimBefore + Math.min(durationInFrames, remaining * playbackRate), width: width ?? parent.config.width, height: height ?? parent.config.height};
  const rate = parent.rate * playbackRate;
  const timeline = {frame: freeze ?? local * playbackRate + trimBefore, config, origin: parent.origin + from / parent.rate - trimBefore / rate, rate, frozen: parent.frozen || freeze != null};
  const child = <TimelineContext.Provider value={timeline}>{children}</TimelineContext.Provider>;
  // The wrapper is a flex row, not an AbsoluteFill column; observed from the reference renderer's computed styles.
  return layout === 'none' ? child : <div className={className} style={{position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: width ?? '100%', height: height ?? '100%', display: 'flex', ...style}}>{child}</div>;
}
type SeriesSequenceProps = Omit<SequenceProps, 'from'> & {durationInFrames: number; offset?: number};
function SeriesSequence(_props: SeriesSequenceProps): never { throw new Error('Series.Sequence must be a direct child of Series'); }
function SeriesRoot({children, layout = 'none', ...props}: SequenceProps): React.ReactElement {
  let cursor = 0;
  const entries = Children.toArray(children);
  const sequences = entries.map((child, index) => {
    if (!isValidElement<SeriesSequenceProps>(child) || child.type !== SeriesSequence) throw new Error('Series only accepts direct Series.Sequence children');
    const {offset = 0, durationInFrames, ...sequenceProps} = child.props;
    integer(offset, 'Series.Sequence offset');
    if (durationInFrames === Infinity) {
      if (index !== entries.length - 1) throw new Error('Only the last Series.Sequence may have infinite duration');
    } else { integer(durationInFrames, 'Series.Sequence durationInFrames'); positive(durationInFrames, 'Series.Sequence durationInFrames'); }
    const from = cursor + offset;
    // The next entry starts after the frames this one occupies on the parent timeline.
    const span = durationInFrames / (sequenceProps.playbackRate ?? 1);
    if (!Number.isInteger(span) && span !== Infinity) throw new Error('Series.Sequence durationInFrames / playbackRate must be a whole number of frames');
    cursor = from + span;
    return <Sequence {...sequenceProps} durationInFrames={durationInFrames} from={from} key={child.key ?? index} />;
  });
  return <Sequence {...props} layout={layout}>{sequences}</Sequence>;
}
export const Series = Object.assign(SeriesRoot, {Sequence: SeriesSequence});
/** True under `<Freeze>` or a `<Sequence freeze>`; there is no premounting here, so every freeze counts. */
export const useIsInsideNonPremountFreeze = (): boolean => useContext(TimelineContext)?.frozen ?? false;
export function Freeze({frame, active = true, children}: {frame: number; active?: boolean | ((frame: number) => boolean); children?: React.ReactNode}): React.ReactElement {
  const parent = useTimeline(); integer(frame, 'Freeze frame');
  const enabled = typeof active === 'function' ? active(parent.frame) : active;
  return <TimelineContext.Provider value={enabled ? {...parent, frame, frozen: true} : parent}>{children}</TimelineContext.Provider>;
}
export function Loop({durationInFrames, times = Infinity, children, ...props}: Omit<SequenceProps, 'from' | 'durationInFrames'> & {durationInFrames: number; times?: number}): React.ReactElement | null {
  const parent = useTimeline();
  integer(durationInFrames, 'Loop durationInFrames'); positive(durationInFrames, 'Loop durationInFrames');
  if (times !== Infinity) { integer(times, 'Loop times'); positive(times, 'Loop times'); }
  if (parent.frame < 0 || parent.frame >= durationInFrames * times) return null;
  const iterationStart = Math.floor(parent.frame / durationInFrames) * durationInFrames;
  return <Sequence {...props} from={iterationStart} durationInFrames={durationInFrames}>{children}</Sequence>;
}
export const Img = forwardRef<HTMLImageElement, React.ImgHTMLAttributes<HTMLImageElement>>(function Img(props, ref) {
  return <img {...props} ref={ref} />;
});
export type IFrameProps = React.IframeHTMLAttributes<HTMLIFrameElement> & {delayRenderRetries?: number; delayRenderTimeoutInMilliseconds?: number};
/** An `<iframe>` whose load holds the frame through delayRender. */
export const IFrame = forwardRef<HTMLIFrameElement, IFrameProps>(function IFrame({delayRenderRetries, delayRenderTimeoutInMilliseconds, onLoad, onError, ...props}, ref) {
  const handle = useRef<number | null>(null);
  useEffect(() => {
    const id = delayRender(`<IFrame> ${props.src ?? ''}`, {timeoutInMilliseconds: delayRenderTimeoutInMilliseconds, retries: delayRenderRetries});
    handle.current = id;
    return () => continueRender(id);
  }, [props.src]);
  const release = () => { if (handle.current !== null) continueRender(handle.current); handle.current = null; };
  return <iframe {...props} ref={ref} onLoad={event => { release(); onLoad?.(event); }} onError={event => {
    release();
    if (onError) onError(event); else cancelRender(new Error(`<IFrame> failed to load ${props.src ?? ''}`));
  }} />;
});
export type StaticFile = {name: string; src: string; sizeInBytes: number; lastModified: number};
const STATIC_FILES_URL = '/__frameforge/static-files';
let staticFiles: StaticFile[] = [];
/** Host API: the studio and renderer load the public/ listing once at boot. */
export function setStaticFiles(files: StaticFile[]): void { staticFiles = files.map(file => ({...file})); }
/** Files under public/ as loaded at boot; empty when the host loaded none. */
export const getStaticFiles = (): StaticFile[] => staticFiles.map(file => ({...file}));
/** Polls the public/ listing every 2 s in the studio and calls back with the file, or null once it is gone; never fires while rendering. */
export function watchStaticFile(name: string, onChange: (file: StaticFile | null) => void): {cancel: () => void} {
  if (getFrameforgeEnvironment().isRendering || typeof window === 'undefined') return {cancel: () => {}};
  const stamp = (file: StaticFile | undefined) => file ? `${file.lastModified}:${file.sizeInBytes}` : null;
  let last = stamp(staticFiles.find(file => file.name === name));
  const timer = setInterval(() => {
    fetch(STATIC_FILES_URL).then(response => response.json() as Promise<StaticFile[]>).then(files => {
      const file = files.find(item => item.name === name);
      if (stamp(file) !== last) { last = stamp(file); onChange(file ?? null); }
    }).catch(() => {}); // a dropped poll retries on the next tick
  }, 2000);
  return {cancel: () => clearInterval(timer)};
}
export type PrefetchOptions = {method?: 'blob-url' | 'base64'; contentType?: string; credentials?: RequestCredentials; onProgress?: (progress: {totalBytes: number | null; loadedBytes: number}) => void};
/** Downloads `src` now; `waitUntilDone()` gives a blob: or data: URL. While rendering it resolves to `src` without fetching. */
export function prefetch(src: string, options: PrefetchOptions = {}): {free: () => void; waitUntilDone: () => Promise<string>} {
  if (getFrameforgeEnvironment().isRendering) return {free: () => {}, waitUntilDone: () => Promise.resolve(src)};
  const controller = new AbortController();
  let objectUrl: string | null = null;
  const done = (async () => {
    const response = await fetch(src, {signal: controller.signal, credentials: options.credentials});
    if (!response.ok) throw new Error(`prefetch ${src} failed with HTTP ${response.status}`);
    const total = Number(response.headers.get('content-length')) || null;
    const chunks: Uint8Array[] = [];
    let loaded = 0;
    for (const reader = response.body!.getReader();;) {
      const {done: finished, value} = await reader.read();
      if (finished) break;
      chunks.push(value); loaded += value.length;
      options.onProgress?.({totalBytes: total, loadedBytes: loaded});
    }
    const blob = new Blob(chunks as BlobPart[], {type: options.contentType ?? response.headers.get('content-type') ?? ''});
    if (options.method === 'base64') {
      let binary = '';
      for (const byte of new Uint8Array(await blob.arrayBuffer())) binary += String.fromCharCode(byte);
      return `data:${blob.type};base64,${btoa(binary)}`;
    }
    objectUrl = URL.createObjectURL(blob);
    return objectUrl;
  })();
  done.catch(() => {}); // the rejection surfaces through waitUntilDone()
  return {free: () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); }, waitUntilDone: () => done};
}
/** Public assets are served at the origin root; path segments are URL encoded. */
export function staticFile(path: string): string {
  if (typeof path !== 'string' || path.length === 0) throw new Error('staticFile requires a nonempty relative asset path');
  const clean = path.replace(/^\/+/, '');
  if (/^[a-z]+:/i.test(clean) || clean.split('/').some(p => p === '..' || p === '.')) throw new Error('staticFile requires a public asset path without traversal or protocol');
  return '/' + clean.split('/').map(encodeURIComponent).join('/');
}
export type AudioProps = {src: string; volume?: number; trimBefore?: number; trimAfter?: number; name?: string};
/** startFrame is the absolute composition frame of the Audio's local frame 0; at local frame f the file plays at (trimBefore + f) / fps. */
export type AudioClip = {key: string; src: string; volume: number; trimBefore: number; trimAfter?: number; startFrame: number; playbackRate?: number};
const mountedAudio = new Map<string, AudioClip>();
/** Registers a clip as a mounted `<Audio>` does; `<Video>` uses it for the rate and https src that `<Audio>` does not take. */
export const registerAudioClip = (clip: AudioClip): void => { mountedAudio.set(clip.key, clip); };
export function Audio(props: AudioProps): null {
  const {frame, origin, rate, frozen} = useTimeline();
  for (const name of ['loop', 'playbackRate', 'muted', 'startFrom', 'endAt'] as const) if (name in props) throw new Error(`Audio ${name} is unsupported in FrameForge`);
  const {src, volume = 1, trimBefore = 0, trimAfter} = props;
  if (typeof volume === 'function') throw new Error('Audio volume as a function is unsupported in FrameForge');
  if (frozen) throw new Error('Audio inside Freeze is unsupported in FrameForge');
  if (rate !== 1) throw new Error('Audio under a Sequence playbackRate other than 1 is unsupported in FrameForge');
  if (typeof src !== 'string' || !src.startsWith('/')) throw new Error('Audio src must be a public path starting with "/"');
  if (!(volume >= 0 && volume <= 1)) throw new Error('Audio volume must be between 0 and 1');
  integer(trimBefore, 'Audio trimBefore');
  if (trimBefore < 0) throw new Error('Audio trimBefore must be nonnegative');
  if (trimAfter !== undefined) { integer(trimAfter, 'Audio trimAfter'); if (trimAfter <= trimBefore) throw new Error('Audio trimAfter must be greater than trimBefore'); }
  if (trimAfter !== undefined && trimBefore + frame >= trimAfter) return null;
  const startFrame = Math.round(origin);
  const key = `${src}:${startFrame}:${trimBefore}`;
  mountedAudio.set(key, {key, src, volume, trimBefore, ...(trimAfter === undefined ? {} : {trimAfter}), startFrame});
  return null;
}
/** Returns the clips rendered since the last call and clears the registry. */
export function collectAudio(): AudioClip[] {
  const clips = [...mountedAudio.values()];
  mountedAudio.clear();
  return clips;
}
export {deriveSoundEvents, mapSoundEvents} from './sound';
export type {MotionSample, MotionFamily, MotionAxis, SoundEvent, SoundRole, SoundMap, DerivedClip} from './sound';
const motionSamples: MotionSample[] = [];
const soundMaps = new Map<string, SoundMap>();
/** Reports one animated value of this frame (a card's y, a wipe's progress, a camera scale) so the engine can derive sound events from the motion itself. */
export function useMotionSound(key: string, value: number, options: {family?: MotionFamily; axis?: MotionAxis} = {}): void {
  const {frame, origin, frozen} = useTimeline();
  if (typeof key !== 'string' || !key) throw new Error('useMotionSound needs a key');
  finite(value, `useMotionSound ${key} value`);
  if (frozen) return;
  motionSamples.push({key, frame: Math.round(origin + frame), value, family: options.family ?? 'shape', axis: options.axis ?? 'y'});
}
/** The same report as an element, for values computed inside loops where a hook cannot be called. */
export function MotionProbe({id, value, family, axis}: {id: string; value: number; family?: MotionFamily; axis?: MotionAxis}): null {
  useMotionSound(id, value, {...(family ? {family} : {}), ...(axis ? {axis} : {})});
  return null;
}
export type MotionSoundProps = {src: string; role: SoundRole; volume?: number; families?: MotionFamily[]; quiet?: number[]};
/** Declares which file plays for a derived sound role; `quiet` lists frames (music hits) around which no derived sound plays. */
export function MotionSound({src, role, volume = 0.6, families, quiet}: MotionSoundProps): null {
  useTimeline();
  if (typeof src !== 'string' || !src.startsWith('/')) throw new Error('MotionSound src must be a public path starting with "/"');
  if (!['move', 'land', 'appear'].includes(role)) throw new Error('MotionSound role must be move, land or appear');
  if (!(volume >= 0 && volume <= 1)) throw new Error('MotionSound volume must be between 0 and 1');
  soundMaps.set(`${src}:${role}:${families?.join(',') ?? ''}`, {src, role, volume, ...(families ? {families} : {}), ...(quiet ? {quiet} : {})});
  return null;
}
/** Returns the motion samples reported since the last call and clears them. */
export function collectMotion(): MotionSample[] { return motionSamples.splice(0); }
/** Returns the sound maps declared since the last call and clears them. */
export function collectSoundMaps(): SoundMap[] { const maps = [...soundMaps.values()]; soundMaps.clear(); return maps; }
let sampling = false;
/** While sampling motion without a DOM (the studio's sound pass), delayRender hands out handles that never time out. */
export function setSampling(on: boolean): void { sampling = on; }
export const Html5Audio = Audio;
/** Thrown for media that cannot be played back. */
export class MediaPlaybackError extends Error {
  readonly src: string;
  constructor({message, src}: {message: string; src: string}) { super(message); this.name = 'MediaPlaybackError'; this.src = src; }
}
export type ClipRect = {x: number; y: number; width: number; height: number};
let frameHints: {skip: boolean; clip: ClipRect | null} = {skip: false, clip: null};
/** Returns what `Experimental.Null` and `Experimental.Clipper` asked of the frame rendered since the last call, and resets it. */
export function collectFrameHints(): {skip: boolean; clip: ClipRect | null} {
  const hints = frameHints;
  frameHints = {skip: false, clip: null};
  return hints;
}
export const Experimental = {
  /** Rendering it makes the renderer write a blank frame instead of capturing the page. */
  Null: function Null(): null { frameHints.skip = true; return null; },
  /** Rendering it makes the renderer capture only this rectangle of the frame. */
  Clipper: function Clipper({x, y, width, height}: ClipRect): null {
    for (const [name, value] of [['x', x], ['y', y], ['width', width], ['height', height]] as const) finite(value, `Clipper ${name}`);
    positive(width, 'Clipper width'); positive(height, 'Clipper height');
    frameHints.clip = {x, y, width, height};
    return null;
  },
  /** Always false: `<Player>` (src/packages/player.tsx) does not set a context this hook could read. */
  useIsPlayer: (): boolean => false,
};
const pending = new Map<number, {label: string | null; timer: ReturnType<typeof setTimeout>}>();
let cancelled: Error | null = null, nextHandle = 1;
export function delayRender(label?: string, options: {timeoutInMilliseconds?: number; retries?: number} = {}): number {
  const handle = nextHandle++, ms = options.timeoutInMilliseconds ?? 30000;
  if (sampling) return handle;
  const timer = setTimeout(() => { cancelled = new Error(`A delayRender()${label ? ` "${label}"` : ''} was called but not cleared after ${ms}ms`); pending.delete(handle); }, ms);
  pending.set(handle, {label: label ?? null, timer});
  return handle;
}
export function continueRender(handle: number): void {
  const entry = pending.get(handle);
  if (entry) { clearTimeout(entry.timer); pending.delete(handle); }
}
export function cancelRender(error: unknown): never {
  cancelled = error instanceof Error ? error : new Error(String(error));
  for (const {timer} of pending.values()) clearTimeout(timer);
  pending.clear();
  throw cancelled;
}
export const useDelayRender = () => ({delayRender, continueRender, cancelRender});
export async function whenRenderReady(): Promise<void> {
  while (!cancelled && pending.size) await new Promise(resolve => setTimeout(resolve, 10));
  if (!cancelled) return;
  const error = cancelled;
  cancelled = null; // a cancelled or timed-out frame must not poison the next frame on the same page
  throw error;
}
export const getFrameforgeEnvironment = () => {
  const isRendering = typeof location !== 'undefined' && new URLSearchParams(location.search).has('render');
  return {isStudio: !isRendering, isPlayer: false as const, isRendering, isClientSideRendering: false as const, isReadOnlyStudio: false as const};
};
export const useFrameforgeEnvironment = getFrameforgeEnvironment;
export * from './effects';
export * from './media';
export * from '../packages/layout-utils';
export * from '../packages/media-utils';
export * from '../packages/captions';
export * from '../packages/fonts';
export * from '../packages/zod-types';
export * from '../packages/preload';
export * from '../packages/three';
export * from '../packages/paths';
export * from '../packages/shapes';
export * from '../packages/noise';
export * from '../packages/motion-blur';
export * from '../packages/animation-utils';
export * from './art';
export * from '../packages/lottie';
export * from '../packages/seams';
export * from '../packages/narration';
export * from '../packages/formula';
export * from '../packages/image-sequence';
export * from '../packages/model';
export * from '../packages/generative';
export * from '../packages/annotations';
export * from '../packages/beats';
