export type RunKind = 'author' | 'review' | 'fix' | 'render' | 'check' | 'capture' | 'request';
export type ArtifactKind = 'sheet' | 'mp4' | 'still' | 'review' | 'log';
export type Artifact = {kind: ArtifactKind; path: string; frames?: number[]};
export type Finding = {id: string; from?: number; to?: number; text: string};
export type Run = {
  id: string; at: string; actor: string; kind: RunKind; summary: string; artifacts: Artifact[];
  prompt?: {path?: string; text?: string}; metrics?: Record<string, unknown>; frame?: number;
  changes?: string[]; findings?: Finding[]; resolves?: string[];
};
export type ProcessLog = {brief: string; audio?: string; runs: Run[]};
export type Loaded<T> = {value: T} | {error: string};
export type AudioSection = {from: number; to: number; energy: number; label: string};
export type AudioSpec = {mood?: string; bpm?: number; key?: string; seed?: number; sections: AudioSection[]; hits: number[]; sfx: string[]; loudness?: {I: number; TP: number}};
export type Overrides = Record<string, string | number | boolean>;
export type CheckLine = {pass: boolean | null; summary: string; frame?: number};
export type ImportedResults = {flash?: {pass: boolean; worstSecondTransitions?: number}; loudness?: {I: number; TP: number; LRA?: number}; colorSpace?: string};
export type CompositionEntry = {
  id: string; folder: string | null; title: string | null;
  files: {spot: string | null; brief: string | null; audio: string | null; process: string | null; overrides: string | null};
  brief: string | null; audio: Loaded<AudioSpec | null>; process: Loaded<ProcessLog | null>; overrides: Loaded<Overrides>;
  importedResults: ImportedResults | null;
};
export type Project = {root: string; entry: string; compositions: CompositionEntry[]};

type Base = {key: string; label: string; group?: string; preview?: number; help?: string};
export type Variable = Base & (
  | {type: 'string'; default: string; maxLength: number; multiline: boolean}
  | {type: 'color'; default: string}
  | {type: 'number'; default: number; min: number; max: number; step: number; unit?: 'frames' | 'px' | '%' | 'x'}
  | {type: 'enum'; default: string; options: {value: string; label: string}[]}
  | {type: 'boolean'; default: boolean}
  | {type: 'audioVolume'; default: number}
);

const RUN_KINDS: RunKind[] = ['author', 'review', 'fix', 'render', 'check', 'capture', 'request'];
const ARTIFACT_KINDS: ArtifactKind[] = ['sheet', 'mp4', 'still', 'review', 'log'];
type Obj = Record<string, unknown>;
const isObj = (value: unknown): value is Obj => typeof value === 'object' && value !== null && !Array.isArray(value);
const str = (value: unknown): string | undefined => typeof value === 'string' ? value : undefined;
const num = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) ? value : undefined;
const int = (value: unknown): number | undefined => Number.isInteger(value) ? value as number : undefined;
const strings = (value: unknown): string[] | undefined => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : undefined;
const ints = (value: unknown): number[] | undefined => Array.isArray(value) && value.every(Number.isInteger) ? value as number[] : undefined;

function loaded<T>(value: unknown, parse: (raw: unknown) => T): Loaded<T> {
  if (!isObj(value)) return {error: '서버 응답 형식이 맞지 않습니다.'};
  if (typeof value.error === 'string') return {error: value.error};
  try { return {value: parse(value.value)}; } catch (error) { return {error: error instanceof Error ? error.message : String(error)}; }
}

export function parseRun(raw: unknown, index: number): Run {
  if (!isObj(raw)) throw new Error(`runs[${index}]가 객체가 아닙니다.`);
  const kind = str(raw.kind) as RunKind;
  if (!RUN_KINDS.includes(kind)) throw new Error(`runs[${index}].kind "${String(raw.kind)}"를 모릅니다.`);
  const id = str(raw.id) ?? `#${index + 1}`;
  const artifacts = Array.isArray(raw.artifacts) ? raw.artifacts.flatMap(item => {
    if (!isObj(item) || !ARTIFACT_KINDS.includes(item.kind as ArtifactKind) || typeof item.path !== 'string') return [];
    const frames = ints(item.frames);
    return [{kind: item.kind as ArtifactKind, path: item.path, ...(frames ? {frames} : {})}];
  }) : [];
  const prompt = isObj(raw.prompt) ? {path: str(raw.prompt.path), text: str(raw.prompt.text)} : undefined;
  const findings = Array.isArray(raw.findings) ? raw.findings.flatMap(item => isObj(item) && typeof item.id === 'string' && typeof item.text === 'string' ? [{id: item.id, from: int(item.from), to: int(item.to), text: item.text}] : []) : undefined;
  return {
    id, kind, at: str(raw.at) ?? '', actor: str(raw.actor) ?? '?', summary: str(raw.summary) ?? '', artifacts,
    prompt, metrics: isObj(raw.metrics) ? raw.metrics : undefined, frame: int(raw.frame),
    changes: strings(raw.changes), findings, resolves: strings(raw.resolves),
  };
}

export function parseProcess(raw: unknown): ProcessLog | null {
  if (raw === null || raw === undefined) return null;
  if (!isObj(raw)) throw new Error('process.json이 객체가 아닙니다.');
  if (!Array.isArray(raw.runs)) throw new Error('process.json에 runs 배열이 없습니다.');
  return {brief: str(raw.brief) ?? 'prompt.md', audio: str(raw.audio), runs: raw.runs.map(parseRun)};
}

export function parseAudio(raw: unknown): AudioSpec | null {
  if (raw === null || raw === undefined) return null;
  if (!isObj(raw)) throw new Error('audio.json이 객체가 아닙니다.');
  const sections = Array.isArray(raw.sections) ? raw.sections.flatMap(item => isObj(item) && num(item.from) !== undefined && num(item.to) !== undefined ? [{from: item.from as number, to: item.to as number, energy: num(item.energy) ?? 0.5, label: str(item.label) ?? ''}] : []) : [];
  // A hit is a number of seconds or an object {at, weight?, style?}; the timeline only needs the second.
  const hits = Array.isArray(raw.hits) ? raw.hits.map(item => typeof item === 'number' ? item : item && typeof item === 'object' && typeof (item as {at?: unknown}).at === 'number' ? (item as {at: number}).at : NaN).filter(item => Number.isFinite(item)) : [];
  const sfx = Array.isArray(raw.sfx) ? raw.sfx.flatMap(item => isObj(item) && typeof item.name === 'string' ? [item.name] : typeof item === 'string' ? [item] : []) : [];
  const loudness = isObj(raw.loudness) && num(raw.loudness.I) !== undefined && num(raw.loudness.TP) !== undefined ? {I: raw.loudness.I as number, TP: raw.loudness.TP as number} : undefined;
  return {mood: str(raw.mood), bpm: num(raw.bpm), key: str(raw.key), seed: num(raw.seed), sections, hits, sfx, loudness};
}

export function parseOverrides(raw: unknown): Overrides {
  if (raw === null || raw === undefined) return {};
  if (!isObj(raw)) throw new Error('overrides.json이 평평한 객체가 아닙니다.');
  const out: Overrides = {};
  for (const [key, value] of Object.entries(raw)) if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') out[key] = value;
  return out;
}

export function parseProject(raw: unknown): Project {
  if (!isObj(raw) || !Array.isArray(raw.compositions)) throw new Error('서버 응답 형식이 맞지 않습니다.');
  return {
    root: str(raw.root) ?? '', entry: str(raw.entry) ?? '',
    compositions: raw.compositions.flatMap(item => {
      if (!isObj(item) || typeof item.id !== 'string') return [];
      const files = isObj(item.files) ? item.files : {};
      const file = (key: string) => str(files[key]) ?? null;
      return [{
        id: item.id, folder: str(item.folder) ?? null, title: str(item.title) ?? null,
        files: {spot: file('spot'), brief: file('brief'), audio: file('audio'), process: file('process'), overrides: file('overrides')},
        brief: str(item.brief) ?? null,
        audio: loaded(item.audio, parseAudio), process: loaded(item.process, parseProcess), overrides: loaded(item.overrides, parseOverrides),
        importedResults: isObj(item.importedResults) ? item.importedResults as ImportedResults : null,
      }];
    }),
  };
}

/** Version per run: the count of author/fix runs up to and including it (3.3). */
export function versions(runs: Run[]): number[] {
  let version = 0;
  return runs.map(run => (run.kind === 'author' || run.kind === 'fix' ? ++version : version));
}
export const currentVersion = (runs: Run[]): number => versions(runs).at(-1) ?? 0;

/** Maps a request or finding id to the version of the first later fix that resolves it. */
export function resolutions(runs: Run[]): Map<string, number> {
  const out = new Map<string, number>();
  const vs = versions(runs);
  runs.forEach((run, index) => {
    if (run.kind === 'fix') for (const id of run.resolves ?? []) if (!out.has(id)) out.set(id, vs[index]!);
  });
  return out;
}
export const openRequests = (runs: Run[]): Run[] => {
  const resolved = resolutions(runs);
  return runs.filter(run => run.kind === 'request' && !resolved.has(run.id));
};

const COLOR = /^#[0-9A-F]{6}$/;
export function parseVariables(raw: unknown): Variable[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  return raw.flatMap((item): Variable[] => {
    if (!isObj(item) || typeof item.key !== 'string' || typeof item.label !== 'string' || seen.has(item.key)) return [];
    seen.add(item.key);
    const base: Base = {key: item.key, label: item.label, group: str(item.group), preview: int(item.preview), help: str(item.help)};
    const d = item.default;
    switch (item.type) {
      case 'string': return typeof d === 'string' ? [{...base, type: 'string', default: d, maxLength: int(item.maxLength) ?? 120, multiline: item.multiline === true}] : [];
      case 'color': return typeof d === 'string' ? [{...base, type: 'color', default: d.toUpperCase()}] : [];
      case 'number': {
        const [min, max, step] = [num(item.min), num(item.max), num(item.step)];
        if (typeof d !== 'number' || min === undefined || max === undefined || step === undefined) return [];
        const unit = ['frames', 'px', '%', 'x'].includes(item.unit as string) ? item.unit as 'frames' : undefined;
        return [{...base, type: 'number', default: d, min, max, step, unit}];
      }
      case 'enum': {
        const options = Array.isArray(item.options) ? item.options.flatMap(option => isObj(option) && typeof option.value === 'string' ? [{value: option.value, label: str(option.label) ?? option.value}] : []) : [];
        return typeof d === 'string' && options.length >= 2 ? [{...base, type: 'enum', default: d, options}] : [];
      }
      case 'boolean': return typeof d === 'boolean' ? [{...base, type: 'boolean', default: d}] : [];
      case 'audioVolume': return typeof d === 'number' ? [{...base, type: 'audioVolume', default: d}] : [];
      default: return [];
    }
  });
}

/** True when the value fits the variable's declared type and range. */
export function valueFits(variable: Variable, value: unknown): boolean {
  switch (variable.type) {
    case 'string': return typeof value === 'string' && value.length <= variable.maxLength;
    case 'color': return typeof value === 'string' && COLOR.test(value);
    case 'number': return typeof value === 'number' && value >= variable.min && value <= variable.max;
    case 'enum': return variable.options.some(option => option.value === value);
    case 'boolean': return typeof value === 'boolean';
    case 'audioVolume': return typeof value === 'number' && value >= 0 && value <= 1;
  }
}

/** Splits saved overrides into usable values and warnings for unknown keys or mistyped values (4.2). */
export function applicableOverrides(variables: Variable[], overrides: Overrides): {values: Overrides; ignored: string[]} {
  const values: Overrides = {};
  const ignored: string[] = [];
  for (const [key, value] of Object.entries(overrides)) {
    const variable = variables.find(item => item.key === key);
    if (variable && valueFits(variable, value)) values[key] = value;
    else ignored.push(key);
  }
  return {values, ignored};
}

export function formatValue(variable: Variable, value: unknown): string {
  if (variable.type === 'string') return `'${String(value)}'`;
  if (variable.type === 'number' && variable.unit === 'frames') return `${String(value).replace('-', '−')} 프레임`;
  if (variable.type === 'enum') return variable.options.find(option => option.value === value)?.label ?? String(value);
  if (variable.type === 'boolean') return value ? '켬' : '끔';
  return String(value).replace('-', '−');
}

/** "강조색 #FF5A36 → #F0532F" lines for the fix run a save appends (4.3). */
export function describeChanges(variables: Variable[], before: Overrides, after: Overrides): string[] {
  return variables.flatMap(variable => {
    const from = before[variable.key] ?? variable.default;
    const to = after[variable.key] ?? variable.default;
    return from === to ? [] : [`${variable.label} ${formatValue(variable, from)} → ${formatValue(variable, to)}`];
  });
}

/** Overrides minus default-equal values (4.2: only differing keys are stored). */
export function minimalOverrides(variables: Variable[], values: Overrides): Overrides {
  const out: Overrides = {};
  for (const variable of variables) {
    const value = values[variable.key];
    if (value !== undefined && value !== variable.default) out[variable.key] = value;
  }
  return out;
}

export function latestCheck(runs: Run[]): {run: Run; version: number; renderVersion: number} | null {
  const vs = versions(runs);
  for (let index = runs.length - 1; index >= 0; index--) {
    const run = runs[index]!;
    if (run.kind !== 'check') continue;
    const of = run.metrics?.of;
    const renderIndex = runs.findIndex(item => item.id === of);
    return {run, version: vs[index]!, renderVersion: renderIndex >= 0 ? vs[renderIndex]! : vs[index]!};
  }
  return null;
}

export type CheckName = 'clip' | 'flash' | 'frame' | 'loudness' | 'colorSpace';
/** Reads a check run's metrics or imported results into the five result lines (5.1). */
export function checkLines(metrics: Record<string, unknown> | null, imported: ImportedResults | null): Record<CheckName, CheckLine> {
  const none: CheckLine = {pass: null, summary: '기록 없음'};
  const m = metrics ?? {};
  const flash = isObj(m.flash) ? m.flash : imported?.flash;
  const frame = isObj(m.frame) ? m.frame : undefined;
  const loud = isObj(m.loudness) ? m.loudness : imported?.loudness;
  const color = isObj(m.colorSpace) ? m.colorSpace : imported?.colorSpace ? {pass: imported.colorSpace === 'bt709', value: imported.colorSpace} : undefined;
  const fails = frame && Array.isArray(frame.fails) ? frame.fails.filter((item): item is string => typeof item === 'string') : [];
  const firstFail = fails[0] ? /(\d+)-(\d+)/.exec(fails[0]) : null;
  const target = isObj(loud) && isObj((loud as Obj).target) ? (loud as Obj).target as Obj : {I: -24, TP: -2};
  const lufs = isObj(loud) ? num((loud as Obj).I) : undefined;
  const tp = isObj(loud) ? num((loud as Obj).TP) : undefined;
  return {
    clip: metrics || imported ? {pass: true, summary: '렌더 중 0곳'} : none,
    flash: isObj(flash) ? {pass: flash.pass === true, summary: `최악 1초 ${num(flash.worstSecondTransitions) ?? '?'}회 / 허용 6`, frame: int((flash as Obj).worstSecondStartFrame)} : none,
    frame: frame ? {pass: frame.pass === true, summary: frame.pass === true ? '빈 구간, 긴 정지 없음' : fails.join(' · '), frame: firstFail ? Number(firstFail[1]) : undefined} : none,
    loudness: lufs !== undefined ? {pass: isObj(loud) && typeof (loud as Obj).pass === 'boolean' ? (loud as Obj).pass as boolean : Math.abs(lufs - (num(target.I) ?? -24)) <= 2 && (tp ?? 0) <= (num(target.TP) ?? -2), summary: `${lufs.toFixed(1).replace('-', '−')} LKFS · TP ${tp?.toFixed(1).replace('-', '−') ?? '?'}`} : none,
    colorSpace: isObj(color) ? {pass: color.pass === true, summary: color.pass === true ? String(color.value) : '색 태그 없음. 디코드하면 색이 어두워집니다'} : none,
  };
}
