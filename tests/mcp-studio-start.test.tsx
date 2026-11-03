import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import test from 'node:test';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {join} from 'node:path';
import {ENGINE} from '../bin/frameforge.mjs';

test('studio_start rejects an occupied port and starts a studio on a free port', {timeout: 30000}, async () => {
  const existing = createServer((_request, response) => response.end('other server'));
  await new Promise<void>(resolve => existing.listen(0, '127.0.0.1', resolve));
  const address = existing.address();
  assert.ok(address && typeof address !== 'string');
  const port = address.port;
  const url = `http://127.0.0.1:${port}/`;
  const client = new Client({name: 'mcp-studio-test', version: '0'});
  await client.connect(new StdioClientTransport({command: process.execPath, args: [join(ENGINE, 'bin/frameforge.mjs'), 'mcp'], cwd: ENGINE, stderr: 'pipe'}));
  try {
    const busy = await client.callTool({name: 'studio_start', arguments: {port}});
    assert.equal(busy.isError, true, JSON.stringify(busy));
    assert.match(JSON.stringify(busy.content), /exited|already in use/);
    assert.equal(await (await fetch(url)).text(), 'other server');
    await new Promise<void>((resolve, reject) => existing.close(error => error ? reject(error) : resolve()));
    const started = await client.callTool({name: 'studio_start', arguments: {port}});
    assert.ok(!started.isError, JSON.stringify(started));
    assert.equal((await fetch(url)).status, 200);
    assert.ok(!(await client.callTool({name: 'studio_stop', arguments: {}})).isError);
  } finally {
    await client.close();
    if (existing.listening) await new Promise<void>(resolve => existing.close(() => resolve()));
  }
});
