import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chmodSync, existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {ENGINE} from '../bin/frameforge.mjs';

test('cancelling an MCP CLI call stops its ordinary descendants without signalling an unrelated group', {
  timeout: 20_000,
  skip: process.platform === 'win32' ? 'POSIX process groups are not available' : false,
}, async () => {
  const scratch = realpathSync(mkdtempSync(join(tmpdir(), 'ff-mcp-cancel-')));
  const project = join(scratch, 'project');
  const marker = join(scratch, 'started'), late = join(scratch, 'late-write');
  const python = join(scratch, 'python3');
  const client = new Client({name: 'cancel-test', version: '0'});
  const sentinel = spawn('/bin/sleep', ['30'], {detached: true, stdio: 'ignore'});
  const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  try {
    mkdirSync(project);
    writeFileSync(join(project, 'frameforge.json'), JSON.stringify({engine: ENGINE, films: 'films'}));
    const film = join(project, 'films', 'cancel');
    mkdirSync(film, {recursive: true});
    writeFileSync(join(film, 'entry.tsx'), '');
    writeFileSync(join(film, 'audio.json'), '{}');
    writeFileSync(python, `#!${process.execPath}\nconst {spawn} = require('node:child_process');\nconst {writeFileSync} = require('node:fs');\nspawn(process.execPath, ['-e', ${JSON.stringify(`setTimeout(() => require('node:fs').writeFileSync(${JSON.stringify(late)}, 'survived'), 2000)`)}], {stdio:'ignore'});\nwriteFileSync(${JSON.stringify(marker)}, 'ready');\nsetTimeout(() => {}, 30000);\n`);
    chmodSync(python, 0o755);
    await client.connect(new StdioClientTransport({command: process.execPath, args: [join(ENGINE, 'bin/frameforge.mjs'), 'mcp', '--project', project], cwd: scratch, env: {...process.env, PATH: `${scratch}:${process.env.PATH}`} as Record<string, string>, stderr: 'pipe'}));
    const controller = new AbortController();
    const pending = client.callTool({name: 'score', arguments: {slug: 'cancel'}}, undefined, {signal: controller.signal});
    for (let n = 0; n < 100 && !existsSync(marker); n++) await pause(50);
    assert.ok(existsSync(marker), 'child and grandchild are running before cancellation');
    controller.abort();
    await assert.rejects(pending, /abort|cancel/i);
    await pause(2500);
    assert.equal(existsSync(late), false, 'the ordinary grandchild did not continue writing');
    assert.equal(sentinel.exitCode, null, 'unrelated process group was not signalled');
    assert.equal(sentinel.signalCode, null);
  } finally {
    sentinel.kill('SIGKILL');
    await client.close();
    rmSync(scratch, {recursive: true, force: true});
  }
});
