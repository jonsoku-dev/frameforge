/** One timed piece of text. `text` is whitespace sensitive: put the space before each word. */
export type Caption = {text: string; startMs: number; endMs: number; timestampMs: number | null; confidence: number | null; pageBreakAfter?: boolean};
export type TikTokToken = {text: string; fromMs: number; toMs: number; pageBreakAfter?: boolean};
export type TikTokPage = {text: string; startMs: number; tokens: TikTokToken[]; durationMs: number};
export type CreateTikTokStyleCaptionsInput = {captions: Caption[]; combineTokensWithinMilliseconds: number; breakOnSilenceAfterMilliseconds?: number};
export type CreateTikTokStyleCaptionsOutput = {pages: TikTokPage[]};
export type ParseSrtInput = {input: string; strict?: boolean};
export type ParseSrtOutput = {captions: Caption[]};
export type ParseVttInput = {input: string};
export type ParseVttOutput = {captions: Caption[]};
export type SerializeSrtInput = {lines: Caption[][]};

const LINE_BREAK = /\r\n|\r|\n/;
const timed = (text: string, startMs: number, endMs: number): Caption => ({text, startMs, endMs, timestampMs: (startMs + endMs) / 2, confidence: 1});

// Tolerant timestamps: `H:M:S` plus anything after the first `,` or `.` read as integer milliseconds.
function looseMs(stamp: string): number {
  const [clock = '', ms] = stamp.split(/[,.]/);
  const parts = clock.split(':');
  if (ms === undefined || parts.length !== 3) throw new Error(`Invalid timestamp:${stamp}`);
  const [h = '', m = '', s = ''] = parts;
  return parseInt(h) * 3600000 + parseInt(m) * 60000 + parseInt(s) * 1000 + parseInt(ms);
}

function parseSrtLoose(input: string): Caption[] {
  const lines = input.split(LINE_BREAK);
  const captions: Caption[] = [];
  let current: Caption | null = null, buffer = '';
  // A blank line trims the text so far and glues later lines on without a separator; a new cue or the end only trims the end.
  const flush = (trim: (text: string) => string) => { if (current) current.text = trim(buffer); buffer = current ? current.text : ''; };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (/^\d+$/.test(line.trim()) && lines[i + 1]?.includes(' --> ')) {
      flush(text => text.trimEnd());
      const [start = '', end = ''] = lines[i + 1]!.split(' --> ').map(part => part.trim());
      current = timed('', looseMs(start), looseMs(end));
      captions.push(current);
      buffer = '';
      i++;
      continue;
    }
    if (!current) continue;
    if (line.trim() === '') { flush(text => text.trim()); continue; }
    buffer += line + '\n';
  }
  flush(text => text.trimEnd());
  return captions;
}

const STRICT_STAMP = /^(\d+):([0-5]\d):([0-5]\d)[,.](\d{3})$/;
const SETTING = /^[A-Za-z][\w-]*:\S+$/;
function parseSrtStrict(input: string): Caption[] {
  const lines = input.split(LINE_BREAK);
  const captions: Caption[] = [];
  let i = 0;
  while (i < lines.length) {
    while (i < lines.length && lines[i]!.trim() === '') i++;
    if (i >= lines.length) break;
    const cue = captions.length + 1;
    const fail = (lineIndex: number, message: string): never => { throw new Error(`SRT cue ${cue}, line ${lineIndex + 1}: ${message}`); };
    if (!/^\d+$/.test(lines[i]!.trim())) fail(i, 'expected a numeric cue index.');
    const timing = lines[i + 1];
    const match = timing === undefined ? null : /^\s*(\S+)\s+-->\s+(\S+)((?:\s+\S+)*)\s*$/.exec(timing);
    if (!match || !match[3]!.split(/\s+/).filter(Boolean).every(setting => SETTING.test(setting))) fail(i + 1, 'expected start --> end timestamps.');
    const [, startText = '', endText = ''] = match!;
    const ms = (stamp: string) => {
      const parts = STRICT_STAMP.exec(stamp);
      if (!parts) fail(i + 1, `invalid timestamp "${stamp}". Use HH:MM:SS,mmm.`);
      const [, h = '', m = '', s = '', milli = ''] = parts!;
      return Number(h) * 3600000 + Number(m) * 60000 + Number(s) * 1000 + Number(milli);
    };
    const startMs = ms(startText), endMs = ms(endText);
    if (endMs < startMs) fail(i + 1, 'end must not be earlier than start.');
    const text: string[] = [];
    let j = i + 2;
    while (j < lines.length && lines[j]!.trim() !== '') text.push(lines[j++]!);
    if (text.length === 0) fail(i + 2, 'expected cue text.');
    captions.push(timed(text.join('\n').trimEnd(), startMs, endMs));
    i = j;
  }
  if (captions.length === 0) throw new Error('SRT: No timed captions found. Provide numbered cues with timestamps and text.');
  return captions;
}

/** Parses a SubRip (`.srt`) file. Tolerant by default; `strict: true` rejects malformed or empty files with the cue and line. */
export function parseSrt({input, strict = false}: ParseSrtInput): ParseSrtOutput {
  if (typeof input !== 'string') throw new Error('parseSrt input must be a string');
  return {captions: strict ? parseSrtStrict(input) : parseSrtLoose(input)};
}

/** Parses a WebVTT (`.vtt`) file: optional header and cue ids, `MM:SS.mmm` or `HH:MM:SS.mmm`, settings ignored, NOTE/STYLE/REGION skipped. */
export function parseVtt({input}: ParseVttInput): ParseVttOutput {
  if (typeof input !== 'string') throw new Error('parseVtt input must be a string');
  const stamp = (text: string) => {
    const match = /^(?:(\d+):)?(\d{1,2}):(\d{1,2})[.,](\d{1,3})$/.exec(text);
    if (!match) throw new Error(`Invalid WebVTT timestamp: ${text}`);
    const [, h = '0', m = '', s = '', ms = ''] = match;
    return Number(h) * 3600000 + Number(m) * 60000 + Number(s) * 1000 + Number(ms.padEnd(3, '0'));
  };
  const captions: Caption[] = [];
  for (const block of input.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split(/\n[ \t]*\n/)) {
    const lines = block.split('\n').filter(line => line.trim() !== '');
    const timing = lines.findIndex(line => line.includes('-->'));
    if (timing === -1 || /^(NOTE|STYLE|REGION)\b/.test(lines[0] ?? '')) continue;
    const [start = '', rest = ''] = lines[timing]!.split('-->');
    captions.push(timed(lines.slice(timing + 1).join('\n'), stamp(start.trim()), stamp(rest.trim().split(/\s+/)[0] ?? '')));
  }
  return {captions};
}

const pad = (value: number, size: number) => String(value).padStart(size, '0');
function srtStamp(ms: number): string {
  const total = Math.floor(ms);
  const hours = Math.floor(total / 3600000), minutes = Math.floor(total / 60000) % 60, seconds = Math.floor(total / 1000) % 60;
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)},${pad(total % 1000, 3)}`;
}

/** Writes cues as SubRip. Each inner array is one cue whose words are concatenated; `pageBreakAfter` splits a cue. */
export function serializeSrt({lines}: SerializeSrtInput): string {
  const cues: Caption[][] = [];
  for (const line of lines) {
    let cue: Caption[] = [];
    for (const word of line) {
      cue.push(word);
      if (word.pageBreakAfter) { cues.push(cue); cue = []; }
    }
    if (cue.length) cues.push(cue);
  }
  return cues.map((cue, index) => `${index + 1}\n${srtStamp(cue[0]!.startMs)} --> ${srtStamp(cue[cue.length - 1]!.endMs)}\n${cue.map(word => word.text).join('')}`).join('\n\n');
}

/**
 * Groups word captions into pages. A caption that starts with a space opens a new page once the page has run longer than
 * `combineTokensWithinMilliseconds`, or after a gap of at least `breakOnSilenceAfterMilliseconds`; `pageBreakAfter` always ends a page.
 */
export function createTikTokStyleCaptions({captions, combineTokensWithinMilliseconds, breakOnSilenceAfterMilliseconds}: CreateTikTokStyleCaptionsInput): CreateTikTokStyleCaptionsOutput {
  // Page length runs from its first word to the end of the latest caption, whitespace-only captions included.
  type Draft = {text: string; tokens: TikTokToken[]; endMs: number};
  const drafts: Draft[] = [];
  let page: Draft | null = null, previous: Caption | null = null, forceBreak = false;
  for (const caption of captions) {
    const wordStart = caption.text.startsWith(' ');
    const tooLong = page !== null && page.tokens.length > 0 && page.endMs - page.tokens[0]!.fromMs > combineTokensWithinMilliseconds;
    const silent = breakOnSilenceAfterMilliseconds !== undefined && previous !== null && caption.startMs - previous.endMs >= breakOnSilenceAfterMilliseconds;
    if (!page || forceBreak || (wordStart && (tooLong || silent))) { page = {text: '', tokens: [], endMs: caption.endMs}; drafts.push(page); }
    forceBreak = Boolean(caption.pageBreakAfter);
    const text = page.text === '' ? caption.text.trimStart() : caption.text;
    page.text += text;
    page.endMs = caption.endMs;
    if (text.trim() !== '') page.tokens.push({text, fromMs: caption.startMs, toMs: caption.endMs, ...(caption.pageBreakAfter ? {pageBreakAfter: true} : {})});
    previous = caption;
  }
  const kept = drafts.filter(draft => draft.tokens.length > 0);
  const lastEnd = captions.length ? captions[captions.length - 1]!.endMs : 0;
  return {pages: kept.map((draft, index) => {
    const startMs = draft.tokens[0]!.fromMs;
    const next = kept[index + 1];
    return {text: draft.text.replace(/\n+$/, ''), startMs, tokens: draft.tokens, durationMs: (next ? next.tokens[0]!.fromMs : lastEnd) - startMs};
  })};
}
