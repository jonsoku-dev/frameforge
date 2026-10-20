import type {IncomingMessage} from 'node:http';
import {realpath, stat} from 'node:fs/promises';
import {extname, isAbsolute, resolve, sep} from 'node:path';

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

export class Fault extends Error {
  constructor(readonly status: number, message: string, readonly detail?: string) { super(message); }
}

export const fromLoopback = (req: IncomingMessage): boolean => LOOPBACK.has(req.socket.remoteAddress ?? '');

/** The server's own origin from a loopback Host header, or null when Host names anything else (DNS rebinding). */
export function ownOrigin(req: IncomingMessage): string | null {
  const host = req.headers.host?.split(',')[0]?.trim();
  if (!host) return null;
  try {
    const url = new URL(`http://${host}`);
    return LOOPBACK_HOSTS.has(url.hostname) ? url.origin : null;
  } catch { return null; }
}

/** Every POST needs a same-origin Origin and a JSON body; a GET is checked only when it carries Origin (7.1). */
export function sameOriginOk(req: IncomingMessage): boolean {
  const origin = req.headers.origin;
  const own = ownOrigin(req);
  if (!own) return false;
  if (req.method === 'POST') return origin === own && (req.headers['content-type'] ?? '').split(';')[0]!.trim() === 'application/json';
  return origin === undefined || origin === own;
}

export const COMPOSITION_ID = /^[A-Za-z][A-Za-z0-9-]*$/;

/** Resolves a project-relative path and proves it stays inside the project after symlinks (7.1). */
export async function safePath(root: string, input: unknown, allowed: readonly string[], maxBytes: number): Promise<{file: string; relative: string; size: number; mtime: number}> {
  if (typeof input !== 'string' || !input || input.length > 512) throw new Fault(400, '경로 형식이 맞지 않습니다.');
  const relative = input.replace(/\\/g, '/');
  if (relative.includes('\0') || isAbsolute(relative) || /^[A-Za-z]:/.test(relative)) throw new Fault(403, '프로젝트 밖의 파일은 열 수 없습니다.');
  const parts = relative.split('/');
  if (parts.includes('..') || parts.includes('node_modules') || parts.includes('.git')) throw new Fault(403, '이 경로는 열 수 없습니다.');
  if (parts.some((part, index) => part.startsWith('.') && !(index === 0 && part === '.scratch'))) throw new Fault(403, '점으로 시작하는 파일은 열 수 없습니다.');
  const realRoot = await realpath(root);
  let file: string;
  try { file = await realpath(resolve(realRoot, relative)); }
  catch { throw new Fault(404, '파일이 없습니다.'); }
  if (!file.startsWith(realRoot + sep)) throw new Fault(403, '프로젝트 밖의 파일은 열 수 없습니다.');
  const realParts = file.slice(realRoot.length + 1).split(sep);
  if (realParts.includes('node_modules') || realParts.some((part, index) => part.startsWith('.') && !(index === 0 && part === '.scratch'))) throw new Fault(403, '이 경로는 열 수 없습니다.');
  if (!allowed.includes(extname(file).toLowerCase())) throw new Fault(415, '이 형식의 파일은 열 수 없습니다.');
  const info = await stat(file);
  if (!info.isFile()) throw new Fault(404, '파일이 없습니다.');
  if (info.size > maxBytes) throw new Fault(413, '파일이 너무 큽니다.');
  return {file, relative, size: info.size, mtime: info.mtimeMs};
}
