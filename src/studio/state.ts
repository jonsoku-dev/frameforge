import type {Overrides} from './model';

export type Tab = 'brief' | 'process' | 'tune' | 'output';
export const TABS: {id: Tab; label: string}[] = [{id: 'brief', label: '기획'}, {id: 'process', label: '과정'}, {id: 'tune', label: '조정'}, {id: 'output', label: '출력'}];
export type Drawer =
  | {kind: 'file'; path: string}
  | {kind: 'sheet'; path: string; frames?: number[]}
  | {kind: 'video'; path: string}
  | {kind: 'help'};
export type Desk = {
  id: string; frame: number; playing: boolean; tab: Tab; selectedRun: string | null;
  safe: boolean; zoom: 'fit' | 'full'; railOpen: boolean; inspectorOpen: boolean;
  drafts: Record<string, Overrides>; drawer: Drawer | null;
};
export type DeskEvent =
  | {type: 'pick'; id: string; frame?: number}
  | {type: 'toggle'; restart: boolean}
  | {type: 'step'; delta: number; last: number}
  | {type: 'seek'; frame: number; last: number}
  | {type: 'tick'; frame: number}
  | {type: 'end'; last: number}
  | {type: 'tab'; tab: Tab}
  | {type: 'select-run'; runId: string | null}
  | {type: 'safe'}
  | {type: 'zoom'}
  | {type: 'rail'; open?: boolean}
  | {type: 'inspector'; open?: boolean}
  | {type: 'draft'; id: string; key: string; value: string | number | boolean | undefined}
  | {type: 'draft-clear'; id: string}
  | {type: 'drawer'; drawer: Drawer | null};

export function reduceDesk(desk: Desk, event: DeskEvent): Desk {
  switch (event.type) {
    case 'pick':
      return event.id === desk.id && event.frame === undefined ? desk : {...desk, id: event.id, frame: event.frame ?? 0, playing: false, selectedRun: null, drawer: null};
    case 'toggle':
      if (desk.playing) return {...desk, playing: false};
      return {...desk, playing: true, frame: event.restart ? 0 : desk.frame};
    case 'step':
      return {...desk, playing: false, frame: Math.min(event.last, Math.max(0, desk.frame + event.delta))};
    case 'seek':
      return {...desk, playing: false, frame: Math.min(event.last, Math.max(0, Math.round(event.frame)))};
    case 'tick':
      if (!desk.playing || event.frame === desk.frame) return desk;
      return {...desk, frame: event.frame};
    case 'end':
      return {...desk, playing: false, frame: event.last};
    case 'tab':
      return {...desk, tab: event.tab, inspectorOpen: true};
    case 'select-run':
      return {...desk, selectedRun: event.runId};
    case 'safe':
      return {...desk, safe: !desk.safe};
    case 'zoom':
      return {...desk, zoom: desk.zoom === 'fit' ? 'full' : 'fit'};
    case 'rail':
      return {...desk, railOpen: event.open ?? !desk.railOpen};
    case 'inspector':
      return {...desk, inspectorOpen: event.open ?? !desk.inspectorOpen};
    case 'draft': {
      const draft = {...desk.drafts[event.id]};
      if (event.value === undefined) delete draft[event.key];
      else draft[event.key] = event.value;
      return {...desk, drafts: {...desk.drafts, [event.id]: draft}};
    }
    case 'draft-clear': {
      const drafts = {...desk.drafts};
      delete drafts[event.id];
      return {...desk, drafts};
    }
    case 'drawer':
      return {...desk, drawer: event.drawer};
    default: {
      const unhandled: never = event;
      return unhandled;
    }
  }
}

export const storage = {
  get(key: string): string | null {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set(key: string, value: string | null) {
    try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* private mode: preferences stay per session */ }
  },
};

/** "#/KitLaunch@410" (2.10). */
export function readHash(hash: string): {id: string; frame: number} | null {
  const match = /^#\/([A-Za-z][A-Za-z0-9-]*)(?:@(\d+))?$/.exec(hash);
  return match ? {id: match[1]!, frame: Number(match[2] ?? 0)} : null;
}

/** m:ss:ff — frames, not fractional seconds (2.9). */
export function timecode(frame: number, fps: number): string {
  const whole = Math.max(0, Math.floor(frame / fps));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}:${String(Math.max(0, frame) % fps).padStart(2, '0')}`;
}

export function lengthLabel(frames: number, fps: number): string {
  const seconds = frames / fps;
  return `${Number.isInteger(seconds) ? seconds : seconds.toFixed(1)}초`;
}

export function when(at: string, now = new Date()): string {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return at;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (date.toDateString() === now.toDateString()) {
    const minutes = Math.round((now.getTime() - date.getTime()) / 60000);
    if (minutes < 1) return '방금';
    if (minutes < 60) return `${minutes}분 전`;
    return `${Math.floor(minutes / 60)}시간 전`;
  }
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Backs useBufferState in the studio: each delayPlayback() adds one open block, its unblock() removes it once. */
export function playbackBlocker(change: (delta: 1 | -1) => void): {delayPlayback: () => {unblock: () => void}} {
  return {delayPlayback: () => {
    let open = true;
    change(1);
    return {unblock: () => { if (open) { open = false; change(-1); } }};
  }};
}
