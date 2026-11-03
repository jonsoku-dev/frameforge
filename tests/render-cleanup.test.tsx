import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import {EventEmitter} from 'node:events';
import fs from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {PassThrough} from 'node:stream';
// @ts-expect-error the renderer is plain ESM without types
import {renderMedia} from '../scripts/render.mjs';

// Exercise the renderer's actual finally block and Node's actual recursive rm,
// without requiring Chrome. Only browser startup and individual rmdir errors
// are simulated; temporary profiles and sentinel files are real filesystem entries.
test('renderer scratch cleanup retries only transient failures and preserves shutdown ordering', {timeout: 15_000}, async t => {
  let mode: 'transient' | 'exhausted' | 'nonretryable' = 'transient';
  const adjacent = fs.mkdtempSync(join(tmpdir(), 'frameforge-cleanup-sentinel-'));
  const sentinel = join(adjacent, 'keep.txt');
  fs.writeFileSync(sentinel, 'untouched');
  const originalMkdtemp = fs.promises.mkdtemp;
  const originalRmdir = fs.rmdir;
  const priorChrome = process.env.CHROME_PATH;
  let directory = '', attempts = 0, browserExited = false;
  process.env.CHROME_PATH = 'frameforge-test-browser';
  t.mock.method(fs.promises, 'mkdtemp', async (prefix: string) => {
    directory = await originalMkdtemp(prefix);
    return directory;
  });
  t.mock.method(childProcess, 'spawn', (_command: string, args: string[]) => {
    const profile = args.find(arg => arg.startsWith('--user-data-dir='))!.split('=')[1]!;
    assert.equal(profile, join(directory, 'profile-0'));
    fs.mkdirSync(profile);
    fs.writeFileSync(join(profile, 'DevToolsActivePort'), '12345\n');
    const browser = Object.assign(new EventEmitter(), {
      stderr: new PassThrough(),
      exitCode: null,
      signalCode: null as NodeJS.Signals | null,
      kill(signal: NodeJS.Signals) {
        assert.equal(signal, 'SIGTERM');
        setImmediate(() => {
          browser.signalCode = signal;
          browserExited = true;
          browser.emit('exit', null, signal);
        });
        return true;
      },
    });
    return browser;
  });
  t.mock.method(globalThis, 'fetch', async () => new Response('[]'));
  t.mock.method(fs, 'rmdir', (path: fs.PathLike, ...args: unknown[]) => {
    if (String(path) === directory) {
      assert.ok(browserExited, 'browser shutdown must finish before scratch removal');
      attempts++;
      if (mode !== 'transient' || attempts <= 4) {
        const callback = args.at(-1) as (error: NodeJS.ErrnoException) => void;
        const error = Object.assign(new Error('injected cleanup failure'), {code: mode === 'nonretryable' ? 'EACCES' : 'ENOTEMPTY'});
        process.nextTick(() => callback(error));
        return;
      }
    }
    Reflect.apply(originalRmdir, fs, [path, ...args]);
  });
  syncBuiltinESMExports();
  try {
    for (const scenario of ['transient', 'exhausted', 'nonretryable'] as const) {
      mode = scenario; attempts = 0; browserExited = false;
      await assert.rejects(renderMedia({
        serveUrl: 'http://127.0.0.1:4318/', composition: 'Unused', outputLocation: join(adjacent, 'never.mp4'),
      }), mode === 'transient' ? /Chrome exposed no page target/ : {code: mode === 'nonretryable' ? 'EACCES' : 'ENOTEMPTY'});
      assert.ok(browserExited);
      if (mode === 'transient') {
        assert.equal(attempts, 5, 'four transient errors must be retried before removal succeeds');
        assert.ok(!fs.existsSync(directory), 'renderer scratch directory must be removed');
      } else {
        if (mode === 'nonretryable') assert.equal(attempts, 1, 'nontransient errors must not be retried');
        else assert.ok(attempts >= 6 && attempts <= 12, `bounded retry budget exceeded: ${attempts} rmdir calls`);
        assert.ok(fs.existsSync(directory), 'a final cleanup failure must not be hidden');
      }
      assert.equal(fs.readFileSync(sentinel, 'utf8'), 'untouched');
      assert.ok(!fs.existsSync(join(adjacent, 'never.mp4')), 'startup failure must not publish output');
      fs.rmSync(directory, {recursive: true, force: true});
      directory = '';
    }
  } finally {
    t.mock.restoreAll();
    syncBuiltinESMExports();
    if (priorChrome === undefined) delete process.env.CHROME_PATH;
    else process.env.CHROME_PATH = priorChrome;
    if (directory) fs.rmSync(directory, {recursive: true, force: true});
    fs.rmSync(adjacent, {recursive: true, force: true});
  }
});
