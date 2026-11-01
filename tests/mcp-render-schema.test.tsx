import assert from 'node:assert/strict';
import test from 'node:test';
import {existsSync, mkdtempSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {ENGINE} from '../bin/frameforge.mjs';

type Result = {content: {type: string; text?: string}[]; isError?: boolean};
const body = (result: Result) => result.content.map(item => item.text ?? '').join('\n');

test('MCP render exposes a portable two-integer range and validates it before rendering', {timeout: 120000}, async () => {
  const scratch = mkdtempSync(join(tmpdir(), 'ff-mcp-range-'));
  const project = join(scratch, 'project');
  const client = new Client({name: 'mcp-range-test', version: '0'});
  try {
    await client.connect(new StdioClientTransport({
      command: process.execPath, args: [join(ENGINE, 'bin/frameforge.mjs'), 'mcp'], cwd: scratch,
      env: {...process.env, FRAMEFORGE_PORT: String(30000 + process.pid % 20000)} as Record<string, string>, stderr: 'pipe',
    }));
    const render = (await client.listTools()).tools.find(tool => tool.name === 'render');
    assert.ok(render);
    const schema = render.inputSchema as {properties: Record<string, Record<string, unknown>>; required?: string[]};
    const range = schema.properties.frame_range!;
    assert.equal(range.type, 'array');
    assert.equal(range.minItems, 2);
    assert.equal(range.maxItems, 2);
    assert.equal('prefixItems' in range, false);
    assert.equal(typeof range.items, 'object', 'all items use a common schema');
    assert.equal((range.items as {type?: string}).type, 'integer');
    assert.ok(!schema.required?.includes('frame_range'), 'omitting the range still renders the whole film');

    const call = (name: string, args: Record<string, unknown>) => client.callTool({name, arguments: args}) as Promise<Result>;
    assert.ok(!(await call('project_init', {dir: project})).isError);
    symlinkSync(join(ENGINE, 'node_modules'), join(project, 'node_modules'), 'dir');
    assert.ok(!(await call('film_new', {slug: 'range'})).isError);
    const folder = join(project, 'films', 'range');
    rmSync(join(folder, 'audio.json'));
    writeFileSync(join(folder, 'entry.tsx'), `
import {Composition, registerRoot, useCurrentFrame} from 'frameforge';
function Spot() { const frame = useCurrentFrame(); return <div style={{width:128,height:128,background:'white',color:'black',fontSize:60}}>{frame}</div>; }
registerRoot(() => <Composition id="Range" component={Spot} durationInFrames={3} fps={30} width={128} height={128}/>);
`);
    for (const invalid of [[], [0], [0, 1, 2], [-1, 1], [0.5, 2], [2, 1]]) {
      const result = await call('render', {slug: 'range', frame_range: invalid});
      assert.equal(result.isError, true, `reject ${JSON.stringify(invalid)}: ${body(result)}`);
    }
    assert.equal(existsSync(join(project, 'renders')), false, 'invalid ranges do not start rendering');
    const valid = await call('render', {slug: 'range', frame_range: [0, 2]});
    assert.ok(!valid.isError, body(valid));
    const output = JSON.parse(body(valid)) as {video: string; summary: {frames: number}};
    assert.equal(output.summary.frames, 3);
    assert.ok(existsSync(output.video));
  } finally {
    await client.close();
    rmSync(scratch, {recursive: true, force: true});
  }
});
