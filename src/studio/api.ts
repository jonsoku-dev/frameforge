import {parseProject, parseRun, type Artifact, type Overrides, type Project, type Run} from './model';

export class ApiError extends Error {
  constructor(readonly status: number, message: string, readonly detail?: string) { super(message); }
}

async function call(path: string, init?: RequestInit): Promise<unknown> {
  let response: Response;
  try { response = await fetch(path, init); } catch { throw new ApiError(0, '서버 정보를 읽지 못했습니다.'); }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const record = typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : {};
    throw new ApiError(response.status, typeof record.fault === 'string' ? record.fault : '서버 정보를 읽지 못했습니다.', typeof record.detail === 'string' ? record.detail : undefined);
  }
  return payload;
}
const post = (path: string, body: unknown) => call(path, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(body)});
const runOrNull = (value: unknown): Run | null => (value ? parseRun(value, 0) : null);

export type JobInfo = {id: string; state: string; kind: 'mp4' | 'sheet'; compositionId: string; position: number; rendered: number; total: number; stage: string; startedAt: number | null; log: string[]; final: {event: string; data: unknown} | null};

export const api = {
  async project(): Promise<{project: Project; jobs: JobInfo[]}> {
    const raw = await call('/api/project') as {jobs?: JobInfo[]};
    return {project: parseProject(raw), jobs: Array.isArray(raw.jobs) ? raw.jobs : []};
  },
  async file(path: string): Promise<{path: string; text: string}> {
    return await call(`/api/file?path=${encodeURIComponent(path)}`) as {path: string; text: string};
  },
  media: (path: string) => `/api/media?path=${encodeURIComponent(path)}`,
  async saveOverrides(compositionId: string, values: Overrides, changes: string[]): Promise<{overrides: Overrides; run: Run | null; fault?: string}> {
    const raw = await post('/api/overrides', {compositionId, values, changes}) as {overrides: Overrides; run: unknown; fault?: string};
    return {overrides: raw.overrides, run: runOrNull(raw.run), fault: raw.fault};
  },
  async request(compositionId: string, text: string, frame: number | null): Promise<Run | null> {
    const raw = await post('/api/request', {compositionId, text, frame}) as {run: unknown};
    return runOrNull(raw.run);
  },
  async render(compositionId: string, kind: 'mp4' | 'sheet', frames?: number[]): Promise<{jobId: string; position: number}> {
    return await post('/api/render', {compositionId, kind, frames}) as {jobId: string; position: number};
  },
};

export type JobEvent =
  | {event: 'snapshot'; data: {state: string; kind: 'mp4' | 'sheet'; compositionId: string; position: number; rendered: number; total: number; stage: string; startedAt: number | null; log: string[]}}
  | {event: 'queued'; data: {position: number}}
  | {event: 'stage'; data: {stage: string}}
  | {event: 'progress'; data: {rendered: number; total: number}}
  | {event: 'check'; data: {name: string; pass: boolean; summary: string}}
  | {event: 'done'; data: {artifact: Artifact; runId: string | null; checkRunId?: string}}
  | {event: 'failed'; data: {fault: string; detail: string; frame?: number}}
  | {event: 'log'; data: {line: string}}
  | {event: 'gone'; data: null};

/** Subscribes to a render job's SSE stream (7.4). A 404 on connect means the server restarted and the job is gone. */
export function watchJob(jobId: string, onEvent: (event: JobEvent) => void): () => void {
  const source = new EventSource(`/api/render/${encodeURIComponent(jobId)}/events`);
  let finished = false;
  for (const name of ['snapshot', 'queued', 'stage', 'progress', 'check', 'done', 'failed', 'log'] as const) {
    source.addEventListener(name, message => {
      const data: unknown = JSON.parse((message as MessageEvent<string>).data);
      onEvent({event: name, data} as JobEvent);
      if (name === 'done' || name === 'failed') { finished = true; source.close(); }
    });
  }
  // A non-200 reply (404 after a server restart) closes the source; a dropped connection retries on its own.
  source.onerror = () => {
    if (!finished && source.readyState === EventSource.CLOSED) onEvent({event: 'gone', data: null});
  };
  return () => source.close();
}
