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
    assert.deepEqual((await client.listTools()).tools.map(tool => tool.name).sort(),
      ['brief_check', 'check', 'contact_sheet', 'film_files', 'film_list', 'film_new', 'lint', 'project_init', 'read_skill', 'render', 'score', 'still', 'studio_start', 'studio_stop']);
    assert.deepEqual((await client.listPrompts()).prompts.map(prompt => prompt.name).sort(), ['make_explainer', 'make_motion_film']);
    assert.match(JSON.stringify((await client.getPrompt({name: 'make_motion_film', arguments: {request: '10초 아이덴트'}})).messages), /10초 아이덴트/);

    const names = JSON.parse(body(await call('read_skill')));
    assert.ok(names.includes('frameforge-motion') && names.includes('frameforge-best-practices/bespoke'));
    assert.equal(body(await call('read_skill', {name: 'frameforge-motion'})), readFileSync(join(ENGINE, 'skills/frameforge-motion/SKILL.md'), 'utf8'));
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
