import assert from 'node:assert/strict';
import {spawn, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {ENGINE} from '../bin/frameforge.mjs';

test('MCP cancellation removes the active snapshot copy without signalling an unrelated process group', {
  timeout: 60000,
  skip: process.platform === 'win32' ? 'snapshot staging and process groups require POSIX' : false,
}, async () => {
  const scratch = realpathSync(mkdtempSync(join(tmpdir(), 'ff-mcp-snapshot-cancel-')));
  const project = join(scratch, 'project'), temp = join(scratch, 'temp');
  mkdirSync(project); mkdirSync(temp);
  const film = join(project, 'films', 'cancel');
  mkdirSync(film, {recursive: true});
  writeFileSync(join(project, 'frameforge.json'), JSON.stringify({engine: ENGINE, films: 'films'}));
  symlinkSync(join(ENGINE, 'node_modules'), join(project, 'node_modules'), 'dir');
  writeFileSync(join(film, 'entry.tsx'), `
import {Composition, registerRoot, useCurrentFrame} from 'frameforge';
function Spot() {const frame = useCurrentFrame(); return <div style={{width:1280,height:720,background:frame % 2 ? 'white' : 'blue'}}/>;}
registerRoot(() => <Composition id="Cancel" component={Spot} durationInFrames={90} fps={30} width={1280} height={720}/>);
`);
  const wav = join(project, 'full.wav');
  const made = spawnSync(process.env.FFMPEG_PATH || 'ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=3', '-c:a', 'pcm_s16le', wav], {encoding: 'utf8'});
  assert.equal(made.status, 0, made.stderr);
  const chrome = process.env.CHROME_PATH || [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
  ].find(existsSync);
  assert.ok(chrome, 'an installed Chrome is needed for the real cancellation test');
  const browserPid = join(scratch, 'browser.pid'), wrapper = join(scratch, 'chrome-wrapper');
  writeFileSync(wrapper, '#!/bin/sh\nprintf "%s" "$$" > "$FRAMEFORGE_TEST_CHROME_PID"\nexec "$FRAMEFORGE_TEST_REAL_CHROME" "$@"\n');
  chmodSync(wrapper, 0o755);
  const client = new Client({name: 'snapshot-cancel-test', version: '0'});
  const sentinel = spawn('/bin/sleep', ['30'], {detached: true, stdio: 'ignore'});
  const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  try {
    await client.connect(new StdioClientTransport({command: process.execPath, args: [join(ENGINE, 'bin/frameforge.mjs'), 'mcp', '--project', project], cwd: scratch, env: {...process.env, TMPDIR: temp, FRAMEFORGE_PORT: String(41000 + process.pid % 10000), CHROME_PATH: wrapper, FRAMEFORGE_TEST_CHROME_PID: browserPid, FRAMEFORGE_TEST_REAL_CHROME: chrome} as Record<string, string>, stderr: 'pipe'}));
    const prepared = await client.callTool({name: 'audio_snapshot_prepare', arguments: {snapshot: 'full.wav', manifest: 'full.json', composition: 'Cancel', fps: 30, duration_in_frames: 90}});
    assert.ok(!prepared.isError, JSON.stringify(prepared));
    const controller = new AbortController();
    const pending = client.callTool({name: 'render', arguments: {slug: 'cancel', frame_range: [1, 89], audio_snapshot: 'full.wav', audio_snapshot_manifest: 'full.json'}}, undefined, {signal: controller.signal});
    let staged = false;
    for (let n = 0; n < 400 && !staged; n++) {
      const files = readdirSync(temp);
      staged = files.some(name => name.startsWith('frameforge-snapshot-') && existsSync(join(temp, name, 'snapshot.wav'))) &&
        files.some(name => name.startsWith('frameforge-') && !name.startsWith('frameforge-snapshot-') && existsSync(join(temp, name, 'profile-0', 'DevToolsActivePort'))) && existsSync(browserPid);
      if (!staged) await pause(25);
    }
    assert.ok(staged, 'the private snapshot copy and Chrome DevTools exist before cancellation');
    const pid = Number(readFileSync(browserPid, 'utf8'));
    assert.ok(Number.isSafeInteger(pid) && pid > 0);
    const browserRunning = () => {
      try { process.kill(pid, 0); return true; } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false; throw error; }
    };
    assert.ok(browserRunning(), 'the renderer-owned Chrome is alive before cancellation');
    controller.abort();
    await assert.rejects(pending, /abort|cancel/i);
    for (let n = 0; n < 200 && readdirSync(temp).some(name => name.startsWith('frameforge-snapshot-')); n++) await pause(25);
    assert.equal(readdirSync(temp).some(name => name.startsWith('frameforge-snapshot-')), false, 'the renderer removes its own snapshot copy');
    for (let n = 0; n < 200 && browserRunning(); n++) await pause(25);
    assert.equal(browserRunning(), false, 'the renderer-owned Chrome is no longer running after cancellation');
    assert.equal(sentinel.exitCode, null, 'an unrelated process group was not signalled');
    assert.equal(sentinel.signalCode, null);
  } finally {
    sentinel.kill('SIGKILL');
    // If an assertion fails before cancellation completes, do not leave the
    // test's own browser running. Confirm the unique wrapper/profile in the
    // current process command first; never signal a PID on the marker alone.
    if (existsSync(browserPid)) {
      const raw = readFileSync(browserPid, 'utf8').trim();
      const pid = /^\d+$/.test(raw) ? Number(raw) : 0;
      const owned = () => {
        if (!Number.isSafeInteger(pid) || pid < 2) return false;
        const ps = spawnSync('ps', ['-p', String(pid), '-o', 'command='], {encoding: 'utf8'});
        return ps.status === 0 && (ps.stdout.includes(wrapper) || ps.stdout.includes(`--user-data-dir=${temp}/frameforge-`));
      };
      if (owned()) {
        try { process.kill(pid, 'SIGKILL'); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
        for (let n = 0; n < 80 && owned(); n++) await pause(25);
      }
    }
    await client.close();
    rmSync(scratch, {recursive: true, force: true});
  }
});

test('direct SIGTERM stops the renderer-owned Chrome during a snapshot render', {
  timeout: 60000,
  skip: process.platform === 'win32' ? 'snapshot staging and process inspection require POSIX' : false,
}, async () => {
  const scratch = realpathSync(mkdtempSync(join(tmpdir(), 'ff-direct-snapshot-cancel-')));
  const project = join(scratch, 'project'), temp = join(scratch, 'temp');
  mkdirSync(project); mkdirSync(temp);
  writeFileSync(join(project, 'frameforge.json'), JSON.stringify({engine: ENGINE, films: 'films'}));
  symlinkSync(join(ENGINE, 'node_modules'), join(project, 'node_modules'), 'dir');
  const entry = join(project, 'entry.tsx');
  writeFileSync(entry, `import {Composition, registerRoot} from 'frameforge';
function Spot() {return <div style={{width:1280,height:720,background:'blue'}}/>;}
registerRoot(() => <Composition id="Cancel" component={Spot} durationInFrames={90} fps={30} width={1280} height={720}/>);`);
  const wav = join(project, 'full.wav');
  const made = spawnSync(process.env.FFMPEG_PATH || 'ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=3', '-c:a', 'pcm_s16le', wav], {encoding: 'utf8'});
  assert.equal(made.status, 0, made.stderr);
  const digest = createHash('sha256').update(readFileSync(wav)).digest('hex');
  writeFileSync(join(project, 'full.json'), JSON.stringify({version: 1, composition: 'Cancel', fps: 30, durationInFrames: 90, sha256: digest}));
  const chrome = process.env.CHROME_PATH || [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
  ].find(existsSync);
  assert.ok(chrome, 'an installed Chrome is needed for the real cancellation test');
  const browserPid = join(scratch, 'browser.pid'), wrapper = join(scratch, 'chrome-wrapper');
  writeFileSync(wrapper, '#!/bin/sh\nprintf "%s" "$$" > "$FRAMEFORGE_TEST_CHROME_PID"\nexec "$FRAMEFORGE_TEST_REAL_CHROME" "$@"\n');
  chmodSync(wrapper, 0o755);
  const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  const renderer = spawn(process.execPath, [join(ENGINE, 'scripts/render.mjs'), entry, 'Cancel', join(project, 'out.mp4'), '{}', '--frame-range', '1-89', '--audio-snapshot', 'full.wav', '--audio-snapshot-manifest', 'full.json'], {
    cwd: ENGINE, env: {...process.env, FRAMEFORGE_PROJECT: project, TMPDIR: temp, FRAMEFORGE_PORT: String(30000 + process.pid % 10000), CHROME_PATH: wrapper, FRAMEFORGE_TEST_CHROME_PID: browserPid, FRAMEFORGE_TEST_REAL_CHROME: chrome},
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let stderr = ''; renderer.stderr.on('data', part => { stderr += String(part); });
  const ended = new Promise<void>(done => renderer.once('close', () => done()));
  try {
    let ready = false;
    for (let n = 0; n < 400 && !ready; n++) {
      if (renderer.exitCode !== null || renderer.signalCode !== null) throw new Error(`renderer exited before Chrome was ready: ${stderr}`);
      ready = existsSync(browserPid) && readdirSync(temp).some(name => name.startsWith('frameforge-') && !name.startsWith('frameforge-snapshot-') && existsSync(join(temp, name, 'profile-0', 'DevToolsActivePort')));
      if (!ready) await pause(25);
    }
    assert.ok(ready, `renderer-owned Chrome DevTools must start: ${stderr}`);
    const pid = Number(readFileSync(browserPid, 'utf8'));
    assert.ok(Number.isSafeInteger(pid) && pid > 1);
    const running = () => { try { process.kill(pid, 0); return true; } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false; throw error; } };
    assert.ok(running(), 'renderer-owned Chrome is alive before cancellation');
    renderer.kill('SIGTERM'); // Signal only the renderer, not its Chrome process group.
    await ended;
    for (let n = 0; n < 200 && running(); n++) await pause(25);
    assert.equal(running(), false, 'renderer-owned Chrome must stop after direct SIGTERM');
    assert.ok(!readdirSync(temp).some(name => name.startsWith('frameforge-snapshot-')), 'snapshot copy is removed');
  } finally {
    if (renderer.exitCode === null && renderer.signalCode === null) renderer.kill('SIGKILL');
    if (existsSync(browserPid)) {
      const raw = readFileSync(browserPid, 'utf8').trim();
      const pid = /^\d+$/.test(raw) ? Number(raw) : 0;
      if (Number.isSafeInteger(pid) && pid > 1) {
        const ps = spawnSync('ps', ['-p', String(pid), '-o', 'command='], {encoding: 'utf8'});
        if (ps.status === 0 && (ps.stdout.includes(wrapper) || ps.stdout.includes(`--user-data-dir=${temp}/frameforge-`))) {
          try { process.kill(pid, 'SIGKILL'); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
        }
      }
    }
    await ended;
    rmSync(scratch, {recursive: true, force: true});
  }
});
