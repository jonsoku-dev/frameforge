import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {ENGINE} from '../bin/frameforge.mjs';

type Result = {content: {type: string; text?: string; data?: string}[]; isError?: boolean};
const body = (result: Result) => result.content.map(item => item.text ?? '').join('\n');
const pixels = (image: string) => {
  const result = spawnSync('ffmpeg', ['-v', 'error', '-f', 'image2pipe', '-vcodec', 'png', '-i', 'pipe:0', '-vf', 'scale=1:1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'], {input: Buffer.from(image, 'base64')});
  assert.equal(result.status, 0, result.stderr.toString());
  return [...result.stdout];
};

test('MCP inspects the saved MP4 rather than a later source revision', {timeout: 120000, skip: process.platform === 'win32'}, async () => {
  const scratch = realpathSync(mkdtempSync(join(tmpdir(), 'ff-mcp-video-')));
  const project = join(scratch, 'project');
  const temporary = join(scratch, 'tmp');
  mkdirSync(temporary);
  const client = new Client({name: 'mcp-video-test', version: '0'});
  try {
    await client.connect(new StdioClientTransport({
      command: process.execPath, args: [join(ENGINE, 'bin/frameforge.mjs'), 'mcp'], cwd: scratch,
      env: {...process.env, TMPDIR: temporary, FRAMEFORGE_PORT: String(30000 + process.pid % 20000)} as Record<string, string>, stderr: 'pipe',
    }));
    const call = (name: string, args: Record<string, unknown>) => client.callTool({name, arguments: args}) as Promise<Result>;
    assert.ok(!(await call('project_init', {dir: project})).isError);
    symlinkSync(join(ENGINE, 'node_modules'), join(project, 'node_modules'), 'dir');
    assert.ok(!(await call('film_new', {slug: 'example'})).isError);
    const folder = join(project, 'films', 'example');
    rmSync(join(folder, 'audio.json'));
    writeFileSync(join(folder, 'entry.tsx'), `
import {Composition, registerRoot} from 'frameforge';
const Spot = () => <div style={{width:128,height:128,background:'blue'}}/>;
registerRoot(() => <Composition id="Example" component={Spot} durationInFrames={4} fps={4} width={128} height={128}/>);
`);
    const saved = join(project, 'saved.mp4');
    const encoded = spawnSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=red:s=64x64:r=4', '-t', '1', '-pix_fmt', 'yuv420p', saved], {encoding: 'utf8'});
    assert.equal(encoded.status, 0, encoded.stderr);
    const sha256 = createHash('sha256').update(readFileSync(saved)).digest('hex');

    const sampled = await call('video_frames', {video: saved, frames: [3, 0], max_dimension: 64});
    assert.ok(!sampled.isError, body(sampled));
    const metadata = JSON.parse(body(sampled)) as {source: {path: string; sha256: string}; frames: {frame: number; timestampSeconds: number}[]; observation: string};
    assert.equal(metadata.source.path, saved);
    assert.equal(metadata.source.sha256, sha256);
    assert.deepEqual(metadata.frames, [{frame: 0, timestampSeconds: 0}, {frame: 3, timestampSeconds: 0.75}]);
    assert.match(metadata.observation, /not normal-speed playback or listening/);
    const sampledImages = sampled.content.filter(item => item.type === 'image');
    assert.equal(sampledImages.length, 2);
    const red = pixels(sampledImages[0]!.data!);
    assert.ok(red[0]! > 180 && red[2]! < 40, `saved MP4 is red: ${red}`);
    assert.equal(createHash('sha256').update(readFileSync(saved)).digest('hex'), sha256, 'source MP4 is unchanged');

    const variable = join(project, 'variable.mp4');
    const vfr = spawnSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=64x64:rate=4:duration=1', '-vf', 'setpts=if(eq(N\\,0)\\,0\\,if(eq(N\\,1)\\,1\\,if(eq(N\\,2)\\,3\\,6)))', '-fps_mode', 'vfr', '-pix_fmt', 'yuv420p', variable], {encoding: 'utf8'});
    assert.equal(vfr.status, 0, vfr.stderr);
    const vfrSample = await call('video_frames', {video: variable, frames: [2]});
    assert.ok(!vfrSample.isError, body(vfrSample));
    const vfrFrames = (JSON.parse(body(vfrSample)) as {frames: {frame: number; timestampSeconds: number}[]}).frames;
    assert.deepEqual(vfrFrames, [{frame: 2, timestampSeconds: 0.75}], 'reports the actual VFR timestamp, not frame / nominal rate');

    const current = await call('still', {slug: 'example', frame: 0});
    assert.ok(!current.isError, body(current));
    const blue = pixels(current.content.find(item => item.type === 'image')!.data!);
    assert.ok(blue[2]! > 180 && blue[0]! < 40, `current source is blue: ${blue}`);
    assert.notDeepEqual(red, blue);

    const outside = join(scratch, 'outside.mp4');
    writeFileSync(outside, readFileSync(saved));
    symlinkSync(outside, join(project, 'linked.mp4'));
    symlinkSync(scratch, join(project, 'linked-dir'));
    const fifo = join(project, 'pipe.mp4');
    assert.equal(spawnSync('mkfifo', [fifo]).status, 0);
    for (const invalid of [outside, '../outside.mp4', 'linked.mp4', 'linked-dir/outside.mp4', 'pipe.mp4']) {
      const result = await call('video_frames', {video: invalid, frames: [0]});
      assert.equal(result.isError, true, `rejects ${invalid}`);
      assert.equal(result.content.some(item => item.type === 'image'), false);
    }
    for (const invalid of ['linked-dir/../saved.mp4', `${project}/linked-dir/../saved.mp4`]) {
      const result = await call('video_frames', {video: invalid, frames: [0]});
      assert.equal(result.isError, true, `rejects raw traversal ${invalid}`);
      assert.match(body(result), /must not contain \.\./);
      assert.equal(result.content.some(item => item.type === 'image'), false);
    }
    for (const frames of [[], [-1], [0.5], [1_000_001], Array(9).fill(0), [4]]) {
      const result = await call('video_frames', {video: saved, frames});
      assert.equal(result.isError, true, `rejects frames ${JSON.stringify(frames)}`);
      assert.equal(result.content.some(item => item.type === 'image'), false);
    }
    assert.equal(existsSync(join(temporary, 'frameforge-video-frames-')), false);
    assert.deepEqual(readdirSync(temporary).filter(name => name.startsWith('frameforge-video-frames-')), [], 'frame inspection cleans its temporary directory');
  } finally {
    await client.close();
    rmSync(scratch, {recursive: true, force: true});
  }
});

test('MCP rejects replacement of the project root during video inspection', {timeout: 30000, skip: process.platform === 'win32'}, async () => {
  const scratch = realpathSync(mkdtempSync(join(tmpdir(), 'ff-mcp-root-race-')));
  const project = join(scratch, 'project');
  const moved = join(scratch, 'project-moved');
  const replacement = join(scratch, 'replacement.mp4');
  const wrapper = join(scratch, 'swap-root-ffprobe');
  const client = new Client({name: 'mcp-root-race-test', version: '0'});
  try {
    mkdirSync(project);
    writeFileSync(join(project, 'frameforge.json'), JSON.stringify({engine: ENGINE, films: 'films'}));
    for (const [file, color] of [[join(project, 'saved.mp4'), 'red'], [replacement, 'blue']]) {
      const encoded = spawnSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', `color=c=${color}:s=64x64:r=4`, '-t', '1', '-pix_fmt', 'yuv420p', file!], {encoding: 'utf8'});
      assert.equal(encoded.status, 0, encoded.stderr);
    }
    const originalHash = createHash('sha256').update(readFileSync(join(project, 'saved.mp4'))).digest('hex');
    writeFileSync(wrapper, `#!/usr/bin/env python3\nimport os, shutil, sys\nos.rename(${JSON.stringify(project)}, ${JSON.stringify(moved)})\nos.mkdir(${JSON.stringify(project)})\nshutil.copy2(${JSON.stringify(replacement)}, os.path.join(${JSON.stringify(project)}, 'saved.mp4'))\nos.execvp('ffprobe', ['ffprobe', *sys.argv[1:]])\n`);
    chmodSync(wrapper, 0o755);
    await client.connect(new StdioClientTransport({
      command: process.execPath, args: [join(ENGINE, 'bin/frameforge.mjs'), 'mcp', '--project', project], cwd: scratch,
      env: {...process.env, FFPROBE_PATH: wrapper} as Record<string, string>, stderr: 'pipe',
    }));
    const result = await client.callTool({name: 'video_frames', arguments: {video: 'saved.mp4', frames: [0]}}) as Result;
    assert.equal(result.isError, true, body(result));
    assert.match(body(result), /project root changed during inspection/);
    assert.equal(result.content.some(item => item.type === 'image'), false, 'a replaced project root cannot produce a misleading source path');
    assert.equal(createHash('sha256').update(readFileSync(join(moved, 'saved.mp4'))).digest('hex'), originalHash);
  } finally {
    await client.close();
    rmSync(scratch, {recursive: true, force: true});
  }
});

test('MCP rejects a parent-directory symlink swap during video inspection', {timeout: 30000, skip: process.platform === 'win32'}, async () => {
  const scratch = realpathSync(mkdtempSync(join(tmpdir(), 'ff-mcp-video-race-')));
  const project = join(scratch, 'project');
  const inside = join(project, 'inside');
  const moved = join(project, 'moved');
  const outside = join(scratch, 'outside');
  const wrapper = join(scratch, 'swap-ffprobe');
  const client = new Client({name: 'mcp-video-race-test', version: '0'});
  try {
    mkdirSync(inside, {recursive: true});
    mkdirSync(outside);
    writeFileSync(join(project, 'frameforge.json'), JSON.stringify({engine: ENGINE, films: 'films'}));
    for (const [dir, color] of [[inside, 'red'], [outside, 'blue']]) {
      const encoded = spawnSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', `color=c=${color}:s=64x64:r=4`, '-t', '1', '-pix_fmt', 'yuv420p', join(dir!, 'saved.mp4')], {encoding: 'utf8'});
      assert.equal(encoded.status, 0, encoded.stderr);
    }
    const originalHash = createHash('sha256').update(readFileSync(join(inside, 'saved.mp4'))).digest('hex');
    writeFileSync(wrapper, `#!/usr/bin/env python3\nimport os, sys\nos.rename(${JSON.stringify(inside)}, ${JSON.stringify(moved)})\nos.symlink(${JSON.stringify(outside)}, ${JSON.stringify(inside)})\nos.execvp('ffprobe', ['ffprobe', *sys.argv[1:]])\n`);
    chmodSync(wrapper, 0o755);
    await client.connect(new StdioClientTransport({
      command: process.execPath, args: [join(ENGINE, 'bin/frameforge.mjs'), 'mcp', '--project', project], cwd: scratch,
      env: {...process.env, FFPROBE_PATH: wrapper} as Record<string, string>, stderr: 'pipe',
    }));
    const result = await client.callTool({name: 'video_frames', arguments: {video: join(inside, 'saved.mp4'), frames: [0]}}) as Result;
    assert.equal(result.isError, true, body(result));
    assert.match(body(result), /without following symlinks/);
    assert.equal(result.content.some(item => item.type === 'image'), false, 'a swapped path cannot produce a misleading result');
    assert.equal(createHash('sha256').update(readFileSync(join(moved, 'saved.mp4'))).digest('hex'), originalHash);
  } finally {
    await client.close();
    rmSync(scratch, {recursive: true, force: true});
  }
});

test('MCP accepts a project ancestor alias without following project-internal symlinks', {timeout: 30000, skip: process.platform === 'win32'}, async () => {
  const aliasScratch = mkdtempSync('/tmp/ff-mcp-video-alias-');
  const scratch = realpathSync(aliasScratch);
  const project = join(scratch, 'project');
  const client = new Client({name: 'mcp-video-alias-test', version: '0'});
  try {
    mkdirSync(project);
    writeFileSync(join(project, 'frameforge.json'), JSON.stringify({engine: ENGINE, films: 'films'}));
    const video = join(project, 'saved.mp4');
    const encoded = spawnSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=red:s=64x64:r=4', '-t', '1', '-pix_fmt', 'yuv420p', video], {encoding: 'utf8'});
    assert.equal(encoded.status, 0, encoded.stderr);
    await client.connect(new StdioClientTransport({command: process.execPath, args: [join(ENGINE, 'bin/frameforge.mjs'), 'mcp', '--project', project], stderr: 'pipe'}));
    const aliasedVideo = join(aliasScratch, 'project', 'saved.mp4');
    const valid = await client.callTool({name: 'video_frames', arguments: {video: aliasedVideo, frames: [0]}}) as Result;
    assert.ok(!valid.isError, body(valid));
    assert.equal((JSON.parse(body(valid)) as {source: {path: string}}).source.path, video);
    symlinkSync(project, join(project, 'back-to-root'));
    const internal = await client.callTool({name: 'video_frames', arguments: {video: join(project, 'back-to-root', 'saved.mp4'), frames: [0]}}) as Result;
    assert.equal(internal.isError, true, 'an internal symlink back to root must not become a root alias');
    assert.equal(internal.content.some(item => item.type === 'image'), false);
  } finally {
    await client.close();
    rmSync(scratch, {recursive: true, force: true});
  }
});

test('MCP cancellation cleans temporary extracted-frame data', {timeout: 30000, skip: process.platform === 'win32'}, async () => {
  const scratch = realpathSync(mkdtempSync(join(tmpdir(), 'ff-mcp-video-cancel-')));
  const project = join(scratch, 'project');
  const temporary = join(scratch, 'tmp');
  const marker = join(scratch, 'probe-started');
  const wrapper = join(scratch, 'slow-ffprobe');
  const client = new Client({name: 'mcp-video-cancel-test', version: '0'});
  const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  try {
    mkdirSync(project);
    mkdirSync(temporary);
    writeFileSync(join(project, 'frameforge.json'), JSON.stringify({engine: ENGINE, films: 'films'}));
    const video = join(project, 'saved.mp4');
    const encoded = spawnSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=red:s=64x64:r=4', '-t', '1', '-pix_fmt', 'yuv420p', video], {encoding: 'utf8'});
    assert.equal(encoded.status, 0, encoded.stderr);
    writeFileSync(wrapper, `#!/usr/bin/env python3\nimport pathlib, time\npathlib.Path(${JSON.stringify(marker)}).touch()\ntime.sleep(10)\n`);
    chmodSync(wrapper, 0o755);
    await client.connect(new StdioClientTransport({
      command: process.execPath, args: [join(ENGINE, 'bin/frameforge.mjs'), 'mcp', '--project', project], cwd: scratch,
      env: {...process.env, TMPDIR: temporary, FFPROBE_PATH: wrapper} as Record<string, string>, stderr: 'pipe',
    }));
    const abort = new AbortController();
    const pending = client.callTool({name: 'video_frames', arguments: {video, frames: [0]}}, undefined, {signal: abort.signal});
    for (let i = 0; i < 50 && !existsSync(marker); i++) await pause(100);
    assert.ok(existsSync(marker), 'the child is running before cancellation');
    abort.abort();
    await assert.rejects(pending, /abort|cancel/i);
    for (let i = 0; i < 50 && readdirSync(temporary).some(name => name.startsWith('frameforge-video-frames-')); i++) await pause(100);
    assert.deepEqual(readdirSync(temporary).filter(name => name.startsWith('frameforge-video-frames-')), []);
  } finally {
    await client.close();
    rmSync(scratch, {recursive: true, force: true});
  }
});
