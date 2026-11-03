import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import {EventEmitter} from 'node:events';
import fs from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PassThrough} from 'node:stream';
import test from 'node:test';
// @ts-expect-error plain ESM renderer
import {renderMedia} from '../scripts/render.mjs';

type Mode = 'spawn-error' | 'exit' | 'signal' | 'empty' | 'overflow' | 'held-stderr' | 'timeout';
for (const mode of ['spawn-error', 'exit', 'signal', 'empty', 'overflow', 'held-stderr', 'timeout'] as Mode[]) {
  test(`browser startup diagnostics: ${mode}`, {timeout: 16_000}, async t => {
    const originalMkdtemp = fs.promises.mkdtemp;
    const priorChrome = process.env.CHROME_PATH;
    const parent = fs.mkdtempSync(join(tmpdir(), 'frameforge-startup-test-'));
    const output = join(parent, 'never.mp4');
    let scratch = '', killed = false;
    process.env.CHROME_PATH = 'frameforge-test-browser';
    t.mock.method(fs.promises, 'mkdtemp', async (prefix: string) => {
      scratch = await originalMkdtemp(prefix);
      return scratch;
    });
    t.mock.method(childProcess, 'spawn', (_command: string, _args: string[], options: {stdio: string[]}) => {
      const stderr = new PassThrough();
      const browser = Object.assign(new EventEmitter(), {
        stderr, exitCode: null as number | null, signalCode: null as NodeJS.Signals | null,
        kill(signal: NodeJS.Signals) {
          killed = true;
          setImmediate(() => {
            browser.signalCode = signal;
            browser.emit('exit', null, signal);
            browser.emit('close', null, signal);
          });
          return true;
        },
      });
      setImmediate(() => {
        if (mode === 'spawn-error') {
          browser.exitCode = -2;
          browser.emit('error', Object.assign(new Error('spawn frameforge-test-browser ENOENT'), {code: 'ENOENT'}));
          browser.emit('close', -2, null);
        } else {
          if (mode !== 'empty') stderr.write(mode === 'overflow' ? `DROP-ME${'x'.repeat(9000)}TAIL-MARKER` : 'launch diagnostic marker\n');
          if (mode !== 'timeout') {
            browser.exitCode = mode === 'empty' ? 0 : mode === 'signal' ? null : 42;
            browser.signalCode = mode === 'signal' ? 'SIGABRT' : null;
            browser.emit('exit', browser.exitCode, browser.signalCode);
            // Flush a final diagnostic after exit, before close, like a real ChildProcess.
            if (mode === 'exit') stderr.write('final diagnostic\n');
            if (mode !== 'held-stderr') {
              stderr.end();
              browser.emit('close', browser.exitCode, browser.signalCode);
            }
          }
        }
      });
      assert.deepEqual(options.stdio, ['ignore', 'ignore', 'pipe']);
      return browser;
    });
    syncBuiltinESMExports();
    const start = performance.now();
    try {
      await assert.rejects(renderMedia({serveUrl: 'http://127.0.0.1:4318/', composition: 'Unused', outputLocation: output}), (error: Error) => {
        if (mode === 'spawn-error') assert.match(error.message, /Chrome failed to start:.*ENOENT/);
        else if (mode === 'timeout') assert.match(error.message, /Chrome did not write DevToolsActivePort within 10 s/);
        else assert.match(error.message, mode === 'signal' ? /Chrome exited before DevTools was ready.*SIGABRT/ : new RegExp(`Chrome exited before DevTools was ready.*${mode === 'empty' ? 0 : 42}`));
        if (mode === 'overflow') {
          assert.ok(!error.message.includes('DROP-ME'));
          assert.ok(error.message.endsWith('TAIL-MARKER'));
          assert.ok(error.message.length <= 8200);
        } else if (mode !== 'empty' && mode !== 'spawn-error') assert.match(error.message, /launch diagnostic marker/);
        if (mode === 'exit') assert.match(error.message, /final diagnostic/);
        return true;
      });
      if (mode !== 'timeout') assert.ok(performance.now() - start < 2000, 'early failure must not wait for readiness timeout');
      else {
        assert.ok(performance.now() - start >= 10_000, 'live readiness budget must remain ten seconds');
        assert.ok(killed, 'live timed-out browser must be stopped');
      }
      assert.ok(!fs.existsSync(scratch), 'owned scratch must be removed');
      assert.ok(!fs.existsSync(output), 'startup failure must not publish output');
    } finally {
      t.mock.restoreAll(); syncBuiltinESMExports();
      if (priorChrome === undefined) delete process.env.CHROME_PATH;
      else process.env.CHROME_PATH = priorChrome;
      fs.rmSync(parent, {recursive: true, force: true});
      if (scratch) fs.rmSync(scratch, {recursive: true, force: true});
    }
  });
}
