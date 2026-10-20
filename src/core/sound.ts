/** Sound events derived from animation. Components report a motion value per frame with `useMotionSound`; after every
 * frame has rendered, `deriveSoundEvents` reads each value series and finds the moments an ear would notice: a move
 * starting, a spring hitting its target (the first crossing when it overshoots), a reveal passing halfway. `mapSoundEvents`
 * turns them into clips through the `<MotionSound>` maps a composition declares, then thins them to a density a mix can
 * carry. Pure functions: the same series always give the same events. */
export type MotionFamily = 'card' | 'shape' | 'text' | 'wipe' | 'camera';
export type MotionAxis = 'x' | 'y' | 'scale' | 'progress';
export type MotionSample = {key: string; frame: number; value: number; family: MotionFamily; axis: MotionAxis};
export type SoundRole = 'move' | 'land' | 'appear';
export type SoundEvent = {key: string; frame: number; role: SoundRole; intensity: number; pan: number; family: MotionFamily; frames: number};
export type SoundMap = {src: string; role: SoundRole; volume: number; families?: MotionFamily[]; quiet?: number[]};
export type DerivedClip = {key: string; src: string; startFrame: number; volume: number; pan: number; role: SoundRole; intensity: number; source: string};

const JITTER = 0.004, SMALL = 0.15, REST = 3, MIN_MOVE = 4;
const clamp = (value: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, value));

/** Events of one key's series, frames ascending. */
function eventsOf(key: string, samples: MotionSample[]): SoundEvent[] {
  const series = [...samples].sort((a, b) => a.frame - b.frame);
  const values = series.map(sample => sample.value);
  const range = Math.max(...values) - Math.min(...values);
  if (!(range > 0) || series.length < 2) return [];
  const {family, axis} = series[0]!;
  const eps = range * JITTER;
  const out: SoundEvent[] = [];
  if (axis === 'progress' && family !== 'wipe') {
    // A reveal: one event where the progress passes halfway, as loud as the distance it travels.
    const index = values.findIndex((value, i) => i > 0 && values[i - 1]! <= 0.5 * range + Math.min(...values) && value > 0.5 * range + Math.min(...values));
    if (index > 0) out.push({key, frame: series[index]!.frame, role: 'appear', intensity: clamp(range > 0 ? 1 : 0), pan: 0, family, frames: 1});
    return out;
  }
  let start = -1, rest = 0, peak = 0;
  const close = (end: number) => {
    const from = values[start]!, to = values[end]!, travel = Math.abs(to - from);
    if (travel < SMALL * range) return;
    const duration = series[end]!.frame - series[start]!.frame;
    const direction = Math.sign(to - from);
    const pan = axis === 'x' ? direction * 0.6 : 0;
    const speed = clamp(peak / (range / 4), 0.3, 1);
    if (duration >= MIN_MOVE && family !== 'text') out.push({key, frame: series[start]!.frame, role: 'move', intensity: clamp(travel / range) * speed, pan, family, frames: duration});
    if (family === 'wipe') return;
    // Where the target is first reached: an overshooting spring lands there, not where it finally rests.
    let hit = end;
    for (let i = start + 1; i <= end; i++) if ((values[i]! - to) * direction >= -eps) { hit = i; break; }
    const overshoot = hit < end;
    const approach = Math.max(...values.slice(Math.max(start + 1, hit - 3), hit + 1).map((value, i, slice) => i === 0 ? 0 : Math.abs(value - slice[i - 1]!)));
    out.push({key, frame: series[hit]!.frame, role: 'land', intensity: clamp(approach / (range / 6) + (overshoot ? 0.3 : 0)), pan, family, frames: 1});
  };
  for (let i = 1; i < values.length; i++) {
    const step = Math.abs(values[i]! - values[i - 1]!);
    if (step > eps) {
      if (start < 0) { start = i - 1; peak = 0; }
      peak = Math.max(peak, step);
      rest = 0;
    } else if (start >= 0 && ++rest >= REST) {
      close(i - rest + 1);
      start = -1;
    }
  }
  if (start >= 0) close(values.length - 1);
  if (family === 'text') return out.filter(event => event.role === 'land').slice(0, 1);
  return out;
}

export function deriveSoundEvents(samples: MotionSample[]): SoundEvent[] {
  const byKey = new Map<string, MotionSample[]>();
  for (const sample of samples) (byKey.get(sample.key) ?? byKey.set(sample.key, []).get(sample.key)!).push(sample);
  return [...byKey].flatMap(([key, series]) => eventsOf(key, series)).sort((a, b) => a.frame - b.frame || b.intensity - a.intensity);
}

/** Clips for the events a composition mapped, at most one per half second and three per four seconds, none near a quiet frame. */
export function mapSoundEvents(events: SoundEvent[], maps: SoundMap[], fps: number): DerivedClip[] {
  const quiet = maps.flatMap(map => map.quiet ?? []);
  const gap = Math.round(fps / 2), window = fps * 4;
  const mapped: DerivedClip[] = [];
  for (const event of events) {
    if (quiet.some(frame => Math.abs(frame - event.frame) <= gap)) continue;
    const map = maps.find(item => item.role === event.role && (!item.families || item.families.includes(event.family)));
    if (!map) continue;
    mapped.push({key: `${map.src}:${event.frame}:motion:${event.key}`, src: map.src, startFrame: event.frame, volume: clamp(map.volume * (0.55 + 0.45 * event.intensity)), pan: event.pan, role: event.role, intensity: event.intensity, source: event.key});
  }
  const kept: DerivedClip[] = [];
  for (const clip of mapped.sort((a, b) => a.startFrame - b.startFrame || b.intensity - a.intensity)) {
    // One gesture may carry its own start and landing (a whoosh then a thud); anything else keeps half a second apart.
    const near = kept.findIndex(item => Math.abs(item.startFrame - clip.startFrame) < gap && !(item.source === clip.source && item.role !== clip.role));
    if (near < 0) kept.push(clip);
    else if (kept[near]!.intensity < clip.intensity) kept[near] = clip;
  }
  kept.sort((a, b) => a.startFrame - b.startFrame);
  // Forward pass, per sound file: a clip plays only when fewer than three of the same file played in the four seconds before
  // it. A busy stretch keeps its first three of each sound, and a different sound (the burst after three chain blips) still lands.
  const out: DerivedClip[] = [];
  for (const clip of kept) if (out.filter(item => item.src === clip.src && item.startFrame > clip.startFrame - window && item.startFrame <= clip.startFrame).length < 3) out.push(clip);
  return out;
}
