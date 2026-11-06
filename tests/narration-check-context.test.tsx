import assert from 'node:assert/strict';
import test from 'node:test';
import {cpSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ENGINE, runChecks} from '../bin/frameforge.mjs';

test('aggregate narration check preserves film prompt, explicit prompt and fps', {timeout: 60000}, () => {
  const folder = mkdtempSync(join(tmpdir(), 'frameforge-narration-context-'));
  const prompt = join(folder, 'prompt.md');
  const override = join(folder, 'override.md');
  const cut = '| Frames | Scene |\n|---|---|\n| 0-39 | Start |\n| 40-299 | Cut |\n';
  // Missing video deliberately fails unrelated checks; only narration wiring is under test.
  const narration = (options: {prompt?: string; fps?: string} = {}) => runChecks(join(folder, 'missing.mp4'), {folder, ...options}).find(row => row.check === 'narration-check')!;
  try {
    cpSync(join(ENGINE, 'tests/fixtures/narration/clean'), folder, {recursive: true});
    assert.equal(narration().status, 'PASS', 'existing no-prompt behaviour remains supported');
    writeFileSync(prompt, cut);
    const implicit = narration();
    assert.equal(implicit.status, 'FAIL', 'default film prompt must not be silently omitted');
    assert.match(implicit.detail, /scene_inside_line/);
    writeFileSync(override, '# No scene table\n');
    assert.equal(narration({prompt: override}).status, 'PASS', 'explicit prompt overrides film prompt');
    const highRate = narration({prompt: override, fps: '60'});
    assert.equal(highRate.status, 'FAIL', '60 fps narration ends beyond a 300-frame composition');
    assert.match(highRate.detail, /line_past_end/);
    const invalidRate = narration({prompt: override, fps: '0'});
    assert.equal(invalidRate.status, 'FAIL', 'invalid fps must not produce an aggregate pass');
    assert.match(invalidRate.detail, /options_invalid/);
    writeFileSync(override, cut);
    assert.match(narration({prompt: override}).detail, /scene_inside_line/, 'absolute explicit prompt resolves once');
  } finally {
    rmSync(folder, {recursive: true, force: true});
  }
});
