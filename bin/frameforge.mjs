#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
import {cpSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, writeFileSync} from 'node:fs';
import {basename, dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export const ENGINE = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const SLUG = /^[a-z0-9][a-z0-9-]*$/;
const USAGE = `frameforge <command>
  init <dir>                       새 프로젝트를 만든다 (films/_template, frameforge.json, package.json, README.md)
  new <slug>                       films/<slug>를 템플릿에서 만들고 films/index.tsx에 등록한다
  studio [--port 4317]             스튜디오를 연다
  render <slug|entry.tsx> <Id> <out.mp4|.webm|.mov|.gif|folder/> [props-json] [--frame-range 0-59] [--frames ..] [--concurrency N] [--pipe] [--check-idempotent]
                                   [--codec ..] [--audio-codec ..] [--muted] [--crf N] [--transparent] [--scale S] [--gif-fps N] [--strict-audit]
  score <slug>                     audio.json으로 음악과 효과음을 만든다
  art <slug>                       assets.json으로 에셋을 해결한다
  lint <slug|entry.tsx>            결정성 린트
  check <video.mp4> [--fps 30] [--film <slug|folder>] [--prompt prompt.md] [--json]
                                   frame-check, flash-check, seam-check(<video>.motion.json이 있을 때), narration-check(narration.timing.json이 있을 때)를 한 표로`;

/** The nearest folder at or above `start` holding frameforge.json, with its films folder; null inside the engine checkout. */
export function findProject(start) {
  for (let dir = resolve(start); ; dir = dirname(dir)) {
    const file = join(dir, 'frameforge.json');
    if (existsSync(file)) {
      const root = realpathSync(dir);
      return {root, films: resolve(root, JSON.parse(readFileSync(file, 'utf8')).films ?? 'films')};
    }
    if (dirname(dir) === dir) return null;
  }
}

/** Composition id and component name for a slug: demo-spot -> DemoSpot. Ids must start with a letter. */
export function filmId(slug) {
  const id = slug.split('-').filter(Boolean).map(part => part[0].toUpperCase() + part.slice(1)).join('');
  return /^[A-Za-z]/.test(id) ? id : `Film${id}`;
}

/** The renames the template's prompt.md lists: component and composition id, audio folder, audio spec slug, title. */
export function renameTemplate(text, slug, id) {
  return text.replaceAll('TemplateSpot', id).replaceAll('/audio/generated/template/', `/audio/generated/${slug}/`)
    .replace(/"slug":\s*"template"/, `"slug": "${slug}"`).replace(/^# TODO-slug$/m, `# ${slug}`);
}

/** Adds one import and the entry's <Composition> tag to a films index whose root ends in `</>);`. */
export function addFilm(index, slug, id, entry) {
  const tag = /<Composition\b[^>]*\/>/.exec(entry)?.[0];
  if (!tag) throw new Error(`${slug}/entry.tsx has no <Composition ... /> tag.`);
  const close = index.lastIndexOf('</>');
  if (close < 0) throw new Error('films/index.tsx must end with registerRoot(() => <> ... </>);');
  const lines = index.slice(0, close).split('\n');
  const lastImport = lines.findLastIndex(line => line.startsWith('import '));
  lines.splice(lastImport + 1, 0, `import {${id}} from './${slug}/Spot';`);
  return `${lines.join('\n').replace(/\n*$/, '\n')}  ${tag}\n${index.slice(close)}`;
}

/** Splits argv into the command, positional arguments (up to the first --flag) and the flags, passed on verbatim. */
export function parseArgs(argv) {
  const [command = 'help', ...rest] = argv;
  const cut = rest.findIndex(arg => arg.startsWith('--'));
  return {command, positional: cut < 0 ? rest : rest.slice(0, cut), flags: cut < 0 ? [] : rest.slice(cut)};
}

const flag = (flags, name) => { const at = flags.indexOf(name); return at < 0 ? undefined : flags[at + 1]; };

/** Where films live: the project's films folder, or examples/samples inside the engine. */
const filmsOf = project => project?.films ?? join(ENGINE, 'examples/samples');

/** A path given as-is (has a slash or the extension) or <films>/<slug>/<name>. */
function filmFile(project, target, name) {
  if (!target) throw new Error(`slug가 필요합니다.\n${USAGE}`);
  if (target.includes('/') || target.endsWith(name.slice(name.lastIndexOf('.')))) return resolve(target);
  if (!SLUG.test(target)) throw new Error(`slug는 소문자, 숫자, 하이픈만 씁니다: ${target}`);
  const file = join(filmsOf(project), target, name);
  if (!existsSync(file)) throw new Error(`${file} 이 없습니다.`);
  return file;
}

function run(command, args, project, extraEnv = {}) {
  const env = {...process.env, ...extraEnv, ...(project ? {FRAMEFORGE_PROJECT: project.root} : {})};
  const result = spawnSync(command, args, {cwd: ENGINE, stdio: 'inherit', env});
  if (result.error) throw result.error;
  return result.status ?? 1;
}

/** The one-line detail of a check's output: frame-check's FAIL line or its header, flash-check's worst second, otherwise the first non-empty line. */
export function summarize(name, stdout, stderr) {
  const lines = `${stdout}\n${stderr}`.split('\n').map(line => line.trim()).filter(Boolean);
  if (name === 'frame-check') return lines.find(line => /^FAIL/.test(line)) ?? lines[0] ?? '';
  if (name === 'flash-check') {
    try { const report = JSON.parse(stdout); return `worst second ${report.worstSecondFlashes} flashes (limit 3), ${report.mergedTransitions} transitions`; } catch { /* not JSON: fall through to the first line */ }
  }
  return lines[0] ?? '';
}

/** frame-check, flash-check, then seam-check and narration-check when their script and input exist; each row is {check, status, detail}. */
export function runChecks(video, {fps = '30', folder, prompt, project} = {}) {
  const script = name => join(ENGINE, 'scripts', `${name}.mjs`);
  const motion = `${video}.motion.json`;
  const brief = prompt ?? (folder && existsSync(join(folder, 'prompt.md')) ? join(folder, 'prompt.md') : undefined);
  const timing = folder && join(folder, 'narration.timing.json');
  const optional = (name, input, missing) => !existsSync(script(name)) ? `scripts/${name}.mjs 없음` : !input ? missing : !existsSync(input) ? `${basename(input)} 없음` : null;
  const plan = [
    {check: 'frame-check', args: [script('frame-check'), video, '--fps', fps]},
    {check: 'flash-check', args: [script('flash-check'), video, fps]},
    {check: 'seam-check', skip: optional('seam-check', motion, ''), args: [script('seam-check'), motion, ...(brief ? ['--prompt', brief] : [])]},
    {check: 'narration-check', skip: optional('narration-check', timing, '--film 없음'), args: [script('narration-check'), folder ?? '']},
  ];
  return plan.map(({check, skip, args}) => {
    if (skip) return {check, status: 'SKIP', detail: skip};
    const result = spawnSync(process.execPath, args, {cwd: ENGINE, encoding: 'utf8', env: {...process.env, ...(project ? {FRAMEFORGE_PROJECT: project.root} : {})}});
    return {check, status: result.status === 0 ? 'PASS' : 'FAIL', detail: result.error ? String(result.error) : summarize(check, result.stdout ?? '', result.stderr ?? '')};
  });
}

export function checkTable(rows) {
  const width = Math.max(...rows.map(row => row.check.length));
  return rows.map(row => `${row.check.padEnd(width)}  ${row.status.padEnd(4)}  ${row.detail}`).join('\n');
}

const README = `# Frameforge 프로젝트

이 폴더는 Frameforge 엔진 밖에서 영상을 만드는 프로젝트다. 엔진 위치는 \`frameforge.json\`의 \`engine\`에 적혀 있다.

- \`films/index.tsx\` 스튜디오와 렌더가 읽는 진입 파일. \`frameforge new <slug>\`가 import 한 줄과 \`<Composition>\` 한 줄을 더한다.
- \`films/<slug>/\` 영상 하나: \`Spot.tsx\`(프레임 함수), \`entry.tsx\`(이 영상만 등록), \`audio.json\`(음악과 효과음 명세), \`prompt.md\`(기획), \`assets.tsx\`.
- \`films/_template/\` \`frameforge new\`가 복사하는 원본. 고치면 이후 새 영상에 반영된다.
- \`renders/\` 스튜디오에서 요청한 렌더 결과.

명령:

\`\`\`sh
frameforge new my-spot                                  # films/my-spot 만들기, id는 MySpot
frameforge score my-spot                                # 음악과 효과음 생성
frameforge studio                                       # 스튜디오 (http://127.0.0.1:4317)
frameforge render my-spot MySpot out.mp4 --frame-range 0-59
frameforge check out.mp4                                # 빈 화면, 정지, 깜빡임 검사
\`\`\`

\`frameforge\`가 PATH에 없으면 \`node <engine>/bin/frameforge.mjs\`로 부른다. 엔진 저장소에서 \`npm link\`를 한 번 하면 PATH에 올라간다.

생성된 음악(\`public/audio/generated/<slug>\`), 에셋(\`public/assets/generated/<slug>\`), 캐시(\`.cache\`)는 엔진 저장소에 쌓인다. 그래서 slug는 엔진의 예제와 다른 프로젝트의 영상 사이에서도 겹치지 않게 짓는다.
`;

const INDEX = `import {Composition, registerRoot} from 'frameforge';

registerRoot(() => <>
</>);
`;

function init(target) {
  if (!target) throw new Error(`폴더가 필요합니다.\n${USAGE}`);
  const root = resolve(target);
  if (existsSync(join(root, 'frameforge.json'))) throw new Error(`${root} 에는 이미 frameforge.json이 있습니다.`);
  const template = join(root, 'films/_template');
  if (existsSync(template)) throw new Error(`${template} 가 이미 있습니다.`);
  cpSync(join(ENGINE, 'examples/samples/_template'), template, {recursive: true});
  renameSync(join(template, 'template.audio.json'), join(template, 'audio.json'));
  writeFileSync(join(root, 'frameforge.json'), `${JSON.stringify({engine: ENGINE, films: 'films'}, null, 2)}\n`);
  if (!existsSync(join(root, 'films/index.tsx'))) writeFileSync(join(root, 'films/index.tsx'), INDEX);
  if (!existsSync(join(root, 'package.json'))) writeFileSync(join(root, 'package.json'), `${JSON.stringify({name: basename(root).toLowerCase().replace(/[^a-z0-9-]/g, '-'), private: true, scripts: {studio: 'frameforge studio', render: 'frameforge render'}}, null, 2)}\n`);
  if (!existsSync(join(root, 'README.md'))) writeFileSync(join(root, 'README.md'), README);
  console.log(`${root} 를 만들었습니다. cd ${target} && frameforge new <slug>`);
}

function newFilm(project, slug) {
  if (!slug || !SLUG.test(slug)) throw new Error(`slug는 소문자, 숫자, 하이픈만 씁니다: ${slug ?? ''}`);
  const films = filmsOf(project);
  const folder = join(films, slug);
  if (existsSync(folder)) throw new Error(`${folder} 가 이미 있습니다.`);
  const own = join(films, '_template');
  cpSync(existsSync(own) ? own : join(ENGINE, 'examples/samples/_template'), folder, {recursive: true});
  if (existsSync(join(folder, 'template.audio.json'))) renameSync(join(folder, 'template.audio.json'), join(folder, 'audio.json'));
  const id = filmId(slug);
  for (const name of readdirSync(folder)) if (/\.(tsx|ts|json|md)$/.test(name)) writeFileSync(join(folder, name), renameTemplate(readFileSync(join(folder, name), 'utf8'), slug, id));
  const index = join(films, 'index.tsx');
  writeFileSync(index, addFilm(readFileSync(index, 'utf8'), slug, id, readFileSync(join(folder, 'entry.tsx'), 'utf8')));
  console.log(`${folder} 를 만들고 ${index} 에 ${id} 를 등록했습니다.`);
}

export function main(argv) {
  const cwd = process.cwd();
  const {command, positional, flags} = parseArgs(argv);
  const project = findProject(cwd);
  const node = process.execPath;
  switch (command) {
    case 'init': return init(positional[0]), 0;
    case 'new': return newFilm(project, positional[0]), 0;
    case 'studio': {
      const port = flag(flags, '--port');
      return run(node, [join(ENGINE, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', ...(port ? ['--port', port] : [])], project, project ? {VIDEO_ENTRY: join(project.films, 'index.tsx')} : {});
    }
    case 'render': {
      const [target, ...rest] = positional;
      const entry = target === undefined ? [] : [filmFile(project, target, 'entry.tsx')];
      // the output is the third positional; resolve it against the caller's folder because the renderer runs in the engine (a trailing / means a PNG sequence)
      if (rest[1] !== undefined) rest[1] = resolve(cwd, rest[1]) + (rest[1].endsWith('/') ? '/' : '');
      return run(node, [join(ENGINE, 'scripts/render.mjs'), ...entry, ...rest, ...flags], project);
    }
    case 'score': return run('python3', [join(ENGINE, 'scripts/assets/score.py'), filmFile(project, positional[0], 'audio.json')], project);
    case 'art': return run('python3', [join(ENGINE, 'scripts/assets/art.py'), filmFile(project, positional[0], 'assets.json')], project);
    case 'lint': return run(node, [join(ENGINE, 'scripts/lint.mjs'), filmFile(project, positional[0], 'entry.tsx')], project);
    case 'check': {
      const video = positional[0] && resolve(cwd, positional[0]);
      if (!video || !existsSync(video)) throw new Error(`영상 파일이 필요합니다: ${positional[0] ?? ''}`);
      const film = flag(flags, '--film');
      const folder = film === undefined ? undefined : film.includes('/') ? resolve(cwd, film) : join(filmsOf(project), film);
      const prompt = flag(flags, '--prompt');
      const rows = runChecks(video, {fps: flag(flags, '--fps') ?? '30', folder, prompt: prompt ? resolve(cwd, prompt) : undefined, project});
      console.log(flags.includes('--json') ? JSON.stringify(rows, null, 1) : checkTable(rows));
      return rows.some(row => row.status === 'FAIL') ? 1 : 0;
    }
    case 'help': case '--help': case '-h': return console.log(USAGE), 0;
    default: throw new Error(`모르는 명령: ${command}\n${USAGE}`);
  }
}

// realpath: under npm link argv[1] is the .bin symlink, not this file
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
