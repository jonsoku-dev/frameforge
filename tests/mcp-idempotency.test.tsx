import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {ENGINE} from '../bin/frameforge.mjs';

type Result = {content: {type: string; text?: string}[]; isError?: boolean};
const body = (result: Result) => result.content.map(item => item.text ?? '').join('\n');

test('MCP render checks the requested frames and reports its actual coverage', {timeout: 120000}, async () => {
  const scratch = mkdtempSync(join(tmpdir(), 'ff-mcp-idempotency-'));
  const project = join(scratch, 'project');
  const client = new Client({name: 'mcp-idempotency-test', version: '0'});
  try {
    await client.connect(new StdioClientTransport({
      command: process.execPath, args: [join(ENGINE, 'bin/frameforge.mjs'), 'mcp'], cwd: scratch,
      env: {...process.env, FRAMEFORGE_PORT: String(30000 + process.pid % 20000)} as Record<string, string>, stderr: 'pipe',
    }));
    const call = (name: string, args: Record<string, unknown>) => client.callTool({name, arguments: args}) as Promise<Result>;
    assert.ok(!(await call('project_init', {dir: project})).isError);
    symlinkSync(join(ENGINE, 'node_modules'), join(project, 'node_modules'), 'dir');
    for (const slug of ['stable', 'unstable']) {
      assert.ok(!(await call('film_new', {slug})).isError);
      const folder = join(project, 'films', slug);
      rmSync(join(folder, 'audio.json'));
      writeFileSync(join(folder, 'entry.tsx'), `
import {Composition, registerRoot, useCurrentFrame} from 'frameforge';
let visits = 0;
function Spot() { const frame = useCurrentFrame(); if (${slug === 'unstable'} && frame === 1) visits++; return <div style={{width:128,height:128,background:'white',color:'black',fontSize:60}}>{frame === 1 ? visits : frame}</div>; }
registerRoot(() => <Composition id="Demo" component={Spot} durationInFrames={3} fps={30} width={128} height={128}/>);
`);
    }
    for (const invalid of [[], [-1], [0.5]]) {
      assert.equal((await call('render', {slug: 'stable', idempotent_frames: invalid})).isError, true);
    }
    const basic = await call('render', {slug: 'stable', frame_range: [0, 2]});
    assert.ok(!basic.isError, body(basic));
    const basicSummary = JSON.parse(body(basic)).summary;
    assert.equal(basicSummary.idempotent, undefined, 'the existing default does not request a check');
    const checked = await call('render', {slug: 'stable', frame_range: [0, 2], idempotent_frames: [2, 1, 0]});
    assert.ok(!checked.isError, body(checked));
    const summary = JSON.parse(body(checked)).summary;
    assert.equal(summary.idempotent, true);
    assert.deepEqual(summary.idempotentFrames, [2, 1, 0]);
    const changed = await call('render', {slug: 'unstable', frame_range: [0, 2], idempotent_frames: [1]});
    assert.equal(changed.isError, true);
    assert.match(body(changed), /frame_not_idempotent: frame 1/);
  } finally {
    await client.close();
    rmSync(scratch, {recursive: true, force: true});
  }
});
