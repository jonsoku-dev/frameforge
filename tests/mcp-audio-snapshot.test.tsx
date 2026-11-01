import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {ENGINE} from '../bin/frameforge.mjs';

test('MCP exposes snapshot inputs and rejects incomplete or unsafe combinations before rendering', async () => {
  const scratch = realpathSync(mkdtempSync(join(tmpdir(), 'ff-mcp-snapshot-')));
  const project = join(scratch, 'project');
  const client = new Client({name: 'snapshot-test', version: '0'});
  await client.connect(new StdioClientTransport({command: process.execPath, args: [join(ENGINE, 'bin/frameforge.mjs'), 'mcp'], cwd: scratch, stderr: 'pipe'}));
  try {
    const render = (await client.listTools()).tools.find(tool => tool.name === 'render');
    assert.ok(render);
    assert.match(JSON.stringify(render.inputSchema.properties?.audio_snapshot), /"type":"string"/);
    assert.match(JSON.stringify(render.inputSchema.properties?.audio_snapshot_manifest), /"type":"string"/);
    assert.ok(!render.inputSchema.required?.includes('audio_snapshot'));
    assert.ok(!render.inputSchema.required?.includes('audio_snapshot_manifest'));
    const init = await client.callTool({name: 'project_init', arguments: {dir: project}});
    assert.ok(!init.isError, JSON.stringify(init));
    const base = {slug: 'spot', frame_range: [1, 2], audio_snapshot: 'audio/full.wav', audio_snapshot_manifest: 'audio/full.json'};
    for (const [label, args] of [
      ['snapshot alone', {slug: 'spot', frame_range: [1, 2], audio_snapshot: base.audio_snapshot}],
      ['manifest alone', {slug: 'spot', frame_range: [1, 2], audio_snapshot_manifest: base.audio_snapshot_manifest}],
      ['missing range', {slug: 'spot', audio_snapshot: base.audio_snapshot, audio_snapshot_manifest: base.audio_snapshot_manifest}],
      ['reverse range', {...base, frame_range: [2, 1]}],
      ['negative range', {...base, frame_range: [-1, 1]}],
      ['absolute path', {...base, audio_snapshot: '/tmp/full.wav'}],
      ['URL scheme', {...base, audio_snapshot: 'https://example.com/full.wav'}],
      ['backslash path', {...base, audio_snapshot: 'audio\\full.wav'}],
      ['traversal', {...base, audio_snapshot: 'link/../full.wav'}],
      ['manifest traversal', {...base, audio_snapshot_manifest: '../full.json'}],
      ['empty path', {...base, audio_snapshot: ''}],
      ['wrong extension', {...base, audio_snapshot_manifest: 'audio/full.wav'}],
    ] as const) {
      const result = await client.callTool({name: 'render', arguments: args});
      assert.equal(result.isError, true, `${label}: ${JSON.stringify(result)}`);
    }
    assert.ok(!existsSync(join(project, 'renders')), 'invalid requests did not start the renderer');
  } finally {
    await client.close();
    rmSync(scratch, {recursive: true, force: true});
  }
});

test('MCP prepares an explicit snapshot manifest without overwriting or following symlinks', {
  timeout: 30_000,
  skip: process.platform === 'win32' ? 'snapshot containment requires POSIX openat' : false,
}, async () => {
  const scratch = realpathSync(mkdtempSync(join(tmpdir(), 'ff-mcp-snapshot-prepare-')));
  const project = join(scratch, 'project');
  const client = new Client({name: 'snapshot-prepare-test', version: '0'});
  try {
    await client.connect(new StdioClientTransport({command: process.execPath, args: [join(ENGINE, 'bin/frameforge.mjs'), 'mcp'], cwd: scratch, stderr: 'pipe'}));
    const tool = (await client.listTools()).tools.find(item => item.name === 'audio_snapshot_prepare');
    assert.ok(tool);
    assert.equal(tool.annotations?.readOnlyHint, false);
    assert.ok(!(await client.callTool({name: 'project_init', arguments: {dir: project}})).isError);
    const wav = join(project, 'full.wav');
    const made = spawnSync(process.env.FFMPEG_PATH || 'ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=1', '-c:a', 'pcm_s16le', wav], {encoding: 'utf8'});
    assert.equal(made.status, 0, made.stderr);
    const args = {snapshot: 'full.wav', manifest: 'snapshot.json', composition: 'Example', fps: 30, duration_in_frames: 30};
    const result = await client.callTool({name: 'audio_snapshot_prepare', arguments: args});
    assert.ok(!result.isError, JSON.stringify(result));
    const content = result.content;
    assert.ok(Array.isArray(content) && content[0]?.type === 'text' && typeof content[0].text === 'string');
    const output = JSON.parse(content[0].text);
    const path = join(project, 'snapshot.json');
    const before = readFileSync(path);
    const expected = {version: 1, composition: 'Example', fps: 30, durationInFrames: 30, sha256: createHash('sha256').update(readFileSync(wav)).digest('hex')};
    assert.deepEqual(JSON.parse(before.toString()), expected);
    assert.deepEqual(output.metadata, expected);
    assert.equal(output.provenance, 'NOT_VERIFIED');
    assert.equal(output.currentSourceMatch, 'NOT_VERIFIED');
    assert.equal((await client.callTool({name: 'audio_snapshot_prepare', arguments: args})).isError, true);
    assert.deepEqual(readFileSync(path), before, 'the existing manifest is preserved');
    symlinkSync(wav, join(project, 'link.wav'));
    for (const invalid of [
      {...args, snapshot: 'link.wav', manifest: 'link.json'},
      {...args, snapshot: '../full.wav', manifest: 'traversal.json'},
      {...args, manifest: '../outside.json'},
      {...args, fps: 0, manifest: 'zero.json'},
    ]) assert.equal((await client.callTool({name: 'audio_snapshot_prepare', arguments: invalid})).isError, true);
    assert.ok(!existsSync(join(scratch, 'outside.json')));
  } finally {
    await client.close();
    rmSync(scratch, {recursive: true, force: true});
  }
});

test('MCP forwards an explicit snapshot and returns its provenance from a real partial render', {
  timeout: 120_000,
  skip: process.platform === 'win32' ? 'snapshot containment requires POSIX openat' : false,
}, async () => {
  const scratch = realpathSync(mkdtempSync(join(tmpdir(), 'ff-mcp-snapshot-render-')));
  const project = join(scratch, 'project');
  const client = new Client({name: 'snapshot-render-test', version: '0'});
  try {
    await client.connect(new StdioClientTransport({
      command: process.execPath, args: [join(ENGINE, 'bin/frameforge.mjs'), 'mcp'], cwd: scratch,
      env: {...process.env, FRAMEFORGE_PORT: String(30000 + process.pid % 20000)} as Record<string, string>, stderr: 'pipe',
    }));
    assert.ok(!(await client.callTool({name: 'project_init', arguments: {dir: project}})).isError);
    symlinkSync(join(ENGINE, 'node_modules'), join(project, 'node_modules'), 'dir');
    assert.ok(!(await client.callTool({name: 'film_new', arguments: {slug: 'snapshot'}})).isError);
    const film = join(project, 'films', 'snapshot');
    rmSync(join(film, 'audio.json'));
    writeFileSync(join(film, 'entry.tsx'), `
import {Composition, registerRoot, useCurrentFrame} from 'frameforge';
function Spot() { const frame = useCurrentFrame(); return <div style={{width:128,height:128,background:frame % 2 ? 'white' : 'blue'}} />; }
registerRoot(() => <Composition id="Snapshot" component={Spot} durationInFrames={90} fps={30} width={128} height={128}/>);
`);
    const snapshots = join(project, 'snapshots');
    mkdirSync(snapshots);
    const snapshot = join(snapshots, 'full.wav');
    const made = spawnSync(process.env.FFMPEG_PATH || 'ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=3', '-c:a', 'pcm_s16le', '-ac', '2', snapshot], {encoding: 'utf8'});
    assert.equal(made.status, 0, made.stderr);
    const sha256 = createHash('sha256').update(readFileSync(snapshot)).digest('hex');
    const prepared = await client.callTool({name: 'audio_snapshot_prepare', arguments: {snapshot: 'snapshots/full.wav', manifest: 'snapshots/full.json', composition: 'Snapshot', fps: 30, duration_in_frames: 90}});
    assert.ok(!prepared.isError, JSON.stringify(prepared));
    const result = await client.callTool({name: 'render', arguments: {slug: 'snapshot', frame_range: [30, 32], audio_snapshot: 'snapshots/full.wav', audio_snapshot_manifest: 'snapshots/full.json'}});
    assert.ok(!result.isError, JSON.stringify(result));
    const content = result.content;
    assert.ok(Array.isArray(content) && content[0]?.type === 'text' && typeof content[0].text === 'string');
    const output = JSON.parse(content[0].text);
    assert.ok(existsSync(output.video));
    assert.equal(output.summary.frames, 3);
    assert.deepEqual(output.requestedFrameRange, [30, 32]);
    assert.equal(output.summary.audioSnapshot.source, 'snapshots/full.wav');
    assert.equal(output.summary.audioSnapshot.sha256, sha256);
    assert.equal(output.summary.audioSnapshot.from, 30);
    assert.equal(output.summary.audioSnapshot.to, 32);
    assert.equal(output.summary.audioSnapshot.semanticMatch, 'NOT_VERIFIED');
  } finally {
    await client.close();
    rmSync(scratch, {recursive: true, force: true});
  }
});
