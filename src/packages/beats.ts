/** Frames here are exact (a beat at 110 bpm falls between frames); round where a cut needs an integer. */
export type BeatGrid = {
  bpm: number; fps: number; beatsPerBar: number;
  /** Average frames per beat; exact for a regular grid. */
  framesPerBeat: number;
  /** The frame of the last beat at or before `frame`. */
  beatAt(frame: number): number;
  /** The frame of the first beat after `frame`. */
  nextBeat(frame: number): number;
  /** Index of the last beat at or before `frame`; 0 is the first beat, negative before it. */
  beatIndex(frame: number): number;
  /** Index of the bar holding `frame` (`beatIndex / beatsPerBar`, floored). */
  barAt(frame: number): number;
  /** 0 at a beat rising to 1 just before the next one. */
  phase(frame: number): number;
  /** 1 on the beat, falling linearly to 0 after `decayFrames`. */
  pulse(frame: number, decayFrames: number): number;
  /** Whether `frame` is within `toleranceFrames` of a beat. */
  onBeat(frame: number, toleranceFrames?: number): boolean;
  /** The bar-line frames inside [fromFrame, toFrame], in order. */
  bars(fromFrame: number, toFrame: number): number[];
};

const EPSILON = 1e-6;

/** Every grid derives from two functions: the frame of beat `index`, and the index of the last beat at or before a frame. */
function grid(frameOf: (index: number) => number, lastIndex: (frame: number) => number, bpm: number, fps: number, beatsPerBar: number, framesPerBeat: number): BeatGrid {
  const beatAt = (frame: number) => frameOf(lastIndex(frame));
  const nextBeat = (frame: number) => frameOf(lastIndex(frame) + 1);
  return {
    bpm, fps, beatsPerBar, framesPerBeat, beatAt, nextBeat,
    beatIndex: lastIndex,
    barAt: frame => Math.floor(lastIndex(frame) / beatsPerBar),
    phase: frame => (frame - beatAt(frame)) / (nextBeat(frame) - beatAt(frame)),
    pulse: (frame, decayFrames) => Math.max(0, 1 - (frame - beatAt(frame)) / decayFrames),
    onBeat: (frame, toleranceFrames = 0) => Math.min(frame - beatAt(frame), nextBeat(frame) - frame) <= toleranceFrames + EPSILON,
    bars: (fromFrame, toFrame) => {
      const out: number[] = [];
      for (let index = lastIndex(fromFrame); frameOf(index) <= toFrame + EPSILON; index++) {
        const at = frameOf(index);
        if (at >= fromFrame - EPSILON && ((index % beatsPerBar) + beatsPerBar) % beatsPerBar === 0) out.push(at);
      }
      return out;
    },
  };
}

/** A regular grid: beats every `fps * 60 / bpm` frames from `offsetFrames`. */
export function beatGrid({bpm, fps, offsetFrames = 0, beatsPerBar = 4}: {bpm: number; fps: number; offsetFrames?: number; beatsPerBar?: number}): BeatGrid {
  if (!(bpm > 0) || !(fps > 0) || !(beatsPerBar >= 1)) throw new Error(`beatGrid needs bpm > 0, fps > 0 and beatsPerBar >= 1 (got ${bpm}, ${fps}, ${beatsPerBar}).`);
  const framesPerBeat = fps * 60 / bpm;
  return grid(index => offsetFrames + index * framesPerBeat, frame => Math.floor((frame - offsetFrames) / framesPerBeat + EPSILON), bpm, fps, beatsPerBar, framesPerBeat);
}

type Hit = number | {at: number};
export type AudioSpec = {bpm: number; offsetMs?: number; hits?: Hit[]; sections?: {from: number}[]};

/** Where the score places its bar lines: the phase (seconds into the first bar) that puts hits (weight 2) and section starts (weight 1)
 * nearest a bar line, the same rule scripts/assets/score.py uses, so a Spot's bars fall where the arrangement changes. */
export function barPhaseSeconds({bpm, hits = [], sections = []}: AudioSpec): number {
  const bar = 240 / bpm;
  const marks: [number, number][] = [...hits.map((hit): [number, number] => [typeof hit === 'number' ? hit : hit.at, 2]), ...sections.slice(1).map((section): [number, number] => [section.from, 1])];
  const distance = (t: number, phase: number) => Math.abs((((t - phase + bar / 2) % bar) + bar) % bar - bar / 2);
  const cost = (phase: number) => marks.reduce((sum, [t, weight]) => sum + weight * distance(t, phase), 0);
  const candidates = [...new Set([0, ...marks.map(([t]) => Math.round((t % bar) * 1e6) / 1e6)])].sort((a, b) => a - b);
  return candidates.reduce((best, phase) => cost(phase) < cost(best) ? phase : best);
}

/** The grid of an audio.json spec at `fps`: its `bpm`, and `offsetMs` when given, else the score's own bar phase. */
export function beatsFromSpec(spec: AudioSpec, fps: number, beatsPerBar = 4): BeatGrid {
  const offsetSeconds = spec.offsetMs !== undefined ? spec.offsetMs / 1000 : barPhaseSeconds(spec);
  return beatGrid({bpm: spec.bpm, fps, offsetFrames: offsetSeconds * fps, beatsPerBar});
}

/** The grid of a detected beats.json ({bpm, offsetMs, beats: ms[]}): the listed beats as they are, extended by the average interval
 * before the first and after the last; without a list, a regular grid from bpm and offsetMs. */
export function loadBeats(json: {bpm: number; offsetMs?: number; beats?: number[]}, fps: number, beatsPerBar = 4): BeatGrid {
  const beats = [...(json.beats ?? [])].sort((a, b) => a - b).map(ms => ms / 1000 * fps);
  if (beats.length < 2) return beatGrid({bpm: json.bpm, fps, offsetFrames: beats[0] ?? (json.offsetMs ?? 0) / 1000 * fps, beatsPerBar});
  const last = beats.length - 1;
  const mean = (beats[last]! - beats[0]!) / last;
  const frameOf = (index: number) => index < 0 ? beats[0]! + index * mean : index > last ? beats[last]! + (index - last) * mean : beats[index]!;
  const lastIndex = (frame: number) => {
    if (frame < beats[0]!) return Math.floor((frame - beats[0]!) / mean + EPSILON);
    if (frame >= beats[last]!) return last + Math.floor((frame - beats[last]!) / mean + EPSILON);
    let low = 0, high = last;
    while (high - low > 1) { const mid = (low + high) >> 1; if (beats[mid]! <= frame + EPSILON) low = mid; else high = mid; }
    return low;
  };
  return grid(frameOf, lastIndex, json.bpm, fps, beatsPerBar, mean);
}
