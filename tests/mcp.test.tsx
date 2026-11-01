import assert from 'node:assert/strict';
import test from 'node:test';
import {existsSync, mkdtempSync, readFileSync, realpathSync, symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {ENGINE} from '../bin/frameforge.mjs';

type Result = {content: {type: string; text?: string}[]; isError?: boolean};
const body = (result: Result) => result.content.map(item => item.text ?? '').join('\n');

test('the MCP server lists tools and prompts, reads skills, writes only inside a film folder and checks a brief', async () => {
  const scratch = realpathSync(mkdtempSync(join(tmpdir(), 'ff-mcp-')));
  const project = join(scratch, 'project');
  const client = new Client({name: 'mcp-test', version: '0'});
  await client.connect(new StdioClientTransport({command: process.execPath, args: [join(ENGINE, 'bin/frameforge.mjs'), 'mcp'], cwd: scratch, stderr: 'pipe'}));
  try {
    const call = (name: string, args: Record<string, unknown> = {}) => client.callTool({name, arguments: args}) as Promise<Result>;
    const toolNames = (await client.listTools()).tools.map(tool => tool.name).sort();
    assert.deepEqual(toolNames,
      ['brief_check', 'check', 'contact_sheet', 'film_files', 'film_list', 'film_new', 'lint', 'project_init', 'read_skill', 'render', 'score', 'still', 'studio_start', 'studio_stop', 'video_frames']);
    const bundle = JSON.parse(readFileSync(join(ENGINE, 'mcpb/manifest.json'), 'utf8')) as {tools: {name: string}[]};
    assert.deepEqual(bundle.tools.map(tool => tool.name).sort(), toolNames, 'Desktop bundle lists the live MCP tools');
    assert.deepEqual((await client.listPrompts()).prompts.map(prompt => prompt.name).sort(), ['make_explainer', 'make_motion_film']);
    const motionPrompt = JSON.stringify((await client.getPrompt({name: 'make_motion_film', arguments: {request: '10초 아이덴트'}})).messages);
    assert.match(motionPrompt, /10초 아이덴트/);
    assert.match(motionPrompt, /prior and next information, focus, retained elements, transition and settled reading interval/);
    assert.match(motionPrompt, /NOT VERIFIED/);
    assert.match(motionPrompt, /Stills and audio measurements do not prove playback or listening/);
    assert.match(motionPrompt, /otherwise use a permitted host method, or mark saved-render observations NOT VERIFIED/);
    assert.match(motionPrompt, /contact_sheet and still render the current source and do not prove what is in a saved MP4/);
    const explainerPrompt = JSON.stringify((await client.getPrompt({name: 'make_explainer', arguments: {request: '무음 제품 사용법'}})).messages);
    assert.match(explainerPrompt, /무음 제품 사용법/);
    assert.match(explainerPrompt, /MET, UNMET or NOT VERIFIED/);
    assert.match(explainerPrompt, /actual check statuses/);
    assert.match(explainerPrompt, /Preserve requested audio or silence/);
    assert.match(explainerPrompt, /never delete user-owned files/);

    const names = JSON.parse(body(await call('read_skill')));
    assert.ok(names.includes('frameforge-motion') && names.includes('frameforge-best-practices/bespoke'));
    assert.equal(body(await call('read_skill', {name: 'frameforge-motion'})), readFileSync(join(ENGINE, 'skills/frameforge-motion/SKILL.md'), 'utf8'));
    const createSkill = body(await call('read_skill', {name: 'frameforge-create'}));
    assert.equal(createSkill, readFileSync(join(ENGINE, 'skills/frameforge-create/SKILL.md'), 'utf8'));
    assert.match(createSkill, /Preserve requested audio or silence/);
    assert.match(createSkill, /Never delete user-owned files/);
    assert.equal((await call('read_skill', {name: '../package'})).isError, true, 'a traversal name is rejected');

    const init = await call('project_init', {dir: project});
    assert.ok(!init.isError, body(init));
    const made = await call('film_new', {slug: 'demo-spot'});
    assert.ok(!made.isError, body(made));
    assert.deepEqual(JSON.parse(body(await call('film_list'))).films.map((film: {slug: string; id: string}) => [film.slug, film.id]), [['demo-spot', 'DemoSpot']],
      'project_init made the new project the default');

    const files = JSON.parse(body(await call('film_files', {slug: 'demo-spot', action: 'list'})));
    assert.ok(files.includes('Spot.tsx') && files.includes('brief.md'));
    assert.ok(!(await call('film_files', {slug: 'demo-spot', action: 'write', path: 'notes/a.md', content: 'hi'})).isError);
    assert.equal(readFileSync(join(project, 'films/demo-spot/notes/a.md'), 'utf8'), 'hi');
    for (const path of ['../index.tsx', '../../frameforge.json', '/etc/hosts', 'notes/../../x.md']) {
      const refused = await call('film_files', {slug: 'demo-spot', action: 'write', path, content: 'x'});
      assert.equal(refused.isError, true, `refuses ${path}`);
      assert.match(body(refused), /relative|escapes/);
    }
    symlinkSync(scratch, join(project, 'films/demo-spot/out'));
    assert.match(body(await call('film_files', {slug: 'demo-spot', action: 'write', path: 'out/x.md', content: 'x'})), /symlink/);
    assert.ok(!existsSync(join(scratch, 'x.md')), 'nothing written through the symlink');
    assert.equal((await call('film_files', {slug: '../etc', action: 'list'})).isError, true);

    assert.equal((await call('brief_check', {slug: 'demo-spot'})).isError, true, 'the template brief has no request yet');
    for (const name of ['brief.md', 'entry.tsx']) await call('film_files', {slug: 'demo-spot', action: 'write', path: name, content: readFileSync(join(ENGINE, 'tests/fixtures/brief', name), 'utf8')});
    const passed = await call('brief_check', {slug: 'demo-spot'});
    assert.ok(!passed.isError, body(passed));
    assert.equal((await call('check', {video: '/etc/hosts'})).isError, true, 'check refuses a video outside the project');
  } finally { await client.close(); }
});

test('a tunnelled HTTP server needs a token and rejects requests without it', async () => {
  const {spawn, spawnSync} = await import('node:child_process');
  const bin = join(ENGINE, 'bin/frameforge.mjs');
  const refused = spawnSync(process.execPath, [bin, 'mcp', '--http', '--port', '4391', '--allow-host', 'x.example'], {encoding: 'utf8', env: {...process.env, FRAMEFORGE_MCP_TOKEN: ''}});
  assert.notEqual(refused.status, 0);
  assert.match(refused.stderr + refused.stdout, /FRAMEFORGE_MCP_TOKEN/);
  const token = 'test-token-0123456789';
  const server = spawn(process.execPath, [bin, 'mcp', '--http', '--port', '4392', '--allow-host', 'x.example'], {env: {...process.env, FRAMEFORGE_MCP_TOKEN: token}, stdio: ['ignore', 'ignore', 'pipe']});
  try {
    await new Promise<void>((ready, fail) => { server.stderr!.on('data', chunk => String(chunk).includes('Frameforge MCP on') && ready()); server.once('exit', code => fail(new Error(`exited ${code}`))); });
    const post = (path: string, headers: Record<string, string> = {}) => fetch(`http://127.0.0.1:4392${path}`, {method: 'POST', headers: {'content-type': 'application/json', accept: 'application/json, text/event-stream', ...headers}, body: JSON.stringify({jsonrpc: '2.0', id: 1, method: 'tools/list'})});
    assert.equal((await post('/mcp')).status, 401);
    assert.equal((await post('/mcp', {authorization: 'Bearer wrong-token-0123456789'})).status, 401);
    assert.notEqual((await post('/mcp', {authorization: `Bearer ${token}`})).status, 401);
    assert.notEqual((await post(`/mcp/${token}`)).status, 401);
  } finally { server.kill(); }
});
