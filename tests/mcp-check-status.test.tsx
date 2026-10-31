import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {ENGINE} from '../bin/frameforge.mjs';

type Result = {content: {type: string; text?: string}[]; isError?: boolean};
const body = (result: Result) => result.content.map(item => item.text ?? '').join('\n');

test('MCP check separates all-pass, warnings, intentional skips and failures', {timeout: 90000}, async () => {
  const project = realpathSync(mkdtempSync(join(tmpdir(), 'ff-mcp-check-status-')));
  const folder = join(project, 'films', 'check');
  const video = join(project, 'video.mp4');
  const sidecar = `${video}.motion.json`;
  const prompt = join(folder, 'prompt.md');
  const fixture = (name: string) => JSON.parse(readFileSync(join(ENGINE, 'tests/fixtures/seams', `${name}.motion.json`), 'utf8'));
  const client = new Client({name: 'mcp-check-status-test', version: '0'});
  try {
    mkdirSync(folder, {recursive: true});
    writeFileSync(join(project, 'frameforge.json'), JSON.stringify({engine: ENGINE, films: 'films'}));
    for (const name of ['brief.md', 'entry.tsx']) writeFileSync(join(folder, name), readFileSync(join(ENGINE, 'tests/fixtures/brief', name)));
    writeFileSync(join(folder, 'narration.timing.json'), JSON.stringify({slug: 'check', lines: [], totalMs: 0}));
    const encoded = spawnSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=30', '-t', '2', '-pix_fmt', 'yuv420p', '-y', video], {encoding: 'utf8'});
    assert.equal(encoded.status, 0, encoded.stderr);
    await client.connect(new StdioClientTransport({command: process.execPath, args: [join(ENGINE, 'bin/frameforge.mjs'), 'mcp', '--project', project], stderr: 'pipe'}));
    const clean = fixture('clean');
    const check = async (motion: unknown, cuts: string) => {
      writeFileSync(sidecar, JSON.stringify(motion));
      writeFileSync(prompt, cuts);
      const result = await client.callTool({name: 'check', arguments: {video, slug: 'check'}}) as Result;
      return {result, value: JSON.parse(body(result)) as {pass: boolean; noFailures: boolean; rows: {check: string; status: string; detail: string}[]}};
    };
    const allPass = await check(clean, 'Cuts: 30\n');
    assert.equal(allPass.result.isError, false);
    assert.equal(allPass.value.pass, true);
    assert.equal(allPass.value.noFailures, true);
    assert.ok(allPass.value.rows.every(row => row.status === 'PASS'));

    const warn = await check({...clean, samples: []}, 'Cuts: 30\n');
    assert.equal(warn.result.isError, false);
    assert.equal(warn.value.pass, false);
    assert.equal(warn.value.noFailures, true);
    assert.equal(warn.value.rows.find(row => row.check === 'seam-check')?.status, 'WARN');

    const noCuts = await check({...clean, samples: []}, 'Cuts: none\n');
    assert.equal(noCuts.result.isError, false);
    assert.equal(noCuts.value.pass, false, 'an intentional no-cuts skip is not a measured pass');
    assert.equal(noCuts.value.noFailures, true);
    assert.deepEqual(noCuts.value.rows.find(row => row.check === 'seam-check'), {check: 'seam-check', status: 'SKIP', detail: 'Cuts: none'});

    const failed = await check(fixture('mirrored'), 'Cuts: 30\n');
    assert.equal(failed.result.isError, true);
    assert.equal(failed.value.pass, false);
    assert.equal(failed.value.noFailures, false);
    assert.equal(failed.value.rows.find(row => row.check === 'seam-check')?.status, 'FAIL');
  } finally {
    await client.close();
    rmSync(project, {recursive: true, force: true});
  }
});
