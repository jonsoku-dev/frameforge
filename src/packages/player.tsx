import React, {Component, forwardRef, Suspense, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore} from 'react';
import {collectAudio, FrameProvider, type AudioClip} from '../core/index';
import {finite, integer, positive} from '../core/math';

export type PlayerEventMap = {
  play: Record<string, never>; pause: Record<string, never>; ended: Record<string, never>;
  seeked: {frame: number}; frameupdate: {frame: number}; timeupdate: {frame: number};
  ratechange: {playbackRate: number}; volumechange: {volume: number}; mutechange: {isMuted: boolean};
  scalechange: {scale: number}; fullscreenchange: {isFullscreen: boolean}; error: {error: Error};
};
export type PlayerEventTypes = keyof PlayerEventMap;
export type CallbackListener<T extends PlayerEventTypes> = (data: {detail: PlayerEventMap[T]}) => void;
type Emitter<Events extends PlayerEventTypes> = {
  addEventListener: <T extends Events>(name: T, callback: CallbackListener<T>) => void;
  removeEventListener: <T extends Events>(name: T, callback: CallbackListener<T>) => void;
};
export type ThumbnailRef = Emitter<'error'> & {getContainerNode: () => HTMLDivElement | null; getScale: () => number};
export type PlayerRef = Emitter<PlayerEventTypes> & ThumbnailRef & {
  play: (event?: React.SyntheticEvent) => void; pause: () => void; toggle: (event?: React.SyntheticEvent) => void;
  seekTo: (frame: number) => void; getCurrentFrame: () => number; isPlaying: () => boolean; pauseAndReturnToPlayStart: () => void;
  mute: () => void; unmute: () => void; isMuted: () => boolean; setVolume: (volume: number) => void; getVolume: () => number;
  requestFullscreen: () => void; exitFullscreen: () => void; isFullscreen: () => boolean;
};

export type PlaybackOptions = {durationInFrames: number; fps: number; loop: boolean; playbackRate: number; moveToBeginningWhenEnded: boolean};
/** The player's clock and state without React: playback follows `requestAnimationFrame` timestamps against the moment play started, so dropped frames never slow the video down. */
export type Playback = ReturnType<typeof createPlayback>;
export function createPlayback(initial: PlaybackOptions & {initialFrame?: number}) {
  let options: PlaybackOptions = initial;
  let frame = initial.initialFrame ?? 0, playing = false, volume = 1, muted = false, playStart = frame;
  let anchor = {time: 0, frame}, handle: number | null = null, lastTimeUpdate = -Infinity, version = 0;
  const listeners = new Map<PlayerEventTypes, Set<CallbackListener<any>>>();
  const watchers = new Set<() => void>();
  const emit = <T extends PlayerEventTypes>(name: T, detail: PlayerEventMap[T]) => { for (const callback of [...listeners.get(name) ?? []]) callback({detail}); };
  const changed = () => { version++; for (const watcher of [...watchers]) watcher(); };
  const last = () => options.durationInFrames - 1;
  const setFrame = (next: number) => { if (next === frame) return; frame = next; emit('frameupdate', {frame}); changed(); };
  const reanchor = (time = performance.now()) => { anchor = {time, frame}; };
  const stop = () => { if (handle !== null) cancelAnimationFrame(handle); handle = null; };
  const tick = (now: number) => {
    handle = null;
    if (!playing) return;
    const {durationInFrames, fps, playbackRate, loop} = options;
    // A frame's timestamp can precede the play() call that anchored it.
    let next = anchor.frame + Math.trunc(Math.max(0, now - anchor.time) * fps * playbackRate / 1000);
    if (next < 0 || next > last()) {
      if (!loop) {
        playing = false;
        const start = playbackRate > 0 ? 0 : last();
        setFrame(options.moveToBeginningWhenEnded ? start : last() - start);
        emit('pause', {}); emit('ended', {}); changed();
        return;
      }
      next = (next % durationInFrames + durationInFrames) % durationInFrames;
    }
    setFrame(next);
    if (now - lastTimeUpdate >= 250) { lastTimeUpdate = now; emit('timeupdate', {frame}); }
    handle = requestAnimationFrame(tick);
  };
  const api = {
    play: (_event?: React.SyntheticEvent) => {
      if (playing) return;
      // Playing from the far end starts over instead of ending at once.
      if (!options.loop && frame === (options.playbackRate > 0 ? last() : 0)) setFrame(options.playbackRate > 0 ? 0 : last());
      playing = true; playStart = frame; reanchor();
      emit('play', {}); changed();
      handle = requestAnimationFrame(tick);
    },
    pause: () => {
      if (!playing) return;
      playing = false; stop();
      emit('pause', {}); changed();
    },
    toggle: (event?: React.SyntheticEvent) => playing ? api.pause() : api.play(event),
    seekTo: (target: number) => {
      finite(target, 'seekTo frame');
      setFrame(Math.min(last(), Math.max(0, Math.round(target)))); reanchor();
      emit('seeked', {frame});
    },
    getCurrentFrame: () => frame,
    isPlaying: () => playing,
    pauseAndReturnToPlayStart: () => { if (playing) { api.pause(); api.seekTo(playStart); } },
    mute: () => { if (!muted) { muted = true; emit('mutechange', {isMuted: true}); changed(); } },
    unmute: () => { if (muted) { muted = false; emit('mutechange', {isMuted: false}); changed(); } },
    isMuted: () => muted,
    setVolume: (next: number) => {
      if (!(typeof next === 'number' && next >= 0 && next <= 1)) throw new Error(`setVolume needs a number between 0 and 1, got ${String(next)}`);
      volume = next; emit('volumechange', {volume}); changed();
    },
    getVolume: () => volume,
    addEventListener: <T extends PlayerEventTypes>(name: T, callback: CallbackListener<T>) => { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name)!.add(callback); },
    removeEventListener: <T extends PlayerEventTypes>(name: T, callback: CallbackListener<T>) => { listeners.get(name)?.delete(callback); },
  };
  return {
    ...api, emit,
    /** Applies changed props; a new rate continues from the current frame. */
    update: (next: PlaybackOptions) => {
      const rateChanged = next.playbackRate !== options.playbackRate;
      options = next;
      if (frame > last()) setFrame(last());
      if (rateChanged) { reanchor(); emit('ratechange', {playbackRate: next.playbackRate}); }
    },
    dispose: () => { playing = false; stop(); },
    subscribe: (watcher: () => void) => { watchers.add(watcher); return () => { watchers.delete(watcher); }; },
    getVersion: () => version,
  };
}

/** Keeps one `<audio>` per mounted `<Audio>` clip aligned with the frame; same approach as the studio's playback. */
function useAudioSync(playback: Playback, fps: number, playbackRate: number) {
  const elements = useRef(new Map<string, HTMLAudioElement>());
  useLayoutEffect(() => {
    const clips: AudioClip[] = collectAudio();
    if (typeof Audio === 'undefined') return;
    const frame = playback.getCurrentFrame();
    // Media cannot play backwards, so a negative rate plays silent.
    const live = new Map(playback.isPlaying() && playbackRate > 0 ? clips.map(clip => [clip.key, clip]) : []);
    for (const clip of clips) if (!elements.current.has(clip.key)) elements.current.set(clip.key, new Audio(clip.src));
    for (const [key, element] of elements.current) {
      const clip = live.get(key);
      if (!clip) { if (!element.paused) element.pause(); continue; }
      const expected = (clip.trimBefore + (frame - clip.startFrame) * ((clip as {playbackRate?: number}).playbackRate ?? 1)) / fps;
      element.volume = playback.isMuted() ? 0 : clip.volume * playback.getVolume();
      element.playbackRate = playbackRate;
      // A clip shorter than its Sequence window ends early; play() on an ended element restarts it from 0, stacking repeats.
      if (element.ended || (Number.isFinite(element.duration) && expected >= element.duration - 0.02)) { if (!element.paused) element.pause(); continue; }
      if (!element.paused && Math.abs(element.currentTime - expected) <= 0.08) continue;
      element.currentTime = expected;
      if (element.paused) element.play().catch(() => {}); // autoplay policy: the next user gesture plays it
    }
  });
  useEffect(() => () => { for (const element of elements.current.values()) element.pause(); }, []);
}

type ErrorFallback = (info: {error: Error}) => React.ReactNode;
type RenderLoading = (size: {width: number; height: number; isBuffering: boolean}) => React.ReactNode;
class Boundary extends Component<{fallback?: ErrorFallback; onError: (error: Error) => void; children: React.ReactNode}, {error: Error | null}> {
  state = {error: null as Error | null};
  static getDerivedStateFromError(error: Error) { return {error}; }
  componentDidCatch(error: Error) { this.props.onError(error); }
  render() {
    const {error} = this.state;
    if (!error) return this.props.children;
    return this.props.fallback ? this.props.fallback({error}) : <div style={{padding: 16, color: '#b91c1c', font: '14px sans-serif'}}>{error.message}</div>;
  }
}

type StageProps = {
  component?: React.ComponentType<any>; lazyComponent?: () => Promise<{default: React.ComponentType<any>}>;
  inputProps?: Record<string, unknown>; durationInFrames: number; fps: number; compositionWidth: number; compositionHeight: number;
  style?: React.CSSProperties; className?: string; errorFallback?: ErrorFallback; renderLoading?: RenderLoading;
};
function validate({durationInFrames, fps, compositionWidth, compositionHeight, component, lazyComponent}: StageProps) {
  for (const [name, value] of [['durationInFrames', durationInFrames], ['compositionWidth', compositionWidth], ['compositionHeight', compositionHeight]] as const) { integer(value, name); positive(value, name); }
  positive(fps, 'fps');
  if (!component === !lazyComponent) throw new Error('Pass exactly one of component and lazyComponent');
}
/** The scaled canvas both Player and Thumbnail draw into: the composition keeps its own size and is fitted into the container. */
function Stage({props, frame, container, onError, onScale, onCanvasClick, overlay, containerProps}: {props: StageProps; frame: number; container: React.RefObject<HTMLDivElement | null>; onError: (error: Error) => void; onScale: (scale: number) => void; onCanvasClick?: () => void; overlay?: React.ReactNode; containerProps?: React.HTMLAttributes<HTMLDivElement>}) {
  const {component, lazyComponent, inputProps, durationInFrames, fps, compositionWidth: width, compositionHeight: height, style, className, errorFallback, renderLoading} = props;
  const Scene = useMemo(() => lazyComponent ? React.lazy(lazyComponent) : component!, [component, lazyComponent]);
  const [box, setBox] = useState<{width: number; height: number} | null>(null);
  useLayoutEffect(() => {
    const node = container.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const measure = () => setBox({width: node.clientWidth, height: node.clientHeight});
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const scale = box ? Math.min(box.width / width, box.height / height) : 1;
  useEffect(() => onScale(scale), [scale]);
  const left = box ? (box.width - width * scale) / 2 : 0, top = box ? (box.height - height * scale) / 2 : 0;
  const config = useMemo(() => ({id: 'player', width, height, fps, durationInFrames}), [width, height, fps, durationInFrames]);
  return <div {...containerProps} ref={container} className={className} style={{position: 'relative', overflow: 'hidden', width, aspectRatio: `${width} / ${height}`, ...style}}>
    <div onClick={onCanvasClick} style={{position: 'absolute', left, top, width, height, overflow: 'hidden', transform: `scale(${scale})`, transformOrigin: '0 0'}}>
      <Boundary fallback={errorFallback} onError={onError}>
        <Suspense fallback={renderLoading?.({width: width * scale, height: height * scale, isBuffering: false}) ?? null}>
          <FrameProvider frame={frame} config={config}><Scene {...inputProps} /></FrameProvider>
        </Suspense>
      </Boundary>
    </div>
    {overlay}
  </div>;
}

const timecode = (frame: number, fps: number) => {
  const seconds = Math.floor(frame / fps);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};
const iconButton: React.CSSProperties = {background: 'none', border: 0, padding: 4, color: 'inherit', cursor: 'pointer', display: 'flex'};
function Controls({playback, durationInFrames, fps}: {playback: Playback; durationInFrames: number; fps: number}) {
  const frame = playback.getCurrentFrame(), playing = playback.isPlaying(), muted = playback.isMuted();
  return <div onClick={event => event.stopPropagation()} style={{position: 'absolute', left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', color: 'white', font: '12px system-ui, sans-serif', background: 'linear-gradient(transparent, rgba(0, 0, 0, 0.55))'}}>
    <button type="button" aria-label={playing ? 'Pause' : 'Play'} style={iconButton} onClick={event => playback.toggle(event)}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">{playing ? <path d="M3 2h4v12H3zM9 2h4v12H9z" /> : <path d="M3 1.5v13l11-6.5z" />}</svg>
    </button>
    <button type="button" aria-label={muted ? 'Unmute' : 'Mute'} style={iconButton} onClick={() => muted ? playback.unmute() : playback.mute()}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M2 6h3l4-3v10l-4-3H2z" fill="currentColor" />{muted ? <path d="M11 6l4 4M15 6l-4 4" /> : <path d="M11 5.5a3.5 3.5 0 0 1 0 5M12.5 3.5a6 6 0 0 1 0 9" />}</svg>
    </button>
    <span style={{fontVariantNumeric: 'tabular-nums'}}>{timecode(frame, fps)} / {timecode(durationInFrames, fps)}</span>
    <input type="range" aria-label="Seek" min={0} max={durationInFrames - 1} step={1} value={frame} style={{flex: 1}} onChange={event => playback.seekTo(Number(event.target.value))} />
  </div>;
}

export type PlayerProps = StageProps & {
  controls?: boolean; loop?: boolean; autoPlay?: boolean; initialFrame?: number; playbackRate?: number;
  moveToBeginningWhenEnded?: boolean; clickToPlay?: boolean; spaceKeyToPlayOrPause?: boolean; allowFullscreen?: boolean; initiallyMuted?: boolean;
};
/** Plays a component in a web page at its frame rate on the same timeline as rendering. */
export const Player = forwardRef<PlayerRef, PlayerProps>(function Player(props, ref) {
  const {controls = false, loop = false, autoPlay = false, initialFrame = 0, playbackRate = 1, moveToBeginningWhenEnded = true, clickToPlay = controls, spaceKeyToPlayOrPause = true, allowFullscreen = true, initiallyMuted = false} = props;
  validate(props);
  integer(initialFrame, 'initialFrame');
  if (!(playbackRate >= -10 && playbackRate <= 10 && playbackRate !== 0)) throw new Error('playbackRate must be between -10 and 10 and not 0');
  const options: PlaybackOptions = {durationInFrames: props.durationInFrames, fps: props.fps, loop, playbackRate, moveToBeginningWhenEnded};
  const playbackRef = useRef<Playback | null>(null);
  if (!playbackRef.current) {
    playbackRef.current = createPlayback({...options, initialFrame: Math.max(0, Math.min(initialFrame, props.durationInFrames - 1))});
    if (initiallyMuted) playbackRef.current.mute();
  }
  const playback = playbackRef.current;
  useSyncExternalStore(playback.subscribe, playback.getVersion, playback.getVersion);
  useLayoutEffect(() => playback.update(options), [props.durationInFrames, props.fps, loop, playbackRate, moveToBeginningWhenEnded]);
  useEffect(() => { if (autoPlay) playback.play(); return playback.dispose; }, []);
  useAudioSync(playback, props.fps, playbackRate);
  const container = useRef<HTMLDivElement>(null);
  const scale = useRef(1);
  useEffect(() => {
    const onChange = () => playback.emit('fullscreenchange', {isFullscreen: document.fullscreenElement === container.current});
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  useImperativeHandle(ref, () => {
    const {emit: _emit, update: _update, dispose: _dispose, subscribe: _subscribe, getVersion: _getVersion, ...methods} = playback;
    return {
    ...methods,
    getContainerNode: () => container.current,
    getScale: () => scale.current,
    requestFullscreen: () => {
      if (!allowFullscreen) throw new Error('requestFullscreen needs allowFullscreen');
      if (!container.current?.requestFullscreen) throw new Error('This browser cannot show the player fullscreen');
      void container.current.requestFullscreen();
    },
    exitFullscreen: () => { if (document.fullscreenElement === container.current) void document.exitFullscreen(); },
    isFullscreen: () => typeof document !== 'undefined' && document.fullscreenElement === container.current && container.current !== null,
    };
  }, [allowFullscreen]);
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!controls || !spaceKeyToPlayOrPause || event.key !== ' ' || event.target !== event.currentTarget) return;
    event.preventDefault(); playback.toggle(event);
  };
  return <Stage props={props} frame={playback.getCurrentFrame()} container={container} containerProps={controls ? {tabIndex: 0, onKeyDown} : undefined}
      onError={error => playback.emit('error', {error})}
      onScale={next => { if (next !== scale.current) { scale.current = next; playback.emit('scalechange', {scale: next}); } }}
      onCanvasClick={clickToPlay ? () => playback.toggle() : undefined}
      overlay={controls ? <Controls playback={playback} durationInFrames={props.durationInFrames} fps={props.fps} /> : null} />;
});

export type ThumbnailProps = StageProps & {frameToDisplay: number};
/** One still frame of a component, sized like the Player. */
export const Thumbnail = forwardRef<ThumbnailRef, ThumbnailProps>(function Thumbnail(props, ref) {
  validate(props);
  integer(props.frameToDisplay, 'frameToDisplay');
  const container = useRef<HTMLDivElement>(null);
  const scale = useRef(1);
  const listeners = useRef(new Set<CallbackListener<'error'>>());
  useImperativeHandle(ref, () => ({
    getContainerNode: () => container.current,
    getScale: () => scale.current,
    addEventListener: (_name, callback) => { listeners.current.add(callback as CallbackListener<'error'>); },
    removeEventListener: (_name, callback) => { listeners.current.delete(callback as CallbackListener<'error'>); },
  }), []);
  return <Stage props={props} frame={props.frameToDisplay} container={container} onScale={next => { scale.current = next; }}
    onError={error => { for (const callback of [...listeners.current]) callback({detail: {error}}); }} />;
});
