import React from 'react';
import {Audio, interpolate, useCurrentFrame, useVideoConfig} from '../core/index';
import type {Caption} from './captions';

/** One spoken line as voice.py measured it. `emphasis` phrases colour in the rail; `embed` is the one word promoted behind the subject. */
export type NarrationLine = {id: string; text: string; startMs: number; endMs: number; estimated?: boolean; emphasis?: string[]; embed?: string};
/** `narration.timing.json`, written by `npm run voice`. */
export type NarrationTiming = {slug: string; provider: string; voice: string; totalMs: number; lines: NarrationLine[]};
export type NarrationFrameLine = NarrationLine & {startFrame: number; endFrame: number; durationInFrames: number};

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

/** The timing in frames at `fps`; `total` is the frame the last line ends on. */
export function narrationFrames(timing: NarrationTiming, fps: number): {lines: NarrationFrameLine[]; total: number} {
  if (!(fps > 0)) throw new Error('narrationFrames needs a positive fps');
  const toFrame = (ms: number) => Math.round(ms * fps / 1000);
  const lines = timing.lines.map(line => {
    const startFrame = toFrame(line.startMs), endFrame = toFrame(line.endMs);
    return {...line, startFrame, endFrame, durationInFrames: endFrame - startFrame};
  });
  return {lines, total: toFrame(timing.totalMs)};
}

/** Scene timing from the voice: `at('hook')` is the frame the line starts, `current` the line speaking now, `progress` how far into it. */
export function useNarration(timing: NarrationTiming): {lines: NarrationFrameLine[]; total: number; current: NarrationFrameLine | null; index: number; progress: number; at: (id: string) => number; line: (id: string) => NarrationFrameLine} {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {lines, total} = narrationFrames(timing, fps);
  const index = lines.findIndex(line => frame >= line.startFrame && frame < line.endFrame);
  const current = index === -1 ? null : lines[index]!;
  const line = (id: string) => {
    const found = lines.find(candidate => candidate.id === id);
    if (!found) throw new Error(`Narration has no line '${id}' (lines: ${lines.map(candidate => candidate.id).join(', ')})`);
    return found;
  };
  return {lines, total, current, index, progress: current ? (frame - current.startFrame) / Math.max(1, current.durationInFrames) : 0, at: id => line(id).startFrame, line};
}

/** One `Caption` per line, so `serializeSrt({lines: captions.map(c => [c])})` writes the film's .srt. */
export function captionsFromTiming(timing: NarrationTiming): Caption[] {
  return timing.lines.map(line => ({text: line.text, startMs: line.startMs, endMs: line.endMs, timestampMs: (line.startMs + line.endMs) / 2, confidence: 1}));
}

/** The narration track. Mount it once at the root with `src="/audio/generated/<slug>/voice.wav"`. */
export function Voiceover({src, volume = 1}: {src: string; volume?: number}): React.ReactElement {
  // The renderer mixes it like music; ducking music under the voice is a renderer change, see docs/reference/voice.md.
  return <Audio src={src} volume={volume} />;
}

export type SubtitleStyle = {fonts?: {display?: string; ui?: string}; palette?: {ink?: string; paper?: string; accent?: string}; size?: number; radius?: number};
export type SubtitlesProps = SubtitleStyle & {timing: NarrationTiming; style?: 'rail' | 'embed'; position?: 'bottom' | 'top'; maxChars?: number};

/** `#rrggbb` at `alpha` as rgba(), so the plate stays a colour the layout audit can measure; other colour forms pass through. */
const plate = (color: string, alpha: number) => /^#[0-9a-f]{6}$/i.test(color) ? `rgba(${[1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16)).join(', ')}, ${alpha})` : color;

/** Character ranges of the emphasis phrases inside the text; a word is emphasised when it overlaps one. */
function emphasisRanges(text: string, phrases: string[] = []): [number, number][] {
  const ranges: [number, number][] = [];
  for (const phrase of phrases) for (let from = text.indexOf(phrase); from !== -1; from = text.indexOf(phrase, from + 1)) ranges.push([from, from + phrase.length]);
  return ranges;
}

/** Splits at the space nearest the middle when the text is longer than `maxChars`. */
function breakLines(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const middle = text.length / 2;
  let best = -1;
  for (let i = text.indexOf(' '); i !== -1; i = text.indexOf(' ', i + 1)) if (best === -1 || Math.abs(i - middle) < Math.abs(best - middle)) best = i;
  return best === -1 ? [text] : [text.slice(0, best), text.slice(best + 1)];
}

/**
 * One rail line on its plate, with no positioning: words appear in order across `reveal` 0..1 and emphasis words take the accent.
 * `Subtitles` lays these out; use it directly for a custom caption layout.
 */
export function SubtitleLine({line, reveal = 1, fonts, palette, size = 44, radius = 12, maxChars = 24}: {line: NarrationLine; reveal?: number} & SubtitleStyle & {maxChars?: number}): React.ReactElement {
  const ink = palette?.ink ?? '#111111', paper = palette?.paper ?? '#F4F4F1', accent = palette?.accent ?? '#2F5BFF';
  const ranges = emphasisRanges(line.text, line.emphasis);
  const words = line.text.split(' ');
  const rows = breakLines(line.text, maxChars);
  let wordIndex = 0;
  return <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: size * 0.18}}>
    {rows.map((row, rowIndex) => {
      const rowWords = row.split(' ');
      const rowStart = rowIndex === 0 ? 0 : rows[0]!.length + 1;
      const firstWord = wordIndex;
      // A plate with no word yet would read as a blank bar, so each row appears with its first word.
      const rowOpacity = interpolate(reveal, [firstWord / words.length, firstWord / words.length + 0.2 / words.length], [0, 1], clamp);
      return <div key={rowIndex} style={{display: 'flex', gap: size * 0.28, padding: `${size * 0.18}px ${size * 0.55}px`, borderRadius: radius, background: plate(ink, 0.84), color: paper, fontFamily: fonts?.ui, fontWeight: 600, fontSize: size, lineHeight: 1.3, whiteSpace: 'nowrap', opacity: rowOpacity, visibility: rowOpacity === 0 ? 'hidden' : 'visible'}}>
        {rowWords.map((word, i) => {
          const from = rowStart + rowWords.slice(0, i).reduce((sum, w) => sum + w.length + 1, 0), to = from + word.length;
          const index = wordIndex++;
          // Each word has its own slot of the reveal and fades over a fifth of it, so the line reads as typed speech, not a blink.
          const slot = 1 / words.length;
          const opacity = interpolate(reveal, [index * slot, index * slot + slot * 0.2], [0, 1], clamp);
          const strong = ranges.some(([a, b]) => from < b && to > a);
          return <span key={i} style={{opacity, color: strong ? accent : paper, visibility: opacity === 0 ? 'hidden' : 'visible'}}>{word}</span>;
        })}
      </div>;
    })}
  </div>;
}

/**
 * The caption overlay. `rail` (default): the spoken line, verbatim, bottom-centred inside the 80% title-safe box, words revealed
 * across the first part of the line, emphasis in the accent; it stays through a short gap. `embed`: the current line's one promoted
 * word, very large, meant to sit behind the subject (mount it under the scene, not over it). Both are pure functions of the frame.
 */
export function Subtitles({timing, style = 'rail', position = 'bottom', maxChars = 24, fonts, palette, size, radius}: SubtitlesProps): React.ReactElement | null {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const {lines} = narrationFrames(timing, fps);
  const S = Math.min(width, height);
  const hold = Math.round(fps / 2);
  // A line stays up through a short gap so the rail does not blink; the last line leaves with the voice so the final still is still.
  const until = (i: number) => lines[i + 1] ? Math.min(lines[i + 1]!.startFrame, lines[i]!.endFrame + hold) : lines[i]!.endFrame;
  const index = lines.findIndex((line, i) => frame >= line.startFrame && frame < until(i));
  if (index === -1) return null;
  const line = lines[index]!;
  const shownUntil = until(index);
  if (style === 'embed') {
    if (!line.embed) return null;
    const enter = interpolate(frame, [line.startFrame, line.startFrame + 10], [0, 1], clamp);
    const leave = interpolate(frame, [line.endFrame - 8, line.endFrame], [0, 1], clamp);
    const eased = 1 - (1 - enter) ** 3;
    return <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none'}}>
      <span style={{fontFamily: fonts?.display ?? fonts?.ui, fontWeight: 900, fontSize: size ?? S * 0.46, lineHeight: 1, letterSpacing: '-0.04em', color: palette?.accent ?? '#2F5BFF', opacity: Math.min(eased, 1 - leave) * 0.9, transform: `scale(${1.12 - 0.12 * eased}) translateY(${-leave * S * 0.06}px)`, whiteSpace: 'nowrap'}}>{line.embed}</span>
    </div>;
  }
  const reveal = interpolate(frame, [line.startFrame, line.startFrame + line.durationInFrames * 0.6], [0, 1], clamp);
  const enter = interpolate(frame, [line.startFrame, line.startFrame + 5], [0, 1], clamp);
  const leave = interpolate(frame, [shownUntil - 4, shownUntil], [0, 1], clamp);
  return <div style={{position: 'absolute', left: '10%', right: '10%', ...(position === 'top' ? {top: '10%'} : {bottom: '10%'}), display: 'flex', justifyContent: 'center', opacity: Math.min(enter, 1 - leave), transform: `translateY(${(1 - enter) * S * 0.012}px)`, pointerEvents: 'none'}}>
    <SubtitleLine line={line} reveal={reveal} fonts={fonts} palette={palette} size={size ?? S * 0.04} radius={radius ?? S * 0.012} maxChars={maxChars} />
  </div>;
}
