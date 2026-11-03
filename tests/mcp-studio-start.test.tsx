import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
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
    const repeated = await client.callTool({name: 'studio_start', arguments: {port}});
    assert.ok(!repeated.isError, JSON.stringify(repeated));
    assert.match(JSON.stringify(repeated.content), /running/);
    const otherPort = port === 65535 ? port - 1 : port + 1;
    const different = await client.callTool({name: 'studio_start', arguments: {port: otherPort}});
    assert.equal(different.isError, true, JSON.stringify(different));
    const project = mkdtempSync(join(tmpdir(), 'ff-studio-project-'));
    try {
      writeFileSync(join(project, 'frameforge.json'), '{}');
      const otherProject = await client.callTool({name: 'studio_start', arguments: {port, project}});
      assert.equal(otherProject.isError, true, JSON.stringify(otherProject));
    } finally { rmSync(project, {recursive: true, force: true}); }
    assert.ok(!(await client.callTool({name: 'studio_stop', arguments: {}})).isError);
  } finally {
    await client.close();
    if (existing.listening) await new Promise<void>(resolve => existing.close(() => resolve()));
  }
});

test('studio_stop cancels a studio that is still starting', {timeout: 30000}, async () => {
  const probe = createServer();
  await new Promise<void>(resolve => probe.listen(0, '127.0.0.1', resolve));
  const address = probe.address();
  assert.ok(address && typeof address !== 'string');
  const port = address.port;
  await new Promise<void>(resolve => probe.close(() => resolve()));
  const client = new Client({name: 'mcp-studio-stop-test', version: '0'});
  await client.connect(new StdioClientTransport({command: process.execPath, args: [join(ENGINE, 'bin/frameforge.mjs'), 'mcp'], cwd: ENGINE, stderr: 'pipe'}));
  const starting = client.callTool({name: 'studio_start', arguments: {port}});
  try {
    const duplicate = await client.callTool({name: 'studio_start', arguments: {port}});
    assert.equal(duplicate.isError, true, JSON.stringify(duplicate));
    assert.match(JSON.stringify(duplicate.content), /still starting/);
    const otherPort = port === 65535 ? port - 1 : port + 1;
    assert.equal((await client.callTool({name: 'studio_start', arguments: {port: otherPort}})).isError, true);
    const stopped = await client.callTool({name: 'studio_stop', arguments: {}});
    assert.match(JSON.stringify(stopped.content), /stopped/);
    assert.equal((await starting).isError, true);
  } finally {
    await starting;
    await client.callTool({name: 'studio_stop', arguments: {}});
    await client.close();
  }
});
