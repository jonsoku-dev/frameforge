import type {ServerResponse} from 'node:http';
import {existsSync} from 'node:fs';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {exec, runChecks, type CheckResult} from './checks.ts';

export type RenderKind = 'mp4' | 'sheet';
export type Stage = 'queued' | 'audio' | 'frames' | 'encoding' | 'checks' | 'done' | 'failed';
type Event = {event: string; data: unknown};
export type Job = {
  id: string; kind: RenderKind; compositionId: string; folder: string | null; frames?: number[]; fps: number;
  state: 'queued' | 'running' | 'done' | 'failed'; stage: Stage; rendered: number; total: number;
  startedAt: number | null; finishedAt: number | null; log: string[]; clients: Set<ServerResponse>; final: Event | null;
};
type RenderMedia = (options: {serveUrl: string; composition: string; outputLocation: string; inputProps?: Record<string, unknown>; frames?: number[]; onProgress?: (progress: {renderedFrames: number; totalFrames: number}) => void}) => Promise<unknown>;
type ProcessModule = Record<string, unknown>;

const RENDER_PORT = 4318;
/** The engine checkout (scripts, vite.config.ts); `root` below is the project whose films and renders the studio shows. */
const ENGINE = fileURLToPath(new URL('../../../', import.meta.url));
const KEEP_MS = 10 * 60 * 1000;
const jobs = new Map<string, Job>();
const queue: Job[] = [];
let running: Job | null = null;
let serial = 0;

export function faultInKorean(error: unknown, frame?: number): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('Clipped text')) return frame === undefined ? '글자가 잘려 렌더를 멈췄습니다.' : `프레임 ${frame}에서 글자가 잘려 멈췄습니다.`;
  if (message.includes('CHROME_PATH') || message.includes('Chrome') || message.includes('Chromium')) return 'Chrome을 찾지 못해 렌더하지 못했습니다.';
  if (message.includes('EADDRINUSE') || message.includes('4318')) return '렌더 포트 4318을 다른 렌더가 쓰고 있습니다. CLI 렌더가 끝난 뒤 다시 시도해 주세요.';
  if (message.includes('Output already exists')) return '같은 이름의 결과가 이미 있어서 렌더하지 못했습니다.';
  if (message.includes('Unknown composition')) return '고른 컴포지션을 찾지 못해 렌더하지 못했습니다.';
  if (message.includes('Audio')) return '소리 파일을 만들지 못해 렌더하지 못했습니다.';
  if (message.toLowerCase().includes('ffmpeg')) return '영상 파일을 만들지 못했습니다.';
  return '렌더하지 못했습니다.';
}

/** Appends a run through scripts/process.mjs, the single writer of process.json (3.7). */
export async function appendRun(root: string, folder: string, run: Record<string, unknown>): Promise<Record<string, unknown>> {
  const file = join(ENGINE, 'scripts/process.mjs');
  if (!existsSync(file)) throw new Error('scripts/process.mjs가 없어 기록하지 못했습니다.');
  const module = await import(`${pathToFileURL(file).href}?v=${Date.now()}`) as ProcessModule;
  const append = (module.appendRun ?? module.append) as ((folder: string, run: Record<string, unknown>) => Promise<Record<string, unknown>>) | undefined;
  if (typeof append !== 'function') throw new Error('scripts/process.mjs에 덧붙이기 함수가 없습니다.');
  return append(join(root, folder), run);
}

export async function versionOf(root: string, folder: string | null): Promise<number> {
  if (!folder) return 1;
  try {
    const log = JSON.parse(await readFile(join(root, folder, 'process.json'), 'utf8')) as {runs?: {kind?: string}[]};
    return Math.max(1, (log.runs ?? []).filter(run => run.kind === 'author' || run.kind === 'fix').length);
  } catch { return 1; }
}

const stamp = (date: Date) => [date.getFullYear(), date.getMonth() + 1, date.getDate()].map(n => String(n).padStart(2, '0')).join('') + '-' + [date.getHours(), date.getMinutes(), date.getSeconds()].map(n => String(n).padStart(2, '0')).join('');

function send(job: Job, event: string, data: unknown) {
  const text = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of job.clients) client.write(text);
}
function log(job: Job, line: string) {
  job.log.push(line);
  if (job.log.length > 200) job.log.splice(0, job.log.length - 200);
  send(job, 'log', {line});
}
function stage(job: Job, next: Stage) {
  job.stage = next;
  send(job, 'stage', {stage: next});
}
function finish(job: Job, event: string, data: unknown) {
  job.state = event === 'done' ? 'done' : 'failed';
  job.stage = job.state;
  job.finishedAt = Date.now();
  job.final = {event, data};
  send(job, event, data);
  setTimeout(() => jobs.delete(job.id), KEEP_MS).unref();
}

export const snapshot = (job: Job) => ({
  state: job.state, kind: job.kind, compositionId: job.compositionId, position: queue.indexOf(job) + 1,
  rendered: job.rendered, total: job.total, stage: job.stage, startedAt: job.startedAt, log: job.log.slice(-20),
});

export function subscribe(jobId: string, res: ServerResponse): boolean {
  const job = jobs.get(jobId);
  if (!job) return false;
  res.writeHead(200, {'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache', connection: 'keep-alive'});
  res.write(`event: snapshot\ndata: ${JSON.stringify(snapshot(job))}\n\n`);
  if (job.final) res.write(`event: ${job.final.event}\ndata: ${JSON.stringify(job.final.data)}\n\n`);
  job.clients.add(res);
  res.on('close', () => job.clients.delete(res));
  return true;
}

export function listJobs() {
  return [...jobs.values()].map(job => ({id: job.id, ...snapshot(job), final: job.final}));
}

export type JobSpec = Pick<Job, 'kind' | 'compositionId' | 'folder' | 'frames' | 'fps' | 'total'>;

export function enqueue(spec: JobSpec, root: string): {jobId: string; position: number} {
  const job: Job = {...spec, id: `j${Date.now().toString(36)}${++serial}`, state: 'queued', stage: 'queued', rendered: 0, startedAt: null, finishedAt: null, log: [], clients: new Set(), final: null};
  jobs.set(job.id, job);
  queue.push(job);
  const position = running ? queue.length : 0;
  void pump(root);
  return {jobId: job.id, position};
}

async function pump(root: string) {
  if (running) return;
  const job = queue.shift();
  if (!job) return;
  running = job;
  queue.forEach((waiting, index) => send(waiting, 'queued', {position: index + 1}));
  try { await execute(job, root); }
  finally {
    running = null;
    void pump(root);
  }
}

async function readJson(file: string): Promise<Record<string, unknown> | null> {
  try { return JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>; } catch { return null; }
}

async function execute(job: Job, root: string) {
  job.state = 'running';
  job.startedAt = Date.now();
  send(job, 'snapshot', snapshot(job));
  const version = await versionOf(root, job.folder);
  const slug = job.folder ? job.folder.split('/').pop()! : job.compositionId.toLowerCase();
  const outputRel = `renders/studio/${slug}/${stamp(new Date())}-v${version}.${job.kind === 'mp4' ? 'mp4' : 'png'}`;
  const output = join(root, outputRel);
  const overrides = job.folder ? (await readJson(join(root, job.folder, 'overrides.json'))) ?? {} : {};
  const audio = job.folder ? await readJson(join(root, job.folder, 'audio.json')) : null;
  const target = audio && typeof audio.loudness === 'object' && audio.loudness ? audio.loudness as {I: number; TP: number} : {I: -24, TP: -2};
  let server: {listen: () => Promise<unknown>; close: () => Promise<void>} | null = null;
  const began = performance.now();
  const wanted = job.frames;
  try {
    if (job.folder && job.kind === 'mp4' && existsSync(join(root, job.folder, 'audio.json'))) {
      stage(job, 'audio');
      const score = await exec('python3', [join(ENGINE, 'scripts/assets/score.py'), join(root, job.folder, 'audio.json')], ENGINE, line => log(job, line));
      log(job, score.stdout.trim() || `score.py exited ${score.code}`);
      if (score.code !== 0) throw new Error(`Audio generation failed: ${score.stderr.trim().split('\n').pop()}`);
    }
    stage(job, 'frames');
    const {createServer} = await import('vite');
    server = await createServer({root: ENGINE, configFile: join(ENGINE, 'vite.config.ts'), logLevel: 'error', server: {host: '127.0.0.1', port: RENDER_PORT, strictPort: true, hmr: false}});
    await server.listen();
    log(job, `렌더 서버 http://127.0.0.1:${RENDER_PORT}`);
    const renderer = await import(pathToFileURL(join(ENGINE, 'scripts/render.mjs')).href) as {renderMedia: RenderMedia};
    let lastSent = 0;
    await mkdir(resolve(output, '..'), {recursive: true});
    await renderer.renderMedia({
      serveUrl: `http://127.0.0.1:${RENDER_PORT}`, composition: job.compositionId, outputLocation: output, inputProps: overrides, frames: wanted,
      onProgress: ({renderedFrames, totalFrames}) => {
        job.rendered = renderedFrames;
        job.total = totalFrames;
        const now = Date.now();
        if (now - lastSent >= 100 || renderedFrames === totalFrames) { lastSent = now; send(job, 'progress', {rendered: renderedFrames, total: totalFrames}); }
        if (renderedFrames === totalFrames) stage(job, 'encoding');
      },
    });
    await server.close();
    server = null;
    const seconds = Math.round((performance.now() - began) / 1000);
    log(job, `${outputRel} ${seconds}초`);
    const artifact = job.kind === 'mp4' ? {kind: 'mp4', path: outputRel} : {kind: 'sheet', path: outputRel, frames: wanted};
    let runId: string | null = null, checkRunId: string | undefined;
    if (job.folder) {
      try {
        const run = await appendRun(root, job.folder, {actor: 'script', kind: 'render', summary: job.kind === 'mp4' ? `MP4 ${job.total}프레임, ${seconds}초` : `시트 ${wanted?.length ?? 0}장, ${seconds}초`, artifacts: [artifact], metrics: {seconds, frames: job.total, overrides}});
        runId = typeof run.id === 'string' ? run.id : null;
      } catch (error) { log(job, `기록 실패: ${error instanceof Error ? error.message : String(error)}`); }
    }
    if (job.kind === 'mp4') {
      stage(job, 'checks');
      const results = await runChecks(ENGINE, output, job.fps, target, line => log(job, line), (result: CheckResult) => send(job, 'check', {name: result.name, pass: result.pass, summary: result.summary}));
      const logRel = outputRel.replace(/\.mp4$/, '.checks.json');
      await writeFile(join(root, logRel), JSON.stringify(Object.fromEntries(results.map(result => [result.name, {...result.metrics, raw: result.raw}])), null, 1));
      if (job.folder && runId) {
        try {
          const run = await appendRun(root, job.folder, {actor: 'script', kind: 'check', summary: results.map(result => `${result.name} ${result.pass ? '통과' : '실패'}`).join(', '), artifacts: [{kind: 'log', path: logRel}], metrics: {of: runId, ...Object.fromEntries(results.map(result => [result.name, result.metrics]))}});
          checkRunId = typeof run.id === 'string' ? run.id : undefined;
        } catch (error) { log(job, `기록 실패: ${error instanceof Error ? error.message : String(error)}`); }
      }
    }
    finish(job, 'done', {artifact, runId, ...(checkRunId ? {checkRunId} : {})});
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const clipped = detail.includes('Clipped text');
    const frame = clipped ? (wanted ? wanted[job.rendered] : job.rendered) : undefined;
    log(job, detail);
    finish(job, 'failed', {fault: faultInKorean(error, frame), detail, ...(frame === undefined ? {} : {frame})});
  } finally {
    await server?.close().catch(() => {});
  }
}
