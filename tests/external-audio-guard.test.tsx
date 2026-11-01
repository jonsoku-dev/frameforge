import assert from 'node:assert/strict';
import {spawn, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {createServer} from 'node:net';
import {tmpdir} from 'node:os';
import {basename, join, resolve} from 'node:path';
import test from 'node:test';
// @ts-expect-error the renderer is plain ESM without types
import {encodeArgs} from '../scripts/render.mjs';
import {viteFsPath} from '../scripts/audio-guard.mjs';

const engine = resolve(import.meta.dirname, '..');
const pause = (ms: number) => new Promise(done => setTimeout(done, ms));
const hash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');

test('Vite absolute paths retain POSIX roots and Windows drive letters', () => {
  assert.equal(viteFsPath('/@fs/Users/example/audio.wav'), '/Users/example/audio.wav');
  assert.equal(viteFsPath('/@fs/C:/example/audio.wav'), 'C:/example/audio.wav');
  assert.equal(viteFsPath('/@fs//server/share/audio.wav'), '//server/share/audio.wav');
});

test('outside projects cannot regenerate or mix another project’s shared generated audio', {timeout: 30000}, () => {
  const temp = mkdtempSync(join(tmpdir(), 'ff-external-audio-'));
  const generated = join(engine, 'public/audio/generated');
  mkdirSync(generated, {recursive: true});
  const shared = mkdtempSync(join(generated, 'guard-'));
  const nested = mkdtempSync(join(engine, 'guard-nested-'));
  const slug = basename(shared);
  const existing = join(shared, 'voice.wav');
  const priorProject = process.env.FRAMEFORGE_PROJECT, priorEntry = process.env.VIDEO_ENTRY;
  writeFileSync(existing, 'previous project voice');
  const before = hash(existing);
  try {
    for (const [name, text] of [['a', 'first'], ['b', 'second']]) {
      const project = join(temp, name), film = join(project, 'films', slug);
      mkdirSync(film, {recursive: true});
      const voice = join(film, 'narration.json'), score = join(film, 'audio.json');
      writeFileSync(voice, JSON.stringify({slug, language: 'en', voice: {provider: 'silent'}, lines: [{id: 'one', text}]}));
      writeFileSync(score, '{}');
      for (const [script, spec] of [['voice.py', voice], ['score.py', score]]) {
        const run = spawnSync('python3', [join(engine, 'scripts/assets', script!), spec!], {cwd: engine, env: {...process.env, FRAMEFORGE_PROJECT: project}, encoding: 'utf8'});
        assert.notEqual(run.status, 0);
        assert.match(run.stderr, /External project generated audio is disabled/);
        assert.equal(hash(existing), before);
        assert.ok(!existsSync(join(film, 'narration.timing.json')));
      }
      process.env.FRAMEFORGE_PROJECT = project;
      assert.throws(() => encodeArgs([], [], 30, 1, [{clip: {src: `/audio/generated/${slug}/voice.wav`, trimBefore: 0, startFrame: 0, volume: 1}, first: 0, last: 0}], 'out.mp4'), /External project access to engine-generated audio is disabled/);
    }
    const env = {...process.env}; delete env.FRAMEFORGE_PROJECT; delete env.VIDEO_ENTRY;
    const direct = spawnSync('python3', [join(engine, 'scripts/assets/voice.py'), join(temp, 'a', 'films', slug, 'narration.json')], {cwd: engine, env, encoding: 'utf8'});
    assert.notEqual(direct.status, 0, 'an outside spec cannot silently write to engine public even without the environment variable');
    const nestedFilm = join(nested, 'films', slug); mkdirSync(nestedFilm, {recursive: true});
    writeFileSync(join(nested, 'frameforge.json'), JSON.stringify({films: 'films'}));
    const nestedSpec = join(nestedFilm, 'narration.json');
    writeFileSync(nestedSpec, JSON.stringify({slug, language: 'en', voice: {provider: 'silent'}, lines: [{id: 'one', text: 'nested project'}]}));
    const nestedRun = spawnSync('python3', [join(engine, 'scripts/assets/voice.py'), nestedSpec], {cwd: engine, env, encoding: 'utf8'});
    assert.notEqual(nestedRun.status, 0, 'a nested project is not an engine sample when invoked directly');
    assert.match(nestedRun.stderr, /External project generated audio is disabled/);
    assert.equal(hash(existing), before);
  } finally {
    if (priorProject === undefined) delete process.env.FRAMEFORGE_PROJECT; else process.env.FRAMEFORGE_PROJECT = priorProject;
    if (priorEntry === undefined) delete process.env.VIDEO_ENTRY; else process.env.VIDEO_ENTRY = priorEntry;
    rmSync(shared, {recursive: true, force: true}); rmSync(temp, {recursive: true, force: true}); rmSync(nested, {recursive: true, force: true});
  }
});

test('outside project Vite cannot fall through to shared generated audio', {timeout: 60000}, async () => {
  const temp = mkdtempSync(join(tmpdir(), 'ff-audio-http-'));
  const generated = join(engine, 'public/audio/generated'); mkdirSync(generated, {recursive: true});
  const shared = mkdtempSync(join(generated, 'guard-')), slug = basename(shared);
  const file = join(shared, 'voice.wav'); writeFileSync(file, 'sensitive sentinel');
  const alias = join(engine, 'public', `${slug}.wav`); symlinkSync(file, alias);
  writeFileSync(join(temp, 'frameforge.json'), JSON.stringify({films: 'films'}));
  mkdirSync(join(temp, 'public')); writeFileSync(join(temp, 'public', 'music.wav'), 'project-local-audio');
  const mediaName = `${slug}.flac`, engineMedia = join(engine, 'public', mediaName);
  writeFileSync(engineMedia, 'engine music'); writeFileSync(join(temp, 'public', mediaName), 'project music');
  writeFileSync(join(temp, 'public', 'unsupported.unknown'), 'project unsupported');
  writeFileSync(join(temp, 'public', 'read-error.wav'), 'present before opening');
  writeFileSync(join(temp, 'public', 'partial-error.wav'), 'present before opening');
  const preload = join(temp, 'read-failure.mjs');
  writeFileSync(preload, `import fs from 'node:fs'; import {Readable} from 'node:stream'; import {syncBuiltinESMExports} from 'node:module';
const original = fs.createReadStream;
fs.createReadStream = function(path, ...args) {
  if (String(path).endsWith('/read-error.wav')) return new Readable({read(){ this.destroy(Object.assign(new Error('injected read error'), {code:'ENOENT'})); }});
  if (String(path).endsWith('/partial-error.wav')) return new Readable({read(){ if (this.sent) return; this.sent = true; this.push(Buffer.from('part')); setTimeout(() => this.destroy(new Error('injected partial read error')), 25); }});
  return original.call(this, path, ...args);
};
syncBuiltinESMExports();`);
  const socket = createServer(); await new Promise<void>(done => socket.listen(0, '127.0.0.1', done));
  const address = socket.address(); assert.ok(address && typeof address !== 'string');
  const port = address.port; await new Promise<void>(done => socket.close(() => done()));
  const env: NodeJS.ProcessEnv = {...process.env, FRAMEFORGE_PROJECT: temp, NODE_OPTIONS: `--import ${preload}`}; delete env.VIDEO_ENTRY;
  const child = spawn(process.execPath, [join(engine, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {cwd: engine, env, stdio: 'pipe'});
  let logs = ''; child.stderr.on('data', chunk => { logs += String(chunk); });
  try {
    const base = `http://127.0.0.1:${port}`;
    let ready = false;
    for (let i = 0; i < 200 && !ready; i++) { if (child.exitCode !== null) throw new Error(logs); try { await fetch(base); ready = true; } catch { await pause(50); } }
    assert.ok(ready, logs);
    for (const path of [`/audio/generated/${slug}/voice.wav`, `/%61udio/generated/${slug}/voice.wav`, `/${slug}.wav`, `/@fs${file}`]) {
      const response = await fetch(base + path); assert.equal(response.status, 403, path);
      assert.doesNotMatch(await response.text(), /sensitive sentinel/);
    }
    const listing = await (await fetch(`${base}/__frameforge/static-files`)).text();
    assert.ok(!listing.includes(`audio/generated/${slug}/`) && !listing.includes(`${slug}.wav`), 'the shared output and its symlink alias are excluded from the listing');
    assert.equal(readFileSync(file, 'utf8'), 'sensitive sentinel');
    const local = await fetch(`${base}/music.wav`); assert.equal(await local.text(), 'project-local-audio');
    const range = await fetch(`${base}/music.wav`, {headers: {Range: 'bytes=1-4'}});
    assert.equal(range.status, 206); assert.equal(await range.text(), 'roje');
    assert.equal((await fetch(`${base}/music.wav`, {method: 'HEAD'})).headers.get('content-length'), '19');
    const flac = await fetch(`${base}/${mediaName}`);
    assert.equal(flac.headers.get('content-type'), 'audio/flac'); assert.equal(await flac.text(), 'project music');
    assert.equal(readFileSync(engineMedia, 'utf8'), 'engine music', 'the same-name engine file is unchanged');
    const unsupported = await fetch(`${base}/unsupported.unknown`, {headers: {'sec-fetch-dest': 'audio'}});
    assert.equal(unsupported.status, 403); assert.match(await unsupported.text(), /Unsupported project media format/);
    const bad = await fetch(`${base}/read-error.wav`); assert.equal(bad.status, 500); assert.match(await bad.text(), /Project media read failed/);
    assert.equal(await (await fetch(`${base}/music.wav`)).text(), 'project-local-audio', 'server survives a stream error');
    const partial = await fetch(`${base}/partial-error.wav`); assert.equal(partial.status, 200);
    await assert.rejects(partial.text(), /terminated|aborted|fetch/i, 'a partial response is closed when its stream fails');
    assert.equal(await (await fetch(`${base}/music.wav`)).text(), 'project-local-audio', 'server survives a partial stream error');
    const priorProject = process.env.FRAMEFORGE_PROJECT;
    try {
      process.env.FRAMEFORGE_PROJECT = temp;
      const clip = (src: string) => [{clip: {src, trimBefore: 0, startFrame: 0, volume: 1}, first: 0, last: 0}];
      assert.ok(encodeArgs([], [], 30, 1, clip(`/${mediaName}`), 'out.mp4').includes(realpathSync(join(temp, 'public', mediaName))));
      assert.throws(() => encodeArgs([], [], 30, 1, clip('/unsupported.unknown'), 'out.mp4'), /Unsupported project media format/);
    } finally { if (priorProject === undefined) delete process.env.FRAMEFORGE_PROJECT; else process.env.FRAMEFORGE_PROJECT = priorProject; }
  } finally {
    child.kill('SIGTERM'); await new Promise<void>(done => child.once('exit', () => done()));
    rmSync(alias, {force: true}); rmSync(engineMedia, {force: true}); rmSync(shared, {recursive: true, force: true}); rmSync(temp, {recursive: true, force: true});
  }
});

test('a project-local authored WAV is actually mixed into its render', {timeout: 120000}, async () => {
  const temp = mkdtempSync(join(tmpdir(), 'ff-project-wav-'));
  const project = join(temp, 'project'); mkdirSync(project); mkdirSync(join(project, 'public'));
  writeFileSync(join(project, 'frameforge.json'), JSON.stringify({films: 'films'}));
  symlinkSync(join(engine, 'node_modules'), join(project, 'node_modules'), 'dir');
  const wav = join(project, 'public', 'music.wav');
  const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
  const made = spawnSync(ffmpeg, ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=1', '-c:a', 'pcm_s16le', wav], {encoding: 'utf8'});
  assert.equal(made.status, 0, made.stderr);
  const entry = join(project, 'entry.tsx');
  writeFileSync(entry, `import {AbsoluteFill, Audio, Composition, registerRoot} from 'frameforge';
function Film(){return <AbsoluteFill style={{background:'#345'}}><Audio src="/music.wav" /></AbsoluteFill>}
registerRoot(() => <Composition id="OwnMusic" component={Film} fps={30} durationInFrames={30} width={128} height={128}/>);`);
  const socket = createServer(); await new Promise<void>(done => socket.listen(0, '127.0.0.1', done));
  const address = socket.address(); assert.ok(address && typeof address !== 'string'); const port = address.port;
  await new Promise<void>(done => socket.close(() => done()));
  const env: NodeJS.ProcessEnv = {...process.env, FRAMEFORGE_PROJECT: project, FRAMEFORGE_PORT: String(port)}; delete env.VIDEO_ENTRY;
  const output = join(project, 'own.mp4');
  try {
    const render = spawnSync(process.execPath, [join(engine, 'scripts/render.mjs'), entry, 'OwnMusic', output], {cwd: engine, env, encoding: 'utf8', timeout: 100000});
    assert.equal(render.status, 0, `${render.stdout}\n${render.stderr}`);
    const decoded = spawnSync(ffmpeg, ['-v', 'error', '-i', output, '-map', '0:a:0', '-f', 's16le', '-'], {maxBuffer: 4 << 20});
    assert.equal(decoded.status, 0, decoded.stderr.toString());
    assert.ok(decoded.stdout.some(byte => byte !== 0), 'the output contains the locally authored sound');
  } finally { rmSync(temp, {recursive: true, force: true}); }
});
