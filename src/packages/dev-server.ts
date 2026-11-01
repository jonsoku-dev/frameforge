import {execFile} from 'node:child_process';
import {existsSync, statSync} from 'node:fs';
import {dirname, resolve, sep} from 'node:path';
import {downloadRemote} from '../../scripts/video-frames.mjs';
import {projectPublicMedia, rejectSharedAudio} from '../../scripts/audio-guard.mjs';
import type {Plugin} from 'vite';

type Probe = {streams?: {codec_type?: string; width?: number; height?: number; duration?: string; tags?: {rotate?: string}; side_data_list?: {rotation?: number}[]}[]; format?: {duration?: string}};
export type MediaMetadataResult = {durationInSeconds: number; width: number; height: number} | {error: string; status: number};

/** Resolves `src` (a `public/` path, or an https URL downloaded once into `.cache/remote/` beside `public/`) and reads its size and duration with ffprobe. */
export async function readMediaMetadata(publicDirectory: string, src: string): Promise<MediaMetadataResult> {
  let target: string;
  if (/^https:\/\//i.test(src)) {
    try { target = await downloadRemote(dirname(resolve(publicDirectory)), src); } catch (error) { return {error: `could not download ${src}: ${(error as Error).message}`, status: 502}; }
  }
  else if (src.startsWith('/')) {
    let path: string;
    try { path = decodeURIComponent(src.split(/[?#]/)[0]!); } catch { return {error: `malformed src ${src}`, status: 400}; }
    target = resolve(publicDirectory, '.' + path);
    try {
      rejectSharedAudio(dirname(resolve(publicDirectory)), target);
      const projectFile = projectPublicMedia(dirname(resolve(publicDirectory)), src);
      if (projectFile) target = projectFile;
      else if (!target.startsWith(resolve(publicDirectory) + sep)) return {error: `src ${src} escapes public/`, status: 400};
    } catch (error) { return {error: String(error instanceof Error ? error.message : error), status: 403}; }
    if (!existsSync(target) || !statSync(target).isFile()) return {error: `no file public${path}`, status: 404};
  } else return {error: 'src must be a public path starting with "/" or an https:// URL', status: 400};
  const output = await new Promise<string>((done, fail) => execFile(process.env.FFPROBE_PATH || 'ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', target], {timeout: 20000, maxBuffer: 8 << 20}, (error, stdout, stderr) => error ? fail(new Error(stderr.trim() || error.message)) : done(stdout))).catch((error: Error) => error);
  if (output instanceof Error) return {error: `ffprobe could not read ${src}: ${output.message}`, status: 422};
  const probe = JSON.parse(output) as Probe;
  const video = probe.streams?.find(stream => stream.codec_type === 'video');
  if (!video?.width || !video.height) return {error: `${src} has no video stream`, status: 422};
  const rotation = Math.abs(Number(video.side_data_list?.find(data => data.rotation !== undefined)?.rotation ?? video.tags?.rotate ?? 0)) % 180;
  // A file without a stored duration plays as Infinity in the browser too.
  const duration = Number(probe.format?.duration ?? video.duration);
  return {durationInSeconds: Number.isFinite(duration) ? duration : Infinity, width: rotation === 90 ? video.height : video.width, height: rotation === 90 ? video.width : video.height};
}

/** Serves `getVideoMetadata()`: GET `/__frameforge/media-metadata?src=...`. */
export function mediaMetadata(root: string): Plugin {
  return {
    name: 'media-metadata',
    configureServer(server) {
      server.middlewares.use('/__frameforge/media-metadata', (req, res) => {
        const src = new URL(req.url ?? '', 'http://local').searchParams.get('src') ?? '';
        void readMediaMetadata(resolve(root, 'public'), src).then(result => {
          res.statusCode = 'error' in result ? result.status : 200;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify('error' in result ? {error: result.error} : result));
        });
      });
    },
  };
}

/** Resolves optional peer packages that are not installed to a module that throws, so a lazy `import()` rejects instead of breaking the dev server. */
export function optionalPeers(names: string[], root: string): Plugin {
  const missing = names.filter(name => !existsSync(resolve(root, 'node_modules', name, 'package.json')));
  return {
    name: 'optional-peers',
    enforce: 'pre',
    resolveId: id => missing.includes(id) ? `\0optional-peer:${id}` : null,
    load: id => id.startsWith('\0optional-peer:') ? `throw new Error(${JSON.stringify(`${id.slice(15)} is not installed`)});` : null,
  };
}
