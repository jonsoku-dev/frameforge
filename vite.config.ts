import {defineConfig, type Plugin} from 'vite';
import tailwindcss from '@tailwindcss/vite';
import {spawnSync} from 'node:child_process';
import {createReadStream, existsSync, readFileSync, readdirSync, realpathSync, statSync} from 'node:fs';
import {extname, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {studioApi} from './src/studio/server/studioApi.ts';
import {createHash} from 'node:crypto';
import {downloadRemote, extractVideoFrames} from './scripts/video-frames.mjs';
import {mediaMetadata, optionalPeers} from './src/packages/dev-server.ts';

const directory = fileURLToPath(new URL('.', import.meta.url));
/** A project outside this checkout (`frameforge init`), realpath'd because Vite compares real paths; its films folder comes from frameforge.json. */
const project = process.env.FRAMEFORGE_PROJECT ? realpathSync(process.env.FRAMEFORGE_PROJECT) : null;
const films = project ? resolve(project, (JSON.parse(readFileSync(resolve(project, 'frameforge.json'), 'utf8')) as {films?: string}).films ?? 'films') : resolve(directory, 'examples/samples');

/** Resolves a composition's assets from its assets.json the first time one of its SVGs is requested. */
function artOnDemand(): Plugin {
  return {
    name: 'art-on-demand',
    configureServer(server) {
      server.middlewares.use('/assets/generated', (req, res, next) => {
        const match = /^\/([a-z0-9][a-z0-9-]*)\/([a-z0-9][a-z0-9-]*\.svg)$/.exec((req.url ?? '').split('?')[0] ?? '');
        if (!match) return next();
        const [, slug = '', file = ''] = match;
        const target = resolve(directory, 'public/assets/generated', slug, file);
        if (existsSync(target)) return next();
        const spec = resolve(films, slug, 'assets.json');
        if (!existsSync(spec)) return next();
        const result = spawnSync('python3', [resolve(directory, 'scripts/assets/art.py'), spec], {cwd: directory, encoding: 'utf8'});
        console.log(`[art] ${slug}: ${result.status === 0 ? result.stdout.trim().split('\n').pop() : `failed: ${(result.stderr || String(result.error)).trim().split('\n').pop()}`}`);
        if (!existsSync(target)) return next();
        res.setHeader('content-type', 'image/svg+xml');
        res.setHeader('content-length', String(statSync(target).size));
        createReadStream(target).pipe(res);
      });
    },
  };
}

/** Generates a composition's score from its audio spec the first time one of its files is requested. */
function scoreOnDemand(): Plugin {
  return {
    name: 'score-on-demand',
    configureServer(server) {
      server.middlewares.use('/audio/generated', (req, res, next) => {
        const match = /^\/([a-z0-9][a-z0-9-]*)\/([a-z0-9][a-z0-9-]*\.wav)$/.exec((req.url ?? '').split('?')[0] ?? '');
        if (!match) return next();
        const [, slug = '', file = ''] = match;
        const target = resolve(directory, 'public/audio/generated', slug, file);
        if (existsSync(target)) return next();
        const spec = [resolve(films, slug, 'audio.json')].find(existsSync);
        if (!spec) return next();
        const result = spawnSync('python3', [resolve(directory, 'scripts/assets/score.py'), spec], {cwd: directory, encoding: 'utf8'});
        console.log(`[score] ${slug}: ${result.status === 0 ? result.stdout.trim() : `failed: ${(result.stderr || String(result.error)).trim().split('\n').pop()}`}`);
        if (!existsSync(target)) return next();
        // Vite's public-file index predates this file, so serve it here instead of handing it on.
        res.setHeader('content-type', 'audio/wav');
        res.setHeader('content-length', String(statSync(target).size));
        createReadStream(target).pipe(res);
      });
    },
  };
}

/** Serves the public/ listing that getStaticFiles() and watchStaticFile() read, in the studio and during render. */
function staticFiles(): Plugin {
  return {
    name: 'static-files',
    configureServer(server) {
      server.middlewares.use('/__frameforge/static-files', (_req, res) => {
        const publicDirectory = resolve(directory, 'public');
        const files = existsSync(publicDirectory) ? readdirSync(publicDirectory, {recursive: true, encoding: 'utf8'}).map(entry => resolve(publicDirectory, entry)).filter(file => statSync(file).isFile()).slice(0, 10000).map(file => {
          const name = relative(publicDirectory, file).split(sep).join('/');
          const stats = statSync(file); // follows symlinks, so a link reports its target's size
          return {name, src: '/' + name.split('/').map(encodeURIComponent).join('/'), sizeInBytes: stats.size, lastModified: Math.round(stats.mtimeMs)};
        }) : [];
        res.setHeader('content-type', 'application/json');
        res.setHeader('cache-control', 'no-store');
        res.end(JSON.stringify(files));
      });
    },
  };
}

const REMOTE_TYPES: Record<string, string> = {'.gif': 'image/gif', '.png': 'image/png', '.apng': 'image/apng', '.webp': 'image/webp', '.avif': 'image/avif', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime'};

/** Serves `<Video>` frames as PNGs extracted with ffmpeg, cached under .cache/video-frames/, whether a video has sound, and
 * https sources downloaded once into .cache/remote/. */
function videoFrames(): Plugin {
  const publicDirectory = resolve(directory, 'public');
  const sourceFile = async (src: string | null) => {
    if (/^https:\/\//i.test(src ?? '')) return downloadRemote(directory, src!);
    const file = src?.startsWith('/') ? resolve(publicDirectory, '.' + decodeURIComponent(src.split('?')[0] ?? '')) : '';
    if (!file.startsWith(publicDirectory + sep) || !existsSync(file) || !statSync(file).isFile()) throw new Error(`Video src must name a file under public/ or an https:// URL: ${src}`);
    return file;
  };
  return {
    name: 'video-frames',
    configureServer(server) {
      server.middlewares.use('/__frameforge/remote', async (req, res) => {
        try {
          const src = new URL(req.url ?? '', 'http://x').searchParams.get('src') ?? '';
          if (!/^https:\/\//i.test(src)) throw new Error(`remote src must be an https:// URL: ${src}`);
          const file = await downloadRemote(directory, src);
          res.setHeader('content-type', REMOTE_TYPES[extname(file)] ?? 'application/octet-stream');
          res.setHeader('content-length', String(statSync(file).size));
          createReadStream(file).pipe(res);
        } catch (error) { res.statusCode = 400; res.end(String(error instanceof Error ? error.message : error)); }
      });
      server.middlewares.use('/__frameforge/video-meta', async (req, res) => {
        try {
          const file = await sourceFile(new URL(req.url ?? '', 'http://x').searchParams.get('src'));
          const probe = spawnSync(process.env.FFPROBE_PATH || 'ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', file], {encoding: 'utf8'});
          if (probe.status !== 0) throw new Error(`ffprobe failed: ${probe.stderr || probe.error}`);
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({hasAudio: probe.stdout.trim().length > 0}));
        } catch (error) { res.statusCode = 400; res.end(String(error instanceof Error ? error.message : error)); }
      });
      server.middlewares.use('/__frameforge/video-frame', async (req, res) => {
        try {
          const query = new URL(req.url ?? '', 'http://x').searchParams;
          const file = await sourceFile(query.get('src'));
          const frame = Number(query.get('frame')), fps = Number(query.get('fps'));
          if (!Number.isInteger(frame) || frame < 0) throw new Error('frame must be a nonnegative integer');
          if (!(fps > 0 && fps <= 1000)) throw new Error('fps must be a positive number');
          const stats = statSync(file);
          const outDir = resolve(directory, '.cache/video-frames', createHash('sha256').update(`${file}:${stats.size}:${stats.mtimeMs}:${fps}`).digest('hex').slice(0, 24));
          const target = resolve(outDir, `${frame}.png`);
          // shortcut: each miss extracts the next two seconds in one ffmpeg run; pre-extract from window.__FRAMEFORGE__.video() if seeks get slow
          if (!existsSync(target)) await extractVideoFrames({file, fps, outDir, frames: Array.from({length: Math.ceil(fps * 2)}, (_, index) => frame + index)});
          res.setHeader('content-type', 'image/png');
          res.setHeader('cache-control', 'no-store');
          createReadStream(target).pipe(res);
        } catch (error) { res.statusCode = 400; res.end(String(error instanceof Error ? error.message : error)); }
      });
    },
  };
}

export default defineConfig({
  plugins: [tailwindcss(), studioApi(project ?? directory.replace(/\/$/, ''), process.env.VIDEO_ENTRY || 'examples/samples/index.tsx'), scoreOnDemand(), artOnDemand(), staticFiles(), videoFrames(), mediaMetadata(directory), optionalPeers(['three', '@react-three/fiber'], directory)],
  define: {__VIDEO_ENTRY__: JSON.stringify(process.env.VIDEO_ENTRY || 'examples/samples/index.tsx')},
  // dedupe: films in an outside project have no node_modules, so React resolves from the engine.
  resolve: {alias: {frameforge: resolve(directory, 'src/core/index.tsx'), '@video-entry': resolve(directory, process.env.VIDEO_ENTRY || 'examples/samples/index.tsx'), '@': resolve(directory, 'src')}, dedupe: ['react', 'react-dom']},
  server: {host: '127.0.0.1', port: 4317, strictPort: true, ...(project ? {fs: {allow: [directory, project]}} : {})},
  build: {outDir: 'dist'},
});
