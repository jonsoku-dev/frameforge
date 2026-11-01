import assert from 'node:assert/strict';
import test from 'node:test';
import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {createServer} from 'node:net';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';

const engine = resolve(import.meta.dirname, '..');
const pause = (ms: number) => new Promise(resolvePause => setTimeout(resolvePause, ms));

async function availablePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolveListen, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolveListen); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No loopback port');
  await new Promise<void>((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose()));
  return address.port;
}

test('snapshot Vite mode serves existing generated assets but never runs their generators', {timeout: 60000}, async () => {
  const root = mkdtempSync(join(tmpdir(), 'frameforge-snapshot-vite-'));
  const slug = `snapshot${randomBytes(8).toString('hex')}`;
  const film = join(root, 'films', slug);
  const images = join(engine, 'public/assets/generated', slug);
  const audio = join(engine, 'public/audio/generated', slug);
  mkdirSync(film, {recursive: true});
  mkdirSync(images, {recursive: true});
  mkdirSync(audio, {recursive: true});
  writeFileSync(join(root, 'frameforge.json'), JSON.stringify({engine, films: 'films'}));
  // Invalid JSON fails before any provider lookup; default-mode logs prove each generator was attempted.
  writeFileSync(join(film, 'assets.json'), '{');
  writeFileSync(join(film, 'audio.json'), '{');
  writeFileSync(join(images, 'existing.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  writeFileSync(join(audio, 'existing.wav'), 'existing audio');

  try {
    for (const snapshot of [true, false]) {
      const port = await availablePort();
      const child = spawn(process.execPath, [join(engine, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
        cwd: engine, env: {...process.env, FRAMEFORGE_PROJECT: root, FRAMEFORGE_SNAPSHOT_NO_GENERATE: snapshot ? '1' : '0'}, stdio: ['ignore', 'pipe', 'pipe'],
      });
      let logs = '';
      child.stdout.on('data', chunk => { logs += String(chunk); });
      child.stderr.on('data', chunk => { logs += String(chunk); });
      const base = `http://127.0.0.1:${port}`;
      const get = (path: string) => fetch(`${base}${path}`);
      try {
        let ready = false;
        for (let tries = 0; tries < 200 && !ready; tries++) {
          if (child.exitCode !== null) throw new Error(`Vite exited: ${logs}`);
          try { await get('/'); ready = true; } catch { await pause(50); }
        }
        assert.ok(ready, `Vite did not start: ${logs}`);
        assert.equal(await (await get(`/assets/generated/${slug}/existing.svg`)).text(), '<svg xmlns="http://www.w3.org/2000/svg"/>');
        assert.equal((await get(`/audio/generated/${slug}/existing.wav`)).status, 403, 'shared generated audio is unavailable to outside projects');
        const missingArt = await get(`/assets/generated/${slug}/missing.svg`);
        const missingAudio = await get(`/audio/generated/${slug}/missing.wav`);
        if (snapshot) {
          assert.equal(missingArt.status, 404);
          assert.match(await missingArt.text(), /Snapshot render requires existing asset/);
          assert.equal(missingAudio.status, 403);
          assert.match(await missingAudio.text(), /External project access to engine-generated audio is disabled/);
          assert.doesNotMatch(logs, /\[(art|score)\]/);
        } else {
          for (let tries = 0; tries < 40 && !logs.includes(`[art] ${slug}`); tries++) await pause(50);
          assert.match(logs, new RegExp(`\\[art\\] ${slug}`));
          assert.equal(missingAudio.status, 403);
          assert.doesNotMatch(logs, /\[score\]/);
        }
      } finally {
        child.kill('SIGTERM');
        await new Promise<void>(resolveExit => { if (child.exitCode !== null || child.signalCode !== null) resolveExit(); else child.once('exit', () => resolveExit()); });
      }
    }
  } finally {
    rmSync(root, {recursive: true, force: true});
    rmSync(images, {recursive: true, force: true});
    rmSync(audio, {recursive: true, force: true});
  }
});
