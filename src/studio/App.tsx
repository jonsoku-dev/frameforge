import React, {useCallback, useEffect, useMemo, useReducer, useRef, useState} from 'react';
import {CircleHelp, Clapperboard} from 'lucide-react';
import {renderToStaticMarkup} from 'react-dom/server';
import {BufferContext, FrameProvider, collectAudio, collectFrameHints, collectMotion, collectSoundMaps, deriveSoundEvents, mapSoundEvents, setSampling, type AudioClip, type DerivedClip, type MotionSample, type ResolvedComposition, type SoundMap} from '../core/index';
import {Button} from '@/components/ui/button';
import {cn} from '@/lib/utils';
import {api, watchJob, type JobEvent, type JobInfo} from './api';
import {checkFrames, sceneBands} from './brief';
import {applicableOverrides, checkLines, currentVersion, describeChanges, latestCheck, minimalOverrides, openRequests, parseVariables, valueFits, type CompositionEntry, type Overrides, type Project} from './model';
import {definitions, info} from './runtime';
import {playbackBlocker, readHash, reduceDesk, storage, TABS, type Desk, type Tab} from './state';
import {Rail, type RailItem} from './Rail';
import {editorLink, StageView, type Editor} from './StageView';
import {Timeline, type Mark, type Tick} from './Timeline';
import type {ClippedText} from './textGuard';
import {BriefTab} from './inspector/BriefTab';
import {Empty, Inspector} from './inspector/Inspector';
import {OutputTab, RENDER_BUTTON, type JobView} from './inspector/OutputTab';
import {ProcessTab} from './inspector/ProcessTab';
import {REQUEST_FIELD, RequestComposer} from './inspector/RequestComposer';
import {TuneTab} from './inspector/TuneTab';

type Loaded = {status: 'loading'} | {status: 'ok'; project: Project} | {status: 'error'; message: string};
type Link = 'connected' | 'reconnecting' | 'off';

const draftKey = (id: string) => `frameforge:draft:${id}`;
const wideQuery = '(min-width: 1600px)', midQuery = '(min-width: 1280px)', minQuery = '(min-width: 1024px)';
const matches = (query: string) => typeof window.matchMedia === 'function' && window.matchMedia(query).matches;

function initialDesk(): Desk {
  const ids = [...definitions.keys()];
  const hash = readHash(window.location.hash);
  const id = hash && definitions.has(hash.id) ? hash.id : ids[0]!;
  const frame = hash && hash.id === id ? Math.min(hash.frame, definitions.get(id)!.durationInFrames - 1) : 0;
  const tab = storage.get('frameforge:tab') as Tab | null;
  const drafts: Record<string, Overrides> = {};
  for (const item of ids) {
    try { const raw = storage.get(draftKey(item)); if (raw) drafts[item] = JSON.parse(raw) as Overrides; } catch { /* a corrupt draft is dropped */ }
  }
  const railPref = storage.get('frameforge:rail');
  return {
    id, frame, playing: false, tab: TABS.some(item => item.id === tab) ? tab! : 'process', selectedRun: null, safe: false, zoom: 'fit',
    railOpen: matches(wideQuery) ? railPref !== 'closed' : false, inspectorOpen: matches(midQuery), drafts, drawer: null,
  };
}

function applyJobEvent(job: JobView, event: JobEvent): JobView {
  switch (event.event) {
    case 'snapshot': return {...job, kind: event.data.kind, state: event.data.state === 'running' ? 'running' : event.data.state === 'queued' ? 'queued' : job.state, stage: event.data.stage, position: event.data.position, rendered: event.data.rendered, total: event.data.total, startedAt: event.data.startedAt, log: event.data.log};
    case 'queued': return {...job, state: 'queued', position: event.data.position};
    case 'stage': return {...job, state: 'running', stage: event.data.stage, startedAt: job.startedAt ?? Date.now()};
    case 'progress': return {...job, state: 'running', rendered: event.data.rendered, total: event.data.total};
    case 'check': return {...job, checks: [...job.checks, event.data]};
    case 'log': return {...job, log: [...job.log.slice(-40), event.data.line]};
    case 'done': return {...job, state: 'done', stage: 'done', artifact: event.data.artifact, endedAt: Date.now()};
    case 'failed': return {...job, state: 'failed', stage: 'failed', fault: event.data, endedAt: Date.now()};
    case 'gone': return {...job, state: 'gone', endedAt: Date.now()};
  }
}

const shortActor = (actor: string) => actor === 'human' ? '사람' : actor.replace(/\s*\([^)]*\)$/, '').split(' ').pop()!;
const typing = (target: EventTarget | null) => target instanceof HTMLElement && Boolean(target.closest('input, textarea, select, [contenteditable="true"], [role="slider"]'));

export function App() {
  const [desk, dispatch] = useReducer(reduceDesk, undefined, initialDesk);
  const [loaded, setLoaded] = useState<Loaded>({status: 'loading'});
  const [jobs, setJobs] = useState<Record<string, JobView>>({});
  const [clipped, setClipped] = useState<ClippedText[]>([]);
  const [reflect, setReflect] = useState<number | null>(null);
  const [link, setLink] = useState<Link>('connected');
  const [editor, setEditor] = useState<Editor>(() => storage.get('frameforge:editor') === 'cursor' ? 'cursor' : 'vscode');
  const [audioPrefs, setAudioPrefs] = useState({muted: false, volume: 1});
  const [audioBlocked, setAudioBlocked] = useState(false);
  // Sounds the engine derives from the composition's motion: sampled without a DOM in chunks when the composition changes.
  const [derived, setDerived] = useState<DerivedClip[]>([]);
  const [saveState, setSaveState] = useState<{saving: boolean; fault: string | null; savedAt: number | null}>({saving: false, fault: null, savedAt: null});
  const [layout, setLayout] = useState(() => ({wide: matches(wideQuery), mid: matches(midQuery), min: matches(minQuery)}));
  const [copied, setCopied] = useState(false);
  const [blocks, setBlocks] = useState(0);
  const buffer = useMemo(() => playbackBlocker(delta => setBlocks(count => count + delta)), []);
  const deskRef = useRef(desk);
  deskRef.current = desk;
  const pendingEdit = useRef<number | null>(null);
  const players = useRef(new Map<string, HTMLAudioElement>());
  // Derived motion sounds carry a pan; a StereoPanner per element applies it (the graph is created on the first play, a user gesture).
  const graph = useRef<{context: AudioContext; panners: Map<HTMLAudioElement, StereoPannerNode>} | null>(null);
  const panOf = (element: HTMLAudioElement, pan: number) => {
    if (typeof AudioContext === 'undefined') return;
    graph.current ??= {context: new AudioContext(), panners: new Map()};
    const {context, panners} = graph.current;
    let node = panners.get(element);
    if (!node) { node = context.createStereoPanner(); context.createMediaElementSource(element).connect(node).connect(context.destination); panners.set(element, node); }
    node.pan.value = pan;
    if (context.state === 'suspended') void context.resume();
  };
  const watching = useRef(new Map<string, () => void>());

  const infos = useMemo(() => [...definitions.values()].map(info), []);
  const base: ResolvedComposition = definitions.get(desk.id) ?? definitions.values().next().value!;
  const last = base.durationInFrames - 1;
  const project = loaded.status === 'ok' ? loaded.project : null;
  const entryOf = useCallback((id: string): CompositionEntry | null => project?.compositions.find(item => item.id === id) ?? null, [project]);
  const entry = entryOf(base.id);
  const runs = entry && 'value' in entry.process && entry.process.value ? entry.process.value.runs : [];
  const variables = useMemo(() => parseVariables((base as {variables?: unknown}).variables), [base]);
  const savedRaw = entry && 'value' in entry.overrides ? entry.overrides.value : {};
  const {values: saved, ignored} = useMemo(() => applicableOverrides(variables, savedRaw), [variables, savedRaw]);
  const draft = desk.drafts[base.id] ?? {};
  const values = useMemo(() => ({...saved, ...draft}), [saved, draft]);
  const unsavedKeys = Object.keys(draft).filter(key => draft[key] !== (saved[key] ?? variables.find(item => item.key === key)?.default));
  const valuesKey = JSON.stringify(values);
  // Preview path of 4.2: overrides and draft go straight into this composition's props; the root input stays untouched.
  const composition = useMemo(() => variables.length ? {...base, props: {...base.props, ...values}} : base, [base, variables.length, valuesKey]);

  const load = useCallback(() => {
    api.project().then(({project: next, jobs: serverJobs}) => {
      setLoaded({status: 'ok', project: next});
      for (const job of serverJobs) if (!job.final && !watching.current.has(job.id)) follow(job);
    }, (error: Error) => setLoaded(previous => previous.status === 'ok' ? previous : {status: 'error', message: error.message}));
  }, []);

  const follow = (job: Pick<JobInfo, 'id' | 'compositionId' | 'kind'> & Partial<JobInfo>) => {
    setJobs(previous => ({...previous, [job.id]: {id: job.id, compositionId: job.compositionId, kind: job.kind, state: job.position ? 'queued' : 'running', stage: job.stage ?? 'queued', position: job.position ?? 0, rendered: job.rendered ?? 0, total: job.total ?? 0, startedAt: job.startedAt ?? null, log: job.log ?? [], checks: []}}));
    watching.current.set(job.id, watchJob(job.id, event => {
      setJobs(previous => previous[job.id] ? {...previous, [job.id]: applyJobEvent(previous[job.id]!, event)} : previous);
      if (event.event === 'done' || event.event === 'failed' || event.event === 'gone') { watching.current.delete(job.id); load(); }
    }));
  };

  useEffect(() => {
    load();
    const hot = import.meta.hot;
    if (!hot) return;
    let offTimer: ReturnType<typeof setTimeout> | undefined;
    const onProject = () => load();
    const onDisconnect = () => { setLink('reconnecting'); offTimer = setTimeout(() => setLink('off'), 10000); };
    const onConnect = () => { clearTimeout(offTimer); setLink('connected'); load(); };
    hot.on('frameforge:project', onProject);
    hot.on('vite:ws:disconnect', onDisconnect);
    hot.on('vite:ws:connect', onConnect);
    return () => { hot.off('frameforge:project', onProject); hot.off('vite:ws:disconnect', onDisconnect); hot.off('vite:ws:connect', onConnect); };
  }, [load]);
  useEffect(() => () => { for (const stop of watching.current.values()) stop(); }, []);

  useEffect(() => {
    const queries = [wideQuery, midQuery, minQuery].map(query => window.matchMedia(query));
    const update = () => {
      setLayout({wide: queries[0]!.matches, mid: queries[1]!.matches, min: queries[2]!.matches});
      dispatch({type: 'rail', open: queries[0]!.matches && storage.get('frameforge:rail') !== 'closed'});
      dispatch({type: 'inspector', open: queries[1]!.matches});
    };
    for (const query of queries) query.addEventListener('change', update);
    return () => { for (const query of queries) query.removeEventListener('change', update); };
  }, []);

  useEffect(() => { storage.set('frameforge:tab', desk.tab); }, [desk.tab]);
  useEffect(() => { storage.set('frameforge:editor', editor); }, [editor]);
  useEffect(() => { for (const id of definitions.keys()) { const value = desk.drafts[id]; storage.set(draftKey(id), value && Object.keys(value).length ? JSON.stringify(value) : null); } }, [desk.drafts]);
  useEffect(() => {
    if (desk.playing) return;
    const hash = `#/${desk.id}@${desk.frame}`;
    if (window.location.hash !== hash) history.replaceState(null, '', hash);
  }, [desk.id, desk.frame, desk.playing]);
  useEffect(() => {
    const onHash = () => { const hash = readHash(window.location.hash); if (hash && definitions.has(hash.id)) dispatch({type: 'pick', id: hash.id, frame: hash.frame}); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    if (reflect === null) return;
    const timer = setTimeout(() => setReflect(null), 3000);
    return () => clearTimeout(timer);
  }, [reflect]);

  useEffect(() => {
    // An open useBufferState block holds the frame; playback resumes from it once every block is released.
    if (!desk.playing || blocks > 0) return;
    const began = performance.now();
    const initial = desk.frame;
    const duration = base.durationInFrames;
    const fps = base.fps;
    let handle = 0;
    const tick = (now: number) => {
      const next = initial + Math.floor((now - began) * fps / 1000);
      if (next >= duration) {
        dispatch({type: 'end', last: duration - 1});
        return;
      }
      dispatch({type: 'tick', frame: next});
      handle = requestAnimationFrame(tick);
    };
    handle = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(handle);
  }, [desk.playing, blocks > 0, base.durationInFrames, base.fps]);

  const audioRef = useRef(audioPrefs);
  audioRef.current = audioPrefs;
  useEffect(() => {
    let cancelled = false;
    const samples: MotionSample[] = [];
    let maps: SoundMap[] = [];
    const total = composition.durationInFrames;
    setDerived([]);
    const chunk = (from: number) => {
      if (cancelled) return;
      setSampling(true);
      try {
        for (let frame = from; frame < Math.min(total, from + 60); frame++) {
          try { renderToStaticMarkup(<FrameProvider frame={frame} config={composition}><composition.component {...composition.props} /></FrameProvider>); } catch { /* the stage reports composition errors; sampling only listens */ }
          samples.push(...collectMotion());
          const declared = collectSoundMaps();
          if (declared.length) maps = declared;
          collectAudio(); collectFrameHints();
        }
      } finally { setSampling(false); }
      if (from + 60 < total) setTimeout(() => chunk(from + 60), 0);
      else if (maps.length) setDerived(mapSoundEvents(deriveSoundEvents(samples), maps, composition.fps));
    };
    const timer = setTimeout(() => chunk(0), 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [composition]);
  const syncAudio = (rendered: AudioClip[]) => {
    const {playing, frame} = deskRef.current;
    const span = composition.fps * 3;
    const clips: (AudioClip & {pan?: number})[] = [...rendered, ...derived.filter(clip => frame >= clip.startFrame && frame < clip.startFrame + span).map(clip => ({key: clip.key, src: clip.src, volume: clip.volume, trimBefore: 0, startFrame: clip.startFrame, pan: clip.pan}))];
    const live = new Map(playing ? clips.map(clip => [clip.key, clip]) : []);
    for (const clip of clips) if (!players.current.has(clip.key)) players.current.set(clip.key, new Audio(clip.src));
    for (const [key, element] of players.current) {
      const clip = live.get(key);
      if (!clip) { if (!element.paused) element.pause(); continue; }
      const rate = (clip as AudioClip & {playbackRate?: number}).playbackRate ?? 1;
      const expected = (clip.trimBefore + (frame - clip.startFrame) * rate) / base.fps;
      if (element.playbackRate !== rate) element.playbackRate = rate;
      // The renderer ducks the music under effects; the studio approximates it by dipping root clips while any effect plays.
      const ducked = clip.startFrame === 0 && [...live.values()].some(other => other.startFrame > 0) ? 0.6 : 1;
      element.volume = audioRef.current.muted ? 0 : clip.volume * audioRef.current.volume * ducked;
      if (clip.pan !== undefined) panOf(element, clip.pan);
      // A clip shorter than its Sequence window ends early; play() on an ended element restarts it from 0, stacking repeats.
      if (element.ended || (Number.isFinite(element.duration) && expected >= element.duration - 0.02)) { if (!element.paused) element.pause(); continue; }
      if (!element.paused && Math.abs(element.currentTime - expected) <= 0.08) continue;
      element.currentTime = expected;
      if (element.paused) element.play().then(() => setAudioBlocked(false), (error: Error) => { if (error.name === 'NotAllowedError') setAudioBlocked(true); });
    }
  };
  const onCommit = () => {
    const began = pendingEdit.current;
    if (began === null) return;
    pendingEdit.current = null;
    requestAnimationFrame(() => setReflect(performance.now() - began));
  };

  const seek = (frame: number) => dispatch({type: 'seek', frame, last});
  const pick = (id: string) => { dispatch({type: 'pick', id}); setClipped([]); };
  const spotPath = entry?.files.spot ?? null;
  const fileLink = (path: string) => project ? editorLink(editor, project.root, path) : null;

  const onVariable = (key: string, value: string | number | boolean | undefined, timeStamp: number) => {
    pendingEdit.current = timeStamp;
    const variable = variables.find(item => item.key === key);
    const savedValue = saved[key] ?? variable?.default;
    dispatch({type: 'draft', id: base.id, key, value: value === savedValue ? undefined : value});
  };
  const save = async (): Promise<boolean> => {
    if (!entry?.folder || !variables.length) return false;
    const fitting: Overrides = {};
    for (const variable of variables) { const value = values[variable.key]; if (value !== undefined && valueFits(variable, value)) fitting[variable.key] = value; }
    const next = minimalOverrides(variables, fitting);
    setSaveState({saving: true, fault: null, savedAt: null});
    try {
      const result = await api.saveOverrides(base.id, next, describeChanges(variables, saved, next));
      dispatch({type: 'draft-clear', id: base.id});
      setSaveState({saving: false, fault: result.fault ?? null, savedAt: Date.now()});
      load();
      return true;
    } catch (error) {
      setSaveState({saving: false, fault: error instanceof Error ? error.message : '저장하지 못했습니다.', savedAt: null});
      return false;
    }
  };
  const render = async (kind: 'mp4' | 'sheet', frames?: number[]) => {
    try {
      const {jobId, position} = await api.render(base.id, kind, frames);
      follow({id: jobId, compositionId: base.id, kind, position});
    } catch (error) {
      const id = `local-${Date.now()}`;
      setJobs(previous => ({...previous, [id]: {id, compositionId: base.id, kind, state: 'failed', stage: 'failed', position: 0, rendered: 0, total: 0, startedAt: null, log: [], checks: [], fault: {fault: error instanceof Error ? error.message : '렌더를 시작하지 못했습니다.', detail: ''}, endedAt: Date.now()}}));
    }
  };

  const bands = useMemo(() => sceneBands(entry?.brief ?? null), [entry?.brief]);
  const audioSpec = entry && 'value' in entry.audio ? entry.audio.value : null;
  const sheetRun = (desk.selectedRun ? runs.find(run => run.id === desk.selectedRun && run.artifacts.some(item => item.frames?.length)) : undefined)
    ?? [...runs].reverse().find(run => run.artifacts.some(item => (item.kind === 'sheet' || item.kind === 'still') && item.frames?.length));
  const sheetArtifact = sheetRun?.artifacts.find(item => (item.kind === 'sheet' || item.kind === 'still') && item.frames?.length);
  const sheetFrames = sheetArtifact?.frames ?? [];
  const ticks: Tick[] = [
    ...sheetFrames.map((frame, index): Tick => ({frame, kind: 'sheet', label: `시트 타일 ${index + 1} · 프레임 ${frame}`, tile: {src: api.media(sheetArtifact!.path), index, columns: Math.min(4, sheetFrames.length), tileHeight: Math.round(480 * base.height / base.width)}})),
    ...runs.filter(run => run.kind === 'request' && run.frame !== undefined).map((run): Tick => ({frame: run.frame!, kind: 'request', label: `요청 · 프레임 ${run.frame} · ${run.summary}`})),
  ];
  const latest = latestCheck(runs);
  const marks: Mark[] = [];
  const metrics = latest?.run.metrics;
  if (metrics) {
    const frameCheck = metrics.frame as {emptyRanges?: {from: number; to: number}[]; staticRuns?: {from: number; to: number; frames: number}[]} | undefined;
    for (const range of frameCheck?.emptyRanges ?? []) marks.push({frame: range.from, to: range.to, kind: 'empty', label: `빈 구간 ${range.from}–${range.to}`});
    for (const range of frameCheck?.staticRuns ?? []) marks.push({frame: range.from, to: range.to, kind: range.frames > 60 ? 'fail-static' : 'static', label: `정지 ${range.from}–${range.to} (${range.frames}f)`});
    const flash = metrics.flash as {pass?: boolean; worstSecondStartFrame?: number; worstSecondTransitions?: number} | undefined;
    if (flash && flash.pass === false && flash.worstSecondStartFrame !== undefined) marks.push({frame: flash.worstSecondStartFrame, to: flash.worstSecondStartFrame + base.fps - 1, kind: 'flash', label: `플래시 최악 1초 ${flash.worstSecondStartFrame}–${flash.worstSecondStartFrame + base.fps - 1} 전환 ${flash.worstSecondTransitions}회`});
  }
  for (const job of Object.values(jobs)) if (job.compositionId === base.id && job.fault?.frame !== undefined) marks.push({frame: job.fault.frame, kind: 'clip', label: `프레임 ${job.fault.frame}에서 글자 잘림으로 렌더 멈춤`});

  const keysRef = useRef<(event: KeyboardEvent) => void>(() => {});
  keysRef.current = (event: KeyboardEvent) => {
    const meta = event.metaKey || event.ctrlKey;
    if (meta && event.key.toLowerCase() === 's') { event.preventDefault(); void save(); return; }
    if (event.key === 'Escape') {
      if (desk.drawer) dispatch({type: 'drawer', drawer: null});
      else if (!layout.mid && desk.inspectorOpen) dispatch({type: 'inspector', open: false});
      if (document.activeElement instanceof HTMLElement && typing(document.activeElement)) document.activeElement.blur();
      return;
    }
    if (meta || event.altKey || typing(event.target)) return;
    const onButton = event.target instanceof HTMLElement && Boolean(event.target.closest('button, a, [role="tab"], [role="option"]'));
    const band = (direction: 1 | -1) => {
      const starts = [...new Set(bands.map(item => item.from))].sort((a, b) => a - b);
      const target = direction > 0 ? starts.find(start => start > desk.frame) : starts.filter(start => start < desk.frame).at(-1);
      if (target !== undefined) seek(target);
    };
    const tile = (direction: 1 | -1) => {
      const sorted = [...sheetFrames].sort((a, b) => a - b);
      const target = direction > 0 ? sorted.find(frame => frame > desk.frame) : sorted.filter(frame => frame < desk.frame).at(-1);
      if (target !== undefined) seek(target);
    };
    const focusLater = (id: string) => setTimeout(() => document.getElementById(id)?.focus(), 0);
    const actions: Record<string, () => void> = {
      ' ': () => { if (!onButton) dispatch({type: 'toggle', restart: desk.frame >= last}); },
      ArrowRight: () => dispatch({type: 'step', delta: event.shiftKey ? 10 : 1, last}),
      ArrowLeft: () => dispatch({type: 'step', delta: event.shiftKey ? -10 : -1, last}),
      Home: () => seek(0), End: () => seek(last),
      '[': () => band(-1), ']': () => band(1), ',': () => tile(-1), '.': () => tile(1),
      '1': () => dispatch({type: 'tab', tab: 'brief'}), '2': () => dispatch({type: 'tab', tab: 'process'}), '3': () => dispatch({type: 'tab', tab: 'tune'}), '4': () => dispatch({type: 'tab', tab: 'output'}),
      i: () => dispatch({type: 'inspector'}),
      '\\': () => { dispatch({type: 'rail'}); if (layout.wide) storage.set('frameforge:rail', desk.railOpen ? 'closed' : 'open'); },
      g: () => dispatch({type: 'safe'}), f: () => dispatch({type: 'zoom'}),
      c: () => { dispatch({type: 'tab', tab: 'process'}); focusLater(REQUEST_FIELD); },
      e: () => { const href = spotPath && fileLink(spotPath); if (href) window.location.href = href; },
      r: () => { dispatch({type: 'tab', tab: 'output'}); focusLater(RENDER_BUTTON); },
      '?': () => dispatch({type: 'drawer', drawer: {kind: 'help'}}),
    };
    const action = actions[event.key.length === 1 ? event.key.toLowerCase() : event.key] ?? actions[event.key];
    if (!action || ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && onButton && event.target instanceof HTMLElement && event.target.closest('[role="tab"], [role="option"]'))) return;
    event.preventDefault();
    action();
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => keysRef.current(event);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const railItems: RailItem[] = infos.map(item => {
    const itemEntry = entryOf(item.id);
    const itemRuns = itemEntry && 'value' in itemEntry.process && itemEntry.process.value ? itemEntry.process.value.runs : [];
    const version = currentVersion(itemRuns);
    const check = latestCheck(itemRuns);
    let state: RailItem['check'] = 'none';
    if (check) {
      const lines = Object.values(checkLines(check.run.metrics ?? {}, null));
      state = check.renderVersion < version ? 'stale' : lines.some(line => line.pass === false) ? 'fail' : 'pass';
    } else if (itemEntry?.importedResults) state = Object.values(checkLines(null, itemEntry.importedResults)).some(line => line.pass === false) ? 'fail' : 'pass';
    const sheet = [...itemRuns].reverse().flatMap(run => run.artifacts).find(artifact => artifact.kind === 'sheet');
    const job = Object.values(jobs).find(candidate => candidate.compositionId === item.id && candidate.state === 'running');
    const itemDraft = desk.drafts[item.id];
    return {
      info: item, title: itemEntry?.title ?? item.id, actor: itemRuns.find(run => run.kind === 'author') ? shortActor(itemRuns.find(run => run.kind === 'author')!.actor) : null,
      version, openRequests: openRequests(itemRuns).length, unsaved: Boolean(itemDraft && Object.keys(itemDraft).length), check: state,
      progress: job && job.total ? job.rendered / job.total : null, thumb: sheet ? {src: api.media(sheet.path)} : null,
    };
  });

  const activeJob = Object.values(jobs).find(job => job.state === 'running');
  const recentFail = Object.values(jobs).find(job => job.state === 'failed' && job.endedAt && Date.now() - job.endedAt < 5000);
  useEffect(() => {
    if (!recentFail) return;
    const timer = setTimeout(() => setJobs(previous => ({...previous})), 5100);
    return () => clearTimeout(timer);
  }, [recentFail]);
  const compositionJobs = Object.values(jobs).filter(job => job.compositionId === base.id && (job.state !== 'done' || !entry?.folder));
  const variableLabel = (key: string) => variables.find(item => item.key === key)?.label ?? key;
  const draftLines = unsavedKeys.map(key => `${variableLabel(key)}: ${String(draft[key])}`);
  const title = entry?.title ?? base.id;
  const version = currentVersion(runs);

  const needsFolder = desk.tab !== 'output';
  let panel: React.ReactNode;
  if (loaded.status === 'error' || (loaded.status === 'ok' && !entry && needsFolder)) panel = <Empty><p>서버 정보를 읽지 못했습니다.</p><Button size="sm" variant="secondary" className="mt-2" onClick={load}>다시 시도</Button></Empty>;
  else if (loaded.status === 'loading') panel = <Empty>불러오는 중</Empty>;
  else if (needsFolder && !entry?.folder) panel = <Empty>이 컴포지션은 폴더가 없어 기획, 과정, 조정을 쓸 수 없습니다. 출력은 됩니다.</Empty>;
  else if (desk.tab === 'brief') panel = <BriefTab entry={entry!} link={fileLink} />;
  else if (desk.tab === 'process') panel = <ProcessTab log={entry!.process} folder={entry!.folder!} processPath={entry!.files.process ?? `${entry!.folder}/process.json`} link={fileLink}
    selectedRun={desk.selectedRun} aspect={base.width / base.height} onSelect={runId => dispatch({type: 'select-run', runId})} onSeek={seek} onDrawer={drawer => dispatch({type: 'drawer', drawer})} onOutput={() => dispatch({type: 'tab', tab: 'output'})}
    composer={<RequestComposer key={base.id} compositionId={base.id} frame={desk.frame} duration={base.durationInFrames} draftLines={draftLines} onSent={load} />} />;
  else if (desk.tab === 'tune') panel = <TuneTab variables={variables} saved={saved} values={values} unsaved={unsavedKeys.length} ignored={ignored} fps={base.fps} rendering={Boolean(activeJob)} saveState={saveState}
    spotLink={spotPath ? fileLink(spotPath) : null} onChange={onVariable} onPreview={frame => seek(frame)} onSave={() => { void save(); }} onRevert={() => dispatch({type: 'draft-clear', id: base.id})} />;
  else panel = <OutputTab key={base.id} info={info(base)} runs={runs} imported={entry?.importedResults ?? null} initialFrames={checkFrames(entry?.brief ?? null, base.durationInFrames)} frame={desk.frame} clippedNow={clipped.length} unsaved={unsavedKeys.length} jobs={compositionJobs}
    onRender={(kind, frames) => { void render(kind, frames); }} onSaveAndRender={() => { void save().then(ok => { if (ok) void render('mp4'); }); }} onSeek={seek} onDrawer={drawer => dispatch({type: 'drawer', drawer})} onTune={() => dispatch({type: 'tab', tab: 'tune'})} />;

  const linkDot = {connected: ['bg-pass', '연결됨'], reconnecting: ['bg-warn', '다시 연결하는 중'], off: ['bg-fail', '서버 꺼짐']}[link];
  return <div className="studio" data-rail={desk.railOpen ? 'open' : 'closed'} data-inspector={desk.inspectorOpen ? 'open' : 'closed'}>
    <header className="area-bar flex min-w-0 items-center gap-4 border-b border-border bg-panel px-3">
      <a className="flex shrink-0 items-center gap-2 text-[15px] font-bold" href="/" aria-label="frameforge"><Clapperboard className="size-5" aria-hidden="true" />frameforge</a>
      <button type="button" className="mono min-w-0 truncate text-muted-foreground hover:text-foreground" title="경로 복사" onClick={() => { void navigator.clipboard?.writeText(project?.entry ?? __VIDEO_ENTRY__); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{project?.entry ?? __VIDEO_ENTRY__}{copied ? ' · 복사함' : ''}</button>
      {!layout.min ? <span className="shrink-0 text-[12px] text-warn">1024 px 이상에서 모든 패널이 보입니다</span> : null}
      <span className="ml-auto flex shrink-0 items-center gap-1.5 text-[12px] text-muted-foreground" role="status"><span className={cn('size-2 rounded-full', linkDot[0])} aria-hidden="true" />{linkDot[1]}</span>
      {activeJob ? <button type="button" className="flex shrink-0 items-center gap-2 text-[12px] tnum" onClick={() => { pick(activeJob.compositionId); dispatch({type: 'tab', tab: 'output'}); }} data-render-indicator>
        렌더 {activeJob.rendered}/{activeJob.total}<span className="h-1 w-20 overflow-hidden rounded-full bg-raised"><span className="block h-full bg-primary transition-[width] duration-[120ms] ease-linear" style={{width: `${activeJob.total ? activeJob.rendered / activeJob.total * 100 : 0}%`}} /></span>
      </button> : recentFail ? <button type="button" className="shrink-0 text-[12px] text-fail" role="alert" onClick={() => { pick(recentFail.compositionId); dispatch({type: 'tab', tab: 'output'}); }}>렌더 실패</button> : null}
      <Button size="icon" variant="ghost" aria-label="단축키 (?)" title="단축키 (?)" onClick={() => dispatch({type: 'drawer', drawer: {kind: 'help'}})}><CircleHelp aria-hidden="true" /></Button>
    </header>
    <Rail items={railItems} selected={base.id} expanded={desk.railOpen} loading={loaded.status === 'loading'} onPick={id => { pick(id); if (!layout.wide) dispatch({type: 'rail', open: false}); }} onToggle={() => { dispatch({type: 'rail'}); if (layout.wide) storage.set('frameforge:rail', desk.railOpen ? 'closed' : 'open'); }} />
    <BufferContext.Provider value={buffer}><StageView title={title} composition={composition} version={version} frame={desk.frame} safe={desk.safe} zoom={desk.zoom} clipped={clipped} reflectMs={reflect}
      root={project?.root ?? null} editor={editor} onEditor={setEditor}
      files={[{label: 'Spot.tsx', path: spotPath}, {label: 'prompt.md', path: entry?.files.brief ?? null}, {label: 'audio.json', path: entry?.files.audio ?? null}, {label: 'process.json', path: entry?.files.process ?? null}, {label: 'overrides.json', path: entry?.files.overrides ?? null}]}
      onSafe={() => dispatch({type: 'safe'})} onZoom={() => dispatch({type: 'zoom'})} onClipped={setClipped} onAudio={syncAudio} onCommit={onCommit} /></BufferContext.Provider>
    {desk.inspectorOpen ? <Inspector tab={desk.tab} onTab={tab => dispatch({type: 'tab', tab})} drawer={desk.drawer} onDrawer={drawer => dispatch({type: 'drawer', drawer})} onSeek={seek}>{panel}</Inspector> : null}
    <Timeline fps={base.fps} duration={base.durationInFrames} frame={desk.frame} playing={desk.playing} bands={bands} audio={audioSpec} marks={marks} ticks={ticks}
      muted={audioPrefs.muted} volume={audioPrefs.volume} audioBlocked={audioBlocked}
      onSeek={seek} onToggle={() => dispatch({type: 'toggle', restart: desk.frame >= last})} onStep={delta => dispatch({type: 'step', delta, last})} onHome={() => seek(0)} onEnd={() => seek(last)}
      onMute={() => { setAudioBlocked(false); setAudioPrefs(previous => ({...previous, muted: audioBlocked ? false : !previous.muted})); }} onVolume={volume => setAudioPrefs(previous => ({...previous, volume, muted: false}))} />
  </div>;
}

