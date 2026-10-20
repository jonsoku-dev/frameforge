import type {Plugin} from 'vite';
import type {IncomingMessage, ServerResponse} from 'node:http';
import {createReadStream, existsSync} from 'node:fs';
import {readdir, readFile, rename, writeFile} from 'node:fs/promises';
import {basename, dirname, join, relative, resolve, sep} from 'node:path';
import {COMPOSITION_ID, Fault, fromLoopback, ownOrigin, safePath, sameOriginOk} from './paths.ts';
import {appendRun, enqueue, listJobs, subscribe} from './jobs.ts';

type Json = Record<string, unknown>;
type Loaded = {value: unknown} | {error: string};
type Known = {id: string; fps: number; durationInFrames: number; folder: string | null};

const FILE_EXTENSIONS = ['.md', '.json', '.tsx', '.ts', '.mjs', '.txt', '.log'];
const MEDIA_TYPES: Record<string, string> = {'.png': 'image/png', '.mp4': 'video/mp4', '.wav': 'audio/wav'};
const WATCHED = new Set(['process.json', 'overrides.json', 'prompt.md', 'audio.json']);
const KEY = /^[a-zA-Z][a-zA-Z0-9]*$/;

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      reject(error instanceof Error ? error : new Error('body'));
    };
    const succeed = (value: unknown) => {
      if (settled) return;
      settled = true;
      resolveBody(value);
    };
    req.on('data', (chunk: Buffer | string) => {
      const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
      size += buffer.length;
      if (size > 10000) {
        fail(new Error('body'));
        req.destroy();
        return;
      }
      chunks.push(buffer);
    });
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      if (!text) {
        succeed(null);
        return;
      }
      try { succeed(JSON.parse(text) as unknown); }
      catch (error) { fail(error); }
    });
    req.on('error', fail);
  });
}

const isObj = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);

function reply(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function jsonError(text: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const position = /position (\d+)/.exec(message);
  if (!position) return message;
  const before = text.slice(0, Number(position[1]));
  const line = before.split('\n').length;
  return `${line}번째 줄 ${before.length - before.lastIndexOf('\n')}열: ${message}`;
}

async function loadJson(file: string, missing: unknown): Promise<Loaded> {
  let text: string;
  try { text = await readFile(file, 'utf8'); } catch { return {value: missing}; }
  try { return {value: JSON.parse(text) as unknown}; } catch (error) { return {error: jsonError(text, error)}; }
}

/** Composition ids, fps, and duration read from the entry's <Composition> tags; folders from sibling `<dir>/entry.tsx` files (7.3). */
async function catalog(root: string, entry: string): Promise<Known[]> {
  const entryFile = resolve(root, entry);
  const tags = (text: string) => [...text.matchAll(/<(?:Composition|Still)\b([^>]*?)\/?>/g)].flatMap(match => {
    const attrs = match[1] ?? '';
    const id = /\bid=["']([^"']+)["']/.exec(attrs)?.[1];
    if (!id) return [];
    const number = (name: string, fallback: number) => Number(new RegExp(`\\b${name}=\\{(\\d+)\\}`).exec(attrs)?.[1] ?? fallback);
    return [{id, fps: number('fps', 30), durationInFrames: number('durationInFrames', 1)}];
  });
  const text = await readFile(entryFile, 'utf8');
  const folderOf = new Map<string, string>();
  const entryDir = dirname(entryFile);
  if (basename(entryFile) === 'entry.tsx') for (const tag of tags(text)) folderOf.set(tag.id, relative(root, entryDir));
  else for (const item of await readdir(entryDir, {withFileTypes: true})) {
    if (!item.isDirectory()) continue;
    const sub = join(entryDir, item.name, 'entry.tsx');
    if (!existsSync(sub)) continue;
    for (const tag of tags(await readFile(sub, 'utf8'))) folderOf.set(tag.id, relative(root, join(entryDir, item.name)));
  }
  return tags(text).map(tag => ({...tag, folder: folderOf.get(tag.id)?.split(sep).join('/') ?? null}));
}

async function describe(root: string, known: Known, results: Json | null) {
  const {id, folder} = known;
  if (!folder) return {id, folder: null, title: null, files: {spot: null, brief: null, audio: null, process: null, overrides: null}, brief: null, audio: {value: null}, process: {value: null}, overrides: {value: {}}, importedResults: null};
  const path = (name: string) => existsSync(join(root, folder, name)) ? `${folder}/${name}` : null;
  const brief = await readFile(join(root, folder, 'prompt.md'), 'utf8').catch(() => null);
  const process = await loadJson(join(root, folder, 'process.json'), null);
  const hasCheck = 'value' in process && isObj(process.value) && Array.isArray(process.value.runs) && process.value.runs.some(run => isObj(run) && run.kind === 'check');
  const slug = folder.split('/').pop()!;
  const imported = !hasCheck && results && isObj(results[slug]) ? results[slug] as Json : null;
  const colorSpace = imported && Array.isArray(imported.ffprobe) ? /color_space=([a-z0-9]+)/.exec(String(imported.ffprobe[0]))?.[1] : undefined;
  return {
    id, folder,
    title: brief ? (/^#\s+(.+)$/m.exec(brief)?.[1]?.trim() ?? null) : null,
    files: {spot: path('Spot.tsx'), brief: path('prompt.md'), audio: path('audio.json'), process: path('process.json'), overrides: path('overrides.json')},
    brief,
    audio: await loadJson(join(root, folder, 'audio.json'), null),
    process,
    overrides: await loadJson(join(root, folder, 'overrides.json'), {}),
    importedResults: imported && (imported.flash || imported.loudness || colorSpace) ? {flash: imported.flash, loudness: imported.loudness, ...(colorSpace ? {colorSpace} : {})} : null,
  };
}

async function writeAtomic(file: string, text: string) {
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temp, text);
  await rename(temp, file);
}

const sameValues = (a: Json, b: Json) => {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => Object.is(a[key], b[key]));
};

export function studioApi(root: string, entryInput: string): Plugin {
  const entry = relative(root, resolve(root, entryInput)).split(sep).join('/');
  const known = async (id: unknown): Promise<Known> => {
    if (typeof id !== 'string' || !COMPOSITION_ID.test(id)) throw new Fault(400, '컴포지션 ID 형식이 맞지 않습니다.');
    const item = (await catalog(root, entry)).find(candidate => candidate.id === id);
    if (!item) throw new Fault(400, '모르는 컴포지션입니다.');
    return item;
  };
  const withFolder = async (id: unknown): Promise<Known & {folder: string}> => {
    const item = await known(id);
    if (!item.folder) throw new Fault(404, '이 컴포지션은 폴더가 없습니다.');
    return item as Known & {folder: string};
  };
  const body = async (req: IncomingMessage): Promise<Json> => {
    const value = await readBody(req).catch(() => { throw new Fault(400, '요청 본문을 읽지 못했습니다.'); });
    if (!isObj(value)) throw new Fault(400, '요청 본문이 객체가 아닙니다.');
    return value;
  };

  async function handle(req: IncomingMessage, res: ServerResponse, next: () => void) {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const route = `${req.method} ${url.pathname}`;
    if (route === 'GET /project') {
      const results = await loadJson(join(root, 'renders/samples/results.json'), null);
      let items: Known[];
      try { items = await catalog(root, entry); } catch (error) { throw new Fault(500, '진입 파일을 읽지 못했습니다.', String(error)); }
      return reply(res, 200, {root, entry, compositions: await Promise.all(items.map(item => describe(root, item, 'value' in results && isObj(results.value) ? results.value : null))), jobs: listJobs()});
    }
    if (route === 'GET /file') {
      const found = await safePath(root, url.searchParams.get('path'), FILE_EXTENSIONS, 1024 * 1024);
      return reply(res, 200, {path: found.relative, text: await readFile(found.file, 'utf8'), mtime: found.mtime});
    }
    if (route === 'GET /media') {
      const found = await safePath(root, url.searchParams.get('path'), Object.keys(MEDIA_TYPES), Number.MAX_SAFE_INTEGER);
      const type = MEDIA_TYPES[found.file.slice(found.file.lastIndexOf('.')).toLowerCase()]!;
      const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
      res.setHeader('content-type', type);
      res.setHeader('accept-ranges', 'bytes');
      if (range && (range[1] || range[2])) {
        const start = range[1] ? Number(range[1]) : Math.max(0, found.size - Number(range[2]));
        const end = range[1] && range[2] ? Math.min(Number(range[2]), found.size - 1) : found.size - 1;
        if (start > end || start >= found.size) { res.statusCode = 416; res.setHeader('content-range', `bytes */${found.size}`); return res.end(); }
        res.statusCode = 206;
        res.setHeader('content-range', `bytes ${start}-${end}/${found.size}`);
        res.setHeader('content-length', String(end - start + 1));
        return createReadStream(found.file, {start, end}).pipe(res);
      }
      res.setHeader('content-length', String(found.size));
      return createReadStream(found.file).pipe(res);
    }
    if (route === 'POST /overrides') {
      const input = await body(req);
      const {folder} = await withFolder(input.compositionId);
      const values = input.values;
      if (!isObj(values) || Object.keys(values).length > 64 || Object.entries(values).some(([key, value]) => !KEY.test(key) || !['string', 'number', 'boolean'].includes(typeof value) || (typeof value === 'number' && !Number.isFinite(value)))) throw new Fault(400, '덮어쓰기 값은 원시 값만 담은 평평한 객체여야 합니다.');
      const changes = Array.isArray(input.changes) ? input.changes.filter((item): item is string => typeof item === 'string').slice(0, 64).map(item => item.slice(0, 300)) : [];
      const file = join(root, folder, 'overrides.json');
      const saved = await loadJson(file, {});
      if ('value' in saved && isObj(saved.value) && sameValues(saved.value, values)) return reply(res, 200, {overrides: saved.value, run: null});
      // shortcut: overrides.json and the fix run are written under separate locks; a crash between them loses the run. Upgrade when process.mjs exports its lock.
      await writeAtomic(file, `${JSON.stringify(values, null, 2)}\n`);
      try {
        const run = await appendRun(root, folder, {actor: 'human', kind: 'fix', summary: changes.length ? `값 조정 ${changes.length}개` : '덮어쓰기 저장', changes});
        return reply(res, 200, {overrides: values, run});
      } catch (error) {
        return reply(res, 200, {overrides: values, run: null, fault: '값은 저장했지만 과정 기록을 남기지 못했습니다.', detail: String(error)});
      }
    }
    if (route === 'POST /request') {
      const input = await body(req);
      const item = await withFolder(input.compositionId);
      const text = typeof input.text === 'string' ? input.text.trim() : '';
      if (!text) throw new Fault(400, '요청 문장이 비어 있습니다.');
      if (text.length > 2000) throw new Fault(400, '요청은 2000자까지 쓸 수 있습니다.');
      const frame = input.frame;
      if (frame !== null && frame !== undefined && (!Number.isInteger(frame) || (frame as number) < 0 || (frame as number) >= item.durationInFrames)) throw new Fault(400, '프레임이 범위 밖입니다.');
      const summary = text.split('\n')[0]!.slice(0, 300);
      try {
        const run = await appendRun(root, item.folder, {actor: 'human', kind: 'request', ...(typeof frame === 'number' ? {frame} : {}), prompt: {text}, summary, artifacts: []});
        return reply(res, 200, {run});
      } catch (error) { throw new Fault(500, '요청을 기록하지 못했습니다.', String(error)); }
    }
    if (route === 'POST /render') {
      const input = await body(req);
      const item = await known(input.compositionId);
      if (input.kind !== 'mp4' && input.kind !== 'sheet') throw new Fault(400, '렌더 종류는 mp4 또는 sheet입니다.');
      let frames: number[] | undefined;
      if (input.kind === 'sheet') {
        const raw = input.frames;
        if (!Array.isArray(raw) || raw.length < 1 || raw.length > 40 || raw.some(frame => !Number.isInteger(frame) || frame < 0 || frame >= item.durationInFrames)) throw new Fault(400, '시트 프레임은 범위 안의 정수 1–40개여야 합니다.');
        frames = [...new Set(raw as number[])].sort((a, b) => a - b);
      }
      return reply(res, 200, enqueue({kind: input.kind, compositionId: item.id, folder: item.folder, frames, fps: item.fps, total: frames?.length ?? item.durationInFrames}, root));
    }
    if (route === 'GET /render') return reply(res, 200, {jobs: listJobs()});
    const events = /^\/render\/([A-Za-z0-9]+)\/events$/.exec(url.pathname);
    if (req.method === 'GET' && events) {
      if (!subscribe(events[1]!, res)) throw new Fault(404, '모르는 렌더 작업입니다. 서버가 다시 시작되었을 수 있습니다.');
      return;
    }
    next();
  }

  return {
    name: 'studio-api',
    configureServer(server) {
      server.middlewares.use('/api', (req, res, next) => {
        if (!fromLoopback(req) || !ownOrigin(req) || !sameOriginOk(req)) return reply(res, 403, {fault: '이 요청은 허용하지 않습니다.'});
        handle(req, res, next).catch((error: unknown) => {
          if (res.headersSent) return void res.end();
          if (error instanceof Fault) return reply(res, error.status, {fault: error.message, ...(error.detail ? {detail: error.detail} : {})});
          reply(res, 500, {fault: '서버에서 요청을 처리하지 못했습니다.', detail: String(error)});
        });
      });
      if (server.config.server.hmr === false) return;
      const entryDir = dirname(resolve(root, entry));
      server.watcher.add(entryDir);
      const notify = (file: string) => {
        if (!WATCHED.has(basename(file)) || !file.startsWith(entryDir)) return;
        server.ws.send({type: 'custom', event: 'frameforge:project', data: {folder: relative(root, dirname(file)).split(sep).join('/')}});
      };
      for (const event of ['add', 'change', 'unlink'] as const) server.watcher.on(event, notify);
    },
  };
}
