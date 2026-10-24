import React, {useEffect, useRef, useState} from 'react';
import {cancelRender, continueRender, delayRender, getFrameforgeEnvironment, Img, useCurrentFrame, useVideoConfig} from '../core/index';

export type ImageSequenceManifest = {frames: number; fps: number; width?: number; height?: number};
export type ImageSequenceProps = {
  /** Folder of `0000.png, 0001.png, ...` under public/, e.g. `/assets/generated/<slug>/3d/hero` (what `npm run blender` writes). */
  src: string;
  /** Image count; required when rendering, read from the folder's manifest.json in the studio when omitted. */
  frames?: number;
  /** Frame rate the images were rendered at; defaults to the composition's. */
  fps?: number;
  /** Wrap around past the last image instead of holding it. */
  loop?: boolean;
  /** Zero padding of the file names (`pad` 4 → `0007.png`). */
  pad?: number;
  /** First file index to play (skips the head of the sequence). */
  startFrame?: number;
  fit?: 'contain' | 'cover' | 'fill';
  style?: React.CSSProperties;
  className?: string;
};

/** File index for composition frame `frame` at `fps` of `frames` images rendered at `seqFps`: past the end it holds the last image, or wraps when `loop`. */
export function sequenceIndex(frame: number, fps: number, seqFps: number, frames: number, loop = false, startFrame = 0): number {
  if (frames <= 0) return 0;
  const index = Math.floor(Math.max(0, frame) * seqFps / fps) + startFrame;
  return loop ? index % frames : Math.min(index, frames - 1);
}

export const sequenceFile = (src: string, index: number, pad = 4): string => `${src.replace(/\/+$/, '')}/${String(index).padStart(pad, '0')}.png`;

const manifests = new Map<string, Promise<ImageSequenceManifest | null>>();
/** The folder's manifest.json, or null when the sequence has not been rendered; fetched once per folder, studio only. */
function readManifest(src: string): Promise<ImageSequenceManifest | null> {
  let promise = manifests.get(src);
  if (!promise) {
    promise = fetch(sequenceFile(src, 0).replace(/0+\.png$/, 'manifest.json')).then(response => response.ok ? response.json() : null, () => null);
    manifests.set(src, promise);
  }
  return promise;
}

const renderHint = (src: string) => {
  const slug = /\/assets\/generated\/([^/]+)\//.exec(src)?.[1];
  return `run npm run blender -- ${slug ? `examples/samples/${slug}/3d.json` : '<3d.json>'} to render it`;
};

/**
 * Plays a rendered PNG sequence frame-accurately: the file index is `floor(frame × fps / compositionFps)` (clamped or looped),
 * the frame is held with delayRender until that image has loaded, and the next image is prefetched. The render never fetches
 * manifest.json; pass `frames` (and `fps` when it differs) from it. The studio reads the manifest to fill them in and to say
 * which command renders a missing sequence.
 */
export function ImageSequence({src, frames, fps, loop = false, pad = 4, startFrame = 0, fit = 'contain', style, className}: ImageSequenceProps): React.ReactElement | null {
  const frame = useCurrentFrame();
  const config = useVideoConfig();
  const {isRendering} = getFrameforgeEnvironment();
  const [manifest, setManifest] = useState<ImageSequenceManifest | null | undefined>(undefined);
  const image = useRef<HTMLImageElement>(null);
  const handle = useRef<number | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const needManifest = !isRendering && (frames === undefined || fps === undefined || manifest === undefined);
  useEffect(() => {
    if (!needManifest) return;
    let live = true;
    readManifest(src).then(found => { if (live) setManifest(found); });
    return () => { live = false; };
  }, [src, needManifest]);
  if (isRendering && frames === undefined) throw new Error(`<ImageSequence src="${src}"> needs frames={n} when rendering; copy frames and fps from the folder's manifest.json`);
  if (!isRendering && manifest === null) throw new Error(`No image sequence at ${src} (no manifest.json); ${renderHint(src)}`);
  if (failed) throw new Error(failed);
  const count = frames ?? manifest?.frames ?? 0;
  const seqFps = fps ?? manifest?.fps ?? config.fps;
  const index = sequenceIndex(frame, config.fps, seqFps, count, loop, startFrame);
  const file = count > 0 ? sequenceFile(src, index, pad) : null;
  const next = count > 0 ? sequenceFile(src, sequenceIndex(frame + 1, config.fps, seqFps, count, loop, startFrame), pad) : null;
  const release = () => { if (handle.current !== null) continueRender(handle.current); handle.current = null; };
  useEffect(() => {
    if (!file || (image.current?.complete && image.current.naturalWidth > 0)) return;
    handle.current = delayRender(`<ImageSequence> ${file}`);
    return release;
  }, [file]);
  useEffect(() => { if (next && typeof Image !== 'undefined') new Image().src = next; }, [next]);
  if (!file) return null;
  return <Img ref={image} src={file} className={className} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: fit, ...style}} onLoad={release} onError={() => {
    release();
    const message = `<ImageSequence> ${file} failed to load; ${renderHint(src)}`;
    if (isRendering) cancelRender(new Error(message)); else setFailed(message);
  }} />;
}
