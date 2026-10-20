import {useEffect, useMemo, useRef, useState} from 'react';
import {cancelRender, continueRender, delayRender} from '../core/index';

/** Decoded audio. `sampleRate` is the AudioContext rate used for decoding (48000 unless given), not the file's. */
export type MediaUtilsAudioData = {channelWaveforms: Float32Array[]; sampleRate: number; durationInSeconds: number; numberOfChannels: number; resultId: string; isRemote: boolean};
/** @deprecated renamed to MediaUtilsAudioData */
export type AudioData = MediaUtilsAudioData;
export type VideoMetadata = {durationInSeconds: number; width: number; height: number; aspectRatio: number; isRemote: boolean};
export type VideoData = VideoMetadata;
export type ImageDimensions = {width: number; height: number};
export type WaveformBar = {index: number; amplitude: number};
export type SampleOutputRange = 'minus-one-to-one' | 'zero-to-one';
export type OptimizeFor = 'accuracy' | 'speed';

const isRemoteUrl = (src: string) => {
  if (typeof location === 'undefined') return /^[a-z][a-z\d+.-]*:/i.test(src);
  try { return new URL(src, location.href).origin !== location.origin; } catch { return false; }
};
// Every loader below caches by src for the page's lifetime; a changed file needs a reload.
function memo<T>(cache: Map<string, Promise<T>>, key: string, load: () => Promise<T>): Promise<T> {
  let entry = cache.get(key);
  if (!entry) { entry = load(); cache.set(key, entry); entry.catch(() => cache.delete(key)); }
  return entry;
}

const audioCache = new Map<string, Promise<MediaUtilsAudioData>>();
/** Fetches and decodes `src` with an AudioContext at `sampleRate` (default 48000). Browser only; memoized by src and rate. */
export function getAudioData(src: string, options: {sampleRate?: number; requestInit?: RequestInit} = {}): Promise<MediaUtilsAudioData> {
  const sampleRate = options.sampleRate ?? 48000;
  return memo(audioCache, `${sampleRate}:${src}`, async () => {
    if (typeof AudioContext === 'undefined') throw new Error('getAudioData needs a browser AudioContext');
    const response = await fetch(src, options.requestInit);
    if (!response.ok) throw new Error(`getAudioData: ${src} failed with HTTP ${response.status}`);
    const context = new AudioContext({sampleRate});
    try {
      const buffer = await context.decodeAudioData(await response.arrayBuffer());
      return {
        channelWaveforms: Array.from({length: buffer.numberOfChannels}, (_, i) => buffer.getChannelData(i)),
        sampleRate, durationInSeconds: buffer.duration, numberOfChannels: buffer.numberOfChannels,
        resultId: String(Math.random()), isRemote: isRemoteUrl(src),
      };
    } finally { void context.close(); }
  });
}

function loadElement<T>(create: () => T & {onerror: unknown; src: string}, event: 'onload' | 'onloadedmetadata', read: (element: T) => unknown, src: string, what: string): Promise<any> {
  if (typeof document === 'undefined') return Promise.reject(new Error(`${what} needs a browser`));
  return new Promise((resolve, reject) => {
    const element = create();
    (element as any)[event] = () => resolve(read(element));
    element.onerror = () => reject(new Error(`${what}: could not load ${src}`));
    element.src = src;
  });
}

const durationCache = new Map<string, Promise<number>>();
/** Duration of `src` from an unattached `<audio>` element's metadata. */
export const getAudioDurationInSeconds = (src: string): Promise<number> => memo(durationCache, src, () =>
  loadElement(() => Object.assign(document.createElement('audio'), {preload: 'metadata'}), 'onloadedmetadata', audio => audio.duration, src, 'getAudioDurationInSeconds'));
/** @deprecated renamed to getAudioDurationInSeconds */
export const getAudioDuration = getAudioDurationInSeconds;

const imageCache = new Map<string, Promise<ImageDimensions>>();
/** Natural pixel size of an image. Browser only; memoized by src. */
export const getImageDimensions = (src: string): Promise<ImageDimensions> => memo(imageCache, src, () =>
  loadElement(() => new Image(), 'onload', image => ({width: image.naturalWidth, height: image.naturalHeight}), src, 'getImageDimensions'));

export const MEDIA_METADATA_URL = '/__frameforge/media-metadata';
const videoCache = new Map<string, Promise<VideoMetadata>>();
/** Probes `src` with ffprobe through the dev server (`public/` paths or http(s) URLs); memoized by src. */
export const getVideoMetadata = (src: string): Promise<VideoMetadata> => memo(videoCache, src, async () => {
  const response = await fetch(`${MEDIA_METADATA_URL}?src=${encodeURIComponent(src)}`);
  const body = await response.json() as {durationInSeconds: number; width: number; height: number} | {error: string};
  if ('error' in body) throw new Error(`getVideoMetadata: ${body.error}`);
  return {...body, aspectRatio: body.width / body.height, isRemote: isRemoteUrl(src)};
});

// The largest positive sample per channel; cached because a channel is scanned for every frame.
const maxCache = new WeakMap<Float32Array, number>();
function positivePeak(data: Float32Array): number {
  let peak = maxCache.get(data);
  if (peak === undefined) { peak = 0; for (const v of data) if (v > peak) peak = v; maxCache.set(data, peak); }
  return peak;
}
// Samples go through 16-bit integers the way the reference truncates them, which matters for bit-exact bars.
const toInt16 = (x: number) => Math.trunc(Math.fround(x < 0 ? x * 32768 : x * 32767));

function fftMagnitudes(real: Float64Array): Float64Array {
  const size = real.length, imag = new Float64Array(size);
  for (let i = 1, j = 0; i < size; i++) {
    let bit = size >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) [real[i], real[j]] = [real[j]!, real[i]!];
  }
  for (let len = 2; len <= size; len <<= 1) {
    for (let start = 0; start < size; start += len) for (let k = 0; k < len / 2; k++) {
      const angle = -2 * Math.PI * k / len, cos = Math.cos(angle), sin = Math.sin(angle);
      const a = start + k, b = a + len / 2;
      const tr = real[b]! * cos - imag[b]! * sin, ti = real[b]! * sin + imag[b]! * cos;
      real[b] = real[a]! - tr; imag[b] = imag[a]! - ti; real[a] = real[a]! + tr; imag[a] = imag[a]! + ti;
    }
  }
  return real.map((re, i) => Math.hypot(re, imag[i]!));
}

function spectrum(audioData: MediaUtilsAudioData, frame: number, fps: number, bars: number, dataOffsetInSeconds: number): number[] {
  const data = audioData.channelWaveforms[0]!;
  const size = bars * 2;
  const start = Math.max(0, Math.floor((frame / fps - dataOffsetInSeconds) * audioData.sampleRate) - bars);
  const window = new Float64Array(size);
  for (let i = 0; i < size && start + i < data.length; i++) window[i] = toInt16(data[start + i]!);
  const scale = bars * 32767 * positivePeak(data);
  const magnitudes = fftMagnitudes(window);
  const out = Array.from({length: bars}, (_, k) => magnitudes[k]! / scale);
  // One 3-tap average over the raw bins, then two in-place passes; the end bins stay raw.
  const raw = out.slice();
  for (let i = 1; i < bars - 1; i++) out[i] = (raw[i - 1]! + raw[i]! + raw[i + 1]!) / 3;
  for (let pass = 0; pass < 2; pass++) for (let i = 1; i < bars - 1; i++) out[i] = (out[i - 1]! + out[i]! + out[i + 1]!) / 3;
  return out;
}

export type VisualizeAudioOptions = {audioData: MediaUtilsAudioData; frame: number; fps: number; numberOfSamples: number; smoothing?: boolean; optimizeFor?: OptimizeFor; dataOffsetInSeconds?: number};
/** Frequency bars (low to high, roughly 0..1) around `frame`; `smoothing` (default true) averages the previous, current and next frame. */
export function visualizeAudio({audioData, frame, fps, numberOfSamples, smoothing = true, dataOffsetInSeconds = 0}: VisualizeAudioOptions): number[] {
  const size = numberOfSamples * 2;
  if (!(Number.isInteger(size) && size > 0 && (size & (size - 1)) === 0)) throw new Error(`The argument "bars" must be a power of two. For example: 64, 128. Got instead: ${size}`);
  if (!smoothing) return spectrum(audioData, frame, fps, numberOfSamples, dataOffsetInSeconds);
  const [a, b, c] = [-1, 0, 1].map(offset => spectrum(audioData, frame + offset, fps, numberOfSamples, dataOffsetInSeconds));
  return b!.map((value, i) => (a![i]! + value + c![i]!) / 3);
}

export type GetWaveformPortion = {audioData: MediaUtilsAudioData; startTimeInSeconds: number; durationInSeconds: number; numberOfSamples: number; channel?: number; outputRange?: SampleOutputRange; dataOffsetInSeconds?: number; normalize?: boolean};
/** Mean absolute amplitude of `numberOfSamples` equal blocks of the range; empty when the range has fewer samples than blocks. */
export function getWaveformPortion({audioData, startTimeInSeconds, durationInSeconds, numberOfSamples, channel = 0, outputRange = 'zero-to-one', dataOffsetInSeconds = 0, normalize = true}: GetWaveformPortion): WaveformBar[] {
  const data = audioData.channelWaveforms[channel];
  if (!data) throw new Error(`getWaveformPortion: channel ${channel} does not exist`);
  const from = (startTimeInSeconds - dataOffsetInSeconds) * audioData.sampleRate;
  const start = Math.floor(from);
  const block = Math.floor((Math.floor(from + durationInSeconds * audioData.sampleRate) - start) / numberOfSamples);
  if (!(block > 0)) return [];
  const means = Array.from({length: numberOfSamples}, (_, i) => {
    let sum = 0;
    for (let j = 0; j < block; j++) sum += Math.abs(data[start + i * block + j] ?? 0);
    return sum / block;
  });
  const peak = Math.max(...means);
  return means.map((mean, index) => {
    const value = normalize && peak !== 0 ? mean / peak : mean;
    return {index, amplitude: outputRange === 'minus-one-to-one' && index % 2 === 0 ? -value : value};
  });
}

export type VisualizeAudioWaveformOptions = {audioData: MediaUtilsAudioData; frame: number; fps: number; windowInSeconds: number; numberOfSamples: number; channel?: number; dataOffsetInSeconds?: number; normalize?: boolean};
/** Waveform of the `windowInSeconds` centred on `frame`, alternating sign per bar (-1..1). */
export function visualizeAudioWaveform({audioData, frame, fps, windowInSeconds, numberOfSamples, channel, dataOffsetInSeconds, normalize = false}: VisualizeAudioWaveformOptions): number[] {
  const bars = getWaveformPortion({audioData, startTimeInSeconds: frame / fps - windowInSeconds / 2, durationInSeconds: windowInSeconds, numberOfSamples, channel, outputRange: 'minus-one-to-one', dataOffsetInSeconds, normalize});
  if (bars.length === 0) throw new Error(`${windowInSeconds}s audiodata does not have ${numberOfSamples} bars. Increase windowInSeconds or decrease numberOfSamples`);
  return bars.map(bar => bar.amplitude);
}

/** An SVG path through `points` with cubic segments whose handles follow the neighbouring points (smoothing 0.2). */
export function createSmoothSvgPath({points}: {points: {x: number; y: number}[]}): string {
  const handle = (current: {x: number; y: number}, previous: {x: number; y: number}, next: {x: number; y: number}, reverse: boolean) => {
    const dx = next.x - previous.x, dy = next.y - previous.y;
    const length = Math.sqrt(dx ** 2 + dy ** 2) * 0.2, angle = Math.atan2(dy, dx) + (reverse ? Math.PI : 0);
    return `${current.x + Math.cos(angle) * length},${current.y + Math.sin(angle) * length}`;
  };
  return points.map((point, i) => i === 0 ? `M ${point.x},${point.y}`
    : `C ${handle(points[i - 1]!, points[i - 2] ?? points[i - 1]!, point, false)} ${handle(point, points[i - 1]!, points[i + 1] ?? point, true)} ${point.x},${point.y}`).join(' ');
}

/** A 32-bit float WAV `data:` URL of the buffer's interleaved channels (the reference writes only channel 0 past two channels; this writes all). */
export function audioBufferToDataUrl(buffer: Pick<AudioBuffer, 'numberOfChannels' | 'sampleRate' | 'length' | 'getChannelData'>): string {
  const channels = Array.from({length: buffer.numberOfChannels}, (_, i) => buffer.getChannelData(i));
  const dataBytes = buffer.length * channels.length * 4;
  const view = new DataView(new ArrayBuffer(44 + dataBytes));
  const text = (offset: number, value: string) => [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
  text(0, 'RIFF'); view.setUint32(4, 36 + dataBytes, true); text(8, 'WAVE'); text(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 3, true); view.setUint16(22, channels.length, true);
  view.setUint32(24, buffer.sampleRate, true); view.setUint32(28, buffer.sampleRate * channels.length * 4, true);
  view.setUint16(32, channels.length * 4, true); view.setUint16(34, 32, true); text(36, 'data'); view.setUint32(40, dataBytes, true);
  for (let i = 0, offset = 44; i < buffer.length; i++) for (const channel of channels) { view.setFloat32(offset, channel[i]!, true); offset += 4; }
  let binary = '';
  const bytes = new Uint8Array(view.buffer);
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:audio/wav;base64,${btoa(binary)}`;
}

export type UseAudioDataOptions = {sampleRate?: number; requestInit?: RequestInit};
/** `getAudioData` as state, holding the frame with delayRender until decoded; `requestInit` is read on the first render only. */
export function useAudioData(src: string, options: UseAudioDataOptions = {}): MediaUtilsAudioData | null {
  const first = useRef(options.requestInit);
  const [data, setData] = useState<MediaUtilsAudioData | null>(null);
  useEffect(() => {
    let live = true;
    const handle = delayRender(`useAudioData ${src}`);
    getAudioData(src, {sampleRate: options.sampleRate, requestInit: first.current})
      .then(result => { if (live) setData(result); continueRender(handle); })
      .catch(error => { if (live) cancelRender(error); });
    return () => { live = false; continueRender(handle); };
  }, [src, options.sampleRate]);
  return data;
}

export type UseWindowedAudioDataOptions = {src: string; frame: number; fps: number; windowInSeconds: number; channelIndex?: number; requestInit?: RequestInit};
export type UseWindowedAudioDataReturnValue = {audioData: MediaUtilsAudioData | null; dataOffsetInSeconds: number};
/**
 * The audio around `frame`: the current `windowInSeconds` window and its neighbours, from channel `channelIndex`.
 * Pass `dataOffsetInSeconds` on to visualizeAudio.
 */
export function useWindowedAudioData({src, frame, fps, windowInSeconds, channelIndex = 0, requestInit}: UseWindowedAudioDataOptions): UseWindowedAudioDataReturnValue {
  // shortcut: decodes the whole file once and slices windows instead of range-requesting them; upgrade if hour-long files run out of memory.
  const full = useAudioData(src, {requestInit});
  const index = Math.floor(frame / fps / windowInSeconds);
  return useMemo(() => {
    const first = Math.max(0, index - 1);
    if (!full) return {audioData: null, dataOffsetInSeconds: first * windowInSeconds};
    const channel = full.channelWaveforms[channelIndex];
    if (!channel) throw new Error(`useWindowedAudioData: channel ${channelIndex} does not exist`);
    const from = Math.floor(first * windowInSeconds * full.sampleRate);
    const slice = channel.subarray(from, Math.floor((index + 2) * windowInSeconds * full.sampleRate));
    return {
      audioData: {channelWaveforms: [slice], sampleRate: full.sampleRate, durationInSeconds: slice.length / full.sampleRate, numberOfChannels: 1, resultId: `${full.resultId}:${channelIndex}:${first}`, isRemote: full.isRemote},
      dataOffsetInSeconds: first * windowInSeconds,
    };
  }, [full, index, windowInSeconds, channelIndex]);
}
