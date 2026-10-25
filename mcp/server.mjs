// Frameforge MCP server: the CLI's commands as MCP tools over stdio (default) or Streamable HTTP on 127.0.0.1.
// Every tool runs `node bin/frameforge.mjs <command>` with fixed argument lists (no shell) inside one Frameforge project.
import {spawn} from 'node:child_process';
import {existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {dirname, isAbsolute, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {z} from 'zod';

/** The engine checkout: FRAMEFORGE_ENGINE (the Desktop extension sets it) or the folder above this file. */
export const ENGINE = resolve(process.env.FRAMEFORGE_ENGINE || fileURLToPath(new URL('..', import.meta.url)));
const CLI = join(ENGINE, 'bin/frameforge.mjs');
const {findProject, filmId} = await import(pathToFileURL(CLI).href);
const SLUG = /^[a-z0-9][a-z0-9-]*$/;  // the CLI's rule, so films/_template is not a film
const MAX_FILE = 2 * 1024 * 1024;
const MINUTE = 60_000;

export const USAGE = `frameforge mcp [--project <dir>] [--http] [--port 4319] [--allow-host <host>]
  stdio by default. --http serves Streamable HTTP at http://127.0.0.1:<port>/mcp (loopback only).
  --project (or FRAMEFORGE_PROJECT_DIR) is the folder with frameforge.json; without one the engine's examples/samples is used.
  --allow-host adds a Host header value a tunnel forwards (DNS rebinding protection rejects other hosts).
  FRAMEFORGE_MCP_TOKEN (required with --allow-host): every HTTP request must send "Authorization: Bearer <token>"
  or use the path /mcp/<token> (for hosts that cannot send headers, such as ChatGPT developer-mode connectors).`;

/** Project root and films folder for a directory: its frameforge.json project, or the engine with examples/samples. */
export function projectAt(dir) {
  const found = findProject(dir);
  return found ?? {root: ENGINE, films: join(ENGINE, 'examples/samples')};
}

/** The film folder for a slug, which must exist. */
function filmFolder(project, slug) {
  if (!SLUG.test(slug)) throw new Error(`slug must be lowercase letters, digits and hyphens: ${slug}`);
  const folder = join(project.films, slug);
  if (!existsSync(join(folder, 'entry.tsx'))) throw new Error(`No film ${slug}: ${folder}/entry.tsx is missing. film_list shows the films.`);
  return folder;
}

/** A path inside base; rejects absolute paths, `..` escapes and symlinks anywhere on the way. */
export function inside(base, path) {
  if (typeof path !== 'string' || !path || isAbsolute(path) || path.includes('\0')) throw new Error(`Path must be relative to the film folder: ${path}`);
  const target = resolve(base, path);
  if (!target.startsWith(base + sep)) throw new Error(`Path escapes the film folder: ${path}`);
  for (let at = target; at !== base; at = dirname(at)) if (existsSync(at) && lstatSync(at).isSymbolicLink()) throw new Error(`Path goes through a symlink: ${relative(base, at)}`);
  if (!realpathSync(existsSync(target) ? target : base).startsWith(realpathSync(base))) throw new Error(`Path escapes the film folder: ${path}`);
  return target;
}

/** The composition id from entry.tsx's first <Composition id="...">, else the CLI's slug -> Id rule. */
export function compositionId(folder, slug) {
  return /<Composition\b[^>]*\bid="([^"]+)"/.exec(readFileSync(join(folder, 'entry.tsx'), 'utf8'))?.[1] ?? filmId(slug);
}

/** The first free renders/<stem>[-n].<ext> under the project; the renderer refuses to overwrite. */
function freeOutput(project, stem, ext) {
  const dir = join(project.root, 'renders');
  mkdirSync(dir, {recursive: true});
  for (let n = 0; ; n++) {
    const file = join(dir, `${stem}${n ? `-${n}` : ''}${ext}`);
    if (!existsSync(file)) return file;
  }
}

/** The renderer's final pretty-printed JSON block: the last line that is exactly `{` to the end. */
export function lastJson(stdout) {
  const lines = stdout.trimEnd().split('\n');
  for (let at = lines.length - 1; at >= 0; at--) if (lines[at] === '{') try { return JSON.parse(lines.slice(at).join('\n')); } catch { return null; }
  return null;
}

/** Runs the CLI in the project; reports `n/m frames` lines as progress; kills the child on timeout or cancel. */
function cli(project, args, {timeout = 10 * MINUTE, extra, env = {}} = {}) {
  return new Promise(done => {
    const child = spawn(process.execPath, [CLI, ...args], {cwd: project.root, stdio: ['ignore', 'pipe', 'pipe'], env: {...process.env, ...env}});
    let stdout = '', stderr = '', killed = '';
    const kill = why => { killed = why; child.kill('SIGTERM'); setTimeout(() => child.kill('SIGKILL'), 5000).unref(); };
    const timer = setTimeout(() => kill(`timed out after ${Math.round(timeout / 1000)} s`), timeout);
    const onAbort = () => kill('cancelled');
    extra?.signal?.addEventListener('abort', onAbort);
    const token = extra?._meta?.progressToken;
    const progress = text => {
      if (token === undefined) return;
      for (const [, n, m] of text.matchAll(/(\d+)\/(\d+) frames/g)) extra.sendNotification({method: 'notifications/progress', params: {progressToken: token, progress: Number(n), total: Number(m), message: `${n}/${m} frames`}}).catch(() => {});
    };
    child.stdout.on('data', chunk => { stdout += chunk; progress(String(chunk)); });
    child.stderr.on('data', chunk => { stderr += chunk; progress(String(chunk)); });
    child.on('error', error => { stderr += String(error); });
    child.on('close', code => {
      clearTimeout(timer);
      extra?.signal?.removeEventListener('abort', onAbort);
      done({code: killed ? -1 : code ?? 1, stdout, stderr: killed ? `${stderr}\n${killed}` : stderr});
    });
  });
}

/** Stops a detached child and everything it started. */
const killGroup = child => { try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill('SIGTERM'); } };
const text = (body, isError = false) => ({content: [{type: 'text', text: typeof body === 'string' ? body : JSON.stringify(body, null, 1)}], isError});
const tail = (s, n = 4000) => s.length > n ? `...${s.slice(-n)}` : s;
/** A CLI result as tool output: the output on success, the output and stderr as an error otherwise. */
const result = ({code, stdout, stderr}) => code === 0 ? text(tail(stdout || 'ok')) : text(`exit ${code}\n${tail(stdout, 2000)}\n${tail(stderr)}`.trim(), true);

/** Skill and reference names under the engine's skills/: `<skill>` and `<skill>/<reference>` (without .md). */
export function skillNames() {
  const root = join(ENGINE, 'skills');
  return readdirSync(root).filter(name => existsSync(join(root, name, 'SKILL.md'))).sort().flatMap(name => {
    const refs = join(root, name, 'references');
    return [name, ...(existsSync(refs) ? readdirSync(refs).filter(file => file.endsWith('.md')).sort().map(file => `${name}/${file.slice(0, -3)}`) : [])];
  });
}

const WORKFLOW = {
  make_motion_film: {skill: 'frameforge-motion', title: 'Make a motion-graphics film', steps: `1. read_skill frameforge-motion and read_skill frameforge-best-practices/bespoke; follow them over this list.
2. film_new <slug>, then film_files read entry.tsx and set duration, size and fps to what the request says.
3. Brief: film_files write brief.md (the request verbatim, one intent-ledger row per clause, engine translation, gaps); brief_check until PASS.
4. Concept: one idea, its world, a hero that recurs and changes, a palette from the idea; write it at the top of prompt.md.
5. Bespoke code: film_files write Spot.tsx as a pure function of useCurrentFrame() with your own shader, canvas and three.js code; lint until it has no findings.
6. score: film_files write audio.json (mood, bpm, sections on the cuts, hits on the big moments), then score.
7. contact_sheet with one frame per scene; look at every cell and remake the two weakest scenes with a new idea (the second pass), then contact_sheet again.
8. render the whole film, then check with the mp4 path and the slug; fix every FAIL.
9. Report what you made, every must and forbid clause with PASS or FAIL, the check table, and what you did not verify.`},
  make_explainer: {skill: 'frameforge-create', title: 'Make an explainer film', steps: `1. read_skill frameforge-create and read_skill frameforge-best-practices; follow them over this list. Read the references they point to with read_skill.
2. film_new <slug>; film_files read entry.tsx, prompt.md and brief.md.
3. Brief: film_files write brief.md (request verbatim, intent ledger, engine translation, gaps); brief_check until PASS.
4. Concept and Structure table in prompt.md on the beat grid; show the table before writing code.
5. Code: film_files write Spot.tsx (blocks, kit and bespoke code as the skill allows); lint until clean.
6. score: film_files write audio.json, then score.
7. contact_sheet with one cell per scene; critique each cell in prompt.md (Second pass), remake the two weakest scenes, sheet again.
8. render the whole film, then check with the mp4 path and the slug; fix every FAIL.
9. Report every must and forbid clause with PASS or FAIL and evidence, the check table, and what you did not verify.`},
};

/** One McpServer with every tool and prompt; `state` holds the default project and the studio child across requests. */
export function buildServer(state) {
  const server = new McpServer({name: 'frameforge', version: JSON.parse(readFileSync(join(ENGINE, 'package.json'), 'utf8')).version});
  const projectArg = z.string().optional().describe('Absolute path of a Frameforge project (a folder with frameforge.json). Default: the server\'s project.');
  const slugArg = z.string().regex(SLUG).describe('Film slug (kebab-case), as film_list shows');
  const pick = project => {
    if (project === undefined) return state.project;
    if (!isAbsolute(project) || !existsSync(join(project, 'frameforge.json'))) throw new Error(`project must be an absolute path to a folder with frameforge.json: ${project}`);
    return projectAt(project);
  };
  const tool = (name, description, inputSchema, annotations, handler) => server.registerTool(name, {description, inputSchema, annotations: {openWorldHint: false, ...annotations}}, async (args, extra) => {
    try { return await handler(args, extra); } catch (error) { return text(error instanceof Error ? error.message : String(error), true); }
  });
  const ro = {readOnlyHint: true, destructiveHint: false, idempotentHint: true};
  const writes = {readOnlyHint: false, destructiveHint: false};

  tool('project_init', 'Create a Frameforge project folder (films/_template, films/index.tsx, frameforge.json) and make it the default project for later calls.', {dir: z.string().describe('Absolute path of a new or empty folder')}, writes, async ({dir}) => {
    if (!isAbsolute(dir)) throw new Error(`dir must be absolute: ${dir}`);
    mkdirSync(dir, {recursive: true});
    const run = await cli({root: dir}, ['init', dir]);
    if (run.code === 0) state.project = projectAt(dir);
    return run.code === 0 ? text({project: state.project.root, films: state.project.films, next: 'film_new <slug>'}) : result(run);
  });
  tool('film_new', 'Create films/<slug> from the template and register it in films/index.tsx. The composition id is the slug in PascalCase.', {slug: slugArg, project: projectArg}, writes, async ({slug, project}) => {
    const p = pick(project);
    const run = await cli(p, ['new', slug]);
    return run.code === 0 ? text({slug, folder: join(p.films, slug), id: filmId(slug), files: readdirSync(join(p.films, slug)).sort()}) : result(run);
  });
  tool('film_list', 'List the films in the project with their composition ids and files.', {project: projectArg}, ro, async ({project}) => {
    const p = pick(project);
    const films = existsSync(p.films) ? readdirSync(p.films).filter(slug => SLUG.test(slug) && existsSync(join(p.films, slug, 'entry.tsx'))).sort() : [];
    return text({project: p.root, films: films.map(slug => ({slug, id: compositionId(join(p.films, slug), slug), files: readdirSync(join(p.films, slug)).filter(file => !file.startsWith('.')).sort()}))});
  });
  tool('film_files', 'List, read or write files inside one film folder (films/<slug>/). Paths are relative to that folder; nothing outside it can be read or written.', {
    slug: slugArg, action: z.enum(['list', 'read', 'write']), path: z.string().optional().describe('File path relative to the film folder, e.g. Spot.tsx or brief.md'),
    content: z.string().max(MAX_FILE).optional().describe('The whole new file text (write only)'), project: projectArg,
  }, {readOnlyHint: false, destructiveHint: true}, async ({slug, action, path, content, project}) => {
    const folder = realpathSync(filmFolder(pick(project), slug));
    if (action === 'list') {
      const walk = dir => readdirSync(dir, {withFileTypes: true}).filter(entry => !entry.name.startsWith('.')).flatMap(entry => entry.isDirectory() ? walk(join(dir, entry.name)) : [relative(folder, join(dir, entry.name))]);
      return text(walk(folder).sort());
    }
    const file = inside(folder, path);
    if (action === 'read') {
      if (!existsSync(file)) throw new Error(`No file ${path} in ${slug}.`);
      if (statSync(file).size > MAX_FILE) throw new Error(`${path} is over 2 MB.`);
      return text(readFileSync(file, 'utf8'));
    }
    if (content === undefined) throw new Error('write needs content.');
    mkdirSync(dirname(file), {recursive: true});
    writeFileSync(file, content);
    return text(`wrote ${relative(folder, file)} (${Buffer.byteLength(content)} bytes)`);
  });
  tool('brief_check', 'Check films/<slug>/brief.md: the verbatim request, the intent ledger, the engine translation and gaps. PASS before writing the concept.', {slug: slugArg, project: projectArg}, ro, async ({slug, project}) => {
    const p = pick(project);
    return result(await cli(p, ['brief-check', filmFolder(p, slug)]));
  });
  tool('lint', 'Determinism lint of a film (Math.random, clocks, unseeded effects). Prints JSON findings.', {slug: slugArg, project: projectArg}, ro, async ({slug, project}) => {
    const p = pick(project);
    return result(await cli(p, ['lint', join(filmFolder(p, slug), 'entry.tsx')]));
  });
  tool('score', 'Generate the film\'s music and sound effects from films/<slug>/audio.json (keyless, local).', {slug: slugArg, project: projectArg}, writes, async ({slug, project}, extra) => {
    const p = pick(project);
    const spec = join(filmFolder(p, slug), 'audio.json');
    if (!existsSync(spec)) throw new Error(`${slug} has no audio.json; write it with film_files first.`);
    return result(await cli(p, ['score', spec], {timeout: 15 * MINUTE, extra}));
  });

  const renderTool = async (p, slug, out, flags, extra, timeoutMinutes) => {
    const folder = filmFolder(p, slug);
    const run = await cli(p, ['render', join(folder, 'entry.tsx'), compositionId(folder, slug), out, ...flags], {timeout: timeoutMinutes * MINUTE, extra});
    return {run, summary: run.code === 0 ? lastJson(run.stdout) : null, audit: /^\{"audit":.*$/m.exec(run.stdout)?.[0]};
  };
  const timeoutArg = z.number().int().min(1).max(180).default(60).describe('Minutes before the render is killed');
  tool('render', 'Render a film (or an inclusive frame range) to an MP4 under <project>/renders/. Returns the path and the renderer\'s JSON summary. Sends progress notifications.', {
    slug: slugArg, frame_range: z.tuple([z.number().int().min(0), z.number().int().min(0)]).optional().describe('[from, to] inclusive'),
    name: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/).optional().describe('Output file stem; default <slug>'), concurrency: z.number().int().min(1).max(8).optional(),
    timeout_minutes: timeoutArg, project: projectArg,
  }, writes, async ({slug, frame_range, name, concurrency, timeout_minutes, project}, extra) => {
    const p = pick(project);
    if (frame_range && frame_range[0] > frame_range[1]) throw new Error('frame_range must be [from, to] with from <= to.');
    const out = freeOutput(p, name ?? (frame_range ? `${slug}-${frame_range[0]}-${frame_range[1]}` : slug), '.mp4');
    const {run, summary, audit} = await renderTool(p, slug, out, [...(frame_range ? ['--frame-range', frame_range.join('-')] : []), ...(concurrency ? ['--concurrency', String(concurrency)] : [])], extra, timeout_minutes);
    return run.code === 0 ? text({video: out, summary, ...(audit ? {audit: JSON.parse(audit).audit} : {}), next: `check {video: "${out}", slug: "${slug}"}`}) : result(run);
  });
  const image = (file, info) => ({content: [{type: 'image', data: readFileSync(file).toString('base64'), mimeType: 'image/png'}, {type: 'text', text: JSON.stringify({file, ...info}, null, 1)}]});
  tool('contact_sheet', 'Render the listed frames and tile them into one PNG (480 px cells, 4 per row), returned as an image so you can look at the film.', {
    slug: slugArg, frames: z.array(z.number().int().min(0)).min(1).max(24).describe('Frame numbers, e.g. one per scene'), timeout_minutes: timeoutArg, project: projectArg,
  }, writes, async ({slug, frames, timeout_minutes, project}, extra) => {
    const p = pick(project);
    const out = freeOutput(p, `${slug}-sheet`, '.png');
    const {run, audit} = await renderTool(p, slug, out, ['--frames', frames.join(',')], extra, timeout_minutes);
    return run.code === 0 && existsSync(out) ? image(out, {frames, ...(audit ? {audit: JSON.parse(audit).audit} : {})}) : result(run);
  });
  tool('still', 'Render one frame as a PNG image (scale 0.5 by default: 960x540 for a 1080p film).', {
    slug: slugArg, frame: z.number().int().min(0), scale: z.number().min(0.1).max(2).default(0.5), timeout_minutes: timeoutArg, project: projectArg,
  }, writes, async ({slug, frame, scale, timeout_minutes, project}, extra) => {
    const p = pick(project);
    const dir = freeOutput(p, `${slug}-still-${frame}`, '');
    const {run} = await renderTool(p, slug, `${dir}/`, ['--frame-range', `${frame}-${frame}`, '--scale', String(scale)], extra, timeout_minutes);
    const file = join(dir, `${String(frame).padStart(5, '0')}.png`);
    return run.code === 0 && existsSync(file) ? image(file, {frame, scale}) : result(run);
  });
  tool('check', 'Run frame-check, flash-check, seam-check, narration-check and brief on a rendered video; returns the table rows. Video must be inside the project.', {
    video: z.string().describe('Path of the rendered video (absolute, or relative to the project)'), slug: slugArg.optional().describe('The film, for the narration and brief rows'), project: projectArg,
  }, ro, async ({video, slug, project}, extra) => {
    const p = pick(project);
    const file = resolve(p.root, video);
    if (!file.startsWith(p.root + sep) || !existsSync(file)) throw new Error(`video must be an existing file inside ${p.root}: ${video}`);
    if (slug) filmFolder(p, slug);
    const run = await cli(p, ['check', file, ...(slug ? ['--film', slug] : []), '--json'], {timeout: 20 * MINUTE, extra});
    try { const rows = JSON.parse(run.stdout); return text({pass: run.code === 0, rows}, run.code !== 0); } catch { return result(run); }
  });

  tool('studio_start', 'Start the studio (live preview with sound) for the project on 127.0.0.1 and return its URL. One studio per server.', {
    port: z.number().int().min(1024).max(65535).default(4317), project: projectArg,
  }, writes, async ({port, project}) => {
    if (state.studio) return text({url: state.studio.url, running: true});
    const p = pick(project);
    // detached: its own process group, so stopping it also stops the Vite server the CLI spawns
    const child = spawn(process.execPath, [CLI, 'studio', '--port', String(port)], {cwd: p.root, stdio: ['ignore', 'pipe', 'pipe'], env: process.env, detached: true});
    let log = '';
    child.stdout.on('data', chunk => { log = tail(log + chunk, 4000); });
    child.stderr.on('data', chunk => { log = tail(log + chunk, 4000); });
    const url = `http://127.0.0.1:${port}/`;
    for (let waited = 0; waited < 60_000; waited += 500) {
      if (child.exitCode !== null) return text(`studio exited ${child.exitCode}\n${log}`, true);
      if (await fetch(url).then(response => response.ok, () => false)) {
        state.studio = {child, url};
        child.on('exit', () => { if (state.studio?.child === child) state.studio = null; });
        return text({url, project: p.root});
      }
      await new Promise(next => setTimeout(next, 500));
    }
    killGroup(child);
    return text(`studio did not answer at ${url} within 60 s\n${log}`, true);
  });
  tool('studio_stop', 'Stop the studio this server started.', {}, {readOnlyHint: false, destructiveHint: false, idempotentHint: true}, async () => {
    if (!state.studio) return text('no studio running');
    killGroup(state.studio.child);
    state.studio = null;
    return text('stopped');
  });

  tool('read_skill', 'Read Frameforge guidance: a skill (e.g. frameforge-motion) or a reference (e.g. frameforge-best-practices/bespoke). Without name, lists every name.', {
    name: z.string().regex(/^[a-z0-9-]+(\/[a-z0-9-]+)?$/).optional(),
  }, ro, async ({name}) => {
    const names = skillNames();
    if (!name) return text(names);
    if (!names.includes(name)) throw new Error(`Unknown skill ${name}. Known: ${names.join(', ')}`);
    const [skill, ref] = name.split('/');
    return text(readFileSync(join(ENGINE, 'skills', skill, ref ? `references/${ref}.md` : 'SKILL.md'), 'utf8'));
  });

  for (const [name, {skill, title, steps}] of Object.entries(WORKFLOW)) server.registerPrompt(name, {title, description: `${title} with the Frameforge tools, end to end`, argsSchema: {request: z.string().describe('What the user asked for, verbatim')}}, ({request}) => ({
    messages: [{role: 'user', content: {type: 'text', text: `Make this film with the Frameforge MCP tools. The user's request, verbatim (keep every clause):\n\n${request}\n\nWorkflow (the ${skill} skill is the authority; read it first):\n${steps}\n\nRules: every value derives from the frame number and seeded random numbers; no network or paid services in the film; never write outside films/<slug>/ (film_files enforces it).`}}],
  }));
  return server;
}

/** Starts the server: stdio, or Streamable HTTP on 127.0.0.1 with a Host check against DNS rebinding. */
export async function serve(flags = []) {
  const value = name => { const at = flags.indexOf(name); return at < 0 ? undefined : flags[at + 1]; };
  if (flags.includes('--help')) return console.log(USAGE);
  if (value('--project') && !findProject(resolve(value('--project')))) throw new Error(`--project ${value('--project')} has no frameforge.json; run frameforge init there first.`);
  const state = {project: projectAt(resolve(value('--project') || process.env.FRAMEFORGE_PROJECT_DIR || process.cwd())), studio: null};
  const stopStudio = () => state.studio && killGroup(state.studio.child);
  process.on('exit', stopStudio);
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { stopStudio(); process.exit(0); });
  if (!flags.includes('--http')) {
    const transport = new StdioServerTransport();
    transport.onclose = () => { stopStudio(); process.exit(0); };
    return buildServer(state).connect(transport);
  }
  const port = Number(value('--port') ?? 4319);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`--port must be a port number: ${value('--port')}`);
  const hosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`, ...flags.flatMap((flag, at) => flag === '--allow-host' ? [flags[at + 1]] : [])]);
  const token = process.env.FRAMEFORGE_MCP_TOKEN || '';
  // A tunnel makes the server reachable from the internet; without a token anyone with the URL could render and write films.
  if (flags.includes('--allow-host') && token.length < 16) throw new Error('--allow-host needs FRAMEFORGE_MCP_TOKEN (16+ characters) in the environment.');
  const same = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
  const http = createServer(async (req, res) => {
    if (!hosts.has(req.headers.host ?? '')) return res.writeHead(403).end(`Host ${req.headers.host} is not allowed; start with --allow-host ${req.headers.host}`);
    const path = new URL(req.url ?? '/', 'http://x').pathname;
    const bearer = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    if (token && !same(bearer, token) && !same(path, `/mcp/${token}`)) return res.writeHead(401).end('Missing or wrong token');
    if (path !== '/mcp' && !(token && same(path, `/mcp/${token}`))) return res.writeHead(404).end('MCP endpoint is /mcp');
    // Stateless: one server and transport per request; the project and studio live in `state`.
    const server = buildServer(state);
    const transport = new StreamableHTTPServerTransport({sessionIdGenerator: undefined});
    res.on('close', () => { transport.close(); server.close(); });
    try { await server.connect(transport); await transport.handleRequest(req, res); }
    catch (error) { if (!res.headersSent) res.writeHead(500).end(String(error)); }
  });
  await new Promise((ready, fail) => http.once('error', fail).listen(port, '127.0.0.1', ready));
  console.error(`Frameforge MCP on http://127.0.0.1:${port}/mcp (project ${state.project.root})`);
}
