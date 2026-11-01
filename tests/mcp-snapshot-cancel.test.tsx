import assert from 'node:assert/strict';
import {spawn, spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
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
  const client = new Client({name: 'snapshot-cancel-test', version: '0'});
  const sentinel = spawn('/bin/sleep', ['30'], {detached: true, stdio: 'ignore'});
  const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  try {
    await client.connect(new StdioClientTransport({command: process.execPath, args: [join(ENGINE, 'bin/frameforge.mjs'), 'mcp', '--project', project], cwd: scratch, env: {...process.env, TMPDIR: temp, FRAMEFORGE_PORT: String(41000 + process.pid % 10000)} as Record<string, string>, stderr: 'pipe'}));
    const prepared = await client.callTool({name: 'audio_snapshot_prepare', arguments: {snapshot: 'full.wav', manifest: 'full.json', composition: 'Cancel', fps: 30, duration_in_frames: 90}});
    assert.ok(!prepared.isError, JSON.stringify(prepared));
    const controller = new AbortController();
    const pending = client.callTool({name: 'render', arguments: {slug: 'cancel', frame_range: [1, 89], audio_snapshot: 'full.wav', audio_snapshot_manifest: 'full.json'}}, undefined, {signal: controller.signal});
    let staged = false;
    for (let n = 0; n < 400 && !staged; n++) {
      const files = readdirSync(temp);
      staged = files.some(name => name.startsWith('frameforge-snapshot-') && existsSync(join(temp, name, 'snapshot.wav'))) &&
        files.some(name => name.startsWith('frameforge-') && !name.startsWith('frameforge-snapshot-'));
      if (!staged) await pause(25);
    }
    assert.ok(staged, 'the private snapshot copy exists and rendering has begun before cancellation');
    controller.abort();
    await assert.rejects(pending, /abort|cancel/i);
    for (let n = 0; n < 200 && readdirSync(temp).some(name => name.startsWith('frameforge-snapshot-')); n++) await pause(25);
    assert.equal(readdirSync(temp).some(name => name.startsWith('frameforge-snapshot-')), false, 'the renderer removes its own snapshot copy');
    assert.equal(sentinel.exitCode, null, 'an unrelated process group was not signalled');
    assert.equal(sentinel.signalCode, null);
  } finally {
    sentinel.kill('SIGKILL');
    await client.close();
    rmSync(scratch, {recursive: true, force: true});
  }
});
