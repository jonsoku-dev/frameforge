import {existsSync, lstatSync, realpathSync} from 'node:fs';
import {dirname, extname, isAbsolute, relative, resolve, sep} from 'node:path';

const canonical = path => existsSync(path) ? realpathSync(path) : resolve(path);
export const viteFsPath = path => { const rest = path.slice('/@fs/'.length); return /^[A-Za-z]:\//.test(rest) ? rest : `/${rest}`; };
export const PROJECT_MEDIA_TYPES = Object.freeze({'.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.oga': 'audio/ogg', '.flac': 'audio/flac', '.aac': 'audio/aac', '.opus': 'audio/ogg', '.aif': 'audio/aiff', '.aiff': 'audio/aiff', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.m4v': 'video/mp4', '.mkv': 'video/x-matroska'});
export const externalProject = engine => {
  const root = canonical(engine);
  if (process.env.FRAMEFORGE_PROJECT && canonical(process.env.FRAMEFORGE_PROJECT) !== root) return true;
  if (process.env.VIDEO_ENTRY) {
    const entry = canonical(process.env.VIDEO_ENTRY);
    const rel = relative(root, entry);
    if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return true;
    let folder = dirname(entry);
    while (folder !== root) {
      if (existsSync(resolve(folder, 'frameforge.json'))) return true;
      const parent = dirname(folder);
      if (parent === folder) break;
      folder = parent;
    }
  }
  return false;
};

/** An explicitly named, non-symlink project public file wins over engine public. */
export function projectPublicMedia(engine, src) {
  const project = process.env.FRAMEFORGE_PROJECT;
  if (!project || canonical(project) === canonical(engine) || !src.startsWith('/')) return null;
  const path = decodeURIComponent(src.split(/[?#]/)[0]);
  const parts = path.split('/').filter(Boolean);
  if (parts.some(part => part === '..' || part === '.' || part.includes('\\'))) throw new Error('Project media path must stay within public/ and contain no symlinks.');
  let current = canonical(project);
  for (const part of ['public', ...parts]) {
    current = resolve(current, part);
    let info;
    try { info = lstatSync(current); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    if (info.isSymbolicLink()) throw new Error('Project media path must stay within public/ and contain no symlinks.');
  }
  if (!lstatSync(current).isFile()) return null;
  if (!PROJECT_MEDIA_TYPES[extname(current).toLowerCase()]) throw new Error(`Unsupported project media format: ${extname(current) || '(no extension)'}.`);
  return current;
}

/** Resolve aliases too: a symlink pointing at shared generated audio is not project-local audio. */
export function rejectSharedAudio(engine, file) {
  if (!externalProject(engine)) return;
  const lexicalRoot = resolve(engine, 'public/audio/generated');
  const inside = (root, candidate) => { const rel = relative(root, candidate); return !rel || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel)); };
  if (inside(lexicalRoot, resolve(file)) || inside(canonical(lexicalRoot), canonical(file))) {
    throw new Error('External project access to engine-generated audio is disabled: the shared files may belong to another project. Use explicitly supplied audio or a full-mix snapshot.');
  }
}
